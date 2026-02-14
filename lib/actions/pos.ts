"use server"

import { getAdminDb } from "../firebase/admin"
import { serializeData } from "../firebase/firestore-helpers"
import { revalidatePath } from "next/cache"
import { logError } from "../logger"

// ==================== POS Products ====================

export async function getPOSProducts(storeId: string, callerId?: string) {
  if (callerId && callerId !== storeId) {
    return []
  }
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



// ==================== POS Sales ====================

export type POSSaleItem = {
  product_id: string
  name: string
  price: number
  quantity: number
  total: number
  image_url?: string
}

type POSSaleData = {
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

type POSPaymentMethod = "cash" | "card" | "wallet"

const POS_ERROR = {
  UNAUTHORIZED: "POS_UNAUTHORIZED",
  DISCOUNT_NEGATIVE: "POS_DISCOUNT_NEGATIVE",
  DISCOUNT_PERCENT_EXCEEDED: "POS_DISCOUNT_PERCENT_EXCEEDED",
  PRODUCT_NOT_FOUND: "POS_PRODUCT_NOT_FOUND",
  INSUFFICIENT_STOCK: "POS_INSUFFICIENT_STOCK",
  PAYMENT_TOO_LOW: "POS_PAYMENT_TOO_LOW",
  CREATE_SALE_FAILED: "POS_CREATE_SALE_FAILED",
  QUICK_PRODUCT_NAME_REQUIRED: "POS_QUICK_PRODUCT_NAME_REQUIRED",
  QUICK_PRODUCT_PRICE_INVALID: "POS_QUICK_PRODUCT_PRICE_INVALID",
  QUICK_PRODUCT_STOCK_INVALID: "POS_QUICK_PRODUCT_STOCK_INVALID",
  STORE_NOT_APPROVED: "POS_STORE_NOT_APPROVED",
  DUPLICATE_BARCODE: "POS_DUPLICATE_BARCODE",
  CREATE_QUICK_PRODUCT_FAILED: "POS_CREATE_QUICK_PRODUCT_FAILED",
  LOAD_SALES_HISTORY_FAILED: "POS_LOAD_SALES_HISTORY_FAILED",
  LOAD_DAILY_SUMMARY_FAILED: "POS_LOAD_DAILY_SUMMARY_FAILED",
} as const

type PosErrorCode = (typeof POS_ERROR)[keyof typeof POS_ERROR]

function isPosErrorCode(value: unknown): value is PosErrorCode {
  return typeof value === "string" && Object.values(POS_ERROR).includes(value as PosErrorCode)
}

export type POSReceiptItem = {
  name: string
  qty: number
  price: number
  total: number
}

export type POSReceiptData = {
  store: string
  address?: string
  phone?: string
  sale_number: string
  date: string
  items: POSReceiptItem[]
  subtotal: number
  discount: number
  total: number
  payment_method: POSPaymentMethod
  amount_paid: number
  change: number
}

function normalizePaymentMethod(value: unknown): POSPaymentMethod {
  if (value === "cash" || value === "card" || value === "wallet") {
    return value
  }
  return "cash"
}

export async function createPOSSale(saleData: POSSaleData, callerId?: string) {
  if (callerId && callerId !== saleData.store_id) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED }
  }

  // Validate discount before entering transaction
  if ((saleData.discount || 0) < 0) {
    return { success: false, error: POS_ERROR.DISCOUNT_NEGATIVE }
  }
  if (saleData.discount_type === "percentage" && (saleData.discount || 0) > 100) {
    return { success: false, error: POS_ERROR.DISCOUNT_PERCENT_EXCEEDED }
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Read all products inside the transaction (atomic stock check + server-side pricing)
      const productDocs: { ref: FirebaseFirestore.DocumentReference; doc: FirebaseFirestore.DocumentSnapshot; item: POSSaleItem }[] = []
      let calculatedSubtotal = 0
      const verifiedItems: POSSaleItem[] = []

      for (const item of saleData.items) {
        const productRef = db.collection("products").doc(item.product_id)
        const productDoc = await transaction.get(productRef)
        if (!productDoc.exists) {
          throw new Error(POS_ERROR.PRODUCT_NOT_FOUND)
        }
        const productData = productDoc.data()!
        const stock = Number(productData.stock) || 0
        if (item.quantity > stock) {
          throw new Error(POS_ERROR.INSUFFICIENT_STOCK)
        }
        // Use server-side price, not client-sent price
        const serverPrice = Number(productData.price) || 0
        const itemTotal = serverPrice * item.quantity
        calculatedSubtotal += itemTotal
        verifiedItems.push({ ...item, price: serverPrice, total: itemTotal })
        productDocs.push({ ref: productRef, doc: productDoc, item })
      }

      // 2. Calculate discount amount on server
      const discountAmount = saleData.discount_type === "percentage"
        ? (calculatedSubtotal * (saleData.discount || 0)) / 100
        : Math.min(saleData.discount || 0, calculatedSubtotal)

      // 3. Calculate total on server
      const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount)

      // 4. Validate payment
      if (saleData.payment_method === "cash") {
        if ((saleData.amount_paid || 0) < calculatedTotal) {
          throw new Error(POS_ERROR.PAYMENT_TOO_LOW)
        }
      }
      const calculatedChange = saleData.payment_method === "cash"
        ? Math.max(0, (saleData.amount_paid || 0) - calculatedTotal)
        : 0

      // 5. Create POS sale record with server-calculated values
      const saleRef = db.collection("pos_sales").doc()
      const salePayload = {
        store_id: saleData.store_id,
        seller_id: saleData.seller_id,
        items: verifiedItems,
        subtotal: calculatedSubtotal,
        discount: discountAmount,
        discount_type: saleData.discount_type,
        tax: saleData.tax,
        total: calculatedTotal,
        amount_paid: saleData.payment_method === "cash" ? saleData.amount_paid : calculatedTotal,
        change: calculatedChange,
        payment_method: saleData.payment_method,
        customer_name: saleData.customer_name || null,
        customer_phone: saleData.customer_phone || null,
        notes: saleData.notes || null,
        sale_number: `POS-${Date.now()}-${saleRef.id.slice(0, 6).toUpperCase()}`,
        created_at: now,
      }
      transaction.set(saleRef, salePayload)

      // 6. Deduct stock (atomic with the check above)
      for (const { ref, doc, item } of productDocs) {
        const currentStock = Number(doc.data()?.stock) || 0
        transaction.update(ref, {
          stock: Math.max(0, currentStock - item.quantity),
          updated_at: now,
        })
      }

      return { id: saleRef.id, ...salePayload }
    })

    revalidatePath("/seller/products")
    return { success: true, data: result }
  } catch (error: any) {
    const code = error instanceof Error && isPosErrorCode(error.message) ? error.message : POS_ERROR.CREATE_SALE_FAILED
    return { success: false, error: code }
  }
}

