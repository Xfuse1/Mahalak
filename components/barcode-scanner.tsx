"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, X, Zap, RotateCcw } from "lucide-react"

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState("")
  const [isStarting, setIsStarting] = useState(true)
  const [lastScanned, setLastScanned] = useState("")
  const scannerRef = useRef<any>(null)
  const readerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let html5QrCode: any = null

    const startScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import("html5-qrcode")
        
        html5QrCode = new Html5Qrcode("barcode-reader")
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 280, height: 160 },
            aspectRatio: 1.5,
          },
          (decodedText: string) => {
            // Avoid duplicate scans
            if (decodedText !== lastScanned) {
              setLastScanned(decodedText)
              onScan(decodedText)
            }
          },
          () => {
            // Ignore scan errors (no code found in frame)
          }
        )
        
        setIsStarting(false)
      } catch (err: any) {
        console.error("[BarcodeScanner] Error:", err)
        setIsStarting(false)
        
        if (err?.toString?.()?.includes("NotAllowedError")) {
          setError("لم يتم السماح بالوصول للكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.")
        } else if (err?.toString?.()?.includes("NotFoundError")) {
          setError("لم يتم العثور على كاميرا. تأكد من توصيل الكاميرا.")
        } else {
          setError("فشل في تشغيل الكاميرا. تأكد من أن الموقع يعمل على HTTPS.")
        }
      }
    }

    startScanner()

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
    } catch {
      // Ignore
    }
    onClose()
  }

  const handleRetry = async () => {
    setError("")
    setIsStarting(true)
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop()
      }
    } catch {
      // Ignore
    }
    
    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const html5QrCode = new Html5Qrcode("barcode-reader")
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.5,
        },
        (decodedText: string) => {
          if (decodedText !== lastScanned) {
            setLastScanned(decodedText)
            onScan(decodedText)
          }
        },
        () => {}
      )
      setIsStarting(false)
    } catch (err: any) {
      setIsStarting(false)
      setError("فشل في تشغيل الكاميرا")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" dir="rtl">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
          <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-1.5 rounded-lg">
              <Camera className="h-4 w-4 text-white" />
            </div>
            مسح الباركود
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          {isStarting && !error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600 font-medium">جاري تشغيل الكاميرا...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Camera className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-red-600 text-center font-medium mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition"
              >
                <RotateCcw className="h-4 w-4" />
                إعادة المحاولة
              </button>
            </div>
          )}

          <div
            id="barcode-reader"
            ref={readerRef}
            className={`w-full rounded-xl overflow-hidden ${error ? "hidden" : ""}`}
          />

          {!isStarting && !error && (
            <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600">
              <Zap className="h-4 w-4 animate-pulse" />
              <p className="text-sm font-medium">وجّه الكاميرا نحو الباركود</p>
            </div>
          )}

          {lastScanned && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">آخر باركود:</p>
              <p className="text-emerald-700 font-bold font-mono text-lg">{lastScanned}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-medium transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
