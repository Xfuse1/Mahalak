import { describe, expect, it } from "vitest"
import { legacyUrlToKey, parseLegacySupabaseUrl } from "./legacy-url"

const REF = "https://fbbepyrrhvhewygqfrgi.supabase.co/storage/v1/object/public"

describe("parseLegacySupabaseUrl — الأشكال الحقيقية من قاعدة البيانات", () => {
  // العيّنات الثلاث أدناه منسوخة حرفيًا من مسح Firestore الفعلي (البادئات الثلاث الموجودة)
  it("products/", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/products/hhVQBACF5fQ0Zmx8uogdwtLy0312/urpzd6fbkal-1773190744341.jpg`))
      .toEqual({ bucket: "product-images", key: "products/hhVQBACF5fQ0Zmx8uogdwtLy0312/urpzd6fbkal-1773190744341.jpg" })
  })

  it("stores/", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/stores/07AU5CKrleOscvm76pIiqqOYXvF3/rlaznjnpig-1783869778074.jpeg`))
      .toEqual({ bucket: "product-images", key: "stores/07AU5CKrleOscvm76pIiqqOYXvF3/rlaznjnpig-1783869778074.jpeg" })
  })

  it("registrations/ (البادئة الثالثة التي كادت تفوت)", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/registrations/temp-1782207581236-tglsjc6o3m/logo/6zifxr9i4i-1782207581876.jpeg`))
      .toEqual({ bucket: "product-images", key: "registrations/temp-1782207581236-tglsjc6o3m/logo/6zifxr9i4i-1782207581876.jpeg" })
  })

  it("مسار متعدد المستويات (KYC داخل مجلد فرعي)", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/stores/temp-x/id-card-front/a.jpeg`))
      .toEqual({ bucket: "product-images", key: "stores/temp-x/id-card-front/a.jpeg" })
  })
})

describe("parseLegacySupabaseUrl — التنظيف", () => {
  it("يزيل رمز الكاش (query)", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/products/a/b.jpg?t=1699999`)?.key).toBe("products/a/b.jpg")
  })

  it("يزيل الـhash", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/products/a/b.jpg#frag`)?.key).toBe("products/a/b.jpg")
  })

  it("يفكّ ترميز النسبة المئوية", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/products/a/my%20file.jpg`)?.key).toBe("products/a/my file.jpg")
    expect(parseLegacySupabaseUrl(`${REF}/product-images/products/a/%D8%B5%D9%88%D8%B1%D8%A9.jpg`)?.key).toBe("products/a/صورة.jpg")
  })

  it("يتحمّل مسافات محيطة", () => {
    expect(parseLegacySupabaseUrl(`  ${REF}/product-images/products/a/b.jpg  `)?.key).toBe("products/a/b.jpg")
  })

  it("يقبل أي مرجع مشروع (لا نثبّت المرجع الحالي)", () => {
    expect(parseLegacySupabaseUrl("https://someotherref.supabase.co/storage/v1/object/public/product-images/p/a.jpg")?.key)
      .toBe("p/a.jpg")
  })
})

describe("parseLegacySupabaseUrl — يجب أن يرفض (الفشل الآمن = لا تلمس)", () => {
  it("قيم فارغة/غير نصّية", () => {
    for (const v of [null, undefined, "", "   ", 42, {}, []]) expect(parseLegacySupabaseUrl(v)).toBeNull()
  })

  it("مسار مجرّد (مُرحَّل بالفعل — التماثل يمنع الترحيل المزدوج)", () => {
    expect(parseLegacySupabaseUrl("products/a/b.jpg")).toBeNull()
  })

  it("رابط R2/CDN جديد", () => {
    expect(parseLegacySupabaseUrl("https://cdn.m7lk.com/products/a/b.jpg")).toBeNull()
  })

  it("رابط موقّع (خاص) — ليس /public/", () => {
    expect(parseLegacySupabaseUrl(`https://x.supabase.co/storage/v1/object/sign/kyc-documents/a.jpg?token=ey`)).toBeNull()
  })

  it("مضيف غير supabase.co حتى لو المسار مطابق", () => {
    expect(parseLegacySupabaseUrl("https://evil.com/storage/v1/object/public/product-images/a/b.jpg")).toBeNull()
  })

  it("مضيف يتظاهر بأنه supabase (نطاق فرعي مزيّف)", () => {
    expect(parseLegacySupabaseUrl("https://x.supabase.co.evil.com/storage/v1/object/public/product-images/a/b.jpg")).toBeNull()
  })

  it("رابط بلا مفتاح بعد الـbucket", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/`)).toBeNull()
    expect(parseLegacySupabaseUrl(`${REF}/product-images`)).toBeNull()
  })

  it("data:/blob:/أصل محلي", () => {
    expect(parseLegacySupabaseUrl("data:image/png;base64,AA==")).toBeNull()
    expect(parseLegacySupabaseUrl("blob:https://m7lk.com/9c8f")).toBeNull()
    expect(parseLegacySupabaseUrl("/placeholder.svg")).toBeNull()
  })

  it("اجتياز المسار مرفوض", () => {
    expect(parseLegacySupabaseUrl(`${REF}/product-images/../../etc/passwd`)).toBeNull()
    expect(parseLegacySupabaseUrl(`${REF}/product-images/a/../../../x.jpg`)).toBeNull()
  })
})

describe("legacyUrlToKey — حارس الـbucket", () => {
  it("يعيد المفتاح من الـbucket المتوقَّع", () => {
    expect(legacyUrlToKey(`${REF}/product-images/products/a/b.jpg`)).toBe("products/a/b.jpg")
  })

  // الحارس الحاسم: منع سحب كائن خاص إلى حقل عام
  it("يرفض رابطًا من bucket آخر (لا نسحب KYC إلى حقل عام)", () => {
    expect(legacyUrlToKey(`${REF}/kyc-documents/stores/x/id-card-front/a.jpg`)).toBeNull()
    expect(legacyUrlToKey(`${REF}/kyc-documents/stores/x/a.jpg`, "product-images")).toBeNull()
  })

  it("يقبل bucket مختلفًا عند طلبه صراحةً", () => {
    expect(legacyUrlToKey(`${REF}/kyc-documents/stores/x/a.jpg`, "kyc-documents")).toBe("stores/x/a.jpg")
  })
})
