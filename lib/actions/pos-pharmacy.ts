"use server"

import { getAdminDb } from "../firebase/admin"
import { serializeData } from "../firebase/firestore-helpers"
import { logError } from "../logger"
import { getCurrentUid } from "@/lib/auth/session"

// التحقق من ملكية المتجر: الهوية من كوكي الجلسة فقط، ومعرّف المتجر يساوي معرّف المالك
async function isStoreOwner(storeId: string): Promise<boolean> {
  const uid = await getCurrentUid()
  return uid != null && uid === storeId
}

// ==================== Types ====================

export type PharmacyProduct = {
  id: string
  name: string
  price: number
  stock: number
  category: string
  barcode: string
  image_url: string
  // Pharmacy-specific fields
  expiry_date?: string | null
  batch_number?: string | null
  active_ingredient?: string | null
  requires_prescription?: boolean
  manufacturer?: string | null
  dosage_form?: string | null     // أقراص، شراب، حقن، كريم، إلخ
  storage_conditions?: string | null // حفظ بارد، درجة حرارة الغرفة
  // Multi-unit fields
  unit_type?: string | null         // "strip" | "box" | "carton" | "piece"
  strip_per_box?: number | null
  piece_per_strip?: number | null
  box_per_carton?: number | null
  // Drug interactions
  interaction_group?: string | null  // مجموعة التفاعل: e.g. "NSAID", "ACE_inhibitor"
  contraindications?: string[] | null // مجموعات متعارضة
}

export type DrugInteraction = {
  group_a: string
  group_b: string
  severity: "high" | "moderate" | "low"
  description_ar: string
  description_en: string
}

export type PatientFile = {
  id: string
  store_id: string
  name: string
  phone: string
  date_of_birth?: string | null
  gender?: string | null
  allergies: string[]
  chronic_conditions: string[]
  notes?: string | null
  created_at: string
  updated_at: string
}

export type PatientMedication = {
  id: string
  patient_id: string
  store_id: string
  product_id: string
  product_name: string
  sale_id: string
  quantity: number
  dosage?: string | null
  instructions?: string | null
  doctor_name?: string | null
  date: string
}

export type BatchInventoryItem = {
  product_id: string
  product_name: string
  batch_number: string
  expiry_date: string
  stock: number
  days_remaining: number
  status: "expired" | "critical" | "warning" | "ok"
}

export type DrugLabel = {
  product_name: string
  active_ingredient?: string | null
  dosage_form?: string | null
  batch_number?: string | null
  expiry_date?: string | null
  manufacturer?: string | null
  instructions: string
  patient_name?: string
  doctor_name?: string
  store_name: string
  date: string
}

export type ProductUnit = {
  type: "piece" | "strip" | "box" | "carton"
  label_ar: string
  label_en: string
  multiplier: number
  price: number
}

export type ExpiryAlert = {
  product_id: string
  product_name: string
  batch_number: string | null
  expiry_date: string
  stock: number
  days_remaining: number
  status: "expired" | "critical" | "warning" | "ok"
  barcode: string
  image_url: string
}

export type PrescriptionRecord = {
  id: string
  store_id: string
  sale_id: string
  sale_number: string
  patient_name: string
  patient_phone?: string | null
  doctor_name: string
  prescription_number?: string | null
  diagnosis?: string | null
  items: PrescriptionItem[]
  notes?: string | null
  image_url?: string | null  // صورة الروشتة
  created_at: string
}

export type PrescriptionItem = {
  product_id: string
  product_name: string
  quantity: number
  dosage?: string | null
  instructions?: string | null
}

