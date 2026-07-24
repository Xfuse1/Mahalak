"use client"

import { useEffect, useRef } from "react"
import type { Map as LeafletMap, Marker } from "leaflet"

interface DriverTrackingMapProps {
  driver: { lat: number; lng: number }
  dropoff?: { lat: number; lng: number } | null
  driverName?: string
}

// خريطة تتبّع حيّة (Leaflet + OpenStreetMap مجانًا): تعرض السائق (🚗) وهو يتحرّك + موقع التسليم (📍).
// تُهيّأ مرة واحدة؛ تحديث إحداثيات السائق يُحرّك العلامة فقط (بلا إعادة إنشاء الخريطة).
export function DriverTrackingMap({ driver, dropoff, driverName }: DriverTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const driverMarker = useRef<Marker | null>(null)
  // نلتقط الإحداثيات الأولى للتهيئة (التحديثات اللاحقة عبر الـeffect الثاني).
  const initial = useRef({ lat: driver.lat, lng: driver.lng })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const L = (await import("leaflet")).default
      // @ts-ignore - CSS import for leaflet styles
      await import("leaflet/dist/leaflet.css")
      if (cancelled || !mapRef.current || mapInstance.current) return
      const map = L.map(mapRef.current, { attributionControl: true }).setView([initial.current.lat, initial.current.lng], 14)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const carIcon = L.divIcon({ html: '<div style="font-size:26px;line-height:1">🚗</div>', className: "", iconSize: [26, 26], iconAnchor: [13, 13] })
      driverMarker.current = L.marker([initial.current.lat, initial.current.lng], { icon: carIcon, title: driverName || "السائق" }).addTo(map)

      if (dropoff && Number.isFinite(dropoff.lat) && Number.isFinite(dropoff.lng)) {
        const homeIcon = L.divIcon({ html: '<div style="font-size:24px;line-height:1">📍</div>', className: "", iconSize: [24, 24], iconAnchor: [12, 24] })
        L.marker([dropoff.lat, dropoff.lng], { icon: homeIcon, title: "موقع التسليم" }).addTo(map)
        map.fitBounds(L.latLngBounds([[initial.current.lat, initial.current.lng], [dropoff.lat, dropoff.lng]]).pad(0.35))
      }

      mapInstance.current = map
      setTimeout(() => map.invalidateSize(), 150)
    }
    const t = setTimeout(load, 80)
    return () => {
      cancelled = true
      clearTimeout(t)
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
        driverMarker.current = null
      }
    }
    // تهيئة مرة واحدة — التحديثات في الـeffect التالي.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحريك علامة السائق عند وصول موقع جديد (بلا إعادة بناء).
  useEffect(() => {
    if (mapInstance.current && driverMarker.current && Number.isFinite(driver.lat) && Number.isFinite(driver.lng)) {
      driverMarker.current.setLatLng([driver.lat, driver.lng])
      mapInstance.current.panTo([driver.lat, driver.lng], { animate: true, duration: 0.8 })
    }
  }, [driver.lat, driver.lng])

  return <div ref={mapRef} className="w-full h-[260px] rounded-xl overflow-hidden border border-gray-100" />
}
