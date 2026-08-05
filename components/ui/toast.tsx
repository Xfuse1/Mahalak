"use client"

import * as React from "react"
import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
  }
}

// ─── Context ──────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>")
  return ctx.toast
}

// ─── Individual Toast ─────────────────────────────────────────────
const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-primary shrink-0" />,
  error: <XCircle className="w-5 h-5 text-destructive shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
}

const bgMap: Record<ToastType, string> = {
  success: "border-primary/20 bg-primary/10",
  error: "border-destructive/20 bg-destructive/10",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/60",
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }, [toast.id, onDismiss])

  useEffect(() => {
    const dur = toast.duration ?? 4000
    timerRef.current = setTimeout(dismiss, dur)
    return () => clearTimeout(timerRef.current)
  }, [dismiss, toast.duration])

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300",
        bgMap[toast.type],
        isExiting
          ? "animate-out fade-out-0 slide-out-to-top-2"
          : "animate-in fade-in-0 slide-in-from-top-5"
      )}
      role="alert"
    >
      {iconMap[toast.type]}
      <p className="flex-1 text-sm font-medium text-foreground leading-relaxed">{toast.message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    // حدّ أقصى 3 toasts معروضة لتفادي الفيضان (مثل البحث الحيّ المتكرر)
    setToasts((prev) => [...prev, { id, message, type }].slice(-3))
  }, [])

  const toast = React.useMemo(
    () => ({
      success: (msg: string) => addToast("success", msg),
      error: (msg: string) => addToast("error", msg),
      warning: (msg: string) => addToast("warning", msg),
      info: (msg: string) => addToast("info", msg),
    }),
    [addToast]
  )

  // قيمة السياق مثبّتة المرجع: كانت كائنًا جديدًا مع كل إظهار/إخفاء toast، وتغيّر قيمة السياق
  // يتجاوز React.memo فيُعيد رسم كل مستهلك — وشبكات المنتجات صارت تستهلكه في كل بطاقة.
  const contextValue = React.useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container — fixed at top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full px-4">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
