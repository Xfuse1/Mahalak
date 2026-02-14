"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { FieldValue } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { chunkArray } from "../firebase/firestore-helpers"
import { logError } from "../logger"
import { createNotification, sendReviewRequestNotification } from "./notifications"

type RecordMap = {
  id: string
  [key: string]: unknown
}

type OrderItemRecord = {
  id: string
  order_id: string
  product_id: string
  quantity?: number
  price?: number
  name?: string
  image_url?: string | null
  [key: string]: unknown
}

type OrderRecord = {
  id: string
  order_type?: string
  store_id?: string
  customer_id?: string
  driver_id?: string
  driver_name?: string
  status?: string
  total?: number
  created_at?: string
  delivery_address?: string
  timeline?: TimelineEntry[]
  pickup_stops?: PickupStop[]
  [key: string]: unknown
}

type ItemProductRef = {
  id: string
  name: string
  image_url: string | null
}

type OrderItemWithProduct = OrderItemRecord & {
  products: ItemProductRef | null
}

// Timeline entry type for order tracking
type TimelineEntry = {
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

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }

  return undefined
}

function isInquiryOrder(order: OrderRecord) {
  return (
    order.order_type === "inquiry" ||
    order.status === "inquiry" ||
    order.delivery_address === "Contact via WhatsApp" ||
    order.delivery_address === "Contact via Phone"
  )
}

async function fetchDocsMap(db: Firestore, collection: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, RecordMap>()
  }

  const refs = uniqueIds.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, RecordMap>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      map.set(doc.id, { ...(doc.data() as Record<string, unknown>), id: doc.id })
    }
  })

  return map
}

// Fetch store data from users collection (stores are now embedded in users)
async function fetchStoresMap(db: Firestore, storeIds: string[]) {
  const uniqueIds = Array.from(new Set(storeIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, RecordMap>()
  }

  // Store IDs are now User IDs
  const refs = uniqueIds.map((id) => db.collection("users").doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, RecordMap>()

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
  if (uniqueIds.length === 0) return [] as OrderItemRecord[]

  const items: OrderItemRecord[] = []
  const chunks = chunkArray(uniqueIds, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection("order_items").where("order_id", "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const orderId = typeof data.order_id === "string" ? data.order_id : ""
      const productId = typeof data.product_id === "string" ? data.product_id : ""
      items.push({
        ...(data as Record<string, unknown>),
        id: doc.id,
        order_id: orderId,
        product_id: productId,
      })
    })
  }

  return items
}

// Get a single order by ID
export async function getOrderById(orderId: string, callerUserId?: string) {
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

    // Ownership check: if callerUserId is provided, verify access
    if (callerUserId) {
      const isCustomer = orderData.customer_id === callerUserId
      const isSeller = orderData.store_id === callerUserId
      const isDriver = orderData.driver_id === callerUserId
      if (!isCustomer && !isSeller && !isDriver) {
        return null
      }
    }

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
    logError("[v0] Error fetching order:", error)
    return null
  }
}

