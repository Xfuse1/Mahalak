import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { logError } from "@/lib/logger"
import { createNotification } from "@/lib/notifications-internal"
import { sendPushToOwner } from "@/lib/server-push"

// أفعال السائق في تدفق التوزيع (أحادي المتجر — المرحلة 1). كل فعل معاملة ذرّية تتحقق أن الطلب
// طلب توزيع (is_dispatch === true)، وفي الحالة الصحيحة، والسائق صاحب الحق. الهوية تُمرَّر من
// route handler (جلسة السائق الموثّقة). آلة الحالة: offering → accepted → on_the_way → delivered.
// لا تلمس هذه الأفعال أي طلب قديم/متعدد المتاجر (تُرفض ما لم يكن is_dispatch).

export type DispatchResult = { success: boolean; error?: string; status?: string }

function tl(existing: unknown, entry: { status: string; timestamp: string; note?: string }) {
  return [...(Array.isArray(existing) ? existing : []), entry]
}

async function notifyCustomer(
  customerId: string | undefined,
  payload: { title: string; title_en: string; message: string; message_en: string; link: string; data: Record<string, unknown> },
) {
  if (!customerId) return
  try {
    await createNotification({ user_id: customerId, type: "order_status", ...payload })
  } catch (e) {
    logError("[dispatch] notify", e)
  }
  // دفع Web Push كذلك (خامل حتى يُضبط VAPID) — يصل العميل حتى لو مش فاتح صفحة الطلبات.
  // sendPushToOwner أفضل-جهد ولا يرمي، لكن نحصره احتياطًا كي لا يُبطل تدفّق التسليم.
  try {
    await sendPushToOwner("user", customerId, { title: payload.title, body: payload.message, link: payload.link })
  } catch (e) {
    logError("[dispatch] push", e)
  }
}

// (1) قبول عرض توصيل — أول-يفوز (ذرّي). offering + غير منتهٍ + السائق غير مرفوض + معتمَد وغير معطَّل.
export async function acceptOrderOffer(driverId: string, orderId: string): Promise<DispatchResult> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.driver_id) return { ok: false as const, error: "already_taken" }
      if (o.status !== "offering") return { ok: false as const, error: "not_available" }
      const exp = Number(o.offer_expires_at_ms || 0)
      if (exp && exp < Date.now()) return { ok: false as const, error: "offer_expired" }
      if (Array.isArray(o.rejected_by) && o.rejected_by.includes(driverId)) {
        return { ok: false as const, error: "already_rejected" }
      }
      const dSnap = await tx.get(db.collection("drivers").doc(driverId))
      const d = dSnap.exists ? (dSnap.data() as Record<string, any>) : null
      if (!d) return { ok: false as const, error: "driver_not_found" }
      if (d.disabled === true) return { ok: false as const, error: "driver_disabled" }
      if ((d.isApproved ?? d.is_approved ?? false) !== true) return { ok: false as const, error: "driver_not_approved" }
      // سائق أطفأ ورديّته (غير أونلاين) لا يُسنَد إليه طلب — تماثلًا مع submitDriverBid/respondToDriverBid.
      if ((d.isOnline ?? d.is_online ?? false) !== true) return { ok: false as const, error: "driver_offline" }
      tx.update(ref, {
        driver_id: driverId,
        driver_name: d.name || "",
        status: "accepted",
        accepted_at: now,
        offer_expires_at_ms: FieldValue.delete(),
        dispatch_stalled: FieldValue.delete(), // خرج من offering ⇒ لم يعد متعثّرًا (وإلا إعادة عرض إدارية تخطف السائق)
        timeline: tl(o.timeline, { status: "driver_accepted", timestamp: now }),
        updated_at: now,
      })
      return { ok: true as const, customerId: o.customer_id as string | undefined }
    })
    if (!out.ok) return { success: false, error: out.error }
    await notifyCustomer(out.customerId, {
      title: "🚗 سائق قبل طلبك",
      title_en: "🚗 A driver accepted your order",
      message: "السائق في الطريق للمتجر لاستلام طلبك.",
      message_en: "The driver is heading to the store to pick up your order.",
      link: "/account",
      data: { order_id: orderId, status: "accepted" },
    })
    return { success: true, status: "accepted" }
  } catch (e) {
    logError("[dispatch] acceptOrderOffer", e)
    return { success: false, error: "server_error" }
  }
}

