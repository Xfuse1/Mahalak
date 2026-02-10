"use server"

import type { DocumentSnapshot, Query } from "firebase-admin/firestore"
import { revalidatePath, revalidateTag } from "next/cache"
import { unstable_cache } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { createAdminClient } from "../supabase/server"
import { serializeData } from "../firebase/firestore-helpers"

type StoreRecord = Record<string, any>

// Helper to extract store from user document
// Store ID is now the same as User ID (seller_id)
function extractStore(doc: DocumentSnapshot): (StoreRecord & { id: string }) | null {
  if (!doc.exists) return null
  const data = doc.data()
  if (!data?.store) return null
  
  return serializeData({
    id: doc.id, // Store ID = User ID
    seller_id: doc.id,
    ...data.store,
  })
}

// Internal implementation
async function _getStoresImpl(category?: string) {
  const db = getAdminDb()
  
  // Query users who are sellers and have store data
  let query: Query = db.collection("users").where("role", "==", "seller")

  const snapshot = await query.get()
  
  // Extract stores from user documents
  let stores = snapshot.docs
    .map((doc) => {
      const data = doc.data()
      if (!data.store) return null
      return serializeData({
        id: doc.id, // Store ID = User ID
        seller_id: doc.id,
        ...data.store,
      })
    })
    .filter((store): store is NonNullable<typeof store> => store !== null)

  // Filter by category if provided
  if (category) {
    stores = stores.filter((store: any) => store.category === category)
  }

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
    return serializeData({
      ...store,
      activeOffer: storeOffer ? {
        discount_percentage: storeOffer.discount_percentage,
        title: storeOffer.title
      } : null
    })
  })
}

// Check if a store name already exists in the database
export async function checkStoreNameExists(storeName: string): Promise<boolean> {
  const db = getAdminDb()
  const normalizedName = storeName.trim().toLowerCase()
  
  const snapshot = await db.collection("users").where("role", "==", "seller").get()
  
  return snapshot.docs.some((doc) => {
    const data = doc.data()
    if (!data.store?.name) return false
    return data.store.name.trim().toLowerCase() === normalizedName
  })
}

// Cached version of getStores (revalidates every 120 seconds)
export async function getStores(category?: string) {
  return unstable_cache(
    () => _getStoresImpl(category),
    ["stores", category || "all"],
    { revalidate: 120, tags: ["stores"] }
  )()
}

// Internal getStore implementation
async function _getStoreImpl(id: string) {
  const db = getAdminDb()
  // Store ID is now User ID
  const docSnap = await db.collection("users").doc(id).get()

  if (!docSnap.exists) {
    return null
  }

  const store = extractStore(docSnap)
  if (!store) {
    return null
  }

  return store
}

// Cached version
export async function getStore(id: string) {
  return unstable_cache(
    () => _getStoreImpl(id),
    ["store", id],
    { revalidate: 120, tags: ["stores", `store-${id}`] }
  )()
}

export async function getStoreByUserId(userId: string) {
  // Since store is embedded in user document, store ID = user ID
  return getStore(userId)
}

export async function createStore(storeData: {
  seller_id: string
  name: string
  address: string
  phone: string
  category: string
  description?: string
  latitude?: number
  longitude?: number
  whatsapp_number?: string
  support_email?: string
  owner_id_number?: string
  id_card_image_url?: string
  commercial_register_image_url?: string
  tax_card_image_url?: string
}) {
  const db = getAdminDb()
  const now = new Date().toISOString()
  
  // Store data is embedded in user document
  const userRef = db.collection("users").doc(storeData.seller_id)
  
  const storePayload = {
    name: storeData.name,
    description: storeData.description || "",
    address: storeData.address,
    phone: storeData.phone,
    category: storeData.category,
    latitude: storeData.latitude || null,
    longitude: storeData.longitude || null,
    whatsapp_number: storeData.whatsapp_number || storeData.phone,
    support_email: storeData.support_email || "",
    owner_id_number: storeData.owner_id_number || "",
    id_card_image_url: storeData.id_card_image_url || null,
    commercial_register_image_url: storeData.commercial_register_image_url || null,
    tax_card_image_url: storeData.tax_card_image_url || null,
    is_approved: false,
    rating: 0,
    created_at: now,
    updated_at: now,
  }

  try {
    await userRef.set({ store: storePayload, updated_at: now }, { merge: true })
  } catch (error: any) {
    console.error("[v0] Error creating store:", error)
    return { success: false, error: error?.message || "Failed to create store" }
  }

  // Return store ID = seller_id
  return { success: true, data: { id: storeData.seller_id, seller_id: storeData.seller_id, ...storePayload } }
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
  // Store ID = User ID
  const userRef = db.collection("users").doc(id)

  // Build the update object for nested store field
  const storeUpdates: Record<string, any> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (value !== undefined) {
      storeUpdates[`store.${key}`] = value
    }
  }
  storeUpdates["store.updated_at"] = new Date().toISOString()
  storeUpdates["updated_at"] = new Date().toISOString()

  try {
    await userRef.update(storeUpdates)
  } catch (error: any) {
    console.error("[v0] Error updating store:", error)
    return { success: false, error: error?.message || "Failed to update store" }
  }

  const updatedSnap = await userRef.get()
  if (!updatedSnap.exists) {
    console.warn("[v0] Update succeeded but user not found:", id)
    return { success: false, error: "Store not found or not permitted" }
  }

  const store = extractStore(updatedSnap)
  if (!store) {
    return { success: false, error: "Store data not found" }
  }

  revalidatePath("/seller/settings")
  revalidatePath(`/store/${id}`)
  revalidateTag("stores")
  revalidateTag(`store-${id}`)
  return { success: true, data: store }
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