export type InsuranceClaim = {
  id: string
  store_id: string
  sale_id: string
  sale_number: string
  insurance_company: string
  policy_number: string
  patient_name: string
  total_amount: number
  insurance_coverage: number     // نسبة التغطية
  copay_amount: number           // المبلغ على المريض
  insurance_amount: number       // المبلغ على التأمين
  status: "pending" | "approved" | "rejected" | "paid"
  claim_number?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export type InsuranceCompany = {
  id: string
  store_id: string
  name: string
  coverage_percentage: number    // نسبة التغطية الافتراضية
  contact_phone?: string | null
  contract_number?: string | null
  is_active: boolean
  created_at: string
}

export type DrugAlternative = {
  product_id: string
  product_name: string
  price: number
  stock: number
  active_ingredient: string
  manufacturer: string | null
}

// ==================== Constants ====================

const PHARMACY_ERROR = {
  PRODUCT_NOT_FOUND: "PHARM_PRODUCT_NOT_FOUND",
  PRODUCT_EXPIRED: "PHARM_PRODUCT_EXPIRED",
  PRESCRIPTION_REQUIRED: "PHARM_PRESCRIPTION_REQUIRED",
  INSURANCE_NOT_FOUND: "PHARM_INSURANCE_NOT_FOUND",
  INSURANCE_COMPANY_EXISTS: "PHARM_INSURANCE_COMPANY_EXISTS",
  CLAIM_NOT_FOUND: "PHARM_CLAIM_NOT_FOUND",
  NO_ALTERNATIVES: "PHARM_NO_ALTERNATIVES",
  UNAUTHORIZED: "PHARM_UNAUTHORIZED",
}

// Days thresholds for expiry alerts
const EXPIRY_CRITICAL_DAYS = 30   // أقل من 30 يوم = حرج
const EXPIRY_WARNING_DAYS = 90    // أقل من 90 يوم = تحذير

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

// ==================== Expiry Date Management ====================

/**
 * Update pharmacy-specific fields for a product (expiry_date, batch_number, etc.)
 */
export async function updateProductPharmacyFields(
  storeId: string,
  productId: string,
  fields: {
    expiry_date?: string | null
    batch_number?: string | null
    active_ingredient?: string | null
    requires_prescription?: boolean
    manufacturer?: string | null
    dosage_form?: string | null
    storage_conditions?: string | null
  }
) {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const productRef = db.collection("products").doc(productId)
    const productDoc = await productRef.get()

    if (!productDoc.exists || productDoc.data()?.store_id !== storeId) {
      return { success: false, error: PHARMACY_ERROR.PRODUCT_NOT_FOUND }
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (fields.expiry_date !== undefined) updatePayload.expiry_date = fields.expiry_date
    if (fields.batch_number !== undefined) updatePayload.batch_number = fields.batch_number
    if (fields.active_ingredient !== undefined) updatePayload.active_ingredient = fields.active_ingredient
    if (fields.requires_prescription !== undefined) updatePayload.requires_prescription = fields.requires_prescription
    if (fields.manufacturer !== undefined) updatePayload.manufacturer = fields.manufacturer
    if (fields.dosage_form !== undefined) updatePayload.dosage_form = fields.dosage_form
    if (fields.storage_conditions !== undefined) updatePayload.storage_conditions = fields.storage_conditions

    await productRef.update(updatePayload)
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error updating product pharmacy fields:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Get products with expiry information for alerts
 */
export async function getExpiryAlerts(storeId: string): Promise<ExpiryAlert[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .get()

    const now = new Date()
    const alerts: ExpiryAlert[] = []

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (!data.expiry_date) return

      const expiryDate = new Date(data.expiry_date)
      const diffMs = expiryDate.getTime() - now.getTime()
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      let status: ExpiryAlert["status"] = "ok"
      if (daysRemaining <= 0) status = "expired"
      else if (daysRemaining <= EXPIRY_CRITICAL_DAYS) status = "critical"
      else if (daysRemaining <= EXPIRY_WARNING_DAYS) status = "warning"

      // Only include items that have warnings or worse
      if (status !== "ok") {
        alerts.push({
          product_id: doc.id,
          product_name: data.name || "",
          batch_number: data.batch_number || null,
          expiry_date: data.expiry_date,
          stock: Number(data.stock) || 0,
          days_remaining: daysRemaining,
          status,
          barcode: data.barcode || "",
          image_url: data.image_url || "",
        })
      }
    })

    // Sort: expired first, then critical, then warning
    alerts.sort((a, b) => a.days_remaining - b.days_remaining)
    return alerts
  } catch (err) {
    logError("[Pharmacy] Error getting expiry alerts:", err)
    return []
  }
}

/**
 * Check if a specific product is expired (used before sale)
 */
export async function checkProductExpiry(storeId: string, productId: string): Promise<{
  expired: boolean
  days_remaining: number | null
  expiry_date: string | null
}> {
  try {
    if (!(await isStoreOwner(storeId))) return { expired: false, days_remaining: null, expiry_date: null }
    const db = getAdminDb()
    const doc = await db.collection("products").doc(productId).get()
    if (!doc.exists || doc.data()?.store_id !== storeId) {
      return { expired: false, days_remaining: null, expiry_date: null }
    }

    const data = doc.data()!
    if (!data.expiry_date) return { expired: false, days_remaining: null, expiry_date: null }

    const expiryDate = new Date(data.expiry_date)
    const now = new Date()
    const diffMs = expiryDate.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return {
      expired: daysRemaining <= 0,
      days_remaining: daysRemaining,
      expiry_date: data.expiry_date,
    }
  } catch (err) {
    logError("[Pharmacy] Error checking product expiry:", err)
    return { expired: false, days_remaining: null, expiry_date: null }
  }
}

// ==================== Prescription Management ====================

/**
 * Save a prescription record linked to a sale
 */
