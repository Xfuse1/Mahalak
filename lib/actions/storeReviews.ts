"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { updateStore } from "./stores"

type ReviewRecord = Record<string, any>

export async function getUserStoreReview(storeId: string, customerId: string) {
  const db = getAdminDb()

  const snapshot = await db
    .collection("store_reviews")
    .where("store_id", "==", storeId)
    .where("customer_id", "==", customerId)
    .limit(1)
    .get()

  const docSnap = snapshot.docs[0]
  if (!docSnap) {
    return null
  }

  return { id: docSnap.id, ...(docSnap.data() as ReviewRecord) }
}

export async function upsertStoreReview(storeId: string, customerId: string, rating: number, comment?: string) {
  const db = getAdminDb()
  const r = Math.max(1, Math.min(5, Math.round(rating)))
  const now = new Date().toISOString()

  try {
    const existingSnap = await db
      .collection("store_reviews")
      .where("store_id", "==", storeId)
      .where("customer_id", "==", customerId)
      .limit(1)
      .get()

    if (existingSnap.docs[0]) {
      await existingSnap.docs[0].ref.set({ rating: r, comment, updated_at: now }, { merge: true })
    } else {
      await db.collection("store_reviews").doc().set({
        store_id: storeId,
        customer_id: customerId,
        rating: r,
        comment,
        created_at: now,
        updated_at: now,
      })
    }

    const rowsSnap = await db.collection("store_reviews").where("store_id", "==", storeId).get()
    const ratings = rowsSnap.docs.map((doc) => Number((doc.data() as ReviewRecord).rating || 0))
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0

    await updateStore(storeId, { rating: avg })
    return { average: avg }
  } catch (error) {
    console.error("[storeReviews] upsertStoreReview error:", error)
    return { average: null }
  }
}
