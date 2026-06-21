"use server"

import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { serializeData } from "../firebase/firestore-helpers"
import { revalidatePath } from "next/cache"
import { logError } from "../logger"
import { calculateProfitPerUnit } from "../utils/product-pricing"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

// ==================== POS Products ====================

export async function getPOSProducts(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }
  const db = getAdminDb()
  const snapshot = await db
    .collection("products")
    .where("store_id", "==", storeId)
    .get()

  const products = snapshot.docs.map((doc) => {
    const data = doc.data()
    const price = Number(data.price) || 0
    const costPrice = Number(data.cost_price ?? data.price) || 0
    return serializeData({
      id: doc.id,
      name: data.name || "",
      description: data.description || "",
      price,
      cost_price: costPrice,
      profit_per_unit: Number.isFinite(Number(data.profit_per_unit))
        ? Number(data.profit_per_unit)
        : calculateProfitPerUnit(price, costPrice),
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
  cost_price?: number
  profit_per_unit?: number
  profit_total?: number
  image_url?: string
  unit_multiplier?: number  // How many pieces this unit represents (e.g. 10 for strip, 30 for box)
  unit_label?: string       // Display label (e.g. "شريط", "علبة")
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

type POSPaymentMethod = "cash" | "card" | "wallet" | "split"

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
  QUICK_PRODUCT_COST_PRICE_INVALID: "POS_QUICK_PRODUCT_COST_PRICE_INVALID",
  QUICK_PRODUCT_SELLING_PRICE_BELOW_COST: "POS_QUICK_PRODUCT_SELLING_PRICE_BELOW_COST",
  QUICK_PRODUCT_STOCK_INVALID: "POS_QUICK_PRODUCT_STOCK_INVALID",
  STORE_NOT_APPROVED: "POS_STORE_NOT_APPROVED",
  DUPLICATE_BARCODE: "POS_DUPLICATE_BARCODE",
  CREATE_QUICK_PRODUCT_FAILED: "POS_CREATE_QUICK_PRODUCT_FAILED",
  LOAD_SALES_HISTORY_FAILED: "POS_LOAD_SALES_HISTORY_FAILED",
  LOAD_MONTHLY_SALES_HISTORY_FAILED: "POS_LOAD_MONTHLY_SALES_HISTORY_FAILED",
  LOAD_DAILY_SUMMARY_FAILED: "POS_LOAD_DAILY_SUMMARY_FAILED",
  PIN_REQUIRED: "POS_PIN_REQUIRED",
  PIN_INVALID_FORMAT: "POS_PIN_INVALID_FORMAT",
  PIN_NOT_CONFIGURED: "POS_PIN_NOT_CONFIGURED",
  PIN_INCORRECT: "POS_PIN_INCORRECT",
  PIN_SETUP_FAILED: "POS_PIN_SETUP_FAILED",
  PIN_STATUS_FAILED: "POS_PIN_STATUS_FAILED",
  PIN_VERIFY_FAILED: "POS_PIN_VERIFY_FAILED",
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
  if (value === "cash" || value === "card" || value === "wallet" || value === "split") {
    return value
  }
  return "cash"
}

type PosPinSecurity = {
  pinHash: string
  pinSalt: string
}

const POS_PIN_PATTERN = /^\d{4,8}$/

function normalizePosPin(pin: string) {
  return pin.trim()
}

function isValidPosPin(pin: string) {
  return POS_PIN_PATTERN.test(pin)
}

function derivePosPinHash(pin: string, salt: string) {
  return scryptSync(pin, salt, 64).toString("hex")
}

function verifyPosPin(pin: string, security: PosPinSecurity) {
  const expected = Buffer.from(security.pinHash, "hex")
  const provided = Buffer.from(derivePosPinHash(pin, security.pinSalt), "hex")
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

async function getPosPinSecurity(
  db: FirebaseFirestore.Firestore,
  storeId: string,
): Promise<PosPinSecurity | null> {
  const userDoc = await db.collection("users").doc(storeId).get()
  if (!userDoc.exists) return null

  const data = userDoc.data() as {
    pos_pin_hash?: unknown
    pos_pin_salt?: unknown
    store?: {
      pos_pin_hash?: unknown
      pos_pin_salt?: unknown
    }
  } | undefined

  const topLevelPinHash = typeof data?.pos_pin_hash === "string" ? data.pos_pin_hash : ""
  const topLevelPinSalt = typeof data?.pos_pin_salt === "string" ? data.pos_pin_salt : ""
  const storePinHash = typeof data?.store?.pos_pin_hash === "string" ? data.store.pos_pin_hash : ""
  const storePinSalt = typeof data?.store?.pos_pin_salt === "string" ? data.store.pos_pin_salt : ""
  const pinHash = storePinHash || topLevelPinHash
  const pinSalt = storePinSalt || topLevelPinSalt
  if (!pinHash || !pinSalt) return null

  return { pinHash, pinSalt }
}

async function assertPOSPinAuthorized(
  db: FirebaseFirestore.Firestore,
  storeId: string,
  posPin?: string,
) {
  const security = await getPosPinSecurity(db, storeId)
  if (!security) {
    throw new Error(POS_ERROR.PIN_NOT_CONFIGURED)
  }

  const normalizedPin = normalizePosPin(posPin || "")
  if (!normalizedPin) {
    throw new Error(POS_ERROR.PIN_REQUIRED)
  }
  if (!isValidPosPin(normalizedPin)) {
    throw new Error(POS_ERROR.PIN_INVALID_FORMAT)
  }
  if (!verifyPosPin(normalizedPin, security)) {
    throw new Error(POS_ERROR.PIN_INCORRECT)
  }
}

type PosSaleRecord = {
  id: string
  created_at?: unknown
  total?: unknown
  total_profit?: unknown
  cash_collected?: unknown
  payment_method?: unknown
  amount_paid?: unknown
  change?: unknown
  discount?: unknown
  items?: unknown
  [key: string]: unknown
}

export type POSMonthlySalesHistoryMonth = "current" | "previous"

export type POSMonthlySalesHistory = {
  month: POSMonthlySalesHistoryMonth
  startDate: string
  endDate: string
  totalSales: number
  totalRevenue: number
  netProfit: number
  sales: Record<string, unknown>[]
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const toCreatedAtIso = (value: unknown) => {
  if (typeof value === "string" && value) return value
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate()
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString()
  }
  return null
}

const toCreatedAtMillis = (value: unknown) => {
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : 0
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate()
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0
  }
  return 0
}

const mapSaleDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot): PosSaleRecord => ({
  id: doc.id,
  ...(doc.data() as Record<string, unknown>),
})

const resolveMonthRange = (month: POSMonthlySalesHistoryMonth) => {
  const now = new Date()
  const monthOffset = month === "previous" ? -1 : 0
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1, 0, 0, 0, 0),
  )
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 1, 0, 0, 0, 0) - 1,
  )
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    startMs: start.getTime(),
    endMs: end.getTime(),
  }
}

