"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { serializeData } from "@/lib/firebase/firestore-helpers"

// ==================== TYPES ====================

export type ProductVariant = {
  id: string
  product_id: string
  size: string
  color: string
  color_hex?: string
  sku: string
  barcode?: string
  stock: number
  price_override?: number // if different from base price
  cost_price?: number
  supplier_id?: string
}

export type VariantMatrix = {
  product_id: string
  product_name: string
  sizes: string[]
  colors: { name: string; hex: string }[]
  variants: ProductVariant[]
}

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum"

export type LoyaltyCustomer = {
  id: string
  customer_id: string
  name: string
  phone: string
  email?: string
  points: number
  total_spent: number
  tier: LoyaltyTier
  visits: number
  notes?: string // "Customer X likes black - size M" 
  preferences?: string
  joined_at: string
  last_visit: string
}

export type LoyaltyConfig = {
  points_per_unit: number // e.g. 1 point per 10 EGP
  currency_per_point: number // e.g. 10 EGP
  silver_threshold: number
  gold_threshold: number
  platinum_threshold: number
  point_value: number // 1 point = X EGP discount
  enabled: boolean
}

export type Installment = {
  id: string
  sale_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  total_amount: number
  down_payment: number
  remaining: number
  num_installments: number
  installment_amount: number
  paid_installments: number
  next_due_date: string
  status: "active" | "completed" | "overdue" | "cancelled"
  created_at: string
  payments: InstallmentPayment[]
}

export type InstallmentPayment = {
  amount: number
  paid_at: string
  method: "cash" | "card"
  note?: string
}

export type Season = {
  id: string
  name: string
  name_ar: string
  start_date: string
  end_date: string
  discount_percentage?: number
  is_active: boolean
  is_clearance: boolean
}

export type Supplier = {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  created_at: string
}

export type SupplierProduct = {
  product_id: string
  supplier_id: string
  wholesale_price: number
  last_supply_date: string
  quantity_supplied: number
}

export type GiftCard = {
  id: string
  code: string
  initial_balance: number
  current_balance: number
  purchaser_name?: string
  purchaser_phone?: string
  recipient_name?: string
  status: "active" | "used" | "expired"
  created_at: string
  expires_at?: string
  used_transactions: { amount: number; date: string; sale_id: string }[]
}

export type ProductReservation = {
  id: string
  product_id: string
  product_name: string
  variant_id?: string
  variant_info?: string
  customer_name: string
  customer_phone: string
  reserved_until: string
  quantity: number
  deposit?: number
  status: "active" | "fulfilled" | "expired" | "cancelled"
  notes?: string
  created_at: string
}

export type InvoiceDiscount = {
  min_amount: number
  discount_type: "percentage" | "fixed"
  discount_value: number
}

// ==================== VARIANT MANAGEMENT ====================

export async function saveProductVariants(
  storeId: string,
  productId: string,
  sizes: string[],
  colors: { name: string; hex: string }[],
  stockMatrix: Record<string, number> // key: "size_color" → stock
): Promise<{ success: boolean; count: number }> {
  try {
    const db = getAdminDb()
    const batch = db.batch()
    const variantsRef = db.collection(`stores/${storeId}/product_variants`)

    // Delete existing variants for this product
    const existing = await variantsRef.where("product_id", "==", productId).get()
    existing.docs.forEach((doc: any) => batch.delete(doc.ref))

    let count = 0
    for (const size of sizes) {
      for (const color of colors) {
        const key = `${size}_${color.name}`
        const stock = stockMatrix[key] ?? 0
        const sku = `${productId.substring(0, 6)}-${size}-${color.name}`.toUpperCase()

        const ref = variantsRef.doc()
        batch.set(ref, {
          product_id: productId,
          size,
          color: color.name,
          color_hex: color.hex || "#000000",
          sku,
          stock,
          created_at: new Date().toISOString(),
        })
        count++
      }
    }

    await batch.commit()
    return { success: true, count }
  } catch (error) {
    console.error("Error saving variants:", error)
    return { success: false, count: 0 }
  }
}

export async function getProductVariants(
  storeId: string,
  productId: string
): Promise<ProductVariant[]> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/product_variants`)
      .where("product_id", "==", productId)
      .get()

    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as ProductVariant)
  } catch (error) {
    console.error("Error getting variants:", error)
    return []
  }
}

export async function updateVariantStock(
  storeId: string,
  variantId: string,
  quantityChange: number
): Promise<boolean> {
  try {
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/product_variants/${variantId}`).update({
      stock: FieldValue.increment(quantityChange)
    })
    return true
  } catch (error) {
    console.error("Error updating variant stock:", error)
    return false
  }
}

