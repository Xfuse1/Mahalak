"use server"

import { getAdminDb } from "../firebase/admin"
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
  const r = Math.max(1, Math.min(5, Math.round(Number(rating))))
  const now = new Date().toISOString()

  console.log(`[storeReviews] Upserting review: store=${storeId}, customer=${customerId}, rating=${r}`)

  try {
    const existingSnap = await db
      .collection("store_reviews")
      .where("store_id", "==", storeId)
      .where("customer_id", "==", customerId)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0]
      await doc.ref.update({
        rating: r,
        comment: comment || null,
        updated_at: now
      })
      console.log(`[storeReviews] Updated existing review: ${doc.id}`)
    } else {
      const newDoc = await db.collection("store_reviews").add({
        store_id: storeId,
        customer_id: customerId,
        rating: r,
        comment: comment || null,
        created_at: now,
        updated_at: now,
      })
      console.log(`[storeReviews] Created new review: ${newDoc.id}`)
    }

    // Recalculate average
    const rowsSnap = await db.collection("store_reviews").where("store_id", "==", storeId).get()
    const ratings = rowsSnap.docs.map((doc) => Number(doc.data().rating || 0))
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0

    console.log(`[storeReviews] New average for store ${storeId}: ${avg} (${ratings.length} reviews)`)

    await updateStore(storeId, { rating: avg })

    return { success: true, average: avg }
  } catch (error: any) {
    console.error("[storeReviews] upsertStoreReview error:", error)
    return { success: false, average: null, error: error?.message || "Internal server error" }
  }
}
