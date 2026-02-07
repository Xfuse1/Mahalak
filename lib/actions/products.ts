"use server"

import type { DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { createAdminClient } from "../supabase/server"
import { cleanUndefined, serializeData } from "../firebase/firestore-helpers"

type ProductRecord = Record<string, any>
type StoreRecord = Record<string, any>

function mapProduct(doc: DocumentSnapshot): (ProductRecord & { id: string }) | null {
  if (!doc.exists) return null
  return serializeData({ id: doc.id, ...(doc.data() as ProductRecord) })
}

// Store data is now embedded in users collection
// store_id = user_id (seller_id)
async function getStoreMap(db: Firestore, storeIds: string[]) {
  const uniqueIds = Array.from(new Set(storeIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, StoreRecord>()
  }

  // Store IDs are now User IDs, fetch from users collection
  const refs = uniqueIds.map((id) => db.collection("users").doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, StoreRecord>()

  docs.forEach((doc) => {
    if (doc.exists) {
      const data = doc.data()
      if (data?.store) {
        // Extract store data from user document
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

function attachStore(product: ProductRecord, storeMap: Map<string, StoreRecord>) {
  const store = storeMap.get(product.store_id)
  if (!store) return product

  return {
    ...product,
    stores: {
      id: store.id,
      name: store.name,
      category: store.category,
      phone: store.phone,
      address: store.address,
    },
  }
}

export async function getProducts(category?: string) {
  const db = getAdminDb()
  let query: Query = db.collection("products")

  if (category) {
    query = query.where("category", "==", category)
  }

  const snapshot = await db.collection("products").get()
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  // Fetch active offers
  const now = new Date().toISOString()
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", now.split('T')[0])
    .get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data())
  const today = new Date().toISOString().split('T')[0]

  const storeIds = Array.from(new Set(products.map((p: any) => p.store_id)))
  const storeMap = await getStoreMap(db, storeIds)

  return products.map((product: any) => {
    const store = storeMap.get(product.store_id)
    const productOffer = activeOffers.find(offer =>
      (offer.product_id === product.id || (!offer.product_id && offer.store_id === product.store_id)) &&
      offer.start_date <= today &&
      offer.end_date >= today
    )

    return serializeData({
      ...product,
      stores: store ? { name: store.name } : null,
      discount_percentage: productOffer?.discount_percentage || 0,
      offer_title: productOffer?.title || null
    })
  })
}

export async function getProduct(id: string) {
  const db = getAdminDb()
  const docSnap = await db.collection("products").doc(id).get()

  if (!docSnap.exists) {
    console.error("[v0] Error fetching product:", "Product not found")
    return null
  }

  const product = mapProduct(docSnap) as any
  if (!product) return null

  const storeMap = await getStoreMap(db, [product.store_id])
  const productWithStore = attachStore(product, storeMap)
  
  // Fetch active offer for this product
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers")
    .where("product_id", "==", id)
    .get()
  
  let discount_percentage = 0
  let offer_title = null
  
  for (const doc of offersSnapshot.docs) {
    const offer = doc.data()
    if (offer.start_date <= today && offer.end_date >= today) {
      if ((offer.discount_percentage || 0) > discount_percentage) {
        discount_percentage = offer.discount_percentage
        offer_title = offer.title
      }
    }
  }
  
  // Also check for store-wide offers (no product_id)
  if (product.store_id) {
    const storeOffersSnapshot = await db.collection("offers")
      .where("store_id", "==", product.store_id)
      .get()
    
    for (const doc of storeOffersSnapshot.docs) {
      const offer = doc.data()
      if (!offer.product_id && offer.start_date <= today && offer.end_date >= today) {
        if ((offer.discount_percentage || 0) > discount_percentage) {
          discount_percentage = offer.discount_percentage
          offer_title = offer.title
        }
      }
    }
  }
  
  return serializeData({
    ...productWithStore,
    discount_percentage,
    offer_title
  })
}

export async function createProduct(formData: {
  name: string
  description: string
  price: number
  category: string
  stock: number
  image_url?: string
  store_id: string
  simulator_section?: string | null
}) {
  const db = getAdminDb()
  
  // التحقق من اعتماد المتجر قبل إنشاء المنتج
  const userDoc = await db.collection("users").doc(formData.store_id).get()
  if (userDoc.exists) {
    const userData = userDoc.data()
    const storeData = userData?.store
    if (!storeData?.is_approved) {
      console.error("[v0] Store not approved, cannot create product")
      return { success: false, error: "متجرك غير معتمد بعد. لا يمكنك إضافة منتجات حتى يتم اعتماد متجرك من قبل الإدارة." }
    }
  }
  
  const docRef = db.collection("products").doc()
  const now = new Date().toISOString()

  const payload = {
    name: formData.name,
    description: formData.description,
    price: formData.price,
    category: formData.category,
    stock: formData.stock,
    image_url: formData.image_url || "",
    store_id: formData.store_id,
    simulator_section: formData.simulator_section || null,
    rating: 0,
    rating_count: 0,
    created_at: now,
    updated_at: now,
  }

  try {
    await docRef.set(payload)
  } catch (error: any) {
    console.error("[v0] Error creating product:", error)
    return { success: false, error: error?.message || "Failed to create product" }
  }

  revalidatePath("/seller/products")
  return { success: true, data: { id: docRef.id, ...payload } }
}

export async function updateProduct(
  id: string,
  formData: Partial<{
    name: string
    description: string
    price: number
    category: string
    stock: number
    image_url: string
    rating: number
    simulator_section?: string | null
  }>,
) {
  const db = getAdminDb()
  const docRef = db.collection("products").doc(id)

  const updateData = cleanUndefined({
    ...formData,
    updated_at: new Date().toISOString(),
  })

  try {
    await docRef.set(updateData, { merge: true })
  } catch (error: any) {
    console.error("[v0] Error updating product:", error)
    return { success: false, error: error?.message || "Failed to update product" }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: "Product not found" }
  }

  revalidatePath("/seller/products")
  revalidatePath(`/product/${id}`)
  return { success: true, data: mapProduct(updatedSnap) }
}

export async function deleteProduct(id: string) {
  const db = getAdminDb()

  try {
    await db.collection("products").doc(id).delete()
  } catch (error: any) {
    console.error("[v0] Error deleting product:", error)
    return { success: false, error: error?.message || "Failed to delete product" }
  }

  revalidatePath("/seller/products")
  return { success: true }
}

export async function getProductsByStoreId(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db.collection("products").where("store_id", "==", storeId).get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  products.sort((a: any, b: any) => Number(b.rating || 0) - Number(a.rating || 0))
  return serializeData(products)
}

export async function searchProducts(query: string) {
  const products = await getProducts()
  const q = query.trim().toLowerCase()

  if (!q) {
    return products
  }

  return products.filter((product: any) => {
    const name = (product.name || "").toLowerCase()
    const description = (product.description || "").toLowerCase()
    const storeName = (product.stores?.name || "").toLowerCase()
    return name.includes(q) || description.includes(q) || storeName.includes(q)
  })
}

export async function getRelatedProducts(productId: string, category: string, limit = 4) {
  const db = getAdminDb()
  const snapshot = await db.collection("products").where("category", "==", category).get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  const filtered = products
    .filter((product: ProductRecord & { id: string }) => product.id !== productId)
    .sort((a: ProductRecord, b: ProductRecord) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product: ProductRecord) => product.store_id).filter(Boolean),
  )

  return serializeData(filtered.map((product: ProductRecord & { id: string }) => attachStore(product, storeMap)))
}

// Get products from the same store (excluding current product)
export async function getProductsFromSameStore(productId: string, storeId: string, limit = 4) {
  const db = getAdminDb()
  const snapshot = await db.collection("products").where("store_id", "==", storeId).get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  const filtered = products
    .filter((product: ProductRecord & { id: string }) => product.id !== productId)
    .sort((a: ProductRecord, b: ProductRecord) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product: ProductRecord) => product.store_id).filter(Boolean),
  )

  // Fetch active offers for these products
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data()).filter(offer => 
    offer.start_date <= today && offer.end_date >= today
  )

  return serializeData(filtered.map((product: ProductRecord & { id: string }) => {
    const productWithStore = attachStore(product, storeMap)
    const productOffer = activeOffers.find(offer =>
      offer.product_id === product.id || !offer.product_id
    )
    return {
      ...productWithStore,
      discount_percentage: productOffer?.discount_percentage || 0
    }
  }))
}

// Get products from other stores (excluding current product and current store)
export async function getProductsFromOtherStores(productId: string, storeId: string, limit = 4) {
  const db = getAdminDb()
  const snapshot = await db.collection("products").get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  const filtered = products
    .filter((product: ProductRecord & { id: string }) =>
      product.id !== productId && product.store_id !== storeId
    )
    .sort((a: ProductRecord, b: ProductRecord) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product: ProductRecord) => product.store_id).filter(Boolean),
  )

  // Fetch all active offers
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers").get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data()).filter(offer => 
    offer.start_date <= today && offer.end_date >= today
  )

  return serializeData(filtered.map((product: ProductRecord & { id: string }) => {
    const productWithStore = attachStore(product, storeMap)
    const productOffer = activeOffers.find(offer =>
      (offer.product_id === product.id) || 
      (!offer.product_id && offer.store_id === product.store_id)
    )
    return {
      ...productWithStore,
      discount_percentage: productOffer?.discount_percentage || 0
    }
  }))
}

export async function uploadProductImage(formData: FormData) {
  const file = formData.get("file") as File
  const storeId = formData.get("storeId") as string

  if (!file || !storeId) {
    return { success: false, error: "Missing file or store ID" }
  }

  try {
    const supabase = await createAdminClient()
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `products/${storeId}/${fileName}`

    console.log(`[v0] Attempting to upload to path: ${filePath}`)
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
