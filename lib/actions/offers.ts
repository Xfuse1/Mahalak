"use server"

import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"

type OfferRecord = Record<string, any>

export async function getStoreOffers(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const offers = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as OfferRecord) }))

  offers.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
  return offers
}

export async function createOffer(formData: {
  store_id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
}) {
  const db = getAdminDb()
  const docRef = db.collection("offers").doc()
  const payload = {
    ...formData,
    created_at: new Date().toISOString(),
  }

  try {
    await docRef.set(payload)
  } catch (error: any) {
    console.error("[v0] Error creating offer:", error)
    return { success: false, error: error?.message || "Failed to create offer" }
  }

  revalidatePath("/seller/offers")
  return { success: true, data: { id: docRef.id, ...payload } }
}

export async function updateOffer(
  id: string,
  formData: Partial<{
    title: string
    description: string
    discount_percentage: number
    start_date: string
    end_date: string
  }>,
) {
  const db = getAdminDb()
  const docRef = db.collection("offers").doc(id)

  try {
    await docRef.set(cleanUndefined(formData), { merge: true })
  } catch (error: any) {
    console.error("[v0] Error updating offer:", error)
    return { success: false, error: error?.message || "Failed to update offer" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Offer not found" }
  }

  revalidatePath("/seller/offers")
  return { success: true, data: { id: updatedSnap.id, ...(updatedSnap.data() as OfferRecord) } }
}

export async function deleteOffer(id: string) {
  const db = getAdminDb()

  try {
    await db.collection("offers").doc(id).delete()
  } catch (error: any) {
    console.error("[v0] Error deleting offer:", error)
    return { success: false, error: error?.message || "Failed to delete offer" }
  }

  revalidatePath("/seller/offers")
  return { success: true }
}
