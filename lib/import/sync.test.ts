import { describe, it, expect } from "vitest"
import { computeSyncPlan, normalizeSku, type ExistingProduct } from "./sync"
import type { ProductDraft } from "./parse"

// اختصارات لبناء بيانات الاختبار.
const ex = (id: string, sku: string, stock: number, price = 10, cost = 6): ExistingProduct => ({ id, sku, stock, price, cost_price: cost })
const dr = (sku: string | undefined, stock: number, price = 10, cost = 6, name = "منتج"): ProductDraft => ({ name, price, cost_price: cost, stock, sku })

describe("normalizeSku", () => {
  it("يقصّ ويوحّد المسافات وحالة الأحرف", () => {
    expect(normalizeSku("  ABC-1  ")).toBe("abc-1")
    expect(normalizeSku("A  B")).toBe("a b")
    expect(normalizeSku(null)).toBe("")
    expect(normalizeSku(123)).toBe("123")
  })
})

describe("computeSyncPlan — المطابقة بالكود", () => {
  it("كود موجود + تغيّر المخزون ⇒ تحديث بربح صحيح", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5, 10, 6)], [dr("A1", 20, 10, 6)])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ id: "p1", stock: 20, price: 10, cost_price: 6, profit_per_unit: 4 })
    expect(plan.creates).toHaveLength(0)
    expect(plan.zeroIds).toHaveLength(0)
  })

  it("كود موجود بلا أي تغيير ⇒ لا كتابة (matchedUnchanged)", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 20, 10, 6)], [dr("A1", 20, 10, 6)])
    expect(plan.updates).toHaveLength(0)
    expect(plan.matchedUnchanged).toBe(1)
  })

  it("تغيّر السعر فقط ⇒ تحديث (overwrite سعر الكاشير)", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 20, 10, 6)], [dr("A1", 20, 12, 6)])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ price: 12, cost_price: 6, profit_per_unit: 6 })
  })

  it("تغيّر التكلفة فقط ⇒ تحديث", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 20, 10, 6)], [dr("A1", 20, 10, 7)])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ cost_price: 7, profit_per_unit: 3 })
  })

  it("المطابقة تتجاهل المسافات وحالة الأحرف في الكود", () => {
    const plan = computeSyncPlan([ex("p1", " a1 ", 5)], [dr("A1", 9)])
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0].stock).toBe(9)
    expect(plan.creates).toHaveLength(0)
  })
})

describe("computeSyncPlan — الأصناف الجديدة والمفقودة", () => {
  it("كود جديد ⇒ إضافة", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5)], [dr("A1", 5), dr("NEW", 3)])
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].sku).toBe("NEW")
  })

  it("كود موجود ومش في الملف ومخزونه > 0 ⇒ تصفير", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5), ex("p2", "GONE", 8)], [dr("A1", 5)])
    expect(plan.zeroIds).toEqual(["p2"])
  })

  it("كود مفقود لكن مخزونه أصلاً صفر ⇒ لا تصفير (لا كتابة عبثية)", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5), ex("p2", "GONE", 0)], [dr("A1", 5)])
    expect(plan.zeroIds).toHaveLength(0)
  })

  it("منتج موجود بلا كود (يدوي) ⇒ لا يُطابَق ولا يُصفَّر أبدًا", () => {
    const plan = computeSyncPlan([ex("manual", "", 7)], [dr("A1", 5)])
    expect(plan.zeroIds).toHaveLength(0)
    expect(plan.updates).toHaveLength(0)
    expect(plan.creates).toHaveLength(1) // A1 جديد
  })

  it("صف الملف بلا كود ⇒ يُتجاهَل (لا يُضاف كي لا يتكرّر)", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5)], [dr("A1", 5), dr(undefined, 3), dr("", 2)])
    expect(plan.noSku).toBe(2)
    expect(plan.creates).toHaveLength(0)
  })
})

describe("computeSyncPlan — احترام الحقول التي يوفّرها الملف", () => {
  it("بلا عمود تكلفة ⇒ نُبقي التكلفة القديمة (لا نمحو الهامش) ونعيد حساب الربح من السعر الجديد", () => {
    // السعر اتغيّر 10→12، الملف مافيهوش تكلفة ⇒ التكلفة تفضل 6، الربح 12−6=6.
    const plan = computeSyncPlan([ex("p1", "A1", 20, 10, 6)], [dr("A1", 20, 12, 12)], { hasStock: true, hasCost: false })
    expect(plan.updates[0].cost_price).toBe(6)
    expect(plan.updates[0].profit_per_unit).toBe(6)
  })

  it("بلا عمود تكلفة والتكلفة القديمة أعلى من السعر الجديد ⇒ تُقصّ للسعر (ربح 0، لا سالب)", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 20, 10, 8)], [dr("A1", 20, 5, 5)], { hasStock: true, hasCost: false })
    expect(plan.updates[0].cost_price).toBe(5)
    expect(plan.updates[0].profit_per_unit).toBe(0)
  })

  it("بلا عمود مخزون ⇒ لا نحدّث المخزون (نُبقي القديم) ولا نصفّر أي غائب", () => {
    const existing = [ex("p1", "A1", 7, 10, 6), ex("gone", "GONE", 9)]
    // الملف قيمة مخزونه 0 (لأن لا عمود مخزون) لكن hasStock=false ⇒ نتجاهلها.
    const plan = computeSyncPlan(existing, [dr("A1", 0, 12, 6)], { hasStock: false, hasCost: true })
    expect(plan.updates[0].stock).toBe(7) // القديم محفوظ
    expect(plan.updates[0].price).toBe(12) // السعر اتحدّث
    expect(plan.zeroIds).toHaveLength(0) // مافيش تصفير بلا عمود مخزون
  })
})