export async function getCustomerOrders(customerId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("customer_id", "==", customerId).get()
  // Filter out multi-store and inquiry records from regular customer orders
  const orders: OrderRecord[] = snapshot.docs
    .map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id } as OrderRecord))
    .filter((order) => order.order_type !== "multi_store" && !isInquiryOrder(order))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  // Use fetchStoresMap for stores (now embedded in users collection)
  const storeMap = await fetchStoresMap(
    db,
    orders.map((order) => order.store_id || ""),
  )

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item) => item.product_id),
  )

  const itemsByOrder = new Map<string, OrderItemWithProduct[]>()
  orderItems.forEach((item) => {
    const product = productMap.get(item.product_id)
    const entry: OrderItemWithProduct = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: typeof product.name === "string" ? product.name : "",
          image_url: typeof product.image_url === "string" ? product.image_url : null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order) => {
    const store = order.store_id ? storeMap.get(order.store_id) : null
    return {
      ...order,
      stores: store
        ? {
          id: store.id,
          name: typeof store.name === "string" ? store.name : "",
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

export async function getPendingOrdersCount(storeId: string): Promise<number> {
  const db = getAdminDb()
  try {
    // Count single-store pending orders
    const singleSnap = await db.collection("orders")
      .where("store_id", "==", storeId)
      .where("status", "==", "pending")
      .get()
    let count = singleSnap.size

    // Count multi-store orders where this store's stop is pending
    const multiSnap = await db.collection("orders")
      .where("order_type", "==", "multi_store")
      .get()
    multiSnap.docs.forEach((doc) => {
      const stops: PickupStop[] = (doc.data().pickup_stops as PickupStop[]) || []
      const myStop = stops.find((s) => s.store_id === storeId)
      if (myStop && myStop.status === "pending") {
        count++
      }
    })

    return count
  } catch (error) {
    logError("[getPendingOrdersCount] Error:", error)
    return 0
  }
}

export async function getStoreOrders(storeId: string, callerId: string) {
  if (callerId !== storeId) {
    logError("[getStoreOrders] Unauthorized access attempt", { storeId, callerId })
    return []
  }

  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("store_id", "==", storeId).get()
  // Exclude inquiry records from standard seller order lists
  const orders: OrderRecord[] = snapshot.docs
    .map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id } as OrderRecord))
    .filter((order) => !isInquiryOrder(order))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  if (orders.length === 0) {
    return []
  }

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item) => item.product_id),
  )

  const customerMap = await fetchDocsMap(
    db,
    "users",
    orders.map((order) => order.customer_id || ""),
  )

  const itemsByOrder = new Map<string, OrderItemWithProduct[]>()
  orderItems.forEach((item) => {
    const product = productMap.get(item.product_id)
    const entry: OrderItemWithProduct = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: typeof product.name === "string" ? product.name : "",
          image_url: typeof product.image_url === "string" ? product.image_url : null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order) => {
    const profile = order.customer_id ? customerMap.get(order.customer_id) : null
    return {
      ...order,
      profiles: profile
        ? {
          id: profile.id,
          full_name: typeof profile.full_name === "string" ? profile.full_name : null,
          email: typeof profile.email === "string" ? profile.email : "",
          phone: typeof profile.phone === "string" ? profile.phone : null,
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  callerId: string,
  callerRole: "seller" | "driver" | "admin",
  note?: string
) {
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

    if (!currentData) {
      return { success: false, error: "Order not found" }
    }

    // Authorization check
    if (callerRole === "seller" && currentData.store_id !== callerId) {
      return { success: false, error: "Unauthorized: not your store order" }
    }
    if (callerRole === "driver" && currentData.driver_id !== callerId) {
      return { success: false, error: "Unauthorized: not your delivery" }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
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
    } else if (currentData?.customer_id && status !== "ordered") {
      // Send general status update notification for all statuses including pending and reviewing
      const statusMessages: Record<string, { ar: string, en: string }> = {
        pending: { ar: "تم استلام طلبك وهو قيد الانتظار", en: "Your order has been received and is pending" },
        reviewing: { ar: "طلبك قيد المراجعة الآن", en: "Your order is being reviewed" },
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

      // Use /account for single-store orders, /account/edit-order for multi-store
      const notificationLink = currentData.order_type === "multi_store"
        ? `/account/edit-order/${orderId}`
        : `/account`

      await createNotification({
        user_id: currentData.customer_id,
        title: "تحديث حالة الطلب",
        title_en: "Order Status Update",
        message: message.ar,
        message_en: message.en,
        type: "order_status",
        link: notificationLink,
        data: { order_id: orderId, status }
      })
    }
  } catch (error: unknown) {
    logError("[v0] Error updating order status:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to update order status" }
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

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Step 1: Read and verify stock + prices atomically
      const verifiedItems: { product_id: string; quantity: number; price: number; productRef: FirebaseFirestore.DocumentReference }[] = []
      for (const item of orderData.items) {
        const productRef = db.collection("products").doc(item.product_id)
        const productDoc = await transaction.get(productRef)
        if (!productDoc.exists) {
          throw new Error("Product not found")
        }
        const productData = productDoc.data()
        const availableStock = productData?.stock ?? 0
        if (item.quantity > availableStock) {
          throw new Error(`Requested quantity for "${productData?.name || 'product'}" (${item.quantity}) exceeds available stock (${availableStock})`)
        }
        verifiedItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price: productData?.price ?? item.price,
          productRef,
        })
      }

      // Step 2: Calculate verified total
      const verifiedSubtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const verifiedTotal = verifiedSubtotal + (orderData.delivery_price || 0)

      const orderRef = db.collection("orders").doc()

      const orderPayload: Record<string, unknown> = {
        customer_id: orderData.customer_id,
        store_id: orderData.store_id,
        total: Number(verifiedTotal),
        delivery_address: orderData.delivery_address,
        status: "pending",
        created_at: now,
        updated_at: now,
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

      // Step 3: Create order atomically
      transaction.set(orderRef, orderPayload)

      // Step 4: Create order items atomically
      verifiedItems.forEach((item) => {
        const itemRef = db.collection("order_items").doc()
        transaction.set(itemRef, {
          order_id: orderRef.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          created_at: now,
        })
      })

      // Step 5: Decrement stock atomically
      for (const item of verifiedItems) {
        transaction.update(item.productRef, {
          stock: FieldValue.increment(-item.quantity),
          updated_at: now,
        })
      }

      return { orderId: orderRef.id, orderPayload, storeId: orderData.store_id }
    })

    // Notifications outside transaction (non-critical)
    try {
      await createNotification({
        user_id: result.storeId,
        title: "طلب جديد",
        title_en: "New Order",
        message: `لديك طلب جديد برقم ${result.orderId}`,
        message_en: `You have a new order: ${result.orderId}`,
        type: "new_order",
        link: "/seller/orders",
        data: { order_id: result.orderId, store_id: result.storeId },
      })
    } catch {
      // Silent: notification failure should not affect order
    }

    revalidatePath("/account")
    return { success: true, data: { id: result.orderId, ...result.orderPayload } }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) || "Failed to create order" }
  }
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
    status: "inquiry",
    order_type: "inquiry",
    contact_method: inquiryData.contact_method,
    inquiry_product_id: inquiryData.product_id,
    created_at: now,
    updated_at: now,
  }

  try {
    await orderRef.set(orderPayload)
  } catch (error: unknown) {
    logError("[v0] Error creating contact inquiry:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to create inquiry" }
  }

  try {
    await db.collection("order_items").doc().set({
      order_id: orderRef.id,
      product_id: inquiryData.product_id,
      quantity: 1,
      price: Number(inquiryData.price),
      created_at: now,
    })
  } catch (error: unknown) {
    logError("[v0] Error creating order item:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to create inquiry item" }
  }

  revalidatePath("/account")
  revalidatePath("/seller/orders")
  return { success: true, data: { id: orderRef.id, ...orderPayload } }
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
      return { success: false, error: "Order not found" }
    }

    const orderData = orderDoc.data()

    // Verify the customer owns this order
    if (orderData?.customer_id !== customerId) {
      return { success: false, error: "You are not allowed to modify this order" }
    }

    // Only allow driver change if status is driver_rejected or pending
    if (orderData?.status !== "driver_rejected" && orderData?.status !== "pending") {
      return { success: false, error: "Driver cannot be changed at this stage" }
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
    const updatePayload: Record<string, unknown> = {
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
  } catch (error: unknown) {
    logError("[v0] Error changing driver:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to change driver" }
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
  } catch (error: unknown) {
    logError("[v0] Error fetching rejected orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
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

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Step 1: Read and verify stock + prices atomically
      const verifiedStops: PickupStop[] = []
      const productRefs: { ref: FirebaseFirestore.DocumentReference; quantity: number }[] = []

      for (const stop of orderData.pickup_stops) {
        const verifiedItems: PickupStop["items"] = []
        for (const item of stop.items) {
          const productRef = db.collection("products").doc(item.product_id)
          const productDoc = await transaction.get(productRef)
          if (!productDoc.exists) {
            throw new Error("Product not found")
          }
          const productData = productDoc.data()
          const availableStock = productData?.stock ?? 0
          if (item.quantity > availableStock) {
            throw new Error(`Requested quantity for "${productData?.name || 'product'}" (${item.quantity}) exceeds available stock (${availableStock})`)
          }
          verifiedItems.push({
            ...item,
            price: productData?.price ?? item.price,
          })
          productRefs.push({ ref: productRef, quantity: item.quantity })
        }
        const verifiedSubtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        verifiedStops.push({
          ...stop,
          items: verifiedItems,
          subtotal: verifiedSubtotal,
        })
      }

      // Calculate subtotal from verified stops
      const subtotal = verifiedStops.reduce((sum, stop) => sum + stop.subtotal, 0)
      const total = subtotal + orderData.delivery_price

      // Prepare pickup stops with default status
      const stops: PickupStop[] = verifiedStops.map((stop) => ({
        ...stop,
        status: "pending",
        confirmed_at: null,
        picked_up_at: null,
        rejected_at: null,
        rejection_reason: null,
      }))
      const storeIds = Array.from(new Set(stops.map((stop) => stop.store_id).filter(Boolean)))

      const orderPayload: Record<string, unknown> = {
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
        store_ids: storeIds,
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

      // Step 2: Create order atomically
      transaction.set(orderRef, orderPayload)

      // Step 3: Create order_items atomically
      for (let i = 0; i < stops.length; i++) {
        for (const item of stops[i].items) {
          const itemRef = db.collection("order_items").doc()
          transaction.set(itemRef, {
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

      // Step 4: Decrement stock atomically
      for (const { ref, quantity } of productRefs) {
        transaction.update(ref, {
          stock: FieldValue.increment(-quantity),
          updated_at: now,
        })
      }

      return { orderId: orderRef.id, orderPayload, stops }
    })

    // Notifications outside transaction (non-critical)
    try {
      const notifBatch = db.batch()
      for (const stop of result.stops) {
        const notifRef = db.collection("notifications").doc()
        notifBatch.set(notifRef, {
          user_id: stop.store_id,
          type: "new_multi_order",
          title: "طلب جديد 🛒",
          title_en: "New Order 🛒",
          message: `لديك طلب جديد يحتوي على ${stop.items.length} منتج بقيمة ${stop.subtotal} جنيه`,
          message_en: `You have a new order with ${stop.items.length} items worth ${stop.subtotal} EGP`,
          link: "/seller/orders",
          data: { order_id: result.orderId, store_id: stop.store_id },
          is_read: false,
          created_at: now,
        })
      }

      const driverNotifRef = db.collection("notifications").doc()
      notifBatch.set(driverNotifRef, {
        user_id: orderData.driver_id,
        type: "new_multi_order",
        title: "طلب توصيل جديد 🚗",
        title_en: "New Delivery Order 🚗",
        message: `لديك طلب جديد من ${result.stops.length} متجر. في انتظار تأكيد المتاجر.`,
        message_en: `New order from ${result.stops.length} stores. Waiting for store confirmations.`,
        link: `/driver/orders?driverId=${orderData.driver_id}`,
        data: { order_id: result.orderId },
        is_read: false,
        created_at: now,
      })

      await notifBatch.commit()
    } catch {
      // Silent: notification failure should not affect order
    }

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, data: { id: result.orderId, ...result.orderPayload } }
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) || "Failed to create order" }
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
      return { success: false, error: "Order not found" }
    }

    const orderData = orderDoc.data()
    if (orderData?.order_type !== "multi_store") {
      return { success: false, error: "This is not a multi-store order" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "Your store was not found in this order" }
    }

    if (stops[stopIndex].status !== "pending") {
      return { success: false, error: "This order has already been handled" }
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

    const updatePayload: Record<string, unknown> = {
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
      link: `/account/edit-order/${orderId}`,
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
      link: `/driver/orders?driverId=${orderData.driver_id}`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allConfirmed: allConfirmed && hasAnyConfirmed }
  } catch (error: unknown) {
    logError("[v0] Error confirming store pickup:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to confirm order" }
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
      return { success: false, error: "Order not found" }
    }

    const orderData = orderDoc.data()
    if (orderData?.order_type !== "multi_store") {
      return { success: false, error: "This is not a multi-store order" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "Your store was not found in this order" }
    }

    if (stops[stopIndex].status !== "pending") {
      return { success: false, error: "This order has already been handled" }
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

    const updatePayload: Record<string, unknown> = {
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
      link: `/account/edit-order/${orderId}`,
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
      link: `/driver/orders?driverId=${orderData.driver_id}`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allRejected, orderCancelled: allRejected }
  } catch (error: unknown) {
    logError("[v0] Error rejecting store pickup:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to reject order" }
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
      return { success: false, error: "Order not found" }
    }

    const orderData = orderDoc.data()
    if (orderData?.driver_id !== driverId) {
      return { success: false, error: "You are not allowed to update this order" }
    }

    const stops: PickupStop[] = orderData.pickup_stops || []
    const stopIndex = stops.findIndex((s) => s.store_id === storeId)

    if (stopIndex === -1) {
      return { success: false, error: "Store not found in this order" }
    }

    if (stops[stopIndex].status !== "confirmed") {
      return { success: false, error: "Store has not confirmed this order yet" }
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

    const updatePayload: Record<string, unknown> = {
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
      link: `/account/edit-order/${orderId}`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    revalidatePath("/account")
    return { success: true, allPickedUp }
  } catch (error: unknown) {
    logError("[v0] Error marking store picked up:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to update pickup status" }
  }
}

// Get multi-store orders for a specific store (seller view)
export async function getMultiStoreOrdersForStore(storeId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("store_ids", "array-contains", storeId)
      .get()

    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OrderRecord))
      .filter((order) => order.order_type === "multi_store")
      .map((order) => {
        const stops: PickupStop[] = order.pickup_stops || []
        const stop = stops.find((s) => s.store_id === storeId)
        return {
          ...order,
          my_stop: stop,
        }
      })

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get multi-store orders for a driver
export async function getMultiStoreOrdersForDriver(driverId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("driver_id", "==", driverId)
      .get()

    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OrderRecord))
      .filter((order) => order.order_type === "multi_store")

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching driver multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get multi-store orders for a customer
export async function getCustomerMultiStoreOrders(customerId: string) {
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("customer_id", "==", customerId)
      .get()

    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OrderRecord))
      .filter((order) => order.order_type === "multi_store")

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching customer multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get a multi-store order by ID for editing
export async function getMultiStoreOrderForEdit(orderId: string, customerId: string) {
  const db = getAdminDb()
  
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) {
      return { success: false, error: "Order not found" }
    }
    
    const orderData = orderDoc.data()
    if (!orderData) {
      return { success: false, error: "Order data is unavailable" }
    }
    
    if (orderData.customer_id !== customerId) {
      return { success: false, error: "You are not authorized to edit this order" }
    }
    
    if (orderData.order_type !== "multi_store") {
      return { success: false, error: "This is not a multi-store order" }
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
  } catch (error: unknown) {
    logError("[v0] Error fetching order for edit:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to load order" }
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
      return { success: false, error: "Order not found" }
    }
    
    const orderData = orderDoc.data()
    if (!orderData) {
      return { success: false, error: "Order data is unavailable" }
    }
    
    if (orderData.customer_id !== customerId) {
      return { success: false, error: "You are not authorized to edit this order" }
    }
    
    if (orderData.order_type !== "multi_store") {
      return { success: false, error: "This is not a multi-store order" }
    }

    // Check order is not delivered or cancelled
    if (orderData.status === "delivered" || orderData.status === "cancelled") {
      return { success: false, error: "Completed or cancelled orders cannot be edited" }
    }
    
    // Validate stock for new items
    for (const stop of newStops) {
      for (const item of stop.items) {
        const productDoc = await db.collection("products").doc(item.product_id).get()
        if (!productDoc.exists) {
          return { success: false, error: `Product "${item.name}" was not found` }
        }
        const productData = productDoc.data()
        const availableStock = productData?.stock ?? 0
        if (item.quantity > availableStock) {
          return { 
            success: false, 
            error: `Requested quantity for "${item.name}" (${item.quantity}) exceeds available stock (${availableStock})` 
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
    const updatedStoreIds = Array.from(new Set(updatedStops.map((s) => s.store_id).filter(Boolean)))
    
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
    
    const updatePayload: Record<string, unknown> = {
      pickup_stops: updatedStops,
      store_ids: updatedStoreIds,
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
        link: "/seller/orders",
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
        link: `/driver/orders?driverId=${orderData.driver_id}`,
        data: { order_id: orderId },
        is_read: false,
        created_at: now,
      })
    }
    
    await notifBatch.commit()
    
    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true }
  } catch (error: unknown) {
    logError("[v0] Error adding stops to multi-store order:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to edit order" }
  }
}
