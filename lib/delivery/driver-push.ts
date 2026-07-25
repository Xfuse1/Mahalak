// إرسال FCM للسائق (تطبيق أندرويد أصلي). بخلاف server-push.ts (web push بمفتاح VAPID)، ده يبعت
// رسالة native للرموز المخزّنة في fcm_tokens (owner_type:"driver"). أداة سيرفر فقط، أفضل-جهد،
// لا ترمي أبدًا — فشل الدفع يجب ألا يعطّل تدفّق التوزيع.
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin"
import { logServerError } from "@/lib/server-error-log"

export async function sendPushToDriver(
  driverId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  try {
    if (!driverId) return
    const db = getAdminDb()
    const snap = await db
      .collection("fcm_tokens")
      .where("owner_type", "==", "driver")
      .where("owner_id", "==", driverId)
      .get()
    const tokens = snap.docs
      .map((d) => (d.data() as { token?: string }).token)
      .filter((t): t is string => typeof t === "string" && t.length > 0)
    if (!tokens.length) return // لا-عملية بلا رموز (السائق لم يسجّل جهازه بعد)

    const res = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: {
        priority: "high", // عروض التوصيل حسّاسة للوقت — توصيل فوري حتى في وضع Doze
        notification: { channelId: "offers", sound: "default" },
      },
    })

    // تنظيف الرموز الميتة كي لا تتراكم (نفس منطق server-push).
    if (res.failureCount > 0) {
      const dead: string[] = []
      res.responses.forEach((r, i) => {
        const code = r.error?.code
        if (
          !r.success &&
          (code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token" ||
            code === "messaging/invalid-argument")
        ) {
          dead.push(tokens[i])
        }
      })
      await Promise.all(dead.map((tk) => db.collection("fcm_tokens").doc(tk).delete().catch(() => {})))
    }
  } catch (error) {
    await logServerError("sendPushToDriver", error, { driverId })
  }
}

// إشعار كل السائقين المؤهَّلين بعرض جديد. يُستدعى عند دخول الطلب حالة offering (تأكيد التاجر أو
// إعادة العرض). أفضل-جهد: يُشعِر المتاحين المعتمَدين غير المعطَّلين، ويستبعد من رفض هذا الطلب.
export async function notifyDriversOfOffer(order: {
  id: string
  delivery_price?: number
  delivery_city?: string
  distance_km?: number
  rejected_by?: string[]
}): Promise<{ notified: number }> {
  try {
    const db = getAdminDb()
    const snap = await db.collection("drivers").limit(500).get()
    const rejected = new Set(Array.isArray(order.rejected_by) ? order.rejected_by : [])
    const eligible = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) } as Record<string, any>))
      .filter((d) => (d.isApproved ?? d.is_approved ?? false) === true)
      .filter((d) => d.disabled !== true)
      .filter((d) => (d.isActive ?? d.is_available ?? true) !== false)
      // متاح للورديّة: يجب أن يكون السائق أونلاين صراحةً (الغائب = غير متاح) — متسق مع لوحة المراقبة
      // و/admin/drivers، وكي لا تصل عروض حسّاسة للوقت لسائق لم يبدأ ورديّته.
      .filter((d) => (d.isOnline ?? d.is_online ?? false) === true)
      .filter((d) => !rejected.has(d.id))

    const fee = order.delivery_price != null ? `${order.delivery_price} ج` : ""
    const dist = order.distance_km != null ? ` • ${order.distance_km} كم` : ""
    const city = order.delivery_city ? ` • ${order.delivery_city}` : ""
    let notified = 0
    await Promise.all(
      eligible.map((d) =>
        sendPushToDriver(d.id, {
          title: "🚕 طلب توصيل جديد",
          body: `${fee}${dist}${city} — اقبل من التطبيق`.trim(),
          data: { type: "offer", order_id: order.id },
        }).then(() => {
          notified++
        }),
      ),
    )
    return { notified }
  } catch (error) {
    await logServerError("notifyDriversOfOffer", error, { orderId: order.id })
    return { notified: 0 }
  }
}
