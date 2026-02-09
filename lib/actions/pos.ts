"use server"

import { getAdminDb } from "../firebase/admin"
import { serializeData } from "../firebase/firestore-helpers"
import { revalidatePath } from "next/cache"

// ==================== POS Products ====================

export async function getPOSProducts(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db
    .collection("products")
    .where("store_id", "==", storeId)
    .get()

  const products = snapshot.docs.map((doc) => {
    const data = doc.data()
    return serializeData({
      id: doc.id,
      name: data.name || "",
      description: data.description || "",
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
      category: data.category || "",
      image_url: data.image_url || "",
      barcode: data.barcode || "",
      sku: data.sku || "",
    })
  })

  return products
}

// ==================== POS Categories ====================

export async function getPOSCategories(storeId: string) {
  const db = getAdminDb()
  const snapshot = await db
    .collection("products")
    .where("store_id", "==", storeId)
    .get()

  const categories = new Set<string>()
  snapshot.docs.forEach((doc) => {
    const cat = doc.data().category
    if (cat) categories.add(cat)
  })

  return Array.from(categories)
}

// ==================== POS Sales ====================

export type POSSaleItem = {
  product_id: string
  name: string
  price: number
  quantity: number
  total: number
  image_url?: string
}

export type POSSaleData = {
  store_id: string
  seller_id: string
  items: POSSaleItem[]
  subtotal: number
  discount: number
  discount_type: "percentage" | "fixed"
  tax: number
  total: number
  amount_paid: number
  change: number
  payment_method: "cash" | "card" | "wallet"
  customer_name?: string
  customer_phone?: string
  notes?: string
}

export async function createPOSSale(saleData: POSSaleData) {
  const db = getAdminDb()
  const now = new Date().toISOString()

  // Validate stock availability
  for (const item of saleData.items) {
    const productDoc = await db.collection("products").doc(item.product_id).get()
    if (!productDoc.exists) {
      return { success: false, error: `المنتج "${item.name}" غير موجود` }
    }
    const productData = productDoc.data()
    const availableStock = Number(productData?.stock) || 0
    if (item.quantity > availableStock) {
      return {
        success: false,
        error: `الكمية المطلوبة من "${item.name}" (${item.quantity}) أكبر من المتاح (${availableStock})`,
      }
    }
  }

  // Create POS sale record
  const saleRef = db.collection("pos_sales").doc()
  const salePayload = {
    store_id: saleData.store_id,
    seller_id: saleData.seller_id,
    items: saleData.items,
    subtotal: saleData.subtotal,
    discount: saleData.discount,
    discount_type: saleData.discount_type,
    tax: saleData.tax,
    total: saleData.total,
    amount_paid: saleData.amount_paid,
    change: saleData.change,
    payment_method: saleData.payment_method,
    customer_name: saleData.customer_name || null,
    customer_phone: saleData.customer_phone || null,
    notes: saleData.notes || null,
    sale_number: `POS-${Date.now()}`,
    created_at: now,
  }

  try {
    await saleRef.set(salePayload)
  } catch (error: any) {
    console.error("[POS] Error creating sale:", error)
    return { success: false, error: error?.message || "فشل في إنشاء عملية البيع" }
  }

  // Deduct stock
  const stockBatch = db.batch()
  for (const item of saleData.items) {
    const productRef = db.collection("products").doc(item.product_id)
    const productDoc = await productRef.get()
    if (productDoc.exists) {
      const currentStock = Number(productDoc.data()?.stock) || 0
      const newStock = Math.max(0, currentStock - item.quantity)
      stockBatch.update(productRef, { stock: newStock, updated_at: now })
    }
  }

  try {
    await stockBatch.commit()
  } catch (error: any) {
    console.error("[POS] Error deducting stock:", error)
  }

  revalidatePath("/seller/products")
  return {
    success: true,
    data: { id: saleRef.id, sale_number: salePayload.sale_number, ...salePayload },
  }
}

// ==================== POS Quick Add Product ====================

export async function createPOSQuickProduct(data: {
  name: string
  price: number
  stock: number
  category: string
  barcode?: string
  store_id: string
}) {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check if barcode already exists for this store
    if (data.barcode) {
      const existing = await db
        .collection("products")
        .where("store_id", "==", data.store_id)
        .where("barcode", "==", data.barcode)
        .get()
      
      if (!existing.empty) {
        return { success: false, error: `يوجد منتج بنفس الباركود: ${existing.docs[0].data().name}` }
      }
    }

    const docRef = db.collection("products").doc()
    const payload = {
      name: data.name,
      description: "",
      price: data.price,
      stock: data.stock,
      category: data.category,
      barcode: data.barcode || "",
      image_url: "",
      store_id: data.store_id,
      rating: 0,
      rating_count: 0,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(payload)
    revalidatePath("/seller/products")

    return {
      success: true,
      data: serializeData({ id: docRef.id, ...payload }),
    }
  } catch (error: any) {
    console.error("[POS] Error creating quick product:", error)
    return { success: false, error: error?.message || "فشل في إضافة المنتج" }
  }
}

// ==================== POS Sales History ====================

export async function getPOSSales(storeId: string, limit: number = 50) {
  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_sales")
      .where("store_id", "==", storeId)
      .get()

    // Sort in memory and limit
    const sales = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })
      .slice(0, limit)

    return sales.map(sale => serializeData(sale))
  } catch (error: any) {
    console.error("[getPOSSales] Error:", error)
    throw new Error(`فشل في تحميل سجل المبيعات: ${error?.message || "خطأ غير معروف"}`)
  }
}

export async function getPOSSaleById(saleId: string) {
  const db = getAdminDb()
  const doc = await db.collection("pos_sales").doc(saleId).get()
  if (!doc.exists) return null
  return serializeData({ id: doc.id, ...doc.data() })
}

// ==================== POS Daily Summary ====================

export async function getPOSDailySummary(storeId: string, date?: string) {
  try {
    const db = getAdminDb()
    const targetDate = date || new Date().toISOString().split("T")[0]
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`).getTime()
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).getTime()

    // Get all sales for store (simple query)
    const snapshot = await db
      .collection("pos_sales")
      .where("store_id", "==", storeId)
      .get()

    let totalSales = 0
    let totalRevenue = 0
    let totalItems = 0
    let cashSales = 0
    let cardSales = 0

    // Filter by date in memory
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const saleDate = new Date(data.created_at || 0).getTime()
      
      // Check if sale is within target date range
      if (saleDate >= startOfDay && saleDate <= endOfDay) {
        totalSales++
        totalRevenue += Number(data.total) || 0
        totalItems += (data.items || []).reduce(
          (sum: number, item: any) => sum + (Number(item.quantity) || 0),
          0
        )
        if (data.payment_method === "cash") cashSales++
        else if (data.payment_method === "card") cardSales++
      }
    })

    return {
      date: targetDate,
      totalSales,
      totalRevenue,
      totalItems,
      cashSales,
      cardSales,
      averageOrderValue: totalSales > 0 ? totalRevenue / totalSales : 0,
    }
  } catch (error: any) {
    console.error("[getPOSDailySummary] Error:", error)
    throw new Error(`فشل في تحميل ملخص اليوم: ${error?.message || "خطأ غير معروف"}`)
  }
}