export async function savePrescriptionRecord(data: {
  store_id: string
  sale_id: string
  sale_number: string
  patient_name: string
  patient_phone?: string
  doctor_name: string
  prescription_number?: string
  diagnosis?: string
  items: PrescriptionItem[]
  notes?: string
  image_url?: string
}): Promise<{ success: boolean; prescription_id?: string; error?: string }> {
  try {
    if (!(await isStoreOwner(data.store_id))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const now = new Date().toISOString()

    const docRef = db.collection("pos_prescriptions").doc()
    const payload = {
      store_id: data.store_id,
      sale_id: data.sale_id,
      sale_number: data.sale_number,
      patient_name: data.patient_name,
      patient_phone: data.patient_phone || null,
      doctor_name: data.doctor_name,
      prescription_number: data.prescription_number || null,
      diagnosis: data.diagnosis || null,
      items: data.items,
      notes: data.notes || null,
      image_url: data.image_url || null,
      created_at: now,
    }

    await docRef.set(payload)
    return { success: true, prescription_id: docRef.id }
  } catch (err) {
    logError("[Pharmacy] Error saving prescription:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Get prescription records for a store
 */
export async function getPrescriptionRecords(
  storeId: string,
  limit = 50
): Promise<PrescriptionRecord[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_prescriptions")
      .where("store_id", "==", storeId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .get()

    return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as PrescriptionRecord
    )
  } catch (err) {
    logError("[Pharmacy] Error getting prescriptions:", err)
    return []
  }
}

/**
 * Search prescriptions by patient name or prescription number
 */
export async function searchPrescriptions(
  storeId: string,
  query: string
): Promise<PrescriptionRecord[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    // Fetch recent prescriptions and filter client-side (Firestore doesn't support substring search)
    const snapshot = await db
      .collection("pos_prescriptions")
      .where("store_id", "==", storeId)
      .orderBy("created_at", "desc")
      .limit(200)
      .get()

    const q = query.toLowerCase().trim()
    const results = snapshot.docs
      .map((doc) => serializeData({ id: doc.id, ...doc.data() }) as PrescriptionRecord)
      .filter(
        (p) =>
          p.patient_name.toLowerCase().includes(q) ||
          (p.prescription_number && p.prescription_number.toLowerCase().includes(q)) ||
          (p.patient_phone && p.patient_phone.includes(q)) ||
          (p.doctor_name && p.doctor_name.toLowerCase().includes(q))
      )

    return results.slice(0, 50)
  } catch (err) {
    logError("[Pharmacy] Error searching prescriptions:", err)
    return []
  }
}

// ==================== Insurance Claims ====================

/**
 * Add an insurance company for the store
 */
export async function addInsuranceCompany(data: {
  store_id: string
  name: string
  coverage_percentage: number
  contact_phone?: string
  contract_number?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!(await isStoreOwner(data.store_id))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check for duplicate name
    const existing = await db
      .collection("pos_insurance_companies")
      .where("store_id", "==", data.store_id)
      .where("name", "==", data.name.trim())
      .limit(1)
      .get()

    if (!existing.empty) {
      return { success: false, error: PHARMACY_ERROR.INSURANCE_COMPANY_EXISTS }
    }

    const docRef = db.collection("pos_insurance_companies").doc()
    const payload = {
      store_id: data.store_id,
      name: data.name.trim(),
      coverage_percentage: Math.min(100, Math.max(0, data.coverage_percentage)),
      contact_phone: data.contact_phone || null,
      contract_number: data.contract_number || null,
      is_active: true,
      created_at: now,
    }

    await docRef.set(payload)
    return { success: true, id: docRef.id }
  } catch (err) {
    logError("[Pharmacy] Error adding insurance company:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Get insurance companies for a store
 */
export async function getInsuranceCompanies(storeId: string): Promise<InsuranceCompany[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_insurance_companies")
      .where("store_id", "==", storeId)
      .get()

    return snapshot.docs
      .map((doc) => serializeData({ id: doc.id, ...doc.data() }) as InsuranceCompany)
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    logError("[Pharmacy] Error getting insurance companies:", err)
    return []
  }
}

/**
 * Toggle an insurance company's active status
 */
export async function toggleInsuranceCompany(storeId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const docRef = db.collection("pos_insurance_companies").doc(companyId)
    const doc = await docRef.get()

    if (!doc.exists || doc.data()?.store_id !== storeId) {
      return { success: false, error: PHARMACY_ERROR.INSURANCE_NOT_FOUND }
    }

    await docRef.update({ is_active: !doc.data()!.is_active })
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error toggling insurance company:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Create an insurance claim for a sale
 */
export async function createInsuranceClaim(data: {
  store_id: string
  sale_id: string
  sale_number: string
  insurance_company_id: string
  policy_number: string
  patient_name: string
  total_amount: number
  coverage_percentage: number
  notes?: string
}): Promise<{ success: boolean; claim_id?: string; copay_amount?: number; insurance_amount?: number; error?: string }> {
  try {
    if (!(await isStoreOwner(data.store_id))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Verify insurance company exists
    const companyDoc = await db.collection("pos_insurance_companies").doc(data.insurance_company_id).get()
    if (!companyDoc.exists || companyDoc.data()?.store_id !== data.store_id) {
      return { success: false, error: PHARMACY_ERROR.INSURANCE_NOT_FOUND }
    }

    const coverageRate = Math.min(100, Math.max(0, data.coverage_percentage)) / 100
    const insuranceAmount = roundMoney(data.total_amount * coverageRate)
    const copayAmount = roundMoney(data.total_amount - insuranceAmount)

    const docRef = db.collection("pos_insurance_claims").doc()
    const payload = {
      store_id: data.store_id,
      sale_id: data.sale_id,
      sale_number: data.sale_number,
      insurance_company: companyDoc.data()!.name,
      insurance_company_id: data.insurance_company_id,
      policy_number: data.policy_number.trim(),
      patient_name: data.patient_name.trim(),
      total_amount: roundMoney(data.total_amount),
      insurance_coverage: data.coverage_percentage,
      copay_amount: copayAmount,
      insurance_amount: insuranceAmount,
      status: "pending" as const,
      claim_number: null,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(payload)
    return {
      success: true,
      claim_id: docRef.id,
      copay_amount: copayAmount,
      insurance_amount: insuranceAmount,
    }
  } catch (err) {
    logError("[Pharmacy] Error creating insurance claim:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Get insurance claims for a store
 */
export async function getInsuranceClaims(
  storeId: string,
  statusFilter?: InsuranceClaim["status"]
): Promise<InsuranceClaim[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db
      .collection("pos_insurance_claims")
      .where("store_id", "==", storeId)

    if (statusFilter) {
      query = query.where("status", "==", statusFilter)
    }

    const snapshot = await query.orderBy("created_at", "desc").limit(100).get()
    return snapshot.docs.map((doc) =>
      serializeData({ id: doc.id, ...doc.data() }) as InsuranceClaim
    )
  } catch (err) {
    logError("[Pharmacy] Error getting insurance claims:", err)
    return []
  }
}

/**
 * Update insurance claim status
 */
export async function updateClaimStatus(
  storeId: string,
  claimId: string,
  status: InsuranceClaim["status"],
  claimNumber?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const docRef = db.collection("pos_insurance_claims").doc(claimId)
    const doc = await docRef.get()

    if (!doc.exists || doc.data()?.store_id !== storeId) {
      return { success: false, error: PHARMACY_ERROR.CLAIM_NOT_FOUND }
    }

    const update: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (claimNumber) update.claim_number = claimNumber

    await docRef.update(update)
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error updating claim status:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

// ==================== Drug Alternatives ====================

/**
 * Find alternative products with the same active ingredient
 */
export async function findDrugAlternatives(
  storeId: string,
  productId: string
): Promise<{ success: boolean; alternatives?: DrugAlternative[]; active_ingredient?: string; error?: string }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const productDoc = await db.collection("products").doc(productId).get()

    if (!productDoc.exists || productDoc.data()?.store_id !== storeId) {
      return { success: false, error: PHARMACY_ERROR.PRODUCT_NOT_FOUND }
    }

    const activeIngredient = productDoc.data()!.active_ingredient
    if (!activeIngredient) {
      return { success: false, error: PHARMACY_ERROR.NO_ALTERNATIVES }
    }

    // Get all products with the same active ingredient
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .where("active_ingredient", "==", activeIngredient)
      .get()

    const alternatives: DrugAlternative[] = snapshot.docs
      .filter((doc) => doc.id !== productId) // Exclude the original product
      .map((doc) => {
        const data = doc.data()
        return {
          product_id: doc.id,
          product_name: data.name || "",
          price: Number(data.price) || 0,
          stock: Number(data.stock) || 0,
          active_ingredient: activeIngredient,
          manufacturer: data.manufacturer || null,
        }
      })
      .sort((a, b) => a.price - b.price) // Sort by price ascending

    if (alternatives.length === 0) {
      return { success: false, error: PHARMACY_ERROR.NO_ALTERNATIVES }
    }

    return { success: true, alternatives, active_ingredient: activeIngredient }
  } catch (err) {
    logError("[Pharmacy] Error finding alternatives:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

// ==================== Pharmacy Product Enrichment ====================

/**
 * Get pharmacy-specific fields for products (to overlay on POS product data)
 * Returns a map of product_id -> pharmacy fields
 */
export async function getPharmacyProductData(storeId: string): Promise<
  Record<string, {
    expiry_date?: string | null
    batch_number?: string | null
    active_ingredient?: string | null
    requires_prescription?: boolean
    manufacturer?: string | null
    dosage_form?: string | null
    storage_conditions?: string | null
  }>
> {
  try {
    if (!(await isStoreOwner(storeId))) return {}
    const db = getAdminDb()
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .get()

    const map: Record<string, any> = {}
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      // Only include if product has any pharmacy fields
      if (data.expiry_date || data.batch_number || data.active_ingredient || data.requires_prescription || data.manufacturer || data.dosage_form) {
        map[doc.id] = {
          expiry_date: data.expiry_date || null,
          batch_number: data.batch_number || null,
          active_ingredient: data.active_ingredient || null,
          requires_prescription: data.requires_prescription || false,
          manufacturer: data.manufacturer || null,
          dosage_form: data.dosage_form || null,
          storage_conditions: data.storage_conditions || null,
        }
      }
    })

    return map
  } catch (err) {
    logError("[Pharmacy] Error getting pharmacy product data:", err)
    return {}
  }
}

/**
 * Batch check products for expiry before completing a sale
 * Returns list of expired or near-expiry product IDs
 */
export async function batchCheckExpiry(
  storeId: string,
  productIds: string[]
): Promise<{
  expired: string[]
  nearExpiry: { id: string; days: number; name: string }[]
}> {
  try {
    if (!(await isStoreOwner(storeId))) return { expired: [], nearExpiry: [] }
    const db = getAdminDb()
    const now = new Date()
    const expired: string[] = []
    const nearExpiry: { id: string; days: number; name: string }[] = []

    // Firestore 'in' query supports max 30 items
    const chunks: string[][] = []
    for (let i = 0; i < productIds.length; i += 30) {
      chunks.push(productIds.slice(i, i + 30))
    }

    for (const chunk of chunks) {
      const snapshot = await db
        .collection("products")
        .where("store_id", "==", storeId)
        .where("__name__", "in", chunk)
        .get()

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (!data.expiry_date) return

        const expiryDate = new Date(data.expiry_date)
        const diffMs = expiryDate.getTime() - now.getTime()
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (daysRemaining <= 0) {
          expired.push(doc.id)
        } else if (daysRemaining <= EXPIRY_CRITICAL_DAYS) {
          nearExpiry.push({ id: doc.id, days: daysRemaining, name: data.name || "" })
        }
      })
    }

    return { expired, nearExpiry }
  } catch (err) {
    logError("[Pharmacy] Error batch checking expiry:", err)
    return { expired: [], nearExpiry: [] }
  }
}

// ==================== Drug Interactions ====================

// Common drug interaction groups
const DRUG_INTERACTIONS: DrugInteraction[] = [
  { group_a: "NSAID", group_b: "anticoagulant", severity: "high", description_ar: "مضادات الالتهاب غير الستيرويدية مع مضادات التخثر تزيد خطر النزيف", description_en: "NSAIDs with anticoagulants increase bleeding risk" },
  { group_a: "NSAID", group_b: "ACE_inhibitor", severity: "moderate", description_ar: "مضادات الالتهاب قد تقلل فعالية أدوية الضغط", description_en: "NSAIDs may reduce effectiveness of ACE inhibitors" },
  { group_a: "NSAID", group_b: "NSAID", severity: "high", description_ar: "لا يجب استخدام أكثر من مضاد التهاب في نفس الوقت", description_en: "Do not use multiple NSAIDs simultaneously" },
  { group_a: "statin", group_b: "fibrate", severity: "high", description_ar: "الستاتينات مع الفايبرات تزيد خطر تلف العضلات", description_en: "Statins with fibrates increase risk of muscle damage" },
  { group_a: "SSRI", group_b: "MAOI", severity: "high", description_ar: "مثبطات السيروتونين مع مثبطات MAO خطر متلازمة السيروتونين", description_en: "SSRIs with MAOIs risk serotonin syndrome" },
  { group_a: "SSRI", group_b: "anticoagulant", severity: "moderate", description_ar: "مضادات الاكتئاب مع مميعات الدم قد تزيد النزيف", description_en: "SSRIs with anticoagulants may increase bleeding" },
  { group_a: "metformin", group_b: "contrast_dye", severity: "high", description_ar: "الميتفورمين مع صبغة التباين خطر فشل كلوي", description_en: "Metformin with contrast dye risks renal failure" },
  { group_a: "potassium", group_b: "ACE_inhibitor", severity: "moderate", description_ar: "البوتاسيوم مع أدوية الضغط خطر ارتفاع البوتاسيوم", description_en: "Potassium with ACE inhibitors risks hyperkalemia" },
  { group_a: "antidiabetic", group_b: "beta_blocker", severity: "moderate", description_ar: "أدوية السكري مع حاصرات بيتا قد تخفي أعراض انخفاض السكر", description_en: "Antidiabetics with beta-blockers may mask hypoglycemia" },
  { group_a: "antibiotic_aminoglycoside", group_b: "diuretic_loop", severity: "high", description_ar: "المضادات الحيوية أمينوغليكوزيد مع مدرات البول تزيد سمية الأذن والكلى", description_en: "Aminoglycosides with loop diuretics increase oto/nephrotoxicity" },
  { group_a: "antihistamine", group_b: "sedative", severity: "moderate", description_ar: "مضادات الهيستامين مع المهدئات تزيد النعاس بشكل خطير", description_en: "Antihistamines with sedatives increase dangerous drowsiness" },
  { group_a: "theophylline", group_b: "fluoroquinolone", severity: "high", description_ar: "الثيوفيلين مع الفلوروكينولون يزيد سمية الثيوفيلين", description_en: "Theophylline with fluoroquinolones increases theophylline toxicity" },
]

/**
 * Check drug interactions for items in cart
 */
export async function checkDrugInteractions(
  storeId: string,
  productIds: string[]
): Promise<{ warnings: { product_a: string; product_b: string; severity: string; description_ar: string; description_en: string }[] }> {
  try {
    if (!(await isStoreOwner(storeId))) return { warnings: [] }
    if (productIds.length < 2) return { warnings: [] }

    const db = getAdminDb()
    const warnings: { product_a: string; product_b: string; severity: string; description_ar: string; description_en: string }[] = []

    // Fetch interaction groups for all products
    const chunks: string[][] = []
    for (let i = 0; i < productIds.length; i += 30) {
      chunks.push(productIds.slice(i, i + 30))
    }

    const productGroups: Record<string, { name: string; group: string }> = {}
    for (const chunk of chunks) {
      const snapshot = await db
        .collection("products")
        .where("store_id", "==", storeId)
        .where("__name__", "in", chunk)
        .get()

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (data.interaction_group) {
          productGroups[doc.id] = { name: data.name || "", group: data.interaction_group }
        }
      })
    }

    const groupedProducts = Object.entries(productGroups)
    for (let i = 0; i < groupedProducts.length; i++) {
      for (let j = i + 1; j < groupedProducts.length; j++) {
        const [idA, dataA] = groupedProducts[i]
        const [idB, dataB] = groupedProducts[j]

        const interaction = DRUG_INTERACTIONS.find(
          (int) =>
            (int.group_a === dataA.group && int.group_b === dataB.group) ||
            (int.group_a === dataB.group && int.group_b === dataA.group)
        )

        if (interaction) {
          warnings.push({
            product_a: dataA.name,
            product_b: dataB.name,
            severity: interaction.severity,
            description_ar: interaction.description_ar,
            description_en: interaction.description_en,
          })
        }
      }
    }

    return { warnings }
  } catch (err) {
    logError("[Pharmacy] Error checking drug interactions:", err)
    return { warnings: [] }
  }
}

/**
 * Save interaction_group and contraindications for a product
 */
export async function updateProductInteractionGroup(
  storeId: string,
  productId: string,
  interactionGroup: string | null,
  contraindications?: string[]
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const ref = db.collection("products").doc(productId)
    const doc = await ref.get()
    if (!doc.exists || doc.data()?.store_id !== storeId) return { success: false }

    const update: Record<string, any> = {
      interaction_group: interactionGroup || null,
      updated_at: new Date().toISOString(),
    }
    if (contraindications !== undefined) {
      update.contraindications = contraindications.length > 0 ? contraindications : null
    }
    await ref.update(update)
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error updating interaction group:", err)
    return { success: false }
  }
}

// ==================== FEFO (First Expired First Out) ====================

/**
 * Get products sorted by nearest expiry (FEFO order) for restocking / selling recommendations.
 * Groups by batch when multiple batches exist.
 */
export async function getFEFOProducts(storeId: string): Promise<BatchInventoryItem[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .get()

    const now = new Date()
    const items: BatchInventoryItem[] = []

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (!data.expiry_date || (Number(data.stock) || 0) <= 0) return

      const expiryDate = new Date(data.expiry_date)
      const diffMs = expiryDate.getTime() - now.getTime()
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      let status: BatchInventoryItem["status"] = "ok"
      if (daysRemaining <= 0) status = "expired"
      else if (daysRemaining <= EXPIRY_CRITICAL_DAYS) status = "critical"
      else if (daysRemaining <= EXPIRY_WARNING_DAYS) status = "warning"

      items.push({
        product_id: doc.id,
        product_name: data.name || "",
        batch_number: data.batch_number || "N/A",
        expiry_date: data.expiry_date,
        stock: Number(data.stock) || 0,
        days_remaining: daysRemaining,
        status,
      })
    })

    // Sort: nearest expiry first (FEFO)
    items.sort((a, b) => a.days_remaining - b.days_remaining)
    return items
  } catch (err) {
    logError("[Pharmacy] Error getting FEFO products:", err)
    return []
  }
}

// ==================== Multi-Unit Support ====================

/**
 * Update multi-unit fields for a product (strip_per_box, piece_per_strip, etc.)
 */
export async function updateProductUnits(
  storeId: string,
  productId: string,
  fields: {
    unit_type?: string | null
    strip_per_box?: number | null
    piece_per_strip?: number | null
    box_per_carton?: number | null
    price_unit?: string | null       // "piece" | "strip" | "box" — what unit the product.price represents
    default_selling_unit?: string | null  // default unit when adding to cart
  }
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const ref = db.collection("products").doc(productId)
    const doc = await ref.get()
    if (!doc.exists || doc.data()?.store_id !== storeId) return { success: false }

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (fields.unit_type !== undefined) update.unit_type = fields.unit_type
    if (fields.strip_per_box !== undefined) update.strip_per_box = fields.strip_per_box
    if (fields.piece_per_strip !== undefined) update.piece_per_strip = fields.piece_per_strip
    if (fields.box_per_carton !== undefined) update.box_per_carton = fields.box_per_carton
    if (fields.price_unit !== undefined) update.price_unit = fields.price_unit
    if (fields.default_selling_unit !== undefined) update.default_selling_unit = fields.default_selling_unit

    await ref.update(update)
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error updating product units:", err)
    return { success: false }
  }
}

