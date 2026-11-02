// المتصفح المدمج داخل تطبيقات ميتا (فيسبوك / إنستجرام / ماسنجر) — اللي بيفتح فيه كل من يضغط إعلانًا.
//
// المشكلة العملية الوحيدة المؤكَّدة فيه عندنا: تسجيل الدخول بجوجل. جوجل تمنع OAuth داخل الـ WebView
// المدمج (سياسة «Use secure browsers»، خطأ 403 disallowed_useragent)، ونحن نستعمل signInWithPopup.
// الدخول بالإيميل/الموبايل وكلمة السر والتحقق بالـ OTP لا يتأثرون.

export type InAppBrowser = "facebook" | "instagram" | "messenger"

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const ua = userAgent || ""
  if (/Instagram/i.test(ua)) return "instagram"
  if (/MessengerForiOS|MessengerLiteForiOS|\bOrca-Android\b|FB_IAB\/MESSENGER/i.test(ua)) return "messenger"
  if (/FBAN\/|FBAV\/|FB_IAB|FBIOS|FB4A|\[FB/i.test(ua)) return "facebook"
  return null
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent || "")
}

/**
 * رابط يفتح نفس الصفحة في Chrome على أندرويد (intent://). على iOS لا توجد طريقة موثوقة من الصفحة
 * نفسها، فالواجهة تشرح الخطوة يدويًا (⋯ ثم «فتح في المتصفح»).
 */
export function androidChromeIntentUrl(href: string): string | null {
  try {
    const url = new URL(href)
    if (url.protocol !== "https:") return null
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`
  } catch {
    return null
  }
}
