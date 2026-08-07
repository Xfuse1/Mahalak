import { describe, it, expect, beforeEach } from "vitest"
import { useCartStore, type CartBulkInput } from "./cart-store"

// `persist` يكتب في localStorage وهي غائبة في بيئة node — نُركّب أدنى ما يكفي قبل أول استخدام
// للمتجر، وإلا سقط الاختبار على تفصيل تخزين لا يخصّ المنطق المُختبَر.
const memory = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage

const item = (over: Partial<CartBulkInput> & { id: string }): CartBulkInput => ({
  name: "منتج",
  price: 10,
  stock: 5,
  ...over,
})

describe("addItems — الإضافة الجماعية (سلة الوصفة)", () => {
  beforeEach(() => {
    useCartStore.getState().clear()
  })

  it("يضيف الكمية المطلوبة لا قطعة واحدة", () => {
    useCartStore.getState().addItems([item({ id: "a", quantity: 3 })])
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it("يجمع تكرار الصنف داخل نفس الدفعة بلا تجاوز المخزون", () => {
    const out = useCartStore.getState().addItems([
      item({ id: "a", quantity: 3, stock: 4 }),
      item({ id: "a", quantity: 3, stock: 4 }),
    ])
    expect(useCartStore.getState().items[0].quantity).toBe(4)
    expect(out.partial).toContain("a")
  })

  it("يرفض الصنف النافد ويُبقي الباقي", () => {
    const out = useCartStore.getState().addItems([item({ id: "a", stock: 0 }), item({ id: "b", stock: 2 })])
    expect(out.rejected).toEqual(["a"])
    expect(useCartStore.getState().items.map((i) => i.id)).toEqual(["b"])
  })

  it("يميّز «لم يُضَف» عن «أُضيف أقلّ من المطلوب»", () => {
    const out = useCartStore.getState().addItems([item({ id: "a", quantity: 9, stock: 2 })])
    expect(out.rejected).toEqual([])
    expect(out.partial).toEqual(["a"])
    expect(useCartStore.getState().items[0].quantity).toBe(2)
  })

  it("لا يكرّر المعرّف في قائمة المرفوض", () => {
    const out = useCartStore.getState().addItems([item({ id: "a", stock: 0 }), item({ id: "a", stock: 0 })])
    expect(out.rejected).toEqual(["a"])
  })

  it("يراكم على صنف موجود في السلة حتى سقف المخزون", () => {
    useCartStore.getState().addItems([item({ id: "a", quantity: 2, stock: 5 })])
    useCartStore.getState().addItems([item({ id: "a", quantity: 2, stock: 5 })])
    expect(useCartStore.getState().items[0].quantity).toBe(4)
  })
})

describe("addItems — تحصين المخزون والكمية", () => {
  beforeEach(() => {
    useCartStore.getState().clear()
  })

  it("لا يُنتج كمية NaN من مخزون غير رقمي", () => {
    const out = useCartStore.getState().addItems([
      item({ id: "a", quantity: 2, stock: "abc" as unknown as number }),
    ])
    expect(out.rejected).toEqual(["a"])
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it("لا يُصفّر مخزون صنف موجود حين تصل دفعة بلا حقل مخزون", () => {
    useCartStore.getState().addItems([item({ id: "a", quantity: 1, stock: 5 })])
    useCartStore.getState().addItems([{ id: "a", name: "منتج", price: 10, stock: undefined as unknown as number }])
    const stored = useCartStore.getState().items[0]
    expect(stored.stock).toBe(5)
    expect(stored.quantity).toBe(2)
  })

  it("يرفض صنفًا جديدًا مخزونه مجهول (فشل مقفول)", () => {
    const out = useCartStore.getState().addItems([
      { id: "z", name: "منتج", price: 10, stock: undefined as unknown as number },
    ])
    expect(out.rejected).toEqual(["z"])
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it("يعالج الكمية الفاسدة ككمية 1 لا كـNaN", () => {
    useCartStore.getState().addItems([item({ id: "a", quantity: -4 }), item({ id: "b", quantity: 2.7 })])
    const items = useCartStore.getState().items
    expect(items.find((i) => i.id === "a")!.quantity).toBe(1)
    expect(items.find((i) => i.id === "b")!.quantity).toBe(2)
  })

  it("يتجاهل مُدخَلًا بلا معرّف بدل أن يسقط", () => {
    const out = useCartStore.getState().addItems([
      { id: "", name: "بلا معرّف", price: 1, stock: 5 },
      item({ id: "a" }),
    ])
    expect(out.rejected).toEqual([])
    expect(useCartStore.getState().items.map((i) => i.id)).toEqual(["a"])
  })

  it("يحفظ كل حقول الصنف (لا يفقد المتجر ولا الصورة ولا الخصم)", () => {
    useCartStore.getState().addItems([
      item({ id: "a", quantity: 2, store_id: "s1", store_name: "متجر", image_url: "k/1.jpg", discount_percentage: 20 }),
    ])
    expect(useCartStore.getState().items[0]).toMatchObject({
      id: "a",
      store_id: "s1",
      store_name: "متجر",
      image_url: "k/1.jpg",
      discount_percentage: 20,
      quantity: 2,
    })
  })

  it("لا يُسرّب حقل quantity الخام من المُدخَل", () => {
    useCartStore.getState().addItems([item({ id: "a", quantity: 3, stock: 10 })])
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })
})
