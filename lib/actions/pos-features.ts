"use server"

import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { serializeData } from "../firebase/firestore-helpers"
import { logError } from "../logger"

// ==================== Types ====================

export type HeldCart = {
  id: string
  store_id: string
  items: HeldCartItem[]
  customer_name?: string
  customer_phone?: string
  notes?: string
  discount?: number
  discount_type?: "percentage" | "fixed"
  held_at: string
  label?: string
}

export type HeldCartItem = {
  product_id: string
  name: string
  price: number
  quantity: number
  total: number
  image_url?: string
  unit_multiplier?: number
  unit_label?: string
}

export type POSCustomer = {
  id: string
  store_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
  total_purchases: number
  total_spent: number
  loyalty_points: number
  created_at: string
  updated_at: string
}

export type POSReturn = {
  id: string
  store_id: string
  original_sale_id: string
  original_sale_number: string
  items: POSReturnItem[]
  return_type: "refund" | "exchange"
  refund_amount: number
  refund_method: "cash" | "card" | "wallet" | "store_credit"
  reason?: string
  customer_name?: string
  customer_phone?: string
  notes?: string
  created_at: string
}

export type POSReturnItem = {
  product_id: string
  name: string
  price: number
  quantity: number
  total: number
}

export type POSShift = {
  id: string
  store_id: string
  cashier_id: string
  cashier_name?: string
  opening_cash: number
  closing_cash?: number
  expected_cash?: number
  cash_difference?: number
  total_sales: number
  total_revenue: number
  total_returns: number
  started_at: string
  ended_at?: string
  status: "open" | "closed"
  notes?: string
}

export type POSCoupon = {
  id: string
  store_id: string
  code: string
  type: "percentage" | "fixed"
  value: number
  min_order?: number
  max_uses?: number
  used_count: number
  valid_from: string
  valid_until: string
  is_active: boolean
  created_at: string
}

export type SplitPaymentEntry = {
  method: "cash" | "card" | "wallet"
  amount: number
}

// ==================== Error Constants ====================

const POS_FEATURE_ERROR = {
  UNAUTHORIZED: "POS_FEATURE_UNAUTHORIZED",
  HOLD_CART_FAILED: "POS_HOLD_CART_FAILED",
  HOLD_CART_EMPTY: "POS_HOLD_CART_EMPTY",
  HOLD_CART_NOT_FOUND: "POS_HOLD_CART_NOT_FOUND",
  HOLD_CART_LIMIT: "POS_HOLD_CART_LIMIT_REACHED",
  CUSTOMER_NOT_FOUND: "POS_CUSTOMER_NOT_FOUND",
  CUSTOMER_NAME_REQUIRED: "POS_CUSTOMER_NAME_REQUIRED",
  CUSTOMER_SAVE_FAILED: "POS_CUSTOMER_SAVE_FAILED",
  CUSTOMER_LOAD_FAILED: "POS_CUSTOMER_LOAD_FAILED",
  RETURN_SALE_NOT_FOUND: "POS_RETURN_SALE_NOT_FOUND",
  RETURN_INVALID_ITEMS: "POS_RETURN_INVALID_ITEMS",
  RETURN_FAILED: "POS_RETURN_FAILED",
  SHIFT_ALREADY_OPEN: "POS_SHIFT_ALREADY_OPEN",
  SHIFT_NOT_OPEN: "POS_SHIFT_NOT_OPEN",
  SHIFT_FAILED: "POS_SHIFT_FAILED",
  COUPON_NOT_FOUND: "POS_COUPON_NOT_FOUND",
  COUPON_EXPIRED: "POS_COUPON_EXPIRED",
  COUPON_MAX_USES: "POS_COUPON_MAX_USES_REACHED",
  COUPON_MIN_ORDER: "POS_COUPON_MIN_ORDER_NOT_MET",
  COUPON_INACTIVE: "POS_COUPON_INACTIVE",
  COUPON_CODE_EXISTS: "POS_COUPON_CODE_EXISTS",
  COUPON_SAVE_FAILED: "POS_COUPON_SAVE_FAILED",
  COUPON_LOAD_FAILED: "POS_COUPON_LOAD_FAILED",
} as const

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

// ==================== Hold Cart ====================