const normalizeItems = (items: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(items)) return []
  return items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
}

const resolveItemCostPrice = (item: Record<string, unknown>, productCostMap: Map<string, number>) => {
  const itemPrice = Number(item.price) || 0
  const snapshotCost = Number(item.cost_price)
  if (Number.isFinite(snapshotCost)) return snapshotCost

  const productId = typeof item.product_id === "string" ? item.product_id : ""
  if (productId && productCostMap.has(productId)) {
    return productCostMap.get(productId) ?? itemPrice
  }

  return itemPrice
}

const calculateSaleNetProfit = (saleData: Record<string, unknown>, productCostMap: Map<string, number>) => {
  const explicitTotalProfit = Number(saleData.total_profit)
  if (Number.isFinite(explicitTotalProfit)) {
    return roundMoney(explicitTotalProfit)
  }

  const items = normalizeItems(saleData.items)
  const itemsProfit = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0
    if (quantity <= 0) return sum

    const snapshotItemProfit = Number(item.profit_total)
    if (Number.isFinite(snapshotItemProfit)) {
      return sum + snapshotItemProfit
    }

    const itemPrice = Number(item.price) || 0
    const itemCostPrice = resolveItemCostPrice(item, productCostMap)
    const snapshotProfitPerUnit = Number(item.profit_per_unit)
    const profitPerUnit = Number.isFinite(snapshotProfitPerUnit)
      ? snapshotProfitPerUnit
      : calculateProfitPerUnit(itemPrice, itemCostPrice)

    return sum + profitPerUnit * quantity
  }, 0)

  const discount = Number(saleData.discount) || 0
  return roundMoney(itemsProfit - discount)
}

