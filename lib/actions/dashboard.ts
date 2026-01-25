"use server"

import type { FirebaseFirestore } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import { chunkArray } from "@/lib/firebase/firestore-helpers"

type RecordMap = Record<string, any>

async function fetchDocsMap(db: FirebaseFirestore.Firestore, collection: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, RecordMap>()
  }

  const refs = uniqueIds.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, RecordMap>()

  docs.forEach((doc) => {
    if (doc.exists) {
      map.set(doc.id, { id: doc.id, ...(doc.data() as RecordMap) })
    }
  })

  return map
}

async function fetchByIn(db: FirebaseFirestore.Firestore, collection: string, field: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  if (uniqueValues.length === 0) return []

  const results: RecordMap[] = []
  const chunks = chunkArray(uniqueValues, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection(collection).where(field, "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      results.push({ id: doc.id, ...(doc.data() as RecordMap) })
    })
  }

  return results
}

export async function getDashboardAnalytics(storeId: string) {
  const db = getAdminDb()

  const productsSnap = await db.collection("products").where("store_id", "==", storeId).get()
  const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordMap) }))
  const productIds = products.map((product) => product.id)

  const totalProducts = products.length
  const lowStockProducts = products.filter((product) => Number(product.stock || 0) < 10).length

  const ordersSnap = await db.collection("orders").where("store_id", "==", storeId).get()
  const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordMap) }))

  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

  const orderItems = await fetchByIn(db, "order_items", "product_id", productIds)

  const productSales: Record<string, { name: string; quantity: number }> = {}
  const productMap = new Map(products.map((product) => [product.id, product]))

  orderItems.forEach((item) => {
    const product = productMap.get(item.product_id)
    if (!product) return
    if (!productSales[item.product_id]) {
      productSales[item.product_id] = { name: product.name, quantity: 0 }
    }
    productSales[item.product_id].quantity += Number(item.quantity || 0)
  })

  const topProduct = Object.values(productSales).sort((a, b) => b.quantity - a.quantity)[0] || {
    name: "Ù„Ø§ ÙŠÙˆØ¬Ø¯",
    quantity: 0,
  }

  let averageRating = 0
  let totalReviews = 0

  if (productIds.length > 0) {
    const reviews = await fetchByIn(db, "reviews", "product_id", productIds)
    totalReviews = reviews.length
    if (totalReviews > 0) {
      const sumRatings = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0)
      averageRating = sumRatings / totalReviews
    }
  }

  const totalMessages = totalReviews

  return {
    totalRevenue,
    totalOrders,
    totalProducts,
    totalMessages,
    topProduct: topProduct.name,
    topProductSales: topProduct.quantity,
    lowStockProducts,
    averageRating: Number(averageRating.toFixed(1)),
    totalReviews,
  }
}

export async function getRecentOrders(storeId: string, limit = 3) {
  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("store_id", "==", storeId).get()
  const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordMap) }))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  const limited = orders.slice(0, limit)
  const customerMap = await fetchDocsMap(
    db,
    "profiles",
    limited.map((order) => order.customer_id),
  )

  return limited.map((order) => ({
    id: order.id.substring(0, 8).toUpperCase(),
    customer: customerMap.get(order.customer_id)?.full_name || "Ø¹Ù…ÙŠÙ„",
    total: Number(order.total || 0),
    status: order.status || "pending",
    date: new Date(order.created_at).toLocaleDateString("en-CA"),
  }))
}
