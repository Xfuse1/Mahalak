"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"
import { logError } from "@/lib/logger"
import { getEgyptPhoneLookupCandidates, normalizeEgyptPhone } from "@/lib/utils/phone"
import { checkRateLimit } from "@/lib/utils/rate-limit"

const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000
const PENDING_REGISTRATION_TTL_MS = 15 * 60 * 1000

type MutableProfileData = Partial<{
  full_name: string
  phone: string
  street: string
  city: string
  country: string
}>

type PendingRegistrationInput = Record<string, unknown> & {
  phone?: string
}

function buildExpiryDate(ttlMs: number) {
  return new Date(Date.now() + ttlMs).toISOString()
}

function validateTokenExpiry(expiresAt?: string) {
  return Boolean(expiresAt && new Date(expiresAt) >= new Date())
}

function normalizePendingRegistrationPhone(data: PendingRegistrationInput) {
  if (!data.phone) {
    return data
  }

  const normalizedPhone = normalizeEgyptPhone(String(data.phone))
  if (!normalizedPhone) {
    throw new Error("Invalid Egyptian phone number")
  }

  return {
    ...data,
    phone: normalizedPhone,
  }
}

/**
 * يُصدر رمز إعادة تعيين كلمة المرور — لكن فقط بعد إثبات ملكية الهاتف سيرفر-سايد.
 * يستقبل idToken الناتج عن تسجيل الدخول بالهاتف عبر Firebase، يتحقق منه عبر Admin SDK،
 * يستخرج phone_number المُتحقَّق، يربطه بحساب فعلي، ويُصدر الرمز مرتبطًا بذلك الحساب.
 * هذا يمنع الاستيلاء على الحساب: لم يعد يُقبل userId من العميل بلا إثبات (الثغرة السابقة).
 */
export async function generatePasswordResetToken(idToken: string) {
  try {
    if (!idToken) {
      return { success: false, error: "Missing verification token" }
    }

    // 1) التحقق من رمز الهوية: يُثبت أن المستدعي أكمل تحقق الهاتف فعلاً (لا نثق بتحقق العميل وحده)
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const verifiedPhone = typeof decoded.phone_number === "string" ? decoded.phone_number : ""
    if (!verifiedPhone) {
      return { success: false, error: "Phone not verified" }
    }

    // 2) ربط الرقم المُتحقَّق بحساب فعلي في النظام (المصدر الوحيد للهوية هنا)
    const db = getAdminDb()
    const candidates = getEgyptPhoneLookupCandidates(verifiedPhone)
    if (!candidates.length) {
      return { success: false, error: "phone_not_found" }
    }
    const snapshot = await db.collection("users").where("phone", "in", candidates.slice(0, 10)).limit(1).get()
    if (snapshot.empty) {
      return { success: false, error: "phone_not_found" }
    }
    const userId = snapshot.docs[0].id

    // 3) إصدار الرمز مرتبطًا بالـ userId المُشتق سيرفر-سايد فقط
    const token = crypto.randomUUID()
    await db.collection("password_reset_tokens").doc(token).set({
      userId,
      phone: verifiedPhone,
      createdAt: new Date().toISOString(),
      expiresAt: buildExpiryDate(PASSWORD_RESET_TOKEN_TTL_MS),
    })

    return { success: true, token, userId }
  } catch (error: any) {
    logError("[auth/profile] Error generating password reset token:", error)
    return { success: false, error: error?.message || "Failed to generate reset token" }
  }
}

export async function resetUserPassword(userId: string, newPassword: string, token: string) {
  try {
    const db = getAdminDb()
    const tokenDoc = await db.collection("password_reset_tokens").doc(token).get()

    if (!tokenDoc.exists) {
      return { success: false, error: "Invalid or expired reset token" }
    }

    const tokenData = tokenDoc.data() as { userId?: string; expiresAt?: string }

    if (tokenData.userId !== userId) {
      return { success: false, error: "Token does not match user" }
    }

    if (!validateTokenExpiry(tokenData.expiresAt)) {
      await tokenDoc.ref.delete()
      return { success: false, error: "Reset token has expired" }
    }

    const auth = getAdminAuth()
    await auth.updateUser(userId, { password: newPassword })
    await tokenDoc.ref.delete()

    return { success: true }
  } catch (error: any) {
    logError("[auth/profile] Error resetting password:", error)
    return { success: false, error: error?.message || "Failed to reset password" }
  }
}

/**
 * يضبط phone_verified=true للمستخدم الحالي فقط بعد إثبات ملكية الهاتف سيرفر-سايد عبر idToken.
 * يُستدعى بعد التسجيل (الجلسة مُنشأة). يقارن الرقم المُتحقَّق برقم الحساب المخزَّن.
 */
