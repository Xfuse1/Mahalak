import { Skeleton } from "./skeleton"
import { cn } from "@/lib/utils"

// UX-03: شبكة سكيليتون متجاوبة تطابق الشبكة الحقيقية (تمنع CLS).
const GRID = {
  product: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  store: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
} as const

function CardSkeleton({ variant }: { variant: "product" | "store" }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Skeleton className={cn("w-full rounded-none", variant === "store" ? "aspect-video" : "aspect-square")} />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-1/3 mt-1" />
      </div>
    </div>
  )
}

export function SkeletonGrid({
  count = 6,
  variant = "product",
  className,
}: {
  count?: number
  variant?: "product" | "store"
  className?: string
}) {
  return (
    <div role="status" aria-busy className={cn("grid gap-4 md:gap-6", GRID[variant], className)}>
      <span className="sr-only">جاري تحميل القائمة…</span>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
