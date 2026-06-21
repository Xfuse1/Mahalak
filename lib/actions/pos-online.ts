"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { FieldValue } from "firebase-admin/firestore"
import { serializeData } from "@/lib/firebase/firestore-helpers"

/**
 * يتحقق أن المستدعي (من الجلسة) هو مالك المتجر.
 * معرّف المتجر = معرّف المستخدم. لا نثق بأي storeId قادم من العميل.
 */
async function isStoreOwner(storeId: string): Promise<boolean> {
  const uid = await getCurrentUid()
  return uid != null && uid === storeId
}

// جلب عناصر عدة طلبات دفعةً واحدة (chunks of 10 بسبب حد Firestore على in) — يتجنّب N+1.
async function fetchOrderItemsGrouped(
  db: FirebaseFirestore.Firestore,
  orderIds: string[],
): Promise<Map<string, FirebaseFirestore.DocumentData[]>> {
  const grouped = new Map<string, FirebaseFirestore.DocumentData[]>()
  const ids = orderIds.filter(Boolean)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
  const snaps = await Promise.all(
    chunks.map((chunk) => db.collection("order_items").where("order_id", "in", chunk).get()),
  )
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const data = d.data()
      const oid = data.order_id
      if (!oid) continue
      const arr = grouped.get(oid) || []
      arr.push(data)
      grouped.set(oid, arr)
    }
  }
  return grouped
}

// ==================== TYPES ====================

export type ShippingZone = {
  id: string
  name: string
  name_ar: string
  governorate: string // e.g. "القاهرة", "الجيزة", etc.
  delivery_fee: number
  estimated_days: number // estimated delivery days
  is_active: boolean
  free_shipping_min?: number // free shipping above this amount
  created_at: string
}

export type TierPricing = {
  id: string
  product_id: string
  product_name: string
  min_qty: number
  price: number // price per unit at this quantity
  created_at: string
}

export type PaymentMethodConfig = {
  cod_enabled: boolean
  wallet_enabled: boolean
  instapay_enabled: boolean
  wallet_number?: string
  instapay_number?: string
  instapay_name?: string
}

export type OnlineOrderForPOS = {
  id: string
  order_number?: string
  customer_name?: string
  customer_phone?: string
  customer_id?: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
    image_url?: string | null
  }[]
  total: number
  subtotal?: number
  delivery_fee?: number
  discount?: number
  coupon_code?: string
  payment_method?: string
  payment_status?: string
  delivery_address?: string
  shipping_zone?: string
  status: string
  notes?: string
  created_at: string
  timeline?: { status: string; timestamp: string; note?: string }[]
}

export type OnlineReturn = {
  id: string
  store_id: string
  order_id: string
  order_number?: string
  customer_name?: string
  customer_phone?: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
  }[]
  reason: string
  refund_amount: number
  refund_method: "cod_refund" | "wallet" | "instapay"
  status: "pending" | "approved" | "rejected" | "refunded"
  notes?: string
  created_at: string
  resolved_at?: string
}

export type OnlineSalesReport = {
  total_orders: number
  total_revenue: number
  total_items_sold: number
  total_delivery_fees: number
  total_discounts: number
  total_returns: number
  orders_by_status: Record<string, number>
  orders_by_payment: Record<string, number>
  top_products: { product_id: string; name: string; qty: number; revenue: number }[]
  daily_breakdown: { date: string; orders: number; revenue: number }[]
}

// ==================== SHIPPING ZONES ====================

export async function getShippingZones(storeId: string): Promise<ShippingZone[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/shipping_zones`).orderBy("name", "asc").get()
    return snap.docs.map(doc => serializeData({ id: doc.id, ...doc.data() })) as ShippingZone[]
  } catch (error) {
    console.error("Error getting shipping zones:", error)
    return []
  }
}

export async function createShippingZone(
  storeId: string,
  data: Omit<ShippingZone, "id" | "created_at">
): Promise<{ success: boolean; zone?: ShippingZone }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const docRef = db.collection(`stores/${storeId}/shipping_zones`).doc()
    const payload = {
      ...data,
      created_at: new Date().toISOString(),
    }
    await docRef.set(payload)
    return { success: true, zone: serializeData({ id: docRef.id, ...payload }) as ShippingZone }
  } catch (error) {
    console.error("Error creating shipping zone:", error)
    return { success: false }
  }
}

export async function updateShippingZone(
  storeId: string,
  zoneId: string,
  data: Partial<Omit<ShippingZone, "id" | "created_at">>
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/shipping_zones/${zoneId}`).update(data)
    return { success: true }
  } catch (error) {
    console.error("Error updating shipping zone:", error)
    return { success: false }
  }
}

