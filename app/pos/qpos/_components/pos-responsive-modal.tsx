"use client"

import { useEffect, type ReactNode } from "react"
import { X } from "lucide-react"

interface POSResponsiveModalProps {
  open: boolean
  onClose: () => void
  title: string
  titleIcon?: ReactNode
  titleIconBg?: string
  headerBg?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
  dir?: string
}

export default function POSResponsiveModal({
  open,
  onClose,
  title,
  titleIcon,
  titleIconBg = "from-gray-500 to-gray-600",
  headerBg = "from-gray-50 to-white",
  children,
  footer,
  maxWidth = "max-w-md",
  dir,
}: POSResponsiveModalProps) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("pos-modal-open")
    } else {
      document.body.classList.remove("pos-modal-open")
    }
    return () => document.body.classList.remove("pos-modal-open")
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full md:rounded-2xl md:${maxWidth} md:shadow-2xl
          max-h-[100dvh] md:max-h-[85vh] flex flex-col
          rounded-t-2xl md:rounded-2xl
          pos-slide-up md:animate-none`}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - mobile only */}
        <div className="flex justify-center pt-2 pb-0 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className={`px-4 py-3 md:p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r ${headerBg} shrink-0 md:rounded-t-2xl`}>
          <h2 className="text-gray-800 text-base md:text-lg font-bold flex items-center gap-2">
            {titleIcon && (
              <div className={`bg-gradient-to-r ${titleIconBg} p-1.5 rounded-lg`}>
                {titleIcon}
              </div>
            )}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pos-scroll">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-gray-200 bg-white p-3 md:p-4 pos-safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
