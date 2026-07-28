import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { readDispatchSettings } from "@/lib/delivery/fee"
import { createNotification } from "@/lib/notifications-internal"
import { notifyDriversOfOffer } from "@/lib/delivery/driver-push"
import { sendPushToOwner } from "@/lib/server-push"
import { logError } from "@/lib/logger"

// انتهاء مهلة العرض: عرضٌ لم يقبله أي سائق قبل offer_expires_at_ms يُعاد عرضه بجولة جديدة
// (مع إشعار العميل) حتى MAX_OFFER_ROUNDS، ثم يُصعَّد (dispatch_stalled) ويُخطَر البائع والعميل
// ليتدخّلا يدويًّا. كل طلب يُعالَج داخل معاملة تعيد التحقق أنه ما زال معروضًا وغير مُسنَد
// وما زال منتهيًا — فلا نطمس أبدًا طلبًا قبِله سائق في نفس اللحظة.

const MAX_OFFER_ROUNDS = 3
const SCAN_LIMIT = 200
// سقف زمني للمسحة الواحدة: تتوقّف عند تجاوزه ويكمّل التيك التالي البقية — يمنع تدهور مسحة على تراكم
// كبير (مثلًا بعد انقطاع كرون) من تجاوز مهلة تنفيذ الدالة.
const SWEEP_BUDGET_MS = 40_000
// مهلة تأكيد التاجر لطلب توزيع: بعدها يُصعَّد (dispatch_stalled + إشعار) كي لا تعلق طلبات COD صامتة.
export const PENDING_TIMEOUT_MS = 20 * 60 * 1000

type Outcome =
  | { kind: "reoffered"; round: number; customerId?: string }
  | { kind: "stalled"; customerId?: string; storeId?: string }
  | { kind: "skipped" }

export type TimeoutSweepResult = { scanned: number; reoffered: number; stalled: number; skipped: number }

function tl(existing: unknown, entry: { status: string; timestamp: string; note?: string }) {
  return [...(Array.isArray(existing) ? existing : []), entry]
}

