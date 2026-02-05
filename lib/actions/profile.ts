"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"

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
