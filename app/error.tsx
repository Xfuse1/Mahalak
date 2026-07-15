"use client"

import { useEffect } from "react"
import { ErrorState } from "@/components/ui/error-state"
import { logError } from "@/lib/logger"

// UX-03: حدّ خطأ على مستوى الصفحات (Next.js error boundary) — يلتقط أخطاء رندر الصفحات.
// أعطال التخطيط الجذري/المزوّدات يلتقطها app/global-error.tsx.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logError("[route-error]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <ErrorState
        title="حدث خطأ"
        description="تعذّر تحميل الصفحة. حاول مرة أخرى."
        onRetry={reset}
      />
    </div>
  )
}
