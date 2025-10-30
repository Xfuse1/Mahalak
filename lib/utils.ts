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
