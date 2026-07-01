/** A top-level tab view. Its `element` is created once; `activate()` runs on show. */
export interface View {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly hint: string;
  readonly element: HTMLElement;
  /** Called every time the view becomes visible (lazy first load, map resize…). */
  activate(): void;
}
