"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { chunkArray } from "../firebase/firestore-helpers"

type FirestoreRecord = Record<string, unknown>
type FirestoreRecordWithId<T extends FirestoreRecord = FirestoreRecord> = T & { id: string }

type DashboardProduct = FirestoreRecordWithId<{
  name?: string
  stock?: number | string
}>

type DashboardOrder = FirestoreRecordWithId<{
  customer_id?: string
  total?: number | string
  status?: string
  created_at?: string
  delivery_price?: number | string
  driver_commission?: number | string
}>

export type DashboardAnalytics = {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  topProduct: string
  topProductSales: number
  lowStockProducts: number
  averageRating: number
  totalReviews: number
}

export type RecentDashboardOrder = {
  id: string
  customer: string | null
  total: number
  status: string
  date: string
}

async function fetchDocsMap<T extends FirestoreRecord>(db: Firestore, collection: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, FirestoreRecordWithId<T>>()
  }

  const refs = uniqueIds.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, FirestoreRecordWithId<T>>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      map.set(doc.id, { ...(doc.data() as T), id: doc.id })
    }
  })

  return map
}

async function fetchByIn<T extends FirestoreRecord>(db: Firestore, collection: string, field: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  if (uniqueValues.length === 0) return []

  const results: Array<FirestoreRecordWithId<T>> = []
  const chunks = chunkArray(uniqueValues, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection(collection).where(field, "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      results.push({ ...(doc.data() as T), id: doc.id })
    })
  }

  return results
}

export async function getDashboardAnalytics(storeId: string, callerId?: string): Promise<DashboardAnalytics> {
  // Ownership check
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return {
      totalRevenue: 0, totalOrders: 0, totalProducts: 0,
      topProduct: "", topProductSales: 0,
      lowStockProducts: 0, averageRating: 0, totalReviews: 0,
    }
  }

  const db = getAdminDb()

  const productsSnap = await db.collection("products").where("store_id", "==", storeId).get()
  const products: DashboardProduct[] = productsSnap.docs.map((doc) => ({ ...(doc.data() as FirestoreRecord), id: doc.id }))
  const productIds = products.map((product) => product.id)

  const totalProducts = products.length
  const lowStockProducts = products.filter((product) => Number(product.stock || 0) < 10).length

  const ordersSnap = await db.collection("orders").where("store_id", "==", storeId).get()
  const allOrders: DashboardOrder[] = ordersSnap.docs.map((doc) => ({ ...(doc.data() as FirestoreRecord), id: doc.id }))

  // Only count 'delivered' orders for financial totals as requested
  const confirmedOrders = allOrders.filter((order) => order.status === "delivered")

  const totalOrders = confirmedOrders.length
  const totalRevenue = confirmedOrders.reduce((sum: number, order) => {
    const orderTotal = Number(order.total || 0)
    const delivery = Number(order.delivery_price || 0)
    const commission = Number(order.driver_commission || 0)
    return sum + (orderTotal - delivery - commission)
  }, 0)

  const orderItems = await fetchByIn<{
    order_id?: string
    product_id?: string
    quantity?: number | string
  }>(db, "order_items", "product_id", productIds)

  const confirmedOrderIds = new Set(confirmedOrders.map((order) => order.id))
  const productSales: Record<string, { name: string; quantity: number }> = {}
  const productMap = new Map(products.map((product) => [product.id, product] as const))

  orderItems.forEach((item) => {
    const orderId = item.order_id
    const productId = item.product_id
    if (!orderId || !productId) return

    // Only count sales for items that belong to a confirmed (delivered) order
    if (!confirmedOrderIds.has(orderId)) return

    const product = productMap.get(productId)
    if (!product) return
    if (!productSales[productId]) {
      productSales[productId] = { name: product.name || "", quantity: 0 }
    }
    productSales[productId].quantity += Number(item.quantity || 0)
  })

  const topProduct = Object.values(productSales).sort((a, b) => b.quantity - a.quantity)[0] || {
    name: "",
    quantity: 0,
  }

  let averageRating = 0
  let totalReviews = 0

  if (productIds.length > 0) {
    const reviews = await fetchByIn<{
      rating?: number | string
    }>(db, "reviews", "product_id", productIds)
    totalReviews = reviews.length
    if (totalReviews > 0) {
      const sumRatings = reviews.reduce((sum: number, review) => sum + (Number(review.rating) || 0), 0)
      averageRating = sumRatings / totalReviews
    }
  }

  return {
    totalRevenue,
    totalOrders,
    totalProducts,
    topProduct: topProduct.name,
    topProductSales: topProduct.quantity,
    lowStockProducts,
    averageRating: Number(averageRating.toFixed(1)),
    totalReviews,
  }
}

export async function getRecentOrders(storeId: string, limit = 3, callerId?: string): Promise<RecentDashboardOrder[]> {
  // Ownership check
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }
  if (limit <= 0) {
    return []
  }

  const db = getAdminDb()
  // ترتيب تنازلي بتاريخ الإنشاء حتى تظهر "أحدث" الطلبات فعلاً، مع fallback
  // إلى الترتيب في الذاكرة لو لم يكن فهرس Firestore المركّب متاحًا.
  let snapshot: FirebaseFirestore.QuerySnapshot
  try {
    snapshot = await db
      .collection("orders")
      .where("store_id", "==", storeId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .get()
  } catch {
    const fallback = await db
      .collection("orders")
      .where("store_id", "==", storeId)
      .limit(Math.max(limit * 10, 50))
      .get()
    const sorted = fallback.docs.sort((a, b) =>
      String(b.data().created_at || "").localeCompare(String(a.data().created_at || "")),
    )
    const orders: DashboardOrder[] = sorted.slice(0, limit).map((doc) => ({ ...(doc.data() as FirestoreRecord), id: doc.id }))
    return mapRecentOrders(orders, db)
  }
  const orders: DashboardOrder[] = snapshot.docs.map((doc) => ({ ...(doc.data() as FirestoreRecord), id: doc.id }))
  return mapRecentOrders(orders, db)
}

async function mapRecentOrders(
  orders: DashboardOrder[],
  db: FirebaseFirestore.Firestore,
): Promise<RecentDashboardOrder[]> {
  const customerMap = await fetchDocsMap<{ full_name?: string }>(
    db,
    "users",
    orders.map((order) => order.customer_id || ""),
  )

  return orders.map((order) => {
    const customerId = order.customer_id || ""
    return {
      id: order.id.substring(0, 8).toUpperCase(),
      customer: customerMap.get(customerId)?.full_name?.trim() || null,
      total: Number(order.total || 0),
      status: order.status || "pending",
      date: new Date(String(order.created_at || "")).toLocaleDateString("en-CA"),
    }
  })
}
