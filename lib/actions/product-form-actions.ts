"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { FieldValue } from "firebase-admin/firestore"

/**
 * يتحقق سيرفر-سايد أن المستخدم الموثّق (من الجلسة) هو مالك المنتج.
 * لا نثق بأي storeId قادم من العميل — نشتق الملكية من مستند المنتج نفسه.
 */
async function assertProductOwnership(
  productId: string,
): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false, error: "Unauthorized" }
  const snap = await getAdminDb().collection("products").doc(productId).get()
  if (!snap.exists) return { ok: false, error: "Product not found" }
  if (snap.data()?.store_id !== uid) return { ok: false, error: "Unauthorized" }
  return { ok: true, uid }
}

/**
 * Save pharmacy-specific fields for a product.
 * This is a lightweight wrapper that avoids importing the full pos-pharmacy module
 * directly in client components.
 */
export async function savePharmacyProductFields(
  productId: string,
  storeId: string,
  pharmacyData: {
    active_ingredient?: string
    manufacturer?: string
    dosage_form?: string
    storage_conditions?: string
    requires_prescription?: boolean
    expiry_date?: string
    batch_number?: string
  },
  unitData?: {
    piece_per_strip?: number
    strip_per_box?: number
    box_per_carton?: number
    price_unit?: string
    default_selling_unit?: string
  }
) {
  const ownership = await assertProductOwnership(productId)
  if (!ownership.ok) return { success: false, error: ownership.error }

  const db = getAdminDb()

  // Save pharmacy fields
  const pharmacyFields: Record<string, any> = {}
  if (pharmacyData.active_ingredient) pharmacyFields.active_ingredient = pharmacyData.active_ingredient
  if (pharmacyData.manufacturer) pharmacyFields.manufacturer = pharmacyData.manufacturer
  if (pharmacyData.dosage_form) pharmacyFields.dosage_form = pharmacyData.dosage_form
  if (pharmacyData.storage_conditions) pharmacyFields.storage_conditions = pharmacyData.storage_conditions
  if (pharmacyData.requires_prescription !== undefined) pharmacyFields.requires_prescription = pharmacyData.requires_prescription
  if (pharmacyData.expiry_date) pharmacyFields.expiry_date = pharmacyData.expiry_date
  if (pharmacyData.batch_number) pharmacyFields.batch_number = pharmacyData.batch_number

  if (Object.keys(pharmacyFields).length > 0) {
    pharmacyFields.updated_at = FieldValue.serverTimestamp()
    await db.collection("products").doc(productId).update(pharmacyFields)
  }

  // Save unit data
  if (unitData && (unitData.piece_per_strip || unitData.strip_per_box || unitData.box_per_carton)) {
    const unitFields: Record<string, any> = {
      updated_at: FieldValue.serverTimestamp(),
    }
    if (unitData.piece_per_strip) unitFields.piece_per_strip = unitData.piece_per_strip
    if (unitData.strip_per_box) unitFields.strip_per_box = unitData.strip_per_box
    if (unitData.box_per_carton) unitFields.box_per_carton = unitData.box_per_carton
    if (unitData.price_unit) unitFields.price_unit = unitData.price_unit
    if (unitData.default_selling_unit) unitFields.default_selling_unit = unitData.default_selling_unit

    await db.collection("products").doc(productId).update(unitFields)
  }

  return { success: true }
}

/**
 * Save clothing variants for a product.
 */
export async function saveClothingProductVariants(
  productId: string,
  storeId: string,
  variants: {
    sizes: string[]
    colors: string[]
    colorHexMap?: Record<string, string>
    material?: string
    season?: string
    gender?: string
    ageGroup?: string
    fitType?: string
    pattern?: string
    sleeveType?: string
    neckline?: string
    occasion?: string
    brand?: string
    skuPrefix?: string
    careInstructions?: string[]
    weight?: number
    totalStock: number
  }
) {
  const ownership = await assertProductOwnership(productId)
  if (!ownership.ok) return { success: false, error: ownership.error }
  // اشتقاق المالك من الجلسة — لا نثق بـ storeId القادم من العميل
  storeId = ownership.uid

  const db = getAdminDb()

  // Save all clothing product-level attributes
  const productUpdate: Record<string, any> = {
    updated_at: FieldValue.serverTimestamp(),
  }
  if (variants.material) productUpdate.material = variants.material
  if (variants.season) productUpdate.season = variants.season
  if (variants.gender) productUpdate.gender = variants.gender
  if (variants.ageGroup) productUpdate.age_group = variants.ageGroup
  if (variants.fitType) productUpdate.fit_type = variants.fitType
  if (variants.pattern) productUpdate.pattern = variants.pattern
  if (variants.sleeveType) productUpdate.sleeve_type = variants.sleeveType
  if (variants.neckline) productUpdate.neckline = variants.neckline
  if (variants.occasion) productUpdate.occasion = variants.occasion
  if (variants.brand) productUpdate.brand = variants.brand
  if (variants.careInstructions) productUpdate.care_instructions = variants.careInstructions
  if (variants.weight) productUpdate.weight_grams = variants.weight
  if (variants.sizes.length > 0) productUpdate.available_sizes = variants.sizes
  if (variants.colors.length > 0) productUpdate.available_colors = variants.colors
  await db.collection("products").doc(productId).update(productUpdate)

  // ملاحظة: كانت تُولَّد هنا متغيّرات (مقاس×لون) وتُكتب في products/{id}/variants، لكن كاشير
  // الملابس يقرأ/يكتب في stores/{storeId}/product_variants — فتلك البيانات كانت يتيمة (لا تُقرأ
  // أبدًا) وبقسمة floor تفقد الباقي. أزلنا الكتابة الميتة؛ سمات المنتج (المقاسات/الألوان) محفوظة
  // أعلاه، والكاشير يدير متغيّراته في مجموعته الخاصة.
  const variantCount = (variants.sizes.length || 1) * (variants.colors.length || 1)

  return { success: true, variantCount }
}

/**
 * Save grocery/electronics extra fields for a product.
 */
export async function saveExtraProductFields(
  productId: string,
  fields: Record<string, any>
) {
  const ownership = await assertProductOwnership(productId)
  if (!ownership.ok) return { success: false, error: ownership.error }

  const db = getAdminDb()
  // منع العميل من إعادة كتابة حقول الملكية/الهوية عبر هذا المسار العام
  const PROTECTED_KEYS = new Set(["store_id", "id", "seller_id", "owner", "owner_id", "role"])
  const safeFields: Record<string, any> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!PROTECTED_KEYS.has(key)) safeFields[key] = value
  }
  await db.collection("products").doc(productId).update({
    ...safeFields,
    updated_at: FieldValue.serverTimestamp(),
  })
  return { success: true }
}

/**
 * Get category name by ID - lightweight wrapper.
 */
export async function getCategoryNameForForm(categoryId: string): Promise<string | null> {
  const db = getAdminDb()
  try {
    const doc = await db.collection("categories").doc(categoryId).get()
    if (doc.exists) {
      return doc.data()?.name || null
    }
    return null
  } catch {
    return null
  }
}
