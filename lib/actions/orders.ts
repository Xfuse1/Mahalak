"use server"

import type { FirebaseFirestore } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
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

async function getOrderItemsByOrderIds(db: FirebaseFirestore.Firestore, orderIds: string[]) {
  const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)))
  if (uniqueIds.length === 0) return []

  const items: RecordMap[] = []
  const chunks = chunkArray(uniqueIds, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection("order_items").where("order_id", "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      items.push({ id: doc.id, ...(doc.data() as RecordMap) })
    })
  }

  return items
}

export async function getCustomerOrders(customerId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("orders").where("customer_id", "==", customerId).get()
  const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordMap) }))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  const storeMap = await fetchDocsMap(
    db,
    "stores",
    orders.map((order) => order.store_id),
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

  const itemsByOrder = new Map<string, RecordMap[]>()
  orderItems.forEach((item) => {
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

  return orders.map((order) => {
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
  const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as RecordMap) }))

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
    "profiles",
    orders.map((order) => order.customer_id),
  )

  const itemsByOrder = new Map<string, RecordMap[]>()
  orderItems.forEach((item) => {
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

  return orders.map((order) => {
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

export async function updateOrderStatus(orderId: string, status: string) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)

  try {
    await docRef.set({ status, updated_at: new Date().toISOString() }, { merge: true })
  } catch (error: any) {
    console.error("[v0] Error updating order status:", error)
    return { success: false, error: error?.message || "Failed to update order status" }
  }

  const updatedSnap = await docRef.get()
  revalidatePath("/seller/orders")
  revalidatePath("/account")
  return { success: true, data: updatedSnap.exists ? { id: updatedSnap.id, ...(updatedSnap.data() as RecordMap) } : null }
}

export async function createOrder(orderData: {
  customer_id: string
  store_id: string
  total: number
  delivery_address: string
  items: { product_id: string; quantity: number; price: number }[]
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  const orderRef = db.collection("orders").doc()

  const orderPayload = {
    customer_id: orderData.customer_id,
    store_id: orderData.store_id,
    total: Number(orderData.total),
    delivery_address: orderData.delivery_address,
    status: "pending",
    created_at: now,
    updated_at: now,
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
