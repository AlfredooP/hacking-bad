/** Categorías administrativas de residuo */
export const WASTE_CATEGORIES = [
  "Orgánicos",
  "Inorgánicos",
  "Reciclables",
  "Plástico",
  "Papel/Cartón",
  "Vidrio/Metal",
  "Químicos",
  "Metales pesados",
  "Residuos especiales",
] as const;

export type WasteCategory = (typeof WASTE_CATEGORIES)[number];

/** Subtipos inferidos por sensor → categoría administrativa compatible */
export const INFERRED_TO_ADMIN: Record<string, string[]> = {
  Orgánicos: ["Orgánicos", "Orgánico"],
  Inorgánicos: ["Inorgánicos", "Vidrio/Metal"],
  Reciclables: ["Reciclables", "Plástico", "Papel/Cartón"],
  Plástico: ["Reciclables", "Plástico"],
  "Papel/Cartón": ["Reciclables", "Papel/Cartón"],
  "Vidrio/Metal": ["Inorgánicos", "Vidrio/Metal", "Metales pesados"],
  Químicos: ["Químicos", "Residuos especiales"],
  "Metales pesados": ["Metales pesados", "Vidrio/Metal", "Inorgánicos"],
  "Residuos especiales": ["Residuos especiales", "Químicos"],
};

export function parseAllowedTypes(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return csv.split(",").map((t) => t.trim()).filter(Boolean);
}

export function isWasteCompatible(inferred: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const normalizedAllowed = allowed.flatMap(
    (a) => INFERRED_TO_ADMIN[a] ?? [a]
  );
  const normalizedInferred = INFERRED_TO_ADMIN[inferred] ?? [inferred];
  return normalizedInferred.some((i) =>
    normalizedAllowed.some((a) => a.toLowerCase() === i.toLowerCase())
  );
}

const PRIORITY_RANK: Record<string, number> = { baja: 0, media: 1, alta: 2 };

export function maxPriority(
  a: "alta" | "media" | "baja" | null | undefined,
  b: "alta" | "media" | "baja" | null | undefined
): "alta" | "media" | "baja" {
  const ra = PRIORITY_RANK[a ?? "baja"] ?? 0;
  const rb = PRIORITY_RANK[b ?? "baja"] ?? 0;
  if (ra >= rb) return a ?? "baja";
  return b ?? "baja";
}
