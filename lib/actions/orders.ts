"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { chunkArray } from "../firebase/firestore-helpers"
import { createNotification } from "./notifications"

type RecordMap = {
  id: string
  [key: string]: any
}

// Timeline entry type for order tracking
export type TimelineEntry = {
  status: string
  timestamp: string
  note?: string
}

// Pickup stop type for multi-store orders
export type PickupStop = {
  store_id: string
  store_name: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
    image_url?: string | null
  }[]
  subtotal: number
  status: "pending" | "confirmed" | "rejected" | "picked_up"
  confirmed_at?: string | null
  picked_up_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
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

// Fetch store data from users collection (stores are now embedded in users)
async function fetchStoresMap(db: Firestore, storeIds: string[]) {
  const uniqueIds = Array.from(new Set(storeIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, any>()
  }

  // Store IDs are now User IDs
  const refs = uniqueIds.map((id) => db.collection("users").doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, any>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      const data = doc.data()
      if (data?.store) {
        map.set(doc.id, {
          id: doc.id,
          seller_id: doc.id,
          ...data.store,
        })
      }
    }
  })

  return map
}

async function getOrderItemsByOrderIds(db: Firestore, orderIds: string[]) {
  const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)))
  if (uniqueIds.length === 0) return []

  const items: any[] = []
  const chunks = chunkArray(uniqueIds, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection("order_items").where("order_id", "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      items.push({ ...doc.data(), id: doc.id })
    })
  }

  return items
}

// Get a single order by ID
export async function getOrderById(orderId: string) {
  try {
    const db = getAdminDb()

    // First try to find by document ID
    let orderDoc = await db.collection("orders").doc(orderId).get()

    // If not found, try to find by order_id field
    if (!orderDoc.exists) {
      const snapshot = await db
        .collection("orders")
        .where("order_id", "==", orderId)
        .limit(1)
        .get()

      if (snapshot.empty) {
        return null
      }
      orderDoc = snapshot.docs[0]
    }

    const orderData = orderDoc.data()
    if (!orderData) return null

    // Get order items
    const itemsSnapshot = await db
      .collection("order_items")
      .where("order_id", "==", orderDoc.id)
      .get()

    const productIds = itemsSnapshot.docs.map((doc) => doc.data().product_id).filter(Boolean)
    const productMap = await fetchDocsMap(db, "products", productIds)

    const items = itemsSnapshot.docs.map((doc) => {
      const itemData = doc.data()
      const product = productMap.get(itemData.product_id)
      return {
        ...itemData,
        id: doc.id,
        name: product?.name || itemData.name,
        image_url: product?.image_url || itemData.image_url,
      }
    })

    // Convert Timestamps to strings
    const createdAt = orderData.created_at?.toDate?.()?.toISOString?.() || orderData.created_at
    const updatedAt = orderData.updated_at?.toDate?.()?.toISOString?.() || orderData.updated_at

    return {
      id: orderDoc.id,
      order_id: orderDoc.id,
      ...orderData,
      items,
      created_at: createdAt,
      updated_at: updatedAt,
    }
  } catch (error) {
    console.error("[v0] Error fetching order:", error)
    return null
  }
}

