import { getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"

// حالة السائق (متاح/مش متاح) + ملخّص محفظة COD. طبقة محايدة تستدعيها route handlers.

// تبديل توفّر السائق للورديّة. متاح = يظهر في بثّ العروض. لا يمسّ اعتماد الأدمن (isApproved).
export async function setDriverAvailability(
  driverId: string,
  online: boolean,
): Promise<{ ok: boolean }> {
  try {
    await getAdminDb()
      .collection("drivers")
      .doc(driverId)
      .set({ isOnline: online, is_online: online, updated_at: new Date().toISOString() }, { merge: true })
    return { ok: true }
  } catch (e) {
    logError("[driver-status] setDriverAvailability", e)
    return { ok: false }
  }
}

export type DriverEarnings = {
  today: { deliveries: number; earned: number; collected: number }
  all: { deliveries: number; earned: number; collected: number }
}

// حدّ أقصى لمسح طلبات السائق عند حساب المحفظة (يتفادى قراءة تاريخ ضخم في كل فتح للشاشة).
const EARNINGS_SCAN_CAP = 500

// ملخّص محفظة COD: من طلبات السائق المُسلَّمة — عدد التوصيلات، أجرة التوصيل المكتسبة (delivery_price)،
// والكاش المُحصَّل (cash_collected) لليوم وللإجمالي. تسوية مباشرة: المنصّة تتبّع وتعرض فقط.
export async function getDriverEarnings(driverId: string): Promise<DriverEarnings> {
  const empty: DriverEarnings = {
    today: { deliveries: 0, earned: 0, collected: 0 },
    all: { deliveries: 0, earned: 0, collected: 0 },
  }
  try {
    const db = getAdminDb()
    const snap = await db.collection("orders").where("driver_id", "==", driverId).limit(EARNINGS_SCAN_CAP).get()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const out: DriverEarnings = JSON.parse(JSON.stringify(empty))
    for (const d of snap.docs) {
      const o = d.data() as Record<string, any>
      if (o.status !== "delivered") continue
      const earned = num(o.delivery_price)
      const collected = num(o.cash_collected ?? o.total)
      out.all.deliveries++
      out.all.earned += earned
      out.all.collected += collected
      // اليوم: بحسب وقت التسليم إن وُجد وإلا آخر تحديث.
      const at = o.delivered_at || o.updated_at
      const t = at ? new Date(at).getTime() : 0
      if (t >= startOfDay.getTime()) {
        out.today.deliveries++
        out.today.earned += earned
        out.today.collected += collected
      }
    }
    // نُقرّب لأقرب قرش (خانتين) لتفادي أخطاء الفاصلة العائمة في العرض.
    for (const k of ["today", "all"] as const) {
      out[k].earned = Math.round(out[k].earned * 100) / 100
      out[k].collected = Math.round(out[k].collected * 100) / 100
    }
    return out
  } catch (e) {
    logError("[driver-status] getDriverEarnings", e)
    return empty
  }
}
