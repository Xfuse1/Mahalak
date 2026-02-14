"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"
import { logError } from "@/lib/logger"

// Generate a temporary token after successful OTP verification for password reset
export async function generatePasswordResetToken(userId: string) {
  try {
    const db = getAdminDb()
    const token = crypto.randomUUID()
    await db.collection("password_reset_tokens").doc(token).set({
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    })
    return { success: true, token }
  } catch (error: any) {
    logError("[v0] Error generating reset token:", error)
    return { success: false, error: error?.message || "Failed to generate reset token" }
  }
}

// Reset user password using Firebase Admin SDK - requires a valid reset token
export async function resetUserPassword(userId: string, newPassword: string, token: string) {
  try {
    const db = getAdminDb()

    // Validate the reset token
    const tokenDoc = await db.collection("password_reset_tokens").doc(token).get()
    if (!tokenDoc.exists) {
      return { success: false, error: "Invalid or expired reset token" }
    }

    const tokenData = tokenDoc.data()!
    if (tokenData.userId !== userId) {
      return { success: false, error: "Token does not match user" }
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      // Clean up expired token
      await tokenDoc.ref.delete()
      return { success: false, error: "Reset token has expired" }
    }

    // Token is valid - reset the password
    const auth = getAdminAuth()
    await auth.updateUser(userId, { password: newPassword })

    // Delete the used token
    await tokenDoc.ref.delete()

    return { success: true }
  } catch (error: any) {
    logError("[v0] Error resetting password via admin:", error)
    return { success: false, error: error?.message || "Failed to reset password" }
  }
}

// Store pending registration data server-side (avoids storing password in sessionStorage)
export async function storePendingRegistration(data: Record<string, any>) {
  try {
    const db = getAdminDb()
    const token = crypto.randomUUID()
    await db.collection("pending_registrations").doc(token).set({
      ...data,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    })
    return { success: true, token }
  } catch (error: any) {
    logError("[v0] Error storing pending registration:", error)
    return { success: false, error: error?.message || "Failed to store registration data" }
  }
}

// Retrieve and delete pending registration data
export async function retrievePendingRegistration(token: string) {
  try {
    const db = getAdminDb()
    const doc = await db.collection("pending_registrations").doc(token).get()

    if (!doc.exists) {
      return { success: false, error: "Registration data not found or expired" }
    }

    const data = doc.data()!
    if (new Date(data.expiresAt) < new Date()) {
      await doc.ref.delete()
      return { success: false, error: "Registration data has expired" }
    }

    // Delete after retrieval (one-time use)
    await doc.ref.delete()

    // Remove internal fields before returning
    const { createdAt, expiresAt, ...registrationData } = data
    return { success: true, data: registrationData }
  } catch (error: any) {
    logError("[v0] Error retrieving pending registration:", error)
    return { success: false, error: error?.message || "Failed to retrieve registration data" }
  }
}

// Check if phone number exists in the database and return user data
export async function getUserByPhone(phone: string) {
  const db = getAdminDb()
  
  // Normalize phone number (remove spaces, ensure proper format)
  const normalizedPhone = phone.replace(/\s/g, "").trim()
  
  try {
    const snapshot = await db.collection("users")
      .where("phone", "==", normalizedPhone)
      .limit(1)
      .get()
    
    if (snapshot.empty) {
      return { success: false, error: "phone_not_found" }
    }
    
    const userDoc = snapshot.docs[0]
    const userData = userDoc.data()
    
    return { 
      success: true, 
      data: { 
        id: userDoc.id,
        email: userData.email,
        phone: userData.phone,
        full_name: userData.full_name,
      } 
    }
  } catch (error: any) {
    logError("[v0] Error finding user by phone:", error)
    return { success: false, error: error?.message || "Failed to find user" }
  }
}

export async function updateProfile(
  userId: string,
  data: Partial<{ full_name: string; phone: string; street: string; city: string; country: string }>,
  callerUserId: string,
) {
  // Verify the caller is the same user
  if (callerUserId !== userId) {
    return { success: false, error: "Unauthorized: cannot modify another user's profile" }
  }

  const db = getAdminDb()
  const docRef = db.collection("users").doc(userId)

  const updateData = cleanUndefined({
    full_name: data.full_name,
    phone: data.phone,
    street: data.street,
    city: data.city,
    country: data.country,
    updated_at: new Date().toISOString(),
  })

  try {
    await docRef.set(updateData, { merge: true })
  } catch (error: any) {
    logError("[v0] Error updating profile:", error)
    return { success: false, error: error?.message || "Failed to update profile" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Profile not found" }
  }

  revalidatePath("/account")
  return { success: true, data: { id: updatedSnap.id, ...(updatedSnap.data() as Record<string, any>) } }
}
