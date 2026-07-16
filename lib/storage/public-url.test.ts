import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

// القاعدة تُقرأ وقت تحميل الوحدة، لذا نعيد الاستيراد بعد ضبط البيئة.
async function load(base?: string) {
  vi.resetModules()
  if (base === undefined) delete process.env.NEXT_PUBLIC_R2_PUBLIC_BASE
  else process.env.NEXT_PUBLIC_R2_PUBLIC_BASE = base
  return import("./public-url")
}

const ORIGINAL = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_R2_PUBLIC_BASE
  else process.env.NEXT_PUBLIC_R2_PUBLIC_BASE = ORIGINAL
})

describe("storageUrl — القاعدة مضبوطة", () => {
  let m: Awaited<ReturnType<typeof load>>
  beforeEach(async () => {
    m = await load("https://cdn.m7lk.com")
  })

  it("يركّب المسار على القاعدة", () => {
    expect(m.storageUrl("products/abc/x.jpg")).toBe("https://cdn.m7lk.com/products/abc/x.jpg")
  })

  it("لا يُنتج شرطة مزدوجة مهما كان شكل المدخل", () => {
    expect(m.storageUrl("/products/abc/x.jpg")).toBe("/products/abc/x.jpg") // مسار محلي مطلق = تمرير
    expect(m.storageUrl("products//abc.jpg")).toBe("https://cdn.m7lk.com/products//abc.jpg")
  })

  // الخاصية #1: التوافق الرجعي — روابط Supabase القديمة يجب أن تبقى تعمل للأبد
  it("يمرّر روابط Supabase المطلقة القديمة كما هي", () => {
    const legacy = "https://fbbepyrrhvhewygqfrgi.supabase.co/storage/v1/object/public/product-images/products/a/b.jpg"
    expect(m.storageUrl(legacy)).toBe(legacy)
  })

  it("يمرّر أي رابط مطلق (http/https) كما هو", () => {
    expect(m.storageUrl("http://example.com/a.png")).toBe("http://example.com/a.png")
    expect(m.storageUrl("HTTPS://EXAMPLE.COM/a.png")).toBe("HTTPS://EXAMPLE.COM/a.png")
  })

  // الخاصية #2: معاينات الرفع تمرّ من نفس الدالة — تركيبها يُفسدها
  it("يمرّر data: و blob: (معاينات الرفع) كما هي", () => {
    expect(m.storageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=")
    expect(m.storageUrl("blob:https://m7lk.com/9c8f-4a")).toBe("blob:https://m7lk.com/9c8f-4a")
  })

  // الخاصية #3: الأصول المحلية
  it("يمرّر الأصول المحلية المطلقة كما هي", () => {
    expect(m.storageUrl("/placeholder.svg")).toBe("/placeholder.svg")
  })

  // الخاصية #4: آمن للتطبيق في طبقتين (قراءة + عرض)
  it("متماثل — تطبيقه مرتين = تطبيقه مرة", () => {
    const once = m.storageUrl("products/abc/x.jpg")!
    expect(m.storageUrl(once)).toBe(once)
    const legacy = "https://x.supabase.co/storage/v1/object/public/product-images/p/a.jpg"
    expect(m.storageUrl(m.storageUrl(legacy))).toBe(legacy)
  })

  it("يتعامل مع الفارغ/غير النصّي بأمان", () => {
    expect(m.storageUrl(null)).toBeNull()
    expect(m.storageUrl(undefined)).toBeNull()
    expect(m.storageUrl("")).toBeNull()
    expect(m.storageUrl("   ")).toBeNull()
    expect(m.storageUrl(123 as unknown as string)).toBeNull()
  })

  it("يزيل الشرطة الزائدة من القاعدة", async () => {
    const t = await load("https://cdn.m7lk.com/")
    expect(t.storageUrl("a/b.jpg")).toBe("https://cdn.m7lk.com/a/b.jpg")
  })
})

describe("storageUrl — القاعدة غير مضبوطة (قبل تفعيل R2)", () => {
  it("يمرّر الروابط المطلقة كما هي — الموقع الحالي يعمل بلا أي إعداد", async () => {
    const m = await load(undefined)
    const legacy = "https://fbbepyrrhvhewygqfrgi.supabase.co/storage/v1/object/public/product-images/p/a.jpg"
    expect(m.storageUrl(legacy)).toBe(legacy)
    expect(m.storageUrl("/placeholder.svg")).toBe("/placeholder.svg")
    expect(m.storageUrl("data:image/png;base64,AA==")).toBe("data:image/png;base64,AA==")
  })

  it("يعيد null للمسار المجرّد بدل رابط مكسور مثل 'undefined/x.jpg'", async () => {
    const m = await load(undefined)
    expect(m.storageUrl("products/abc/x.jpg")).toBeNull()
    expect(m.imgSrc("products/abc/x.jpg")).toBe("/placeholder.svg")
  })
})

describe("imgSrc", () => {
  it("يعيد الصورة البديلة عند الفراغ", async () => {
    const m = await load("https://cdn.m7lk.com")
    expect(m.imgSrc(null)).toBe("/placeholder.svg")
    expect(m.imgSrc("")).toBe("/placeholder.svg")
    expect(m.imgSrc(undefined, "/x.png")).toBe("/x.png")
  })

  it("يعيد الرابط المُركَّب عند وجود مسار", async () => {
    const m = await load("https://cdn.m7lk.com")
    expect(m.imgSrc("products/a/b.jpg")).toBe("https://cdn.m7lk.com/products/a/b.jpg")
  })
})
