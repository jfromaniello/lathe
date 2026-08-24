export type MaterialKind = "matte" | "wood" | "glass";

export interface ViewSettings {
  material: MaterialKind;
  color: string; // hex
  showMug: boolean;
  showHandles: boolean;
}

export const MATERIALS: MaterialKind[] = ["matte", "wood", "glass"];

export type ColorId = "white" | "beige" | "terracotta" | "sage" | "blue" | "black";

export const COLORS: { id: ColorId; name: string; hex: string }[] = [
  { id: "white", name: "White", hex: "#f1ece3" },
  { id: "beige", name: "Beige", hex: "#d8c7a6" },
  { id: "terracotta", name: "Terracotta", hex: "#c47a5e" },
  { id: "sage", name: "Sage", hex: "#9aa88a" },
  { id: "blue", name: "Blue", hex: "#5b7ba5" },
  { id: "black", name: "Black", hex: "#2a2a2a" },
];

export const WOOD_COLOR = "#b58a5c";

export const DEFAULT_VIEW: ViewSettings = { material: "matte", color: COLORS[0].hex, showMug: false, showHandles: true };

/** Color the model is actually rendered with (wood ignores the palette). */
export function renderColor(v: Pick<ViewSettings, "material" | "color">): string {
  return v.material === "wood" ? WOOD_COLOR : v.color;
}
