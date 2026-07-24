"use client"

import { useEffect, useRef } from "react"
import type { Map as LeafletMap, LayerGroup } from "leaflet"

type MonitorMarker = {
  id: string
  driver_lat?: number
  driver_lng?: number
  driver_name?: string
  dropoff_lat?: number
  dropoff_lng?: number
  status: string
}

// خريطة إشراف: تعرض كل سائقي الطلبات النشطة (🚗) ومواقع التسليم (📍). تُعيد رسم العلامات عند
// كل تحديث ضمن طبقة واحدة (Leaflet + OpenStreetMap مجانًا).
export function DispatchMonitorMap({ orders }: { orders: MonitorMarker[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const LRef = useRef<any>(null)
  // نُبقي أحدث الطلبات في ref يُقرأ داخل draw() — كي لا يرسم إكمالُ تحميل Leaflet (غير المتزامن) لقطةً
  // قديمة فارغة من إغلاق أول رندر فتبقى الخريطة فاضية حتى الاستطلاع التالي.
  const ordersRef = useRef<MonitorMarker[]>(orders)
  ordersRef.current = orders
  // بصمة مجموعة الطلبات المعروضة آخر مرة أُعيد تأطير الخريطة عندها.
  const lastFitKey = useRef<string>("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const L = (await import("leaflet")).default
      // @ts-ignore
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !mapRef.current || mapInstance.current) return
      LRef.current = L
      const map = L.map(mapRef.current).setView([26.34, 31.89], 12) // جرجا/سوهاج افتراضيًا
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)
      layer.current = L.layerGroup().addTo(map)
      mapInstance.current = map
      setTimeout(() => map.invalidateSize(), 150)
      draw()
    }
    const t = setTimeout(load, 80)
    return () => {
      cancelled = true
      clearTimeout(t)
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        layer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = () => {
    const L = LRef.current
    if (!L || !mapInstance.current || !layer.current) return
    const ords = ordersRef.current
    layer.current.clearLayers()
    const pts: [number, number][] = []
    const ids: string[] = []
    const carIcon = L.divIcon({ html: '<div style="font-size:24px;line-height:1">🚗</div>', className: "", iconSize: [24, 24], iconAnchor: [12, 12] })
    const homeIcon = L.divIcon({ html: '<div style="font-size:20px;line-height:1">📍</div>', className: "", iconSize: [20, 20], iconAnchor: [10, 20] })
    for (const o of ords) {
      let has = false
      let drewDriver = false
      if (Number.isFinite(o.driver_lat) && Number.isFinite(o.driver_lng)) {
        const ll: [number, number] = [o.driver_lat as number, o.driver_lng as number]
        L.marker(ll, { icon: carIcon }).bindTooltip(`${o.driver_name || "سائق"} — ${o.status}`).addTo(layer.current)
        pts.push(ll); has = true; drewDriver = true
      }
      if (Number.isFinite(o.dropoff_lat) && Number.isFinite(o.dropoff_lng)) {
        const ll: [number, number] = [o.dropoff_lat as number, o.dropoff_lng as number]
        L.marker(ll, { icon: homeIcon }).bindTooltip("تسليم").addTo(layer.current)
        pts.push(ll); has = true
      }
      // نُدرج وجود علامة السائق في المفتاح: أول ما تظهر سيارة السائق لطلبٍ كان يعرض وجهة التسليم فقط
      // (offering→accepted) يتغيّر الرمز مرّة واحدة فيُعاد التأطير ليشملها؛ لكنه يثبت بعدها فلا يُعاد
      // التأطير مع مجرّد تحرّك السائق (يحافظ على تكبير/تحريك المشغّل).
      if (has) ids.push(drewDriver ? o.id + "+d" : o.id)
    }
    // نُعيد تأطير الخريطة فقط عند تغيّر مجموعة العلامات المعروضة (ظهور/اختفاء طلب أو أول ظهور لسائق) — لا
    // عند كل استطلاع 15ث ولا عند مجرّد تحرّك السائق، حتى لا يُلغى تكبير/تحريك المشغّل اليدوي كل دورة.
    const key = ids.sort().join("|")
    if (key !== lastFitKey.current) {
      lastFitKey.current = key
      if (pts.length === 1) mapInstance.current.setView(pts[0], 14)
      else if (pts.length > 1) mapInstance.current.fitBounds(L.latLngBounds(pts).pad(0.3))
    }
  }

  // إعادة الرسم عند تغيّر الطلبات (عدد/مواقع).
  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders])

  return <div ref={mapRef} className="w-full h-[360px] rounded-xl overflow-hidden border border-gray-200" />
}
