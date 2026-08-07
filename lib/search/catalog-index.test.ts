import { describe, it, expect } from "vitest"
import { catalogQueryKey, getCatalogIndex, matchConcept, searchCatalog, storeNameOf, type CatalogProduct } from "./catalog-index"

// كتالوج مصغَّر بشكل الإنتاج: صيدلية تحتكر أغلب الأصناف بأسماء لاتينية، ومتاجر صغيرة بأسماء عربية،
// ووصف فارغ في أغلب المستندات (145 من 1689 فقط لها وصف على الإنتاج).
function catalog(): CatalogProduct[] {
  const pharmacy = [
    "PANADOL EXTRA 24 TAB",
    "PANADOL NIGHT 24 TAB",
    "CATAFLAM 50 MG 20 TAB",
    "BRUFEN 400 MG 30 TAB",
    "AUGMENTIN 625 MG 10 TAB",
  ].map((name, i) => ({
    id: `ph${i}`,
    name,
    description: "",
    category: "أدوية",
    stock: 10,
    rating: 0,
    rating_count: 0,
    store_id: "pharmacy",
    stores: { name: "صيدلية د/رامي البارودي" },
  }))

  const cleaning = [
    { id: "cl0", name: "برسيل أوتوماتيك 3 كجم", stock: 4 },
    { id: "cl1", name: "مورال ملمع اخشاب", stock: 0 },
  ].map((p) => ({
    ...p,
    description: "",
    category: "منظفات",
    rating: 4,
    rating_count: 3,
    store_id: "clean",
    stores: { name: "فاتحة خير" },
  }))

  const herbs = [
    { id: "hb0", name: "شاي أخضر ورق 100 جم", stock: 9 },
    { id: "hb1", name: "عسل نحل جبلي 1 كجم", stock: 2 },
  ].map((p) => ({
    ...p,
    description: "",
    category: "عطارة",
    rating: 5,
    rating_count: 10,
    store_id: "herbs",
    stores: { name: "عطارة الأقصي" },
  }))

  return [...pharmacy, ...cleaning, ...herbs]
}

const ids = (list: CatalogProduct[]) => list.map((p) => p.id)

describe("searchCatalog — الجسر بين أبجديتي العميل والكتالوج", () => {
  it("يجد الصنف اللاتيني بالاسم العربي (وهو 90.6% من الكتالوج الحقيقي)", () => {
    const result = searchCatalog(catalog(), "بنادول")
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].name).toContain("PANADOL")
  })

  it("يتحمّل اختلاف صور الحروف العربية", () => {
    const withHamza = ids(searchCatalog(catalog(), "أخضر"))
    const withoutHamza = ids(searchCatalog(catalog(), "اخضر"))
    expect(withHamza).toEqual(withoutHamza)
    expect(withHamza).toContain("hb0")
  })

  it("يتجاهل أداة التعريف فيطابق «الشاي» ما خُزّن «شاي»", () => {
    expect(ids(searchCatalog(catalog(), "الشاي"))).toContain("hb0")
  })

  it("يطابق الأرقام العربية-الهندية بالأرقام اللاتينية", () => {
    expect(ids(searchCatalog(catalog(), "بروفين ٤٠٠"))).toContain("ph3")
  })
})

describe("searchCatalog — الترتيب", () => {
  it("يضع المتوفّر قبل النافد", () => {
    const result = searchCatalog(catalog(), "مورال برسيل")
    // «برسيل» متوفّر (4) و«مورال» نافد (0) — المتوفّر يسبق مهما تساوت الصلة.
    expect(result[0].id).toBe("cl0")
  })

  it("لا يُرجع كل الكتالوج لكلمة فئة تغطّي أغلبه", () => {
    const all = catalog()
    const result = searchCatalog(all, "أدوية")
    expect(result.length).toBeLessThan(all.length)
  })
})

