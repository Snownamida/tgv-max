import * as L from "leaflet";
import type { StationRepository } from "@/data/StationRepository";
import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import type { Train } from "@/domain/models";
import { groupByDate, planDayTrips, planWeekends, type TrainsByDate } from "@/domain/roundtrip";
import { durationMinutes, formatDuration, hhmmToMinutes } from "@/domain/time";
import { DOWS, frDate, frDateLong, parseISO, today } from "@/lib/dates";
import { prettyStation } from "@/lib/text";
import { StationPicker } from "../components/StationPicker";
import { empty, errorState, loading } from "../components/states";
import { axisBadge, reserveButton } from "../components/trains";
import { button, clear, el, field, select } from "../dom";
import { createMap, destIcon, type MapHandle, originIcon } from "../map/MapKit";
import type { View } from "./View";

/** Same-day round trips and weekend getaways with MAX seats both ways. */
export class RoundtripView implements View {
  readonly id = "roundtrip";
  readonly label = "Aller-retour";
  readonly emoji = "🔁";
  readonly hint = "journée & week-end";
  readonly element: HTMLElement;

  private readonly fromPicker: StationPicker;
  private readonly toPicker: StationPicker;
  private readonly modeSelect: HTMLSelectElement;
  private readonly staySelect: HTMLSelectElement;
  private readonly earlySelect: HTMLSelectElement;
  private readonly lateSelect: HTMLSelectElement;
  private readonly summary = el("div", { class: "summary" });
  private readonly mapEl = el("div", { class: "map map-sm" });
  private readonly out = el("div", { class: "rt-list" });
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
    this.toPicker = new StationPicker(stations, {
      placeholder: "ex. Bordeaux",
      value: "BORDEAUX ST JEAN",
      onSelect: () => void this.run(),
    });
    const swap = button("⇄", "swap", () => this.swap());
    swap.title = "Inverser";

    this.modeSelect = select(
      [
        ["day", "Aller-retour dans la journée"],
        ["weekend", "Escapade de week-end"],
      ],
      () => {
        this.toggleStayField();
        void this.run();
      },
    );
    this.staySelect = select(
      [
        ["180", "≥ 3h sur place"],
        ["240", "≥ 4h sur place"],
        ["300", "≥ 5h sur place"],
        ["360", "≥ 6h sur place"],
        ["480", "≥ 8h sur place"],
      ],
      () => void this.run(),
    );
    this.staySelect.value = "240";
    this.earlySelect = select(
      [
        ["0", "Peu importe"],
        ["360", "dès 6h"],
        ["420", "dès 7h"],
        ["480", "dès 8h"],
        ["540", "dès 9h"],
        ["600", "dès 10h"],
      ],
      () => void this.run(),
    );
    this.lateSelect = select(
      [
        ["0", "Peu importe"],
        ["1080", "avant 18h"],
        ["1200", "avant 20h"],
        ["1260", "avant 21h"],
        ["1320", "avant 22h"],
      ],
      () => void this.run(),
    );

