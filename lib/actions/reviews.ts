"use server"

import { getAdminDb } from "@/lib/firebase/admin"

type ReviewRecord = Record<string, any>

/**
 * Get a specific user's review for a product (or null).
 */
export async function getUserReview(productId: string, customerId: string) {
  const db = getAdminDb()

  const snapshot = await db
    .collection("reviews")
    .where("product_id", "==", productId)
    .where("customer_id", "==", customerId)
    .limit(1)
    .get()

  const docSnap = snapshot.docs[0]
  if (!docSnap) {
    return null
  }

  return { id: docSnap.id, ...(docSnap.data() as ReviewRecord) }
}

/**
 * Upsert a user's rating for a product.
 * Recomputes products.rating and products.rating_count.
 */
export async function upsertReview(productId: string, customerId: string, rating: number) {
  const db = getAdminDb()

  // Clamp + round to the 1..5 scale
  const r = Math.max(1, Math.min(5, Math.round(rating)))

  const existingSnap = await db
    .collection("reviews")
    .where("product_id", "==", productId)
    .where("customer_id", "==", customerId)
    .limit(1)
    .get()

  const now = new Date().toISOString()

  if (existingSnap.docs[0]) {
    const docRef = existingSnap.docs[0].ref
    await docRef.set({ rating: r, updated_at: now }, { merge: true })
  } else {
    await db.collection("reviews").doc().set({
      product_id: productId,
      customer_id: customerId,
      rating: r,
      created_at: now,
      updated_at: now,
    })
  }

  const reviewsSnap = await db.collection("reviews").where("product_id", "==", productId).get()
  const ratings = reviewsSnap.docs.map((doc) => Number((doc.data() as ReviewRecord).rating || 0))
  const count = ratings.length
  const avg = count > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0

  await db.collection("products").doc(productId).set(
    {
      rating: avg,
      rating_count: count,
      updated_at: now,
    },
    { merge: true },
  )

  return {
    success: true,
    average: avg,
    count,
  }
}

/**
 * (Optional) Get the current average rating & count for a product.
 */
export async function getProductRating(productId: string) {
  const db = getAdminDb()
  const docSnap = await db.collection("products").doc(productId).get()

  if (!docSnap.exists) {
    return { rating: null, rating_count: 0 }
  }

  const data = docSnap.data() as Record<string, any>
  return { rating: data?.rating ?? null, rating_count: data?.rating_count ?? 0 }
}
