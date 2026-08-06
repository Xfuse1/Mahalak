import { describe, it, expect } from "vitest"
import { buildStoreIndex, searchStore, ENOUGH_RESULTS, type SearchableProduct } from "./engine"

// كتالوج مصغَّر يحاكي شكل الصيدلية الحقيقية: أسماء لاتينية مستورَدة من كاشير، فئة واحدة تغطّي
// شبه كل الأصناف، وتقييمات صفرية (كل صنف مستورَد يبدأ بلا تقييم).
function pharmacy(): SearchableProduct[] {
  const drugs = [
    "Panadol( extra 48) tab D",
    "Panadol Acute Head Cold",
    "PANADOL NIGHT 24 TAB",
    "CATAFLAM   25   MG  20 TAB",
    "CATAFLAM 20 TAB ( 50 MG ) D",
    "AUGMENTIN (625 MG) 10 TAB",
    "BRUFEN   400  MG  30 TAB",
    "ADOL 500 GM 24 CAPS d",
    "ANTINAL  200MG 5ML 60ML-SUSP",
    "FLAGYL  (20 TAB) 500 MG  D",
  ].map((name, i) => ({
    id: `d${i}`,
    name,
    description: "",
    category: "أدوية",
    stock: 10,
    rating: 0,
    rating_count: 0,
  }))
  const hair = ["Pantene shampoo 400 ml", "Head and Shoulders 200 ml"].map((name, i) => ({
    id: `h${i}`,
    name,
    description: "",
    category: "العناية بالشعر",
    stock: 10,
    rating: 0,
    rating_count: 0,
  }))
  return [...drugs, ...hair]
}

const nameOf = (products: SearchableProduct[], id: string) => products.find((p) => p.id === id)!.name

describe("searchStore — الترتيب بالصلة", () => {
  it("يضع تطابق الاسم فوق تطابق الوصف", () => {
    const products: SearchableProduct[] = [
      { id: "a", name: "شامبو للشعر", description: "يحتوي على بنادول", category: "عناية", stock: 5 },
      { id: "b", name: "بنادول اكسترا", description: "", category: "عناية", stock: 5 },
    ]
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.ids[0]).toBe("b")
  })

  it("يضع المتوفّر فوق النافد مهما بلغت صلة النافد", () => {
    const products: SearchableProduct[] = [
      { id: "out", name: "بنادول", description: "", category: "ادويه", stock: 0 },
      { id: "in", name: "بنادول اكسترا 24 قرص", description: "", category: "ادويه", stock: 3 },
    ]
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.ids[0]).toBe("in")
  })

  it("يرجّح الكلمة الكاملة على جزء داخل كلمة", () => {
    const products: SearchableProduct[] = [
      { id: "sub", name: "سوبربنادولين", description: "", category: "ادويه", stock: 5 },
      { id: "word", name: "بنادول اكسترا", description: "", category: "ادويه", stock: 5 },
    ]
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.ids[0]).toBe("word")
  })

  it("الترتيب مستقرّ: نداءان متتاليان يعطيان الترتيب نفسه", () => {
    const products = pharmacy()
    const index = buildStoreIndex(products)
    expect(searchStore(index, "tab").ids).toEqual(searchStore(index, "tab").ids)
  })
})

describe("searchStore — تسمّم الفئة", () => {
  it("كلمة الفئة التي تغطّي أغلب الكتالوج لا تُرجع الكتالوج كله", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "أدوية")
    expect(result.ids.length).toBe(0)
  })

  it("وبدلًا من ذلك يقترح الفئة كتبويب", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "أدوية")
    expect(result.categorySuggestion).toBe("أدوية")
  })

  it("الفئة الصغيرة تبقى قابلة للبحث بشكل طبيعي", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "العناية بالشعر")
    expect(result.ids.length).toBe(2)
    expect(result.tier).toBe("exact")
  })
})

