import { describe, it, expect } from "vitest"
import { buildIntentPrompt, hasRedFlag, parseIntent, shouldUseAiSearch } from "./intent"
import { searchTokens } from "../utils/arabic"

const ok = { intent: "recipe", title: "كشري مصري", items: [{ name: "كشري", concepts: ["أرز", "عدس بجبة", "مكرونة"] }] }

describe("parseIntent — التحقّق من ردّ الموديل", () => {
  it("يقبل الرد الصحيح كما هو", () => {
    const out = parseIntent(ok, 12)
    expect(out?.intent).toBe("recipe")
    expect(out?.items[0].concepts).toEqual(["أرز", "عدس بجبة", "مكرونة"])
  })

  it("يقبل الرد ملفوفًا في مصفوفة (سلوك موديلات واقعي)", () => {
    expect(parseIntent([ok], 12)?.intent).toBe("recipe")
  })

  it("يردّ نيّة غير معروفة إلى generic بدل رفض الاستعلام", () => {
    expect(parseIntent({ ...ok, intent: "shopping" }, 12)?.intent).toBe("generic")
  })

  it("يحترم سقف المفاهيم", () => {
    const many = { ...ok, items: [{ name: "ك", concepts: ["a", "b", "c", "d", "e", "f"] }] }
    expect(parseIntent(many, 3)?.items[0].concepts).toHaveLength(3)
  })

  it("يوزّع السقف عبر العناصر لا داخل كل عنصر", () => {
    const two = {
      ...ok,
      items: [
        { name: "أ", concepts: ["a", "b"] },
        { name: "ب", concepts: ["c", "d"] },
      ],
    }
    const out = parseIntent(two, 3)
    expect(out!.items.flatMap((i) => i.concepts)).toHaveLength(3)
  })

  it("يمنع تكرار المفهوم عبر العناصر (وإلا اشترى العميل نفس الصنف مرّتين)", () => {
    const dup = {
      ...ok,
      items: [
        { name: "أ", concepts: ["بصل", "طماطم"] },
        { name: "ب", concepts: ["بصل", "ثوم"] },
      ],
    }
    const all = parseIntent(dup, 12)!.items.flatMap((i) => i.concepts)
    expect(all).toEqual(["بصل", "طماطم", "ثوم"])
  })

  it("يقصّ العناصر إلى ثلاثة", () => {
    const many = {
      ...ok,
      items: [1, 2, 3, 4, 5].map((n) => ({ name: `ط${n}`, concepts: [`c${n}`] })),
    }
    expect(parseIntent(many, 30)?.items).toHaveLength(3)
  })

  it("يحذف المحارف غير المرئية من المفاهيم", () => {
    const dirty = { ...ok, items: [{ name: "ك", concepts: ["بنا​دول"] }] }
    expect(parseIntent(dirty, 12)?.items[0].concepts[0]).toBe("بنا دول")
  })

  it("يُرجع null لردّ بلا مفهوم واحد صالح", () => {
    expect(parseIntent({ intent: "recipe", title: "x", items: [{ name: "y", concepts: [] }] }, 12)).toBeNull()
    expect(parseIntent({ items: "nope" }, 12)).toBeNull()
    expect(parseIntent(null, 12)).toBeNull()
    expect(parseIntent("نص حر", 12)).toBeNull()
  })

  it("يستخدم العنوان اسمًا للمجموعة حين ينقص اسمها", () => {
    const out = parseIntent({ intent: "product", title: "منظفات", items: [{ concepts: ["فلاش"] }] }, 12)
    expect(out?.items[0].name).toBe("منظفات")
  })

  it("لا يلفّ على مصفوفة ضخمة من عناصر فارغة (سقف على العمل لا على الناتج)", () => {
    const flood = { intent: "recipe", title: "x", items: Array.from({ length: 50_000 }, () => ({ name: "أ", concepts: [] })) }
    const t0 = Date.now()
    expect(parseIntent(flood, 12)).toBeNull()
    expect(Date.now() - t0).toBeLessThan(200)
  })

  it("لا يرمي على مدخلات مشوّهة", () => {
    for (const bad of [undefined, 0, [], [null], { items: [null, 5] }, { items: [{ concepts: [null, 7] }] }]) {
      expect(() => parseIntent(bad, 12)).not.toThrow()
    }
  })
})

describe("buildIntentPrompt", () => {
  it("يضمّن الاستعلام ويقصّ الطويل", () => {
    expect(buildIntentPrompt("عايز كشري", 12)).toContain("عايز كشري")
    expect(buildIntentPrompt("ا".repeat(999), 12).length).toBeLessThan(2500)
  })

  it("يمنع الجرعات والنصائح الطبية نصًّا", () => {
    const p = buildIntentPrompt("مصدع", 12)
    expect(p).toContain("جرعة")
    expect(p).toContain("ممنوع")
  })

  it("يحصر السقف في مدى آمن مهما كان المُدخَل", () => {
    expect(buildIntentPrompt("x", 0)).toContain("12")
    expect(buildIntentPrompt("x", 9999)).toContain("50")
  })
})