export async function getCustomerOrders(customerId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("customer_id", "==", customerId).get()
  // Filter out multi-store orders to avoid duplicates (they have their own section)
  const orders = snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id } as any))
    .filter((order: any) => order.order_type !== "multi_store")

  orders.sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  // Use fetchStoresMap for stores (now embedded in users collection)
  const storeMap = await fetchStoresMap(
    db,
    orders.map((order: any) => order.store_id),
  )

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order: any) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item: any) => item.product_id),
  )

  const itemsByOrder = new Map<string, any[]>()
  orderItems.forEach((item: any) => {
    const product = productMap.get(item.product_id)
    const entry = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: product.name,
          image_url: product.image_url || null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order: any) => {
    const store = storeMap.get(order.store_id)
    return {
      ...order,
      stores: store
        ? {
          id: store.id,
          name: store.name,
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

export async function getStoreOrders(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("store_id", "==", storeId).get()
  const orders = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any))

  orders.sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  if (orders.length === 0) {
    return []
  }

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order: any) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item: any) => item.product_id),
  )

  const customerMap = await fetchDocsMap(
    db,
    "users",
    orders.map((order: any) => order.customer_id),
  )

  const itemsByOrder = new Map<string, any[]>()
  orderItems.forEach((item: any) => {
    const product = productMap.get(item.product_id)
    const entry = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: product.name,
          image_url: product.image_url || null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order: any) => {
    const profile = customerMap.get(order.customer_id)
    return {
      ...order,
      profiles: profile
        ? {
          id: profile.id,
          full_name: profile.full_name || null,
          email: profile.email || "",
          phone: profile.phone || null,
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

import { createNotification, sendReviewRequestNotification } from "./notifications"

export async function updateOrderStatus(orderId: string, status: string, note?: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  // Create new timeline entry
  const timelineEntry: TimelineEntry = {
    status,
    timestamp: now,
    ...(note && { note }),
  }

  try {
    // Get current order to check if timeline exists
    const currentOrder = await docRef.get()
    const currentData = currentOrder.data()

    // Build update payload
    const updatePayload: Record<string, any> = {
      status,
      updated_at: now,
    }

    // If timeline exists, append to it; otherwise create new array
    if (currentData?.timeline && Array.isArray(currentData.timeline)) {
      updatePayload.timeline = [...currentData.timeline, timelineEntry]
    } else {
      // Initialize timeline with ordered status if creating fresh timeline
      const initialTimeline: TimelineEntry[] = []
      if (status !== "ordered" && status !== "pending") {
        // Add ordered entry if it doesn't exist
        initialTimeline.push({
          status: "ordered",
          timestamp: currentData?.created_at || now,
        })
      }
      initialTimeline.push(timelineEntry)
      updatePayload.timeline = initialTimeline
    }

    // If order is delivered, mark delivery timestamp
    if (status === "delivered") {
      updatePayload.delivered_at = now
    }

    await docRef.set(updatePayload, { merge: true })

    // Send review request notification when order is delivered
    if (status === "delivered" && currentData?.customer_id) {
      await sendReviewRequestNotification({
        user_id: currentData.customer_id,
        order_id: orderId,
        driver_name: currentData.driver_name,
      })
    } else if (currentData?.customer_id && status !== "pending" && status !== "ordered") {
      // Send general status update notification
      const statusMessages: Record<string, { ar: string, en: string }> = {
        confirmed: { ar: "تم تأكيد طلبك بنجاح", en: "Your order has been confirmed" },
        processing: { ar: "طلبك قيد التجهيز الآن", en: "Your order is being processed" },
        shipped: { ar: "تم شحن طلبك", en: "Your order has been shipped" },
        on_the_way: { ar: "طلبك في الطريق إليك", en: "Your order is on the way" },
        cancelled: { ar: "تم إلغاء طلبك", en: "Your order has been cancelled" },
      }

      const message = statusMessages[status] || {
        ar: `تم تحديث حالة طلبك إلى: ${status}`,
        en: `Your order status has been updated to: ${status}`
      }

      await createNotification({
        user_id: currentData.customer_id,
        title: "تحديث حالة الطلب",
        title_en: "Order Status Update",
        message: message.ar,
        message_en: message.en,
        type: "order_status",
        link: `/account`,
        data: { order_id: orderId, status }
      })
    }
  } catch (error: any) {
    console.error("[v0] Error updating order status:", error)
    return { success: false, error: error?.message || "Failed to update order status" }
  }

  const updatedSnap = await docRef.get()
  revalidatePath("/seller/orders")
  revalidatePath("/account")
  return { success: true, data: updatedSnap.exists ? { ...updatedSnap.data(), id: updatedSnap.id } : null }
}

export async function createOrder(orderData: {
  customer_id: string
  store_id: string
  total: number
  delivery_address: string
  customer_name?: string
  customer_phone?: string
  delivery_city?: string
  delivery_state?: string
  delivery_latitude?: number
  delivery_longitude?: number
  delivery_notes?: string
  delivery_company?: string
  delivery_price?: number
  driver_id?: string
  driver_name?: string
  items: { product_id: string; quantity: number; price: number }[]
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()

  // التحقق من توفر المخزون قبل إنشاء الطلب
  for (const item of orderData.items) {
    const productDoc = await db.collection("products").doc(item.product_id).get()
    if (!productDoc.exists) {
      return { success: false, error: `المنتج غير موجود` }
    }
    const productData = productDoc.data()
    const availableStock = productData?.stock ?? 0
    if (item.quantity > availableStock) {
      return { 
        success: false, 
        error: `الكمية المطلوبة من "${productData?.name || 'المنتج'}" (${item.quantity}) أكبر من المتاح (${availableStock})` 
      }
    }
  }

  const orderRef = db.collection("orders").doc()

  const orderPayload: Record<string, any> = {
    customer_id: orderData.customer_id,
    store_id: orderData.store_id,
    total: Number(orderData.total),
    delivery_address: orderData.delivery_address,
    status: "pending",
    created_at: now,
    updated_at: now,
    // Initialize timeline with ordered status
    timeline: [
      {
        status: "ordered",
        timestamp: now,
      } as TimelineEntry,
    ],
  }

  // Add optional delivery details
  if (orderData.customer_name) orderPayload.customer_name = orderData.customer_name
  if (orderData.customer_phone) orderPayload.customer_phone = orderData.customer_phone
  if (orderData.delivery_city) orderPayload.delivery_city = orderData.delivery_city
  if (orderData.delivery_state) orderPayload.delivery_state = orderData.delivery_state
  if (orderData.delivery_notes) orderPayload.delivery_notes = orderData.delivery_notes
  if (orderData.delivery_company) orderPayload.delivery_company = orderData.delivery_company
  if (orderData.delivery_price !== undefined) orderPayload.delivery_price = Number(orderData.delivery_price)

  // Add driver information
  if (orderData.driver_id) orderPayload.driver_id = orderData.driver_id
  if (orderData.driver_name) orderPayload.driver_name = orderData.driver_name

  // Add coordinates if available
  if (orderData.delivery_latitude !== undefined && orderData.delivery_longitude !== undefined) {
    orderPayload.delivery_latitude = Number(orderData.delivery_latitude)
    orderPayload.delivery_longitude = Number(orderData.delivery_longitude)
  }

  try {
    await orderRef.set(orderPayload)
  } catch (error: any) {
    console.error("[v0] Error creating order:", error)
    return { success: false, error: error?.message || "Failed to create order" }
  }

  const batch = db.batch()
  orderData.items.forEach((item) => {
    const itemRef = db.collection("order_items").doc()
    batch.set(itemRef, {
      order_id: orderRef.id,
      product_id: item.product_id,
      quantity: Number(item.quantity),
      price: Number(item.price),
      created_at: now,
    })
  })

  try {
    await batch.commit()
  } catch (error: any) {
    console.error("[v0] Error creating order items:", error)
    return { success: false, error: error?.message || "Failed to create order items" }
  }

  try {
    await createNotification({
      user_id: orderData.store_id,
      title: "طلب جديد",
      title_en: "New Order",
      message: `لديك طلب جديد برقم ${orderRef.id}`,
      message_en: `You have a new order: ${orderRef.id}`,
      type: "new_order",
      link: "/seller/orders",
      data: { order_id: orderRef.id, store_id: orderData.store_id },
    })
  } catch (error: any) {
    console.error("[v0] Error creating seller notification:", error)
  }

  // خصم الكمية من المخزون بعد إنشاء الطلب بنجاح
  const stockBatch = db.batch()
  for (const item of orderData.items) {
    const productRef = db.collection("products").doc(item.product_id)
    const productDoc = await productRef.get()
    if (productDoc.exists) {
      const currentStock = productDoc.data()?.stock ?? 0
      const newStock = Math.max(0, currentStock - item.quantity)
      stockBatch.update(productRef, { stock: newStock, updated_at: now })
    }
  }
  try {
    await stockBatch.commit()
  } catch (error: any) {
    console.error("[v0] Error deducting stock:", error)
    // لا نفشل الطلب لأنه تم بنجاح - فقط نسجل الخطأ
  }

  revalidatePath("/account")
  return { success: true, data: { id: orderRef.id, ...orderPayload } }
}

export async function createContactInquiry(inquiryData: {
  customer_id: string
  product_id: string
  store_id: string
  price: number
  contact_method: "whatsapp" | "call"
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  const orderRef = db.collection("orders").doc()

  const deliveryAddress = inquiryData.contact_method === "whatsapp" ? "Contact via WhatsApp" : "Contact via Phone"

  const orderPayload = {
    customer_id: inquiryData.customer_id,
    store_id: inquiryData.store_id,
    total: Number(inquiryData.price),
    delivery_address: deliveryAddress,
    status: "pending",
    created_at: now,
    updated_at: now,
  }

  try {
    await orderRef.set(orderPayload)
  } catch (error: any) {
    console.error("[v0] Error creating contact inquiry:", error)
    return { success: false, error: error?.message || "Failed to create inquiry" }
  }

  try {
    await db.collection("order_items").doc().set({
      order_id: orderRef.id,
      product_id: inquiryData.product_id,
      quantity: 1,
      price: Number(inquiryData.price),
      created_at: now,
    })
  } catch (error: any) {
    console.error("[v0] Error creating order item:", error)
    return { success: false, error: error?.message || "Failed to create inquiry item" }
  }

  revalidatePath("/account")
  revalidatePath("/seller/orders")
  return { success: true, data: { id: orderRef.id, ...orderPayload } }
}

// Driver rejects an order
export async function driverRejectOrder(orderId: string, driverId: string, reason?: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }

    const orderData = orderDoc.data()

    // Verify that the driver is assigned to this order
    if (orderData?.driver_id !== driverId) {
      return { success: false, error: "لا يمكنك رفض هذا الطلب" }
    }

    // Create timeline entry
    const timelineEntry: TimelineEntry = {
      status: "driver_rejected",
      timestamp: now,
      note: reason || "تم رفض الطلب من السائق",
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      status: "driver_rejected",
      driver_rejected_at: now,
      driver_rejection_reason: reason || "السائق غير متاح",
      updated_at: now,
    }

    // Add to timeline
    if (orderData?.timeline && Array.isArray(orderData.timeline)) {
      updatePayload.timeline = [...orderData.timeline, timelineEntry]
    } else {
      updatePayload.timeline = [timelineEntry]
    }

    await docRef.set(updatePayload, { merge: true })

    // Create notification for customer
    await db.collection("notifications").add({
      user_id: orderData.customer_id,
      type: "driver_rejected",
      title: "تم رفض الطلب من السائق",
      message: `السائق ${orderData.driver_name || "المحدد"} رفض توصيل طلبك. يرجى اختيار سائق آخر.`,
      order_id: orderId,
      is_read: false,
      created_at: now,
    })

    revalidatePath("/account")
    revalidatePath("/seller/orders")

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error rejecting order:", error)
    return { success: false, error: error?.message || "فشل رفض الطلب" }
  }
}

// Change driver for an order (after rejection or customer request)
export async function changeOrderDriver(
  orderId: string,
  customerId: string,
  newDriverId: string,
  newDriverName: string,
  newDeliveryPrice: number
) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }

    const orderData = orderDoc.data()

    // Verify the customer owns this order
    if (orderData?.customer_id !== customerId) {
      return { success: false, error: "لا يمكنك تعديل هذا الطلب" }
    }

    // Only allow driver change if status is driver_rejected or pending
    if (orderData?.status !== "driver_rejected" && orderData?.status !== "pending") {
      return { success: false, error: "لا يمكن تغيير السائق في هذه المرحلة" }
    }

    // Calculate new total (subtract old delivery price, add new)
    const oldDeliveryPrice = orderData.delivery_price || 0
    const productTotal = (orderData.total || 0) - oldDeliveryPrice
    const newTotal = productTotal + newDeliveryPrice

    // Create timeline entry
    const timelineEntry: TimelineEntry = {
      status: "driver_changed",
      timestamp: now,
      note: `تم تغيير السائق إلى ${newDriverName}`,
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      status: "pending", // Reset to pending for new driver to accept
      driver_id: newDriverId,
      driver_name: newDriverName,
      delivery_price: newDeliveryPrice,
      total: newTotal,
      driver_rejected_at: null,
      driver_rejection_reason: null,
      updated_at: now,
    }

    // Add to timeline
    if (orderData?.timeline && Array.isArray(orderData.timeline)) {
      updatePayload.timeline = [...orderData.timeline, timelineEntry]
    } else {
      updatePayload.timeline = [timelineEntry]
    }

    await docRef.set(updatePayload, { merge: true })

    revalidatePath("/account")
    revalidatePath("/seller/orders")

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error changing driver:", error)
    return { success: false, error: error?.message || "فشل تغيير السائق" }
  }
}

// Get orders with driver_rejected status for a customer
export async function getRejectedOrdersForCustomer(customerId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("customer_id", "==", customerId)
      .where("status", "==", "driver_rejected")
      .get()

    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return { success: true, orders }
  } catch (error: any) {
    console.error("[v0] Error fetching rejected orders:", error)
    return { success: false, error: error?.message, orders: [] }
  }
}

