import { describe, it, expect } from "vitest"
import { shoppingRequest, validLocation } from "./shopping-request"
import { planMeals, type MealProduct } from "./meal-planner"
import { parseFoodDetails } from "./food-details"
import { validateShoppingTotal } from "./order-constraints"
import { parseAiCheckoutDraft } from "./checkout-draft"

const stores = [{ id: "s", name: "متجر", latitude: 30, longitude: 31 }]
const request = shoppingRequest("غداء لـ٤ أشخاص في حدود ٥٠٠ جنيه وجبة حيوانية", { location: { lat: 30, lng: 31 }, pantryBasics: true })
const product = (id: string, name: string, overrides: Partial<MealProduct> = {}): MealProduct => ({ id, name, price: 20, unit_price: 20, stock: 30, store_id: "s", store_name: "متجر", discount_percentage: 0, image_url: null, ...overrides })
const chickenProducts = () => [product("chicken", "فراخ كاملة 1 كجم", { unit_price: 150, price: 150 }), product("rice", "أرز 1 كجم"), product("onion", "بصل 1 كجم")]

describe("shopping request constraints", () => {
  it("reads Egyptian numbers, headcount and total budget", () => {
    expect(request.people).toBe(4); expect(request.budget).toBe(500); expect(request.protein).toBe("animal")
  })
  it("explicit controls override text and model; malformed model values do not pass", () => {
    const r = shoppingRequest("غداء لـ4 أشخاص 500 جنيه", { people: 6, budget: 400 }, { people: 100000, budget: Infinity })
    expect(r.people).toBe(6); expect(r.budget).toBe(400)
    expect(shoppingRequest("", {}, { people: -2, budget: NaN }).people).toBeNull()
  })
  it("rejects unknown and invalid locations instead of calling them nearby", () => {
    expect(validLocation({ lat: Infinity, lng: 31 })).toBe(false)
    expect(validLocation({ lat: 0, lng: 0 })).toBe(false)
    expect(planMeals(chickenProducts(), stores, { ...request, location: null }, "customer_choice")).toEqual([])
    expect(planMeals(chickenProducts(), [{ id: "s" }], request, "customer_choice")).toEqual([])
    expect(planMeals(chickenProducts(), [{ id: "s", latitude: 390, longitude: 31 }], request, "customer_choice")).toEqual([])
  })
})

