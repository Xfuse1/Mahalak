"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

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

  // Generate size x color variants
  const sizeCount = variants.sizes.length || 1
  const colorCount = variants.colors.length || 1
  const variantCount = sizeCount * colorCount
  const stockPerVariant = Math.floor(variants.totalStock / variantCount)
  const skuBase = variants.skuPrefix || productId.substring(0, 6)

  const batch = db.batch()
  for (const size of variants.sizes.length > 0 ? variants.sizes : [""]) {
    for (const color of variants.colors.length > 0 ? variants.colors : [""]) {
      const variantRef = db.collection("products").doc(productId).collection("variants").doc()
      const variantData: Record<string, any> = {
        product_id: productId,
        store_id: storeId,
        size,
        color,
        color_hex: variants.colorHexMap?.[color] || "",
        stock: stockPerVariant,
        sku: `${skuBase}-${size}-${color}`.replace(/\s/g, "-"),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      }
      batch.set(variantRef, variantData)
    }
  }
  await batch.commit()

  return { success: true, variantCount }
}

/**
 * Save grocery/electronics extra fields for a product.
 */
export async function saveExtraProductFields(
  productId: string,
  fields: Record<string, any>
) {
  const db = getAdminDb()
  const updateFields: Record<string, any> = {
    ...fields,
    updated_at: FieldValue.serverTimestamp(),
  }
  await db.collection("products").doc(productId).update(updateFields)
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
