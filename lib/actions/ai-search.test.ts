import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  uid: "customer" as string | null,
  fee: 20,
  enabled: true,
  stock: 10,
  preparePrice: 150,
  data: new Map<string, Record<string, unknown>>(),
  model: vi.fn(), settings: vi.fn(), products: vi.fn(),
  log: vi.fn(), dbRead: vi.fn(),
}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock("../auth/session", () => ({ getCurrentUid: async () => state.uid }))
vi.mock("../logger", () => ({ logError: vi.fn() }))
vi.mock("../utils/rate-limit", () => ({ checkRateLimit: async () => true }))
vi.mock("../ai/search-settings", () => ({ readAiSearchSettings: state.settings }))
vi.mock("../ai/gemini", () => ({ isGeminiEnabled: () => true, geminiIntent: state.model }))
vi.mock("../ai/openai-compat", () => ({ isOpenAICompatEnabled: () => false, intentOpenAICompat: vi.fn() }))
vi.mock("../delivery/fee", () => ({ readDispatchSettings: async () => ({ enabled: true }), splitDeliveryFee: (fee: number) => ({ delivery_price: fee }),
  computeDeliveryFee: () => state.fee, computeDeliveryFeeFromCoords: () => state.fee }))
vi.mock("./products", () => ({ getProducts: state.products }))
vi.mock("./stores", () => ({ getStores: async () => [{ id: "shop", name: "متجر", latitude: 30, longitude: 31 }] }))
vi.mock("./delivery", () => ({ getDrivers: async () => [] }))
vi.mock("./orders", () => ({
  getDeliveryQuote: async () => ({ enabled: true, fee: state.fee, distance_km: 1 }),
  getMultiStoreDeliveryQuote: async () => ({ enabled: true, fee: state.fee, distance_km: 1 }),
}))
vi.mock("../utils/offer-discount", () => ({ findBestDiscount: () => ({ discount_percentage: 0 }), getActiveOffersForStores: async () => [] }))
vi.mock("../firebase/admin", () => ({ getAdminDb: () => ({ collection: (name: string) => ({
  add: state.log,
  doc: (id: string) => ({ get: async () => {
    state.dbRead(name, id)
    const data = state.data.get(`${name}/${id}`)
    return { exists: !!data, data: () => data }
  } }),
}) }) }))

import { aiSearch, prepareAiBasket } from "./ai-search"

beforeEach(() => {
  vi.clearAllMocks()
  state.uid = "customer"; state.fee = 20; state.enabled = true; state.stock = 10
  state.data.clear()
  state.settings.mockImplementation(async () => ({ enabled: state.enabled, mode: "customer_choice", daily_call_cap: 0, per_user_daily_cap: 0, cache_ttl_hours: 0, max_concepts: 12, otc_enabled: false }))
  state.model.mockResolvedValue({ intent: "recipe", title: "وجبة خيالية", items: [{ name: "وجبة خيالية", concepts: ["صنف غير موجود"] }] })
  state.products.mockImplementation(async () => [
    { id: "chicken", name: "فراخ 1 كجم", price: 150, stock: state.stock, store_id: "shop", stores: { name: "متجر" } },
    { id: "rice", name: "أرز 1 كجم", price: 20, stock: 10, store_id: "shop", stores: { name: "متجر" } },
    { id: "onion", name: "بصل 1 كجم", price: 20, stock: 10, store_id: "shop", stores: { name: "متجر" } },
  ])
  state.data.set("products/chicken", { name: "فراخ 1 كجم", price: 150, stock: 10, store_id: "shop" })
  state.data.set("users/shop", { role: "seller", store: { name: "متجر", latitude: 30, longitude: 31, is_approved: true } })
})
const preferences = { location: { lat: 30, lng: 31 }, pantryBasics: true }

