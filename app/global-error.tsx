"use client"

import { useEffect } from "react"

// حدّ الخطأ العام (Next.js global-error): يلتقط أعطال التخطيط الجذري والمزوّدات
// (Providers) والمكوّنات العامة التي لا يستطيع app/error.tsx التقاطها. يجب أن يرندر
// <html>/<body> بنفسه ويتجنّب المزوّدات وأدوات المشروع (لأنها قد تكون سبب العطل نفسه).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // تسجيل خام بدون lib/logger (قد يكون ضمن ما تعطّل)
    console.error("[global-error]", error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#FBF8F1" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1B1B1B", margin: "0 0 0.5rem" }}>
              حدث خطأ غير متوقع
            </h1>
            <p style={{ color: "#555", margin: "0 0 1.25rem" }}>تعذّر تحميل التطبيق. حاول مرة أخرى.</p>
            <button
              onClick={() => reset()}
              style={{
                background: "#1B7A4B",
                color: "#fff",
                border: 0,
                borderRadius: "0.75rem",
                padding: "0.6rem 1.4rem",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
