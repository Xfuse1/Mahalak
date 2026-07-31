import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { readDispatchSettings, splitDeliveryFee } from "@/lib/delivery/fee"
import { createNotification } from "@/lib/notifications-internal"
import { sendPushToDriver } from "@/lib/delivery/driver-push"
import { sendPushToOwner } from "@/lib/server-push"
import { logError } from "@/lib/logger"

// المزايدة: بدل قبول رسم العدّاد كما هو، يقدّر السائق سعرًا مختلفًا ويرسله للعميل؛ يبقى الطلب
// معروضًا حتى يوافق العميل أو يرفض. الموافقة تُسند الطلب للسائق بسعره وتصحّح الإجمالي بالفرق
// (الإجمالي = المنتجات + التوصيل، وعليه يعتمد تحصيل الدفع عند الاستلام).
// كل شيء خلف علم settings/dispatch.enabled، وكل تغيير حالة داخل معاملة ذرّية.

export type BidResult = { success: boolean; error?: string }

export type OrderBid = {
  driver_id: string
  driver_name: string
  price: number
  reason?: string
  created_at: string
  status: "pending" | "accepted" | "rejected"
}

const MAX_BIDS_PER_ORDER = 10
const MAX_REASON = 200

function tl(existing: unknown, entry: { status: string; timestamp: string; note?: string }) {
  return [...(Array.isArray(existing) ? existing : []), entry]
}

// (1) السائق يقدّم عرض سعر مضاد. عرض واحد فعّال لكل سائق (يستبدل عرضه السابق) وسقف يحدّده الأدمن.
export async function submitDriverBid(
  driverId: string,
  orderId: string,
  price: number,
  reason: string,
): Promise<BidResult> {
  if (!Number.isFinite(price) || price <= 0) return { success: false, error: "invalid_price" }
  const r = String(reason || "").trim().slice(0, MAX_REASON)
  const settings = await readDispatchSettings()
  if (!settings.enabled) return { success: false, error: "dispatch_disabled" }
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
      // سقف المزايدة: نستخدم أرضية = فتح العدّاد كي لا يُعطَّل السقف حين يكون رسم العدّاد 0 (كان
      // `metered > 0` يسمح بعرض غير محدود ساعتها). السقف = max(العدّاد، الأساس) × (1 + النسبة).
      const metered = Number(o.delivery_price || 0)
      const effective = Math.max(metered, Number(settings.base_fare) || 0)
      const cap = effective * (1 + Math.max(0, settings.bid_cap_pct) / 100)
      if (cap > 0 && price > cap) return { ok: false as const, error: "bid_too_high" }
      // تحقق صلاحية السائق (توازيًا مع accept/reject).
      const dSnap = await tx.get(db.collection("drivers").doc(driverId))
      const d = dSnap.exists ? (dSnap.data() as Record<string, any>) : null
      if (!d) return { ok: false as const, error: "driver_not_found" }
      if (d.disabled === true) return { ok: false as const, error: "driver_disabled" }
      if ((d.isApproved ?? d.is_approved ?? false) !== true) return { ok: false as const, error: "driver_not_approved" }
      // سائق غير أونلاين (أو حقله غائب) لا يقدّم عرضًا — وإلا يبقى عرض "ميت" يفشل قبوله دائمًا. متسق مع
      // بثّ العروض (لا يصل العرض إلا لأونلاين) والقبول.
      if ((d.isOnline ?? d.is_online ?? false) !== true) return { ok: false as const, error: "driver_offline" }

      const existing: OrderBid[] = Array.isArray(o.bids) ? o.bids : []
      const others = existing.filter((b) => b?.driver_id !== driverId)
      if (others.length >= MAX_BIDS_PER_ORDER) return { ok: false as const, error: "too_many_bids" }
      const bid: OrderBid = {
        driver_id: driverId,
        driver_name: d.name || "",
        price: Number(price),
        created_at: now,
        status: "pending",
        ...(r ? { reason: r } : {}),
      }
      tx.update(ref, {
        bids: [...others, bid],
        timeline: tl(o.timeline, { status: "driver_bid", timestamp: now, note: `${d.name || ""}: ${price}` }),
        updated_at: now,
      })
      return { ok: true as const, customerId: o.customer_id as string | undefined, driverName: d.name || "" }
    })
    if (!out.ok) return { success: false, error: out.error }
    try {
      if (out.customerId) {
        await createNotification({
          user_id: out.customerId,
          type: "order_status",
          title: "💰 عرض سعر جديد للتوصيل",
          title_en: "💰 New delivery price offer",
          message: `السائق ${out.driverName} يعرض التوصيل مقابل ${price} ج — وافق أو ارفض من صفحة طلباتك.`,
          message_en: `Driver ${out.driverName} offers delivery for ${price} EGP — approve or decline from your orders page.`,
          link: "/account",
          data: { order_id: orderId, bid_price: price, driver_id: driverId },
        })
        // دفع Web Push كذلك (خامل حتى يُضبط VAPID) — العميل قد لا يكون فاتحًا صفحة الطلبات.
        await sendPushToOwner("user", out.customerId, {
          title: "💰 عرض سعر جديد للتوصيل",
          body: `السائق ${out.driverName} يعرض التوصيل مقابل ${price} ج — وافق أو ارفض من صفحة طلباتك.`,
          link: "/account",
        })
      }
    } catch (e) {
      logError("[bids] notify customer", e)
    }
    return { success: true }
  } catch (e) {
    logError("[bids] submitDriverBid", e)
    return { success: false, error: "server_error" }
  }
}