/**
 * Calculate available units for a product
 */
export async function calculateProductUnits(
  totalPieces: number,
  piecePerStrip?: number | null,
  stripPerBox?: number | null,
  boxPerCarton?: number | null
): Promise<ProductUnit[]> {
  const units: ProductUnit[] = []

  // Always include piece
  units.push({ type: "piece", label_ar: "قطعة/حبة", label_en: "Piece", multiplier: 1, price: 0 })

  if (piecePerStrip && piecePerStrip > 1) {
    units.push({ type: "strip", label_ar: "شريط", label_en: "Strip", multiplier: piecePerStrip, price: 0 })
  }

  if (stripPerBox && stripPerBox > 1 && piecePerStrip) {
    const piecesPerBox = piecePerStrip * stripPerBox
    units.push({ type: "box", label_ar: "علبة", label_en: "Box", multiplier: piecesPerBox, price: 0 })

    if (boxPerCarton && boxPerCarton > 1) {
      const piecesPerCarton = piecesPerBox * boxPerCarton
      units.push({ type: "carton", label_ar: "كرتونة", label_en: "Carton", multiplier: piecesPerCarton, price: 0 })
    }
  }

  return units
}

// ==================== Patient File System ====================

/**
 * Create or update a patient file
 */
export async function createOrUpdatePatient(
  storeId: string,
  data: {
    name: string
    phone: string
    date_of_birth?: string
    gender?: string
    allergies?: string[]
    chronic_conditions?: string[]
    notes?: string
  }
): Promise<{ success: boolean; patient?: PatientFile; error?: string }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const now = new Date().toISOString()

    // Check if patient already exists by phone
    const existing = await db
      .collection("pos_patients")
      .where("store_id", "==", storeId)
      .where("phone", "==", data.phone.trim())
      .limit(1)
      .get()

    if (!existing.empty) {
      // Update existing patient
      const docRef = existing.docs[0].ref
      const updatePayload: Record<string, any> = {
        name: data.name.trim(),
        updated_at: now,
      }
      if (data.date_of_birth !== undefined) updatePayload.date_of_birth = data.date_of_birth || null
      if (data.gender !== undefined) updatePayload.gender = data.gender || null
      if (data.allergies !== undefined) updatePayload.allergies = data.allergies
      if (data.chronic_conditions !== undefined) updatePayload.chronic_conditions = data.chronic_conditions
      if (data.notes !== undefined) updatePayload.notes = data.notes || null

      await docRef.update(updatePayload)
      const updated = await docRef.get()
      return { success: true, patient: serializeData({ id: docRef.id, ...updated.data() }) as PatientFile }
    }

    // Create new patient
    const docRef = db.collection("pos_patients").doc()
    const payload = {
      store_id: storeId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      allergies: data.allergies || [],
      chronic_conditions: data.chronic_conditions || [],
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    }
    await docRef.set(payload)
    return { success: true, patient: serializeData({ id: docRef.id, ...payload }) as PatientFile }
  } catch (err) {
    logError("[Pharmacy] Error creating/updating patient:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

/**
 * Search patients by name or phone
 */
export async function searchPatients(storeId: string, query: string): Promise<PatientFile[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_patients")
      .where("store_id", "==", storeId)
      .limit(200)
      .get()

    const q = query.toLowerCase().trim()
    return snapshot.docs
      .map((doc) => serializeData({ id: doc.id, ...doc.data() }) as PatientFile)
      .filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q))
      .slice(0, 30)
  } catch (err) {
    logError("[Pharmacy] Error searching patients:", err)
    return []
  }
}

