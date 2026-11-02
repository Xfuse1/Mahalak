import type { CheckoutItem } from "../types/checkout"
import { validLocation, type ShoppingLocation } from "./shopping-request"

export const AI_CHECKOUT_KEY = "mahalak_ai_checkout"
export type AiCheckoutDraft = {
  items: CheckoutItem[]
  title: string
  query: string
  budget: number | null
  quotedTotal: number
  location: ShoppingLocation | null
  driverId: string | null
  deliveryFee: number
  radiusKm: number
  shippingMode: "dispatch" | "driver"
}

export function parseAiCheckoutDraft(raw: unknown): AiCheckoutDraft | null {
  if (!raw || typeof raw !== "object") return null
  const d = raw as Record<string, unknown>
  if (!Array.isArray(d.items) || !d.items.length || d.items.length > 30 || typeof d.quotedTotal !== "number" || !Number.isFinite(d.quotedTotal) || d.quotedTotal < 0) return null
  if (d.budget !== null && (typeof d.budget !== "number" || !Number.isFinite(d.budget) || d.budget <= 0 || d.budget > 100000)) return null
  if (typeof d.deliveryFee !== "number" || !Number.isFinite(d.deliveryFee) || d.deliveryFee < 0 || (d.shippingMode !== "dispatch" && d.shippingMode !== "driver")) return null
  const items: CheckoutItem[] = []
  const seen = new Set<string>()
  for (const value of d.items) {
    if (!value || typeof value !== "object") return null
    const p = value as Record<string, unknown>
    if (typeof p.id !== "string" || !p.id || p.id.length > 128 || seen.has(p.id) || typeof p.store_id !== "string" || !p.store_id ||
      typeof p.price !== "number" || !Number.isFinite(p.price) || p.price <= 0 || typeof p.quantity !== "number" || !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 1000) return null
    seen.add(p.id)
    items.push({ id: p.id, store_id: p.store_id, name: typeof p.name === "string" ? p.name.slice(0, 200) : "صنف",
      store_name: typeof p.store_name === "string" ? p.store_name.slice(0, 200) : "متجر", price: p.price, quantity: p.quantity,
      stock: typeof p.stock === "number" && Number.isFinite(p.stock) ? p.stock : 0,
      image_url: typeof p.image_url === "string" ? p.image_url : null,
      discount_percentage: typeof p.discount_percentage === "number" && Number.isFinite(p.discount_percentage) ? Math.min(100, Math.max(0, p.discount_percentage)) : 0,
      unit_price: typeof p.unit_price === "number" && Number.isFinite(p.unit_price) && p.unit_price >= 0 ? p.unit_price : undefined,
      source: "ai_search" })
  }
  return { items, title: typeof d.title === "string" ? d.title.slice(0, 100) : "اختيار البحث الذكي", query: typeof d.query === "string" ? d.query.slice(0, 300) : "", budget: d.budget as number | null,
    quotedTotal: d.quotedTotal, location: validLocation(d.location) ? d.location : null,
    driverId: typeof d.driverId === "string" && /^[\w-]{1,128}$/.test(d.driverId) ? d.driverId : null,
    deliveryFee: d.deliveryFee, radiusKm: typeof d.radiusKm === "number" && d.radiusKm > 0 && d.radiusKm <= 100 ? d.radiusKm : 10, shippingMode: d.shippingMode }
}
