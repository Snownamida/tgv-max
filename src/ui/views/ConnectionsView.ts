import type { StationRepository } from "@/data/StationRepository";
import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import { planJourneys, transferWaits, type Journey } from "@/domain/connections";
import { durationMinutes, formatDuration } from "@/domain/time";
import { frDateLong, iso, today } from "@/lib/dates";
import { prettyStation } from "@/lib/text";
import { StationPicker } from "../components/StationPicker";
import { empty, errorState, hint, loading } from "../components/states";
import { axisBadge, nextDayChip, reserveButton } from "../components/trains";
import { button, clear, el, field, select } from "../dom";
import type { View } from "./View";

/**
 * « Correspondances » : journeys with connections when the direct trains are
 * full — the whole day of MAX trains is fetched once, then searched locally
 * (see {@link planJourneys}).
 */
export class ConnectionsView implements View {
  readonly id = "connections";
  readonly label = "Correspondances";
  readonly emoji = "🔀";
  readonly hint = "quand le direct est complet";
  readonly element: HTMLElement;

  private readonly fromPicker: StationPicker;
  private readonly toPicker: StationPicker;
  private readonly dateInput: HTMLInputElement;
  private readonly transferSelect: HTMLSelectElement;
  private readonly legsSelect: HTMLSelectElement;
  private readonly summary = el("div", { class: "summary" });
  private readonly out = el("div", { class: "rt-list" });
  private loaded = false;

  constructor(
    private readonly repo: TgvmaxRepository,
    stations: StationRepository,
  ) {
    this.fromPicker = new StationPicker(stations, { placeholder: "ex. Paris", value: "PARIS (intramuros)", onSelect: () => void this.run() });
    this.toPicker = new StationPicker(stations, { placeholder: "ex. Marseille", value: "MARSEILLE ST CHARLES", onSelect: () => void this.run() });
    const swap = button("⇄", "swap", () => this.swap());
    swap.title = "Inverser";
    this.dateInput = el("input", { class: "date-input", type: "date", min: iso(today()), value: iso(today()) });
    this.dateInput.addEventListener("change", () => void this.run());
    this.transferSelect = select(
      [["15", "corresp. ≥ 15 min"], ["20", "corresp. ≥ 20 min"], ["30", "corresp. ≥ 30 min"], ["45", "corresp. ≥ 45 min"]],
      () => void this.run(),
    );
    this.transferSelect.value = "20";
    this.legsSelect = select(
      [["2", "1 correspondance"], ["3", "2 correspondances"], ["4", "3 correspondances"]],
      () => void this.run(),
    );
    this.legsSelect.value = "3";

    const controls = el("div", { class: "controls" }, [
      field("Départ", this.fromPicker.element),
      swap,
      field("Arrivée", this.toPicker.element),
      field("Date", this.dateInput),
      field("Correspondance", this.transferSelect),
      field("Jusqu'à", this.legsSelect),
      button("Chercher", "btn-primary", () => void this.run()),
    ]);
    this.element = el("section", { class: "panel" }, [
      controls,
      hint("Astuce : quand un trajet direct n'a plus de place MAX, il en reste souvent en coupant en deux (souvent via Paris ou Lyon)."),
      this.summary,
      this.out,
    ]);
  }

  activate(): void {
    if (!this.loaded) void this.run();
  }

  /** Pre-fill from the command palette. */
  preset(origin: string, destination?: string): void {
    this.fromPicker.set(origin);
    if (destination) this.toPicker.set(destination);
    void this.run();
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
    const date = this.dateInput.value;
    if (!from || !to || from === to || !date) {
      empty(this.summary, "Choisissez deux gares différentes et une date.");
      clear(this.out);
      return;
    }
    loading(this.out, "Chargement des trains du jour puis recherche d'itinéraires…");
    clear(this.summary);
    try {
      const trains = await this.repo.allTrainsOn(date);
      const journeys = planJourneys(trains, from, to, {
        maxLegs: Number(this.legsSelect.value),
        minTransferMinutes: Number(this.transferSelect.value),
      });
      this.loaded = true;
      this.render(from, to, date, journeys);
    } catch (e) {
      errorState(this.out, (e as Error).message);
    }
  }

  private render(from: string, to: string, date: string, journeys: Journey[]): void {
    const directs = journeys.filter((j) => j.transfers === 0).length;
    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html:
          `<b>${prettyStation(from)}</b> → <b>${prettyStation(to)}</b> · ${frDateLong(date)} · ` +
          (journeys.length
            ? `<span class="ok">${journeys.length} itinéraire${journeys.length > 1 ? "s" : ""}</span>` +
              (directs ? ` dont ${directs} direct${directs > 1 ? "s" : ""}` : " (aucun direct avec place MAX)")
            : `<span class="ko">aucun itinéraire</span> avec place MAX, même avec correspondances`),
      }),
    );
    clear(this.out);
    if (!journeys.length) {
      empty(this.out, "Rien ce jour-là. Essayez une autre date, ou augmentez le nombre de correspondances.");
      return;
    }
    for (const j of journeys) this.out.appendChild(this.card(j));
  }

  private card(j: Journey): HTMLElement {
    const header = el("div", { class: "rt-date" }, [
      el("b", { html: `${j.departure} <span class="arrow">→</span> ${j.arrival}${j.arrivesNextDay ? ' <span class="t-j1">J+1</span>' : ""}` }),
      el("span", { class: "jy-total", text: formatDuration(j.totalMinutes) }),
      el("span", {
        class: "jy-transfers" + (j.transfers ? "" : " jy-direct"),
        text: j.transfers ? `${j.transfers} corresp.` : "direct",
      }),
    ]);
    const legsBox = el("div", { class: "rt-legs" });
    const waits = transferWaits(j);
    j.legs.forEach((t, i) => {
      if (i > 0) {
        legsBox.appendChild(
          el("div", { class: "jy-wait", text: `⏱ ${formatDuration(waits[i - 1])} de correspondance à ${prettyStation(t.origin)}` }),
        );
      }
      legsBox.appendChild(
        el("div", { class: "rt-leg" }, [
          el("span", { class: "rt-od", text: `${prettyStation(t.origin)} → ${prettyStation(t.destination)}` }),
          el("span", { class: "rt-time", html: `<b>${t.departure}</b> → <b>${t.arrival}</b>` }),
          el("span", { class: "t-dur", text: formatDuration(durationMinutes(t.departure, t.arrival)) }),
          axisBadge(t.axis),
          nextDayChip(t),
          el("span", { class: "t-no", text: `n°${t.trainNo}` }),
        ]),
      );
    });
    return el("div", { class: "rt-card" }, [header, legsBox, reserveButton()]);
  }
}