/**
 * Get a specific patient by phone
 */
export async function getPatientByPhone(storeId: string, phone: string): Promise<PatientFile | null> {
  try {
    if (!(await isStoreOwner(storeId))) return null
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_patients")
      .where("store_id", "==", storeId)
      .where("phone", "==", phone.trim())
      .limit(1)
      .get()

    if (snapshot.empty) return null
    return serializeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() }) as PatientFile
  } catch (err) {
    logError("[Pharmacy] Error getting patient:", err)
    return null
  }
}

/**
 * Record medication dispensed to a patient
 */
export async function recordPatientMedication(
  storeId: string,
  patientId: string,
  medications: {
    product_id: string
    product_name: string
    sale_id: string
    quantity: number
    dosage?: string
    instructions?: string
    doctor_name?: string
  }[]
): Promise<{ success: boolean }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false }
    const db = getAdminDb()
    const batch = db.batch()
    const now = new Date().toISOString()

    for (const med of medications) {
      const docRef = db.collection("pos_patient_medications").doc()
      batch.set(docRef, {
        patient_id: patientId,
        store_id: storeId,
        product_id: med.product_id,
        product_name: med.product_name,
        sale_id: med.sale_id,
        quantity: med.quantity,
        dosage: med.dosage || null,
        instructions: med.instructions || null,
        doctor_name: med.doctor_name || null,
        date: now,
      })
    }

    await batch.commit()
    return { success: true }
  } catch (err) {
    logError("[Pharmacy] Error recording patient medications:", err)
    return { success: false }
  }
}

