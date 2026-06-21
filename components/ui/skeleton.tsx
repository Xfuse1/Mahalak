import { cn } from "@/lib/utils"

// UX-03: اللبنة الأساسية للسكيليتون — تستبدل كل animate-pulse المرتجل.
// زخرفة بحتة: aria-hidden ثابت، motion-reduce لإيقاف الحركة، bg-muted فقط (لا ألوان خام).
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-muted", className)} />
}
