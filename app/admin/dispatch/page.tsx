"use client"

import { useEffect, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { getDispatchMonitor, type DispatchMonitorOrder, type DispatchMonitorDriver } from "@/lib/actions/admin"

const DispatchMonitorMap = dynamic(
  () => import("@/components/dispatch-monitor-map").then((m) => m.DispatchMonitorMap),
  { ssr: false, loading: () => <div className="w-full h-[360px] rounded-xl bg-gray-100 animate-pulse" /> },
)

const STATUS_AR: Record<string, string> = { offering: "معروض", accepted: "مقبول", on_the_way: "في الطريق" }
const STATUS_COLOR: Record<string, string> = {
  offering: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  on_the_way: "bg-emerald-100 text-emerald-700",
}

export default function AdminDispatchPage() {
  const [orders, setOrders] = useState<DispatchMonitorOrder[]>([])
  const [drivers, setDrivers] = useState<DispatchMonitorDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string>("")

  const load = useCallback(async () => {
    const res = await getDispatchMonitor()
    if (res.ok) {
      setOrders(res.orders || [])
      setDrivers(res.drivers || [])
      setUpdatedAt(new Date().toLocaleTimeString("ar-EG"))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000) // تحديث كل 15ث
    return () => clearInterval(iv)
  }, [load])

  const online = drivers.filter((d) => d.is_online).length
  const withLoc = orders.filter((o) => o.driver_lat != null)

  return (
    <div className="p-4 sm:p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">مراقبة التوصيل الحيّ</h1>
        <div className="text-sm text-gray-500">
          {updatedAt && `آخر تحديث ${updatedAt} · `}تحديث تلقائي كل 15ث
        </div>
      </div>

      {/* ملخّص */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="طلبات نشطة" value={orders.length} />
        <Stat label="معروضة" value={orders.filter((o) => o.status === "offering").length} color="text-amber-600" />
        <Stat label="في الطريق" value={orders.filter((o) => o.status === "on_the_way").length} color="text-emerald-600" />
        <Stat label="سائقون متاحون" value={`${online}/${drivers.length}`} />
      </div>

      {/* الخريطة */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <h2 className="font-bold mb-2">الخريطة الحيّة ({withLoc.length} سائق بموقع)</h2>
        <DispatchMonitorMap orders={withLoc} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* الطلبات النشطة */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">الطلبات النشطة ({orders.length})</h2>
          {loading ? (
            <p className="text-gray-400">جارٍ التحميل…</p>
          ) : orders.length === 0 ? (
            <p className="text-gray-400">لا توجد طلبات توصيل نشطة حاليًا</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">#{o.id.slice(-6)}</span>
                    <div className="flex items-center gap-2">
                      {o.stalled && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">متعثّر</span>}
                      {o.order_type === "multi_store" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">متعدد</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] || "bg-gray-100"}`}>{STATUS_AR[o.status] || o.status}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    🏪 {o.store_names.join("، ")} {o.stops_summary ? `(${o.stops_summary})` : ""}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                    <span>👤 {o.customer_name || "عميل"}</span>
                    {o.driver_name ? <span>🚗 {o.driver_name}</span> : <span className="text-amber-600">بانتظار سائق{o.offer_round && o.offer_round > 1 ? ` (جولة ${o.offer_round})` : ""}</span>}
                    <span>💰 {o.delivery_price ?? "-"} ج</span>
                    {o.driver_lat != null && <span className="text-emerald-600">📡 موقع مباشر</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* السائقون */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3">السائقون ({drivers.length})</h2>
          {drivers.length === 0 ? (
            <p className="text-gray-400">لا يوجد سائقون معتمَدون</p>
          ) : (
            <div className="space-y-2">
              {drivers.map((d) => (
                <div key={d.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${d.is_online ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className="font-medium">{d.name}</span>
                    {d.phone && <span className="text-xs text-gray-400">{d.phone}</span>}
                  </div>
                  <div className="text-sm text-gray-500">
                    {d.active_orders > 0 ? `${d.active_orders} طلب نشط` : d.is_online ? "متاح" : "غير متاح"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
      <div className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
