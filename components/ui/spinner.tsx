import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// UX-03: المؤشر الدوّار الموحّد — يستبدل كل border-blue / Loader2 العشوائي.
// role=status + aria-busy، نص sr-only افتراضي، motion-reduce.
const sizes = { sm: "size-4", md: "size-6", lg: "size-10" } as const

export function Spinner({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}) {
  return (
    <span role="status" aria-busy className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin motion-reduce:animate-none text-primary", sizes[size])} aria-hidden />
      {label ? (
        <span className="text-sm text-muted-foreground">{label}</span>
      ) : (
        <span className="sr-only">جاري التحميل</span>
      )}
    </span>
  )
}
