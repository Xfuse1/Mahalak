import { describe, it, expect } from "vitest"
import {
  ATTRIBUTION_MAX_AGE_S,
  classifyChannel,
  mergeTouch,
  sanitizeAttribution,
  touchFromLocation,
} from "./attribution"

const NOW = Date.parse("2026-11-02T12:00:00.000Z")

describe("touchFromLocation — الالتقاط عند الهبوط", () => {
  it("يلتقط معاملات UTM و fbclid ومسار الهبوط", () => {
    const t = touchFromLocation(
      "?utm_source=Facebook&utm_medium=paid&utm_campaign=رمضان_1&fbclid=IwAR0abc_DEF-1",
      "https://l.facebook.com/",
      "/store/abc",
      "www.m7lk.com",
      NOW,
    )
    expect(t).toMatchObject({
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "رمضان_1",
      fbclid: "IwAR0abc_DEF-1",
      landing_path: "/store/abc",
      referrer_host: "l.facebook.com",
      ts: NOW,
    })
  })

  it("الزيارة المباشرة والتنقّل الداخلي لا يُنتجان لمسة (فلا يمحوان مصدرًا سابقًا)", () => {
    expect(touchFromLocation("", "", "/", "www.m7lk.com", NOW)).toBeNull()
    expect(touchFromLocation("?q=x", "https://www.m7lk.com/search", "/product/1", "www.m7lk.com", NOW)).toBeNull()
    // النطاق بلا www نفس الموقع
    expect(touchFromLocation("", "https://m7lk.com/", "/", "www.m7lk.com", NOW)).toBeNull()
  })

  it("مُحيل خارجي بلا UTM يُسجَّل كإحالة", () => {
    const t = touchFromLocation("", "https://www.google.com/", "/", "www.m7lk.com", NOW)
    expect(t).toMatchObject({ referrer_host: "www.google.com" })
    expect(classifyChannel(t!)).toBe("referral")
  })

  it("مُحيل تالف لا يُسقط الصفحة", () => {
    expect(touchFromLocation("?utm_source=x", "not a url", "/", "www.m7lk.com", NOW)).toMatchObject({ utm_source: "x" })
  })
})

describe("mergeTouch — أول لمسة ثابتة وآخر لمسة تتحدّث", () => {
  it("يحفظ الأولى ويستبدل الأخيرة", () => {
    const a = { utm_source: "facebook", ts: 1 }
    const b = { utm_source: "google", ts: 2 }
    const first = mergeTouch(null, a)
    expect(first).toEqual({ first: a, last: a })
    expect(mergeTouch(first, b)).toEqual({ first: a, last: b })
  })
})

describe("classifyChannel", () => {
  it("إعلان ميتا يحتاج مصدر ميتا + وسيط مدفوع", () => {
    expect(classifyChannel({ utm_source: "facebook", utm_medium: "paid" })).toBe("meta_ads")
    expect(classifyChannel({ utm_source: "ig", utm_medium: "cpc" })).toBe("meta_ads")
  })
  it("fbclid وحده = فيسبوك/إنستجرام لا إعلان (فيسبوك يلصقه بكل رابط خارجي)", () => {
    expect(classifyChannel({ fbclid: "abc" })).toBe("meta")
    expect(classifyChannel({ referrer_host: "l.instagram.com" })).toBe("meta")
  })
  it("جوجل والمدفوع العام والحملات", () => {
    expect(classifyChannel({ gclid: "x" })).toBe("google_ads")
    expect(classifyChannel({ utm_source: "tiktok", utm_medium: "paid" })).toBe("paid")
    expect(classifyChannel({ utm_source: "newsletter" })).toBe("utm")
  })
})