/**
 * Get medication history for a patient
 */
export async function getPatientMedications(
  storeId: string,
  patientId: string
): Promise<PatientMedication[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("pos_patient_medications")
      .where("store_id", "==", storeId)
      .where("patient_id", "==", patientId)
      .orderBy("date", "desc")
      .limit(100)
      .get()

    return snapshot.docs.map((doc) => serializeData({ id: doc.id, ...doc.data() }) as PatientMedication)
  } catch (err) {
    logError("[Pharmacy] Error getting patient medications:", err)
    return []
  }
}

/**
 * Check patient allergies against cart items
 */
export async function checkPatientAllergies(
  storeId: string,
  patientId: string,
  productIds: string[]
): Promise<{ warnings: { product_name: string; allergy: string }[] }> {
  try {
    if (!(await isStoreOwner(storeId))) return { warnings: [] }
    const db = getAdminDb()

    // Get patient allergies
    const patientDoc = await db.collection("pos_patients").doc(patientId).get()
    if (!patientDoc.exists || patientDoc.data()?.store_id !== storeId) return { warnings: [] }
    const allergies = (patientDoc.data()!.allergies || []) as string[]
    if (allergies.length === 0) return { warnings: [] }

    const allergiesLower = allergies.map((a) => a.toLowerCase())

    // Fetch products to check active ingredients
    const warnings: { product_name: string; allergy: string }[] = []
    const chunks: string[][] = []
    for (let i = 0; i < productIds.length; i += 30) {
      chunks.push(productIds.slice(i, i + 30))
    }

    for (const chunk of chunks) {
      const snapshot = await db
        .collection("products")
        .where("store_id", "==", storeId)
        .where("__name__", "in", chunk)
        .get()

      snapshot.docs.forEach((doc) => {
        const data = doc.data()
        const ingredient = (data.active_ingredient || "").toLowerCase()
        const name = (data.name || "").toLowerCase()

        for (const allergy of allergiesLower) {
          if (ingredient.includes(allergy) || name.includes(allergy)) {
            warnings.push({ product_name: data.name || doc.id, allergy })
          }
        }
      })
    }

    return { warnings }
  } catch (err) {
    logError("[Pharmacy] Error checking patient allergies:", err)
    return { warnings: [] }
  }
}