describe("searchCatalog — طبقة اسم المتجر", () => {
  it("يُرجع منتجات المتجر لمن كتب اسمه (سلوك قائم لا يجوز خسارته)", () => {
    const result = ids(searchCatalog(catalog(), "عطارة الأقصي"))
    expect(result).toContain("hb0")
    expect(result).toContain("hb1")
  })

  it("يرتّب منتجات المتجر المُلحقة بالمتوفّر أولًا", () => {
    const result = ids(searchCatalog(catalog(), "فاتحة خير"))
    expect(result.indexOf("cl0")).toBeLessThan(result.indexOf("cl1"))
  })

  it("يطابق جزءًا وسط اسم متجر موصول (سلوك includes القديم)", () => {
    const all = [
      ...catalog(),
      { id: "sm0", name: "أرز مصري 1 كجم", stock: 6, store_id: "market", stores: { name: "سوبرماركت النور" } },
    ]
    expect(ids(searchCatalog(all, "ماركت"))).toContain("sm0")
  })

  it("لا يجرّ متجرًا بجزء أقصر من الحدّ (حاجب الضجيج)", () => {
    const all = [
      ...catalog(),
      { id: "sm0", name: "أرز مصري 1 كجم", stock: 6, store_id: "market", stores: { name: "سوبرماركت النور" } },
    ]
    expect(ids(searchCatalog(all, "ركت"))).not.toContain("sm0")
  })

  // التضييق الوحيد المقصود مقابل السلوك القديم، مقيس على الإنتاج: «يد» كانت تجرّ كتالوج الصيدلية
  // كلَّه (1557 صنفًا) لأنها تقع وسط «صيدلية». حرفان لا يكفيان لإغراق العميل بمتجر.
  it("لا يجرّ كتالوج الصيدلية كلّه لاستعلام من حرفين وسط اسمها", () => {
    const result = ids(searchCatalog(catalog(), "يد"))
    expect(result).not.toContain("ph0")
  })

  it("لكن ثلاثة أحرف فأكثر تجد المتجر كما كانت", () => {
    expect(ids(searchCatalog(catalog(), "صيدلية"))).toContain("ph0")
  })

  it("لا يجرّ متجرًا كاملًا لتغطية جزئية لاسمه", () => {
    // «صيدلية» وحدها لا تغطّي «صيدلية د/رامي البارودي» تغطيةً كاملة؟ بل تغطّيها (كل كلمات الاستعلام
    // موجودة) — بينما استعلام فيه كلمة خارج الاسم يجب ألا يجرّ المتجر.
    const result = ids(searchCatalog(catalog(), "صيدلية القاهرة"))
    expect(result).not.toContain("ph0")
  })

  it("لا يعرض المنتج مرّتين إن طابق بالاسم وبالمتجر معًا", () => {
    const result = ids(searchCatalog(catalog(), "عطارة الأقصي"))
    expect(new Set(result).size).toBe(result.length)
  })
})

describe("searchCatalog — ذيل الإنقاذ (عدم خسارة نتيجة يراها المستخدم اليوم)", () => {
  // العتبة داخل المحرّك تمنع مطابقة ما دون 4 محارف وسط الكلمة — وهي حالة «سكر» المقيسة على الإنتاج.
  const withMidWord = () => [
    ...catalog(),
    { id: "mw0", name: "ماسكرا لالوريال", stock: 3, store_id: "clean", stores: { name: "فاتحة خير" } },
  ]

  it("يجد الكلمة القصيرة وسط الكلمة كما كانت includes تجدها", () => {
    expect(ids(searchCatalog(withMidWord(), "سكر"))).toContain("mw0")
  })

  it("يضعها في الذيل لا فوق تطابق الاسم الحقيقي", () => {
    const all = [
      ...withMidWord(),
      { id: "sug", name: "سكر أبيض 1 كجم", stock: 7, store_id: "clean", stores: { name: "فاتحة خير" } },
    ]
    const result = ids(searchCatalog(all, "سكر"))
    expect(result.indexOf("sug")).toBeLessThan(result.indexOf("mw0"))
  })

  it("يطابق كل كلمات الاستعلام لا أيّها", () => {
    expect(ids(searchCatalog(withMidWord(), "سكر شامبو"))).not.toContain("mw0")
  })

  it("لا يكرّر نتيجة ظهرت في المتن أو في ذيل المتجر", () => {
    const result = ids(searchCatalog(withMidWord(), "سكر"))
    expect(new Set(result).size).toBe(result.length)
  })
})

