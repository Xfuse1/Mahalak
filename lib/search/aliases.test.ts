import { describe, it, expect } from "vitest"
import { normalizeArabic } from "@/lib/utils/arabic"
import { BRAND_ALIASES, UNIT_SYNONYMS, buildAliasLookup, aliasTextFor } from "./aliases"

// نفس تطبيع العبارات المستعمل داخل الوحدة: الشرطة فاصل («اس-26» = «اس 26») ثم مسافة واحدة.
const phrase = (text: string): string => normalizeArabic(text).replace(/-/g, " ").replace(/\s+/g, " ").trim()

const formsOf = (term: string): Set<string> => buildAliasLookup().get(phrase(term)) ?? new Set<string>()

describe("BRAND_ALIASES / UNIT_SYNONYMS (بنية الجدول)", () => {
  it("يغطي 300 مدخلة تجارية على الأقل", () => {
    expect(Object.keys(BRAND_ALIASES).length).toBeGreaterThanOrEqual(300)
  })
  it("لا مفتاح فارغ ولا مجموعة فارغة", () => {
    for (const [key, values] of [...Object.entries(BRAND_ALIASES), ...Object.entries(UNIT_SYNONYMS)]) {
      expect(phrase(key)).not.toBe("")
      expect(values.length).toBeGreaterThan(0)
      for (const value of values) expect(phrase(value)).not.toBe("")
    }
  })
})

describe("buildAliasLookup (فهرس ثنائي الاتجاه)", () => {
  it("«بنادول» تصل إلى الاسم اللاتيني والمادة الفعّالة", () => {
    const forms = formsOf("بنادول")
    expect(forms.has("panadol")).toBe(true)
    expect(forms.has("paracetamol")).toBe(true)
  })
  it("«Panadol» تصل إلى العربية (الاتجاه المعاكس)", () => {
    expect(formsOf("Panadol").has("بنادول")).toBe(true)
  })
  it("«باراسيتامول» تجمع البدائل التجارية", () => {
    const forms = formsOf("باراسيتامول")
    expect(forms.has("بنادول")).toBe(true)
    expect(forms.has("سيتال")).toBe(true)
  })
  it("تهجئة عربية بديلة تصل لنفس المجموعة", () => {
    expect(formsOf("بانادول").has("panadol")).toBe(true)
    expect(formsOf("أوجمنتين").has("augmentin")).toBe(true)
  })
  it("ثنائية الاتجاه لعيّنة من 5 مدخلات", () => {
    const sample: Array<[string, string]> = [
      ["بنادول", "panadol"],
      ["اوجمنتين", "augmentin"],
      ["فنتولين", "salbutamol"],
      ["بيبسي", "pepsi"],
      ["ديتول", "dettol"],
    ]
    for (const [first, second] of sample) {
      expect(formsOf(first).has(phrase(second))).toBe(true)
      expect(formsOf(second).has(phrase(first))).toBe(true)
    }
  })
  it("ثنائية الاتجاه محفوظة في كل الجدول", () => {
    for (const [key, values] of [...Object.entries(BRAND_ALIASES), ...Object.entries(UNIT_SYNONYMS)]) {
      for (const value of values) {
        expect(formsOf(key).has(phrase(value))).toBe(true)
        expect(formsOf(value).has(phrase(key))).toBe(true)
      }
    }
  })
  it("يوحّد وحدات القياس والأشكال الصيدلانية", () => {
    expect(formsOf("قرص").has("tab")).toBe(true)
    expect(formsOf("tablet").has("قرص")).toBe(true)
    expect(formsOf("مج").has("mg")).toBe(true)
    expect(formsOf("ml").has("مل")).toBe(true)
  })
  it("يُبنى مرّة واحدة (نفس المرجع في كل استدعاء)", () => {
    expect(buildAliasLookup()).toBe(buildAliasLookup())
  })
})

describe("aliasTextFor (نصّ البحث الإضافي للمنتج)", () => {
  it("اسم لاتيني ⇒ يُخرج المكافئ العربي", () => {
    expect(aliasTextFor("Ventolin Inhaler")).toContain("فنتولين")
  })
  it("اسم كاشير كامل ⇒ اسم + وحدة", () => {
    const text = aliasTextFor("PANADOL EXTRA 24 TAB")
    expect(text).toContain("بنادول")
    expect(text).toContain("قرص")
  })
  it("الشرطة والشرطة المائلة فواصل لا حروف", () => {
    expect(aliasTextFor("PANADOL-EXTRA/24")).toContain("بنادول")
  })
  it("يلتقط العبارة المكوّنة من كلمتين", () => {
    expect(aliasTextFor("Coca Cola 1 L")).toContain("كوكاكولا")
  })
  it("العامية والمادة الفعّالة تصلان للاسم التجاري", () => {
    expect(aliasTextFor("سالبوتامول 100 مجم")).toContain("ventolin")
    expect(aliasTextFor("شراب كحة للأطفال")).toContain("cough")
  })
  it("نصّ لا يطابق شيئًا ⇒ سلسلة فارغة", () => {
    expect(aliasTextFor("زقزوق فرتكانة")).toBe("")
  })
  it("نصّ فارغ أو رموز فقط ⇒ سلسلة فارغة", () => {
    expect(aliasTextFor("")).toBe("")
    expect(aliasTextFor("   ---   ")).toBe("")
  })
})
