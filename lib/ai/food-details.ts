export type FoodDetails = {
  kind: "ingredient" | "meal"
  protein: "none" | "chicken" | "meat" | "fish" | "egg" | "vegetarian"
  pack_quantity?: number
  pack_unit?: "g" | "ml" | "piece"
  servings?: number
}

/** Merchant metadata, deliberately allowlisted. No inferred serving count from an LLM. */
export function parseFoodDetails(raw: unknown): FoodDetails | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const d = raw as Record<string, unknown>
  if (d.kind !== "ingredient" && d.kind !== "meal") return null
  if (!["none", "chicken", "meat", "fish", "egg", "vegetarian"].includes(String(d.protein))) return null
  const protein = d.protein as FoodDetails["protein"]
  if (d.kind === "meal") {
    if (typeof d.servings !== "number" || !Number.isInteger(d.servings) || d.servings < 1 || d.servings > 50 || protein === "none") return null
    return { kind: "meal", protein, servings: d.servings }
  }
  if (typeof d.pack_quantity !== "number" || !Number.isFinite(d.pack_quantity) || d.pack_quantity <= 0 || d.pack_quantity > 100000) return null
  if (d.pack_unit !== "g" && d.pack_unit !== "ml" && d.pack_unit !== "piece") return null
  return { kind: "ingredient", protein, pack_quantity: d.pack_quantity, pack_unit: d.pack_unit }
}