describe("matchConcept — تشديد مطابقة السلة", () => {
  // كل حالة هنا خطأ **وقع فعلًا** على كتالوج الإنتاج قبل التشديد، والسلة تشتري ما تُرجعه.
  const grocery = (): CatalogProduct[] => [
    { id: "g0", name: "ربع ملوحه منظفه حجم وسط", description: "بصل وثوم وملح", stock: 5, store_id: "s1", stores: { name: "عم ملوحة" } },
    { id: "g1", name: "خلطة هاي لوكس لتنظيف الاطباق", description: "", stock: 5, store_id: "s1", stores: { name: "فاتحة خير" } },
    { id: "g2", name: "سرنجه شراب اطفال", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    { id: "g3", name: "حفاضات بامبرز", description: "", stock: 5, store_id: "s1", stores: { name: "فاتحة خير" } },
    { id: "g4", name: "اوبال بودرة معطرة", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    { id: "g5", name: "alejon hand and nail cream", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    { id: "g6", name: "mink 250 ML BALSAM CREAM", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    { id: "g7", name: "TIBAA corn pasta", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    { id: "g8", name: "شامبو كلير", description: "", stock: 5, store_id: "s1", stores: { name: "فاتحة خير" } },
  ]
  const top = (concept: string) => matchConcept(grocery(), concept, { now: Date.now() + 200_000 }).items[0]?.id

  it("لا يقبل مطابقة الوصف وحده («بصل» ⇏ ملوحة منظفة)", () => {
    expect(top("بصل")).toBeUndefined()
  })

  it("لا يقبل بادئة من حرفين («خل» ⇏ خلطة تنظيف)", () => {
    expect(top("خل")).toBeUndefined()
  })

  it("يشترط الكلمة الحاملة لا أيّ كلمة («حفاضات أطفال» ⇏ سرنجة شراب أطفال)", () => {
    expect(top("حفاضات اطفال")).toBe("g3")
  })

  it("«لبن بودرة» لا تلتقط «بودرة معطرة»", () => {
    expect(top("لبن بودرة")).toBeUndefined()
  })

  it("«زيت جوز هند» لا تلتقط hand cream بالتقارب الصوتي", () => {
    expect(top("زيت جوز هند")).toBeUndefined()
  })

  it("يُبقي النقحرة الصحيحة للكلمة الحاملة («بلسم» ⇒ BALSAM)", () => {
    expect(top("بلسم")).toBe("g6")
  })

  it("يُبقي المرادف الصحيح («مكرونة» ⇒ pasta)", () => {
    expect(top("مكرونة")).toBe("g7")
  })

  it("يُبقي التخصيص الذي رأسه صحيح («شامبو طبيعي» ⇒ شامبو كلير)", () => {
    expect(top("شامبو طبيعي")).toBe("g8")
  })

  it("لا يقبل بادئة بعد إسقاط تخصيص («حمام كريم» ⇏ منظف الحمامات)", () => {
    const all = [
      ...grocery(),
      { id: "g9", name: "منظف الحمامات", description: "", stock: 5, store_id: "s1", stores: { name: "فاتحة خير" } },
    ]
    expect(matchConcept(all, "حمام كريم", { now: Date.now() + 400_000 }).items[0]).toBeUndefined()
  })

  it("لا يقبل مرادفًا عابرًا للّغتين بعد إسقاط تخصيص («لبن صناعي» ⇏ body milk)", () => {
    const all = [
      ...grocery(),
      { id: "ga", name: "moist body milk 300 ml", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    ]
    expect(matchConcept(all, "لبن صناعي", { now: Date.now() + 500_000 }).items[0]).toBeUndefined()
  })

  it("يقدّم المرادف المكتوب بيد على التصادف الصوتي («أيبوبروفين» ⇒ BRUFEN لا BARAFFIN)", () => {
    const all = [
      ...grocery(),
      { id: "gb", name: "BARAFFIN OIL PURE", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
      { id: "gc", name: "BRUFEN 400 MG 30 TAB", description: "", stock: 5, store_id: "s2", stores: { name: "صيدلية" } },
    ]
    expect(matchConcept(all, "ايبوبروفين", { now: Date.now() + 600_000 }).items[0]?.id).toBe("gc")
  })

  it("يحترم قصر النتائج على متجر واحد", () => {
    const inStore = matchConcept(grocery(), "حفاضات", { storeId: "s2", now: Date.now() + 300_000 })
    expect(inStore.items).toHaveLength(0)
  })

  it("يُرجع فارغًا للمفهوم الفارغ بلا رمي", () => {
    expect(matchConcept(grocery(), "   ").items).toHaveLength(0)
  })
})

describe("searchCatalog — الاستعلام الفارغ", () => {
  it("يُرجع الكتالوج كاملًا بلا ترتيب جديد", () => {
    const all = catalog()
    expect(ids(searchCatalog(all, "   "))).toEqual(ids(all))
  })

  it("لا يُرجع المرجع نفسه (فلا يعدّل المستدعي مصفوفة الكاش)", () => {
    const all = catalog()
    expect(searchCatalog(all, "")).not.toBe(all)
  })
})

describe("getCatalogIndex — الحفظ والإبطال", () => {
  it("يعيد الفهرس نفسه لنفس البيانات داخل نافذة العمر", () => {
    const all = catalog()
    const first = getCatalogIndex(all, 1_000)
    expect(getCatalogIndex(all, 30_000)).toBe(first)
  })

  it("يعيد البناء عند تغيّر الكتالوج", () => {
    const all = catalog()
    const first = getCatalogIndex(all, 1_000)
    const grown = [...all, { id: "new", name: "منتج جديد", stock: 1, store_id: "herbs" }]
    expect(getCatalogIndex(grown, 1_000)).not.toBe(first)
  })

  it("يعيد البناء بعد انتهاء العمر ولو لم تتغيّر المعرّفات", () => {
    const all = catalog()
    const first = getCatalogIndex(all, 1_000)
    expect(getCatalogIndex(all, 1_000 + 61_000)).not.toBe(first)
  })

  it("يعيد البناء فورًا عند تعديل منتج (updated_at) بلا انتظار انتهاء العمر", () => {
    const before = catalog().map((p) => ({ ...p, updated_at: "2026-08-01T00:00:00.000Z" }))
    const first = getCatalogIndex(before, 1_000)
    const renamed = before.map((p) =>
      p.id === "ph0" ? { ...p, name: "PANADOL EXTRA 24 TABLET", updated_at: "2026-08-06T10:00:00.000Z" } : p,
    )
    expect(getCatalogIndex(renamed, 1_500)).not.toBe(first)
  })

  it("يجد الاسم بعد تصحيحه مباشرةً", () => {
    const before = catalog().map((p) => ({ ...p, updated_at: "2026-08-01T00:00:00.000Z" }))
    getCatalogIndex(before, 1_000)
    const fixed = before.map((p) =>
      p.id === "cl0" ? { ...p, name: "برسيل جل أوتوماتيك", updated_at: "2026-08-06T10:00:00.000Z" } : p,
    )
    expect(ids(searchCatalog(fixed, "جل", 1_500))).toContain("cl0")
  })
})

describe("catalogQueryKey — مفتاح الكاش", () => {
  it("يوحّد الصيغ التي تُنتج النتيجة نفسها", () => {
    expect(catalogQueryKey("الشاي")).toBe(catalogQueryKey("  شاي "))
    expect(catalogQueryKey("أخضر")).toBe(catalogQueryKey("اخضر"))
  })

  it("يفرّق بين استعلامين مختلفين", () => {
    expect(catalogQueryKey("شاي")).not.toBe(catalogQueryKey("عسل"))
  })

  it("يُرجع سلسلة فارغة للاستعلام الفارغ", () => {
    expect(catalogQueryKey("   ")).toBe("")
  })
})

describe("storeNameOf", () => {
  it("يقرأ الصيغة المتداخلة والمسطَّحة معًا", () => {
    expect(storeNameOf({ id: "a", stores: { name: "متجر أ" } })).toBe("متجر أ")
    expect(storeNameOf({ id: "b", storeName: "متجر ب" })).toBe("متجر ب")
    expect(storeNameOf({ id: "c" })).toBe("")
  })
})
