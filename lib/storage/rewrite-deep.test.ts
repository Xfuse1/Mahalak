import { describe, expect, it, vi } from "vitest"
import { rewriteDeep } from "./rewrite-deep"

const REF = "https://fbbepyrrhvhewygqfrgi.supabase.co/storage/v1/object/public/product-images"
const url = (p: string) => `${REF}/${p}`

describe("rewriteDeep — البنى الحقيقية من قاعدة البيانات", () => {
  it("products/{id}.image_url — حقل مسطّح", () => {
    const r = rewriteDeep({ name: "شاي", image_url: url("products/abc/x.jpg"), price: 25 })
    expect(r.hits).toBe(1)
    expect(r.value).toEqual({ name: "شاي", image_url: "products/abc/x.jpg", price: 25 })
  })

  it("users/{id}.store.image_url — متداخل داخل كائن", () => {
    const r = rewriteDeep({ role: "seller", store: { name: "م", image_url: url("stores/u/l.jpeg") } })
    expect(r.hits).toBe(1)
    expect((r.value as any).store.image_url).toBe("stores/u/l.jpeg")
    expect((r.value as any).role).toBe("seller")
  })

  // الحالة التي تفوّتها قائمة الحقول الثابتة بصمت
  it("pos_sales.items[].image_url — داخل مصفوفة", () => {
    const r = rewriteDeep({
      total: 100,
      items: [
        { name: "أ", image_url: url("products/s/a.jpg"), qty: 1 },
        { name: "ب", image_url: url("products/s/b.jpg"), qty: 2 },
        { name: "ج", image_url: null },
      ],
    })
    expect(r.hits).toBe(2)
    expect((r.value as any).items[0].image_url).toBe("products/s/a.jpg")
    expect((r.value as any).items[1].image_url).toBe("products/s/b.jpg")
    expect((r.value as any).items[2].image_url).toBeNull()
    expect((r.value as any).total).toBe(100)
  })

  it("orders.pickup_stops[].items[].image_url — مصفوفة داخل مصفوفة", () => {
    const r = rewriteDeep({
      pickup_stops: [
        { store_id: "s1", items: [{ image_url: url("products/s1/a.jpg") }, { image_url: url("products/s1/b.jpg") }] },
        { store_id: "s2", items: [{ image_url: url("products/s2/c.jpg") }] },
      ],
    })
    expect(r.hits).toBe(3)
    expect((r.value as any).pickup_stops[0].items[0].image_url).toBe("products/s1/a.jpg")
    expect((r.value as any).pickup_stops[1].items[0].image_url).toBe("products/s2/c.jpg")
    expect((r.value as any).pickup_stops[1].store_id).toBe("s2")
  })

  it("يبلّغ عن مسار الحقل الصحيح لكل إصابة", () => {
    const onHit = vi.fn()
    rewriteDeep({ items: [{ image_url: url("products/a/b.jpg") }], store: { image_url: url("stores/x/y.jpg") } }, onHit)
    expect(onHit).toHaveBeenCalledTimes(2)
    expect(onHit.mock.calls.map((c) => c[0]).sort()).toEqual(["items[].image_url", "store.image_url"])
  })
})

describe("rewriteDeep — لا يلمس ما لا يخصّه", () => {
  it("مستند بلا أي رابط ⇒ صفر إصابات و**نفس المرجع**", () => {
    const doc = { name: "x", nested: { a: [1, 2, { b: "c" }] } }
    const r = rewriteDeep(doc)
    expect(r.hits).toBe(0)
    expect(r.value).toBe(doc) // نفس الكائن، لا نسخة — "لا تغيير" تعني حرفيًا لا تغيير
  })

  it("يمرّر القيم غير المطابقة كما هي", () => {
    const doc = {
      already: "products/a/b.jpg",
      cdn: "https://cdn.m7lk.com/products/a/b.jpg",
      other: "https://evil.com/storage/v1/object/public/product-images/a/b.jpg",
      data: "data:image/png;base64,AA==",
      local: "/placeholder.svg",
    }
    const r = rewriteDeep(doc)
    expect(r.hits).toBe(0)
    expect(r.value).toBe(doc)
  })

  it("لا يسحب رابطًا من bucket خاص إلى حقل (حارس الـbucket)", () => {
    const kyc = "https://x.supabase.co/storage/v1/object/public/kyc-documents/stores/a/id-card-front/x.jpg"
    const r = rewriteDeep({ idCardImageUrl: kyc })
    expect(r.hits).toBe(0)
    expect((r.value as any).idCardImageUrl).toBe(kyc)
  })
})

describe("rewriteDeep — سلامة أنواع Firestore (إفساد المستندات)", () => {
  // تفكيك Timestamp إلى {_seconds,_nanoseconds} يُتلف المستند عند set()
  class Timestamp {
    constructor(public _seconds: number, public _nanoseconds: number) {}
  }
  class GeoPoint {
    constructor(public _latitude: number, public _longitude: number) {}
  }
  class DocumentReference {
    constructor(public path: string) {}
  }

  it("لا يفكّك Timestamp/GeoPoint/DocumentReference", () => {
    const ts = new Timestamp(1700000000, 0)
    const gp = new GeoPoint(26.3, 31.8)
    const ref = new DocumentReference("users/abc")
    const r = rewriteDeep({ created_at: ts, loc: gp, owner: ref, image_url: url("products/a/b.jpg") })
    expect(r.hits).toBe(1)
    expect((r.value as any).created_at).toBe(ts) // نفس النسخة، لا كائن عادي
    expect((r.value as any).loc).toBe(gp)
    expect((r.value as any).owner).toBe(ref)
    expect((r.value as any).image_url).toBe("products/a/b.jpg")
  })

  it("يُبقي Date كما هي", () => {
    const d = new Date("2026-01-01")
    const r = rewriteDeep({ when: d, image_url: url("products/a/b.jpg") })
    expect((r.value as any).when).toBe(d)
  })
})

describe("rewriteDeep — التماثل (إعادة التشغيل آمنة)", () => {
  it("تشغيله مرتين = تشغيله مرة", () => {
    const doc = { image_url: url("products/a/b.jpg"), items: [{ image_url: url("products/c/d.jpg") }] }
    const once = rewriteDeep(doc)
    expect(once.hits).toBe(2)
    const twice = rewriteDeep(once.value)
    expect(twice.hits).toBe(0)
    expect(twice.value).toEqual(once.value)
  })
})

describe("rewriteDeep — حالات حدّية", () => {
  it("يتعامل مع null/undefined/الأوّليات", () => {
    expect(rewriteDeep(null)).toEqual({ value: null, hits: 0 })
    expect(rewriteDeep(undefined)).toEqual({ value: undefined, hits: 0 })
    expect(rewriteDeep(42)).toEqual({ value: 42, hits: 0 })
    expect(rewriteDeep(true)).toEqual({ value: true, hits: 0 })
  })

  it("مصفوفة فارغة / كائن فارغ", () => {
    const a: unknown[] = []
    const o = {}
    expect(rewriteDeep(a).value).toBe(a)
    expect(rewriteDeep(o).value).toBe(o)
  })

  it("رابط في الجذر مباشرة (لا حقل)", () => {
    const r = rewriteDeep(url("products/a/b.jpg"))
    expect(r).toEqual({ value: "products/a/b.jpg", hits: 1 })
  })
})
