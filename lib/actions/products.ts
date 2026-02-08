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

    // Find best offer: product-specific > category-specific > store-wide
    let bestDiscount = 0
    let offerTitle: string | null = null

    for (const offer of activeOffers) {
      if (offer.start_date > today || offer.end_date < today) continue
      const discount = Number(offer.discount_percentage) || 0
      if (discount <= bestDiscount) continue

      if (offer.product_id === product.id && offer.store_id === product.store_id) {
        bestDiscount = discount
        offerTitle = offer.title || null
      } else if (offer.category && offer.category === product.category && !offer.product_id && offer.store_id === product.store_id) {
        if (discount > bestDiscount) { bestDiscount = discount; offerTitle = offer.title || null }
      } else if (!offer.product_id && !offer.category && offer.store_id === product.store_id) {
        if (discount > bestDiscount) { bestDiscount = discount; offerTitle = offer.title || null }
      }
    }

    return serializeData({
      ...product,
      stores: store ? { name: store.name } : null,
      discount_percentage: bestDiscount,
      offer_title: offerTitle
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
  
  // Also check for store-wide and category-wide offers
  if (product.store_id) {
    const storeOffersSnapshot = await db.collection("offers")
      .where("store_id", "==", product.store_id)
      .get()
    
    for (const doc of storeOffersSnapshot.docs) {
      const offer = doc.data()
      if (offer.start_date > today || offer.end_date < today) continue
      const d = Number(offer.discount_percentage) || 0
      if (d <= discount_percentage) continue

      // Category-specific offer
      if (!offer.product_id && offer.category && offer.category === product.category) {
        discount_percentage = d
        offer_title = offer.title
      }
      // Store-wide offer (no product_id, no category)
      else if (!offer.product_id && !offer.category) {
        discount_percentage = d
        offer_title = offer.title
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
  try {
    console.log("[v0] createProduct called with store_id:", formData.store_id)
    
    const db = getAdminDb()
    console.log("[v0] Firebase Admin DB initialized successfully")
    
    // التحقق من صحة السعر والكمية على السيرفر
    if (!formData.price || formData.price <= 0) {
      return { success: false, error: "السعر يجب أن يكون أكبر من صفر" }
    }
    if (!formData.stock || formData.stock <= 0) {
      return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" }
    }
    
    // التحقق من اعتماد المتجر قبل إنشاء المنتج
    const userDoc = await db.collection("users").doc(formData.store_id).get()
    console.log("[v0] User document fetched, exists:", userDoc.exists)
    
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

    await docRef.set(payload)
    console.log("[v0] Product created successfully with ID:", docRef.id)

    revalidatePath("/seller/products")
    return { success: true, data: { id: docRef.id, ...payload } }
  } catch (error: any) {
    console.error("[v0] Error in createProduct:", error)
    console.error("[v0] Error stack:", error?.stack)
    return { success: false, error: error?.message || "حدث خطأ غير متوقع أثناء إنشاء المنتج" }
  }
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
  
  // التحقق من صحة السعر والكمية على السيرفر
  if (formData.price !== undefined && formData.price <= 0) {
    return { success: false, error: "السعر يجب أن يكون أكبر من صفر" }
  }
  if (formData.stock !== undefined && formData.stock <= 0) {
    return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" }
  }

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

  // Fetch active offers for this store
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data()).filter(offer =>
    offer.start_date <= today && offer.end_date >= today
  )

  const enriched = products.map((product: any) => {
    // Find best offer: product-specific > category-specific > store-wide
    let bestDiscount = 0
    let offerTitle: string | null = null

    for (const offer of activeOffers) {
      const discount = Number(offer.discount_percentage) || 0
      if (discount <= bestDiscount) continue

      if (offer.product_id === product.id) {
        bestDiscount = discount
        offerTitle = offer.title || null
      } else if (offer.category && offer.category === product.category && !offer.product_id) {
        if (discount > bestDiscount) {
          bestDiscount = discount
          offerTitle = offer.title || null
        }
      } else if (!offer.product_id && !offer.category) {
        if (discount > bestDiscount) {
          bestDiscount = discount
          offerTitle = offer.title || null
        }
      }
    }

    return {
      ...product,
      discount_percentage: bestDiscount,
      offer_title: offerTitle,
    }
  })

  enriched.sort((a: any, b: any) => Number(b.rating || 0) - Number(a.rating || 0))
  return serializeData(enriched)
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
    let bestDiscount = 0
    for (const offer of activeOffers) {
      const d = Number(offer.discount_percentage) || 0
      if (d <= bestDiscount) continue
      if (offer.product_id === product.id) { bestDiscount = d }
      else if (!offer.product_id && offer.category && offer.category === product.category) { bestDiscount = d }
      else if (!offer.product_id && !offer.category) { bestDiscount = d }
    }
    return {
      ...productWithStore,
      discount_percentage: bestDiscount
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
    let bestDiscount = 0
    for (const offer of activeOffers) {
      const d = Number(offer.discount_percentage) || 0
      if (d <= bestDiscount) continue
      if (offer.product_id === product.id && offer.store_id === product.store_id) { bestDiscount = d }
      else if (!offer.product_id && offer.category && offer.category === product.category && offer.store_id === product.store_id) { bestDiscount = d }
      else if (!offer.product_id && !offer.category && offer.store_id === product.store_id) { bestDiscount = d }
    }
    return {
      ...productWithStore,
      discount_percentage: bestDiscount
    }
  }))
}

export async function uploadProductImage(formData: FormData) {
  try {
    const file = formData.get("file") as File
    const storeId = formData.get("storeId") as string

    console.log("[v0] uploadProductImage called with storeId:", storeId, "file:", file?.name)

    if (!file || !storeId) {
      return { success: false, error: "Missing file or store ID" }
    }

    const supabase = await createAdminClient()
    console.log("[v0] Supabase client initialized")
    
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

    console.log("[v0] Image uploaded successfully, URL:", publicUrl)
    return { success: true, url: publicUrl }
  } catch (error: any) {
    console.error("[v0] Server upload error:", error)
    console.error("[v0] Server upload error stack:", error?.stack)
    return { success: false, error: error?.message || "Internal server error during upload" }
  }
}