    const controls = el("div", { class: "controls" }, [
      field("Départ", this.fromPicker.element),
      swap,
      field("Arrivée", this.toPicker.element),
      field("Formule", this.modeSelect),
      field("Sur place", this.staySelect),
      field("Aller pas avant", this.earlySelect),
      field("Retour pas après", this.lateSelect),
      button("Planifier", "btn-primary", () => void this.run()),
    ]);
    this.element = el("section", { class: "panel" }, [
      controls,
      this.summary,
      el("div", { class: "map-wrap" }, [this.mapEl]),
      this.out,
    ]);
    this.handle = createMap(this.mapEl, { zoom: 6 });
  }

  activate(): void {
    if (!this.loaded) void this.run();
    setTimeout(() => this.handle.map.invalidateSize(), 60);
  }

  private toggleStayField(): void {
    const field_ = this.staySelect.parentElement;
    if (field_) field_.style.display = this.modeSelect.value === "day" ? "" : "none";
  }

  private swap(): void {
    const a = this.fromPicker.value;
    const b = this.toPicker.value;
    this.fromPicker.clear();
    this.toPicker.clear();
    if (b) this.fromPicker.set(b);
    if (a) this.toPicker.set(a);
    void this.run();
  }

  private async run(): Promise<void> {
    const from = this.fromPicker.value;
    const to = this.toPicker.value;
    if (!from || !to || from === to) {
      empty(this.summary, "Choisissez deux gares différentes.");
      clear(this.out);
      return;
    }
    this.drawMap(from, to);
    loading(this.out, "Recherche des allers-retours possibles…");
    clear(this.summary);
    try {
      const [outbound, inbound] = await Promise.all([
        this.repo.directTrains(from, to),
        this.repo.directTrains(to, from),
      ]);
      const early = Number(this.earlySelect.value);
      const late = Number(this.lateSelect.value);
      const outByDate = filterMap(
        groupByDate(outbound),
        (t) => hhmmToMinutes(t.departure) >= early,
      );
      const inByDate = filterMap(
        groupByDate(inbound),
        (t) => !late || hhmmToMinutes(t.departure) <= late,
      );
      this.loaded = true;
      if (this.modeSelect.value === "day") this.renderDay(from, to, outByDate, inByDate);
      else this.renderWeekend(from, to, outByDate, inByDate);
    } catch (e) {
      errorState(this.out, (e as Error).message);
    }
  }

  private renderDay(
    from: string,
    to: string,
    outByDate: TrainsByDate,
    inByDate: TrainsByDate,
  ): void {
    const trips = planDayTrips(outByDate, inByDate, Number(this.staySelect.value));
    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html:
          `Aller-retour <b>${prettyStation(from)}</b> ⇄ <b>${prettyStation(to)}</b> dans la journée · ` +
          (trips.length
            ? `<span class="ok">${trips.length} jour${trips.length > 1 ? "s" : ""}</span> possible${trips.length > 1 ? "s" : ""}`
            : `<span class="ko">aucune journée possible</span> avec ce temps sur place`),
      }),
    );
    clear(this.out);
    if (!trips.length) {
      empty(
        this.out,
        "Aucun aller-retour MAX dans la journée. Réduisez le temps sur place ou changez de destination.",
      );
      return;
    }
    for (const t of trips) {
      this.out.appendChild(
        el("div", { class: "rt-card" }, [
          el("div", { class: "rt-date" }, [
            el("b", { text: frDateLong(t.date) }),
            el("span", { class: "rt-stay", text: `${formatDuration(t.stayMinutes)} sur place` }),
          ]),
          el("div", { class: "rt-legs" }, [
            leg("Aller", from, to, t.outbound),
            leg("Retour", to, from, t.back),
          ]),
          reserveButton(),
        ]),
      );
    }
  }

  private renderWeekend(
    from: string,
    to: string,
    outByDate: TrainsByDate,
    inByDate: TrainsByDate,
  ): void {
    const combos = planWeekends(outByDate, inByDate, today());
    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html:
          `Escapades de week-end <b>${prettyStation(from)}</b> ⇄ <b>${prettyStation(to)}</b> · ` +
          (combos.length
            ? `<span class="ok">${combos.length} week-end${combos.length > 1 ? "s" : ""}</span> jouable${combos.length > 1 ? "s" : ""}`
            : `<span class="ko">aucun week-end</span> avec place MAX dans les deux sens`),
      }),
    );
    clear(this.out);
    if (!combos.length) {
      empty(
        this.out,
        "Aucun week-end MAX aller-retour sur la fenêtre. Essayez une autre destination.",
      );
      return;
    }
    for (const c of combos) {
      this.out.appendChild(
        el("div", { class: "rt-card" }, [
          el("div", { class: "rt-date" }, [el("b", { text: `Week-end du ${frDate(c.saturday)}` })]),
          weekendGroup("Aller", from, to, collect(c.departDates, outByDate)),
          weekendGroup("Retour", to, from, collect(c.returnDates, inByDate)),
          reserveButton(),
        ]),
      );
    }
  }

  private drawMap(from: string, to: string): void {
    const a = this.stations.get(from);
    const b = this.stations.get(to);
    this.handle.routes.clearLayers();
    this.handle.markers.clearLayers();
    if (!a || !b) return;
    const pa: L.LatLngTuple = [a.lat, a.lon];
    const pb: L.LatLngTuple = [b.lat, b.lon];
    L.marker(pa, { icon: originIcon() })
      .addTo(this.handle.markers)
      .bindTooltip(`${prettyStation(from)} · départ`, { direction: "top" });
    L.marker(pb, { icon: destIcon() })
      .addTo(this.handle.markers)
      .bindTooltip(`${prettyStation(to)} · arrivée`, { direction: "top" });
    this.handle.map.fitBounds([pa, pb], { padding: [50, 50], maxZoom: 9 });
    setTimeout(() => this.handle.map.invalidateSize(), 30);
  }
}

/** Keep only trains matching `pred` per date; drop emptied dates. */
function filterMap(map: TrainsByDate, pred: (t: Train) => boolean): TrainsByDate {
  const out: TrainsByDate = {};
  for (const [date, list] of Object.entries(map)) {
    const kept = list.filter(pred);
    if (kept.length) out[date] = kept;
  }
  return out;
}

/** Flatten several dates' trains into `[date, train]` pairs, sorted. */
function collect(dates: string[], byDate: TrainsByDate): [string, Train][] {
  const rows: [string, Train][] = [];
  for (const d of dates) for (const t of byDate[d] ?? []) rows.push([d, t]);
  return rows.sort(
    (a, b) => a[0].localeCompare(b[0]) || a[1].departure.localeCompare(b[1].departure),
  );
}

function leg(label: string, a: string, b: string, t: Train): HTMLElement {
  return el("div", { class: "rt-leg" }, [
    el("span", { class: `rt-tag${label === "Retour" ? " tag-ret" : ""}`, text: label }),
    el("span", { class: "rt-od", text: `${prettyStation(a)} → ${prettyStation(b)}` }),
    el("span", { class: "rt-time", html: `<b>${t.departure}</b> → <b>${t.arrival}</b>` }),
    el("span", { class: "t-dur", text: formatDuration(durationMinutes(t.departure, t.arrival)) }),
    axisBadge(t.axis),
    el("span", { class: "t-no", text: `n°${t.trainNo}` }),
  ]);
}

function weekendGroup(label: string, a: string, b: string, rows: [string, Train][]): HTMLElement {
  const group = el("div", { class: "wk-group" }, [
    el("div", { class: "wk-lab" }, [
      el("span", { class: `rt-tag${label === "Retour" ? " tag-ret" : ""}`, text: label }),
      el("span", { class: "rt-od", text: `${prettyStation(a)} → ${prettyStation(b)}` }),
    ]),
  ]);
  for (const [date, t] of rows) {
    const d = parseISO(date);
    group.appendChild(
      el("div", { class: "train" }, [
        el("span", { class: "wk-day", text: `${DOWS[d.getDay()]} ${d.getDate()}` }),
        el("span", {
          class: "t-time",
          html: `<b>${t.departure}</b><span class="arrow"> → </span><b>${t.arrival}</b>`,
        }),
        el("span", {
          class: "t-dur",
          text: formatDuration(durationMinutes(t.departure, t.arrival)),
        }),
        axisBadge(t.axis),
        el("span", { class: "t-no", text: `n°${t.trainNo}` }),
      ]),
    );
  }
  return group;
}
