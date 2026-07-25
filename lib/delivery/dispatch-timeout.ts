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

  for (const doc of candidates) {
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
  return out
}
