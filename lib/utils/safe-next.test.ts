import { describe, it, expect } from "vitest"
import { safeNextPath } from "./safe-next"
import { androidChromeIntentUrl, detectInAppBrowser } from "./in-app-browser"

describe("safeNextPath — العودة بعد الدخول بلا إعادة توجيه مفتوحة", () => {
  it("يقبل المسارات الداخلية مع الاستعلام", () => {
    expect(safeNextPath("/product/abc")).toBe("/product/abc")
    expect(safeNextPath("/checkout?mode=buynow")).toBe("/checkout?mode=buynow")
    expect(safeNextPath("/search?q=%D8%B4%D8%A7%D9%8A")).toBe("/search?q=%D8%B4%D8%A7%D9%8A")
  })

  it("يرفض أي شيء يخرج من الموقع", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\t/evil.com",
      "javascript:alert(1)",
      "evil.com",
      " //evil.com",
      "/a\\b",
      "",
      "/" + "a".repeat(600),
    ]) {
      expect(safeNextPath(bad)).toBeNull()
    }
  })

  it("يرفض صفحات الدخول نفسها (حلقة)", () => {
    expect(safeNextPath("/auth")).toBeNull()
    expect(safeNextPath("/auth?next=/x")).toBeNull()
    expect(safeNextPath("/auth/register")).toBeNull()
  })

  it("يتحمّل الأنواع غير النصّية", () => {
    for (const bad of [undefined, null, 1, {}, []]) expect(safeNextPath(bad)).toBeNull()
  })
})

describe("detectInAppBrowser — متصفح فيسبوك/إنستجرام المدمج", () => {
  it("يكتشف فيسبوك على أندرويد و iOS", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/486.0.0.66.70;]",
      ),
    ).toBe("facebook")
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/482.0.0.40.108;FBBV/650000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBCR/;FBID/phone;FBLC/ar_AR;FBOP/5]",
      ),
    ).toBe("facebook")
  })

  it("يكتشف إنستجرام", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 12; Redmi Note 11 Build/SKQ1.211103.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 Instagram 349.0.0.39.106 Android",
      ),
    ).toBe("instagram")
  })

  it("لا يخلط المتصفحات العادية", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36")).toBeNull()
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1")).toBeNull()
    expect(detectInAppBrowser("")).toBeNull()
  })

  it("رابط Chrome على أندرويد يحفظ المسار والاستعلام وله رابط بديل", () => {
    const url = androidChromeIntentUrl("https://www.m7lk.com/product/abc?utm_source=facebook")
    expect(url).toBe(
      "intent://www.m7lk.com/product/abc?utm_source=facebook#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fwww.m7lk.com%2Fproduct%2Fabc%3Futm_source%3Dfacebook;end",
    )
    expect(androidChromeIntentUrl("http://x.com")).toBeNull()
  })
})
