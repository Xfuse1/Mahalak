// مسار «ارجع لهنا بعد الدخول» (?next=) — يأتي من عنوان الصفحة، أي من أي رابط يصنعه أي أحد.
// نقبل مسارًا داخليًا فقط: يبدأ بـ "/" وحدها. "//evil.com" و "/\evil.com" يفسّرهما المتصفح كمضيف
// خارجي (إعادة توجيه مفتوحة)، و "https:" أو "javascript:" بلا "/" في أوله يُرفضان تلقائيًا.
export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value.startsWith("/") || value.length > 500) return null
  if (value.startsWith("//") || value.startsWith("/\\")) return null
  // محارف تحكّم/مسافات داخل المسار تُستغل لخداع المحلّل (مثل "/\t/evil.com")
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x21 || code === 0x7f || ch === "\\") return null
  }
  // لا نعيد المستخدم لصفحات الدخول نفسها (حلقة)
  if (value === "/auth" || value.startsWith("/auth?") || value.startsWith("/auth/")) return null
  return value
}

/** مسار الصفحة الحالية (مع الاستعلام) لإلحاقه بـ /auth?next= — في المتصفح فقط. */
export function currentPathForNext(): string {
  if (typeof window === "undefined") return "/"
  return `${window.location.pathname}${window.location.search}`
}

/** رابط صفحة الدخول مع العودة للصفحة الحالية (أو لمسار محدَّد). */
export function authHrefWithNext(next?: string): string {
  const target = safeNextPath(next ?? currentPathForNext())
  return target && target !== "/" ? `/auth?next=${encodeURIComponent(target)}` : "/auth"
}

/** يقرأ ?next= من عنوان الصفحة الحالية بأمان (بلا useSearchParams الذي يُلزم بـ Suspense). */
export function readNextParam(): string | null {
  if (typeof window === "undefined") return null
  try {
    return safeNextPath(new URLSearchParams(window.location.search).get("next"))
  } catch {
    return null
  }
}