export async function finalizePhoneVerification(idToken: string) {
  try {
    const uid = await getCurrentUid()
    if (!uid) {
      return { success: false, error: "Unauthenticated" }
    }
    if (!idToken) {
      return { success: false, error: "Missing verification token" }
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const verifiedPhone = typeof decoded.phone_number === "string" ? decoded.phone_number : ""
    if (!verifiedPhone) {
      return { success: false, error: "Phone not verified" }
    }

    const db = getAdminDb()
    const userSnap = await db.collection("users").doc(uid).get()
    const storedPhone = userSnap.data()?.phone
    const vNorm = normalizeEgyptPhone(verifiedPhone)
    const uNorm = storedPhone ? normalizeEgyptPhone(String(storedPhone)) : null
    if (!vNorm || !uNorm || vNorm !== uNorm) {
      return { success: false, error: "Phone mismatch" }
    }

    await db.collection("users").doc(uid).update({
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
    })
    return { success: true }
  } catch (error: any) {
    logError("[auth/profile] finalizePhoneVerification error:", error)
    return { success: false, error: error?.message || "Failed to verify phone" }
  }
}

export async function storePendingRegistration(data: PendingRegistrationInput) {
  try {
    const db = getAdminDb()
    const token = crypto.randomUUID()
    const normalizedData = normalizePendingRegistrationPhone(data)

    await db.collection("pending_registrations").doc(token).set({
      ...normalizedData,
      createdAt: new Date().toISOString(),
      expiresAt: buildExpiryDate(PENDING_REGISTRATION_TTL_MS),
    })

    return { success: true, token }
  } catch (error: any) {
    logError("[auth/profile] Error storing pending registration:", error)
    return { success: false, error: error?.message || "Failed to store registration data" }
  }
}

export async function retrievePendingRegistration(token: string) {
  try {
    const db = getAdminDb()
    const docSnap = await db.collection("pending_registrations").doc(token).get()

    if (!docSnap.exists) {
      return { success: false, error: "Registration data not found or expired" }
    }

    const data = docSnap.data() as Record<string, unknown> & { expiresAt?: string }

    if (!validateTokenExpiry(data.expiresAt)) {
      await docSnap.ref.delete()
      return { success: false, error: "Registration data has expired" }
    }

    await docSnap.ref.delete()

    const { createdAt, expiresAt, ...registrationData } = data
    return { success: true, data: registrationData }
  } catch (error: any) {
    logError("[auth/profile] Error retrieving pending registration:", error)
    return { success: false, error: error?.message || "Failed to retrieve registration data" }
  }
}

export async function getUserByPhone(phone: string) {
  try {
    // كبح تعداد الحسابات: حدّ معدل لكل IP (سخيّ حتى لا يعيق تسجيل الدخول الشرعي)
    if (!(await checkRateLimit("getUserByPhone", 30, 10 * 60 * 1000))) {
      return { success: false, error: "too_many_requests" }
    }

    const db = getAdminDb()
    const candidates = getEgyptPhoneLookupCandidates(phone)

    if (!candidates.length) {
      return { success: false, error: "phone_not_found" }
    }

    const snapshot = await db.collection("users").where("phone", "in", candidates.slice(0, 10)).limit(1).get()

    if (snapshot.empty) {
      return { success: false, error: "phone_not_found" }
    }

    const userDoc = snapshot.docs[0]
    const userData = userDoc.data() as Record<string, unknown>

    // نُعيد البريد فقط (يلزمه تسجيل الدخول بالبريد/كلمة المرور). لا نُسرّب full_name قبل المصادقة.
    return {
      success: true,
      data: {
        id: userDoc.id,
        email: typeof userData.email === "string" ? userData.email : "",
        phone: typeof userData.phone === "string" ? userData.phone : "",
      },
    }
  } catch (error: any) {
    logError("[auth/profile] Error finding user by phone:", error)
    return { success: false, error: error?.message || "Failed to find user" }
  }
}

export async function updateProfile(userId: string, data: MutableProfileData, callerUserId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== userId) {
    return { success: false, error: "Unauthorized: cannot modify another user's profile" }
  }

  let normalizedPhone: string | null | undefined
  if (typeof data.phone === "string") {
    normalizedPhone = data.phone.trim() ? normalizeEgyptPhone(data.phone) : null
    if (data.phone.trim() && !normalizedPhone) {
      return { success: false, error: "Invalid Egyptian phone number" }
    }
  }

  const db = getAdminDb()
  const docRef = db.collection("users").doc(userId)

  const updateData = cleanUndefined({
    full_name: data.full_name?.trim(),
    phone: normalizedPhone,
    street: data.street?.trim(),
    city: data.city?.trim(),
    country: data.country?.trim(),
    updated_at: new Date().toISOString(),
  })

  try {
    await docRef.set(updateData, { merge: true })
  } catch (error: any) {
    logError("[auth/profile] Error updating profile:", error)
    return { success: false, error: error?.message || "Failed to update profile" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Profile not found" }
  }

  revalidatePath("/account")
  return { success: true, data: { id: updatedSnap.id, ...(updatedSnap.data() as Record<string, any>) } }
}
