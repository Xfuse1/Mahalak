"use server"

import type { DocumentSnapshot, Query } from "firebase-admin/firestore"
import { revalidatePath, revalidateTag } from "next/cache"
import { unstable_cache } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { createAdminClient } from "../supabase/server"
import { serializeData } from "../firebase/firestore-helpers"
import { logError } from "../logger"

export type StoreRecord = {
  seller_id: string
  name?: string
  description?: string
  address?: string
  phone?: string
  category?: string
  category_id?: string
  latitude?: number | null
  longitude?: number | null
  whatsapp_number?: string
  support_email?: string
  owner_id_number?: string
  id_card_image_url?: string | null
  id_card_image_back_url?: string | null
  commercial_register_image_url?: string | null
  tax_card_image_url?: string | null
  tax_card_image_back_url?: string | null
  image_url?: string
  open_time?: string
  close_time?: string
  working_days?: string
  return_policy?: string
  is_approved?: boolean
  rating?: number
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

type EmbeddedStoreRecord = Omit<StoreRecord, "seller_id">

export type Store = StoreRecord & { id: string }

type ActiveOffer = {
  store_id?: string
  start_date?: string
  end_date?: string
  discount_percentage?: number
  title?: string
}

type StoreWithActiveOffer = Store & {
  activeOffer: {
    discount_percentage?: number
    title?: string
  } | null
}

export type StoreCreateInput = {
  seller_id: string
  name: string
  address: string
  phone: string
  category: string
  category_id?: string
  description?: string
  latitude?: number
  longitude?: number
  whatsapp_number?: string
  support_email?: string
  owner_id_number?: string
  id_card_image_url?: string
  id_card_image_back_url?: string
  commercial_register_image_url?: string
  tax_card_image_url?: string
  tax_card_image_back_url?: string
  image_url?: string
  open_time?: string
  close_time?: string
  working_days?: string
  return_policy?: string
}

export type StoreUpdateInput = {
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
  latitude: number
  longitude: number
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

// مستندات KYC تُخزَّن في bucket خاص (kyc-documents) كمسارات. تُقدَّم عبر signed URLs
// قصيرة العمر للمالك/الأدمن فقط. القيم القديمة (روابط http عامة) تُمرَّر كما هي.
export const KYC_FIELDS = [
  "id_card_image_url",
  "id_card_image_back_url",
  "commercial_register_image_url",
  "tax_card_image_url",
  "tax_card_image_back_url",
] as const

export async function signKycFields<T extends Record<string, unknown>>(store: T): Promise<T> {
  let supabase: Awaited<ReturnType<typeof createAdminClient>> | null = null
  for (const f of KYC_FIELDS) {
    const v = store[f]
    if (v && typeof v === "string" && !v.startsWith("http")) {
      if (!supabase) supabase = await createAdminClient()
      const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(v, 300)
      ;(store as Record<string, unknown>)[f] = data?.signedUrl || null
    }
  }
  return store
}

/**
 * Fetch the current category name from the categories collection by ID.
 * This ensures we always use the latest name even if admin renames it.
 */
export async function getCategoryNameById(categoryId: string): Promise<string | null> {
  if (!categoryId) return null
  try {
    const db = getAdminDb()
    const doc = await db.collection("categories").doc(categoryId).get()
    if (!doc.exists) return null
    return (doc.data()?.name as string) || null
  } catch {
    return null
  }
}

function normalizeStoreName(name: string) {
  return name.trim().toLowerCase()
}

// Helper to extract store from user document
// Store ID is now the same as User ID (seller_id)
function extractStore(doc: DocumentSnapshot): Store | null {
  if (!doc.exists) {
    console.log(`[debug] Document ${doc.id} does not exist`);
    return null;
  }
  const data = doc.data() as any

  // Requirement: Role must be seller
  if (data?.role !== "seller") {
    console.log(`[debug] User ${doc.id} has role ${data?.role}, not seller`);
    return null;
  }

  const storeData = data?.store || {}

  // Fallbacks for fields that might be at the root
  const name = storeData.name || data?.full_name || "متجر غير معروف"
  const phone = storeData.phone || data?.phone || ""
  // Combine city and street for address if direct address is missing
  const cityStreetAddress = [data?.city, data?.street].filter(Boolean).join(", ")
  const address = storeData.address || cityStreetAddress || ""
  const description = storeData.description || ""

  // قائمة سماح بالحقول العامة فقط — نمنع تسريب بيانات KYC الحسّاسة للبائع
  // (الرقم القومي owner_id_number وروابط صور البطاقة/السجل التجاري/البطاقة الضريبية)
  // لأي زائر عبر server actions العامة (getStore/getStores تُستهلك في صفحات عامة).
  return serializeData({
    id: doc.id, // Store ID = User ID
    seller_id: doc.id,
    name,
    phone,
    address,
    description,
    category: storeData.category,
    category_id: storeData.category_id,
    latitude: storeData.latitude ?? null,
    longitude: storeData.longitude ?? null,
    whatsapp_number: storeData.whatsapp_number,
    support_email: storeData.support_email,
    image_url: storeData.image_url,
    open_time: storeData.open_time,
    close_time: storeData.close_time,
    working_days: storeData.working_days,
    return_policy: storeData.return_policy,
    is_approved: storeData.is_approved,
    rating: storeData.rating,
    created_at: storeData.created_at,
    updated_at: storeData.updated_at,
  }) as Store;
}

// نسخة خاصة بالمالك تشمل حقول KYC — تُستخدم فقط في لوحة البائع بعد التحقق من الجلسة.
function extractStoreForOwner(doc: DocumentSnapshot): Store | null {
  const base = extractStore(doc)
  if (!base) return null
  const storeData = (doc.data() as any)?.store || {}
  return serializeData({
    ...base,
    owner_id_number: storeData.owner_id_number,
    id_card_image_url: storeData.id_card_image_url ?? null,
    id_card_image_back_url: storeData.id_card_image_back_url ?? null,
    commercial_register_image_url: storeData.commercial_register_image_url ?? null,
    tax_card_image_url: storeData.tax_card_image_url ?? null,
    tax_card_image_back_url: storeData.tax_card_image_back_url ?? null,
  }) as Store
}

// Internal implementation
async function _getStoresImpl(category?: string) {
  const db = getAdminDb()

  // Query users who are sellers and have store data
  let query: Query = db.collection("users").where("role", "==", "seller")

  const snapshot = await query.get()

  // Extract stores from user documents
  let stores: Store[] = snapshot.docs
    .map((doc) => extractStore(doc))
    .filter((store): store is Store => store !== null)

  // Filter by category if provided
  if (category) {
    stores = stores.filter((store) => store.category === category)
  }

  stores.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))

  // Fetch active offers to show on store cards
  const now = new Date().toISOString()
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", now.split('T')[0])
    .get()

  const activeOffers: ActiveOffer[] = offersSnapshot.docs.map((doc) => doc.data() as ActiveOffer)
  const today = new Date().toISOString().split('T')[0]

  return stores.map((store) => {
    const storeOffer = activeOffers.find((offer) =>
      offer.store_id === store.id &&
      (offer.start_date || "") <= today &&
      (offer.end_date || "") >= today
    )
    return serializeData({
      ...store,
      activeOffer: storeOffer ? {
        discount_percentage: storeOffer.discount_percentage,
        title: storeOffer.title
      } : null
    }) as StoreWithActiveOffer
  })
}

