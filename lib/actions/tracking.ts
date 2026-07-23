"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { getDriverPublicProfile } from "@/lib/drivers/driver-repo"
import { logError } from "@/lib/logger"

export type TrackingBid = { driver_id: string; driver_name: string; price: number; reason?: string; created_at?: string }

export type OrderTracking = {
  found: boolean
  status?: string
  is_dispatch?: boolean
  driver?: { id: string; name: string; phone?: string } | null
  driver_location?: { lat: number; lng: number; heading?: number; at?: string } | null
  dropoff?: { lat: number; lng: number } | null
  delivery_price?: number
  pending_bids?: TrackingBid[] // عروض أسعار من سائقين تنتظر ردّ العميل
  updated_at?: string
}

// تتبّع حيّ خفيف للعميل: يرجع حالة الطلب وموقع السائق المباشر فقط — مصمَّم للاستطلاع المتكرر
// (لا يجلب العناصر/المنتجات مثل getOrderById الثقيلة). لا يكشف كود التسليم أبدًا.
// مقصور على مالك الطلب (العميل) أو البائع أو السائق المعيَّن — الهوية تُشتق سيرفر-سايد من الجلسة.
export async function getOrderTracking(orderId: string): Promise<OrderTracking> {
  try {
    if (!orderId || typeof orderId !== "string") return { found: false }
    const uid = await getCurrentUid()
    if (!uid) return { found: false }
    const db = getAdminDb()
    let doc = await db.collection("orders").doc(orderId).get()
    if (!doc.exists) {
      const snap = await db.collection("orders").where("order_id", "==", orderId).limit(1).get()
      if (snap.empty) return { found: false }
      doc = snap.docs[0]
    }
    const o = doc.data()
    if (!o) return { found: false }

    // التحقق من الهوية إجباري: لا نثق بأي معرّف من العميل — نقارن بمعرّف الجلسة الموثّق فقط.
    const isCustomer = o.customer_id === uid
    const isSeller = o.store_id === uid
    const isDriver = o.driver_id === uid
    if (!isCustomer && !isSeller && !isDriver) return { found: false }

    const driverId = typeof o.driver_id === "string" && o.driver_id ? o.driver_id : null
    const driverProfile = driverId ? await getDriverPublicProfile(driverId) : null

    const hasLoc = Number.isFinite(o.driver_lat) && Number.isFinite(o.driver_lng)
    return {
      found: true,
      status: String(o.status ?? ""),
      is_dispatch: o.is_dispatch === true,
      driver: driverProfile ? { id: driverProfile.id, name: driverProfile.name, phone: driverProfile.phone } : null,
      driver_location: hasLoc
        ? {
          lat: Number(o.driver_lat),
          lng: Number(o.driver_lng),
          heading: Number.isFinite(o.driver_heading) ? Number(o.driver_heading) : undefined,
          at: typeof o.driver_location_at === "string" ? o.driver_location_at : undefined,
        }
        : null,
      dropoff:
        Number.isFinite(o.delivery_latitude) && Number.isFinite(o.delivery_longitude)
          ? { lat: Number(o.delivery_latitude), lng: Number(o.delivery_longitude) }
          : null,
      delivery_price: Number.isFinite(o.delivery_price) ? Number(o.delivery_price) : undefined,
      // قائمة سماح صريحة لكل عرض (لا ننشر مستند العرض كما هو) — العميل مالك الطلب فقط يراها.
      pending_bids: isCustomer && Array.isArray(o.bids)
        ? o.bids
          .filter((b: Record<string, unknown>) => b?.status === "pending")
          .map((b: Record<string, unknown>) => ({
            driver_id: String(b.driver_id ?? ""),
            driver_name: String(b.driver_name ?? ""),
            price: Number(b.price ?? 0),
            reason: typeof b.reason === "string" ? b.reason : undefined,
            created_at: typeof b.created_at === "string" ? b.created_at : undefined,
          }))
        : undefined,
      updated_at:
        o.updated_at?.toDate?.()?.toISOString?.() ||
        (typeof o.updated_at === "string" ? o.updated_at : undefined),
    }
  } catch (e) {
    logError("[tracking] getOrderTracking", e)
    return { found: false }
  }
}
