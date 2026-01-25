"use server"

import type { FirebaseFirestore } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"

type StoreRecord = Record<string, any>

function mapStore(doc: FirebaseFirestore.DocumentSnapshot) {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as StoreRecord) }
}

export async function getStores(category?: string) {
  const db = getAdminDb()
  let query: FirebaseFirestore.Query = db.collection("stores")

  if (category) {
    query = query.where("category", "==", category)
  }

  const snapshot = await query.get()
  const stores = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as StoreRecord) }))

  stores.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
  return stores
}

export async function getStore(id: string) {
  const db = getAdminDb()
  const docSnap = await db.collection("stores").doc(id).get()

  if (!docSnap.exists) {
    console.error("[v0] Error fetching store: not found")
    return null
  }

  return mapStore(docSnap)
}

export async function getStoreByUserId(userId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("stores").where("seller_id", "==", userId).limit(1).get()
  const docSnap = snapshot.docs[0]

  if (!docSnap) {
    console.error("[v0] Error fetching user store: not found")
    return null
  }

  return mapStore(docSnap)
}

export async function createStore(storeData: {
  seller_id: string
  name: string
  address: string
  phone: string
  category: string
  description?: string
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  const docRef = db.collection("stores").doc()

  const payload = {
    seller_id: storeData.seller_id,
    name: storeData.name,
    address: storeData.address,
    phone: storeData.phone,
    category: storeData.category,
    description: storeData.description || "",
    rating: 0,
    created_at: now,
    updated_at: now,
  }

  try {
    await docRef.set(payload)
  } catch (error: any) {
    console.error("[v0] Error creating store:", error)
    return { success: false, error: error?.message || "Failed to create store" }
  }

  console.log("[v0] Store created successfully:")
  return { success: true, data: { id: docRef.id, ...payload } }
}

export async function updateStore(
  id: string,
  formData: Partial<{
    name: string
    description: string
    address: string
    phone: string
    image_url: string
    category: string
    open_time: string
    close_time: string
    working_days: string
    support_email: string
    whatsapp_number: string
    return_policy: string
    rating: number
  }>,
) {
  const db = getAdminDb()
  const docRef = db.collection("stores").doc(id)

  const updateData = cleanUndefined({
    ...formData,
    updated_at: new Date().toISOString(),
  })

  try {
    await docRef.set(updateData, { merge: true })
  } catch (error: any) {
    console.error("[v0] Error updating store:", error)
    return { success: false, error: error?.message || "Failed to update store" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    console.warn("[v0] Update succeeded but returned no rows for store:", id)
    return { success: false, error: "Store not found or not permitted" }
  }

  revalidatePath("/seller/settings")
  revalidatePath(`/store/${id}`)
  return { success: true, data: mapStore(updatedSnap) }
}

export async function searchStores(query: string) {
  const stores = await getStores()
  const q = query.trim().toLowerCase()

  if (!q) {
    return stores
  }

  return stores.filter((store: any) => {
    const name = (store.name || "").toLowerCase()
    const description = (store.description || "").toLowerCase()
    return name.includes(q) || description.includes(q)
  })
}