export async function holdCart(data: {
  store_id: string
  items: HeldCartItem[]
  customer_name?: string
  customer_phone?: string
  notes?: string
  discount?: number
  discount_type?: "percentage" | "fixed"
  label?: string
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  if (!data.items || data.items.length === 0) {
    return { success: false, error: POS_FEATURE_ERROR.HOLD_CART_EMPTY }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check limit (max 10 held carts per store)
    const existing = await db
      .collection("pos_held_carts")
      .where("store_id", "==", data.store_id)
      .get()

    if (existing.size >= 10) {
      return { success: false, error: POS_FEATURE_ERROR.HOLD_CART_LIMIT }
    }

    const docRef = db.collection("pos_held_carts").doc()
    const payload = {
      store_id: data.store_id,
      items: data.items,
      customer_name: data.customer_name || null,
      customer_phone: data.customer_phone || null,
      notes: data.notes || null,
      discount: data.discount || 0,
      discount_type: data.discount_type || "fixed",
      label: data.label || `${t_ar("سلة")} #${existing.size + 1}`,
      held_at: now,
    }

    await docRef.set(payload)

    return {
      success: true,
      data: serializeData({ id: docRef.id, ...payload }) as HeldCart,
    }
  } catch (error) {
    logError("[holdCart] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.HOLD_CART_FAILED }
  }
}

function t_ar(text: string) { return text }

export async function getHeldCarts(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_held_carts")
      .where("store_id", "==", storeId)
      .get()

    return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as HeldCart
    )
  } catch (error) {
    logError("[getHeldCarts] Error:", error)
    return []
  }
}

export async function deleteHeldCart(cartId: string, storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const doc = await db.collection("pos_held_carts").doc(cartId).get()

    if (!doc.exists) {
      return { success: false, error: POS_FEATURE_ERROR.HOLD_CART_NOT_FOUND }
    }

    const data = doc.data()
    if (data?.store_id !== storeId) {
      return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
    }

    await db.collection("pos_held_carts").doc(cartId).delete()
    return { success: true }
  } catch (error) {
    logError("[deleteHeldCart] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.HOLD_CART_FAILED }
  }
}

// ==================== Customer Management ====================

export async function createOrUpdatePOSCustomer(data: {
  store_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  if (!data.name.trim()) {
    return { success: false, error: POS_FEATURE_ERROR.CUSTOMER_NAME_REQUIRED }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    const phone = data.phone?.trim() || ""

    // If phone is provided, try to find existing customer
    let existingId: string | null = null
    if (phone) {
      const existing = await db
        .collection("pos_customers")
        .where("store_id", "==", data.store_id)
        .where("phone", "==", phone)
        .limit(1)
        .get()

      if (!existing.empty) {
        existingId = existing.docs[0].id
      }
    }

    if (existingId) {
      // Update existing customer
      await db.collection("pos_customers").doc(existingId).update({
        name: data.name.trim(),
        email: data.email?.trim() || null,
        notes: data.notes?.trim() || null,
        tags: data.tags || [],
        updated_at: now,
      })

      const updatedDoc = await db.collection("pos_customers").doc(existingId).get()
      return {
        success: true,
        data: serializeData({ id: existingId, ...updatedDoc.data() }) as POSCustomer,
      }
    } else {
      // Create new customer
      const docRef = db.collection("pos_customers").doc()
      const payload = {
        store_id: data.store_id,
        name: data.name.trim(),
        phone: phone || null,
        email: data.email?.trim() || null,
        notes: data.notes?.trim() || null,
        tags: data.tags || [],
        total_purchases: 0,
        total_spent: 0,
        loyalty_points: 0,
        created_at: now,
        updated_at: now,
      }

      await docRef.set(payload)
      return {
        success: true,
        data: serializeData({ id: docRef.id, ...payload }) as POSCustomer,
      }
    }
  } catch (error) {
    logError("[createOrUpdatePOSCustomer] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.CUSTOMER_SAVE_FAILED }
  }
}

export async function getPOSCustomers(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_customers")
      .where("store_id", "==", storeId)
      .get()

    return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as POSCustomer
    )
  } catch (error) {
    logError("[getPOSCustomers] Error:", error)
    return []
  }
}

