"use server"

import { cookies } from "next/headers"
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_EXPIRES_IN_MS,
  getCurrentUid,
} from "@/lib/auth/session"

// نسخة الشروط السارية وقت الموافقة — تطابق «آخر تحديث» في app/terms/page.tsx.
// ثابت محلي بلا export: ملف "use server" لا يصدّر إلا دوال async.
const TERMS_VERSION = "2026-06"

/**
 * ينشئ كوكي جلسة موثّق من ID token صادر عن Firebase (client SDK).
 * يُستدعى من العميل بعد تسجيل الدخول/التسجيل وعند تغيّر حالة المصادقة.
 */
export async function createSession(idToken: string): Promise<{ success: boolean }> {
  try {
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    })
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, SESSION_COOKIE_OPTIONS)
    return { success: true }
  } catch (error) {
    logError("[auth-session] Failed to create session:", error)
    return { success: false }
  }
}

type EnsureProfileInput = {
  email?: string
  full_name?: string
  role?: "customer" | "seller"
  phone?: string | null
  street?: string | null
  city?: string | null
  country?: string | null
}

/**
 * ينشئ مستند ملف المستخدم سيرفر-سايد (Admin SDK) إذا لم يكن موجودًا.
 * الهوية من كوكي الجلسة فقط، و`role` مُعقَّم: لا يُسمح إلا بـ customer/seller من العميل
 * (أبدًا admin/driver) — هذا يسدّ رفع الصلاحية الذاتي عبر كتابة role من Web SDK.
 * موجود مسبقًا؟ لا نلمس role أو الحقول الحسّاسة — فقط نُرجع الدور الحالي.
 */
export async function ensureUserProfile(
  input: EnsureProfileInput,
): Promise<{ success: boolean; created?: boolean; role?: string; error?: string }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) {
      return { success: false, error: "Unauthenticated" }
    }
    const db = getAdminDb()
    const ref = db.collection("users").doc(uid)
    const snap = await ref.get()

    // تعقيم الدور: العميل لا يستطيع منح نفسه admin/driver
    const safeRole: "customer" | "seller" = input.role === "seller" ? "seller" : "customer"

    if (!snap.exists) {
      const now = new Date().toISOString()
      await ref.set({
        email: input.email ?? "",
        full_name: input.full_name ?? "",
        role: safeRole,
        phone: input.phone ?? null,
        phone_verified: false,
        phone_verified_at: null,
        street: input.street ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        // موافقة الشروط تُختم سيرفر-سايد لحظة إنشاء الحساب — لا تُقبل كعلم من العميل.
        // سياسة المحتوى المُنشأ بواسطة المستخدمين في Google Play تشترط موافقة قبل الرفع،
        // والنسخة تُحفظ كي نعرف على أي إصدار وافق كل مستخدم عند تحديث الشروط لاحقًا.
        terms_accepted: true,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        created_at: now,
        updated_at: now,
      })
      return { success: true, created: true, role: safeRole }
    }

    return { success: true, created: false, role: (snap.data()?.role as string) || "customer" }
  } catch (error) {
    logError("[auth-session] Failed to ensure user profile:", error)
    return { success: false, error: "Failed to ensure profile" }
  }
}

/** يحذف كوكي الجلسة (تسجيل الخروج). */
export async function destroySession(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE_NAME)
    return { success: true }
  } catch (error) {
    logError("[auth-session] Failed to destroy session:", error)
    return { success: false }
  }
}
