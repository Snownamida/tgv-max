import type { StationRepository } from "@/data/StationRepository";
import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import type { DestinationAvailability } from "@/domain/models";
import { formatDuration } from "@/domain/time";
import { addDays, frDateLong, iso, nextSaturday, today } from "@/lib/dates";
import { formatRidership } from "@/lib/format";
import { prettyStation } from "@/lib/text";
import { flag } from "../components/flags";
import { StationPicker } from "../components/StationPicker";
import { empty, errorState, loading } from "../components/states";
import { reserveButton, trainRow } from "../components/trains";
import { button, clear, el, field, select } from "../dom";
import type { View } from "./View";

type SortKey = "trains" | "dur" | "pop" | "confid" | "abc";

/** Every destination with a MAX seat from one station on a chosen date. */
export class DestinationsView implements View {
  readonly id = "destinations";
  readonly label = "Où partir ?";
  readonly emoji = "🧭";
  readonly hint = "toutes les destinations d'un jour";
  readonly element: HTMLElement;

  private readonly fromPicker: StationPicker;
  private readonly dateInput: HTMLInputElement;
  private readonly sortSelect: HTMLSelectElement;
  private readonly durSelect: HTMLSelectElement;
  private readonly summary = el("div", { class: "summary" });
  private readonly out = el("div", { class: "dest-grid" });
  private results: DestinationAvailability[] = [];
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
      value: iso(nextSaturday()),
    });
    this.dateInput.addEventListener("change", () => void this.run());
    this.durSelect = select(
      [
        ["0", "Toute durée"],
        ["120", "≤ 2h"],
        ["180", "≤ 3h"],
        ["240", "≤ 4h"],
        ["360", "≤ 6h"],
      ],
      () => this.render(),
    );
    this.sortSelect = select(
      [
        ["trains", "Plus de trains"],
        ["dur", "Trajet le plus court"],
        ["pop", "Les plus fréquentées"],
        ["confid", "Les plus confidentielles"],
        ["abc", "A → Z"],
      ],
      () => this.render(),
    );

    const controls = el("div", { class: "controls" }, [
      field("Départ", this.fromPicker.element),
      field("Date", this.dateInput),
      field("Trajet max", this.durSelect),
      field("Trier par", this.sortSelect),
      button("Chercher", "btn-primary", () => void this.run()),
    ]);
    const chips = el("div", { class: "chips" }, [
      button("Aujourd'hui", "chip", () => this.setDate(today())),
      button("Demain", "chip", () => this.setDate(addDays(today(), 1))),
      button("Ce week-end", "chip", () => this.setDate(nextSaturday())),
      button("🎲 Surprends-moi", "chip chip-accent", () => this.surprise()),
    ]);
    this.element = el("section", { class: "panel" }, [controls, chips, this.summary, this.out]);
  }

  activate(): void {
    if (!this.loaded) void this.run();
  }

  /** Pre-fill from the command palette. */
  preset(origin: string): void {
    this.fromPicker.set(origin);
    void this.run();
  }

  private setDate(d: Date): void {
    this.dateInput.value = iso(d);
    void this.run();
  }

  private async run(): Promise<void> {
    const from = this.fromPicker.value;
    const date = this.dateInput.value;
    if (!from || !date) {
      empty(this.summary, "Choisissez une gare de départ et une date.");
      clear(this.out);
      return;
    }
    loading(this.out, "Recherche des destinations…");
    clear(this.summary);
    try {
      this.results = await this.repo.destinationsOn(from, date);
      this.loaded = true;
      this.render();
    } catch (e) {
      errorState(this.out, (e as Error).message);
    }
  }

  private filtered(): DestinationAvailability[] {
    const maxDur = Number(this.durSelect.value);
    const list = this.results.filter((r) => !maxDur || r.fastestMinutes <= maxDur);
    const key = this.sortSelect.value as SortKey;
    const freq = (name: string): number => this.stations.get(name)?.ridership ?? 0;
    const comparators: Record<
      SortKey,
      (a: DestinationAvailability, b: DestinationAvailability) => number
    > = {
      abc: (a, b) => prettyStation(a.destination).localeCompare(prettyStation(b.destination)),
      dur: (a, b) => a.fastestMinutes - b.fastestMinutes,
      pop: (a, b) => freq(b.destination) - freq(a.destination),
      confid: (a, b) => (freq(a.destination) || Infinity) - (freq(b.destination) || Infinity),
      trains: (a, b) => b.trains - a.trains,
    };
    return [...list].sort(comparators[key]);
  }

  private render(): void {
    const from = this.fromPicker.value;
    const date = this.dateInput.value;
    if (!from) return;
    const res = this.filtered();

    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html: `<b>${res.length}</b> destination${res.length > 1 ? "s" : ""} accessible${res.length > 1 ? "s" : ""} avec une place MAX depuis <b>${prettyStation(from)}</b> · ${frDateLong(date)}`,
      }),
    );

    clear(this.out);
    if (!res.length) {
      empty(this.out, "Aucune destination MAX ce jour-là. Essayez une autre date.");
      return;
    }
    for (const r of res) this.out.appendChild(this.card(r));
  }

  private card(r: DestinationAvailability): HTMLElement {
    const station = this.stations.get(r.destination);
    const ridership = station?.ridership ?? 0;
    const body = el("div", { class: "dc-body hidden" });
    let filled = false;
    const card = el("div", { class: "dest-card", "data-dest": r.destination }, [
      el("div", { class: "dc-head" }, [
        el("div", { class: "dc-title" }, [
          el("span", { class: "dc-flag", text: flag(station?.country ?? "FR") }),
          el("span", { class: "dc-name", text: prettyStation(r.destination) }),
        ]),
        el("div", { class: "dc-meta" }, [
          el("span", { class: "dc-badge", text: `${r.trains} trajet${r.trains > 1 ? "s" : ""}` }),
          el("span", {
            class: "dc-dur",
            text: `dès ${r.firstDeparture} · ${formatDuration(r.fastestMinutes)}`,
          }),
          ridership
            ? el("span", { class: "dc-freq", text: `👥 ${formatRidership(ridership)} voy./an` })
            : null,
        ]),
      ]),
      body,
    ]);
    card.querySelector(".dc-head")?.addEventListener("click", () => {
      card.classList.toggle("open");
      if (body.classList.contains("hidden")) {
        body.classList.remove("hidden");
        if (!filled) {
          filled = true;
          [...r.list]
            .sort((a, b) => a.departure.localeCompare(b.departure))
            .forEach((t) => body.appendChild(trainRow(t)));
          body.appendChild(reserveButton("Réserver ce trajet ↗"));
        }
      } else {
        body.classList.add("hidden");
      }
    });
    return card;
  }

  private surprise(): void {
    const pool = this.filtered();
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const selector = `[data-dest="${window.CSS && CSS.escape ? CSS.escape(pick.destination) : pick.destination}"]`;
    const node = this.out.querySelector(selector);
    if (node) {
      this.out.querySelectorAll(".flash").forEach((n) => n.classList.remove("flash"));
      node.classList.add("flash");
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}
