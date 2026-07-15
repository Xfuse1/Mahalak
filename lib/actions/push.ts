"use server"

// تسجيل/حذف رموز FCM. يُحدَّد المالك سيرفر-سايد من الجلسة الموثّقة (مستخدم Firebase أو سائق)
// — لا نثق بأي هوية من العميل. تُخزَّن في مجموعة عليا fcm_tokens مفتاحها الرمز نفسه (مستند لكل
// جهاز)، فتُبسِّط تعدّد الأجهزة. لا ترمي أبدًا (تُسجَّل الأخطاء وتُرجع {success:false}).
import { getAdminDb } from "@/lib/firebase/admin"
import { logServerError } from "@/lib/server-error-log"
import { getCurrentUid } from "@/lib/auth/session"
import { getCurrentDriverId } from "@/lib/auth/driver-session"

export async function saveFcmToken(token: string): Promise<{ success: boolean }> {
  try {
    if (!token || typeof token !== "string") return { success: false }

    // هوية المالك من الجلسة: مستخدم Firebase أولًا، وإلا سائق (جلسة PIN)، وإلا نرفض.
    let ownerType: "user" | "driver" | null = null
    let ownerId: string | null = null

    const uid = await getCurrentUid()
    if (uid) {
      ownerType = "user"
      ownerId = uid
    } else {
      const driverId = await getCurrentDriverId()
      if (driverId) {
        ownerType = "driver"
        ownerId = driverId
      }
    }

    if (!ownerType || !ownerId) return { success: false }

    await getAdminDb()
      .collection("fcm_tokens")
      .doc(token)
      .set(
        {
          token,
          owner_type: ownerType,
          owner_id: ownerId,
          updated_at: new Date().toISOString(),
        },
        { merge: true },
      )

    return { success: true }
  } catch (error) {
    await logServerError("saveFcmToken", error)
    return { success: false }
  }
}

export async function removeFcmToken(token: string): Promise<{ success: boolean }> {
  try {
    if (!token || typeof token !== "string") return { success: false }

    // تحقّق من الملكية قبل الحذف — وإلا أمكن لأي مستخدم حذف رمز جهاز غيره (تعطيل إشعاراته)
    const ref = getAdminDb().collection("fcm_tokens").doc(token)
    const snap = await ref.get()
    if (!snap.exists) return { success: true }
    const data = snap.data() || {}

    const uid = await getCurrentUid()
    const drv = uid ? null : await getCurrentDriverId()
    const isOwner =
      (data.owner_type === "user" && data.owner_id === uid) ||
      (data.owner_type === "driver" && data.owner_id === drv)
    if (!isOwner) return { success: false }

    await ref.delete()
    return { success: true }
  } catch (error) {
    await logServerError("removeFcmToken", error)
    return { success: false }
  }
}
