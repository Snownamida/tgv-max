import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import type { StationRepository } from "@/data/StationRepository";
import { heatLevel } from "@/domain/availability";
import type { DailyCounts } from "@/domain/models";
import { addDays, frDate, frDateLong, iso, MONTHS, parseISO, today } from "@/lib/dates";
import { prettyStation } from "@/lib/text";
import { StationPicker } from "../components/StationPicker";
import { empty, errorState, loading } from "../components/states";
import { reserveButton, trainRow } from "../components/trains";
import { button, clear, el, field } from "../dom";
import type { View } from "./View";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const LEGEND: [string, string][] = [
  ["0", "lvl0"],
  ["1–2", "lvl1"],
  ["3–5", "lvl2"],
  ["6–9", "lvl3"],
  ["10+", "lvl4"],
];

/** 30-day availability heatmap for one origin/destination. */
export class CalendarView implements View {
  readonly id = "calendar";
  readonly label = "Calendrier";
  readonly emoji = "📅";
  readonly hint = "30 jours pour un trajet";
  readonly element: HTMLElement;

  private readonly fromPicker: StationPicker;
  private readonly toPicker: StationPicker;
  private readonly summary = el("div", { class: "summary" });
  private readonly grid = el("div", { class: "cal" });
  private readonly detail = el("div", { class: "detail" });

  constructor(
    private readonly repo: TgvmaxRepository,
    stations: StationRepository,
  ) {
    this.fromPicker = new StationPicker(stations, {
      placeholder: "ex. Paris",
      value: "PARIS (intramuros)",
      onSelect: () => void this.run(),
    });
    this.toPicker = new StationPicker(stations, {
      placeholder: "ex. Lyon",
      value: "LYON (intramuros)",
      onSelect: () => void this.run(),
    });
    const swap = button("⇄", "swap", () => this.swap());
    swap.title = "Inverser";

    const controls = el("div", { class: "controls" }, [
      field("Départ", this.fromPicker.element),
      swap,
      field("Arrivée", this.toPicker.element),
      button("Voir le calendrier", "btn-primary", () => void this.run()),
    ]);
    this.element = el("section", { class: "panel" }, [
      controls,
      this.summary,
      this.legend(),
      this.grid,
      this.detail,
    ]);
  }

  activate(): void {
    if (!this.grid.hasChildNodes()) void this.run();
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
    clear(this.detail);
    if (!from || !to) {
      empty(this.summary, "Choisissez une gare de départ et d'arrivée.");
      clear(this.grid);
      return;
    }
    if (from === to) {
      empty(this.summary, "Départ et arrivée identiques.");
      clear(this.grid);
      return;
    }
    loading(this.grid, "Calcul des disponibilités…");
    clear(this.summary);
    try {
      const counts = await this.repo.dailyCounts(from, to);
      this.renderCalendar(from, to, counts);
    } catch (e) {
      errorState(this.grid, `Impossible de récupérer les données (${(e as Error).message}).`);
    }
  }

  private renderCalendar(from: string, to: string, counts: DailyCounts): void {
    const start = today();
    const keys = Object.keys(counts);
    let end = addDays(start, 30);
    for (const k of keys) {
      const d = parseISO(k);
      if (d > end) end = d;
    }
    const days = keys.length;
    const trains = keys.reduce((sum, k) => sum + counts[k], 0);

    clear(this.summary).appendChild(
      el("div", {
        class: "sum-line",
        html:
          `<b>${prettyStation(from)}</b> → <b>${prettyStation(to)}</b> · ` +
          (days
            ? `<span class="ok">${days} jour${days > 1 ? "s" : ""}</span> avec place MAX · ${trains} trajet${trains > 1 ? "s" : ""} au total`
            : `<span class="ko">aucune place MAX</span> sur la fenêtre disponible`),
      }),
    );

    clear(this.grid);
    const head = el(
      "div",
      { class: "cal-head" },
      WEEKDAYS.map((d) => el("span", { text: d })),
    );
    this.grid.appendChild(head);

    const body = el("div", { class: "cal-grid" });
    let d = addDays(start, -((start.getDay() + 6) % 7)); // Monday of the current week
    for (let i = 0; i < 42; i += 1) {
      const ds = iso(d);
      const inWindow = d >= start && d <= end;
      const n = counts[ds] ?? 0;
      const level = inWindow ? heatLevel(n) : "x";
      const cell = el(
        "div",
        {
          class: `cell lvl${level}${inWindow ? "" : " out"}${n ? " has" : ""}`,
          title: inWindow ? frDateLong(ds) + (n ? ` · ${n} trajet(s) MAX` : " · aucune place") : "",
        },
        [
          d.getDate() === 1 ? el("span", { class: "cell-mon", text: MONTHS[d.getMonth()] }) : null,
          el("span", { class: "cell-num", text: String(d.getDate()) }),
          n ? el("span", { class: "cell-n", text: String(n) }) : null,
        ],
      );
      if (inWindow && n)
        cell.addEventListener("click", () => void this.showDay(from, to, ds, cell));
      body.appendChild(cell);
      d = addDays(d, 1);
    }
    this.grid.appendChild(body);
  }

  private async showDay(from: string, to: string, date: string, cell: HTMLElement): Promise<void> {
    // NB : ne pas réutiliser la classe "sel" (déjà prise par les <select> du thème).
    this.grid.querySelectorAll(".cell.selected").forEach((c) => c.classList.remove("selected"));
    cell.classList.add("selected");
    loading(this.detail, `Trajets du ${frDate(date)}…`);
    try {
      const list = await this.repo.trains(from, to, date);
      clear(this.detail);
      this.detail.appendChild(
        el("div", { class: "detail-head" }, [
          el("h3", { text: frDateLong(date) }),
          el("span", { class: "detail-sub", text: `${list.length} trajet(s) avec place MAX` }),
          reserveButton("Réserver sur SNCF Connect ↗"),
        ]),
      );
      const box = el(
        "div",
        { class: "train-list" },
        list.map((t) => trainRow(t)),
      );
      this.detail.appendChild(box);
      this.detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
      errorState(this.detail, (e as Error).message);
    }
  }

  private legend(): HTMLElement {
    const lg = el("div", { class: "legend" }, [
      el("span", { class: "lg-lab", text: "Places MAX :" }),
    ]);
    for (const [text, cls] of LEGEND) {
      lg.appendChild(
        el("span", { class: "lg-item" }, [
          el("span", { class: `lg-sw ${cls}` }),
          el("span", { text }),
        ]),
      );
    }
    return lg;
  }
}
