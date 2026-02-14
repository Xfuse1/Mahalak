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

  // التحقق من أن العميل أجرى طلباً واحداً على الأقل من هذا المتجر
  const ordersSnap = await db.collection("orders")
    .where("customer_id", "==", customerId)
    .where("store_id", "==", storeId)
    .where("status", "==", "delivered")
    .limit(1)
    .get()

  if (ordersSnap.empty) {
    return { success: false, average: null, error: "يجب الشراء من المتجر قبل تقييمه" }
  }

  const r = Math.max(1, Math.min(5, Math.round(Number(rating))))
  const now = new Date().toISOString()

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
    } else {
      await db.collection("store_reviews").add({
        store_id: storeId,
        customer_id: customerId,
        rating: r,
        comment: comment || null,
        created_at: now,
        updated_at: now,
      })
    }

    // Recalculate average
    const rowsSnap = await db.collection("store_reviews").where("store_id", "==", storeId).get()
    const ratings = rowsSnap.docs.map((doc) => Number(doc.data().rating || 0))
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0

    await updateStore(storeId, { rating: avg })

    return { success: true, average: avg }
  } catch (error: any) {
    console.error("[storeReviews] upsertStoreReview error:", error)
    return { success: false, average: null, error: error?.message || "Internal server error" }
  }
}