export async function findVariantByBarcode(
  storeId: string,
  barcode: string
): Promise<ProductVariant | null> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/product_variants`)
      .where("barcode", "==", barcode)
      .limit(1)
      .get()
    if (snap.empty) return null
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ProductVariant
  } catch (error) {
    return null
  }
}

// ==================== LOYALTY PROGRAM ====================

export async function getLoyaltyConfig(storeId: string): Promise<LoyaltyConfig> {
  try {
    const db = getAdminDb()
    const doc = await db.doc(`stores/${storeId}/settings/loyalty`).get()
    if (!doc.exists) {
      return {
        points_per_unit: 10, // 1 point per 10 EGP
        currency_per_point: 10,
        silver_threshold: 500,
        gold_threshold: 2000,
        platinum_threshold: 5000,
        point_value: 0.5, // 1 point = 0.5 EGP
        enabled: false,
      }
    }
    return serializeData(doc.data()) as LoyaltyConfig
  } catch {
    return {
      points_per_unit: 10, currency_per_point: 10,
      silver_threshold: 500, gold_threshold: 2000, platinum_threshold: 5000,
      point_value: 0.5, enabled: false,
    }
  }
}

export async function saveLoyaltyConfig(storeId: string, config: LoyaltyConfig): Promise<boolean> {
  try {
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/settings/loyalty`).set(config, { merge: true })
    return true
  } catch {
    return false
  }
}

function calculateTier(points: number, config: LoyaltyConfig): LoyaltyTier {
  if (points >= config.platinum_threshold) return "platinum"
  if (points >= config.gold_threshold) return "gold"
  if (points >= config.silver_threshold) return "silver"
  return "bronze"
}

export async function getLoyaltyCustomer(
  storeId: string,
  phone: string
): Promise<LoyaltyCustomer | null> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/loyalty_customers`)
      .where("phone", "==", phone)
      .limit(1)
      .get()
    if (snap.empty) return null
    return serializeData({ id: snap.docs[0].id, ...snap.docs[0].data() }) as LoyaltyCustomer
  } catch {
    return null
  }
}

export async function createLoyaltyCustomer(
  storeId: string,
  data: { name: string; phone: string; email?: string; notes?: string; preferences?: string }
): Promise<LoyaltyCustomer | null> {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    const customer: Omit<LoyaltyCustomer, "id"> = {
      customer_id: "",
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
      points: 0,
      total_spent: 0,
      tier: "bronze",
      visits: 0,
      notes: data.notes || undefined,
      preferences: data.preferences || undefined,
      joined_at: now,
      last_visit: now,
    }
    const ref = await db.collection(`stores/${storeId}/loyalty_customers`).add(customer)
    return { id: ref.id, ...customer }
  } catch {
    return null
  }
}

export async function updateLoyaltyAfterSale(
  storeId: string,
  customerId: string,
  saleAmount: number,
  pointsRedeemed: number = 0
): Promise<{ newPoints: number; newTier: LoyaltyTier } | null> {
  try {
    const db = getAdminDb()
    const config = await getLoyaltyConfig(storeId)
    const earnedPoints = Math.floor(saleAmount / config.currency_per_point)

    const ref = db.doc(`stores/${storeId}/loyalty_customers/${customerId}`)
    const doc = await ref.get()
    if (!doc.exists) return null

    const current = doc.data() as LoyaltyCustomer
    const newPoints = current.points + earnedPoints - pointsRedeemed
    const newTotalSpent = current.total_spent + saleAmount
    const newTier = calculateTier(newPoints, config)

    await ref.update({
      points: newPoints,
      total_spent: newTotalSpent,
      tier: newTier,
      visits: FieldValue.increment(1),
      last_visit: new Date().toISOString(),
    })

    return { newPoints, newTier }
  } catch {
    return null
  }
}

export async function updateCustomerNotes(
  storeId: string,
  customerId: string,
  notes: string,
  preferences: string
): Promise<boolean> {
  try {
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/loyalty_customers/${customerId}`).update({
      notes: notes || null,
      preferences: preferences || null,
    })
    return true
  } catch {
    return false
  }
}

// ==================== INSTALLMENTS ====================

