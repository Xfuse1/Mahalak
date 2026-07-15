import { headers } from "next/headers"
import { getAdminDb } from "@/lib/firebase/admin"

// تحديد معدل بسيط مبني على Firestore لكبح إساءة استخدام الإجراءات غير الموثّقة
// (مثل تعداد الحسابات عبر getUserByPhone). يفشل-مفتوحًا: أي خطأ بنيوي لا يحجب المستخدم الشرعي.
export async function checkRateLimit(
  action: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const h = await headers()
    // نُفضّل مصادر IP الموثوقة (يضبطها البروكسي/Vercel) قبل x-forwarded-for القابل للانتحال،
    // ثم نُعقّم الناتج قبل استخدامه في معرّف مستند Firestore (وجود "/" كان يرمي → fail-open).
    const ip = (h.get("x-real-ip") || h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for") || "unknown")
      .split(",")[0]
      .trim()
    const safeIp = ip.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 100) || "unknown"
    const key = `${action}:${safeIp}`
    const db = getAdminDb()
    const ref = db.collection("rate_limits").doc(key)
    const now = Date.now()

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.exists ? (snap.data() as { count?: number; resetAt?: number }) : undefined
      if (!data || !data.resetAt || data.resetAt < now) {
        tx.set(ref, { count: 1, resetAt: now + windowMs })
        return true
      }
      if ((data.count || 0) >= max) {
        return false
      }
      tx.update(ref, { count: (data.count || 0) + 1 })
      return true
    })
  } catch {
    return true // fail-open: لا نحجب المستخدمين الشرعيين بسبب خطأ في طبقة تحديد المعدل
  }
}
