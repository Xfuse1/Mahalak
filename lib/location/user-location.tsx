"use client"

// IA-01: سياق موقع المستخدم — يُلتقط عبر المتصفّح ويُحفظ محليًا لترتيب «الأقرب إليك».
// نقرأ القيمة المحفوظة عبر useSyncExternalStore (آمن مع SSR/الإماهة، بلا setState داخل effect).
import { createContext, useContext, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"

type Coords = { lat: number; lng: number }
type LocationStatus = "idle" | "loading" | "granted" | "denied"

const STORAGE_KEY = "mahalak_user_location"

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  if (typeof window !== "undefined") window.addEventListener("storage", cb)
  return () => {
    listeners.delete(cb)
    if (typeof window !== "undefined") window.removeEventListener("storage", cb)
  }
}
function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeRaw(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore
  }
  notify()
}

interface LocationContextValue {
  coords: Coords | null
  status: LocationStatus
  requestLocation: () => void
  clearLocation: () => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle")

  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  const coords = useMemo<Coords | null>(() => {
    if (!raw) return null
    try {
      const c = JSON.parse(raw)
      return typeof c?.lat === "number" && typeof c?.lng === "number" ? { lat: c.lat, lng: c.lng } : null
    } catch {
      return null
    }
  }, [raw])

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied")
      return
    }
    setStatus("loading")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeRaw(JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        setStatus("granted")
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])

  const clearLocation = useCallback(() => {
    writeRaw(null)
    setStatus("idle")
  }, [])

  const value = useMemo<LocationContextValue>(
    () => ({ coords, status, requestLocation, clearLocation }),
    [coords, status, requestLocation, clearLocation],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

// يُرجع قيمًا افتراضية آمنة إن استُخدم خارج المزوّد (لا يكسر المكوّنات).
export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) {
    return { coords: null, status: "idle", requestLocation: () => {}, clearLocation: () => {} }
  }
  return ctx
}
