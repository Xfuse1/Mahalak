"use client"

import { useEffect } from "react"
import { ErrorState } from "@/components/ui/error-state"
import { logError } from "@/lib/logger"

// UX-03: حدّ الخطأ الجذري (Next.js error boundary) — يغطّي كل المسارات افتراضيًا.
export default function GlobalError({
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