// ==================== Drug Label Printing ====================

/**
 * Generate drug label data (client will handle printing)
 */
export async function generateDrugLabel(
  storeId: string,
  productId: string,
  patientName?: string,
  doctorName?: string,
  instructions?: string,
  storeName?: string
): Promise<{ success: boolean; label?: DrugLabel; error?: string }> {
  try {
    if (!(await isStoreOwner(storeId))) return { success: false, error: PHARMACY_ERROR.UNAUTHORIZED }
    const db = getAdminDb()
    const doc = await db.collection("products").doc(productId).get()
    if (!doc.exists || doc.data()?.store_id !== storeId) {
      return { success: false, error: PHARMACY_ERROR.PRODUCT_NOT_FOUND }
    }

    const data = doc.data()!
    const label: DrugLabel = {
      product_name: data.name || "",
      active_ingredient: data.active_ingredient || null,
      dosage_form: data.dosage_form || null,
      batch_number: data.batch_number || null,
      expiry_date: data.expiry_date || null,
      manufacturer: data.manufacturer || null,
      instructions: instructions || "",
      patient_name: patientName,
      doctor_name: doctorName,
      store_name: storeName || "",
      date: new Date().toISOString().split("T")[0],
    }

    return { success: true, label }
  } catch (err) {
    logError("[Pharmacy] Error generating drug label:", err)
    return { success: false, error: "UNEXPECTED_ERROR" }
  }
}