const calculateSaleCashCollected = (saleData: Record<string, unknown>) => {
  const explicitCashCollected = Number(saleData.cash_collected)
  if (Number.isFinite(explicitCashCollected)) {
    return Math.max(0, roundMoney(explicitCashCollected))
  }

  const paymentMethod = normalizePaymentMethod(saleData.payment_method)
  if (paymentMethod !== "cash") {
    return 0
  }

  const amountPaid = Number(saleData.amount_paid) || 0
  const change = Number(saleData.change) || 0
  return Math.max(0, roundMoney(amountPaid - change))
}

const getStoreCostPriceMap = async (
  db: FirebaseFirestore.Firestore,
  storeId: string,
) => {
  const costPriceMap = new Map<string, number>()
  const snapshot = await db
    .collection("products")
    .where("store_id", "==", storeId)
    .get()

  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    const price = Number(data.price) || 0
    const costPriceValue = Number(data.cost_price)
    const costPrice = Number.isFinite(costPriceValue) ? costPriceValue : price
    costPriceMap.set(doc.id, costPrice)
  })

  return costPriceMap
}

const aggregateSalesDocs = async (
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  db: FirebaseFirestore.Firestore,
  storeId: string,
) => {
  const productCostMap = await getStoreCostPriceMap(db, storeId)
  let totalRevenue = 0
  let totalItems = 0
  let cashSales = 0
  let cardSales = 0
  let netProfit = 0
  let cashInTotal = 0

  docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>
    totalRevenue += Number(data.total) || 0
    totalItems += normalizeItems(data.items).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0,
    )

    const paymentMethod = normalizePaymentMethod(data.payment_method)
    if (paymentMethod === "cash") {
      cashSales++
    } else {
      cardSales++
    }

    netProfit += calculateSaleNetProfit(data, productCostMap)
    cashInTotal += calculateSaleCashCollected(data)
  })

  const totalSales = docs.length
  return {
    totalSales,
    totalRevenue: roundMoney(totalRevenue),
    totalItems,
    cashSales,
    cardSales,
    netProfit: roundMoney(netProfit),
    cashInTotal: roundMoney(cashInTotal),
    averageOrderValue: totalSales > 0 ? roundMoney(totalRevenue / totalSales) : 0,
  }
}

export async function getPOSPinStatus(storeId: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED, hasPin: false }
  }

  try {
    const db = getAdminDb()
    const security = await getPosPinSecurity(db, storeId)
    return { success: true, hasPin: !!security }
  } catch (error) {
    logError("[getPOSPinStatus] Error:", error)
    return { success: false, error: POS_ERROR.PIN_STATUS_FAILED, hasPin: false }
  }
}

export async function setPOSAccessPin(storeId: string, pin: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED }
  }

  const normalizedPin = normalizePosPin(pin)
  if (!isValidPosPin(normalizedPin)) {
    return { success: false, error: POS_ERROR.PIN_INVALID_FORMAT }
  }

  try {
    const db = getAdminDb()
    const salt = randomBytes(16).toString("hex")
    const hash = derivePosPinHash(normalizedPin, salt)
    const now = new Date().toISOString()

    await db.collection("users").doc(storeId).set(
      {
        pos_pin_hash: hash,
        pos_pin_salt: salt,
        pos_pin_set_at: now,
        pos_pin_updated_at: now,
        store: {
          pos_pin_hash: hash,
          pos_pin_salt: salt,
          pos_pin_set_at: now,
          pos_pin_updated_at: now,
        },
        updated_at: now,
      },
      { merge: true },
    )

    return { success: true }
  } catch (error) {
    logError("[setPOSAccessPin] Error:", error)
    return { success: false, error: POS_ERROR.PIN_SETUP_FAILED }
  }
}

export async function verifyPOSAccessPin(storeId: string, pin: string, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED }
  }

  const normalizedPin = normalizePosPin(pin)
  if (!normalizedPin) {
    return { success: false, error: POS_ERROR.PIN_REQUIRED }
  }
  if (!isValidPosPin(normalizedPin)) {
    return { success: false, error: POS_ERROR.PIN_INVALID_FORMAT }
  }

  try {
    const db = getAdminDb()
    const security = await getPosPinSecurity(db, storeId)
    if (!security) {
      return { success: false, error: POS_ERROR.PIN_NOT_CONFIGURED }
    }

    if (!verifyPosPin(normalizedPin, security)) {
      return { success: false, error: POS_ERROR.PIN_INCORRECT }
    }

    return { success: true }
  } catch (error) {
    logError("[verifyPOSAccessPin] Error:", error)
    return { success: false, error: POS_ERROR.PIN_VERIFY_FAILED }
  }
}