export async function searchPOSCustomers(storeId: string, query: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_customers")
      .where("store_id", "==", storeId)
      .get()

    const q = query.trim().toLowerCase()
    if (!q) return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as POSCustomer
    )

    return snapshot.docs
      .filter((doc) => {
        const data = doc.data()
        const name = (data.name || "").toLowerCase()
        const phone = (data.phone || "")
        return name.includes(q) || phone.includes(q)
      })
      .map((doc) => serializeData({ id: doc.id, ...doc.data() }) as POSCustomer)
  } catch (error) {
    logError("[searchPOSCustomers] Error:", error)
    return []
  }
}

export async function updateCustomerAfterSale(
  storeId: string,
  customerPhone: string,
  saleTotal: number,
  loyaltyPoints?: number,
) {
  if (!customerPhone) return

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_customers")
      .where("store_id", "==", storeId)
      .where("phone", "==", customerPhone.trim())
      .limit(1)
      .get()

    if (snapshot.empty) return

    const doc = snapshot.docs[0]
    const data = doc.data()
    const now = new Date().toISOString()

    await db.collection("pos_customers").doc(doc.id).update({
      total_purchases: (Number(data.total_purchases) || 0) + 1,
      total_spent: roundMoney((Number(data.total_spent) || 0) + saleTotal),
      loyalty_points: (Number(data.loyalty_points) || 0) + (loyaltyPoints || Math.floor(saleTotal / 10)),
      updated_at: now,
    })
  } catch (error) {
    logError("[updateCustomerAfterSale] Error:", error)
  }
}

// ==================== Returns & Exchanges ====================

export async function getSaleForReturn(saleId: string, storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()

    // Try to find by sale ID directly
    let saleDoc = await db.collection("pos_sales").doc(saleId).get()

    // If not found, search by sale_number
    if (!saleDoc.exists) {
      const snapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .where("sale_number", "==", saleId)
        .limit(1)
        .get()

      if (snapshot.empty) {
        return { success: false, error: POS_FEATURE_ERROR.RETURN_SALE_NOT_FOUND }
      }
      saleDoc = snapshot.docs[0]
    }

    const saleData = saleDoc.data()
    if (saleData?.store_id !== storeId) {
      return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
    }

    return {
      success: true,
      data: serializeData({ id: saleDoc.id, ...saleData }),
    }
  } catch (error) {
    logError("[getSaleForReturn] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.RETURN_SALE_NOT_FOUND }
  }
}