export async function deleteShippingZone(
  storeId: string,
  zoneId: string
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/shipping_zones/${zoneId}`).delete()
    return { success: true }
  } catch (error) {
    console.error("Error deleting shipping zone:", error)
    return { success: false }
  }
}

// ==================== TIER PRICING ====================

export async function getTierPricing(storeId: string, productId?: string): Promise<TierPricing[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    let query = db.collection(`stores/${storeId}/tier_pricing`).orderBy("min_qty", "asc") as FirebaseFirestore.Query
    if (productId) {
      query = query.where("product_id", "==", productId)
    }
    const snap = await query.get()
    return snap.docs.map(doc => serializeData({ id: doc.id, ...doc.data() })) as TierPricing[]
  } catch (error) {
    console.error("Error getting tier pricing:", error)
    return []
  }
}

export async function saveTierPricing(
  storeId: string,
  productId: string,
  productName: string,
  tiers: { min_qty: number; price: number }[]
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const batch = db.batch()
    const ref = db.collection(`stores/${storeId}/tier_pricing`)

    // Delete existing tiers for this product
    const existing = await ref.where("product_id", "==", productId).get()
    existing.docs.forEach(doc => batch.delete(doc.ref))

    // Create new tiers
    for (const tier of tiers) {
      const docRef = ref.doc()
      batch.set(docRef, {
        product_id: productId,
        product_name: productName,
        min_qty: tier.min_qty,
        price: tier.price,
        created_at: new Date().toISOString(),
      })
    }

    await batch.commit()
    return { success: true }
  } catch (error) {
    console.error("Error saving tier pricing:", error)
    return { success: false }
  }
}

// ==================== PAYMENT METHODS CONFIG ====================

export async function getPaymentConfig(storeId: string): Promise<PaymentMethodConfig> {
  try {
    if (!(await isStoreOwner(storeId))) {
      return { cod_enabled: false, wallet_enabled: false, instapay_enabled: false }
    }
    const db = getAdminDb()
    const doc = await db.doc(`stores/${storeId}/settings/payment_config`).get()
    if (doc.exists) {
      return doc.data() as PaymentMethodConfig
    }
    return {
      cod_enabled: true,
      wallet_enabled: false,
      instapay_enabled: false,
    }
  } catch (error) {
    console.error("Error getting payment config:", error)
    return { cod_enabled: true, wallet_enabled: false, instapay_enabled: false }
  }
}

export async function savePaymentConfig(
  storeId: string,
  config: PaymentMethodConfig
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/settings/payment_config`).set(config, { merge: true })
    return { success: true }
  } catch (error) {
    console.error("Error saving payment config:", error)
    return { success: false }
  }
}

// ==================== INCOMING ONLINE ORDERS ====================

export async function getIncomingOnlineOrders(storeId: string): Promise<OnlineOrderForPOS[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()

    // Get single-store orders
    const ordersSnap = await db.collection("orders")
      .where("store_id", "==", storeId)
      .where("status", "in", ["pending", "reviewing", "confirmed", "processing"])
      .orderBy("created_at", "desc")
      .limit(50)
      .get()

    const orders: OnlineOrderForPOS[] = []

    // استبعاد طلبات الاستفسار ثم جلب عناصر كل الطلبات دفعةً واحدة (بدل query لكل طلب)
    const relevantDocs = ordersSnap.docs.filter((doc) => {
      const data = doc.data()
      return !(data.order_type === "inquiry" || data.delivery_address === "Contact via WhatsApp" || data.delivery_address === "Contact via Phone")
    })
    const itemsByOrder = await fetchOrderItemsGrouped(db, relevantDocs.map((d) => d.id))

    for (const doc of relevantDocs) {
      const data = doc.data()

      const items = (itemsByOrder.get(doc.id) || []).map((itemData) => ({
        product_id: itemData.product_id || "",
        name: itemData.name || "",
        quantity: itemData.quantity || 1,
        price: itemData.price || 0,
        image_url: itemData.image_url || null,
      }))

      orders.push(serializeData({
        id: doc.id,
        order_number: data.order_number,
        customer_name: data.customer_name || data.customer_id,
        customer_phone: data.customer_phone,
        customer_id: data.customer_id,
        items,
        total: data.total || 0,
        subtotal: data.subtotal,
        delivery_fee: data.delivery_fee || 0,
        discount: data.discount || 0,
        coupon_code: data.coupon_code,
        payment_method: data.payment_method || "cod",
        payment_status: data.payment_status || "pending",
        delivery_address: data.delivery_address,
        shipping_zone: data.shipping_zone,
        status: data.status,
        notes: data.notes,
        created_at: data.created_at || "",
        timeline: data.timeline || [],
      }) as OnlineOrderForPOS)
    }

    return orders
  } catch (error) {
    console.error("Error getting incoming online orders:", error)
    return []
  }
}