describe("shouldUseAiSearch — اقتراح الوضع", () => {
  it("يختار العادي لاسم صنف", () => {
    expect(shouldUseAiSearch("بنادول")).toBe(false)
    expect(shouldUseAiSearch("شامبو كلير")).toBe(false)
  })

  it("يختار الذكي للجملة أو السؤال أو صيغة الطلب", () => {
    expect(shouldUseAiSearch("عايز اعمل كشري")).toBe(true)
    expect(shouldUseAiSearch("اكل خفيف للعشا بسرعة")).toBe(true)
    expect(shouldUseAiSearch("فين الشامبو؟")).toBe(true)
    expect(shouldUseAiSearch("محتاج منظف")).toBe(true)
  })

  it("لا يشتغل على الفراغ", () => {
    expect(shouldUseAiSearch("")).toBe(false)
    expect(shouldUseAiSearch("   ")).toBe(false)
  })
})

describe("hasRedFlag — بوابة السلامة", () => {
  it("يمسك الشكاوى الخطِرة", () => {
    for (const q of ["حاسس بألم صدر", "عندي نزيف", "مش قادر اتنفس", "ابني بيتشنج ومعاه تشنج", "وقع وحصله كسر", "الم صدر من امبارح"]) {
      expect(hasRedFlag(q, searchTokens)).toBe(true)
    }
  })

  it("لا يمسك الشكاوى العادية ولا مشتريات الأمومة", () => {
    // «حامل/رضيع» موانع صرف دواء لا طوارئ — «لبن رضيع» صنف يُباع فعلًا على المنصّة.
    for (const q of ["حاسس اني مصدع", "عايز مسكن", "عندي برد", "اكل للغدا", "لبن رضيع", "فيتامينات للحامل"]) {
      expect(hasRedFlag(q, searchTokens)).toBe(false)
    }
  })

  it("يطابق الكلمة كاملة لا جزءًا منها", () => {
    // «دمياط» و«فول مدمس» يحويان «دم»، ولا واحد منهما حالة طارئة.
    expect(hasRedFlag("عايز سمك من دمياط", searchTokens)).toBe(false)
    expect(hasRedFlag("فول مدمس", searchTokens)).toBe(false)
  })

  it("يتحمّل اختلاف صور الحروف والسوابق الملتصقة", () => {
    expect(hasRedFlag("عندي إغماء", searchTokens)).toBe(true)
    expect(hasRedFlag("عندي اغماء", searchTokens)).toBe(true)
    // السابقة «ب» هي بالضبط ما كان يُفلت «بألم صدر» من البوابة، والسابقتان «وب» معًا واردتان.
    expect(hasRedFlag("حاسس بألم في صدري وبنزيف", searchTokens)).toBe(true)
  })

  it("يتحمّل اللاحقة الملكية وكلمة حشو بين كلمتَي المصطلح", () => {
    // «ألم في صدري» أشيع في العامية من «ألم صدر»، وهي الصيغة التي يكتبها العميل فعلًا.
    expect(hasRedFlag("ألم في صدري", searchTokens)).toBe(true)
    expect(hasRedFlag("عندي ضيق في التنفس", searchTokens)).toBe(true)
    expect(hasRedFlag("وجع في صدرها", searchTokens)).toBe(true)
  })

  it("يمسك الطوارئ بالصياغة العامّية التي تُكتَب فعلًا", () => {
    // القائمة كانت فصيحة والشكوى عامّية — فئات طوارئ كاملة كانت تفلت.
    for (const q of [
      "الواد شرب اللي في ازازة الفلاش",
      "ابني بيرجع دم",
      "لقيت دم مع البراز",
      "بنتي بلعت بطارية",
      "اخد الشريط كله بالغلط",
      "قرصة تعبان في رجلي",
      "عضني كلب في الشارع",
      "بابا مش بيرد عليا",
    ]) {
      expect(hasRedFlag(q, searchTokens)).toBe(true)
    }
  })

  it("ولا تمسك التسوّق العادي رغم اتّساع القائمة", () => {
    for (const q of ["عايز شريط بنادول", "كلور للغسيل", "فلاش منظف ارضيات", "لبن للاطفال", "عايز بطارية للريموت"]) {
      expect(hasRedFlag(q, searchTokens)).toBe(false)
    }
  })

  it("لا يجرّد السابقة حتى يفقد الجذع معناه", () => {
    // «بصل» ⇒ «صل» تخريب، و«لبن» و«فول» أصناف بقالة لا شكاوى.
    for (const q of ["عايز بصل وثوم", "لبن جهينة", "فول وطعمية", "بلبن وسكر"]) {
      expect(hasRedFlag(q, searchTokens)).toBe(false)
    }
  })
})
