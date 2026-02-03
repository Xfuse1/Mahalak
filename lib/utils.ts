import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Track Meta (Facebook) Pixel events if fbq is available on window
export function trackMetaEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return
  const w = window as any
  try {
    if (w && typeof w.fbq === "function") {
      w.fbq("track", eventName, params || {})
    }
  } catch (e) {
    // swallow any errors to avoid breaking UI
  }
}

export function formatAddress(address: any) {
  if (typeof address === "object" && address !== null) {
    const parts = [address.street, address.city, address.state, address.zipCode || address.postal_code].filter(Boolean)
    return parts.join(", ")
  }
  return address || ""
}