describe("sanitizeAttribution — مدخل عام قبل الكتابة في مستند الطلب", () => {
  it("يمرّر لمسة صالحة ويحسب التاريخ من ساعة السيرفر لا العميل", () => {
    const out = sanitizeAttribution(
      { utm_source: "facebook", utm_medium: "paid", utm_campaign: "c1", fbclid: "IwAR0abc", age_s: 3600, fbc: "fb.1.1730000000000.IwAR0abc", fbp: "fb.1.1730000000000.123456" },
      NOW,
    )
    expect(out).toMatchObject({
      channel: "meta_ads",
      utm_source: "facebook",
      utm_campaign: "c1",
      fbclid: "IwAR0abc",
      fbc: "fb.1.1730000000000.IwAR0abc",
      fbp: "fb.1.1730000000000.123456",
      touched_at: "2026-11-02T11:00:00.000Z",
    })
  })

  it("القناة تُعاد حسابها ولا تُقبل من العميل، والمفاتيح المجهولة تُسقط", () => {
    const out = sanitizeAttribution({ utm_source: "newsletter", channel: "meta_ads", role: "admin", total: 0, age_s: 10 }, NOW)
    expect(out?.channel).toBe("utm")
    expect(out).not.toHaveProperty("role")
    expect(out).not.toHaveProperty("total")
  })

  it("يحذف الأقواس والمحارف التحكمية ويقصّ النص الطويل", () => {
    const out = sanitizeAttribution({ utm_source: "x", utm_campaign: `<img src=x onerror=alert(1)>\u0000"'${"a".repeat(400)}`, age_s: 1 }, NOW)
    expect(out?.utm_campaign).not.toMatch(/[<>"'\u0000]/)
    expect(out!.utm_campaign!.length).toBeLessThanOrEqual(150)
  })

  it("معرّف نقر بمحارف غريبة يُسقط بدل تخزينه", () => {
    const out = sanitizeAttribution({ utm_source: "x", fbclid: "abc<script>", fbc: "a b", age_s: 1 }, NOW)
    expect(out).not.toHaveProperty("fbclid")
    expect(out).not.toHaveProperty("fbc")
  })

  it("مسار الهبوط: داخلي فقط وبلا استعلام، والمضيف بأحرف نطاق فقط", () => {
    const ok = sanitizeAttribution({ utm_source: "x", landing_path: "/store/1?utm_source=x&phone=010", referrer_host: "L.Facebook.com", age_s: 1 }, NOW)
    expect(ok?.landing_path).toBe("/store/1")
    expect(ok?.referrer_host).toBe("l.facebook.com")
    const bad = sanitizeAttribution({ utm_source: "x", landing_path: "//evil.com", referrer_host: "evil.com/<x>", age_s: 1 }, NOW)
    expect(bad).not.toHaveProperty("landing_path")
    expect(bad).not.toHaveProperty("referrer_host")
  })

  it("عمر غائب أو سالب أو أقدم من النافذة ⇒ لا نسبة", () => {
    expect(sanitizeAttribution({ utm_source: "x" }, NOW)).toBeNull()
    expect(sanitizeAttribution({ utm_source: "x", age_s: -5 }, NOW)).toBeNull()
    expect(sanitizeAttribution({ utm_source: "x", age_s: ATTRIBUTION_MAX_AGE_S + 1 }, NOW)).toBeNull()
    expect(sanitizeAttribution({ utm_source: "x", age_s: Number.NaN }, NOW)).toBeNull()
  })

  it("بلا أي إشارة مصدر ⇒ null", () => {
    expect(sanitizeAttribution({ age_s: 1, landing_path: "/" }, NOW)).toBeNull()
  })

  it("يتحمّل أي نوع غير كائن", () => {
    for (const bad of [undefined, null, "x", 1, [], true]) expect(sanitizeAttribution(bad, NOW)).toBeNull()
  })

  it("أول لمسة تُختصر لقناة/مصدر/حملة/تاريخ", () => {
    const out = sanitizeAttribution(
      { utm_source: "google", age_s: 60, first: { utm_source: "facebook", utm_medium: "paid", utm_campaign: "launch", age_s: 86400 } },
      NOW,
    )
    expect(out).toMatchObject({
      channel: "utm",
      first_channel: "meta_ads",
      first_utm_source: "facebook",
      first_utm_campaign: "launch",
      first_touched_at: "2026-11-01T12:00:00.000Z",
    })
  })
})