export async function createPOSSale(saleData: POSSaleData, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== saleData.store_id) {
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
      let calculatedItemsProfit = 0
      const verifiedItems: POSSaleItem[] = []

      for (const item of saleData.items) {
        const productRef = db.collection("products").doc(item.product_id)
        const productDoc = await transaction.get(productRef)
        if (!productDoc.exists) {
          throw new Error(POS_ERROR.PRODUCT_NOT_FOUND)
        }
        const productData = productDoc.data()!
        const stock = Number(productData.stock) || 0
        const piecesNeeded = item.quantity * (item.unit_multiplier || 1)
        if (piecesNeeded > stock) {
          throw new Error(POS_ERROR.INSUFFICIENT_STOCK)
        }
        // Use server-side price, not client-sent price
        // Derive piece price based on price_unit (what the stored price represents)
        const storedPrice = Number(productData.price) || 0
        const priceUnit = productData.price_unit || "piece" // default: price = piece price
        const pps = Number(productData.piece_per_strip) || 1
        const spb = Number(productData.strip_per_box) || 1
        
        let serverPiecePrice: number
        if (priceUnit === "box") {
          serverPiecePrice = storedPrice / (pps * spb)
        } else if (priceUnit === "strip") {
          serverPiecePrice = storedPrice / pps
        } else {
          serverPiecePrice = storedPrice
        }
        
        const serverPrice = item.unit_multiplier && item.unit_multiplier > 1
          ? serverPiecePrice * item.unit_multiplier
          : serverPiecePrice
          
        // Same logic for cost price
        const storedCostPrice = Number(productData.cost_price)
        const hasCostPrice = Number.isFinite(storedCostPrice)
        let serverPieceCost: number
        if (hasCostPrice) {
          if (priceUnit === "box") {
            serverPieceCost = storedCostPrice / (pps * spb)
          } else if (priceUnit === "strip") {
            serverPieceCost = storedCostPrice / pps
          } else {
            serverPieceCost = storedCostPrice
          }
        } else {
          serverPieceCost = serverPiecePrice
        }
        const serverCostPrice = item.unit_multiplier && item.unit_multiplier > 1
          ? serverPieceCost * item.unit_multiplier
          : serverPieceCost
        const profitPerUnit = calculateProfitPerUnit(serverPrice, serverCostPrice)
        const itemTotal = serverPrice * item.quantity
        const itemProfit = profitPerUnit * item.quantity
        calculatedSubtotal += itemTotal
        calculatedItemsProfit += itemProfit
        verifiedItems.push({
          ...item,
          price: serverPrice,
          cost_price: serverCostPrice,
          profit_per_unit: profitPerUnit,
          profit_total: roundMoney(itemProfit),
          total: roundMoney(itemTotal),
        })
        productDocs.push({ ref: productRef, doc: productDoc, item })
      }

      // 2. Calculate discount amount on server
      const discountAmount = saleData.discount_type === "percentage"
        ? (calculatedSubtotal * (saleData.discount || 0)) / 100
        : Math.min(saleData.discount || 0, calculatedSubtotal)

      // 3. Calculate total on server (الضريبة كمبلغ مطلق تُضاف للمجموع — كانت تُخزَّن وتُهمَل سابقًا)
      const taxAmount = Math.max(0, Number(saleData.tax) || 0)
      const calculatedTotal = Math.max(0, calculatedSubtotal - discountAmount) + taxAmount

      // 4. Validate payment
      if (saleData.payment_method === "cash") {
        if ((saleData.amount_paid || 0) < calculatedTotal) {
          throw new Error(POS_ERROR.PAYMENT_TOO_LOW)
        }
      }
      const calculatedChange = saleData.payment_method === "cash"
        ? Math.max(0, (saleData.amount_paid || 0) - calculatedTotal)
        : 0
      const calculatedTotalProfit = roundMoney(calculatedItemsProfit - discountAmount)
      const cashCollected = saleData.payment_method === "cash"
        ? Math.max(0, roundMoney((saleData.amount_paid || 0) - calculatedChange))
        : 0

      // 5. Create POS sale record with server-calculated values
      const saleRef = db.collection("pos_sales").doc()
      const salePayload = {
        store_id: saleData.store_id,
        seller_id: saleData.seller_id,
        items: verifiedItems,
        subtotal: roundMoney(calculatedSubtotal),
        discount: roundMoney(discountAmount),
        discount_type: saleData.discount_type,
        tax: roundMoney(taxAmount),
        total: roundMoney(calculatedTotal),
        total_profit: calculatedTotalProfit,
        cash_collected: cashCollected,
        amount_paid: saleData.payment_method === "cash" ? saleData.amount_paid : calculatedTotal,
        change: roundMoney(calculatedChange),
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
        const piecesToDeduct = item.quantity * (item.unit_multiplier || 1)
        transaction.update(ref, {
          stock: Math.max(0, currentStock - piecesToDeduct),
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
  cost_price: number
  stock: number
  category: string
  barcode?: string
  image_url?: string
  store_id: string
}, callerId?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== data.store_id) {
    return { success: false, error: POS_ERROR.UNAUTHORIZED }
  }

  const normalizedName = data.name.trim()
  const normalizedCategory = data.category.trim()
  const normalizedBarcode = data.barcode?.trim() || ""
  const normalizedPrice = Number(data.price)
  const normalizedCostPrice = Number(data.cost_price)
  const normalizedStock = Number(data.stock)
  const normalizedImageUrl = data.image_url?.trim() || ""

  if (!normalizedName) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_NAME_REQUIRED }
  }
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_PRICE_INVALID }
  }
  if (!Number.isFinite(normalizedCostPrice) || normalizedCostPrice <= 0) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_COST_PRICE_INVALID }
  }
  if (normalizedPrice < normalizedCostPrice) {
    return { success: false, error: POS_ERROR.QUICK_PRODUCT_SELLING_PRICE_BELOW_COST }
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
      cost_price: normalizedCostPrice,
      profit_per_unit: calculateProfitPerUnit(normalizedPrice, normalizedCostPrice),
      stock: normalizedStock,
      category: normalizedCategory,
      barcode: normalizedBarcode,
      image_url: normalizedImageUrl,
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

export async function getPOSSales(storeId: string, limit: number = 50, callerId?: string, posPin?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return []
  }

  try {
    const db = getAdminDb()
    await assertPOSPinAuthorized(db, storeId, posPin)
    const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.floor(Number(limit))
      : 50

    try {
      const snapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .orderBy("created_at", "desc")
        .limit(normalizedLimit)
        .get()

      const sales = snapshot.docs.map(mapSaleDoc)

      return sales.map((sale) => serializeData(sale))
    } catch (queryError: unknown) {
      const message = queryError instanceof Error ? queryError.message : ""
      const isIndexIssue = message.toLowerCase().includes("requires an index")
      if (!isIndexIssue) {
        throw queryError
      }

      // Fallback for environments where composite index is not created yet.
      logError("[getPOSSales] Falling back to in-memory sorting:", queryError)
      const fallbackSnapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .get()

      const sales = fallbackSnapshot.docs
        .map(mapSaleDoc)
        .sort((a, b) => toCreatedAtMillis(b.created_at) - toCreatedAtMillis(a.created_at))
        .slice(0, normalizedLimit)

      return sales.map((sale) => serializeData(sale))
    }
  } catch (error: any) {
    logError("[getPOSSales] Error:", error)
    const code = error instanceof Error && isPosErrorCode(error.message)
      ? error.message
      : POS_ERROR.LOAD_SALES_HISTORY_FAILED
    throw new Error(code)
  }
}

