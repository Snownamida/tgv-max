/** Tiny typed DOM helpers — a pragmatic alternative to a UI framework. */

export type Child = Node | string | null | undefined;

export interface ElAttrs {
  class?: string;
  /** Sets `textContent`. */
  text?: string | number;
  /** Sets `innerHTML` (use only with trusted content). */
  html?: string;
  [key: string]: unknown;
}

/** Create an element with attributes/handlers and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElAttrs = {},
  children: Child | Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key === "html") node.innerHTML = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2), value as EventListener);
    } else node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** Remove all children of a node and return it. */
export function clear<T extends Element>(node: T): T {
  node.replaceChildren();
  return node;
}

/** A labelled form field: `<label class="f"><span class="f-lab">…</span>control</label>`. */
export function field(label: string, control: Node): HTMLLabelElement {
  return el("label", { class: "f" }, [el("span", { class: "f-lab", text: label }), control]);
}

/** A `<select>` bound to a change handler. */
export function select(
  options: [value: string, label: string][],
  onChange: () => void,
): HTMLSelectElement {
  const sel = el(
    "select",
    { class: "sel" },
    options.map(([value, label]) => el("option", { value, text: label })),
  );
  sel.addEventListener("change", onChange);
  return sel;
}

/** A `<button>` with the given class + click handler. */
export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  return el("button", { class: className, text: label, onclick: onClick });
}
