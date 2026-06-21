"use client"

import type React from "react"
import { Upload, Camera, X } from "lucide-react"

interface UploadDialogProps {
  t: (ar: string, en: string) => string
  open: boolean
  onOpenChange: (open: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  cameraInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadDialog({ t, open, onOpenChange, fileInputRef, cameraInputRef, onFileChange }: UploadDialogProps) {
  if (!open) return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={onFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        className="hidden"
      />
    </>
  )

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center sm:p-4"
        onClick={() => onOpenChange(false)}
      >
        <div
          className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle - mobile */}
          <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-800">
              {t("اختر طريقة الرفع", "Choose Upload Method")}
            </h3>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 pb-6">
            <label className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/10 transition-all cursor-pointer active:scale-95">
              <Upload className="h-9 w-9 text-primary" />
              <span className="text-sm font-medium text-gray-700 text-center">{t("رفع صورة", "Upload Image")}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={(e) => {
                  onFileChange(e)
                  onOpenChange(false)
                }}
                className="hidden"
              />
            </label>
            <label className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 hover:border-primary hover:bg-primary/10 transition-all cursor-pointer active:scale-95">
              <Camera className="h-9 w-9 text-primary" />
              <span className="text-sm font-medium text-gray-700 text-center">{t("فتح الكاميرا", "Open Camera")}</span>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  onFileChange(e)
                  onOpenChange(false)
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </>
  )
}
