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

    // تحميل الطلب والتحقق منه سيرفر-سايد — لا نثق بـ order_id/driver_id/driver_rating القادمة من العميل.
    // بدون هذا يمكن حقن تقييمات مزيّفة بأرقام طلبات عشوائية على أي سائق.
    // الطلبات مُفهرَسة بمعرّف المستند (لا يوجد حقل order_id بداخلها) — نحمّلها بالمعرّف مباشرة،
    // مع رجوع احتياطي لاستعلام حقل order_id توافقًا مع أي بيانات قديمة.
    let orderDocSnap = await db.collection("orders").doc(data.order_id).get()
    if (!orderDocSnap.exists) {
      const q = await db.collection("orders").where("order_id", "==", data.order_id).limit(1).get()
      if (q.empty) {
        return { success: false, error: "الطلب غير موجود" }
      }
      orderDocSnap = q.docs[0]
    }
    const orderData = orderDocSnap.data() as Record<string, any>
    if (orderData.customer_id !== uid) {
      return { success: false, error: "Unauthorized" }
    }
    if (orderData.status !== "delivered") {
      return { success: false, error: "لا يمكن تقييم طلب لم يُسلَّم بعد" }
    }

    // منع التقييم المكرر لنفس الطلب
    const existingReview = await db
      .collection("order_reviews")
      .where("order_id", "==", data.order_id)
      .where("customer_id", "==", uid)
      .limit(1)
      .get()

    if (!existingReview.empty) {
      return { success: false, error: "لقد قمت بتقييم هذا الطلب مسبقاً" }
    }

    // اشتقاق السائق من الطلب نفسه، وتقييد التقييم في المدى 1..5
    const serverDriverId: string | undefined = orderData.driver_id || undefined
    const driverRating =
      typeof data.driver_rating === "number" && data.driver_rating > 0
        ? Math.max(1, Math.min(5, Math.round(data.driver_rating)))
        : undefined

    // بناء المستند بحقول صريحة (بدل نشر data القادمة من العميل)
    const reviewDoc: Record<string, any> = {
      order_id: data.order_id,
      customer_id: uid,
      created_at: now,
    }
    if (serverDriverId) reviewDoc.driver_id = serverDriverId
    if (driverRating) reviewDoc.driver_rating = driverRating
    if (data.driver_comment) reviewDoc.driver_comment = String(data.driver_comment).slice(0, 2000)
    if (data.products_ratings) reviewDoc.products_ratings = data.products_ratings

    const reviewRef = await db.collection("order_reviews").add(reviewDoc)

    // تحديث تقييم السائق فقط إن كان الطلب يخص سائقًا فعليًا
    if (serverDriverId && driverRating) {
      await updateDriverRatingAverage(serverDriverId, driverRating)
    }

    // Update each product's rating
    if (data.products_ratings && data.products_ratings.length > 0) {
      for (const productRating of data.products_ratings) {
        await upsertReview(productRating.product_id, data.customer_id, productRating.rating)
      }
    }

    // وسم الطلب كمُقيَّم (نعيد استخدام المستند المُحمّل مسبقًا)
    await orderDocSnap.ref.update({
      is_reviewed: true,
      reviewed_at: now,
    })

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