describe("searchStore — الطبقة الصوتية (عربي ⇄ لاتيني)", () => {
  // أسماء الكاشير مكتوبة بحالات مختلطة (Panadol / PANADOL / claritine) فالمقارنة بلا حالة أحرف.
  const firstName = (products: SearchableProduct[], query: string) =>
    nameOf(products, searchStore(buildStoreIndex(products), query).ids[0]).toLowerCase()

  it("«بنادول» تجد المنتج المخزَّن باسم لاتيني", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.tier).toBe("phonetic")
    expect(result.ids.length).toBe(3)
    expect(firstName(products, "بنادول")).toContain("panadol")
  })

  it("«كتافلام» و«اوجمنتين» و«بروفين» كذلك", () => {
    const products = pharmacy()
    expect(firstName(products, "كتافلام")).toContain("cataflam")
    expect(firstName(products, "اوجمنتين")).toContain("augmentin")
    expect(firstName(products, "بروفين")).toContain("brufen")
  })

  it("المطابقة النصّية الدقيقة تسبق الصوتية دائمًا", () => {
    const products: SearchableProduct[] = [
      { id: "phon", name: "Banadoul cream", description: "", category: "ادويه", stock: 5 },
      { id: "exact", name: "بنادول", description: "", category: "ادويه", stock: 5 },
    ]
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.ids[0]).toBe("exact")
  })
})

describe("searchStore — جدول الأسماء البديلة", () => {
  const expand = (token: string) => (token === "ادول" ? ["adol"] : [])

  it("يجد الصنف الذي عجز عنه المفتاح الصوتي (اسم قصير)", () => {
    const products = pharmacy()
    const index = buildStoreIndex(products)
    expect(searchStore(index, "ادول").ids.length).toBe(0)
    const withAlias = searchStore(index, "ادول", { expand })
    expect(nameOf(products, withAlias.ids[0])).toContain("ADOL")
    expect(withAlias.tier).toBe("alias")
  })

  it("التوسيع لا يتحوّل إلى OR فضفاض: كل كلمة أو أحد مرادفاتها يجب أن تطابق", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "ادول زيرتك", { expand })
    expect(result.ids.length).toBe(0)
  })
})

describe("searchStore — سُلَّم الإرخاء", () => {
  it("يُسقط الكلمة العامّة ويُعلن أيّها أسقط", () => {
    const products: SearchableProduct[] = [
      { id: "a", name: "بنادول اكسترا", description: "", category: "ادويه", stock: 5 },
    ]
    const result = searchStore(buildStoreIndex(products), "برشام بنادول")
    expect(result.ids).toEqual(["a"])
    expect(result.droppedToken).toBe("برشام")
  })

  it("استعلام لا يطابق شيئًا يبقى فارغًا ولا يخترع نتائج", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "زعتر بلدي مطحون")
    expect(result.ids).toEqual([])
    expect(result.tier).toBe("empty")
  })
})

describe("searchStore — السلوك الأساسي", () => {
  it("استعلام فارغ يُرجع كل المنتجات بترتيبها الأصلي", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "   ")
    expect(result.tier).toBe("all")
    expect(result.ids).toEqual(products.map((p) => p.id))
  })

  it("فلتر الفئة يحصر النتائج داخلها", () => {
    const products = pharmacy()
    const result = searchStore(buildStoreIndex(products), "", { category: "العناية بالشعر" })
    expect(result.ids).toEqual(["h0", "h1"])
  })

  it("الفواصل غير المسافة لا تُفشل الاستعلام", () => {
    const products = pharmacy()
    const index = buildStoreIndex(products)
    expect(searchStore(index, "panadol,extra").ids.length).toBeGreaterThan(0)
    expect(searchStore(index, "cataflam-25").ids.length).toBeGreaterThan(0)
  })

  it("الرقم الملتصق بالوحدة يطابق المكتوب بمسافة", () => {
    const products = pharmacy()
    // المخزَّن «ANTINAL  200MG 5ML» — والعميل يكتب الوحدة منفصلة
    const result = searchStore(buildStoreIndex(products), "antinal 200 mg")
    expect(result.ids.length).toBeGreaterThan(0)
  })

  it("يبحث في المادة الفعّالة والباركود", () => {
    const products: SearchableProduct[] = [
      {
        id: "x",
        name: "Panadol Extra",
        description: "",
        category: "ادويه",
        stock: 5,
        active_ingredient: "باراسيتامول",
        barcode: "6221048001234",
      },
    ]
    const index = buildStoreIndex(products)
    expect(searchStore(index, "باراسيتامول").ids).toEqual(["x"])
    expect(searchStore(index, "6221048001234").ids).toEqual(["x"])
  })

  it("يتوقّف عند امتلاء الصفحة الأولى فلا ينزل لطبقة أضعف", () => {
    const products: SearchableProduct[] = Array.from({ length: ENOUGH_RESULTS + 5 }, (_, i) => ({
      id: `p${i}`,
      name: `بنادول ${i}`,
      description: "",
      category: "ادويه",
      stock: 5,
    }))
    const result = searchStore(buildStoreIndex(products), "بنادول")
    expect(result.tier).toBe("exact")
  })
})