describe("AI meal search orchestration without production IO", () => {
  it("checks caller identity before settings, catalog or model", async () => {
    state.uid = null
    expect((await aiSearch({ query: "غداء لـ4 أشخاص" })).success).toBe(false)
    expect(state.settings).not.toHaveBeenCalled(); expect(state.model).not.toHaveBeenCalled(); expect(state.products).not.toHaveBeenCalled()
  })
  it("never displays the model's invented meal title; prices real quantities plus shipping", async () => {
    const result = await aiSearch({ query: "غداء لـ4 أشخاص 500 جنيه", preferences })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.baskets).toHaveLength(1)
    expect(result.baskets[0].title).toBe("فراخ وأرز")
    expect(result.baskets[0].subtotal).toBe(340); expect(result.baskets[0].total).toBe(360)
    expect(result.baskets[0].groups[0].matches[0].quantity).toBe(2)
  })
  it("excludes food that only fits the budget before delivery", async () => {
    state.fee = 180
    const result = await aiSearch({ query: "غداء لـ4 أشخاص 500 جنيه", preferences })
    if (!result.success) throw new Error("unexpected failure")
    expect(result.baskets).toEqual([])
  })
  it("asks for location before retrieving the catalog", async () => {
    const result = await aiSearch({ query: "غداء لـ4 أشخاص 500 جنيه" })
    if (!result.success) throw new Error("unexpected failure")
    expect(result.shopping?.needs).toBe("location"); expect(state.products).not.toHaveBeenCalled()
  })
  it("does not claim dietary suitability or retain a health-related meal query", async () => {
    const result = await aiSearch({ query: "غداء لـ4 أشخاص لمريض السكر", preferences })
    if (!result.success) throw new Error("unexpected failure")
    expect(result.baskets).toEqual([]); expect(state.products).not.toHaveBeenCalled()
    expect(state.log).toHaveBeenCalledWith(expect.objectContaining({ user_id: null, query: null, concepts: [], redacted: true }))
  })
  it("does not route a medical symptom classification through the food planner", async () => {
    state.model.mockResolvedValue({ intent: "symptom", title: "أعراض", items: [{ name: "أعراض", concepts: ["دواء"] }] })
    const result = await aiSearch({ query: "جعان وتعبان", preferences })
    expect(result.success).toBe(false); expect(state.products).not.toHaveBeenCalled()
  })
  it("rechecks stock and rejects changed totals at basket selection", async () => {
    const res = await prepareAiBasket({ items: [{ id: "chicken", quantity: 2 }], preferences: { ...preferences, budget: 500 }, expectedTotal: 320 })
    expect(res.success).toBe(true)
    if (res.success) { expect(res.draft.items[0].price).toBe(150); expect(res.draft.quotedTotal).toBe(320) }
    state.data.set("products/chicken", { name: "فراخ", price: 160, stock: 10, store_id: "shop" })
    expect((await prepareAiBasket({ items: [{ id: "chicken", quantity: 2 }], preferences, expectedTotal: 320 })).success).toBe(false)
    state.data.set("products/chicken", { name: "فراخ", price: 150, stock: 1, store_id: "shop" })
    expect((await prepareAiBasket({ items: [{ id: "chicken", quantity: 2 }], preferences })).success).toBe(false)
  })
  it("rejects disabled merchants and duplicate or malformed quantities", async () => {
    state.data.set("users/shop", { role: "seller", disabled: true, store: { is_approved: true } })
    expect((await prepareAiBasket({ items: [{ id: "chicken", quantity: 1 }], preferences })).success).toBe(false)
    state.dbRead.mockClear()
    expect((await prepareAiBasket({ items: [{ id: "chicken", quantity: -1 }], preferences })).success).toBe(false)
    expect(state.dbRead).not.toHaveBeenCalled()
  })
  it("matches order pricing for undiscounted source prices with fractional pennies", async () => {
    state.data.set("products/chicken", { name: "فراخ", price: 150.125, stock: 10, store_id: "shop" })
    const result = await prepareAiBasket({ items: [{ id: "chicken", quantity: 2 }], preferences, expectedTotal: 320.25 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.draft.items[0].unit_price).toBe(150.125)
  })
})