export async function getPOSMonthlySalesHistory(
  storeId: string,
  month: POSMonthlySalesHistoryMonth = "current",
  callerId?: string,
  posPin?: string,
): Promise<POSMonthlySalesHistory> {
  const normalizedMonth: POSMonthlySalesHistoryMonth = month === "previous" ? "previous" : "current"
  const range = resolveMonthRange(normalizedMonth)
  const emptyResult: POSMonthlySalesHistory = {
    month: normalizedMonth,
    startDate: range.startDate,
    endDate: range.endDate,
    totalSales: 0,
    totalRevenue: 0,
    netProfit: 0,
    sales: [],
  }

  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return emptyResult
  }

  try {
    const db = getAdminDb()
    await assertPOSPinAuthorized(db, storeId, posPin)
    const buildResult = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
      const aggregates = await aggregateSalesDocs(docs, db, storeId)
      const sales = docs
        .map(mapSaleDoc)
        .sort((a, b) => toCreatedAtMillis(b.created_at) - toCreatedAtMillis(a.created_at))
        .map((sale) => serializeData(sale))

      return {
        month: normalizedMonth,
        startDate: range.startDate,
        endDate: range.endDate,
        totalSales: aggregates.totalSales,
        totalRevenue: aggregates.totalRevenue,
        netProfit: aggregates.netProfit,
        sales,
      } satisfies POSMonthlySalesHistory
    }

    try {
      const snapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .where("created_at", ">=", range.startDate)
        .where("created_at", "<=", range.endDate)
        .orderBy("created_at", "desc")
        .get()

      return await buildResult(snapshot.docs)
    } catch (queryError: unknown) {
      const message = queryError instanceof Error ? queryError.message : ""
      const isIndexIssue = message.toLowerCase().includes("requires an index")
      if (!isIndexIssue) {
        throw queryError
      }

      // Fallback for environments where composite index is not created yet.
      logError("[getPOSMonthlySalesHistory] Falling back to in-memory month filtering:", queryError)
      const fallbackSnapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .get()

      const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
        const createdAtMs = toCreatedAtMillis(doc.data().created_at)
        return createdAtMs >= range.startMs && createdAtMs <= range.endMs
      })

      return await buildResult(filteredDocs)
    }
  } catch (error) {
    logError("[getPOSMonthlySalesHistory] Error:", error)
    const code = error instanceof Error && isPosErrorCode(error.message)
      ? error.message
      : POS_ERROR.LOAD_MONTHLY_SALES_HISTORY_FAILED
    throw new Error(code)
  }
}