// Check if a store name already exists in the database
export async function checkStoreNameExists(storeName: string): Promise<boolean> {
  const db = getAdminDb()
  const normalizedName = normalizeStoreName(storeName)

  if (!normalizedName) {
    return false
  }

  const snapshot = await db.collection("users").where("store_name_lower", "==", normalizedName).limit(1).get()

  return !snapshot.empty
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
  // Since store is embedded in user document, store ID = user ID.
  // المالك (تطابق الجلسة) يحصل على بياناته الكاملة شاملة KYC (للوحة الإعدادات)؛
  // غير المالك يحصل على النسخة العامة فقط (بدون الرقم القومي/صور المستندات).
  const uid = await getCurrentUid()
  if (uid && uid === userId) {
    const docSnap = await getAdminDb().collection("users").doc(userId).get()
    if (!docSnap.exists) return null
    const owner = extractStoreForOwner(docSnap)
    return owner ? await signKycFields(owner as Record<string, unknown>) as typeof owner : null
  }
  return getStore(userId)
}

export async function createStore(storeData: StoreCreateInput) {
  // التحقق سيرفر-سايد: المستخدم ينشئ متجره فقط (معرّف المتجر = معرّفه)
  const uid = await getCurrentUid()
  if (!uid || uid !== storeData.seller_id) {
    return { success: false, error: "Unauthorized" }
  }
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
    category_id: storeData.category_id || "",
    latitude: storeData.latitude || null,
    longitude: storeData.longitude || null,
    whatsapp_number: storeData.whatsapp_number || storeData.phone,
    support_email: storeData.support_email || "",
    owner_id_number: storeData.owner_id_number || "",
    id_card_image_url: storeData.id_card_image_url || null,
    id_card_image_back_url: storeData.id_card_image_back_url || null,
    commercial_register_image_url: storeData.commercial_register_image_url || null,
    tax_card_image_url: storeData.tax_card_image_url || null,
    tax_card_image_back_url: storeData.tax_card_image_back_url || null,
    is_approved: false,
    rating: 0,
    created_at: now,
    updated_at: now,
  }

  try {
    await userRef.set(
      {
        store: storePayload,
        store_name_lower: normalizeStoreName(storeData.name),
        updated_at: now,
      },
      { merge: true },
    )
  } catch (error: unknown) {
    logError("[v0] Error creating store:", error)
    return { success: false, error: getErrorMessage(error, "Failed to create store") }
  }

  // Return store ID = seller_id
  return { success: true, data: { id: storeData.seller_id, seller_id: storeData.seller_id, ...storePayload } }
}

