import { beforeEach, describe, expect, it, vi } from "vitest"

// نفس عُدّة orders-shopping.test.ts: أفعال الطلب الأربعة على Firestore وهمي، ونفحص المستند المكتوب.
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
const creators: Array<[string, (attribution: unknown) => Promise<{ success: boolean; error?: string }>]> = [
  ["single driver", (attribution) => createOrder({ ...common, store_id: "shop", items, total: 2, driver_id: "driver", delivery_price: 0, attribution })],
  ["single dispatch", (attribution) => createDispatchOrder({ ...common, store_id: "shop", items, attribution })],
  ["multi driver", (attribution) => createMultiStoreOrder({ ...common, pickup_stops, driver_id: "driver", driver_name: "سائق", delivery_price: 0, driver_commission: 0, attribution })],
  ["multi dispatch", (attribution) => createMultiStoreDispatchOrder({ ...common, pickup_stops, attribution })],
]

// مستند الطلب نفسه = الكتابة التي تحمل customer_id (باقي الكتابات مخزون/عناصر)
function writtenOrder(): Record<string, unknown> | undefined {
  for (const call of state.writes.mock.calls) {
    const data = call[1] as Record<string, unknown> | undefined
    if (data && data.customer_id === "customer" && "status" in data) return data
  }
  return undefined
}

beforeEach(() => vi.clearAllMocks())

describe("attribution في أفعال إنشاء الطلب الأربعة", () => {
  it.each(creators)("%s يكتب مصدر الزيارة مُعقَّمًا وبقناة يحسبها السيرفر", async (_name, create) => {
    const result = await create({ utm_source: "facebook", utm_medium: "paid", utm_campaign: "launch<script>", channel: "google_ads", age_s: 120, evil: "x" })
    expect(result.success).toBe(true)
    const order = writtenOrder()
    expect(order?.attribution).toMatchObject({ channel: "meta_ads", utm_source: "facebook", utm_campaign: "launchscript" })
    expect(order?.attribution).not.toHaveProperty("evil")
  })

  it.each(creators)("%s يمضي بلا حقل عند مدخل فاسد أو غائب", async (_name, create) => {
    for (const bad of [undefined, null, "x", [], { age_s: -1, utm_source: "x" }, { utm_source: "x" }]) {
      state.writes.mockClear()
      const result = await create(bad)
      expect(result.success).toBe(true)
      expect(writtenOrder()).toBeDefined()
      expect(writtenOrder()).not.toHaveProperty("attribution")
    }
  })
})
