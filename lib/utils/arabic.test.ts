import { describe, it, expect } from "vitest"
import { normalizeArabic, matchesSearch, searchTokens } from "./arabic"

describe("normalizeArabic (تطبيع نص البحث)", () => {
  it("يوحّد صور الألف", () => {
    expect(normalizeArabic("أدوية")).toBe(normalizeArabic("ادوية"))
    expect(normalizeArabic("إسعاف")).toBe(normalizeArabic("اسعاف"))
    expect(normalizeArabic("آيس كريم")).toBe(normalizeArabic("ايس كريم"))
  })
  it("يوحّد التاء المربوطة والألف المقصورة", () => {
    expect(normalizeArabic("عبوة")).toBe(normalizeArabic("عبوه"))
    expect(normalizeArabic("مصطفى")).toBe(normalizeArabic("مصطفي"))
  })
  it("يحذف التشكيل والتطويل", () => {
    expect(normalizeArabic("شايٌ أحمــر")).toBe(normalizeArabic("شاي احمر"))
  })
  it("يحوّل الأرقام العربية-الهندية إلى لاتينية", () => {
    expect(normalizeArabic("شريط ٢٠ قرص")).toBe("شريط 20 قرص")
  })
  it("يصغّر الإنجليزي ويضغط المسافات", () => {
    expect(normalizeArabic("  Rosita   HAIR  cream ")).toBe("rosita hair cream")
  })
  it("مُتماثل (تطبيق مرتين = مرة)", () => {
    const once = normalizeArabic("أدويّة ١٠")
    expect(normalizeArabic(once)).toBe(once)
  })
  it("مدخلات غير نصية ⇒ نص فارغ", () => {
    expect(normalizeArabic(null)).toBe("")
    expect(normalizeArabic(undefined)).toBe("")
    expect(normalizeArabic(42)).toBe("")
  })
})

describe("searchTokens + matchesSearch (مطابقة بترتيب حرّ)", () => {
  it("يطابق الكلمات بأي ترتيب", () => {
    const tokens = searchTokens("شاي ليبتون")
    expect(matchesSearch("ليبتون شاي أحمر 100 فتلة", tokens)).toBe(true)
  })
  it("يطابق رغم اختلاف صورة الهمزة", () => {
    expect(matchesSearch("أسبرين 75 مجم", searchTokens("اسبرين"))).toBe(true)
  })
  it("لا يطابق لو نقصت كلمة", () => {
    expect(matchesSearch("شاي أخضر", searchTokens("شاي ليبتون"))).toBe(false)
  })
  it("استعلام فارغ يطابق كل شيء", () => {
    expect(matchesSearch("أي منتج", searchTokens("   "))).toBe(true)
  })
  it("نص فارغ لا يطابق استعلامًا غير فارغ", () => {
    expect(matchesSearch("", searchTokens("شاي"))).toBe(false)
  })
})
