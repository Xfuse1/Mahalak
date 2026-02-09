"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ReceiptContent() {
  const searchParams = useSearchParams()
  const dataParam = searchParams.get("data")

  if (!dataParam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-gray-500 text-lg">لا توجد بيانات فاتورة</p>
          <p className="text-gray-400 text-sm mt-2">No receipt data found</p>
        </div>
      </div>
    )
  }

  let receiptData: any = null
  try {
    receiptData = JSON.parse(decodeURIComponent(escape(atob(dataParam))))
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-500 text-lg">خطأ في بيانات الفاتورة</p>
          <p className="text-gray-400 text-sm mt-2">Invalid receipt data</p>
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-6 text-center">
          <h1 className="text-2xl font-bold mb-1">{store}</h1>
          {address && <p className="text-emerald-100 text-sm">{address}</p>}
          {phone && <p className="text-emerald-100 text-sm">{phone}</p>}
        </div>

        {/* Receipt Info */}
        <div className="p-5">
          <div className="flex justify-between items-center mb-4 text-sm text-gray-500">
            <span>{new Date(date).toLocaleDateString("ar-SA", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="font-mono font-bold text-gray-700">#{sale_number}</span>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-sm">المنتجات</h3>
            {items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                <div className="flex-1">
                  <p className="text-gray-800 font-medium text-sm">{item.name}</p>
                  <p className="text-gray-500 text-xs">
                    {item.qty} × {Number(item.price).toFixed(2)} ر.س
                  </p>
                </div>
                <span className="font-bold text-gray-800 text-sm">
                  {Number(item.total).toFixed(2)} ر.س
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 my-4" />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>المجموع الفرعي</span>
              <span>{Number(subtotal).toFixed(2)} ر.س</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>الخصم</span>
                <span>-{Number(discount).toFixed(2)} ر.س</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-emerald-600 pt-2 border-t border-gray-200">
              <span>الإجمالي</span>
              <span>{Number(total).toFixed(2)} ر.س</span>
            </div>
            {payment_method === "cash" && (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>المدفوع</span>
                  <span>{Number(amount_paid).toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>الباقي</span>
                  <span>{Number(change).toFixed(2)} ر.س</span>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-dashed border-gray-200 my-4" />

          {/* Payment Method */}
          <div className="text-center">
            <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full">
              {payment_method === "cash" ? "💵 نقدي" : payment_method === "card" ? "💳 بطاقة" : "👛 محفظة"}
            </span>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">شكراً لتسوقكم معنا 🙏</p>
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
          <p className="text-gray-500">جاري تحميل الفاتورة...</p>
        </div>
      </div>
    }>
      <ReceiptContent />
    </Suspense>
  )
}