describe("computeSyncPlan — مزامنة تاريخ الصلاحية", () => {
  const exE = (id: string, sku: string, expiry?: string): ExistingProduct => ({ id, sku, stock: 5, price: 10, cost_price: 6, expiry })
  const drE = (sku: string, expiry?: string): ProductDraft => ({ name: "x", price: 10, cost_price: 6, stock: 5, sku, expiry })
  const withExp = { hasStock: true, hasCost: true, hasExpiry: true }

  it("عمود صلاحية + تاريخ جديد مختلف ⇒ تحديث يحمل الصلاحية الجديدة", () => {
    const plan = computeSyncPlan([exE("p1", "A1", "2026-01-01")], [drE("A1", "2027-06-30")], withExp)
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0].expiry).toBe("2027-06-30")
  })

  it("نفس الصلاحية بلا تغيير آخر ⇒ لا تحديث", () => {
    const plan = computeSyncPlan([exE("p1", "A1", "2027-06-30")], [drE("A1", "2027-06-30")], withExp)
    expect(plan.updates).toHaveLength(0)
    expect(plan.matchedUnchanged).toBe(1)
  })

  it("بلا عمود صلاحية ⇒ لا نلمس الصلاحية (expiry غير موجود في التحديث)", () => {
    const plan = computeSyncPlan([exE("p1", "A1", "2027-06-30")], [{ ...drE("A1"), stock: 9 }], { hasStock: true, hasCost: true, hasExpiry: false })
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0].expiry).toBeUndefined()
  })

  it("عمود صلاحية لكن خلية الصنف فاضية ⇒ لا نمحو الصلاحية القديمة", () => {
    const plan = computeSyncPlan([exE("p1", "A1", "2027-06-30")], [drE("A1")], withExp)
    expect(plan.updates).toHaveLength(0)
    expect(plan.matchedUnchanged).toBe(1)
  })
})

describe("computeSyncPlan — حالات حدّية", () => {
  it("كود مكرّر داخل الملف ⇒ يفوز الأخير + يُعدّ التكرار", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5)], [dr("A1", 3), dr("A1", 9)])
    expect(plan.dupSkuInFile).toBe(1)
    expect(plan.updates[0].stock).toBe(9) // الأخير
  })

  it("التكلفة أعلى من السعر في الملف ⇒ تُقصّ للسعر", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5, 10, 6)], [dr("A1", 5, 10, 20)])
    expect(plan.updates[0].cost_price).toBe(10)
    expect(plan.updates[0].profit_per_unit).toBe(0)
  })

  it("مخزون كسري في الملف ⇒ يُدوّر لعدد صحيح غير سالب", () => {
    const plan = computeSyncPlan([ex("p1", "A1", 5)], [dr("A1", 3.6)])
    expect(plan.updates[0].stock).toBe(4)
  })

  it("سيناريو مركّب: تحديث + جديد + تصفير + بلا-كود + مكرّر معًا", () => {
    const existing = [ex("u", "A1", 5, 10, 6), ex("z", "GONE", 8), ex("same", "A2", 20, 10, 6), ex("man", "", 3)]
    const drafts = [dr("A1", 12, 10, 6), dr("A2", 20, 10, 6), dr("NEW1", 4), dr(undefined, 1), dr("NEW1", 9)]
    const plan = computeSyncPlan(existing, drafts)
    expect(plan.updates.map((u) => u.id)).toEqual(["u"]) // A1 اتغيّر، A2 زيّه
    expect(plan.matchedUnchanged).toBe(1) // A2
    expect(plan.zeroIds).toEqual(["z"]) // GONE
    expect(plan.creates.map((c) => c.sku)).toEqual(["NEW1"]) // مرة واحدة (الأخير)
    expect(plan.creates[0].stock).toBe(9)
    expect(plan.noSku).toBe(1)
    expect(plan.dupSkuInFile).toBe(1)
    // المنتج اليدوي "man" لم يُلمَس: لا في updates ولا zeroIds ولا creates.
    expect([...plan.updates.map((u) => u.id), ...plan.zeroIds]).not.toContain("man")
  })
})
