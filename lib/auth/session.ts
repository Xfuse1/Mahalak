import { cookies } from "next/headers"
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"

// اسم كوكي الجلسة (متوافق مع Firebase Hosting و Vercel)
export const SESSION_COOKIE_NAME = "__session"
// مدة صلاحية الجلسة: 14 يوم (بالميلي ثانية)
export const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 14 * 1000

export const SESSION_COOKIE_OPTIONS = {
  maxAge: SESSION_EXPIRES_IN_MS / 1000,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: "lax" as const,
}

/**
 * يقرأ كوكي الجلسة ويتحقق منه عبر Firebase Admin، ويُرجع معرّف المستخدم الموثّق.
 * هذا هو المصدر الوحيد الموثوق لهوية المستدعي داخل server actions.
 * يُرجع null إذا لم تكن هناك جلسة صالحة (غير مسجّل دخول).
 */
export async function getCurrentUid(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!session) return null
    // checkRevoked = true لاكتشاف الجلسات المُبطلة (تسجيل خروج/تعطيل الحساب)
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    return decoded.uid
  } catch {
    return null
  }
}

/**
 * يُرجع معرّف المستخدم الموثّق أو يرمي خطأً إذا لم يكن مسجّل دخول.
 * يُستخدم في الطفرات والقراءات الخاصة التي تتطلب مصادقة إجبارية.
 */
export async function requireUid(): Promise<string> {
  const uid = await getCurrentUid()
  if (!uid) {
    throw new Error("UNAUTHENTICATED")
  }
  return uid
}

/**
 * يتحقق أن المستخدم الموثّق (من الجلسة) يطابق المالك المتوقّع.
 * يُرجع true فقط عند وجود جلسة صالحة ومطابقة — وإلا false (لا نثق بأي معرّف من العميل).
 */
export async function requireOwner(ownerId: string): Promise<boolean> {
  const uid = await getCurrentUid()
  return uid != null && uid === ownerId
}

export type CurrentUser = {
  uid: string
  role: "customer" | "seller" | "driver" | "admin"
  email?: string
}

/**
 * يُرجع المستخدم الموثّق مع دوره (من مجموعة users) أو null إن لم يكن مسجّلًا.
 * الدور يُشتق من قاعدة البيانات وليس من العميل.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const uid = await getCurrentUid()
  if (!uid) return null
  try {
    const snap = await getAdminDb().collection("users").doc(uid).get()
    const data = snap.data()
    return {
      uid,
      role: (data?.role as CurrentUser["role"]) || "customer",
      email: data?.email,
    }
  } catch {
    return { uid, role: "customer" }
  }
}