// (2) ردّ العميل على عرض السعر. الموافقة تُسند الطلب بسعر العرض وتصحّح الإجمالي بفرق التوصيل.
// الهوية تُمرَّر من server action بعد التحقق من الجلسة — نتحقق هنا ثانيةً أن الطلب مِلك هذا العميل.
export async function respondToDriverBid(
  customerUid: string,
  orderId: string,
  driverId: string,
  accept: boolean,
): Promise<BidResult> {
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.customer_id !== customerUid) return { ok: false as const, error: "forbidden" }
      if (o.driver_id) return { ok: false as const, error: "already_taken" }
      if (o.status !== "offering") return { ok: false as const, error: "not_available" }
      const bids: OrderBid[] = Array.isArray(o.bids) ? o.bids : []
      const idx = bids.findIndex((b) => b?.driver_id === driverId && b?.status === "pending")
      if (idx < 0) return { ok: false as const, error: "bid_not_found" }
      const bid = bids[idx]

      if (!accept) {
        const next = bids.map((b, i) => (i === idx ? { ...b, status: "rejected" as const } : b))
        tx.update(ref, {
          bids: next,
          timeline: tl(o.timeline, { status: "bid_rejected", timestamp: now, note: bid.driver_name || "" }),
          updated_at: now,
        })
        return { ok: true as const, accepted: false }
      }

      // السائق قد يكون عُطّل/سُحب اعتماده بعد تقديم العرض — نتحقق لحظة الإسناد.
      const dSnap = await tx.get(db.collection("drivers").doc(driverId))
      const d = dSnap.exists ? (dSnap.data() as Record<string, any>) : null
      if (!d) return { ok: false as const, error: "driver_not_found" }
      if (d.disabled === true) return { ok: false as const, error: "driver_disabled" }
      if ((d.isApproved ?? d.is_approved ?? false) !== true) return { ok: false as const, error: "driver_not_approved" }
      // لا نُسند لسائق أطفأ ورديّته بعد تقديم العرض — متسق مع بثّ العروض (لا نُسند لسائق غير متاح).
      if ((d.isOnline ?? d.is_online ?? false) !== true) return { ok: false as const, error: "driver_offline" }

      // شحن مجاني: عرض السائق = أجرته الجديدة؛ نقسّمها بين العميل والتاجر حسب إعداد المتجر المخزَّن
      // على الطلب. سعر المنتجات = الإجمالي − ما كان يدفعه العميل (delivery_price)، يبقى ثابتًا.
      const subtotal = Math.max(0, Number(o.total || 0) - Number(o.delivery_price || 0))
      const bidFee = Number(bid.price)
      const ship = splitDeliveryFee(bidFee, o.free_shipping === true, Number(o.free_shipping_cap) || 0)
      const newTotal = subtotal + ship.delivery_price
      const next = bids.map((b, i) =>
        i === idx ? { ...b, status: "accepted" as const } : b?.status === "pending" ? { ...b, status: "rejected" as const } : b,
      )
      // السائقون الخاسرون (عروضهم كانت معلّقة وصارت مرفوضة) — لنُخطرهم بعد المعاملة أنهم لم يُختاروا.
      const losers = bids
        .filter((b, i) => i !== idx && b?.status === "pending" && typeof b?.driver_id === "string" && b.driver_id)
        .map((b) => b.driver_id as string)
      tx.update(ref, {
        driver_id: driverId,
        driver_name: d.name || "",
        delivery_price: ship.delivery_price,
        driver_fee: ship.driver_fee,
        merchant_absorbed_delivery: ship.merchant_absorbed,
        is_free_shipping: o.free_shipping === true && ship.merchant_absorbed > 0,
        total: newTotal,
        status: "accepted",
        accepted_at: now,
        offer_expires_at_ms: FieldValue.delete(),
        dispatch_stalled: FieldValue.delete(), // خرج من offering ⇒ لم يعد متعثّرًا
        bids: next,
        timeline: tl(o.timeline, { status: "driver_accepted", timestamp: now, note: "بموافقة العميل على عرض السعر" }),
        updated_at: now,
      })
      return { ok: true as const, accepted: true, losers }
    })
    if (!out.ok) return { success: false, error: out.error }
    // إشعار السائق بردّ العميل على عرضه (بدل انتظاره حتى الاستطلاع التالي). أفضل-جهد.
    try {
      if (out.accepted) {
        await sendPushToDriver(driverId, {
          title: "✅ تمت الموافقة على عرضك",
          body: "وافق العميل على سعرك — استلم الطلب من المتجر",
          data: { type: "bid_accepted", order_id: orderId },
        })
        // إخطار السائقين الخاسرين (اختير غيرهم) — متسق مع مسار الرفض الصريح، ومحدود بعدد العروض.
        for (const loserId of out.losers || []) {
          await sendPushToDriver(loserId, {
            title: "لم يتم اختيار عرضك",
            body: "اختار العميل سائقًا آخر لهذا الطلب",
            data: { type: "bid_rejected", order_id: orderId },
          })
        }
      } else {
        await sendPushToDriver(driverId, {
          title: "لم يوافق العميل على عرضك",
          body: "رفض العميل السعر المقترح لهذا الطلب",
          data: { type: "bid_rejected", order_id: orderId },
        })
      }
    } catch (e) {
      logError("[bids] notify driver of bid response", e)
    }
    return { success: true }
  } catch (e) {
    logError("[bids] respondToDriverBid", e)
    return { success: false, error: "server_error" }
  }
}
