"use client"

import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Upload, Camera } from "lucide-react"

interface UploadDialogProps {
  t: (ar: string, en: string) => string
  open: boolean
  onOpenChange: (open: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  cameraInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadDialog({ t, open, onOpenChange, fileInputRef, cameraInputRef, onFileChange }: UploadDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              {t("اختر طريقة الرفع", "Choose Upload Method")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-4">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setTimeout(() => fileInputRef.current?.click(), 100)
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
            >
              <Upload className="h-10 w-10 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">{t("رفع صورة", "Upload Image")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                setTimeout(() => cameraInputRef.current?.click(), 100)
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
            >
              <Camera className="h-10 w-10 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">{t("فتح الكاميرا", "Open Camera")}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs for upload/camera */}
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
}
