import { KOFI_EMBED_URL, KOFI_URL } from "@/config";
import { el } from "../dom";

/**
 * Donation modal embedding the official Ko-fi panel in an iframe, so the
 * visitor can tip without leaving the site. The iframe is lazy-loaded on
 * first open (no Ko-fi assets for visitors who never click).
 */
export class KofiPanel {
  readonly element: HTMLElement;
  private readonly frameHost: HTMLElement;
  private loaded = false;

  constructor() {
    this.frameHost = el("div", { class: "kofi-frame-host" });
    const modal = el("div", { class: "kofi-modal", role: "dialog", "aria-label": "Soutenir ce projet" }, [
      el("button", { class: "kofi-close", "aria-label": "Fermer", text: "✕", onclick: () => this.close() }),
      this.frameHost,
      el("p", { class: "kofi-fallback" }, [
        "Le panneau ne charge pas ? ",
        el("a", { href: KOFI_URL, target: "_blank", rel: "noopener", text: "Ouvrir Ko-fi dans un nouvel onglet ↗" }),
      ]),
    ]);
    this.element = el("div", { class: "kofi-overlay hidden" }, [modal]);
    // Clic sur le fond (hors modale) : fermer.
    this.element.addEventListener("click", (e) => {
      if (e.target === this.element) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.element.classList.contains("hidden")) this.close();
    });
  }

  open(): void {
    if (!this.loaded) {
      this.loaded = true;
      this.frameHost.appendChild(
        el("iframe", { src: KOFI_EMBED_URL, title: "Soutenir sur Ko-fi", loading: "lazy" }),
      );
    }
    this.element.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  close(): void {
    this.element.classList.add("hidden");
    document.body.style.overflow = "";
  }
}
