import { getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"

// المرحلة 2 — تحديث موقع السائق الحيّ. يكتب آخر إحداثيات على طلبات السائق النشطة (accepted/on_the_way)
// فقط، فيراها العميل عبر تتبّع الطلب. لا وصول مباشر من العميل — عبر /api/driver/location المصادَق فقط.
const ACTIVE_STATUSES = ["accepted", "on_the_way"]

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  heading?: number,
): Promise<{ ok: boolean; updated: number; error?: string }> {
  // تحقق من الإحداثيات (نطاق معقول) — يمنع قيمًا فاسدة/خبيثة تكسر التتبّع.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, updated: 0, error: "invalid_coords" }
  }
  try {
    const db = getAdminDb()
    const snap = await db.collection("orders").where("driver_id", "==", driverId).get()
    const active = snap.docs.filter((d) => ACTIVE_STATUSES.includes(String(d.data().status)))
    if (active.length === 0) return { ok: true, updated: 0 }
    const now = new Date().toISOString()
    const h = heading != null && Number.isFinite(heading) ? Number(heading) : null
    const batch = db.batch()
    for (const d of active) {
      batch.update(d.ref, {
        driver_lat: lat,
        driver_lng: lng,
        ...(h != null ? { driver_heading: h } : {}),
        driver_location_at: now,
      })
    }
    await batch.commit()
    return { ok: true, updated: active.length }
  } catch (e) {
    logError("[location] updateDriverLocation", e)
    return { ok: false, updated: 0, error: "server_error" }
  }
}
