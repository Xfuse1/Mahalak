"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { chunkArray } from "../firebase/firestore-helpers"

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
  const orders = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as any))

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
    "profiles",
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

// Get unread notifications for a user
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