// ========================================
// Multi-Store Order Functions
// ========================================

// Create a multi-store order with pickup stops
export async function createMultiStoreOrder(orderData: {
  customer_id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  delivery_city?: string
  delivery_state?: string
  delivery_latitude?: number
  delivery_longitude?: number
  delivery_notes?: string
  driver_id: string
  driver_name: string
  delivery_price: number
  driver_commission: number
  pickup_stops: PickupStop[]
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  const orderRef = db.collection("orders").doc()

  // Calculate subtotal from all stops
  const subtotal = orderData.pickup_stops.reduce((sum, stop) => sum + stop.subtotal, 0)
  const total = subtotal + orderData.delivery_price + orderData.driver_commission

  // Prepare pickup stops with default status
  const stops: PickupStop[] = orderData.pickup_stops.map((stop) => ({
    ...stop,
    status: "pending",
    confirmed_at: null,
    picked_up_at: null,
    rejected_at: null,
    rejection_reason: null,
  }))

  const orderPayload: Record<string, any> = {
    order_type: "multi_store",
    customer_id: orderData.customer_id,
    customer_name: orderData.customer_name,
    customer_phone: orderData.customer_phone,
    driver_id: orderData.driver_id,
    driver_name: orderData.driver_name,
    delivery_address: orderData.delivery_address,
    delivery_city: orderData.delivery_city || "",
    delivery_state: orderData.delivery_state || "",
    delivery_notes: orderData.delivery_notes || "",
    delivery_price: Number(orderData.delivery_price),
    driver_commission: Number(orderData.driver_commission),
    pickup_stops: stops,
    subtotal: Number(subtotal),
    total: Number(total),
    status: "pending",
    payment_status: "cod",
    timeline: [{ status: "ordered", timestamp: now } as TimelineEntry],
    created_at: now,
    updated_at: now,
  }

  if (orderData.delivery_latitude !== undefined && orderData.delivery_longitude !== undefined) {
    orderPayload.delivery_latitude = Number(orderData.delivery_latitude)
    orderPayload.delivery_longitude = Number(orderData.delivery_longitude)
  }

  try {
    await orderRef.set(orderPayload)

    // التحقق من توفر المخزون قبل إنشاء عناصر الطلب
    for (const stop of stops) {
      for (const item of stop.items) {
        const productDoc = await db.collection("products").doc(item.product_id).get()
        if (productDoc.exists) {
          const productData = productDoc.data()
          const availableStock = productData?.stock ?? 0
          if (item.quantity > availableStock) {
            // حذف الطلب لأنه لم يكتمل
            await orderRef.delete()
            return { 
              success: false, 
              error: `الكمية المطلوبة من "${productData?.name || 'المنتج'}" (${item.quantity}) أكبر من المتاح (${availableStock})` 
            }
          }
        }
      }
    }

    // Also create order_items for compatibility
    const batch = db.batch()
    for (let i = 0; i < stops.length; i++) {
      for (const item of stops[i].items) {
        const itemRef = db.collection("order_items").doc()
        batch.set(itemRef, {
          order_id: orderRef.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          store_id: stops[i].store_id,
          stop_index: i,
          created_at: now,
        })
      }
    }
    await batch.commit()

    // خصم الكمية من المخزون بعد إنشاء الطلب بنجاح
    const stockBatch = db.batch()
    for (const stop of stops) {
      for (const item of stop.items) {
        const productRef = db.collection("products").doc(item.product_id)
        const productDoc = await productRef.get()
        if (productDoc.exists) {
          const currentStock = productDoc.data()?.stock ?? 0
          const newStock = Math.max(0, currentStock - item.quantity)
          stockBatch.update(productRef, { stock: newStock, updated_at: now })
        }
      }
    }
    try {
      await stockBatch.commit()
    } catch (stockError: any) {
      console.error("[v0] Error deducting stock for multi-store order:", stockError)
    }

    // Send notifications to each store
    const notifBatch = db.batch()
    for (const stop of stops) {
      const notifRef = db.collection("notifications").doc()
      notifBatch.set(notifRef, {
        user_id: stop.store_id,
        type: "new_multi_order",
        title: "طلب جديد 🛒",
        title_en: "New Order 🛒",
        message: `لديك طلب جديد يحتوي على ${stop.items.length} منتج بقيمة ${stop.subtotal} جنيه`,
        message_en: `You have a new order with ${stop.items.length} items worth ${stop.subtotal} EGP`,
        data: { order_id: orderRef.id, store_id: stop.store_id },
        is_read: false,
        created_at: now,
      })
    }

    // Notify driver
    const driverNotifRef = db.collection("notifications").doc()
    notifBatch.set(driverNotifRef, {
      user_id: orderData.driver_id,
      type: "new_multi_order",
      title: "طلب توصيل جديد 🚗",
      title_en: "New Delivery Order 🚗",
      message: `لديك طلب جديد من ${stops.length} متجر. في انتظار تأكيد المتاجر.`,
      message_en: `New order from ${stops.length} stores. Waiting for store confirmations.`,
      data: { order_id: orderRef.id },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, data: { id: orderRef.id, ...orderPayload } }
  } catch (error: any) {
    console.error("[v0] Error creating multi-store order:", error)
    return { success: false, error: error?.message || "Failed to create order" }
  }
}

// Store confirms its part of a multi-store order
export async function confirmStorePickup(orderId: string, storeId: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }

    const orderData = orderDoc.data()
    if (orderData?.order_type !== "multi_store") {
      return { success: false, error: "هذا ليس طلب متعدد المتاجر" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "لم يتم العثور على متجرك في هذا الطلب" }
    }

    if (stops[stopIndex].status !== "pending") {
      return { success: false, error: "تم التعامل مع هذا الطلب مسبقاً" }
    }

    // Update stop status
    stops[stopIndex].status = "confirmed"
    stops[stopIndex].confirmed_at = now

    // Check if all stores confirmed (excluding rejected ones)
    const allConfirmed = stops.every((s) => s.status === "confirmed" || s.status === "rejected")
    const hasAnyConfirmed = stops.some((s) => s.status === "confirmed")

    // Timeline entry
    const timelineEntry: TimelineEntry = {
      status: "store_confirmed",
      timestamp: now,
      note: `${stops[stopIndex].store_name} أكد الطلب`,
    }

    const timeline = [...(orderData.timeline || []), timelineEntry]

    const updatePayload: Record<string, any> = {
      pickup_stops: stops,
      timeline,
      updated_at: now,
    }

    // If all stores responded
    if (allConfirmed && hasAnyConfirmed) {
      updatePayload.status = "confirmed"

      // Recalculate total if some rejected
      const activeStops = stops.filter((s) => s.status === "confirmed")
      const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
      updatePayload.subtotal = newSubtotal
      updatePayload.total = newSubtotal + (orderData.delivery_price || 0) + (orderData.driver_commission || 0)

      timeline.push({
        status: "all_confirmed",
        timestamp: now,
        note: "كل المتاجر أكدت الطلب",
      })
      updatePayload.timeline = timeline
    }

    await docRef.set(updatePayload, { merge: true })

    // Notify customer
    const notifBatch = db.batch()

    const customerNotifRef = db.collection("notifications").doc()
    notifBatch.set(customerNotifRef, {
      user_id: orderData.customer_id,
      type: "store_confirmed",
      title: `✅ ${stops[stopIndex].store_name} أكد طلبك`,
      title_en: `✅ ${stops[stopIndex].store_name} confirmed your order`,
      message: allConfirmed && hasAnyConfirmed
        ? "كل المتاجر أكدت! السائق سيبدأ الاستلام."
        : `في انتظار تأكيد باقي المتاجر...`,
      message_en: allConfirmed && hasAnyConfirmed
        ? "All stores confirmed! Driver will start pickup."
        : `Waiting for other stores to confirm...`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    // Notify driver
    const driverNotifRef = db.collection("notifications").doc()
    notifBatch.set(driverNotifRef, {
      user_id: orderData.driver_id,
      type: "store_confirmed",
      title: `✅ ${stops[stopIndex].store_name} أكد الطلب`,
      title_en: `✅ ${stops[stopIndex].store_name} confirmed`,
      message: allConfirmed && hasAnyConfirmed
        ? "كل المتاجر أكدت الطلب. يمكنك البدء في الاستلام."
        : `في انتظار تأكيد باقي المتاجر...`,
      message_en: allConfirmed && hasAnyConfirmed
        ? "All stores confirmed. You can start pickup."
        : `Waiting for other stores...`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allConfirmed: allConfirmed && hasAnyConfirmed }
  } catch (error: any) {
    console.error("[v0] Error confirming store pickup:", error)
    return { success: false, error: error?.message || "فشل تأكيد الطلب" }
  }
}

// Store rejects its part of a multi-store order
export async function rejectStorePickup(orderId: string, storeId: string, reason?: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }

    const orderData = orderDoc.data()
    if (orderData?.order_type !== "multi_store") {
      return { success: false, error: "هذا ليس طلب متعدد المتاجر" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "لم يتم العثور على متجرك في هذا الطلب" }
    }

    if (stops[stopIndex].status !== "pending") {
      return { success: false, error: "تم التعامل مع هذا الطلب مسبقاً" }
    }

    // Update stop status
    stops[stopIndex].status = "rejected"
    stops[stopIndex].rejected_at = now
    stops[stopIndex].rejection_reason = reason || "المتجر غير متاح"

    // Check if ALL stores rejected
    const allRejected = stops.every((s) => s.status === "rejected")
    const allResponded = stops.every((s) => s.status === "confirmed" || s.status === "rejected")
    const hasAnyConfirmed = stops.some((s) => s.status === "confirmed")

    const timelineEntry: TimelineEntry = {
      status: "store_rejected",
      timestamp: now,
      note: `${stops[stopIndex].store_name} رفض الطلب: ${reason || "غير متاح"}`,
    }

    const timeline = [...(orderData.timeline || []), timelineEntry]

    const updatePayload: Record<string, any> = {
      pickup_stops: stops,
      timeline,
      updated_at: now,
    }

    if (allRejected) {
      // All stores rejected → cancel order
      updatePayload.status = "cancelled"
      timeline.push({
        status: "cancelled",
        timestamp: now,
        note: "تم إلغاء الطلب لأن جميع المتاجر رفضت",
      })
      updatePayload.timeline = timeline
    } else if (allResponded && hasAnyConfirmed) {
      // Some confirmed, some rejected → proceed
      updatePayload.status = "confirmed"
      const activeStops = stops.filter((s) => s.status === "confirmed")
      const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
      updatePayload.subtotal = newSubtotal
      updatePayload.total = newSubtotal + (orderData.delivery_price || 0) + (orderData.driver_commission || 0)

      timeline.push({
        status: "all_confirmed",
        timestamp: now,
        note: "تم تأكيد الطلب من المتاجر المتاحة",
      })
      updatePayload.timeline = timeline
    }

    await docRef.set(updatePayload, { merge: true })

    // Notifications
    const notifBatch = db.batch()

    const customerNotifRef = db.collection("notifications").doc()
    notifBatch.set(customerNotifRef, {
      user_id: orderData.customer_id,
      type: "store_rejected",
      title: `❌ ${stops[stopIndex].store_name} رفض الطلب`,
      title_en: `❌ ${stops[stopIndex].store_name} rejected your order`,
      message: allRejected
        ? "للأسف كل المتاجر رفضت الطلب. تم إلغاؤه."
        : `${reason || "المتجر غير متاح"}. تم خصم المبلغ الخاص بهذا المتجر.`,
      message_en: allRejected
        ? "All stores rejected. Order cancelled."
        : `${reason || "Store unavailable"}. Amount deducted.`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    const driverNotifRef = db.collection("notifications").doc()
    notifBatch.set(driverNotifRef, {
      user_id: orderData.driver_id,
      type: "store_rejected",
      title: `❌ ${stops[stopIndex].store_name} رفض الطلب`,
      title_en: `❌ ${stops[stopIndex].store_name} rejected`,
      message: allRejected
        ? "كل المتاجر رفضت الطلب. تم إلغاؤه."
        : `المتجر رفض. الطلب يستمر مع باقي المتاجر.`,
      message_en: allRejected
        ? "All stores rejected. Order cancelled."
        : `Store rejected. Order continues with others.`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allRejected, orderCancelled: allRejected }
  } catch (error: any) {
    console.error("[v0] Error rejecting store pickup:", error)
    return { success: false, error: error?.message || "فشل رفض الطلب" }
  }
}

// Driver marks pickup from a specific store
export async function markStorePickedUp(orderId: string, driverId: string, storeId: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }

    const orderData = orderDoc.data()
    if (orderData?.driver_id !== driverId) {
      return { success: false, error: "لا يمكنك تحديث هذا الطلب" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "المتجر غير موجود في الطلب" }
    }

    if (stops[stopIndex].status !== "confirmed") {
      return { success: false, error: "المتجر لم يأكد الطلب بعد" }
    }

    // Mark as picked up
    stops[stopIndex].status = "picked_up"
    stops[stopIndex].picked_up_at = now

    // Check if all confirmed stores are picked up
    const confirmedStops = stops.filter((s) => s.status === "picked_up" || s.status === "confirmed")
    const allPickedUp = confirmedStops.every((s) => s.status === "picked_up")
    const pickedCount = stops.filter((s) => s.status === "picked_up").length
    const totalActive = stops.filter((s) => s.status !== "rejected").length

    const timelineEntry: TimelineEntry = {
      status: "picked_up_from_store",
      timestamp: now,
      note: `السائق استلم من ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
    }

    const timeline = [...(orderData.timeline || []), timelineEntry]

    const updatePayload: Record<string, any> = {
      pickup_stops: stops,
      timeline,
      updated_at: now,
    }

    if (allPickedUp) {
      updatePayload.status = "on_the_way"
      timeline.push({
        status: "on_the_way",
        timestamp: now,
        note: "السائق استلم كل المنتجات وفي الطريق للعميل",
      })
      updatePayload.timeline = timeline
    } else {
      updatePayload.status = "picking_up"
    }

    await docRef.set(updatePayload, { merge: true })

    // Notify customer
    const notifRef = db.collection("notifications").doc()
    await notifRef.set({
      user_id: orderData.customer_id,
      type: allPickedUp ? "all_items_picked" : "driver_picked_from_store",
      title: allPickedUp
        ? "✅ السائق استلم كل المنتجات"
        : `📦 استلام من ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
      title_en: allPickedUp
        ? "✅ Driver picked up all items"
        : `📦 Picked up from ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
      message: allPickedUp
        ? "السائق في الطريق إليك الآن!"
        : `السائق استلم منتجاتك من ${stops[stopIndex].store_name}`,
      message_en: allPickedUp
        ? "Driver is on the way to you!"
        : `Driver picked up from ${stops[stopIndex].store_name}`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    revalidatePath("/account")
    return { success: true, allPickedUp }
  } catch (error: any) {
    console.error("[v0] Error marking store picked up:", error)
    return { success: false, error: error?.message || "فشل تحديث الاستلام" }
  }
}

// Get multi-store orders for a specific store (seller view)
export async function getMultiStoreOrdersForStore(storeId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("order_type", "==", "multi_store")
      .orderBy("created_at", "desc")
      .get()

    // Filter orders that contain this store in pickup_stops
    const orders = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => {
        const stops: PickupStop[] = order.pickup_stops || []
        return stops.some((s) => s.store_id === storeId)
      })
      .map((order: any) => {
        // Extract only this store's stop data
        const stop = order.pickup_stops.find((s: PickupStop) => s.store_id === storeId)
        return {
          ...order,
          my_stop: stop,
        }
      })

    return { success: true, orders }
  } catch (error: any) {
    console.error("[v0] Error fetching multi-store orders:", error)
    return { success: false, error: error?.message, orders: [] }
  }
}

// Get multi-store orders for a driver
export async function getMultiStoreOrdersForDriver(driverId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("order_type", "==", "multi_store")
      .where("driver_id", "==", driverId)
      .orderBy("created_at", "desc")
      .get()

    const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return { success: true, orders }
  } catch (error: any) {
    console.error("[v0] Error fetching driver multi-store orders:", error)
    return { success: false, error: error?.message, orders: [] }
  }
}

// Get multi-store orders for a customer
export async function getCustomerMultiStoreOrders(customerId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("order_type", "==", "multi_store")
      .where("customer_id", "==", customerId)
      .orderBy("created_at", "desc")
      .get()

    const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    return { success: true, orders }
  } catch (error: any) {
    console.error("[v0] Error fetching customer multi-store orders:", error)
    return { success: false, error: error?.message, orders: [] }
  }
}

export async function getUnreadNotifications(userId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("notifications")
      .where("user_id", "==", userId)
      .where("is_read", "==", false)
      .orderBy("created_at", "desc")
      .limit(20)
      .get()

    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return { success: true, notifications }
  } catch (error: any) {
    console.error("[v0] Error fetching notifications:", error)
    return { success: false, error: error?.message, notifications: [] }
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
  const db = getAdminDb()

  try {
    await db.collection("notifications").doc(notificationId).update({
      is_read: true,
      read_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error marking notification as read:", error)
    return { success: false, error: error?.message }
  }
}

// Get a multi-store order by ID for editing
export async function getMultiStoreOrderForEdit(orderId: string, customerId: string) {
  const db = getAdminDb()
  
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }
    
    const orderData = orderDoc.data()
    if (!orderData) {
      return { success: false, error: "بيانات الطلب غير متاحة" }
    }
    
    if (orderData.customer_id !== customerId) {
      return { success: false, error: "ليس لديك صلاحية لتعديل هذا الطلب" }
    }
    
    if (orderData.order_type !== "multi_store") {
      return { success: false, error: "هذا ليس طلب متعدد المتاجر" }
    }

    // Convert Timestamps
    const createdAt = orderData.created_at?.toDate?.()?.toISOString?.() || orderData.created_at
    const updatedAt = orderData.updated_at?.toDate?.()?.toISOString?.() || orderData.updated_at
    
    return { 
      success: true, 
      order: {
        id: orderDoc.id,
        ...orderData,
        created_at: createdAt,
        updated_at: updatedAt,
      }
    }
  } catch (error: any) {
    console.error("[v0] Error fetching order for edit:", error)
    return { success: false, error: error?.message || "فشل تحميل الطلب" }
  }
}

// Add new pickup stops to replace rejected ones in a multi-store order
export async function addStopsToMultiStoreOrder(orderId: string, customerId: string, newStops: {
  store_id: string
  store_name: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
    image_url?: string | null
  }[]
  subtotal: number
}[]) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) {
      return { success: false, error: "الطلب غير موجود" }
    }
    
    const orderData = orderDoc.data()
    if (!orderData) {
      return { success: false, error: "بيانات الطلب غير متاحة" }
    }
    
    if (orderData.customer_id !== customerId) {
      return { success: false, error: "ليس لديك صلاحية لتعديل هذا الطلب" }
    }
    
    if (orderData.order_type !== "multi_store") {
      return { success: false, error: "هذا ليس طلب متعدد المتاجر" }
    }

    // Check order is not delivered or cancelled
    if (orderData.status === "delivered" || orderData.status === "cancelled") {
      return { success: false, error: "لا يمكن تعديل طلب مكتمل أو ملغي" }
    }
    
    // Validate stock for new items
    for (const stop of newStops) {
      for (const item of stop.items) {
        const productDoc = await db.collection("products").doc(item.product_id).get()
        if (!productDoc.exists) {
          return { success: false, error: `المنتج "${item.name}" غير موجود` }
        }
        const productData = productDoc.data()
        const availableStock = productData?.stock ?? 0
        if (item.quantity > availableStock) {
          return { 
            success: false, 
            error: `الكمية المطلوبة من "${item.name}" (${item.quantity}) أكبر من المتاح (${availableStock})` 
          }
        }
      }
    }
    
    const existingStops: PickupStop[] = orderData.pickup_stops || []
    
    // Prepare new stops with pending status
    const formattedNewStops: PickupStop[] = newStops.map(stop => ({
      ...stop,
      status: "pending",
      confirmed_at: null,
      picked_up_at: null,
      rejected_at: null,
      rejection_reason: null,
    }))
    
    // Merge: keep all existing stops + add new ones
    const updatedStops = [...existingStops, ...formattedNewStops]
    
    // Recalculate totals (active = confirmed + pending, exclude rejected)
    const activeStops = updatedStops.filter(s => s.status !== "rejected")
    const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
    const newTotal = newSubtotal + (orderData.delivery_price || 0) + (orderData.driver_commission || 0)
    
    // Timeline entry
    const storeNames = newStops.map(s => s.store_name).join("، ")
    const timelineEntry: TimelineEntry = {
      status: "order_edited",
      timestamp: now,
      note: `العميل أضاف منتجات من: ${storeNames}`,
    }
    
    const timeline = [...(orderData.timeline || []), timelineEntry]
    
    // If order was confirmed (all previous stores responded), set back to pending since new stores need to confirm
    let newStatus = orderData.status
    if (orderData.status === "confirmed") {
      newStatus = "pending"
    }
    
    const updatePayload: Record<string, any> = {
      pickup_stops: updatedStops,
      subtotal: newSubtotal,
      total: newTotal,
      timeline,
      status: newStatus,
      updated_at: now,
    }
    
    await db.collection("orders").doc(orderId).set(updatePayload, { merge: true })
    
    // Create order_items for new stops
    const itemsBatch = db.batch()
    for (let i = 0; i < formattedNewStops.length; i++) {
      const stop = formattedNewStops[i]
      for (const item of stop.items) {
        const itemRef = db.collection("order_items").doc()
        itemsBatch.set(itemRef, {
          order_id: orderId,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          store_id: stop.store_id,
          created_at: now,
        })
      }
    }
    await itemsBatch.commit()
    
    // Deduct stock for new items
    const stockBatch = db.batch()
    for (const stop of newStops) {
      for (const item of stop.items) {
        const productRef = db.collection("products").doc(item.product_id)
        const productDoc = await productRef.get()
        if (productDoc.exists) {
          const currentStock = productDoc.data()?.stock ?? 0
          const newStock = Math.max(0, currentStock - item.quantity)
          stockBatch.update(productRef, { stock: newStock, updated_at: now })
        }
      }
    }
    await stockBatch.commit()
    
    // Notify new stores
    const notifBatch = db.batch()
    for (const stop of formattedNewStops) {
      const notifRef = db.collection("notifications").doc()
      notifBatch.set(notifRef, {
        user_id: stop.store_id,
        type: "new_multi_order",
        title: "طلب جديد 🛒",
        title_en: "New Order 🛒",
        message: `لديك طلب جديد يحتوي على ${stop.items.length} منتج بقيمة ${stop.subtotal} جنيه`,
        message_en: `You have a new order with ${stop.items.length} items worth ${stop.subtotal} EGP`,
        data: { order_id: orderId, store_id: stop.store_id },
        is_read: false,
        created_at: now,
      })
    }
    
    // Notify driver about order update
    if (orderData.driver_id) {
      const driverNotifRef = db.collection("notifications").doc()
      notifBatch.set(driverNotifRef, {
        user_id: orderData.driver_id,
        type: "order_updated",
        title: "تم تعديل الطلب 📝",
        title_en: "Order Updated 📝",
        message: `تم إضافة متاجر جديدة للطلب. يرجى مراجعة تفاصيل الطلب.`,
        message_en: `New stores added to the order. Please review order details.`,
        data: { order_id: orderId },
        is_read: false,
        created_at: now,
      })
    }
    
    await notifBatch.commit()
    
    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error adding stops to multi-store order:", error)
    return { success: false, error: error?.message || "فشل تعديل الطلب" }
  }
}