// (2) رفض عرض — بسبب إجباري. يبقى offering ويُضاف السائق لـrejected_by (يُستبعد من العروض التالية).
export async function rejectOrderOffer(driverId: string, orderId: string, reason: string): Promise<DispatchResult> {
  // حدّ طول السبب: يمنع تضخيم مستند الطلب عبر note المتحكَّم فيه من العميل (مسار DoS).
  const r = String(reason || "").trim().slice(0, 280)
  if (!r) return { success: false, error: "reason_required" }
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.status !== "offering") return { ok: false as const, error: "not_available" }
      // إيدمبوتنت: السائق يرفض الطلب مرة واحدة فقط — يمنع تكرار إضافة سطور الخط الزمني (تبريك المستند
      // حتى حدّ 1MB فيتعطّل الطلب نهائيًا) ويحدّ نموّ timeline بسطر واحد لكل سائق.
      if (Array.isArray(o.rejected_by) && o.rejected_by.includes(driverId)) {
        return { ok: false as const, error: "already_rejected" }
      }
      // تحقق صلاحية السائق (توازيًا مع accept): موجود، غير معطَّل، معتمَد — يسدّ حالة السائق غير-المعتمَد
      // (الحقل غائب) الذي يمرّ من getCurrentDriverId اللطيف.
      const dSnap = await tx.get(db.collection("drivers").doc(driverId))
      const d = dSnap.exists ? (dSnap.data() as Record<string, any>) : null
      if (!d) return { ok: false as const, error: "driver_not_found" }
      if (d.disabled === true) return { ok: false as const, error: "driver_disabled" }
      if ((d.isApproved ?? d.is_approved ?? false) !== true) return { ok: false as const, error: "driver_not_approved" }
      tx.update(ref, {
        rejected_by: FieldValue.arrayUnion(driverId),
        timeline: tl(o.timeline, { status: "driver_rejected_offer", timestamp: now, note: r }),
        updated_at: now,
      })
      return { ok: true as const }
    })
    return out.ok ? { success: true } : { success: false, error: out.error }
  } catch (e) {
    logError("[dispatch] rejectOrderOffer", e)
    return { success: false, error: "server_error" }
  }
}

// (3) استلام من المتجر — accepted (لصاحبها) → on_the_way.
export async function driverPickup(driverId: string, orderId: string): Promise<DispatchResult> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      // الطلبات متعددة المتاجر تُستلم لكل متجر عبر driverPickupStore (وإلا تخطّينا محطات).
      if (o.order_type === "multi_store") return { ok: false as const, error: "use_per_store_pickup" }
      if (o.driver_id !== driverId) return { ok: false as const, error: "not_your_order" }
      if (o.status !== "accepted") return { ok: false as const, error: "invalid_state" }
      tx.update(ref, {
        status: "on_the_way",
        picked_up_at: now,
        timeline: tl(o.timeline, { status: "picked_up", timestamp: now }),
        updated_at: now,
      })
      return { ok: true as const, customerId: o.customer_id as string | undefined }
    })
    if (!out.ok) return { success: false, error: out.error }
    await notifyCustomer(out.customerId, {
      title: "📦 السائق استلم طلبك",
      title_en: "📦 Driver picked up your order",
      message: "السائق في الطريق إليك الآن.",
      message_en: "The driver is on the way to you now.",
      link: "/account",
      data: { order_id: orderId, status: "on_the_way" },
    })
    return { success: true, status: "on_the_way" }
  } catch (e) {
    logError("[dispatch] driverPickup", e)
    return { success: false, error: "server_error" }
  }
}

// (3-م) استلام متجر في طلب توزيع متعدد المتاجر. يعلّم محطة المتجر picked_up؛ عند استلام كل
// المحطات يتحوّل الطلب إلى on_the_way (ويُخطَر العميل). لصاحب الطلب فقط، والطلب في حالة accepted.
export async function driverPickupStore(driverId: string, orderId: string, storeId: string): Promise<DispatchResult> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.order_type !== "multi_store") return { ok: false as const, error: "not_multi_store" }
      if (o.driver_id !== driverId) return { ok: false as const, error: "not_your_order" }
      if (o.status !== "accepted") return { ok: false as const, error: "invalid_state" }
      const stops: Array<Record<string, any>> = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
      const idx = stops.findIndex((s) => s.store_id === storeId)
      if (idx < 0) return { ok: false as const, error: "store_not_in_order" }
      if (stops[idx].status === "picked_up") return { ok: false as const, error: "already_picked_up" }
      const next = stops.map((s, i) => (i === idx ? { ...s, status: "picked_up", picked_up_at: now } : s))
      const allPicked = next.every((s) => s.status === "picked_up")
      const update: Record<string, unknown> = {
        pickup_stops: next,
        timeline: tl(o.timeline, { status: "store_picked_up", timestamp: now, note: storeId }),
        updated_at: now,
      }
      if (allPicked) {
        update.status = "on_the_way"
        update.picked_up_at = now
      }
      tx.update(ref, update)
      return { ok: true as const, allPicked, customerId: o.customer_id as string | undefined }
    })
    if (!out.ok) return { success: false, error: out.error }
    if (out.allPicked) {
      await notifyCustomer(out.customerId, {
        title: "📦 السائق استلم طلبك",
        title_en: "📦 Driver picked up your order",
        message: "استلم السائق من كل المتاجر وهو في الطريق إليك.",
        message_en: "The driver collected from all stores and is on the way.",
        link: "/account",
        data: { order_id: orderId, status: "on_the_way" },
      })
    }
    return { success: true, status: out.allPicked ? "on_the_way" : "accepted" }
  } catch (e) {
    logError("[dispatch] driverPickupStore", e)
    return { success: false, error: "server_error" }
  }
}

