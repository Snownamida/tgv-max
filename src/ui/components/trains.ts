import { SNCF_CONNECT_SEARCH } from "@/config";
import type { Train } from "@/domain/models";
import { durationMinutes, formatDuration } from "@/domain/time";
import { prettyStation } from "@/lib/text";
import { el } from "../dom";

/** Coloured badge for a network axis (SUD EST, ATLANTIQUE…). */
export function axisBadge(axis: string): HTMLElement {
  const a = (axis || "").toUpperCase();
  let cls = "axe";
  if (a.includes("OUIGO")) cls += " axe-ouigo";
  else if (a.includes("ATLANT")) cls += " axe-atl";
  else if (a.includes("SUD")) cls += " axe-se";
  else if (a.includes("NORD")) cls += " axe-nord";
  else if (a.includes("EST")) cls += " axe-est";
  return el("span", { class: cls, text: axis || "—" });
}

/** One train row: `08:12 → 11:47 · 3h35 · SUD EST · n°6111`. */
export function trainRow(t: Train, showOD = false): HTMLElement {
  const duration = formatDuration(durationMinutes(t.departure, t.arrival));
  const children: (Node | null)[] = [
    el("span", { class: "t-time" }, [
      el("b", { text: t.departure }),
      el("span", { class: "arrow", text: " → " }),
      el("b", { text: t.arrival }),
    ]),
    el("span", { class: "t-dur", text: duration }),
    axisBadge(t.axis),
    el("span", { class: "t-no", text: `n°${t.trainNo}` }),
  ];
  if (showOD) {
    children.unshift(
      el("span", {
        class: "t-od",
        text: `${prettyStation(t.origin)} → ${prettyStation(t.destination)}`,
      }),
    );
  }
  if (!t.hasMaxSeat) children.push(el("span", { class: "t-full", text: "complet MAX" }));
  return el("div", { class: `train${t.hasMaxSeat ? "" : " train-full"}` }, children);
}

/** Booking link to SNCF Connect. */
export const reserveButton = (label = "Réserver ↗"): HTMLElement =>
  el("a", {
    class: "btn-reserve",
    href: SNCF_CONNECT_SEARCH,
    target: "_blank",
    rel: "noopener",
    text: label,
  });
