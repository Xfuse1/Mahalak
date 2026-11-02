import { normalizeArabic } from "../utils/arabic"

export type FoodMode = "both" | "ready" | "cook"
export type Protein = "any" | "animal" | "chicken" | "meat" | "fish" | "egg" | "vegetarian"
export type ShoppingLocation = { lat: number; lng: number }
export type ShoppingPreferences = {
  people?: number
  budget?: number
  foodMode?: FoodMode
  protein?: Protein
  location?: ShoppingLocation | null
  radiusKm?: number
  pantryBasics?: boolean
  driverId?: string
}
export type ShoppingRequest = {
  dish: string | null
  people: number | null
  budget: number | null
  foodMode: FoodMode
  protein: Protein
  location: ShoppingLocation | null
  radiusKm: number
  pantryBasics: boolean
  driverId: string | null
}

export function validLocation(value: unknown): value is ShoppingLocation {
  if (!value || typeof value !== "object") return false
  const p = value as Record<string, unknown>
  return typeof p.lat === "number" && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
}

export function isMealRequest(query: string): boolean {
  return /(?:وجب|غدا|غداء|غدي|عشا|عشاء|فطار|افطار|جعان|ضيوف|عزوم|عازم|اعزم|اطبخ|هطبخ|اعمل اكل|اكل .*اشخاص)/.test(normalizeArabic(query))
}

function bounded(value: unknown, max: number, integer = false): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max &&
    (!integer || Number.isInteger(value)) ? value : null
}

/** Explicit controls take precedence over text; numbers never become prices from the model. */
export function shoppingRequest(query: string, preferences: ShoppingPreferences = {}, model: ShoppingPreferences = {}): ShoppingRequest {
  const text = normalizeArabic(query)
  const peopleMatch = /(?:ل\s*)?(\d{1,3})\s*(?:اشخاص|شخص|افراد|فرد|ضيوف|ضيف|ناس)/.exec(text)
  const budgetMatch = /(?:ميزاني(?:ه|تي)|حدود|معايا|معايه|معي|بحد اقصي|بحدود)\s*(\d+(?:\.\d+)?)/.exec(text) ||
    /(\d+(?:\.\d+)?)\s*(?:جنيه|جنيهات|جنية|ج\b)/.exec(text)
  const proteins: Protein[] = ["any", "animal", "chicken", "meat", "fish", "egg", "vegetarian"]
  const modes: FoodMode[] = ["both", "ready", "cook"]
  const fromText: Protein = /نباتي|من غير لحوم|بدون لحوم/.test(text) ? "vegetarian" :
    /حيواني/.test(text) ? "animal" : /فراخ|دجاج/.test(text) ? "chicken" :
    /لحمه|لحوم|لحم|كفته|كبده/.test(text) ? "meat" : /سمك|اسماك|تونه|سردين/.test(text) ? "fish" :
    /بيض/.test(text) ? "egg" : "any"
  const foodMode: FoodMode = /اطبخ|هطبخ|مكونات|وصفه|اعمل/.test(text) ? "cook" : /مطعم|مطاعم|جاهز|جاهزه/.test(text) ? "ready" : "both"
  return {
    dish: ["كشري", "بيتزا", "برجر", "شاورما", "كفته", "كبده", "سردين", "تونه"].find((dish) => text.includes(dish)) ?? null,
    people: bounded(preferences.people, 50, true) ?? bounded(peopleMatch ? Number(peopleMatch[1]) : null, 50, true) ?? bounded(model.people, 50, true),
    budget: bounded(preferences.budget, 100000) ?? bounded(budgetMatch ? Number(budgetMatch[1]) : null, 100000) ?? bounded(model.budget, 100000),
    foodMode: modes.includes(preferences.foodMode as FoodMode) ? preferences.foodMode! : foodMode !== "both" ? foodMode : modes.includes(model.foodMode as FoodMode) ? model.foodMode! : "both",
    protein: proteins.includes(preferences.protein as Protein) ? preferences.protein! : fromText !== "any" ? fromText : proteins.includes(model.protein as Protein) ? model.protein! : "any",
    location: validLocation(preferences.location) ? preferences.location : null,
    radiusKm: bounded(preferences.radiusKm, 100) ?? 10,
    pantryBasics: preferences.pantryBasics === true,
    driverId: typeof preferences.driverId === "string" && /^[\w-]{1,128}$/.test(preferences.driverId) ? preferences.driverId : null,
  }
}
