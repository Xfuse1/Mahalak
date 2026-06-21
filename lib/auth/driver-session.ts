import { cookies } from "next/headers"
import { getAdminDb } from "@/lib/firebase/admin"

// جلسة السائق: السائقون لا يملكون حساب Firebase، فنُصدر لهم توكن جلسة موقّع في Firestore
// بعد التحقق من الـ PIN، ونُخزّنه في كوكي httpOnly. هذا المصدر الوحيد الموثوق لهوية السائق
// داخل server actions (بدل الوثوق بـ driverId القادم من العميل/الرابط).
export const DRIVER_SESSION_COOKIE = "driver_session"
const DRIVER_SESSION_TTL_MS = 60 * 60 * 24 * 7 * 1000 // 7 أيام

const DRIVER_COOKIE_OPTIONS = {
  maxAge: DRIVER_SESSION_TTL_MS / 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: "lax" as const,
}

/**
 * يُنشئ جلسة سائق بعد نجاح التحقق من الـ PIN ويضع الكوكي.
 */
export async function createDriverSession(driverId: string): Promise<void> {
  const db = getAdminDb()
  const token = crypto.randomUUID()
  await db.collection("driver_sessions").doc(token).set({
    driverId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + DRIVER_SESSION_TTL_MS).toISOString(),
  })
  const cookieStore = await cookies()
  cookieStore.set(DRIVER_SESSION_COOKIE, token, DRIVER_COOKIE_OPTIONS)
}

/**
 * يُرجع معرّف السائق الموثّق من كوكي الجلسة، أو null إن لم تكن هناك جلسة صالحة.
 */
export async function getCurrentDriverId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(DRIVER_SESSION_COOKIE)?.value
    if (!token) return null
    const snap = await getAdminDb().collection("driver_sessions").doc(token).get()
    if (!snap.exists) return null
    const data = snap.data() as { driverId?: string; expiresAt?: string }
    if (!data.expiresAt || new Date(data.expiresAt) < new Date()) {
      return null
    }
    return data.driverId || null
  } catch {
    return null
  }
}

/**
 * يتحقق أن السائق الموثّق (من الجلسة) يطابق المعرّف المتوقّع.
 */
export async function isDriver(driverId: string): Promise<boolean> {
  const current = await getCurrentDriverId()
  return current != null && current === driverId
}

/**
 * إنهاء جلسة السائق (تسجيل خروج).
 */
export async function clearDriverSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(DRIVER_SESSION_COOKIE)?.value
  cookieStore.delete(DRIVER_SESSION_COOKIE)
  if (token) {
    try {
      await getAdminDb().collection("driver_sessions").doc(token).delete()
    } catch {
      // تجاهل — حذف غير حرج
    }
  }
}
