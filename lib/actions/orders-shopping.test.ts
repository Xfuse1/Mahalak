import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ writes: vi.fn(), notify: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("../auth/session", () => ({ requireOwner: async () => true }))
vi.mock("../auth/driver-session", () => ({ getCurrentDriverId: vi.fn() }))
vi.mock("../logger", () => ({ logError: vi.fn() }))
vi.mock("../server-error-log", () => ({ logServerError: vi.fn() }))
vi.mock("../notifications-internal", () => ({ createNotification: state.notify, sendReviewRequestNotification: vi.fn() }))
vi.mock("../server-push", () => ({ sendPushToOwner: vi.fn() }))
vi.mock("../delivery/driver-push", () => ({ notifyDriversOfOffer: vi.fn() }))
vi.mock("../utils/rate-limit", () => ({ checkRateLimit: async () => true }))
vi.mock("../utils/offer-discount", () => ({ getActiveOffersForStores: async () => [], findBestDiscount: () => ({ discount_percentage: 0 }), applyOfferDiscount: (p: { price: number }) => p.price }))
vi.mock("../delivery/fee", () => ({ readDispatchSettings: async () => ({ enabled: true }), computeDeliveryFee: () => 20,
  computeDeliveryFeeFromCoords: () => 20, splitDeliveryFee: (fee: number) => ({ delivery_price: fee, driver_fee: fee, merchant_absorbed: 0 }) }))
vi.mock("../firebase/admin", () => {
  const snap = (path: string) => ({ exists: true, data: () => path.startsWith("products/")
    ? { name: "فراخ", price: 150, stock: 10, store_id: "shop" }
    : path.startsWith("drivers/") ? { price: 20 } : { store: { is_approved: true, latitude: 30, longitude: 31 } } })
  return { getAdminDb: () => ({
    collection: (name: string) => ({ doc: (id = "generated") => ({ id, path: `${name}/${id}`, get: async () => snap(`${name}/${id}`) }) }),
    runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: async (ref: { path: string }) => snap(ref.path), set: state.writes, update: state.writes, delete: state.writes,
    }),
  }) }
})

import { createOrder, createDispatchOrder, createMultiStoreOrder, createMultiStoreDispatchOrder, type PickupStop } from "./orders"

const common = { customer_id: "customer", customer_name: "عميل", customer_phone: "01000000000", delivery_address: "عنوان", delivery_latitude: 30, delivery_longitude: 31 }
const items = [{ product_id: "chicken", quantity: 2, price: 1 }]
const pickup_stops: PickupStop[] = [{ store_id: "shop", store_name: "متجر", items: items.map((i) => ({ ...i, name: "فراخ" })), subtotal: 2, status: "pending" }]
type Constraints = { max_total?: number; expected_total?: number }
const creators: Array<[string, (constraints: Constraints) => Promise<{ success: boolean; error?: string }>]> = [
  ["single driver", (constraints) => createOrder({ ...common, store_id: "shop", items, total: 2, driver_id: "driver", delivery_price: 0, ...constraints })],
  ["single dispatch", (constraints) => createDispatchOrder({ ...common, store_id: "shop", items, ...constraints })],
  ["multi driver", (constraints) => createMultiStoreOrder({ ...common, pickup_stops, driver_id: "driver", driver_name: "سائق", delivery_price: 0, driver_commission: 0, ...constraints })],
  ["multi dispatch", (constraints) => createMultiStoreDispatchOrder({ ...common, pickup_stops, ...constraints })],
]

beforeEach(() => vi.clearAllMocks())
describe("shopping constraints inside all order transactions", () => {
  it.each(creators)("%s rejects source totals over budget before stock/order writes", async (_name, create) => {
    const result = await create({ max_total: 310 })
    expect(result).toMatchObject({ success: false, error: "SHOPPING_BUDGET_EXCEEDED" })
    expect(state.writes).not.toHaveBeenCalled(); expect(state.notify).not.toHaveBeenCalled()
  })
  it.each(creators)("%s rejects a stale quote even when still inside budget", async (_name, create) => {
    const result = await create({ max_total: 500, expected_total: 300 })
    expect(result).toMatchObject({ success: false, error: "SHOPPING_PRICE_CHANGED" })
    expect(state.writes).not.toHaveBeenCalled(); expect(state.notify).not.toHaveBeenCalled()
  })
})
