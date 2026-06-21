"use client"

import { useEffect, useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import { Button } from "./ui/button"
import { MapPin, Loader2 } from "lucide-react"
import type { LeafletMouseEvent, Map as LeafletMap, Marker } from "leaflet"

interface MapPickerProps {
  open: boolean
  onClose: () => void
  onLocationSelect: (lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
  language?: string
}

export function MapPicker({ open, onClose, onLocationSelect, initialLat = 30.0444, initialLng = 31.2357, language = "ar" }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number }>({ lat: initialLat, lng: initialLng })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!open) return

    const loadMap = async () => {
      const L = (await import("leaflet")).default
      // @ts-ignore - CSS import for leaflet styles
      await import("leaflet/dist/leaflet.css")

      // Fix leaflet default icon
      delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      if (mapRef.current && !mapInstanceRef.current) {
        const map = L.map(mapRef.current).setView([initialLat, initialLng], 13)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)

        const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map)
        markerRef.current = marker

        marker.on("dragend", () => {
          const pos = marker.getLatLng()
          setSelectedPos({ lat: pos.lat, lng: pos.lng })
        })

        map.on("click", (e: LeafletMouseEvent) => {
          marker.setLatLng(e.latlng)
          setSelectedPos({ lat: e.latlng.lat, lng: e.latlng.lng })
        })

        mapInstanceRef.current = map
        setIsLoaded(true)

        // Fix map render issues in dialog
        setTimeout(() => map.invalidateSize(), 200)
      }
    }

    // Delay slightly to allow dialog to render
    const timer = setTimeout(loadMap, 100)
    return () => clearTimeout(timer)
  }, [open, initialLat, initialLng])

  // Cleanup on close
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      setIsLoaded(false)
    }
  }, [open])

  const handleConfirm = () => {
    onLocationSelect(selectedPos.lat, selectedPos.lng)
    onClose()
  }

  const isAr = language === "ar"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {isAr ? "تحديد الموقع من الخريطة" : "Pick Location from Map"}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {isAr ? "اضغط على الخريطة أو اسحب العلامة لتحديد الموقع" : "Click on the map or drag the marker to select location"}
          </p>
        </DialogHeader>

        <div className="relative w-full h-[400px]" ref={mapRef}>
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{isAr ? "الإحداثيات:" : "Coordinates:"}</span>{" "}
              {selectedPos.lat.toFixed(6)}, {selectedPos.lng.toFixed(6)}
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="button" onClick={handleConfirm} className="bg-primary hover:bg-primary/90">
              {isAr ? "تأكيد الموقع" : "Confirm Location"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
