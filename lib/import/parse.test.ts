import { describe, it, expect } from "vitest"
import { parseExpiry, parseNum } from "./parse"

describe("parseNum (أرقام عربية/إنجليزية)", () => {
  it("يشيل العملة والفواصل", () => {
    expect(parseNum("1,250 ج")).toBe(1250)
    expect(parseNum("٣٫٥".replace("٫", "."))).toBe(3.5)
  })
  it("يحوّل الأرقام العربية", () => {
    expect(parseNum("١٢٣")).toBe(123)
  })
  it("فارغ/غير رقمي ⇒ NaN", () => {
    expect(parseNum("")).toBeNaN()
    expect(parseNum("abc")).toBeNaN()
  })
})

describe("parseExpiry (تطبيع تاريخ الصلاحية → YYYY-MM-DD)", () => {
  it("ISO كما هو", () => {
    expect(parseExpiry("2026-12-31")).toBe("2026-12-31")
  })
  it("YYYY/MM/DD", () => {
    expect(parseExpiry("2026/07/05")).toBe("2026-07-05")
  })
  it("DD/MM/YYYY (مصري، اليوم أولًا)", () => {
    expect(parseExpiry("31/12/2026")).toBe("2026-12-31")
    expect(parseExpiry("05/07/2026")).toBe("2026-07-05")
  })
  it("يصحّح الترتيب لو الأول شهر مؤكَّد (>12)", () => {
    expect(parseExpiry("12/31/2026")).toBe("2026-12-31")
  })
  it("MM/YYYY ⇒ آخر يوم في الشهر", () => {
    expect(parseExpiry("06/2027")).toBe("2027-06-30")
    expect(parseExpiry("02/2028")).toBe("2028-02-29") // سنة كبيسة
  })
  it("سنة من رقمين ⇒ 20xx", () => {
    expect(parseExpiry("31/12/26")).toBe("2026-12-31")
  })
  it("أرقام عربية-هندية", () => {
    expect(parseExpiry("٢٠٢٦-٠١-٠٥")).toBe("2026-01-05")
  })
  it("رقم Excel تسلسلي ⇒ تاريخ صالح الشكل", () => {
    const out = parseExpiry("46022")
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number(out!.slice(0, 4))).toBeGreaterThanOrEqual(2025)
  })
  it("باركود/كود طويل ليس تاريخًا ⇒ undefined", () => {
    expect(parseExpiry("6221234567890")).toBeUndefined() // > نطاق السيريال
    expect(parseExpiry("12345")).toBeUndefined() // < نطاق السيريال
  })
  it("فارغ/غلط/سنة خارج النطاق ⇒ undefined", () => {
    expect(parseExpiry("")).toBeUndefined()
    expect(parseExpiry(null)).toBeUndefined()
    expect(parseExpiry("مرحبا")).toBeUndefined()
    expect(parseExpiry("1990-01-01")).toBeUndefined()
    expect(parseExpiry("2026-13-40")).toBeUndefined()
  })
})