export async function createPOSReturn(data: {
  store_id: string
  original_sale_id: string
  original_sale_number: string
  items: POSReturnItem[]
  return_type: "refund" | "exchange"
  refund_amount: number
  refund_method: "cash" | "card" | "wallet" | "store_credit"
  reason?: string
  customer_name?: string
  customer_phone?: string
  notes?: string
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  if (!data.items || data.items.length === 0) {
    return { success: false, error: POS_FEATURE_ERROR.RETURN_INVALID_ITEMS }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Restore stock for returned items
    const batch = db.batch()

    for (const item of data.items) {
      const productRef = db.collection("products").doc(item.product_id)
      const productDoc = await productRef.get()
      if (productDoc.exists) {
        const currentStock = Number(productDoc.data()?.stock) || 0
        batch.update(productRef, {
          stock: currentStock + item.quantity,
          updated_at: now,
        })
      }
    }

    // Create return record
    const returnRef = db.collection("pos_returns").doc()
    const returnPayload = {
      store_id: data.store_id,
      original_sale_id: data.original_sale_id,
      original_sale_number: data.original_sale_number,
      items: data.items,
      return_type: data.return_type,
      refund_amount: roundMoney(data.refund_amount),
      refund_method: data.refund_method,
      reason: data.reason || null,
      customer_name: data.customer_name || null,
      customer_phone: data.customer_phone || null,
      notes: data.notes || null,
      return_number: `RET-${Date.now()}-${returnRef.id.slice(0, 6).toUpperCase()}`,
      created_at: now,
    }

    batch.set(returnRef, returnPayload)
    await batch.commit()

    return {
      success: true,
      data: serializeData({ id: returnRef.id, ...returnPayload }) as POSReturn,
    }
  } catch (error) {
    logError("[createPOSReturn] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.RETURN_FAILED }
  }
}

// ==================== Shift Management ====================

export async function openShift(data: {
  store_id: string
  cashier_id: string
  cashier_name?: string
  opening_cash: number
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check for existing open shift
    const existing = await db
      .collection("pos_shifts")
      .where("store_id", "==", data.store_id)
      .where("status", "==", "open")
      .limit(1)
      .get()

    if (!existing.empty) {
      return { success: false, error: POS_FEATURE_ERROR.SHIFT_ALREADY_OPEN }
    }

    const docRef = db.collection("pos_shifts").doc()
    const payload = {
      store_id: data.store_id,
      cashier_id: data.cashier_id,
      cashier_name: data.cashier_name || null,
      opening_cash: roundMoney(data.opening_cash),
      total_sales: 0,
      total_revenue: 0,
      total_returns: 0,
      started_at: now,
      status: "open" as const,
    }

    await docRef.set({ ...payload, closing_cash: null, expected_cash: null, cash_difference: null, ended_at: null, notes: null })
    return {
      success: true,
      data: serializeData({ id: docRef.id, ...payload }) as POSShift,
    }
  } catch (error) {
    logError("[openShift] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.SHIFT_FAILED }
  }
}

export async function closeShift(data: {
  store_id: string
  shift_id: string
  closing_cash: number
  notes?: string
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    const shiftDoc = await db.collection("pos_shifts").doc(data.shift_id).get()
    if (!shiftDoc.exists) {
      return { success: false, error: POS_FEATURE_ERROR.SHIFT_NOT_OPEN }
    }

    const shiftData = shiftDoc.data()
    if (shiftData?.store_id !== data.store_id || shiftData?.status !== "open") {
      return { success: false, error: POS_FEATURE_ERROR.SHIFT_NOT_OPEN }
    }

    // Calculate sales during shift (with composite index fallback)
    const startedAt = shiftData.started_at

    let salesDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
    try {
      const salesSnapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", data.store_id)
        .where("created_at", ">=", startedAt)
        .where("created_at", "<=", now)
        .get()
      salesDocs = salesSnapshot.docs
    } catch (queryErr: unknown) {
      // Fallback: composite index not created yet — filter in memory
      const fallback = await db.collection("pos_sales").where("store_id", "==", data.store_id).get()
      salesDocs = fallback.docs.filter(doc => {
        const ca = doc.data().created_at
        return typeof ca === "string" && ca >= startedAt && ca <= now
      })
    }

    let totalRevenue = 0
    let cashRevenue = 0
    salesDocs.forEach((doc) => {
      const d = doc.data()
      totalRevenue += Number(d.total) || 0
      if (d.payment_method === "cash") {
        const paid = Number(d.amount_paid) || 0
        const change = Number(d.change) || 0
        cashRevenue += Math.max(0, paid - change)
      }
    })

    // Calculate returns during shift (with composite index fallback)
    let returnsDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
    try {
      const returnsSnapshot = await db
        .collection("pos_returns")
        .where("store_id", "==", data.store_id)
        .where("created_at", ">=", startedAt)
        .where("created_at", "<=", now)
        .get()
      returnsDocs = returnsSnapshot.docs
    } catch {
      const fallback = await db.collection("pos_returns").where("store_id", "==", data.store_id).get()
      returnsDocs = fallback.docs.filter(doc => {
        const ca = doc.data().created_at
        return typeof ca === "string" && ca >= startedAt && ca <= now
      })
    }

    let totalReturns = 0
    let cashReturns = 0
    returnsDocs.forEach((doc) => {
      const d = doc.data()
      totalReturns += Number(d.refund_amount) || 0
      if (d.refund_method === "cash") {
        cashReturns += Number(d.refund_amount) || 0
      }
    })

    const openingCash = Number(shiftData.opening_cash) || 0
    const expectedCash = roundMoney(openingCash + cashRevenue - cashReturns)
    const closingCash = roundMoney(data.closing_cash)
    const cashDifference = roundMoney(closingCash - expectedCash)

    await db.collection("pos_shifts").doc(data.shift_id).update({
      closing_cash: closingCash,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
      total_sales: salesDocs.length,
      total_revenue: roundMoney(totalRevenue),
      total_returns: roundMoney(totalReturns),
      ended_at: now,
      status: "closed",
      notes: data.notes || null,
    })

    const updatedDoc = await db.collection("pos_shifts").doc(data.shift_id).get()
    return {
      success: true,
      data: serializeData({ id: data.shift_id, ...updatedDoc.data() }) as POSShift,
    }
  } catch (error) {
    logError("[closeShift] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.SHIFT_FAILED }
  }
}

export async function getCurrentShift(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return null
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_shifts")
      .where("store_id", "==", storeId)
      .where("status", "==", "open")
      .limit(1)
      .get()

    if (snapshot.empty) return null

    const doc = snapshot.docs[0]
    return serializeData({ id: doc.id, ...doc.data() }) as POSShift
  } catch (error) {
    logError("[getCurrentShift] Error:", error)
    return null
  }
}

// ==================== Coupon / Discount Code ====================

export async function createPOSCoupon(data: {
  store_id: string
  code: string
  type: "percentage" | "fixed"
  value: number
  min_order?: number
  max_uses?: number
  valid_from: string
  valid_until: string
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    const normalizedCode = data.code.trim().toUpperCase()

    // Check for duplicate code
    const existing = await db
      .collection("pos_coupons")
      .where("store_id", "==", data.store_id)
      .where("code", "==", normalizedCode)
      .limit(1)
      .get()

    if (!existing.empty) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_CODE_EXISTS }
    }

    const docRef = db.collection("pos_coupons").doc()
    const payload = {
      store_id: data.store_id,
      code: normalizedCode,
      type: data.type,
      value: data.value,
      min_order: data.min_order || 0,
      max_uses: data.max_uses || 0, // 0 = unlimited
      used_count: 0,
      valid_from: data.valid_from,
      valid_until: data.valid_until,
      is_active: true,
      created_at: now,
    }

    await docRef.set(payload)
    return {
      success: true,
      data: serializeData({ id: docRef.id, ...payload }) as POSCoupon,
    }
  } catch (error) {
    logError("[createPOSCoupon] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.COUPON_SAVE_FAILED }
  }
}

export async function validatePOSCoupon(storeId: string, code: string, orderTotal: number, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const normalizedCode = code.trim().toUpperCase()

    const snapshot = await db
      .collection("pos_coupons")
      .where("store_id", "==", storeId)
      .where("code", "==", normalizedCode)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_NOT_FOUND }
    }

    const doc = snapshot.docs[0]
    const coupon = doc.data()

    if (!coupon.is_active) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_INACTIVE }
    }

    const now = new Date().toISOString()
    if (now < coupon.valid_from || now > coupon.valid_until) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_EXPIRED }
    }

    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_MAX_USES }
    }

    if (coupon.min_order > 0 && orderTotal < coupon.min_order) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_MIN_ORDER }
    }

    // Calculate discount
    let discountAmount = 0
    if (coupon.type === "percentage") {
      discountAmount = roundMoney((orderTotal * coupon.value) / 100)
    } else {
      discountAmount = roundMoney(Math.min(coupon.value, orderTotal))
    }

    return {
      success: true,
      data: {
        coupon_id: doc.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount_amount: discountAmount,
      },
    }
  } catch (error) {
    logError("[validatePOSCoupon] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.COUPON_LOAD_FAILED }
  }
}

