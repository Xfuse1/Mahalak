import { describe, it, expect } from "vitest"
import { phoneticKey, isUsableKey, PHONETIC_MIN_KEY } from "./phonetic"
import { normalizeArabic } from "../utils/arabic"

// الأزواج مأخوذة من الكتالوج الحقيقي (1543 صنفًا مستورَدًا من ملف الكاشير)، لا من أمثلة مُختلقة.
const REAL_PAIRS: Array<[string, string]> = [
  ["بنادول", "Panadol"],
  ["كتافلام", "CATAFLAM"],
  ["اوجمنتين", "AUGMENTIN"],
  ["فولتارين", "VOLTAREN"],
  ["زيرتك", "ZYRTEC"],
  ["كونجستال", "CONGESTAL"],
  ["انتينال", "ANTINAL"],
  ["فلاجيل", "FLAGYL"],
  ["بروفين", "BRUFEN"],
  ["كلاريتين", "claritine"],
  ["سيتال", "CETAL"],
  ["ابيمول", "ABIMOL"],
  ["امبيزيم", "Ambezim"],
]

const key = (text: string) => phoneticKey(normalizeArabic(text))

describe("phoneticKey (جسر العربي واللاتيني)", () => {
  it.each(REAL_PAIRS)("«%s» و«%s» لهما المفتاح نفسه", (arabic, latin) => {
    expect(key(arabic)).toBe(key(latin))
  })

  it("كل مفاتيح هذه الأزواج تبلغ العتبة (وإلا لما استُعملت أصلًا)", () => {
    for (const [arabic] of REAL_PAIRS) {
      expect(isUsableKey(key(arabic))).toBe(true)
    }
  })

  it("يُسقط الصائتات فلا يفرّق بين صور النقل الحرفي", () => {
    expect(key("بنادول")).toBe("bndl")
    expect(key("panadol")).toBe("bndl")
    expect(key("banadol")).toBe("bndl")
  })

  it("يوحّد الأصوات التي يخلط بينها النقل المصري", () => {
    expect(key("فولتارين")).toBe(key("voltaren")) // ف = v
    expect(key("كتافلام")).toBe(key("cataflam")) // ك = c
    expect(key("جيل")).toBe(key("gel")) // ج = g = j
    expect(key("فلاجيل")).toBe(key("flagyl"))
  })

  it("يضغط الحرف المكرّر", () => {
    expect(key("panadoll")).toBe(key("panadol"))
  })

  // العتبة 3 مُعايَرة على بيانات حقيقية: عند 4 يسقط «سيتال» ← CETAL.
  it("العتبة تقبل «سيتال» وترفض ما هو أقصر من ثلاثة", () => {
    expect(PHONETIC_MIN_KEY).toBe(3)
    expect(isUsableKey(key("سيتال"))).toBe(true)
    expect(isUsableKey(key("ادول"))).toBe(false) // مفتاحه بطول 2 ⇒ يتولّاه جدول الأسماء البديلة
    expect(isUsableKey(key("ريفو"))).toBe(false)
  })

  it("الكلمة العامّة القصيرة لا تبلغ العتبة فلا تلوّث النتائج", () => {
    expect(isUsableKey(key("دوا"))).toBe(false)
  })

  it("مدخل فارغ ⇒ مفتاح فارغ غير صالح", () => {
    expect(phoneticKey("")).toBe("")
    expect(isUsableKey("")).toBe(false)
  })

  it("و/ي صامتتان في أول الكلمة فقط", () => {
    expect(key("وارفارين")).toBe(key("warfarin"))
  })
})