// ==================== POS Daily Summary ====================

export async function getPOSDailySummary(storeId: string, date?: string, callerId?: string, posPin?: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return {
      date: date || new Date().toISOString().split("T")[0],
      totalSales: 0,
      totalRevenue: 0,
      totalItems: 0,
      cashSales: 0,
      cardSales: 0,
      averageOrderValue: 0,
      netProfit: 0,
      cashInTotal: 0,
    }
  }

  try {
    const db = getAdminDb()
    await assertPOSPinAuthorized(db, storeId, posPin)
    const targetDate = date || new Date().toISOString().split("T")[0]
    const startOfDay = `${targetDate}T00:00:00.000Z`
    const endOfDay = `${targetDate}T23:59:59.999Z`
    const summarize = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
      const aggregates = await aggregateSalesDocs(docs, db, storeId)
      return {
        date: targetDate,
        totalSales: aggregates.totalSales,
        totalRevenue: aggregates.totalRevenue,
        totalItems: aggregates.totalItems,
        cashSales: aggregates.cashSales,
        cardSales: aggregates.cardSales,
        averageOrderValue: aggregates.averageOrderValue,
        netProfit: aggregates.netProfit,
        cashInTotal: aggregates.cashInTotal,
      }
    }

    try {
      // Query only the requested day to avoid loading full store history
      const snapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .where("created_at", ">=", startOfDay)
        .where("created_at", "<=", endOfDay)
        .get()
      return await summarize(snapshot.docs)
    } catch (queryError: unknown) {
      const message = queryError instanceof Error ? queryError.message : ""
      const isIndexIssue = message.toLowerCase().includes("requires an index")
      if (!isIndexIssue) {
        throw queryError
      }

      // Fallback for environments where composite index is not created yet.
      logError("[getPOSDailySummary] Falling back to in-memory date filtering:", queryError)
      const fallbackSnapshot = await db
        .collection("pos_sales")
        .where("store_id", "==", storeId)
        .get()

      const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
        const createdAtIso = toCreatedAtIso(doc.data().created_at)
        return !!createdAtIso && createdAtIso >= startOfDay && createdAtIso <= endOfDay
      })

      return await summarize(filteredDocs)
    }
  } catch (error: any) {
    logError("[getPOSDailySummary] Error:", error)
    const code = error instanceof Error && isPosErrorCode(error.message)
      ? error.message
      : POS_ERROR.LOAD_DAILY_SUMMARY_FAILED
    throw new Error(code)
  }
}
