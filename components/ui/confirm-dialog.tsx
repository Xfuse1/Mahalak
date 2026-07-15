"use client"

import * as React from "react"
import { createContext, useContext, useState, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────
interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "default"
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

// ─── Context ──────────────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>")
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    message: "",
    title: "تأكيد",
    confirmText: "تأكيد",
    cancelText: "إلغاء",
    variant: "default",
  })

  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      title: opts.title ?? "تأكيد",
      message: opts.message,
      confirmText: opts.confirmText ?? "تأكيد",
      cancelText: opts.cancelText ?? "إلغاء",
      variant: opts.variant ?? "default",
    })
    setOpen(true)

    return new Promise<boolean>((resolve) => {
      // نُسوّي أي مُحلِّل معلّق سابق قبل استبداله — منع تعليق await لطلب تأكيد سابق عند استدعاء متداخل
      resolveRef.current?.(false)
      resolveRef.current = resolve
    })
  }, [])

  const handleResponse = useCallback((result: boolean) => {
    setOpen(false)
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(v) => !v && handleResponse(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {options.variant === "danger" && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <DialogTitle>{options.title}</DialogTitle>
                <DialogDescription className="mt-1">
                  {options.message}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleResponse(false)}>
              {options.cancelText}
            </Button>
            <Button
              variant={options.variant === "danger" ? "destructive" : "default"}
              onClick={() => handleResponse(true)}
            >
              {options.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