describe("catalog-grounded meal plans", () => {
  it("scales full package quantities for four; never replaces chicken with bouillon", () => {
    const options = planMeals([...chickenProducts(), product("bouillon", "مرقة فراخ 1 كجم", { price: 5, unit_price: 5 })], stores, request, "customer_choice")
    const option = options.find((o) => o.title === "فراخ وأرز")!
    expect(option).toBeDefined(); expect(option.lines.find((l) => l.product.id === "chicken")?.quantity).toBe(2)
    expect(option.lines.some((l) => l.product.id === "bouillon")).toBe(false)
    expect(option.subtotal).toBe(340)
  })
  it("requires complete ingredients; basics are purchased unless explicitly present", () => {
    expect(planMeals(chickenProducts().filter((p) => p.id !== "rice"), stores, request, "customer_choice")).toEqual([])
    expect(planMeals(chickenProducts(), stores, { ...request, pantryBasics: false }, "customer_choice")).toEqual([])
  })
  it("does not invent a pack size and rejects insufficient stock", () => {
    expect(planMeals(chickenProducts().map((p) => p.id === "chicken" ? { ...p, name: "فراخ كاملة" } : p), stores, request, "customer_choice")).toEqual([])
    expect(planMeals(chickenProducts().map((p) => p.id === "chicken" ? { ...p, stock: 1 } : p), stores, request, "customer_choice")).toEqual([])
  })
  it("ready meals require verified merchant servings and matching protein", () => {
    const meals = [product("unverified", "عرض عائلي فراخ"), product("verified", "عرض غداء عائلي", { food_details: { kind: "meal", protein: "chicken", servings: 2 } }), product("vegan", "وجبة عدس", { food_details: { kind: "meal", protein: "vegetarian", servings: 4 } })]
    const options = planMeals(meals, stores, { ...request, foodMode: "ready" }, "customer_choice")
    expect(options).toHaveLength(1); expect(options[0].lines[0].product.id).toBe("verified"); expect(options[0].lines[0].quantity).toBe(2)
  })
  it("reads explicit legacy portions but never infers portions from a family offer", () => {
    const meals = [product("family", "عرض فراخ عائلي"), product("labelled", "وجبة فراخ تكفي ٤ أفراد")]
    const options = planMeals(meals, stores, { ...request, foodMode: "ready" }, "customer_choice")
    expect(options.map((o) => o.lines[0].product.id)).toEqual(["labelled"])
    expect(options[0].lines[0].quantity).toBe(1)
  })
  it("honors a specific dish instead of returning unrelated meals", () => {
    const meals = [product("pizza", "بيتزا فراخ", { food_details: { kind: "meal", protein: "chicken", servings: 2 } }), product("chicken", "وجبة فراخ وأرز", { food_details: { kind: "meal", protein: "chicken", servings: 4 } })]
    const options = planMeals(meals, stores, shoppingRequest("وجبة بيتزا فراخ لـ4 أشخاص", { location: request.location }), "customer_choice")
    expect(options.map((o) => o.title)).toEqual(["بيتزا فراخ"])
  })
  it("excludes distant stores and keeps recipe choices independent", () => {
    const nearby = planMeals(chickenProducts(), stores, request, "customer_choice")
    expect(nearby).toHaveLength(1)
    expect(planMeals(chickenProducts(), [{ id: "s", latitude: 31, longitude: 32 }], request, "customer_choice")).toEqual([])
  })
  it("builds multi-store only when allowed, with a complete independent basket", () => {
    const catalog = chickenProducts().map((p) => p.id === "rice" ? { ...p, store_id: "s2" } : p)
    const s = [...stores, { id: "s2", latitude: 30.01, longitude: 31 }]
    expect(planMeals(catalog, s, request, "single_store")).toEqual([])
    expect(planMeals(catalog, s, request, "customer_choice")[0].kind).toBe("multi")
  })
  it("uses explicit metadata when labels lack weights, strips extra metadata keys", () => {
    const catalog = chickenProducts().map((p) => p.id === "chicken" ? { ...p, name: "فراخ كاملة", food_details: { kind: "ingredient", protein: "chicken", pack_quantity: 500, pack_unit: "g" } } : p)
    expect(planMeals(catalog, stores, request, "customer_choice")[0].lines[0].quantity).toBe(3)
    expect(parseFoodDetails({ kind: "meal", protein: "chicken", servings: 4, role: "admin" })).toEqual({ kind: "meal", protein: "chicken", servings: 4 })
    expect(parseFoodDetails({ kind: "meal", protein: "chicken", servings: 0 })).toBeNull()
  })
})

describe("order total safety", () => {
  it("checks food plus delivery, rejects over-budget or changed server totals", () => {
    expect(() => validateShoppingTotal(500, { max_total: 500, expected_total: 500 })).not.toThrow()
    expect(() => validateShoppingTotal(510, { max_total: 500 })).toThrow("SHOPPING_BUDGET_EXCEEDED")
    expect(() => validateShoppingTotal(499, { max_total: 500, expected_total: 500 })).toThrow("SHOPPING_PRICE_CHANGED")
    expect(() => validateShoppingTotal(20, { max_total: NaN })).toThrow("INVALID_SHOPPING_BUDGET")
    expect(() => validateShoppingTotal(NaN, { max_total: 500 })).toThrow("INVALID_SHOPPING_TOTAL")
    expect(() => validateShoppingTotal(20, {})).not.toThrow()
  })
  it("rejects malformed stored checkout drafts", () => {
    expect(parseAiCheckoutDraft(null)).toBeNull()
    expect(parseAiCheckoutDraft({ items: [], quotedTotal: 0, budget: null })).toBeNull()
  })
})
