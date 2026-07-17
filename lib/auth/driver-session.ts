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
  // إبطال جلسات السائق السابقة: إعادة الدخول تُلغي أي كوكي/توكن قديم (يسدّ بقاء كوكي مسروق طوال مدة الجلسة)
  // وتمنع تراكم مستندات الجلسات. عمل محدود (لسائق واحد بضع جلسات).
  try {
    const prior = await db.collection("driver_sessions").where("driverId", "==", driverId).get()
    if (!prior.empty) {
      const batch = db.batch()
      prior.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  } catch {
    // غير حرج — نُكمل إصدار الجلسة الجديدة حتى لو فشل تنظيف القديمة
  }
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
    const db = getAdminDb()
    const snap = await db.collection("driver_sessions").doc(token).get()
    if (!snap.exists) return null
    const data = snap.data() as { driverId?: string; expiresAt?: string }
    if (!data.expiresAt || new Date(data.expiresAt) < new Date()) {
      return null
    }
    const driverId = data.driverId || null
    if (!driverId) return null
    // إنفاذ التعطيل للسائق: السائقون لا يملكون حساب Firebase Auth، فلا ينطبق عليهم فحص
    // verifySessionCookie/updateUser(disabled). لذا هذا هو مكان الإنفاذ الوحيد الموثوق: نقرأ مستند
    // السائق ونُعيد null فورًا إذا كان معطَّلًا (drivers/{id}.disabled === true) — فتُعامَل جلسته
    // كغير موثّقة في الطلب التالي مباشرةً (تعطيل فوري، لا ينتظر انتهاء الجلسة).
    // fail-open على خطأ عابر: القراءة الإضافية (للتعطيل) يجب ألا تُخرج سائقًا صالحًا من جلسته المُتحقَّقة
    // بالفعل عند خطأ شبكة/Firestore عابر. نحجب فقط عند نجاح القراءة وتأكّد disabled === true.
    try {
      const driverSnap = await db.collection("drivers").doc(driverId).get()
      if (driverSnap.exists) {
        const dd = driverSnap.data() as { disabled?: boolean; isApproved?: boolean; is_approved?: boolean } | undefined
        // تعطيل أو رفض صريح (=== false) يُبطل الجلسة فورًا في الطلب التالي (دفاع عمق: إلغاء اعتماد الأدمن
        // يقتل الجلسات النشطة). سياسة لطيفة: الحقل الغائب/undefined لا يحجب.
        if (dd?.disabled === true) return null
        if (dd?.isApproved === false || dd?.is_approved === false) return null
      }
    } catch {
      // خطأ عابر في قراءة التعطيل — نتابع (السائق سيُحجب فورًا عند أول قراءة ناجحة لو كان معطَّلًا).
    }
    return driverId
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
