"use server"

import type { DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { createAdminClient } from "../supabase/server"
import { cleanUndefined } from "../firebase/firestore-helpers"

type StoreRecord = Record<string, any>

function mapStore(doc: DocumentSnapshot): (StoreRecord & { id: string }) | null {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as StoreRecord) }
}

export async function getStores(category?: string) {
  const db = getAdminDb()
  let query: Query = db.collection("stores")

  if (category) {
    query = query.where("category", "==", category)
  }

  const snapshot = await query.get()
  const stores = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }))

  stores.sort((a: any, b: any) => Number(b.rating || 0) - Number(a.rating || 0))

  // Fetch active offers to show on store cards
  const now = new Date().toISOString()
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", now.split('T')[0])
    .get()

  const activeOffers = offersSnapshot.docs.map(doc => doc.data())
  const today = new Date().toISOString().split('T')[0]

  return stores.map(store => {
    const storeOffer = activeOffers.find(offer =>
      offer.store_id === store.id &&
      offer.start_date <= today &&
      offer.end_date >= today
    )
    return {
      ...store,
      activeOffer: storeOffer ? {
        discount_percentage: storeOffer.discount_percentage,
        title: storeOffer.title
      } : null
    }
  })
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
    ...storeData,
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

export async function uploadStoreImage(formData: FormData) {
  const file = formData.get("file") as File
  const storeId = formData.get("storeId") as string

  if (!file || !storeId) {
    return { success: false, error: "Missing file or store ID" }
  }

  try {
    const supabase = await createAdminClient()
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `stores/${storeId}/${fileName}`

    console.log(`[v0] Attempting to upload store image to path: ${filePath}`)
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) {
      console.error("[v0] Storage upload error details:", JSON.stringify(error, null, 2))
      return { success: false, error: error.message }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (error: any) {
    console.error("[v0] Server upload error:", error)
    return { success: false, error: error?.message || "Internal server error during upload" }
  }
}
