import { KOFI_URL } from "@/config";
import type { StationRepository } from "@/data/StationRepository";
import type { TgvmaxRepository } from "@/data/TgvmaxRepository";
import { frDateTime } from "@/lib/dates";
import { CommandPalette } from "@/ui/components/CommandPalette";
import { KofiPanel } from "@/ui/components/KofiPanel";
import { clear, el } from "@/ui/dom";
import type { View } from "@/ui/views/View";

/**
 * Application shell: builds the layout, wires hash-based tab routing, and shows
 * the data-freshness banner. Views are injected — App knows nothing about them
 * beyond the {@link View} contract. The footer and the SEO/FAQ section live as
 * static HTML in `index.html` so search engines index them without JS.
 */
export class App {
  private readonly tabs = new Map<string, HTMLElement>();
  private readonly kofi = new KofiPanel();
  private readonly palette: CommandPalette;

  constructor(
    private readonly root: HTMLElement,
    private readonly views: View[],
    private readonly repo: TgvmaxRepository,
    stations: StationRepository,
  ) {
    this.palette = new CommandPalette(stations, (r) => {
      // Origine + destination → Calendrier ; origine seule → Où partir ?
      const target = r.destination ? "calendar" : "destinations";
      const view = this.views.find((v) => v.id === target);
      view?.preset?.(r.origin, r.destination);
      this.navigate(target);
    });
  }

  mount(): void {
    const nav = el("nav", { class: "tabs" });
    const panelsHost = el("main", { class: "wrap" });
    for (const view of this.views) {
      const tab = el("button", { class: "tab", onclick: () => this.navigate(view.id) }, [
        el("span", { class: "tab-emoji", text: view.emoji }),
        el("span", { class: "tab-txt" }, [
          el("b", { text: view.label }),
          el("small", { text: view.hint }),
        ]),
      ]);
      this.tabs.set(view.id, tab);
      nav.appendChild(tab);
      view.element.classList.add("panel");
      panelsHost.appendChild(view.element);
    }

    const freshness = el("div", { class: "freshness" });
    clear(this.root).append(this.header(nav), freshness, panelsHost, this.kofi.element, this.palette.element);

    window.addEventListener("hashchange", () => this.activate(this.currentId()));
    window.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (this.palette.isOpen) this.palette.close();
        else this.palette.open();
      }
    });
    this.activate(this.currentId());
    void this.showFreshness(freshness);
  }

  private currentId(): string {
    const id = location.hash.slice(1);
    return this.views.some((v) => v.id === id) ? id : (this.views[0]?.id ?? "");
  }

  private navigate(id: string): void {
    if (location.hash.slice(1) === id) this.activate(id);
    else location.hash = id; // triggers hashchange → activate
  }

  private activate(id: string): void {
    for (const view of this.views) {
      const isActive = view.id === id;
      this.tabs.get(view.id)?.classList.toggle("active", isActive);
      view.element.classList.toggle("active", isActive);
      if (isActive) view.activate();
    }
  }

  private header(nav: HTMLElement): HTMLElement {
    return el("header", { class: "topbar" }, [
      el("div", { class: "brand" }, [
        el("span", { class: "logo", text: "🚄" }),
        el("div", {}, [
          el("h1", { html: 'TGV <span class="max">MAX</span> Planner' }),
          el("p", {
            class: "tagline",
            text: "Vos places MAX, enfin lisibles — sur 30 jours, par destination, sur une carte.",
          }),
        ]),
        el("button", {
          class: "btn-search",
          title: "Recherche rapide (⌘K / Ctrl+K)",
          html: '🔍 <kbd>⌘K</kbd>',
          onclick: () => this.palette.open(),
        }),
        el("a", {
          class: "btn-kofi",
          href: KOFI_URL, // fallback : clic molette / sans JS → page Ko-fi
          target: "_blank",
          rel: "noopener",
          title: "Soutenir ce projet",
          text: "☕ Soutenir",
          onclick: (e: Event) => {
            e.preventDefault(); // clic normal : panneau intégré, on reste sur le site
            this.kofi.open();
          },
        }),
      ]),
      nav,
    ]);
  }

  private async showFreshness(box: HTMLElement): Promise<void> {
    const ts = await this.repo.lastUpdate();
    const when = ts
      ? `Données SNCF du <b>${frDateTime(ts)}</b>`
      : "Données mises à jour une fois par jour";
    box.innerHTML = `<span class="fr-ico">⏱️</span><span>${when} · les places MAX partent vite : une dispo « OUI » peut déjà être réservée. À confirmer sur SNCF Connect.</span>`;
  }
}
