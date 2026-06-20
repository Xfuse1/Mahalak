"use server"

import { cookies } from "next/headers"
import { getAdminAuth } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_EXPIRES_IN_MS,
} from "@/lib/auth/session"

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
