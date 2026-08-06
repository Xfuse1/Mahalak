import { describe, it, expect } from "vitest"
import { normalizeArabic, matchesSearch, searchTokens, splitSearchTokens, stripAl } from "./arabic"

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

  // ── محارف التحكّم غير المرئية ───────────────────────────────────────────────
  // تحقنها ملفات Excel والكاشير العربية. لا يحذفها NFKC ولا يطابقها \s، وحين تقع وسط الكلمة
  // تُفشل المطابقة تمامًا بلا أي عَرَض ظاهر للتاجر أو العميل.
  it("يحذف محارف التحكّم غير المرئية من وسط الكلمة", () => {
    for (const invisible of ["‏", "‎", "؜", "‍", "‌", "​", "­", "﻿"]) {
      expect(normalizeArabic(`بنا${invisible}دول`)).toBe("بنادول")
    }
  })
  it("اسم منتج محقون بمحرف تحكّم يطابق ما يكتبه العميل", () => {
    expect(matchesSearch("بنا‏دول اكسترا 24 قرص", searchTokens("بنادول"))).toBe(true)
  })
  it("يحذف علامات التنسيق ثنائية الاتجاه (LRE/RLE/PDF/LRI/PDI)", () => {
    expect(normalizeArabic("‫شاي‬")).toBe("شاي")
    expect(normalizeArabic("⁦panadol⁩")).toBe("panadol")
  })

  // ── الحروف الفارسية/الأردية ────────────────────────────────────────────────
  // الكاف والياء الفارسيتان متطابقتان بصريًّا مع العربيتين ⇒ عطل يستحيل تشخيصه بالعين.
  it("يعرّب الكاف والياء الفارسيتين المتطابقتين بصريًّا", () => {
    expect(normalizeArabic("کريم")).toBe(normalizeArabic("كريم"))
    expect(normalizeArabic("ادویة")).toBe(normalizeArabic("ادوية"))
  })
  it("يعرّب باقي الحروف الفارسية/الأردية", () => {
    expect(normalizeArabic("ڤولتارين")).toBe(normalizeArabic("فولتارين"))
    expect(normalizeArabic("چاي")).toBe(normalizeArabic("جاي"))
    expect(normalizeArabic("ھند")).toBe(normalizeArabic("هند"))
  })

  // ── نطاق التشكيل الموسَّع ──────────────────────────────────────────────────
  it("يحذف علامات التشكيل خارج النطاق الضيّق القديم", () => {
    // U+0656 و U+0610 و U+06D6 كانت تنجو من النطاق السابق [ً-ْٰـ]
    expect(normalizeArabic("شايٖ")).toBe("شاي")
    expect(normalizeArabic("شايؐ")).toBe("شاي")
    expect(normalizeArabic("شايۖ")).toBe("شاي")
  })
})

describe("splitSearchTokens (حدود الكلمات)", () => {
  it("يقسم على أي فاصل غير أبجدي-رقمي لا على المسافة وحدها", () => {
    expect(splitSearchTokens("بنادول،اكسترا")).toEqual(["بنادول", "اكسترا"])
    expect(splitSearchTokens("بنادول-500")).toEqual(["بنادول", "500"])
    expect(splitSearchTokens("فيتامين c/زنك")).toEqual(["فيتامين", "c", "زنك"])
    expect(splitSearchTokens("كريم (للبشرة)")).toEqual(["كريم", "للبشره"])
  })
  it("يفصل الرقم عن الحرف الملتصق به", () => {
    expect(splitSearchTokens("500mg")).toEqual(["500", "mg"])
    expect(splitSearchTokens("500مج")).toEqual(["500", "مج"])
    expect(splitSearchTokens("PANADOL24TAB")).toEqual(["panadol", "24", "tab"])
  })
  it("نص فارغ أو رموز فقط ⇒ قائمة فارغة", () => {
    expect(splitSearchTokens("")).toEqual([])
    expect(splitSearchTokens("--- , ///")).toEqual([])
    expect(splitSearchTokens(null)).toEqual([])
  })
})

describe("stripAl (تجريد أداة التعريف)", () => {
  it("يجرّد التعريف حين يبقى جذع ذو معنى", () => {
    expect(stripAl("الشاي")).toBe("شاي")
    expect(stripAl("والشاي")).toBe("شاي")
    expect(stripAl("بالعسل")).toBe("عسل")
    expect(stripAl("للاطفال")).toBe("اطفال")
  })
  it("لا يجرّد إذا كان الجذع سيقصر عن ثلاثة أحرف", () => {
    expect(stripAl("الف")).toBe("الف")
    expect(stripAl("الم")).toBe("الم")
    expect(stripAl("ال")).toBe("ال")
  })
  it("لا يمسّ كلمة لا تبدأ بأداة تعريف", () => {
    expect(stripAl("علاج")).toBe("علاج")
    expect(stripAl("panadol")).toBe("panadol")
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

  // تجريد «ال» توسيعٌ محضٌ للاسترجاع: لا يكسر أيًّا من الاتجاهين
  it("«الشاي» تجد المنتج المخزَّن «شاي ليبتون»", () => {
    expect(matchesSearch("شاي ليبتون أحمر", searchTokens("الشاي"))).toBe(true)
  })
  it("«شاي» ما زالت تجد المنتج المخزَّن «الشاي الأحمر»", () => {
    expect(matchesSearch("الشاي الأحمر", searchTokens("شاي"))).toBe(true)
  })
  it("استعلام بفواصل غير المسافة يطابق", () => {
    expect(matchesSearch("بنادول اكسترا 24 قرص", searchTokens("بنادول،اكسترا"))).toBe(true)
  })
  it("الرقم الملتصق بالوحدة يطابق المكتوب بمسافة", () => {
    expect(matchesSearch("اسبرين 75 مجم", searchTokens("75مجم"))).toBe(true)
  })
})
