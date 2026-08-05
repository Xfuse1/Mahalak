import { describe, it, expect } from "vitest"
import {
  cairoNow,
  isFlashOffer,
  isOfferActiveNow,
  offerRemainingQuantity,
  isOfferSoldOut,
  flashRemainingSeconds,
  formatCountdown,
} from "./offer-active"

// نثبّت "اليوم" يدويًا في اختبارات الفعالية بدل الاعتماد على ساعة الجهاز.
const TODAY = "2026-08-05"

describe("cairoNow", () => {
  it("يُرجع تاريخًا بصيغة YYYY-MM-DD وكسر ساعة داخل اليوم", () => {
    const { date, hourFraction } = cairoNow()
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hourFraction).toBeGreaterThanOrEqual(0)
    expect(hourFraction).toBeLessThan(24)
  })
})

describe("isFlashOffer", () => {
  it("يوم واحد + مدة بالساعات ⇒ فلاش", () => {
    expect(isFlashOffer({ start_date: TODAY, end_date: TODAY, duration_hours: 6 })).toBe(true)
  })
  it("يومان مختلفان ⇒ ليس فلاشًا حتى مع duration_hours", () => {
    expect(isFlashOffer({ start_date: TODAY, end_date: "2026-08-09", duration_hours: 6 })).toBe(false)
  })
  it("بلا duration_hours ⇒ ليس فلاشًا", () => {
    expect(isFlashOffer({ start_date: TODAY, end_date: TODAY })).toBe(false)
  })
})

describe("isOfferActiveNow", () => {
  it("داخل المدى ⇒ فعّال", () => {
    expect(isOfferActiveNow({ start_date: "2026-08-01", end_date: "2026-08-31" }, TODAY, 12)).toBe(true)
  })
  it("عرض قادم ⇒ غير فعّال", () => {
    expect(isOfferActiveNow({ start_date: "2026-09-01", end_date: "2026-09-30" }, TODAY, 12)).toBe(false)
  })
  it("عرض منتهٍ ⇒ غير فعّال", () => {
    expect(isOfferActiveNow({ start_date: "2026-07-01", end_date: "2026-07-31" }, TODAY, 12)).toBe(false)
  })
  it("يوم البداية/النهاية نفسه مشمول", () => {
    expect(isOfferActiveNow({ start_date: TODAY, end_date: TODAY }, TODAY, 23.9)).toBe(true)
  })
  it("فلاش داخل النافذة ⇒ فعّال، وبعدها ⇒ منتهٍ", () => {
    const flash = { start_date: TODAY, end_date: TODAY, duration_hours: 6 }
    expect(isOfferActiveNow(flash, TODAY, 5.5)).toBe(true)
    expect(isOfferActiveNow(flash, TODAY, 6.5)).toBe(false)
  })
  it("يتحمّل التاريخ بصيغة ISO كاملة", () => {
    expect(isOfferActiveNow({ start_date: "2026-08-01T00:00:00Z", end_date: "2026-08-31T00:00:00Z" }, TODAY, 10)).toBe(true)
  })
})

describe("الكمية المحدودة", () => {
  it("بلا حدّ ⇒ null ولا نفاد", () => {
    expect(offerRemainingQuantity({})).toBeNull()
    expect(isOfferSoldOut({})).toBe(false)
  })
  it("يحسب المتبقّي ولا ينزل تحت الصفر", () => {
    expect(offerRemainingQuantity({ quantity: 10, used_quantity: 3 })).toBe(7)
    expect(offerRemainingQuantity({ quantity: 10, used_quantity: 15 })).toBe(0)
  })
  it("نفاد الكمية يُعلَن", () => {
    expect(isOfferSoldOut({ quantity: 10, used_quantity: 10 })).toBe(true)
    expect(isOfferSoldOut({ quantity: 10, used_quantity: 9 })).toBe(false)
  })
})

describe("flashRemainingSeconds", () => {
  it("غير الفلاش ⇒ null", () => {
    expect(flashRemainingSeconds({ start_date: "2026-08-01", end_date: "2026-08-31" })).toBeNull()
  })
  it("فلاش في يوم غير اليوم ⇒ null", () => {
    expect(flashRemainingSeconds({ start_date: "2020-01-01", end_date: "2020-01-01", duration_hours: 6 })).toBeNull()
  })
  it("فلاش اليوم بمدة 24 ساعة ⇒ ثوانٍ موجبة", () => {
    const { date } = cairoNow()
    const seconds = flashRemainingSeconds({ start_date: date, end_date: date, duration_hours: 24 })
    expect(seconds).not.toBeNull()
    expect(seconds!).toBeGreaterThan(0)
    expect(seconds!).toBeLessThanOrEqual(24 * 3600)
  })
})

describe("formatCountdown", () => {
  it("يصوغ HH:MM:SS", () => {
    expect(formatCountdown(3661)).toBe("01:01:01")
    expect(formatCountdown(59)).toBe("00:00:59")
    expect(formatCountdown(36000)).toBe("10:00:00")
  })
  it("القيم السالبة تُقصّ إلى صفر", () => {
    expect(formatCountdown(-5)).toBe("00:00:00")
  })
})
