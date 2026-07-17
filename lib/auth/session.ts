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
    // checkRevoked = true يجعل Firebase Admin يرفض الجلسة إذا كان الحساب معطَّلًا في Firebase Auth
    // (admin.auth().updateUser(uid,{disabled:true})) أو مُبطَّلة الجلسة — يرمي auth/user-disabled أو
    // auth/session-cookie-revoked. لذلك تعطيل حساب عميل/بائع عبر Firebase Auth يُنفَّذ إجباريًا هنا فورًا
    // في الطلب التالي (بلا قراءة Firestore إضافية على هذا المسار الساخن). طبقة دفاع ثانية (علم
    // users/{uid}.disabled) مُطبَّقة في getCurrentUser للحالات التي لا يوجد فيها سجل Firebase Auth.
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
  // نُبقي "superAdmin" ضمن الاتحاد لأن حسابات المالك مخزَّنة بهذا الدور (camelCase).
  // القيمة الخام تبقى كما هي في قاعدة البيانات؛ الاشتقاق أدناه غير حسّاس لحالة الأحرف.
  role: "customer" | "seller" | "driver" | "admin" | "superAdmin"
  email?: string
  // مشتق (غير حسّاس لحالة الأحرف): هل الدور superAdmin/super_admin؟ — يستخدَم لبوابة إدارة المسؤولين.
  isSuperAdmin: boolean
}

// تعريف الأدوار يعيش في ./roles (نقي، بلا استيراد سيرفري) كي تشاركه مكوّنات العميل —
// الواجهة تُخفي زرًّا والسيرفر يمنع الوصول، وكلاهما يجب أن يجيب نفس السؤال بنفس الإجابة.
// يُعاد تصديره هنا حفاظًا على المستوردين الحاليين من هذا المسار.
import { hasAdminAccess, hasSuperAdminAccess } from "./roles"
export { hasAdminAccess, hasSuperAdminAccess }

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
    const role = (data?.role as CurrentUser["role"]) || "customer"
    // إنفاذ التعطيل (طبقة دفاع ثانية): حساب معطَّل (users/{uid}.disabled === true) يُعامَل كغير موثّق
    // تمامًا كجلسة منتهية — لكن لا نُبرِّك حسابًا إداريًا أبدًا: setAccountDisabled يرفض تعطيل الأدمن،
    // فلو ظهر العلم على مستند أدمن خارج اللوحة (تعديل يدوي/ترقية دور لاحقة) نتجاهله كي يبقى الاسترداد
    // ممكنًا داخل اللوحة. غير ذلك: يُحجب المستخدم فورًا في كل المسارات المعتمِدة على الدور.
    const isPrivileged = hasAdminAccess(data?.role)
    if (!isPrivileged && data?.disabled === true) return null
    return {
      uid,
      role,
      email: data?.email,
      isSuperAdmin: hasSuperAdminAccess(data?.role),
    }
  } catch {
    return { uid, role: "customer", isSuperAdmin: false }
  }
}

/**
 * يتطلب أن يكون المستخدم الموثّق أدمن، وإلا يرمي خطأً.
 * للاستخدام كحارس في مسارات/أكشن الإدارة (الدور يُشتق سيرفر-سايد من قاعدة البيانات).
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  // يقبل admin و superAdmin (superAdmin مجموعة فائقة من admin) — غير حسّاس لحالة الأحرف.
  if (!user || !hasAdminAccess(user.role)) {
    throw new Error("FORBIDDEN")
  }
  return user
}
