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

// حدّ أقصى لأحدث الطلبات المُسلَّمة المقروءة عند حساب المحفظة (يتفادى قراءة تاريخ ضخم في كل فتح
// للشاشة). ملاحظة تشغيل: بعد تجاوز سائقٍ 500 توصيلة يصبح إجمالي "الكل" آخر 500 توصيلة (مرجَّح
// للأحدث) لا الإجمالي التاريخي — عندها يُنقل إلى عدّاد تراكمي يُزاد لحظة التسليم.
const EARNINGS_SCAN_CAP = 500

// تاريخ اليوم بتوقيت القاهرة (YYYY-MM-DD) — Intl يراعي التوقيت الصيفي تلقائيًّا. نقارن التاريخ
// كنصّ بدل حدود زمنية بإزاحة ثابتة، فلا نُخطئ إسناد توصيلات ما بعد منتصف ليل UTC ليومٍ خاطئ.
const cairoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d)

// ملخّص محفظة COD: من طلبات السائق المُسلَّمة — عدد التوصيلات، أجرة التوصيل المكتسبة (delivery_price)،
// والكاش المُحصَّل (cash_collected) لليوم وللإجمالي. تسوية مباشرة: المنصّة تتبّع وتعرض فقط.
export async function getDriverEarnings(driverId: string): Promise<DriverEarnings> {
  const empty: DriverEarnings = {
    today: { deliveries: 0, earned: 0, collected: 0 },
    all: { deliveries: 0, earned: 0, collected: 0 },
  }
  try {
    const db = getAdminDb()
    // نرشّح المُسلَّمة على مستوى القاعدة ونرتّب بالأحدث — فالـ500 المقروءة أحدث التوصيلات فعلًا
    // (لا مجموعة عشوائية)، فيبقى "اليوم" دقيقًا دائمًا و"الكل" مرجَّحًا للأحدث. يتطلّب فهرسًا مركّبًا
    // (driver_id + status + created_at) — مضاف في firestore.indexes.json.
    let docs
    try {
      const snap = await db
        .collection("orders")
        .where("driver_id", "==", driverId)
        .where("status", "==", "delivered")
        .orderBy("created_at", "desc")
        .limit(EARNINGS_SCAN_CAP)
        .get()
      docs = snap.docs
    } catch (idxErr) {
      // الفهرس المركّب قد لا يكون منشورًا بعد (firebase deploy --only firestore:indexes) — نعود للمسح
      // البسيط بحقل واحد ونرشّح المُسلَّمة في JS كي تعمل المحفظة فورًا دون انتظار نشر الفهرس.
      logError("[driver-status] earnings indexed query fell back to scan", idxErr)
      const snap = await db.collection("orders").where("driver_id", "==", driverId).limit(EARNINGS_SCAN_CAP).get()
      docs = snap.docs.filter((d) => (d.data() as Record<string, any>).status === "delivered")
    }
    const todayCairo = cairoDay(new Date())
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    const out: DriverEarnings = JSON.parse(JSON.stringify(empty))
    for (const d of docs) {
      const o = d.data() as Record<string, any>
      const earned = num(o.delivery_price)
      const collected = num(o.cash_collected ?? o.total)
      out.all.deliveries++
      out.all.earned += earned
      out.all.collected += collected
      // اليوم: بحسب وقت التسليم إن وُجد وإلا آخر تحديث — بتقويم القاهرة.
      const at = o.delivered_at || o.updated_at
      if (at && cairoDay(new Date(at)) === todayCairo) {
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
