"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"

type ReviewRecord = Record<string, any>

/**
 * Get a specific user's review for a product (or null).
 */
export async function getUserReview(productId: string, customerId: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== customerId) return null

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
  // الهوية تُشتق من الجلسة الموثّقة — لا نثق بـ customerId القادم من العميل
  const uid = await getCurrentUid()
  if (!uid || uid !== customerId) {
    return { success: false, error: "Unauthorized", average: 0, count: 0 }
  }

  const db = getAdminDb()

  // التحقق من أن العميل اشترى هذا المنتج
  const ordersSnap = await db.collection("orders")
    .where("customer_id", "==", customerId)
    .where("status", "==", "delivered")
    .get()

  if (!ordersSnap.empty) {
    const orderIds = ordersSnap.docs.map(doc => doc.id)
    // Check order_items for this product in chunks of 10 (Firestore 'in' limit)
    let hasPurchased = false
    for (let i = 0; i < orderIds.length && !hasPurchased; i += 10) {
      const chunk = orderIds.slice(i, i + 10)
      const itemsSnap = await db.collection("order_items")
        .where("order_id", "in", chunk)
        .where("product_id", "==", productId)
        .limit(1)
        .get()
      if (!itemsSnap.empty) hasPurchased = true
    }
    if (!hasPurchased) {
      return { success: false, error: "يجب شراء المنتج قبل تقييمه", average: 0, count: 0 }
    }
  } else {
    return { success: false, error: "يجب شراء المنتج قبل تقييمه", average: 0, count: 0 }
  }

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



// ==================== Order Review System ====================

type OrderReview = {
  id: string
  order_id: string
  customer_id: string
  driver_id?: string
  driver_rating?: number
  driver_comment?: string
  products_ratings?: Array<{
    product_id: string
    rating: number
    comment?: string
  }>
  created_at?: string
}

// Create a complete review for an order (products + driver)
export async function createOrderReview(data: {
  order_id: string
  customer_id: string
  driver_id?: string
  driver_rating?: number
  driver_comment?: string
  products_ratings?: Array<{
    product_id: string
    rating: number
    comment?: string
  }>
}) {
  try {
    // الهوية تُشتق من الجلسة الموثّقة — لا نثق بـ customer_id القادم من العميل
    const uid = await getCurrentUid()
    if (!uid || uid !== data.customer_id) {
      return { success: false, error: "Unauthorized" }
    }

    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check if review already exists for this order
    const existingReview = await db
      .collection("order_reviews")
      .where("order_id", "==", data.order_id)
      .where("customer_id", "==", data.customer_id)
      .limit(1)
      .get()

    if (!existingReview.empty) {
      return { success: false, error: "لقد قمت بتقييم هذا الطلب مسبقاً" }
    }

    // Create the order review
    const reviewRef = await db.collection("order_reviews").add({
      ...data,
      created_at: now,
    })

    // Update driver rating if provided
    if (data.driver_id && data.driver_rating) {
      await updateDriverRatingAverage(data.driver_id, data.driver_rating)
    }

    // Update each product's rating
    if (data.products_ratings && data.products_ratings.length > 0) {
      for (const productRating of data.products_ratings) {
        await upsertReview(productRating.product_id, data.customer_id, productRating.rating)
      }
    }

    // Mark the order as reviewed
    const orderSnapshot = await db
      .collection("orders")
      .where("order_id", "==", data.order_id)
      .limit(1)
      .get()
    
    if (!orderSnapshot.empty) {
      await orderSnapshot.docs[0].ref.update({
        is_reviewed: true,
        reviewed_at: now,
      })
    }

    return { success: true, id: reviewRef.id }
  } catch (error: any) {
    return { success: false, error: error?.message || "Failed to create review" }
  }
}

// Update driver's average rating
async function updateDriverRatingAverage(driverId: string, _newRating: number) {
  try {
    const db = getAdminDb()
    const driverRef = db.collection("drivers").doc(driverId)
    const driverDoc = await driverRef.get()

    if (!driverDoc.exists) return

    // إعادة الحساب من المصدر: كل تقييمات السائق في order_reviews — حتى لا يختلط
    // عدّاد التقييمات بعدّاد التوصيلات (total_deliveries) كما كان يحدث سابقًا.
    const reviewsSnap = await db
      .collection("order_reviews")
      .where("driver_id", "==", driverId)
      .get()
    const ratings = reviewsSnap.docs
      .map((doc) => Number(doc.data().driver_rating || 0))
      .filter((n) => n > 0)
    const ratingCount = ratings.length
    const avg = ratingCount > 0 ? ratings.reduce((a, b) => a + b, 0) / ratingCount : 0

    await driverRef.update({
      rating: Math.round(avg * 10) / 10,
      rating_count: ratingCount,
      updated_at: new Date().toISOString(),
    })
  } catch (_error) {
    // silently fail — non-critical operation
  }
}

// Check if order has been reviewed
export async function hasOrderBeenReviewed(orderId: string, customerId: string): Promise<boolean> {
  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("order_reviews")
      .where("order_id", "==", orderId)
      .where("customer_id", "==", customerId)
      .limit(1)
      .get()

    return !snapshot.empty
  } catch (_error) {
    return false
  }
}


