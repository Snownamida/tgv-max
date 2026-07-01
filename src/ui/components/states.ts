import { clear, el } from "../dom";

/** Loading spinner + message. */
export function loading(node: HTMLElement, message = "Interrogation des données SNCF…"): void {
  clear(node).appendChild(
    el("div", { class: "state" }, [el("div", { class: "spinner" }), el("p", { text: message })]),
  );
}

/** Empty-result placeholder. */
export function empty(node: HTMLElement, message = "Aucune place MAX trouvée."): void {
  clear(node).appendChild(
    el("div", { class: "state state-empty" }, [
      el("div", { class: "state-emoji", text: "🚫" }),
      el("p", { text: message }),
    ]),
  );
}

/** Error placeholder. */
export function errorState(node: HTMLElement, message = "Erreur lors de la requête."): void {
  clear(node).appendChild(
    el("div", { class: "state state-err" }, [
      el("div", { class: "state-emoji", text: "⚠️" }),
      el("p", { text: message }),
    ]),
  );
}

/** Small muted hint line. */
export const hint = (text: string): HTMLElement => el("p", { class: "hint", text });
