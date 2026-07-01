import * as L from "leaflet";
import { SNCF_CONNECT_SEARCH } from "@/config";
import type { StationRepository } from "@/data/StationRepository";
import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import type { Station } from "@/domain/models";
import { formatDuration } from "@/domain/time";
import { addDays, frDateLong, iso, today } from "@/lib/dates";
import { prettyStation } from "@/lib/text";
import { StationPicker } from "../components/StationPicker";
import { hint } from "../components/states";
import { clear, el, field, select } from "../dom";
import { ACCENT, createMap, type MapHandle, originIcon } from "../map/MapKit";
import type { View } from "./View";

interface MapDatum {
  dest: string;
  metric: number;
  label: string;
  first?: string;
  fastestMinutes?: number;
}

/** Geographic view of reachable destinations over the real rail network. */
export class MapView implements View {
  readonly id = "map";
  readonly label = "Carte";
  readonly emoji = "🗺️";
  readonly hint = "vue géographique";
  readonly element: HTMLElement;

  private readonly fromPicker: StationPicker;
  private readonly scopeSelect: HTMLSelectElement;
  private readonly dateInput: HTMLInputElement;
  private readonly summary = el("div", { class: "summary" });
  private readonly mapEl = el("div", { class: "map" });
  private readonly handle: MapHandle;
  private loaded = false;

  constructor(
    private readonly repo: TgvmaxRepository,
    private readonly stations: StationRepository,
  ) {
    this.fromPicker = new StationPicker(stations, {
      placeholder: "ex. Paris",
      value: "PARIS (intramuros)",
      onSelect: () => void this.run(),
    });
    this.dateInput = el("input", {
      class: "date-input",
      type: "date",
      min: iso(today()),
      value: iso(addDays(today(), 1)),
    });
    this.dateInput.addEventListener("change", () => {
      if (this.scopeSelect.value === "date") void this.run();
    });
    this.scopeSelect = select(
      [
        ["range", "30 prochains jours"],
        ["date", "Une date précise"],
      ],
      () => {
        this.toggleDateField();
        void this.run();
      },
    );

    const controls = el("div", { class: "controls" }, [
      field("Départ", this.fromPicker.element),
      field("Période", this.scopeSelect),
      field("Date", this.dateInput),
      el("button", {
        class: "btn-primary",
        text: "Afficher la carte",
        onclick: () => void this.run(),
      }),
    ]);
    this.element = el("section", { class: "panel" }, [
      controls,
      this.summary,
      el("div", { class: "map-wrap" }, [this.mapEl]),
      hint(
        "Survolez une gare pour la mettre en avant, cliquez pour les détails. Fond : vraies lignes SNCF colorées par vitesse (LGV en rose) — couches en haut à droite.",
      ),
    ]);

    this.handle = createMap(this.mapEl, { zoom: 6 });
    this.toggleDateField();
  }

  activate(): void {
    if (!this.loaded) void this.run();
    setTimeout(() => this.handle.map.invalidateSize(), 60);
  }

  private toggleDateField(): void {
    const dateField = this.dateInput.parentElement;
    if (dateField) dateField.style.display = this.scopeSelect.value === "date" ? "" : "none";
  }

  private async run(): Promise<void> {
    const from = this.fromPicker.value;
    if (!from) return;
    const origin = this.stations.get(from);
    if (!origin) return;
    clear(this.summary).appendChild(hint("Chargement de la carte…"));
    try {
      const byDate = this.scopeSelect.value === "date";
      const data: MapDatum[] = byDate
        ? (await this.repo.destinationsOn(from, this.dateInput.value)).map((r) => ({
            dest: r.destination,
            metric: r.trains,
            label: `${r.trains} trajet(s)`,
            first: r.firstDeparture,
            fastestMinutes: r.fastestMinutes,
          }))
        : (await this.repo.destinationsRange(from)).map((r) => ({
            dest: r.destination,
            metric: r.days,
            label: `${r.days} jour(s) · ${r.trains} trajet(s)`,
          }));
      this.loaded = true;
      this.draw(from, origin, data, byDate);
    } catch (e) {
      clear(this.summary).appendChild(hint(`Erreur : ${(e as Error).message}`));
    }
  }

  private draw(from: string, origin: Station, data: MapDatum[], byDate: boolean): void {
    this.handle.routes.clearLayers();
    this.handle.markers.clearLayers();
    const points: L.LatLngTuple[] = [[origin.lat, origin.lon]];
    const maxMetric = Math.max(1, ...data.map((d) => d.metric));

    L.marker([origin.lat, origin.lon], { icon: originIcon(), zIndexOffset: 1000 })
      .addTo(this.handle.markers)
      .bindTooltip(`${prettyStation(from)} · départ`, { direction: "top" });

    for (const d of data) {
      const s = this.stations.get(d.dest);
      if (!s) continue;
      points.push([s.lat, s.lon]);
      const marker = L.circleMarker([s.lat, s.lon], {
        radius: 5 + 13 * Math.sqrt(d.metric / maxMetric),
        color: "#fff",
        weight: 1.5,
        fillColor: heat(d.metric / maxMetric),
        fillOpacity: 0.9,
      })
        .addTo(this.handle.markers)
        .bindTooltip(`${prettyStation(d.dest)} · ${d.label}`, { direction: "top" })
        .bindPopup(popupHtml(d));
      marker.on("mouseover", () => marker.setStyle({ color: ACCENT, weight: 3 }));
      marker.on("mouseout", () => marker.setStyle({ color: "#fff", weight: 1.5 }));
    }

    if (points.length > 1) this.handle.map.fitBounds(points, { padding: [40, 40] });
    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html:
          `<b>${data.length}</b> destination${data.length > 1 ? "s" : ""} avec place MAX depuis <b>${prettyStation(from)}</b> · ` +
          (byDate ? frDateLong(this.dateInput.value) : "30 prochains jours") +
          (data.length ? "" : ' — <span class="ko">rien trouvé</span>'),
      }),
    );
    this.handle.map.invalidateSize();
  }
}

const heat = (t: number): string => (t > 0.66 ? "#1a8a3f" : t > 0.33 ? "#4caf50" : "#a5d6a7");

function popupHtml(d: MapDatum): string {
  const dur = d.fastestMinutes ? ` · ${formatDuration(d.fastestMinutes)}` : "";
  const departure = d.first ? `<br>dès ${d.first}${dur}` : "";
  return `<div class="pop"><b>${prettyStation(d.dest)}</b><br>${d.label}${departure}<br><a href="${SNCF_CONNECT_SEARCH}" target="_blank" rel="noopener">Réserver ↗</a></div>`;
}
