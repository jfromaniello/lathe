export type MaterialKind = "matte" | "wood" | "glass";

export interface ViewSettings {
  material: MaterialKind;
  color: string; // hex
  showMug: boolean;
  showHandles: boolean;
}

export const MATERIALS: MaterialKind[] = ["matte", "wood", "glass"];

export const COLORS: { name: string; hex: string }[] = [
  { name: "Blanco", hex: "#f1ece3" },
  { name: "Beige", hex: "#d8c7a6" },
  { name: "Terracota", hex: "#c47a5e" },
  { name: "Salvia", hex: "#9aa88a" },
  { name: "Azul", hex: "#5b7ba5" },
  { name: "Negro", hex: "#2a2a2a" },
];

export const WOOD_COLOR = "#b58a5c";

export const DEFAULT_VIEW: ViewSettings = { material: "matte", color: COLORS[0].hex, showMug: false, showHandles: true };

/** Color the model is actually rendered with (wood ignores the palette). */
export function renderColor(v: Pick<ViewSettings, "material" | "color">): string {
  return v.material === "wood" ? WOOD_COLOR : v.color;
}