export async function updateStore(
  id: string,
  formData: Partial<StoreUpdateInput>,
  callerId?: string,
) {
  // التحقق من الملكية سيرفر-سايد (إجباري — معرّف المتجر = معرّف المستخدم)
  const uid = await getCurrentUid()
  if (!uid || uid !== id) {
    return { success: false, error: "ليس لديك صلاحية لتعديل هذا المتجر" }
  }

  const db = getAdminDb()
  // Store ID = User ID
  const userRef = db.collection("users").doc(id)

  // Build the update object for nested store field
  const storeUpdates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(formData)) {
    if (value !== undefined) {
      storeUpdates[`store.${key}`] = value
    }
  }
  if (typeof formData.name === "string") {
    storeUpdates["store_name_lower"] = normalizeStoreName(formData.name)
  }
  storeUpdates["store.updated_at"] = new Date().toISOString()
  storeUpdates["updated_at"] = new Date().toISOString()

  try {
    await userRef.update(storeUpdates)
  } catch (error: unknown) {
    logError("[v0] Error updating store:", error)
    return { success: false, error: getErrorMessage(error, "Failed to update store") }
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

  revalidatePath("/seller/settings", "page")
  revalidatePath(`/store/${id}`, "page")
  revalidateTag("stores", "max")
  revalidateTag(`store-${id}`, "max")
  return { success: true, data: store }
}

export async function searchStores(query: string) {
  const stores = await getStores()
  const q = query.trim().toLowerCase()

  if (!q) {
    return stores
  }

  return stores.filter((store) => {
    const name = typeof store.name === "string" ? store.name.toLowerCase() : ""
    const description = typeof store.description === "string" ? store.description.toLowerCase() : ""
    return name.includes(q) || description.includes(q)
  })
}

export async function uploadStoreImage(formData: FormData) {
  const file = formData.get("file") as File
  const storeId = formData.get("storeId") as string

  if (!file || !storeId) {
    return { success: false, error: "Missing file or store ID" }
  }

  // التحقق من الملكية سيرفر-سايد (إجباري)
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: "ليس لديك صلاحية" }
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "نوع الملف غير مدعوم" }
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "الملف أكبر من 5MB" }
  }

  try {
    const supabase = await createAdminClient()
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `stores/${storeId}/${fileName}`

    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      })

    if (error) {
      logError("[v0] Storage upload error details:", error)
      return { success: false, error: error.message }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (error: unknown) {
    logError("[v0] Server upload error:", error)
    return { success: false, error: getErrorMessage(error, "Internal server error during upload") }
  }
}
