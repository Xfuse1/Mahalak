"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { getDriverPublicProfile } from "@/lib/drivers/driver-repo"
import { logError } from "@/lib/logger"

export type OrderTracking = {
  found: boolean
  status?: string
  is_dispatch?: boolean
  driver?: { id: string; name: string; phone?: string } | null
  driver_location?: { lat: number; lng: number; heading?: number; at?: string } | null
  dropoff?: { lat: number; lng: number } | null
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
      updated_at:
        o.updated_at?.toDate?.()?.toISOString?.() ||
        (typeof o.updated_at === "string" ? o.updated_at : undefined),
    }
  } catch (e) {
    logError("[tracking] getOrderTracking", e)
    return { found: false }
  }
}