// ==================== Batch Inventory ====================

/**
 * Get inventory grouped by batch number for batch-level tracking
 */
export async function getBatchInventory(storeId: string): Promise<BatchInventoryItem[]> {
  try {
    if (!(await isStoreOwner(storeId))) return []
    const db = getAdminDb()
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .get()

    const now = new Date()
    const items: BatchInventoryItem[] = []

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (!data.batch_number) return

      const expiryDate = data.expiry_date ? new Date(data.expiry_date) : null
      let daysRemaining = 999
      let status: BatchInventoryItem["status"] = "ok"

      if (expiryDate) {
        const diffMs = expiryDate.getTime() - now.getTime()
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        if (daysRemaining <= 0) status = "expired"
        else if (daysRemaining <= EXPIRY_CRITICAL_DAYS) status = "critical"
        else if (daysRemaining <= EXPIRY_WARNING_DAYS) status = "warning"
      }

      items.push({
        product_id: doc.id,
        product_name: data.name || "",
        batch_number: data.batch_number,
        expiry_date: data.expiry_date || "",
        stock: Number(data.stock) || 0,
        days_remaining: daysRemaining,
        status,
      })
    })

    items.sort((a, b) => a.days_remaining - b.days_remaining)
    return items
  } catch (err) {
    logError("[Pharmacy] Error getting batch inventory:", err)
    return []
  }
}

// ==================== Enhanced Quick-Add Data ====================

/**
 * Get enhanced pharmacy data for all products (includes multi-unit + interaction group)
 */
export async function getEnhancedPharmacyData(storeId: string): Promise<
  Record<string, {
    expiry_date?: string | null
    batch_number?: string | null
    active_ingredient?: string | null
    requires_prescription?: boolean
    manufacturer?: string | null
    dosage_form?: string | null
    storage_conditions?: string | null
    interaction_group?: string | null
    contraindications?: string[] | null
    unit_type?: string | null
    strip_per_box?: number | null
    piece_per_strip?: number | null
    box_per_carton?: number | null
    price_unit?: string | null
    default_selling_unit?: string | null
  }>
> {
  try {
    if (!(await isStoreOwner(storeId))) return {}
    const db = getAdminDb()
    const snapshot = await db
      .collection("products")
      .where("store_id", "==", storeId)
      .get()

    const map: Record<string, any> = {}
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      map[doc.id] = {
        expiry_date: data.expiry_date || null,
        batch_number: data.batch_number || null,
        active_ingredient: data.active_ingredient || null,
        requires_prescription: data.requires_prescription || false,
        manufacturer: data.manufacturer || null,
        dosage_form: data.dosage_form || null,
        storage_conditions: data.storage_conditions || null,
        interaction_group: data.interaction_group || null,
        contraindications: data.contraindications || null,
        unit_type: data.unit_type || null,
        strip_per_box: data.strip_per_box || null,
        piece_per_strip: data.piece_per_strip || null,
        box_per_carton: data.box_per_carton || null,
        price_unit: data.price_unit || null,
        default_selling_unit: data.default_selling_unit || null,
      }
    })

    return map
  } catch (err) {
    logError("[Pharmacy] Error getting enhanced pharmacy data:", err)
    return {}
  }
}
