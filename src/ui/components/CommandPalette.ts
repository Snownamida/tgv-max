import type { StationRepository } from "@/data/StationRepository";
import type { Station } from "@/domain/models";
import { prettyStation } from "@/lib/text";
import { clear, el } from "../dom";
import { flag } from "./flags";

export interface PaletteResult {
  origin: string;
  destination?: string;
}

/**
 * ⌘K / Ctrl+K quick search. Two steps: pick an origin, then optionally a
 * destination. Enter with an empty second step validates origin-only.
 * The caller decides what to do with the result (which view to open).
 */
export class CommandPalette {
  readonly element: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly crumb: HTMLElement;
  private results: Station[] = [];
  private active = 0;
  private origin: Station | null = null;

  constructor(
    private readonly stations: StationRepository,
    private readonly onPick: (r: PaletteResult) => void,
  ) {
    this.crumb = el("div", { class: "cp-crumb" });
    this.input = el("input", { class: "cp-input", type: "text", placeholder: "Gare de départ…", autocomplete: "off", spellcheck: "false" });
    this.list = el("div", { class: "cp-list" });
    const box = el("div", { class: "cp-box", role: "dialog", "aria-label": "Recherche rapide" }, [
      this.crumb,
      this.input,
      this.list,
      el("p", { class: "cp-help", html: "<b>↑↓</b> naviguer · <b>Entrée</b> choisir · <b>Échap</b> fermer — 2ᵉ étape : Entrée sans destination = « Où partir ? »" }),
    ]);
    this.element = el("div", { class: "cp-overlay hidden" }, [box]);
    this.element.addEventListener("click", (e) => {
      if (e.target === this.element) this.close();
    });
    this.wire();
  }

  open(): void {
    this.origin = null;
    this.input.value = "";
    this.input.placeholder = "Gare de départ…";
    clear(this.crumb);
    this.element.classList.remove("hidden");
    this.render(this.stations.search(""));
    this.input.focus();
  }

  close(): void {
    this.element.classList.add("hidden");
  }

  get isOpen(): boolean {
    return !this.element.classList.contains("hidden");
  }

  private wire(): void {
    this.input.addEventListener("input", () => this.render(this.stations.search(this.input.value)));
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.setActive(Math.min(this.active + 1, this.results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.setActive(Math.max(this.active - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const picked = this.results[this.active];
        if (!this.origin) {
          if (picked) this.toStepTwo(picked);
        } else if (picked && this.input.value.trim()) {
          this.finish(picked);
        } else {
          this.finish(null); // origine seule
        }
      } else if (e.key === "Escape") {
        this.close();
      } else if (e.key === "Backspace" && this.origin && !this.input.value) {
        // revenir à l'étape 1
        this.origin = null;
        clear(this.crumb);
        this.input.placeholder = "Gare de départ…";
        this.render(this.stations.search(""));
      }
    });
  }

  private toStepTwo(origin: Station): void {
    this.origin = origin;
    clear(this.crumb).appendChild(
      el("span", { class: "cp-tag", text: `Départ : ${prettyStation(origin.name)}` }),
    );
    this.input.value = "";
    this.input.placeholder = "Destination (optionnel — Entrée pour passer)…";
    this.render(this.stations.search(""));
  }

  private finish(destination: Station | null): void {
    if (!this.origin) return;
    const r: PaletteResult = { origin: this.origin.name };
    if (destination && destination.name !== this.origin.name) r.destination = destination.name;
    this.close();
    this.onPick(r);
  }

  private render(list: Station[]): void {
    this.results = list.slice(0, 12);
    this.active = 0;
    clear(this.list);
    this.results.forEach((s, i) => {
      const row = el("div", { class: "cp-opt" + (i === 0 ? " active" : "") }, [
        el("span", { text: prettyStation(s.name) }),
        el("span", { class: "po-flag", text: flag(s.country) }),
      ]);
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (!this.origin) this.toStepTwo(s);
        else this.finish(s);
      });
      row.addEventListener("mouseenter", () => this.setActive(i));
      this.list.appendChild(row);
    });
  }

  private setActive(i: number): void {
    this.active = i;
    [...this.list.children].forEach((c, j) => c.classList.toggle("active", j === i));
    this.list.children[i]?.scrollIntoView({ block: "nearest" });
  }
}
