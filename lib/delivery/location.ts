import { getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"

// المرحلة 2 — تحديث موقع السائق الحيّ. التطبيق يرسل معرّفات طلباته النشطة التي يوصّلها، فنكتب
// آخر إحداثيات على تلك الطلبات مباشرةً (بلا مسح تاريخ السائق كله ⇒ تكلفة قراءة مقيّدة). نعيد
// التحقق سيرفر-سايد أن كل طلب مِلك هذا السائق وفي حالة توصيل نشطة — لا نثق بأي معرّف من العميل.
const ACTIVE_STATUSES = ["accepted", "on_the_way"]
const MAX_ORDER_IDS = 25

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  heading: number | undefined,
  orderIds: string[],
): Promise<{ ok: boolean; updated: number; error?: string }> {
  // تحقق من الإحداثيات: أرقام حقيقية ضمن النطاق. نرفض (0,0) وهي قيمة "لا إشارة" الشائعة التي
  // تبثّها طبقات الموقع قبل أول تثبيت — كتابتها تقفز بمؤشّر العميل إلى وسط المحيط.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, updated: 0, error: "invalid_coords" }
  }
  if (lat === 0 && lng === 0) {
    return { ok: false, updated: 0, error: "invalid_coords" }
  }
  const ids = Array.isArray(orderIds)
    ? [...new Set(orderIds.filter((x) => typeof x === "string" && x))].slice(0, MAX_ORDER_IDS)
    : []
  if (ids.length === 0) return { ok: true, updated: 0 }
  try {
    const db = getAdminDb()
    const refs = ids.map((id) => db.collection("orders").doc(id))
    const now = new Date().toISOString()
    const h = heading != null && Number.isFinite(heading) ? Number(heading) : null
    // معاملة ذرّية (قراءة+كتابة معًا): بلاها كان تحديث موقع متأخّر يعيد ختم إحداثيات السائق على طلب
    // أعادت اللوحة عرضه (صار بلا سائق، status=offering) بين القراءة والكتابة — إحداثيات "شبح".
    // القراءة داخل المعاملة ترى الحالة الطازجة فتتخطّى، وأي تعارض يُعيد المحاولة.
    const updated = await db.runTransaction(async (tx) => {
      const docs = await tx.getAll(...refs)
      let u = 0
      for (const d of docs) {
        if (!d.exists) continue
        const o = d.data() as Record<string, unknown>
        // إعادة تحقق إجبارية: الطلب مِلك هذا السائق وفي حالة توصيل نشطة — يمنع كتابة موقع على طلب الغير.
        if (o.driver_id !== driverId) continue
        if (!ACTIVE_STATUSES.includes(String(o.status))) continue
        tx.update(d.ref, {
          driver_lat: lat,
          driver_lng: lng,
          ...(h != null ? { driver_heading: h } : {}),
          driver_location_at: now,
        })
        u++
      }
      return u
    })
    return { ok: true, updated }
  } catch (e) {
    logError("[location] updateDriverLocation", e)
    return { ok: false, updated: 0, error: "server_error" }
  }
}