export async function redeemPOSCoupon(storeId: string, couponId: string) {
  try {
    const db = getAdminDb()
    const docRef = db.collection("pos_coupons").doc(couponId)
    const doc = await docRef.get()

    if (!doc.exists || doc.data()?.store_id !== storeId) return

    await docRef.update({
      used_count: (Number(doc.data()?.used_count) || 0) + 1,
    })
  } catch (error) {
    logError("[redeemPOSCoupon] Error:", error)
  }
}

export async function getPOSCoupons(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_coupons")
      .where("store_id", "==", storeId)
      .get()

    return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as POSCoupon
    )
  } catch (error) {
    logError("[getPOSCoupons] Error:", error)
    return []
  }
}

export async function toggleCouponStatus(couponId: string, storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_FEATURE_ERROR.UNAUTHORIZED }
  }

  try {
    const db = getAdminDb()
    const doc = await db.collection("pos_coupons").doc(couponId).get()

    if (!doc.exists || doc.data()?.store_id !== storeId) {
      return { success: false, error: POS_FEATURE_ERROR.COUPON_NOT_FOUND }
    }

    const currentStatus = doc.data()?.is_active
    await db.collection("pos_coupons").doc(couponId).update({
      is_active: !currentStatus,
    })

    return { success: true, is_active: !currentStatus }
  } catch (error) {
    logError("[toggleCouponStatus] Error:", error)
    return { success: false, error: POS_FEATURE_ERROR.COUPON_SAVE_FAILED }
  }
}