export async function getPOSSaleById(saleId: string): Promise<POSReceiptData | null> {
  const normalizedId = saleId.trim()
  if (!normalizedId) {
    return null
  }

  try {
    const db = getAdminDb()
    const saleDoc = await db.collection("pos_sales").doc(normalizedId).get()

    if (!saleDoc.exists) {
      return null
    }

    const saleData = saleDoc.data() as Record<string, unknown>
    const storeId = typeof saleData.store_id === "string" ? saleData.store_id : ""

    let storeName = ""
    let storeAddress = ""
    let storePhone = ""

    if (storeId) {
      const storeDoc = await db.collection("users").doc(storeId).get()
      const userData = storeDoc.data() as { store?: { name?: string; address?: string; phone?: string } } | undefined
      storeName = userData?.store?.name || ""
      storeAddress = userData?.store?.address || ""
      storePhone = userData?.store?.phone || ""
    }

    const items = (Array.isArray(saleData.items) ? saleData.items : []).map((item) => {
      const parsedItem = item as {
        name?: unknown
        quantity?: unknown
        price?: unknown
        total?: unknown
      }

      return {
        name: typeof parsedItem.name === "string" ? parsedItem.name : "",
        qty: Number(parsedItem.quantity) || 0,
        price: Number(parsedItem.price) || 0,
        total: Number(parsedItem.total) || 0,
      }
    })

    const createdAt = saleData.created_at
    const date =
      typeof createdAt === "string"
        ? createdAt
        : createdAt && typeof createdAt === "object" && "toDate" in createdAt && typeof (createdAt as { toDate?: () => Date }).toDate === "function"
          ? (createdAt as { toDate: () => Date }).toDate().toISOString()
          : new Date().toISOString()

    return serializeData({
      store: storeName || "Store",
      address: storeAddress || undefined,
      phone: storePhone || undefined,
      sale_number:
        typeof saleData.sale_number === "string" && saleData.sale_number
          ? saleData.sale_number
          : `POS-${saleDoc.id.slice(0, 6).toUpperCase()}`,
      date,
      items,
      subtotal: Number(saleData.subtotal) || 0,
      discount: Number(saleData.discount) || 0,
      total: Number(saleData.total) || 0,
      payment_method: normalizePaymentMethod(saleData.payment_method),
      amount_paid: Number(saleData.amount_paid) || 0,
      change: Number(saleData.change) || 0,
    }) as POSReceiptData
  } catch (error) {
    logError("[getPOSSaleById] Error:", error)
    return null
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
}, callerId?: string) {
  if (callerId && callerId !== data.store_id) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED }
  }

  const normalizedName = data.name.trim()
  const normalizedCategory = data.category.trim()
  const normalizedBarcode = data.barcode?.trim() || ""
  const normalizedPrice = Number(data.price)
  const normalizedStock = Number(data.stock)

  if (!normalizedName) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_NAME_REQUIRED }
  }
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_PRICE_INVALID }
  }
  if (!Number.isFinite(normalizedStock) || normalizedStock <= 0) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_STOCK_INVALID }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // التحقق من اعتماد المتجر قبل إنشاء المنتج
    const userDoc = await db.collection("users").doc(data.store_id).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      const storeData = userData?.store
      if (!storeData?.is_approved) {
        return { success: false, error: POS_ERROR.STORE_NOT_APPROVED }
      }
    }

    // Check if barcode already exists for this store
    if (normalizedBarcode) {
      const existing = await db
        .collection("products")
        .where("store_id", "==", data.store_id)
        .where("barcode", "==", normalizedBarcode)
        .get()
      
      if (!existing.empty) {
        return { success: false, error: POS_ERROR.DUPLICATE_BARCODE }
      }
    }

    const docRef = db.collection("products").doc()
    const payload = {
      name: normalizedName,
      description: "",
      price: normalizedPrice,
      stock: normalizedStock,
      category: normalizedCategory,
      barcode: normalizedBarcode,
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
    logError("[POS] Error creating quick product:", error)
    return { success: false, error: POS_ERROR.CREATE_QUICK_PRODUCT_FAILED }
  }
}

