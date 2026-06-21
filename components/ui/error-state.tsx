import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

// UX-03: حالة الخطأ الموحّدة (role=alert + aria-live=polite — خطأ تحميل غير طارئ).
export function ErrorState({
  title = "حدث خطأ غير متوقع",
  description,
  onRetry,
  retryLabel = "إعادة المحاولة",
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div role="alert" aria-live="polite" className={cn("text-center py-16", className)}>
      <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-10 text-destructive" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5 gap-2">
          <RefreshCw className="size-4" aria-hidden /> {retryLabel}
        </Button>
      )}
    </div>
  )
}
