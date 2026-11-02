import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { buildContentsPayload, metaUnitPrice, trackPurchase, trackSearch, trackAddToCart } from "./meta-events"

describe("buildContentsPayload — حمولة contents/value الموحّدة", () => {
  it("يحسب السعر بعد الخصم والكمية والإجمالي بمنزلتين", () => {
    const p = buildContentsPayload([
      { id: "a", price: 100, discount_percentage: 15, quantity: 2 },
      { id: "b", price: 9.99, quantity: 3 },
    ])
    expect(p.content_ids).toEqual(["a", "b"])
    expect(p.contents).toEqual([
      { id: "a", quantity: 2, item_price: 85 },
      { id: "b", quantity: 3, item_price: 9.99 },
    ])
    expect(p.num_items).toBe(5)
    expect(p.value).toBe(199.97)
    expect(p.currency).toBe("EGP")
    expect(p.content_type).toBe("product")
  })

  it("سعر وحدة السيرفر (البحث الذكي) يتقدّم على السعر والخصم", () => {
    expect(metaUnitPrice({ id: "a", price: 100, discount_percentage: 50, unit_price: 77.5 })).toBe(77.5)
  })

  it("كمية فاسدة تُعامل كـ1، وعنصر بلا معرّف يُسقط", () => {
    const p = buildContentsPayload([
      { id: "a", price: 10, quantity: Number.NaN },
      { id: "", price: 10 },
    ])
    expect(p.contents).toEqual([{ id: "a", quantity: 1, item_price: 10 }])
  })
})

describe("الإطلاق عبر fbq", () => {
  const fbq = vi.fn()
  beforeEach(() => {
    fbq.mockReset()
    ;(globalThis as unknown as { window: unknown }).window = { fbq }
  })
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window
  })

  it("Purchase يحمل eventID بمعرّف الطلب وقيمة السيرفر", () => {
    trackPurchase("ord1", [{ id: "a", price: 50, quantity: 2 }], 125)
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      expect.objectContaining({ value: 125, currency: "EGP", content_ids: ["a"], order_id: "ord1" }),
      { eventID: "order-ord1" },
    )
  })

  it("Purchase بلا إجمالي سيرفر يرجع لمجموع الأصناف", () => {
    trackPurchase("ord2", [{ id: "a", price: 50, quantity: 2 }], Number.NaN)
    expect(fbq.mock.calls[0][2]).toMatchObject({ value: 100 })
  })

  it("Search لا يرسل نصّ البحث — معرّفات النتائج فقط", () => {
    trackSearch(["p1", "p2"])
    const params = fbq.mock.calls[0][2]
    expect(params).toEqual({ content_ids: ["p1", "p2"], content_type: "product" })
  })

  it("AddToCart بلا أصناف لا يُطلق", () => {
    trackAddToCart([])
    expect(fbq).not.toHaveBeenCalled()
  })

  it("غياب fbq لا يرمي", () => {
    ;(globalThis as unknown as { window: unknown }).window = {}
    expect(() => trackPurchase("x", [], 1)).not.toThrow()
  })
})
