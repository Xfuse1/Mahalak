"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "../firebase/admin"
import { cleanUndefined, chunkArray } from "../firebase/firestore-helpers"

type RecordMap = {
  id: string
  [key: string]: any
}

async function fetchDocsMap(db: Firestore, collection: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, any>()
  }

  const refs = uniqueIds.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, any>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      map.set(doc.id, { ...doc.data(), id: doc.id })
    }
  })

  return map
}

async function fetchByIn(db: Firestore, collection: string, field: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)))
  if (uniqueValues.length === 0) return []

  const results: any[] = []
  const chunks = chunkArray(uniqueValues, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection(collection).where(field, "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      results.push({ ...doc.data(), id: doc.id })
    })
  }

  return results
}

export async function getDashboardAnalytics(storeId: string) {
  const db = getAdminDb()

  const productsSnap = await db.collection("products").where("store_id", "==", storeId).get()
  const products = productsSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any))
  const productIds = products.map((product: any) => product.id)

  const totalProducts = products.length
  const lowStockProducts = products.filter((product: any) => Number(product.stock || 0) < 10).length

  const ordersSnap = await db.collection("orders").where("store_id", "==", storeId).get()
  const allOrders = ordersSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any))

  // Only count 'delivered' orders for financial totals as requested
  const confirmedOrders = allOrders.filter((order: any) => order.status === "delivered")

  const totalOrders = confirmedOrders.length
  const totalRevenue = confirmedOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0)

  const orderItems = await fetchByIn(db, "order_items", "product_id", productIds)

  const confirmedOrderIds = new Set(confirmedOrders.map((o: any) => o.id))
  const productSales: Record<string, { name: string; quantity: number }> = {}
  const productMap = new Map(products.map((product: any) => [product.id, product]))

  orderItems.forEach((item: any) => {
    // Only count sales for items that belong to a confirmed (delivered) order
    if (!confirmedOrderIds.has(item.order_id)) return

    const product = productMap.get(item.product_id)
    if (!product) return
    if (!productSales[item.product_id]) {
      productSales[item.product_id] = { name: product.name, quantity: 0 }
    }
    productSales[item.product_id].quantity += Number(item.quantity || 0)
  })

  const topProduct = Object.values(productSales).sort((a, b) => b.quantity - a.quantity)[0] || {
    name: "",
    quantity: 0,
  }

  let averageRating = 0
  let totalReviews = 0

  if (productIds.length > 0) {
    const reviews = await fetchByIn(db, "reviews", "product_id", productIds)
    totalReviews = reviews.length
    if (totalReviews > 0) {
      const sumRatings = reviews.reduce((sum: number, review: any) => sum + (Number(review.rating) || 0), 0)
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
  const orders = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any))

  orders.sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  const limited = orders.slice(0, limit)
  const customerMap = await fetchDocsMap(
    db,
    "profiles",
    limited.map((order: any) => order.customer_id),
  )

  return limited.map((order: any) => ({
    id: order.id.substring(0, 8).toUpperCase(),
    customer: customerMap.get(order.customer_id)?.full_name || "عميل",
    total: Number(order.total || 0),
    status: order.status || "pending",
    date: new Date(order.created_at).toLocaleDateString("en-CA"),
  }))
}
