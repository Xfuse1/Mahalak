// مُرسل FCM Web Push (أداة سيرفر فقط، مثل server-error-log) — أفضل-جهد، لا يرمي أبدًا.
// لا يُستورَد أبدًا من كود العميل (يستخدم Admin SDK).
//
// خمول على السيرفر (INERT): عندما لا توجد رموز محفوظة للمالك (وهو الحال دائمًا حتى يُضبط
// مفتاح VAPID ويسجّل أحدهم جهازه) تكون الدالة لا-عملية — تعود بعد استعلام واحد فارغ دون أي إرسال.
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin"
import { logServerError } from "@/lib/server-error-log"

export async function sendPushToOwner(
  ownerType: "user" | "driver",
  ownerId: string,
  payload: { title: string; body: string; link?: string },
): Promise<void> {
  try {
    // خمول حقيقي بلا مفتاح VAPID: نعود قبل أي وصول لقاعدة البيانات (لا استعلام Firestore إطلاقًا).
    // متغيّرات NEXT_PUBLIC_ متاحة على السيرفر أيضًا.
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return
    if (!ownerId) return

    const db = getAdminDb()
    const snap = await db
      .collection("fcm_tokens")
      .where("owner_type", "==", ownerType)
      .where("owner_id", "==", ownerId)
      .get()

    const tokens = snap.docs
      .map((d) => (d.data() as { token?: string }).token)
      .filter((t): t is string => typeof t === "string" && t.length > 0)

    // لا-عملية بلا رموز (الحال الدائم حتى ضبط VAPID + تسجيل جهاز) — أمان الخمول على السيرفر.
    // مهم أيضًا: sendEachForMulticast لا يقبل مصفوفة رموز فارغة.
    if (!tokens.length) return

    const res = await getAdminMessaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      webpush: {
        fcmOptions: { link: payload.link || "/" },
        notification: { icon: "/icon-192.png" },
      },
    })

    // تنظيف الرموز الميتة/غير الصالحة (تفادي تراكمها والإرسال إليها لاحقًا).
    if (res.failureCount > 0) {
      const toDelete: string[] = []
      res.responses.forEach((r, i) => {
        if (r.success) return
        const code = r.error?.code
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          toDelete.push(tokens[i])
        }
      })
      await Promise.all(
        toDelete.map((tk) =>
          db
            .collection("fcm_tokens")
            .doc(tk)
            .delete()
            .catch(() => {}),
        ),
      )
    }
  } catch (error) {
    // أفضل-جهد: لا نرمي أبدًا — فشل الدفع لا يجب أن يعطّل تدفّق الطلب.
    await logServerError("sendPushToOwner", error, { ownerType, ownerId })
  }
}