export async function createInstallment(
  storeId: string,
  data: {
    sale_id: string
    customer_name: string
    customer_phone: string
    total_amount: number
    down_payment: number
    num_installments: number
  }
): Promise<Installment | null> {
  try {
    const db = getAdminDb()
    const remaining = data.total_amount - data.down_payment
    const installmentAmount = Math.ceil(remaining / data.num_installments)

    // Next due date is 30 days from now
    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + 30)

    const installment: Omit<Installment, "id"> = {
      sale_id: data.sale_id,
      customer_id: "",
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      total_amount: data.total_amount,
      down_payment: data.down_payment,
      remaining,
      num_installments: data.num_installments,
      installment_amount: installmentAmount,
      paid_installments: 0,
      next_due_date: nextDue.toISOString(),
      status: "active",
      created_at: new Date().toISOString(),
      payments: data.down_payment > 0 ? [{
        amount: data.down_payment,
        paid_at: new Date().toISOString(),
        method: "cash",
        note: "دفعة مقدمة",
      }] : [],
    }

    const ref = await db.collection(`stores/${storeId}/installments`).add(installment)
    return { id: ref.id, ...installment }
  } catch {
    return null
  }
}

export async function getInstallments(
  storeId: string,
  status?: "active" | "completed" | "overdue"
): Promise<Installment[]> {
  try {
    const db = getAdminDb()
    let query = db.collection(`stores/${storeId}/installments`).orderBy("created_at", "desc")
    if (status) {
      query = query.where("status", "==", status) as any
    }
    const snap = await query.limit(50).get()
    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as Installment)
  } catch {
    return []
  }
}

export async function payInstallment(
  storeId: string,
  installmentId: string,
  amount: number,
  method: "cash" | "card"
): Promise<boolean> {
  try {
    const db = getAdminDb()
    const ref = db.doc(`stores/${storeId}/installments/${installmentId}`)
    const doc = await ref.get()
    if (!doc.exists) return false

    const data = doc.data() as Installment
    const newRemaining = data.remaining - amount
    const newPaidCount = data.paid_installments + 1

    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + 30)

    const payment: InstallmentPayment = {
      amount,
      paid_at: new Date().toISOString(),
      method,
    }

    await ref.update({
      remaining: newRemaining,
      paid_installments: newPaidCount,
      next_due_date: nextDue.toISOString(),
      status: newRemaining <= 0 ? "completed" : "active",
      payments: FieldValue.arrayUnion(payment),
    })

    return true
  } catch {
    return false
  }
}

// ==================== SEASON MANAGEMENT ====================

export async function getSeasons(storeId: string): Promise<Season[]> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/seasons`)
      .orderBy("start_date", "desc")
      .limit(20)
      .get()
    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as Season)
  } catch {
    return []
  }
}

export async function createSeason(
  storeId: string,
  data: { name: string; name_ar: string; start_date: string; end_date: string; discount_percentage?: number; is_clearance: boolean }
): Promise<Season | null> {
  try {
    const db = getAdminDb()
    const season = {
      ...data,
      is_active: true,
      discount_percentage: data.discount_percentage || 0,
    }
    const ref = await db.collection(`stores/${storeId}/seasons`).add(season)
    return { id: ref.id, ...season }
  } catch {
    return null
  }
}

export async function toggleSeason(storeId: string, seasonId: string): Promise<boolean> {
  try {
    const db = getAdminDb()
    const ref = db.doc(`stores/${storeId}/seasons/${seasonId}`)
    const doc = await ref.get()
    if (!doc.exists) return false
    await ref.update({ is_active: !(doc.data() as Season).is_active })
    return true
  } catch {
    return false
  }
}

export async function getActiveSeasonDiscount(storeId: string): Promise<{ discount: number; season_name: string } | null> {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    const snap = await db.collection(`stores/${storeId}/seasons`)
      .where("is_active", "==", true)
      .get()

    for (const doc of snap.docs) {
      const s = doc.data() as Season
      if (s.start_date <= now && s.end_date >= now && s.discount_percentage && s.discount_percentage > 0) {
        return { discount: s.discount_percentage, season_name: s.name_ar || s.name }
      }
    }
    return null
  } catch {
    return null
  }
}

// ==================== SUPPLIER TRACKING ====================

export async function getSuppliers(storeId: string): Promise<Supplier[]> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/suppliers`).orderBy("name").get()
    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as Supplier)
  } catch {
    return []
  }
}

