"use server"

import type { FirebaseFirestore } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { cleanUndefined } from "@/lib/firebase/firestore-helpers"

type ProductRecord = Record<string, any>
type StoreRecord = Record<string, any>

function mapProduct(doc: FirebaseFirestore.DocumentSnapshot) {
  if (!doc.exists) return null
  return { id: doc.id, ...(doc.data() as ProductRecord) }
}

async function getStoreMap(db: FirebaseFirestore.Firestore, storeIds: string[]) {
  const uniqueIds = Array.from(new Set(storeIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, StoreRecord>()
  }

  const refs = uniqueIds.map((id) => db.collection("stores").doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, StoreRecord>()

  docs.forEach((doc) => {
    if (doc.exists) {
      map.set(doc.id, { id: doc.id, ...(doc.data() as StoreRecord) })
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
  let query: FirebaseFirestore.Query = db.collection("products")

  if (category) {
    query = query.where("category", "==", category)
  }

  const snapshot = await query.get()
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))
  products.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))

  const storeMap = await getStoreMap(
    db,
    products.map((product) => product.store_id).filter(Boolean),
  )

  return products.map((product) => attachStore(product, storeMap))
}

export async function getProduct(id: string) {
  const db = getAdminDb()
  const docSnap = await db.collection("products").doc(id).get()

  if (!docSnap.exists) {
    console.error("[v0] Error fetching product:", "Product not found")
    return null
  }

  const product = mapProduct(docSnap)
  if (!product) return null

  const storeMap = await getStoreMap(db, [product.store_id])
  return attachStore(product, storeMap)
}

export async function createProduct(formData: {
  name: string
  description: string
  price: number
  category: string
  stock: number
  image_url?: string
  store_id: string
}) {
  const db = getAdminDb()
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
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  products.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
  return products
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
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  const filtered = products
    .filter((product) => product.id !== productId)
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product) => product.store_id).filter(Boolean),
  )

  return filtered.map((product) => attachStore(product, storeMap))
}