// ==================== POS Sales History ====================

export async function getPOSSales(storeId: string, limit: number = 50, callerId?: string) {
  if (callerId && callerId !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_sales")
      .where("store_id", "==", storeId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .get()

    const sales = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

    return sales.map(sale => serializeData(sale))
  } catch (error: any) {
    logError("[getPOSSales] Error:", error)
    throw new Error(POS_ERROR.LOAD_SALES_HISTORY_FAILED)
  }
}

// ==================== POS Daily Summary ====================

export async function getPOSDailySummary(storeId: string, date?: string, callerId?: string) {
  if (callerId && callerId !== storeId) {
    return { date: date || new Date().toISOString().split("T")[0], totalSales: 0, totalRevenue: 0, totalItems: 0, cashSales: 0, cardSales: 0, averageOrderValue: 0 }
  }

  try {
    const db = getAdminDb()
    const targetDate = date || new Date().toISOString().split("T")[0]
    const startOfDay = `${targetDate}T00:00:00.000Z`
    const endOfDay = `${targetDate}T23:59:59.999Z`

    // Query only the requested day to avoid loading full store history
    const snapshot = await db
      .collection("pos_sales")
      .where("store_id", "==", storeId)
      .where("created_at", ">=", startOfDay)
      .where("created_at", "<=", endOfDay)
      .get()

    let totalSales = 0
    let totalRevenue = 0
    let totalItems = 0
    let cashSales = 0
    let cardSales = 0

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      totalSales++
      totalRevenue += Number(data.total) || 0
      totalItems += (data.items || []).reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 0),
        0
      )
      if (data.payment_method === "cash") cashSales++
      else if (data.payment_method === "card") cardSales++
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
    logError("[getPOSDailySummary] Error:", error)
    throw new Error(POS_ERROR.LOAD_DAILY_SUMMARY_FAILED)
  }
}
