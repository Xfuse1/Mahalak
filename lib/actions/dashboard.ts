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

// ─── لوحة «اليوم» + تنبيهات المخزون ───
// «اليوم» بتوقيت القاهرة (يوم التاجر المحلي) لا UTC. created_at نصّي ISO(UTC) في كل المجموعات، فنقارن
// تاريخ القاهرة المُنسَّق (YYYY-MM-DD). الهوية سيرفر-سايد من الجلسة؛ callerId من العميل يُتجاهَل أمنيًّا.

const cairoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }) // en-CA ⇒ YYYY-MM-DD
function cairoDateStr(d: Date): string {
  return Number.isNaN(d.getTime()) ? "" : cairoDateFmt.format(d)
}

export type SellerDailyStats = {
  salesCount: number
  revenue: number
  profit: number
  pos: { count: number; revenue: number; profit: number }
  cod: { count: number; revenue: number; profit: number }
  topItems: { name: string; quantity: number }[]
  codProfitApprox: boolean // ربح التوصيل تقديري (تكلفة المنتج الحالية؛ order_items بلا تكلفة)
}

const EMPTY_DAILY: SellerDailyStats = {
  salesCount: 0, revenue: 0, profit: 0,
  pos: { count: 0, revenue: 0, profit: 0 },
  cod: { count: 0, revenue: 0, profit: 0 },
  topItems: [], codProfitApprox: false,
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

// إحصائيات اليوم للتاجر: مبيعات/ربح الكاشير (دقيق، التكلفة لقطة وقت البيع) + التوصيل (ربحه تقديري
// من تكلفة المنتج الحالية لأن order_items بلا تكلفة) + أكثر الأصناف مبيعًا اليوم (كاشير + توصيل).
export async function getSellerDailyStats(callerId?: string): Promise<SellerDailyStats> {
  const uid = await getCurrentUid()
  if (!uid) return EMPTY_DAILY
  const db = getAdminDb()
  const today = cairoDateStr(new Date())
  // حدّ أدنى للاستعلام (لتفادي قراءة كل التاريخ) يغطّي يوم القاهرة مهما كان الإزاحة/DST.
  const lowerBound = new Date(Date.now() - 30 * 3600 * 1000).toISOString()
  const isToday = (createdAt: unknown) => cairoDateStr(new Date(String(createdAt || ""))) === today

  const qtyByProduct = new Map<string, { name: string; quantity: number }>()
  const addQty = (productId: string, name: string, quantity: number) => {
    if (!productId || !(quantity > 0)) return
    const cur = qtyByProduct.get(productId)
    if (cur) { cur.quantity += quantity; if (!cur.name && name) cur.name = name }
    else qtyByProduct.set(productId, { name: name || "", quantity })
  }

  // ── الكاشير (pos_sales) ──
  let posDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
  try {
    const snap = await db.collection("pos_sales").where("store_id", "==", uid)
      .where("created_at", ">=", lowerBound).get()
    posDocs = snap.docs
  } catch {
    // لا فهرس مركّب (store_id+created_at) على pos_sales ⇒ نجيب بالمتجر فقط ونفلتر في الذاكرة.
    const snap = await db.collection("pos_sales").where("store_id", "==", uid).get()
    posDocs = snap.docs
  }
  let posCount = 0, posRevenue = 0, posProfit = 0
  for (const d of posDocs) {
    const s = d.data() as Record<string, any>
    if (!isToday(s.created_at)) continue
    posCount++
    posRevenue += Number(s.total) || 0
    posProfit += Number(s.total_profit) || 0
    for (const it of Array.isArray(s.items) ? s.items : []) {
      addQty(String(it?.product_id || ""), String(it?.name || ""), Number(it?.quantity) || 0)
    }
  }

  // ── التوصيل (orders) اليوم — نستبعد الملغي فقط ──
  let orderDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
  try {
    const snap = await db.collection("orders").where("store_id", "==", uid)
      .where("created_at", ">=", lowerBound).get()
    orderDocs = snap.docs
  } catch {
    const snap = await db.collection("orders").where("store_id", "==", uid).get()
    orderDocs = snap.docs
  }
  const todayOrders = orderDocs.filter((d) => {
    const o = d.data() as Record<string, any>
    return isToday(o.created_at) && o.status !== "cancelled"
  })
  let codCount = 0, codRevenue = 0, codProfit = 0
  let codProfitApprox = false
  for (const d of todayOrders) {
    const o = d.data() as Record<string, any>
    codCount++
    codRevenue += (Number(o.total) || 0) - (Number(o.delivery_price) || 0) // نصيب المنتجات (بلا رسم توصيل)
  }
  if (todayOrders.length > 0) {
    // ربح التوصيل + أصنافه: من order_items (سعر+كمية) × تكلفة المنتج الحالية (تقديري).
    const orderIds = todayOrders.map((d) => d.id)
    const items = await fetchByIn<{ order_id?: string; product_id?: string; quantity?: number | string; price?: number | string }>(
      db, "order_items", "order_id", orderIds,
    )
    const prodIds = Array.from(new Set(items.map((i) => String(i.product_id || "")).filter(Boolean)))
    const prodMap = await fetchDocsMap<{ name?: string; cost_price?: number | string }>(db, "products", prodIds)
    if (items.length > 0) codProfitApprox = true
    for (const it of items) {
      const pid = String(it.product_id || "")
      const qty = Number(it.quantity) || 0
      const price = Number(it.price) || 0
      const prod = prodMap.get(pid)
      const cost = Number(prod?.cost_price) || 0
      codProfit += (price - cost) * qty
      addQty(pid, String(prod?.name || ""), qty)
    }
  }

  const topItems = Array.from(qtyByProduct.values())
    .filter((x) => x.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((x) => ({ name: x.name || "منتج", quantity: x.quantity }))

  return {
    salesCount: posCount + codCount,
    revenue: round2(posRevenue + codRevenue),
    profit: round2(posProfit + codProfit),
    pos: { count: posCount, revenue: round2(posRevenue), profit: round2(posProfit) },
    cod: { count: codCount, revenue: round2(codRevenue), profit: round2(codProfit) },
    topItems,
    codProfitApprox,
  }
}

export type StockAlerts = {
  outOfStock: { id: string; name: string }[]
  lowStock: { id: string; name: string; stock: number }[]
  outCount: number
  lowCount: number
  threshold: number
}

// تنبيهات المخزون: نفد (stock<=0) + قرب يخلص (0<stock<=threshold). قوائم بأسماء (بسقف عرض) + العدّ الكامل.
export async function getStockAlerts(threshold = 5, callerId?: string): Promise<StockAlerts> {
  const uid = await getCurrentUid()
  const th = Math.max(1, Math.floor(Number(threshold) || 5))
  if (!uid) return { outOfStock: [], lowStock: [], outCount: 0, lowCount: 0, threshold: th }
  const db = getAdminDb()
  const snap = await db.collection("products").where("store_id", "==", uid).select("name", "stock").get()
  const outOfStock: { id: string; name: string }[] = []
  const lowStock: { id: string; name: string; stock: number }[] = []
  for (const d of snap.docs) {
    const stock = Number(d.data().stock) || 0
    const name = String(d.data().name || "")
    if (stock <= 0) outOfStock.push({ id: d.id, name })
    else if (stock <= th) lowStock.push({ id: d.id, name, stock })
  }
  lowStock.sort((a, b) => a.stock - b.stock)
  return {
    outOfStock: outOfStock.slice(0, 100),
    lowStock: lowStock.slice(0, 100),
    outCount: outOfStock.length,
    lowCount: lowStock.length,
    threshold: th,
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
