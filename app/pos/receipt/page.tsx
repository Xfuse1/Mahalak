"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { getPOSSaleById, type POSReceiptData } from "@/lib/actions/pos"

type Language = "ar" | "en"

function resolveLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  if (normalized.startsWith("ar")) return "ar"
  if (normalized.startsWith("en")) return "en"
  return null
}

function ReceiptContent() {
  const searchParams = useSearchParams()
  const saleId = searchParams.get("id")
  const langParam = searchParams.get("lang")

  const [language, setLanguage] = useState<Language>("ar")
  const [receiptData, setReceiptData] = useState<POSReceiptData | null>(null)
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(true)

  useEffect(() => {
    const queryLanguage = resolveLanguage(langParam)
    if (queryLanguage) {
      setLanguage(queryLanguage)
      return
    }

    const browserLanguage = resolveLanguage(typeof navigator !== "undefined" ? navigator.language : null)
    if (browserLanguage) {
      setLanguage(browserLanguage)
    }
  }, [langParam])

  useEffect(() => {
    let active = true

    async function loadReceipt() {
      if (!saleId) {
        if (active) {
          setReceiptData(null)
          setIsLoadingReceipt(false)
        }
        return
      }

      setIsLoadingReceipt(true)
      try {
        const data = await getPOSSaleById(saleId)
        if (active) {
          setReceiptData(data)
        }
      } catch {
        if (active) {
          setReceiptData(null)
        }
      } finally {
        if (active) {
          setIsLoadingReceipt(false)
        }
      }
    }

    loadReceipt()
    return () => {
      active = false
    }
  }, [saleId])

  const t = (ar: string, en: string) => (language === "ar" ? ar : en)
  const pageDir = language === "ar" ? "rtl" : "ltr"
  const locale = language === "ar" ? "ar-EG" : "en-US"
  const currencyLabel = t("جنيه", "EGP")

  if (isLoadingReceipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{t("جاري تحميل الفاتورة...", "Loading receipt...")}</p>
        </div>
      </div>
    )
  }

  if (!saleId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-500 text-lg">{t("لا توجد بيانات فاتورة", "No receipt data found")}</p>
        </div>
      </div>
    )
  }

  if (!receiptData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-500 text-lg">{t("خطأ في بيانات الفاتورة", "Invalid receipt data")}</p>
        </div>
      </div>
    )
  }

  const {
    store,
    address,
    phone,
    sale_number,
    date,
    items,
    subtotal,
    discount,
    total,
    payment_method,
    amount_paid,
    change,
  } = receiptData

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4" dir={pageDir}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-6 text-center">
          <h1 className="text-2xl font-bold mb-1">{store}</h1>
          {address && <p className="text-emerald-100 text-sm">{address}</p>}
          {phone && <p className="text-emerald-100 text-sm">{phone}</p>}
        </div>

        <div className="p-5">
          <div className="flex justify-between items-center mb-4 text-sm text-gray-500">
            <span>{new Date(date).toLocaleString(locale, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="font-mono font-bold text-gray-700">#{sale_number}</span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-sm">{t("المنتجات", "Products")}</h3>
            {items.map((item, i: number) => (
              <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-gray-800 font-medium text-sm">{item.name}</p>
                  <p className="text-gray-500 text-xs">
                    {item.qty} × {Number(item.price).toFixed(2)} {currencyLabel}
                  </p>
                </div>
                <span className="font-bold text-gray-800 text-sm">
                  {Number(item.total).toFixed(2)} {currencyLabel}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 my-4" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{t("المجموع الفرعي", "Subtotal")}</span>
              <span>{Number(subtotal).toFixed(2)} {currencyLabel}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>{t("الخصم", "Discount")}</span>
                <span>-{Number(discount).toFixed(2)} {currencyLabel}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-emerald-600 pt-2 border-t border-gray-200">
              <span>{t("الإجمالي", "Total")}</span>
              <span>{Number(total).toFixed(2)} {currencyLabel}</span>
            </div>
            {payment_method === "cash" && (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{t("المدفوع", "Paid")}</span>
                  <span>{Number(amount_paid).toFixed(2)} {currencyLabel}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{t("الباقي", "Change")}</span>
                  <span>{Number(change).toFixed(2)} {currencyLabel}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200 my-4" />

          <div className="text-center">
            <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
              {payment_method === "cash"
                ? `💵 ${t("نقدي", "Cash")}`
                : payment_method === "card"
                  ? `💳 ${t("بطاقة", "Card")}`
                  : `👛 ${t("محفظة", "Wallet")}`}
            </span>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">{t("شكراً لتسوقكم معنا", "Thank you for shopping with us")} 🙏</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">جاري تحميل الفاتورة... / Loading receipt...</p>
        </div>
      </div>
    }>
      <ReceiptContent />
    </Suspense>
  )
}
