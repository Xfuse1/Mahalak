import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "./button"
import { cn } from "@/lib/utils"

// UX-03: حالة الفراغ الموحّدة (role=status — الفراغ ليس خطأ).
interface Action {
  label: string
  onClick?: () => void
  href?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: Action
  className?: string
}) {
  return (
    <div role="status" className={cn("text-center py-16", className)}>
      <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-muted">
        <Icon className="size-10 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  )
}