export async function addSupplier(
  storeId: string,
  data: { name: string; phone?: string; email?: string; address?: string; notes?: string }
): Promise<Supplier | null> {
  try {
    const db = getAdminDb()
    const supplier = { ...data, created_at: new Date().toISOString() }
    const ref = await db.collection(`stores/${storeId}/suppliers`).add(supplier)
    return { id: ref.id, ...supplier }
  } catch {
    return null
  }
}

export async function getSupplierProductCounts(storeId: string): Promise<Record<string, number>> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/supplier_products`).get()
    const counts: Record<string, number> = {}
    snap.docs.forEach(doc => {
      const sid = doc.data().supplier_id
      if (sid) counts[sid] = (counts[sid] || 0) + 1
    })
    return counts
  } catch {
    return {}
  }
}

export async function linkSupplierToProduct(
  storeId: string,
  productId: string,
  supplierId: string,
  wholesalePrice: number,
  quantity: number
): Promise<boolean> {
  try {
    const db = getAdminDb()
    await db.collection(`stores/${storeId}/supplier_products`).add({
      product_id: productId,
      supplier_id: supplierId,
      wholesale_price: wholesalePrice,
      quantity_supplied: quantity,
      last_supply_date: new Date().toISOString(),
    })
    return true
  } catch {
    return false
  }
}

export async function getProductSuppliers(
  storeId: string,
  productId: string
): Promise<(SupplierProduct & { supplier_name: string })[]> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/supplier_products`)
      .where("product_id", "==", productId)
      .get()

    const results: (SupplierProduct & { supplier_name: string })[] = []
    for (const doc of snap.docs) {
      const data = doc.data() as SupplierProduct
      const supplierDoc = await db.doc(`stores/${storeId}/suppliers/${data.supplier_id}`).get()
      results.push({
        ...data,
        supplier_name: supplierDoc.exists ? (supplierDoc.data() as Supplier).name : "غير معروف",
      })
    }
    return results
  } catch {
    return []
  }
}

// ==================== GIFT CARDS ====================

export async function createGiftCard(
  storeId: string,
  data: { balance: number; purchaser_name?: string; purchaser_phone?: string; recipient_name?: string; expires_days?: number }
): Promise<GiftCard | null> {
  try {
    const db = getAdminDb()
    const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    let expiresAt: string | undefined
    if (data.expires_days) {
      const d = new Date()
      d.setDate(d.getDate() + data.expires_days)
      expiresAt = d.toISOString()
    }

    const card: Omit<GiftCard, "id"> = {
      code,
      initial_balance: data.balance,
      current_balance: data.balance,
      purchaser_name: data.purchaser_name || undefined,
      purchaser_phone: data.purchaser_phone || undefined,
      recipient_name: data.recipient_name || undefined,
      status: "active",
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      used_transactions: [],
    }

    const ref = await db.collection(`stores/${storeId}/gift_cards`).add(card)
    return { id: ref.id, ...card }
  } catch {
    return null
  }
}