export async function updateOnlineOrderStatus(
  orderId: string,
  newStatus: string,
  note?: string
): Promise<{ success: boolean }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false }
    const db = getAdminDb()
    const orderRef = db.doc(`orders/${orderId}`)
    const orderDoc = await orderRef.get()
    if (!orderDoc.exists) return { success: false }
    // فقط متجر صاحب الطلب يحقّ له تعديل حالته
    if (orderDoc.data()?.store_id !== uid) return { success: false }

    const now = new Date().toISOString()
    const timelineEntry = { status: newStatus, timestamp: now, note: note || undefined }

    await orderRef.update({
      status: newStatus,
      updated_at: now,
      timeline: FieldValue.arrayUnion(timelineEntry),
    })

    return { success: true }
  } catch (error) {
    console.error("Error updating online order status:", error)
    return { success: false }
  }
}

export async function confirmOnlinePayment(
  orderId: string,
  method: string,
  transactionRef?: string
): Promise<{ success: boolean }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false }
    const db = getAdminDb()
    const orderRef = db.doc(`orders/${orderId}`)
    const orderSnap = await orderRef.get()
    // فقط متجر صاحب الطلب يحقّ له تأكيد الدفع
    if (!orderSnap.exists || orderSnap.data()?.store_id !== uid) return { success: false }
    const now = new Date().toISOString()
    await orderRef.update({
      payment_status: "confirmed",
      payment_confirmed_at: now,
      payment_method: method,
      payment_reference: transactionRef || null,
      updated_at: now,
      timeline: FieldValue.arrayUnion({
        status: "payment_confirmed",
        timestamp: now,
        note: `Payment confirmed via ${method}${transactionRef ? ` (Ref: ${transactionRef})` : ""}`,
      }),
    })
    return { success: true }
  } catch (error) {
    console.error("Error confirming payment:", error)
    return { success: false }
  }
}

// ==================== LOW STOCK ALERTS ====================

export async function getLowStockProducts(
  storeId: string,
  threshold: number = 5
): Promise<{ id: string; name: string; stock: number; price: number; image_url?: string }[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snap = await db.collection("products")
      .where("store_id", "==", storeId)
      .where("stock", "<=", threshold)
      .where("stock", ">=", 0)
      .orderBy("stock", "asc")
      .limit(50)
      .get()

    return snap.docs.map(doc => {
      const d = doc.data()
      return { id: doc.id, name: d.name || "", stock: d.stock || 0, price: d.price || 0, image_url: d.image_url }
    })
  } catch (error) {
    console.error("Error getting low stock products:", error)
    return []
  }
}

// ==================== ONLINE RETURNS ====================

export async function createOnlineReturn(
  storeId: string,
  data: Omit<OnlineReturn, "id" | "store_id" | "created_at" | "status">
): Promise<{ success: boolean; returnDoc?: OnlineReturn }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const docRef = db.collection(`stores/${storeId}/online_returns`).doc()
    const payload = {
      store_id: storeId,
      ...data,
      status: "pending" as const,
      created_at: new Date().toISOString(),
    }
    await docRef.set(payload)
    return { success: true, returnDoc: serializeData({ id: docRef.id, ...payload }) as OnlineReturn }
  } catch (error) {
    console.error("Error creating online return:", error)
    return { success: false }
  }
}

