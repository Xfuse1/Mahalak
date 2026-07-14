import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"

// offer-discount يستورد firebase-admin؛ نُبدِله بستَب حتى لا يلمس أي اتصال حقيقي في اختبار وحدة.
vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => {
    throw new Error("getAdminDb must not be called in these unit tests")
  },
}))

import { findBestDiscount, applyOfferDiscount, type OfferRecord } from "@/lib/utils/offer-discount"

// نثبّت "الآن" على منتصف نهار القاهرة 2026-07-15 حتى تكون اختبارات التواريخ حتمية.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-07-15T09:00:00Z")) // القاهرة صيفًا ≈ 12:00، اليوم = 2026-07-15
})
afterAll(() => {
  vi.useRealTimers()
})

const P = { id: "p1", category: "cat1", store_id: "s1", price: 100 }

describe("findBestDiscount", () => {
  it("لا عروض → 0%", () => {
    expect(findBestDiscount(P, []).discount_percentage).toBe(0)
  })

  it("عرض مطابق للمنتج+المتجر يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", product_id: "p1", store_id: "s1", discount_percentage: 20 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(20)
  })

  it("عرض على مستوى الفئة (بدون product_id) يُطبَّق على نفس الفئة+المتجر", () => {
    const offers: OfferRecord[] = [{ id: "o1", category: "cat1", store_id: "s1", discount_percentage: 15 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(15)
  })

  it("عرض على مستوى المتجر (بدون product_id ولا category) يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", store_id: "s1", discount_percentage: 10 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(10)
  })

  it("أعلى خصم يفوز", () => {
    const offers: OfferRecord[] = [
      { id: "o1", store_id: "s1", discount_percentage: 10 },
      { id: "o2", product_id: "p1", store_id: "s1", discount_percentage: 30 },
      { id: "o3", category: "cat1", store_id: "s1", discount_percentage: 20 },
    ]
    const r = findBestDiscount(P, offers)
    expect(r.discount_percentage).toBe(30)
    expect(r.offer_id).toBe("o2")
  })

  it("متجر مختلف → لا يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", product_id: "p1", store_id: "OTHER", discount_percentage: 50 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(0)
  })

  it("عرض منتهٍ (end_date قبل اليوم) → لا يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", store_id: "s1", discount_percentage: 25, end_date: "2026-07-14" }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(0)
  })

  it("عرض مستقبلي (start_date بعد اليوم) → لا يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", store_id: "s1", discount_percentage: 25, start_date: "2026-07-16" }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(0)
  })

  it("عرض نفدت كميته (used >= quantity) → لا يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", store_id: "s1", discount_percentage: 25, quantity: 5, used_quantity: 5 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(0)
  })

  it("عرض بكمية متبقية → يُطبَّق", () => {
    const offers: OfferRecord[] = [{ id: "o1", store_id: "s1", discount_percentage: 25, quantity: 5, used_quantity: 4 }]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(25)
  })

  it("عرض فلاش انتهت ساعاته → لا يُطبَّق", () => {
    // نفس اليوم، مدة 10 ساعات، لكن الساعة ≈12 → منتهٍ
    const offers: OfferRecord[] = [
      { id: "o1", store_id: "s1", discount_percentage: 40, start_date: "2026-07-15", end_date: "2026-07-15", duration_hours: 10 },
    ]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(0)
  })

  it("عرض فلاش ما زال ضمن مدته → يُطبَّق", () => {
    const offers: OfferRecord[] = [
      { id: "o1", store_id: "s1", discount_percentage: 40, start_date: "2026-07-15", end_date: "2026-07-15", duration_hours: 15 },
    ]
    expect(findBestDiscount(P, offers).discount_percentage).toBe(40)
  })
})

describe("applyOfferDiscount", () => {
  it("لا خصم → السعر الكامل", () => {
    expect(applyOfferDiscount(P, [])).toBe(100)
  })

  it("يطبّق النسبة ويقرّب لأقرب قرش", () => {
    const offers: OfferRecord[] = [{ id: "o1", product_id: "p1", store_id: "s1", discount_percentage: 15 }]
    expect(applyOfferDiscount(P, offers)).toBe(85) // 100 - 15%
  })

  it("يقرّب الكسور لخانتين عشريتين", () => {
    const prod = { ...P, price: 99.99 }
    const offers: OfferRecord[] = [{ id: "o1", product_id: "p1", store_id: "s1", discount_percentage: 15 }]
    // 99.99 * 0.85 = 84.9915 → 84.99
    expect(applyOfferDiscount(prod, offers)).toBe(84.99)
  })

  it("لا يُرجع سعرًا سالبًا أبدًا", () => {
    const offers: OfferRecord[] = [{ id: "o1", product_id: "p1", store_id: "s1", discount_percentage: 150 }]
    expect(applyOfferDiscount(P, offers)).toBe(0)
  })
})