// (4) تسليم للعميل بكود التأكيد — on_the_way (لصاحبها) → delivered + تسجيل النقدية (COD).
// قفل ضد التخمين: بعد 5 محاولات خاطئة نُجمّد المطابقة 15 دقيقة (كود من 4 أرقام).
export async function driverDeliver(driverId: string, orderId: string, code: string): Promise<DispatchResult> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.driver_id !== driverId) return { ok: false as const, error: "not_your_order" }
      if (o.status === "delivered") return { ok: false as const, error: "already_delivered" }
      if (o.status !== "on_the_way") return { ok: false as const, error: "invalid_state" }
      // إثبات التسليم يفشل مغلقًا (fail-closed): طلب توزيع بلا كود صالح (4 أرقام) لا يُسلَّم إطلاقًا —
      // وإلا أمكن تعليمه "مُسلَّم" + تحصيل نقدي + delivery_verified كاذبة بلا كود من العميل.
      const expected = String(o.delivery_code || "").trim()
      if (!/^\d{4}$/.test(expected)) return { ok: false as const, error: "no_delivery_code" }
      const lockedUntil = Number(o.delivery_code_locked_until) || 0
      if (lockedUntil > Date.now()) return { ok: false as const, error: "too_many_attempts" }
      if (String(code || "").trim() !== expected) {
        const totalFailures = (Number(o.delivery_code_total_failures) || 0) + 1
        const next = (Number(o.delivery_code_attempts) || 0) + 1
        // تصعيد بلا تبريك دائم: النافذة العادية 15د/5 محاولات؛ بعد 20 فشلًا تراكميًا تصير النافذة 24 ساعة
        // (5 محاولات/يوم) — يجعل تخمين الكود غير عمليّ عمليًا مع بقاء استرداد ذاتي (بلا تدخل يدوي).
        const lockMs = totalFailures >= 20 ? 24 * 60 * 60 * 1000 : 15 * 60 * 1000
        tx.update(ref, {
          delivery_code_attempts: next,
          delivery_code_total_failures: FieldValue.increment(1), // عدّاد تراكمي لا يُصفَّر بالقفل (للتصعيد)
          ...(next >= 5 ? { delivery_code_locked_until: Date.now() + lockMs, delivery_code_attempts: 0 } : {}),
        })
        return { ok: false as const, error: "invalid_code" }
      }
      // متاجر مستحِقّة لكاش COD (السائق حصّل الكامل ويحتفظ بأجرته؛ يظلّ مدينًا لكل متجر بقيمة منتجاته)
      // — تُسوّى لاحقًا من /seller/settlements، ويُزال معرّف المتجر من المصفوفة عند تأكيد المتجر استلام كاشه.
      const codStores = o.order_type === "multi_store"
        ? Array.from(new Set((Array.isArray(o.pickup_stops) ? o.pickup_stops : []).map((s: any) => s?.store_id).filter(Boolean)))
        : (o.store_id ? [o.store_id] : [])
      tx.update(ref, {
        status: "delivered",
        delivered_at: now,
        cash_collected: Number(o.total || 0),
        unsettled_cod_store_ids: codStores,
        delivery_verified: true,
        delivery_code_attempts: 0,
        delivery_code_locked_until: FieldValue.delete(),
        delivery_code_total_failures: FieldValue.delete(),
        timeline: tl(o.timeline, { status: "delivered", timestamp: now, note: "تسليم بكود التأكيد" }),
        updated_at: now,
      })
      return { ok: true as const, customerId: o.customer_id as string | undefined }
    })
    if (!out.ok) return { success: false, error: out.error }
    await notifyCustomer(out.customerId, {
      title: "✅ تم تسليم طلبك",
      title_en: "✅ Your order was delivered",
      message: "نتمنى أن ينال إعجابك! قيّم تجربتك من فضلك.",
      message_en: "We hope you enjoyed it! Please rate your experience.",
      link: `/review/${orderId}`,
      data: { order_id: orderId, status: "delivered" },
    })
    return { success: true, status: "delivered" }
  } catch (e) {
    logError("[dispatch] driverDeliver", e)
    return { success: false, error: "server_error" }
  }
}

// خريطة أخطاء التوزيع إلى أكواد HTTP لاستخدامها في route handlers.
export function dispatchErrorStatus(error?: string): number {
  switch (error) {
    case "order_not_found":
      return 404
    case "not_your_order":
    case "already_rejected":
    case "driver_disabled":
    case "driver_not_approved":
      return 403
    case "too_many_attempts":
      return 429
    case "driver_not_found":
    case "server_error":
      return 500
    case "not_dispatch_order":
    case "not_available":
    case "already_taken":
    case "offer_expired":
    case "invalid_state":
    case "already_delivered":
    case "no_delivery_code":
    case "use_per_store_pickup":
    case "not_multi_store":
    case "already_picked_up":
    case "store_not_in_order":
      return 409 // تعارض حالة
    default:
      return 400 // reason_required / invalid_code / غير معروف
  }
}