export async function getOnlineReturns(storeId: string): Promise<OnlineReturn[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/online_returns`)
      .orderBy("created_at", "desc")
      .limit(50)
      .get()
    return snap.docs.map(doc => serializeData({ id: doc.id, ...doc.data() })) as OnlineReturn[]
  } catch (error) {
    console.error("Error getting online returns:", error)
    return []
  }
}

export async function updateOnlineReturnStatus(
  storeId: string,
  returnId: string,
  status: "approved" | "rejected" | "refunded",
  note?: string
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const updateData: Record<string, unknown> = { status }
    if (status === "refunded" || status === "approved" || status === "rejected") {
      updateData.resolved_at = new Date().toISOString()
    }
    if (note) updateData.notes = note
    await db.doc(`stores/${storeId}/online_returns/${returnId}`).update(updateData)
    return { success: true }
  } catch (error) {
    console.error("Error updating return status:", error)
    return { success: false }
  }
}

// ==================== ONLINE SALES REPORT ====================

export async function getOnlineSalesReport(
  storeId: string,
  fromDate: string,
  toDate: string
): Promise<OnlineSalesReport> {
  const emptyReport: OnlineSalesReport = {
    total_orders: 0,
    total_revenue: 0,
    total_items_sold: 0,
    total_delivery_fees: 0,
    total_discounts: 0,
    total_returns: 0,
    orders_by_status: {},
    orders_by_payment: {},
    top_products: [],
    daily_breakdown: [],
  }

  try {
    if (!(await isStoreOwner(storeId))) return emptyReport
    const db = getAdminDb()

    // Get all orders in date range
    const ordersSnap = await db.collection("orders")
      .where("store_id", "==", storeId)
      .where("created_at", ">=", fromDate)
      .where("created_at", "<=", toDate)
      .get()

    if (ordersSnap.empty) return emptyReport

    let totalRevenue = 0
    let totalDeliveryFees = 0
    let totalDiscounts = 0
    let totalItemsSold = 0
    const statusMap: Record<string, number> = {}
    const paymentMap: Record<string, number> = {}
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    const dailyMap: Record<string, { orders: number; revenue: number }> = {}

    // استبعاد الاستفسارات ثم جلب عناصر كل الطلبات دفعةً واحدة (بدل query لكل طلب)
    const reportDocs = ordersSnap.docs.filter((doc) => doc.data().order_type !== "inquiry")
    const reportItemsByOrder = await fetchOrderItemsGrouped(db, reportDocs.map((d) => d.id))

    for (const doc of reportDocs) {
      const data = doc.data()

      const orderTotal = data.total || 0
      totalRevenue += orderTotal
      totalDeliveryFees += data.delivery_fee || 0
      totalDiscounts += data.discount || 0

      // Status breakdown
      const st = data.status || "unknown"
      statusMap[st] = (statusMap[st] || 0) + 1

      // Payment breakdown
      const pm = data.payment_method || "cod"
      paymentMap[pm] = (paymentMap[pm] || 0) + 1

      // Daily breakdown
      const day = (data.created_at || "").substring(0, 10)
      if (day) {
        if (!dailyMap[day]) dailyMap[day] = { orders: 0, revenue: 0 }
        dailyMap[day].orders++
        dailyMap[day].revenue += orderTotal
      }

      for (const item of reportItemsByOrder.get(doc.id) || []) {
        const qty = item.quantity || 1
        totalItemsSold += qty
        const pid = item.product_id || "unknown"
        if (!productMap[pid]) productMap[pid] = { name: item.name || "", qty: 0, revenue: 0 }
        productMap[pid].qty += qty
        productMap[pid].revenue += (item.price || 0) * qty
      }
    }

    // Get online returns count
    const returnsSnap = await db.collection(`stores/${storeId}/online_returns`)
      .where("created_at", ">=", fromDate)
      .where("created_at", "<=", toDate)
      .get()

    // Sort top products by revenue
    const topProducts = Object.entries(productMap)
      .map(([product_id, data]) => ({ product_id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Sort daily breakdown by date
    const dailyBreakdown = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      total_orders: ordersSnap.size,
      total_revenue: totalRevenue,
      total_items_sold: totalItemsSold,
      total_delivery_fees: totalDeliveryFees,
      total_discounts: totalDiscounts,
      total_returns: returnsSnap.size,
      orders_by_status: statusMap,
      orders_by_payment: paymentMap,
      top_products: topProducts,
      daily_breakdown: dailyBreakdown,
    }
  } catch (error) {
    console.error("Error getting online sales report:", error)
    return emptyReport
  }
}