export async function getGiftCards(storeId: string): Promise<GiftCard[]> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/gift_cards`)
      .orderBy("created_at", "desc")
      .limit(50)
      .get()
    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as GiftCard)
  } catch {
    return []
  }
}

export async function validateGiftCard(
  storeId: string,
  code: string
): Promise<{ valid: boolean; balance?: number; card_id?: string; error?: string }> {
  try {
    const db = getAdminDb()
    const snap = await db.collection(`stores/${storeId}/gift_cards`)
      .where("code", "==", code)
      .limit(1)
      .get()

    if (snap.empty) return { valid: false, error: "بطاقة غير موجودة" }

    const card = { id: snap.docs[0].id, ...snap.docs[0].data() } as GiftCard

    if (card.status === "used") return { valid: false, error: "البطاقة مستخدمة بالكامل" }
    if (card.status === "expired") return { valid: false, error: "البطاقة منتهية الصلاحية" }
    if (card.expires_at && new Date(card.expires_at) < new Date()) return { valid: false, error: "البطاقة منتهية الصلاحية" }
    if (card.current_balance <= 0) return { valid: false, error: "رصيد البطاقة صفر" }

    return { valid: true, balance: card.current_balance, card_id: card.id }
  } catch {
    return { valid: false, error: "خطأ في التحقق" }
  }
}

export async function redeemGiftCard(
  storeId: string,
  cardId: string,
  amount: number,
  saleId: string
): Promise<{ success: boolean; remaining: number }> {
  try {
    const db = getAdminDb()
    const ref = db.doc(`stores/${storeId}/gift_cards/${cardId}`)
    const doc = await ref.get()
    if (!doc.exists) return { success: false, remaining: 0 }

    const card = doc.data() as GiftCard
    const deducted = Math.min(amount, card.current_balance)
    const remaining = card.current_balance - deducted

    await ref.update({
      current_balance: remaining,
      status: remaining <= 0 ? "used" : "active",
      used_transactions: FieldValue.arrayUnion({
        amount: deducted,
        date: new Date().toISOString(),
        sale_id: saleId,
      }),
    })

    return { success: true, remaining }
  } catch {
    return { success: false, remaining: 0 }
  }
}

// ==================== PRODUCT RESERVATION ====================

export async function createReservation(
  storeId: string,
  data: {
    product_id: string
    product_name: string
    variant_id?: string
    variant_info?: string
    customer_name: string
    customer_phone: string
    hours: number
    quantity: number
    deposit?: number
    notes?: string
  }
): Promise<ProductReservation | null> {
  try {
    const db = getAdminDb()
    const reservedUntil = new Date()
    reservedUntil.setHours(reservedUntil.getHours() + data.hours)

    const reservation: Omit<ProductReservation, "id"> = {
      product_id: data.product_id,
      product_name: data.product_name,
      variant_id: data.variant_id || undefined,
      variant_info: data.variant_info || undefined,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      reserved_until: reservedUntil.toISOString(),
      quantity: data.quantity,
      deposit: data.deposit || undefined,
      status: "active",
      notes: data.notes || undefined,
      created_at: new Date().toISOString(),
    }

    const ref = await db.collection(`stores/${storeId}/reservations`).add(reservation)
    return { id: ref.id, ...reservation }
  } catch (err) {
    console.error("createReservation error:", err)
    return null
  }
}

export async function getReservations(
  storeId: string,
  status?: "active" | "fulfilled" | "expired"
): Promise<ProductReservation[]> {
  try {
    const db = getAdminDb()
    let query = db.collection(`stores/${storeId}/reservations`).orderBy("created_at", "desc")
    if (status) {
      query = query.where("status", "==", status) as any
    }
    const snap = await query.limit(50).get()
    return snap.docs.map((doc: any) => serializeData({ id: doc.id, ...doc.data() }) as ProductReservation)
  } catch {
    return []
  }
}

export async function updateReservationStatus(
  storeId: string,
  reservationId: string,
  status: "fulfilled" | "cancelled"
): Promise<boolean> {
  try {
    const db = getAdminDb()
    await db.doc(`stores/${storeId}/reservations/${reservationId}`).update({ status })
    return true
  } catch {
    return false
  }
}

// ==================== INVOICE DISCOUNT ====================

export async function getInvoiceDiscountRules(storeId: string): Promise<InvoiceDiscount[]> {
  try {
    const db = getAdminDb()
    const doc = await db.doc(`stores/${storeId}/settings/invoice_discounts`).get()
    if (!doc.exists) return []
    return serializeData(doc.data()?.rules || []) as InvoiceDiscount[]
  } catch {
    return []
  }
}

export async function saveInvoiceDiscountRules(
  storeId: string,
  rules: InvoiceDiscount[]
): Promise<boolean> {
  try {
    const db = getAdminDb()
    // Sort by min_amount descending for proper matching
    rules.sort((a, b) => b.min_amount - a.min_amount)
    await db.doc(`stores/${storeId}/settings/invoice_discounts`).set({ rules })
    return true
  } catch {
    return false
  }
}

export async function calculateInvoiceDiscount(
  subtotal: number,
  rules: InvoiceDiscount[]
): Promise<{ discount: number; rule: InvoiceDiscount | null }> {
  // Rules should be sorted desc by min_amount
  for (const rule of rules) {
    if (subtotal >= rule.min_amount) {
      const discount = rule.discount_type === "percentage"
        ? Math.round(subtotal * rule.discount_value / 100)
        : rule.discount_value
      return { discount, rule }
    }
  }
  return { discount: 0, rule: null }
}

// ==================== PRICE TAG GENERATION ====================

export async function generatePriceTagData(product: {
  name: string
  price: number
  barcode?: string
  size?: string
  color?: string
  sku?: string
}): Promise<{
  name: string
  price: string
  barcode: string
  size: string
  color: string
  sku: string
}> {
  return {
    name: product.name,
    price: `${product.price} ج.م`,
    barcode: product.barcode || "",
    size: product.size || "",
    color: product.color || "",
    sku: product.sku || "",
  }
}
