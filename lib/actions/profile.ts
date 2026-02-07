"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"

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
    console.error("[v0] Error finding user by phone:", error)
    return { success: false, error: error?.message || "Failed to find user" }
  }
}

export async function updateProfile(
  userId: string,
  data: Partial<{ full_name: string; phone: string; street: string; city: string; country: string }>,
) {
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
    console.error("[v0] Error updating profile:", error)
    return { success: false, error: error?.message || "Failed to update profile" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Profile not found" }
  }

  revalidatePath("/account")
  return { success: true, data: { id: updatedSnap.id, ...(updatedSnap.data() as Record<string, any>) } }
}
