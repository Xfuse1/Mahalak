import { describe, it, expect } from "vitest"
import { haversineKm, formatDistanceAr, storeDistanceKm, withinKm } from "./geo"

// سوهاج ≈ (26.5569, 31.6948) وأسيوط ≈ (27.1809, 31.1837) — المسافة الحقيقية ≈ 85 كم.
const SOHAG = { lat: 26.5569, lng: 31.6948 }
const ASSIUT = { latitude: 27.1809, longitude: 31.1837 }

describe("haversineKm", () => {
  it("نفس النقطة ⇒ صفر", () => {
    expect(haversineKm(26.5, 31.7, 26.5, 31.7)).toBe(0)
  })
  it("سوهاج → أسيوط ≈ 85 كم", () => {
    const km = haversineKm(SOHAG.lat, SOHAG.lng, ASSIUT.latitude, ASSIUT.longitude)
    expect(km).toBeGreaterThan(80)
    expect(km).toBeLessThan(90)
  })
})

describe("formatDistanceAr", () => {
  it("أقل من كيلومتر ⇒ أمتار", () => {
    expect(formatDistanceAr(0.4)).toBe("400 م")
  })
  it("أقل من 10 كم ⇒ منزلة عشرية", () => {
    expect(formatDistanceAr(3.25)).toBe("3.3 كم")
  })
  it("10 كم فأكثر ⇒ رقم صحيح", () => {
    expect(formatDistanceAr(85.4)).toBe("85 كم")
  })
  it("قيمة غير محدودة ⇒ نص فارغ", () => {
    expect(formatDistanceAr(NaN)).toBe("")
  })
})

describe("storeDistanceKm", () => {
  it("بلا موقع مستخدم ⇒ null", () => {
    expect(storeDistanceKm(null, ASSIUT)).toBeNull()
  })
  it("متجر بلا إحداثيات ⇒ null", () => {
    expect(storeDistanceKm(SOHAG, { latitude: null, longitude: null })).toBeNull()
  })
})

describe("withinKm (فلتر نصف القطر)", () => {
  it("نصف قطر غير مفعَّل ⇒ يمرّ الجميع حتى بلا إحداثيات", () => {
    expect(withinKm(null, { latitude: null, longitude: null }, null)).toBe(true)
    expect(withinKm(SOHAG, { latitude: null, longitude: null }, 0)).toBe(true)
  })
  it("داخل النطاق ⇒ true", () => {
    expect(withinKm(SOHAG, ASSIUT, 100)).toBe(true)
  })
  it("خارج النطاق ⇒ false", () => {
    expect(withinKm(SOHAG, ASSIUT, 50)).toBe(false)
  })
  it("مسافة مجهولة مع نصف قطر مفعَّل ⇒ false (لا نَعِد بما لا نعرفه)", () => {
    expect(withinKm(SOHAG, { latitude: null, longitude: null }, 10)).toBe(false)
    expect(withinKm(null, ASSIUT, 10)).toBe(false)
  })
})