export async function processExpiredOffers(): Promise<TimeoutSweepResult> {
  const out: TimeoutSweepResult = { scanned: 0, reoffered: 0, stalled: 0, skipped: 0 }
  const settings = await readDispatchSettings()
  // النظام كله خلف العلم — مكنسة لا تعمل ما دام التوزيع مطفأً.
  if (!settings.enabled) return out

  const db = getAdminDb()
  const windowMs = Math.max(10, settings.offer_timeout_sec) * 1000
  // مساواة بحقل واحد (status) — فهرس مفرد تلقائي؛ نرشّح المنتهي في JS ثم نتحقق ثانيةً داخل المعاملة.
  const snap = await db.collection("orders").where("status", "==", "offering").limit(SCAN_LIMIT).get()
  const candidates = snap.docs.filter((d) => {
    const o = d.data() as Record<string, any>
    if (o.is_dispatch !== true) return false
    if (o.driver_id) return false
    const exp = Number(o.offer_expires_at_ms || 0)
    return exp > 0 && exp < Date.now()
  })
  out.scanned = candidates.length

  const sweepStart = Date.now()
  for (const doc of candidates) {
    if (Date.now() - sweepStart > SWEEP_BUDGET_MS) break // ميزانية وقت — نكمّل الباقي في التيك التالي
    let outcome: Outcome = { kind: "skipped" }
    try {
      outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
        const s = await tx.get(doc.ref)
        if (!s.exists) return { kind: "skipped" }
        const o = s.data() as Record<string, any>
        // إعادة تحقق ذرّية: أي شرط تغيّر بين المسح والمعاملة (قبول سائق مثلًا) ⇒ لا نلمس الطلب.
        if (o.is_dispatch !== true) return { kind: "skipped" }
        if (o.driver_id) return { kind: "skipped" }
        if (o.status !== "offering") return { kind: "skipped" }
        const exp = Number(o.offer_expires_at_ms || 0)
        if (!(exp > 0 && exp < Date.now())) return { kind: "skipped" }

        const now = Date.now()
        const nowIso = new Date().toISOString()
        const round = Math.max(1, Number(o.offer_round || 1))
        if (round < MAX_OFFER_ROUNDS) {
          tx.update(doc.ref, {
            offer_expires_at_ms: now + windowMs,
            offer_round: round + 1,
            timeline: tl(o.timeline, { status: "offer_reoffered", timestamp: nowIso, note: `جولة ${round + 1}` }),
            updated_at: nowIso,
          })
          return { kind: "reoffered", round: round + 1, customerId: o.customer_id }
        }
        // استُنفدت الجولات — نُصعّد ونُوقف العدّاد. الحالة تبقى offering كي يظل بالإمكان قبوله يدويًّا.
        tx.update(doc.ref, {
          dispatch_stalled: true,
          offer_expires_at_ms: FieldValue.delete(),
          timeline: tl(o.timeline, { status: "dispatch_stalled", timestamp: nowIso, note: "لم يقبل أي سائق" }),
          updated_at: nowIso,
        })
        return { kind: "stalled", customerId: o.customer_id, storeId: o.store_id }
      })
    } catch (e) {
      logError(`[dispatch-timeout] order ${doc.id}`, e)
      outcome = { kind: "skipped" }
    }

    // الإشعارات خارج المعاملة (لا نُطيل قفلًا لأجل عمل شبكي) — فشلها لا يُبطل تغيير الحالة.
    try {
      if (outcome.kind === "reoffered") {
        out.reoffered++
        if (outcome.customerId) {
          await createNotification({
            user_id: outcome.customerId,
            type: "order_status",
            title: "⏳ ما زلنا نبحث عن سائق",
            title_en: "⏳ Still looking for a driver",
            message: "لم يقبل سائق طلبك بعد — نُعيد عرضه على السائقين الآن.",
            message_en: "No driver accepted yet — we are re-offering your order.",
            link: "/account",
            data: { order_id: doc.id, status: "offering", offer_round: outcome.round },
          })
          await sendPushToOwner("user", outcome.customerId, {
            title: "⏳ ما زلنا نبحث عن سائق",
            body: "لم يقبل سائق طلبك بعد — نُعيد عرضه على السائقين الآن.",
            link: "/account",
          })
        }
        // إعادة العرض = فرصة جديدة للسائقين ⇒ نبثّ FCM لهم ثانيةً (يستبعد من رفض هذا الطلب).
        const od = doc.data() as Record<string, any>
        await notifyDriversOfOffer({
          id: doc.id,
          delivery_price: od.delivery_price,
          delivery_city: od.delivery_city,
          distance_km: od.distance_km,
          rejected_by: Array.isArray(od.rejected_by) ? od.rejected_by : [],
        })
      } else if (outcome.kind === "stalled") {
        out.stalled++
        const payload = {
          type: "order_status" as const,
          title: "⚠️ لم نجد سائقًا للطلب",
          title_en: "⚠️ No driver found",
          message: "لم يقبل أي سائق الطلب بعد عدة محاولات — يُرجى المتابعة يدويًّا.",
          message_en: "No driver accepted after several attempts — please follow up manually.",
          link: "/account",
          data: { order_id: doc.id, status: "offering", stalled: true },
        }
        if (outcome.storeId) {
          await createNotification({ user_id: outcome.storeId, ...payload, link: "/seller/orders" })
          await sendPushToOwner("user", outcome.storeId, { title: payload.title, body: payload.message, link: "/seller/orders" })
        }
        if (outcome.customerId) {
          await createNotification({ user_id: outcome.customerId, ...payload })
          await sendPushToOwner("user", outcome.customerId, { title: payload.title, body: payload.message, link: "/account" })
        }
      } else {
        out.skipped++
      }
    } catch (e) {
      logError(`[dispatch-timeout] notify ${doc.id}`, e)
    }
  }

  // مسح الطلبات المعلّقة (pending) التي تجاوزت مهلة تأكيد التاجر — نُصعّدها (dispatch_stalled + إشعار
  // التاجر/العميل) كي لا تعلق طلبات COD صامتةً بلا سائق ولا تأكيد. الطلب يبقى pending فيقدر التاجر
  // تأكيده لاحقًا؛ العلم يمنع تكرار الإشعار.
  try {
    const now = Date.now()
    // نرتّب بـ pending_expires_at_ms: يستبعد الطلبات غير-التوزيعية تلقائيًّا (لا تملك الحقل) ويقدّم
    // الأقرب انتهاءً — فلا تُزاحمنا 200 طلب pending عادي فيضيع طلب توزيع بعد الحدّ. يتطلّب فهرسًا مركّبًا.
    const pSnap = await db
      .collection("orders")
      .where("status", "==", "pending")
      .orderBy("pending_expires_at_ms", "asc")
      .limit(SCAN_LIMIT)
      .get()
    const pendingCandidates = pSnap.docs.filter((d) => {
      const o = d.data() as Record<string, any>
      if (o.is_dispatch !== true || o.driver_id || o.dispatch_stalled === true) return false
      const exp = Number(o.pending_expires_at_ms || 0)
      return exp > 0 && exp < now
    })
    for (const doc of pendingCandidates) {
      if (Date.now() - sweepStart > SWEEP_BUDGET_MS) break
      let esc: { customerId?: string; storeId?: string } | null = null
      try {
        esc = await db.runTransaction(async (tx) => {
          const s = await tx.get(doc.ref)
          if (!s.exists) return null
          const o = s.data() as Record<string, any>
          if (o.is_dispatch !== true || o.status !== "pending" || o.driver_id || o.dispatch_stalled === true) return null
          const exp = Number(o.pending_expires_at_ms || 0)
          if (!(exp > 0 && exp < Date.now())) return null
          const nowIso = new Date().toISOString()
          tx.update(doc.ref, {
            dispatch_stalled: true,
            timeline: tl(o.timeline, { status: "pending_stalled", timestamp: nowIso, note: "لم يؤكّد المتجر الطلب في المهلة" }),
            updated_at: nowIso,
          })
          return { customerId: o.customer_id as string | undefined, storeId: o.store_id as string | undefined }
        })
      } catch (e) {
        logError(`[dispatch-timeout] pending ${doc.id}`, e)
      }
      if (esc) {
        out.stalled++
        try {
          if (esc.storeId) {
            await createNotification({ user_id: esc.storeId, type: "order_status", title: "⏰ طلب ينتظر تأكيدك", title_en: "⏰ An order awaits your confirmation", message: "أكّد الطلب كي يُعرض على السائقين، أو ارفضه.", message_en: "Confirm the order so it can be offered to drivers, or reject it.", link: "/seller/orders", data: { order_id: doc.id, status: "pending", stalled: true } })
            await sendPushToOwner("user", esc.storeId, { title: "⏰ طلب ينتظر تأكيدك", body: "أكّد الطلب كي يُعرض على السائقين.", link: "/seller/orders" })
          }
          if (esc.customerId) {
            await createNotification({ user_id: esc.customerId, type: "order_status", title: "⏳ طلبك ينتظر تأكيد المتجر", title_en: "⏳ Your order awaits store confirmation", message: "لم يؤكّد المتجر طلبك بعد — نتابع معه.", message_en: "The store hasn't confirmed your order yet — we're following up.", link: "/account", data: { order_id: doc.id, status: "pending", stalled: true } })
            await sendPushToOwner("user", esc.customerId, { title: "⏳ طلبك ينتظر تأكيد المتجر", body: "لم يؤكّد المتجر طلبك بعد — نتابع معه.", link: "/account" })
          }
        } catch (e) {
          logError(`[dispatch-timeout] pending notify ${doc.id}`, e)
        }
      }
    }
  } catch (e) {
    logError("[dispatch-timeout] pending sweep", e)
  }

  return out
}
