"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"

/**
 * Update phone verification status for a user
 */
export async function updatePhoneVerification(
  userId: string,
  phone: string,
  verified: boolean
) {
  const db = getAdminDb()
  const now = new Date().toISOString()

  try {
    await db.collection("users").doc(userId).set(
      {
        phone,
        phone_verified: verified,
        phone_verified_at: verified ? now : null,
        updated_at: now,
      },
      { merge: true }
    )

    revalidatePath("/seller/settings")
    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error updating phone verification:", error)
    return { success: false, error: error?.message || "Failed to update phone verification" }
  }
}

/**
 * Get phone verification status for a user
 */
export async function getPhoneVerificationStatus(userId: string) {
  const db = getAdminDb()

  try {
    const docSnap = await db.collection("users").doc(userId).get()
    
    if (!docSnap.exists) {
      return { phone: null, verified: false }
    }

    const data = docSnap.data()
    return {
      phone: data?.phone || null,
      verified: data?.phone_verified || false,
      verifiedAt: data?.phone_verified_at || null,
    }
  } catch (error: any) {
    console.error("[v0] Error getting phone verification status:", error)
    return { phone: null, verified: false }
  }
}

/**
 * Check if a phone number is already registered
 */
export async function isPhoneNumberRegistered(phone: string): Promise<boolean> {
  const db = getAdminDb()

  // Format phone number consistently
  let formattedPhone = phone.trim()
  if (!formattedPhone.startsWith("+")) {
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+2" + formattedPhone
    } else {
      formattedPhone = "+20" + formattedPhone
    }
  }

  // Also check without the + prefix
  const phoneVariants = [
    formattedPhone,
    formattedPhone.replace("+", ""),
    phone,
    phone.replace(/\D/g, ""),
  ]

  try {
    for (const variant of phoneVariants) {
      const snapshot = await db
        .collection("users")
        .where("phone", "==", variant)
        .limit(1)
        .get()

      if (!snapshot.empty) {
        return true
      }
    }

    return false
  } catch (error: any) {
    console.error("[v0] Error checking phone registration:", error)
    return false
  }
}
