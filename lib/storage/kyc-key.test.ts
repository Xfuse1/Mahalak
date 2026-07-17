import { describe, expect, it } from "vitest"
import { isKycKey } from "./kyc-key"

describe("isKycKey — يقبل مفاتيح KYC الحقيقية", () => {
  // منسوخة من مسح Firestore/التخزين الفعلي
  it("registrations/<id>/<doc>/<file>", () => {
    expect(isKycKey("registrations/temp-1772018812606-f9zdqq239z7/id-card-front/uugj2oj3ulo-1772018733854.jpeg")).toBe(true)
    expect(isKycKey("registrations/temp-x/commercial-register/qsib7lla6e-1772018737239.jpeg")).toBe(true)
  })
  it("stores/<id>/<doc>/<file> (الشكل القديم)", () => {
    expect(isKycKey("stores/temp-1773435080449-n3gdue3o4oe/id-card-back/g5c2bvxvseo-1773435288084.jpg")).toBe(true)
  })
  it("كل البادئات الخمس", () => {
    for (const seg of ["id-card-front", "id-card-back", "commercial-register", "tax-card-front", "tax-card-back"]) {
      expect(isKycKey(`registrations/r/${seg}/a-1.jpg`)).toBe(true)
    }
  })
  it("كل الامتدادات المدعومة", () => {
    for (const ext of ["jpg", "jpeg", "png", "gif", "webp", "JPG", "JPEG"]) {
      expect(isKycKey(`registrations/r/id-card-front/a-1.${ext}`)).toBe(true)
    }
  })
})

describe("isKycKey — يرفض (تقليص أوراكل التوقيع)", () => {
  it("الشعار العام — لا يُوقَّع أبدًا", () => {
    expect(isKycKey("registrations/r/logo/a-1.jpg")).toBe(false)
    expect(isKycKey("stores/uid/rlaznjnpig-1783869778074.jpeg")).toBe(false) // شعار متجر
  })
  it("صورة منتج (كائن عام في bucket آخر)", () => {
    expect(isKycKey("products/uid/a-1.jpg")).toBe(false)
  })
  it("اجتياز المسار", () => {
    expect(isKycKey("registrations/../secrets/id-card-front/a.jpg")).toBe(false)
    expect(isKycKey("registrations/r/id-card-front/../../x.jpg")).toBe(false)
    expect(isKycKey("/etc/passwd")).toBe(false)
  })
  it("بادئة غير معروفة", () => {
    expect(isKycKey("kyc-documents/r/id-card-front/a.jpg")).toBe(false)
    expect(isKycKey("random/r/id-card-front/a.jpg")).toBe(false)
  })
  it("segment مستند مزيّف", () => {
    expect(isKycKey("registrations/r/passwords/a.jpg")).toBe(false)
    expect(isKycKey("registrations/r/id-card-front-fake/a.jpg")).toBe(false)
  })
  it("امتداد غير صورة", () => {
    expect(isKycKey("registrations/r/id-card-front/a.txt")).toBe(false)
    expect(isKycKey("registrations/r/id-card-front/a.svg")).toBe(false)
  })
  it("روابط مطلقة (تُعالَج بمسار آخر في signKycFields)", () => {
    expect(isKycKey("https://x.supabase.co/storage/v1/object/public/product-images/stores/r/id-card-front/a.jpg")).toBe(false)
    expect(isKycKey("https://cdn.m7lk.com/registrations/r/id-card-front/a.jpg")).toBe(false)
  })
  it("قيم فارغة/غير نصّية", () => {
    for (const v of [null, undefined, "", "  ", 42, {}, []]) expect(isKycKey(v)).toBe(false)
  })
  it("مستوى عمق ناقص أو زائد", () => {
    expect(isKycKey("registrations/id-card-front/a.jpg")).toBe(false) // ناقص <id>
    expect(isKycKey("registrations/r/x/id-card-front/a.jpg")).toBe(false) // زائد
  })
  it("مسافات/شرائح فارغة", () => {
    expect(isKycKey("registrations/ /id-card-front/a.jpg")).toBe(false)
    expect(isKycKey("registrations//id-card-front/a.jpg")).toBe(false)
  })
})
