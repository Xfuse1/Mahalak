"use server"

import type { DocumentSnapshot, Firestore, Query } from "firebase-admin/firestore"
import { FieldValue } from "firebase-admin/firestore"
import { revalidatePath, revalidateTag } from "next/cache"
import { unstable_cache } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid, requireOwner } from "../auth/session"
import { logError } from "../logger"
import { checkRateLimit } from "../utils/rate-limit"
import { putObject, PUBLIC_BUCKET } from "../storage/r2"
import { cleanUndefined, serializeData, chunkArray } from "../firebase/firestore-helpers"
import { storeCategorySubcategories } from "../mock-data"
import { calculateProfitPerUnit } from "../utils/product-pricing"
import { findBestDiscount as findBestDiscountShared, getActiveOffersForStores } from "../utils/offer-discount"

type ProductRecord = {
  id?: string
  name?: string
  description?: string
  price?: number
  cost_price?: number
  profit_per_unit?: number
  category?: string
  stock?: number
  image_url?: string
  store_id?: string
  barcode?: string
  expiry_date?: string | null // تاريخ الصلاحية (ISO/YYYY-MM-DD) — معمَّم لكل الأنواع، اختياري
  simulator_section?: string | null
  rating?: number
  rating_count?: number
  created_at?: string
  updated_at?: string
  discount_percentage?: number
  offer_title?: string | null
  reservation_enabled?: boolean
  stores?:
  | {
    id?: string
    name?: string
    category?: string
    phone?: string
    address?: unknown
  }
  | { name?: string; phone?: string | null; latitude?: number | null; longitude?: number | null }
  | null
  [key: string]: unknown
}

type StoreRecord = {
  id: string
  seller_id?: string
  name?: string
  category?: string
  phone?: string
  address?: unknown
  [key: string]: unknown
}

type OfferRecord = {
  product_id?: string
  category?: string
  store_id?: string
  title?: string | null
  discount_percentage?: number
  start_date?: string
  end_date?: string
  [key: string]: unknown
}

const PRODUCT_ERROR_CODES = {
  UNAUTHORIZED_STORE_PRODUCT_CREATE: "UNAUTHORIZED_STORE_PRODUCT_CREATE",
  PRICE_MUST_BE_POSITIVE: "PRICE_MUST_BE_POSITIVE",
  COST_PRICE_MUST_BE_POSITIVE: "COST_PRICE_MUST_BE_POSITIVE",
  SELLING_PRICE_BELOW_COST: "SELLING_PRICE_BELOW_COST",
  STOCK_MUST_BE_POSITIVE: "STOCK_MUST_BE_POSITIVE",
  STORE_NOT_APPROVED: "STORE_NOT_APPROVED",
  CREATE_PRODUCT_UNEXPECTED_ERROR: "CREATE_PRODUCT_UNEXPECTED_ERROR",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  UNAUTHORIZED_PRODUCT_ACCESS: "UNAUTHORIZED_PRODUCT_ACCESS",
  UPDATE_PRODUCT_FAILED: "UPDATE_PRODUCT_FAILED",
  DELETE_PRODUCT_FAILED: "DELETE_PRODUCT_FAILED",
  MISSING_FILE_OR_STORE_ID: "MISSING_FILE_OR_STORE_ID",
  UNAUTHORIZED_IMAGE_UPLOAD: "UNAUTHORIZED_IMAGE_UPLOAD",
  UNSUPPORTED_IMAGE_TYPE: "UNSUPPORTED_IMAGE_TYPE",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  IMAGE_UPLOAD_FAILED: "IMAGE_UPLOAD_FAILED",
  IMAGE_UPLOAD_INTERNAL_ERROR: "IMAGE_UPLOAD_INTERNAL_ERROR",
} as const

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
      const data = doc.data() as any
      if (data?.role === "seller") {
        const storeData = data.store || {}
        // Extract store data from user document with root-level fallbacks
        map.set(doc.id, {
          id: doc.id,
          seller_id: doc.id,
          ...storeData,
          name: storeData.name || data.full_name || "متجر غير معروف",
          phone: storeData.phone || data.phone || "",
          address: storeData.address || [data.city, data.street].filter(Boolean).join(", ") || "",
        })
      }
    }
  })

  return map
}

// حقول المتجر العامة التي تُرفَق ببطاقة المنتج في القوائم: الاسم للعرض، والهاتف لأزرار
// «واتساب/اتصال» السريعة، والإحداثيات لفلتر المسافة. تُعدَّد صراحةً ولا تُنسخ بـ spread أبدًا:
// قيمة storeMap هي مستند المتجر المضمَّن كاملًا وفيه حقول KYC (رقم الهوية وصور البطاقة) — نسخها
// بالجملة كان سينشرها في حمولة RSC لكل زائر. كلها منشورة أصلًا عبر getStores/getProduct.
function publicStoreFields(store: StoreRecord | undefined) {
  if (!store) return null
  return {
    name: store.name,
    phone: typeof store.phone === "string" ? store.phone : null,
    latitude: typeof store.latitude === "number" ? store.latitude : null,
    longitude: typeof store.longitude === "number" ? store.longitude : null,
  }
}

function attachStore(product: ProductRecord, storeMap: Map<string, StoreRecord>) {
  if (!product.store_id) return product
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

/**
 * Shared helper: find the best discount for a product from a list of offers.
 * Priority: product-specific > category-specific > store-wide.
 */
function findBestDiscount(
  product: { id: string; category?: string; store_id?: string },
  activeOffers: OfferRecord[],
  today: string
): { discount_percentage: number; offer_title: string | null } {
  return findBestDiscountShared(product, activeOffers, today)
}

// Internal implementation (no cache)
async function _getProductsImpl(category?: string) {
  const db = getAdminDb()

  if (category && storeCategorySubcategories[category]) {
    // Main category (e.g., "بقالة", "صحة", "ملابس")
    // Step 1: Get all stores that belong to this main category
    const sellersSnapshot = await db.collection("users").where("role", "==", "seller").get()
    const storeIds = sellersSnapshot.docs
      .filter((doc) => {
        const data = doc.data()
        return data.store && data.store.category === category
      })
      .map((doc) => doc.id)

    if (storeIds.length === 0) return []

    // Step 2: Get all products belonging to those stores (batch in chunks of 30 for Firestore "in" limit)
    const chunks = chunkArray(storeIds, 30)
    let products: Array<ProductRecord & { id: string }> = []
    for (const chunk of chunks) {
      const snap = await db.collection("products").where("store_id", "in", chunk).get()
      products.push(...snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProductRecord) })))
    }

    // Build store map from already fetched sellers
    const storeMap = new Map<string, StoreRecord>()
    sellersSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.store && data.store.category === category) {
        const storeData = data.store as Record<string, unknown>
        storeMap.set(doc.id, {
          id: doc.id,
          seller_id: doc.id,
          ...storeData,
          // احتياطي جذر مستند المستخدم مثل getStoreMap — بيانات قديمة كتبت الاسم/الهاتف خارج store
          name: (storeData.name as string) || (data.full_name as string) || "متجر غير معروف",
          phone: (storeData.phone as string) || (data.phone as string) || "",
        })
      }
    })

    // Fetch active offers
    const now = new Date().toISOString()
    const offersSnapshot = await db.collection("offers")
      .where("end_date", ">=", now.split('T')[0])
      .get()
    const activeOffers = offersSnapshot.docs.map((doc) => doc.data() as OfferRecord)
    const today = new Date().toISOString().split('T')[0]

    return products
      // إخفاء منتجات المتاجر المحظورة صراحةً فقط (is_approved === false) — mirror getStores !== false
      .filter((product) => {
        const store = product.store_id ? storeMap.get(product.store_id) : undefined
        return !(store && store.is_approved === false)
      })
      .map((product) => {
        const store = product.store_id ? storeMap.get(product.store_id) : undefined
        const { discount_percentage, offer_title } = findBestDiscount(product, activeOffers, today)

        return publicProductPayload({
          ...product,
          stores: publicStoreFields(store),
          discount_percentage,
          offer_title
        })
      })
  }

  // Subcategory or no category — original logic
  let query: Query = db.collection("products")
  if (category) {
    query = query.where("category", "==", category)
  }

  const snapshot = await query.get()
  const products = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  // Fetch active offers
  const now = new Date().toISOString()
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", now.split('T')[0])
    .get()
  const activeOffers = offersSnapshot.docs.map((doc) => doc.data() as OfferRecord)
  const today = new Date().toISOString().split('T')[0]

  const storeIds = Array.from(
    new Set(products.map((p) => p.store_id).filter((id): id is string => typeof id === "string" && id.length > 0)),
  )
  const storeMap = await getStoreMap(db, storeIds)

  return products
    // إخفاء منتجات المتاجر المحظورة صراحةً فقط (is_approved === false) — mirror getStores !== false
    .filter((product) => {
      const store = product.store_id ? storeMap.get(product.store_id) : undefined
      return !(store && store.is_approved === false)
    })
    .map((product) => {
      const store = product.store_id ? storeMap.get(product.store_id) : undefined
      const { discount_percentage, offer_title } = findBestDiscount(product, activeOffers, today)

      return publicProductPayload({
        ...product,
        stores: publicStoreFields(store),
        discount_percentage,
        offer_title
      })
    })
}

// Cached version of getProducts (revalidates every 60 seconds)
export async function getProducts(category?: string) {
  return unstable_cache(
    () => _getProductsImpl(category),
    ["products", category || "all"],
    { revalidate: 60, tags: ["products"] }
  )()
}

// Internal getProduct implementation
async function _getProductImpl(id: string) {
  const db = getAdminDb()
  const docSnap = await db.collection("products").doc(id).get()

  if (!docSnap.exists) {
    return null
  }

  const product = mapProduct(docSnap)
  if (!product) return null

  const storeMap = await getStoreMap(db, product.store_id ? [product.store_id] : [])

  // إخفاء منتج المتجر المحظور صراحةً (is_approved === false) من العرض العام — mirror getStores
  if (product.store_id) {
    const ownerStore = storeMap.get(product.store_id)
    if (ownerStore && ownerStore.is_approved === false) return null
  }

  const productWithStore = attachStore(product, storeMap)

  if (!product.store_id) {
    return publicProductPayload({
      ...productWithStore,
      discount_percentage: 0,
      offer_title: null,
    })
  }

  // Fetch all offers for this product's store (covers product-specific, category, and store-wide)
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers")
    .where("store_id", "==", product.store_id)
    .get()
  const activeOffers = offersSnapshot.docs.map((doc) => doc.data() as OfferRecord)
  const { discount_percentage, offer_title } = findBestDiscount(product, activeOffers, today)

  return publicProductPayload({
    ...productWithStore,
    discount_percentage,
    offer_title
  })
}

// Cached version of getProduct (revalidates every 120 seconds)
export async function getProduct(id: string) {
  return unstable_cache(
    () => _getProductImpl(id),
    ["product", id],
    { revalidate: 120, tags: ["products", `product-${id}`] }
  )()
}

// إسقاط عام للمنتج قبل إرساله لأي عميل: يحذف الحقول الداخلية الحسّاسة (سعر الشراء والربح)
// ويضيف storeName الموحّد. يمنع كشف هامش الربح لأي زائر عبر DevTools/حمولة RSC.
function publicProductPayload(obj: Record<string, unknown>) {
  const out = { ...obj }
  delete out.cost_price
  delete out.profit_per_unit
  if (out.storeName === undefined) {
    const stores = out.stores as { name?: string } | null | undefined
    out.storeName = stores?.name ?? null
  }
  return serializeData(out)
}

// جالب منتج واحد للمالك فقط (يشمل التكلفة/الربح) — لنموذج تعديل المنتج. غير المالك يُرجَع null.
export async function getOwnedProduct(id: string) {
  const db = getAdminDb()
  const snap = await db.collection("products").doc(id).get()
  if (!snap.exists) return null
  const data = snap.data() as ProductRecord
  const uid = await getCurrentUid()
  if (!uid || data.store_id !== uid) return null
  return serializeData({ id: snap.id, ...data })
}

// تسعير حالي (سيرفر-سايد) لمنتجات العربة قبل الدفع — لمواءمة الإجمالي المعروض مع ما سيُحاسَب فعلًا
// (العربة تحفظ لقطة سعر/خصم قد تتقادم). يُرجع السعر ونسبة الخصم الحاليّين لكل معرّف فقط.
export async function getCartPricing(
  productIds: string[],
): Promise<Record<string, { price: number; discount_percentage: number }>> {
  const ids = Array.from(new Set((productIds || []).filter((id) => typeof id === "string" && id))).slice(0, 100)
  if (!ids.length) return {}
  const db = getAdminDb()
  const snaps = await Promise.all(ids.map((id) => db.collection("products").doc(id).get()))
  const products: Array<{ id: string; data: ProductRecord }> = []
  const storeIds = new Set<string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data() as ProductRecord
    products.push({ id: snap.id, data })
    if (typeof data.store_id === "string") storeIds.add(data.store_id)
  }
  const storeIdList = Array.from(storeIds)
  // المتاجر المحظورة صراحةً (is_approved === false): منتجاتها غير متاحة — نتركها خارج النتيجة
  // فتعاملها العربة كغير متوفرة (mirror getStores). المتاجر بلا الحقل تبقى متاحة.
  const bannedStores = new Set<string>()
  if (storeIdList.length) {
    const storeSnaps = await db.getAll(...storeIdList.map((sid) => db.collection("users").doc(sid)))
    storeSnaps.forEach((s) => {
      const st = (s.data() as { store?: { is_approved?: boolean } } | undefined)?.store
      if (st?.is_approved === false) bannedStores.add(s.id)
    })
  }
  const activeOffers = await getActiveOffersForStores(storeIdList)
  const result: Record<string, { price: number; discount_percentage: number }> = {}
  for (const { id, data } of products) {
    if (typeof data.store_id === "string" && bannedStores.has(data.store_id)) continue
    const { discount_percentage } = findBestDiscountShared(
      { id, category: data.category, store_id: data.store_id },
      activeOffers,
    )
    result[id] = { price: Number(data.price) || 0, discount_percentage }
  }
  return result
}

export async function createProduct(formData: {
  name: string
  description: string
  price: number
  cost_price: number
  category: string
  stock: number
  image_url?: string
  store_id: string
  barcode?: string
  expiry_date?: string | null
  simulator_section?: string | null
  reservation_enabled?: boolean
}, callerUserId?: string) {
  try {
    const db = getAdminDb()

    // التحقق من الهوية سيرفر-سايد: المستدعي يجب أن يملك المتجر المستهدف (لا نثق بالعميل)
    const uid = await getCurrentUid()
    if (!uid || uid !== formData.store_id) {
      return {
        success: false,
        error: PRODUCT_ERROR_CODES.UNAUTHORIZED_STORE_PRODUCT_CREATE,
      }
    }

    // التحقق من صحة السعر والكمية على السيرفر
    if (!Number.isFinite(formData.price) || formData.price <= 0) {
      return { success: false, error: PRODUCT_ERROR_CODES.PRICE_MUST_BE_POSITIVE }
    }
    if (!Number.isFinite(formData.cost_price) || formData.cost_price <= 0) {
      return { success: false, error: PRODUCT_ERROR_CODES.COST_PRICE_MUST_BE_POSITIVE }
    }
    if (formData.price < formData.cost_price) {
      return { success: false, error: PRODUCT_ERROR_CODES.SELLING_PRICE_BELOW_COST }
    }
    // السماح بـ stock = 0 عند تفعيل الحجز المسبق
    if (!Number.isFinite(formData.stock) || formData.stock < 0) {
      return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
    }
    if (formData.stock === 0 && !formData.reservation_enabled) {
      return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
    }

    // التحقق من اعتماد المتجر قبل إنشاء المنتج — فشل مغلق: لا منتج بدون متجر معتمد مؤكد.
    // (سابقًا كان يتخطّى البوابة تمامًا إن لم يوجد مستند المستخدم = فشل مفتوح.)
    const userDoc = await db.collection("users").doc(formData.store_id).get()
    const storeData = userDoc.exists ? userDoc.data()?.store : undefined
    if (!storeData?.is_approved) {
      return { success: false, error: PRODUCT_ERROR_CODES.STORE_NOT_APPROVED }
    }

    const docRef = db.collection("products").doc()
    const now = new Date().toISOString()

    const payload = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      cost_price: formData.cost_price,
      profit_per_unit: calculateProfitPerUnit(formData.price, formData.cost_price),
      category: formData.category,
      stock: formData.stock,
      image_url: formData.image_url || "",
      store_id: formData.store_id,
      barcode: formData.barcode || "",
      expiry_date: formData.expiry_date || null,
      simulator_section: formData.simulator_section || null,
      reservation_enabled: formData.reservation_enabled || false,
      rating: 0,
      rating_count: 0,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(payload)

    revalidatePath("/seller/products", "page")
    revalidateTag("products", "max")
    return { success: true, data: { id: docRef.id, ...payload } }
  } catch (error: unknown) {
    return { success: false, error: PRODUCT_ERROR_CODES.CREATE_PRODUCT_UNEXPECTED_ERROR }
  }
}

export async function updateProduct(
  id: string,
  formData: Partial<{
    name: string
    description: string
    price: number
    cost_price: number
    category: string
    stock: number
    image_url: string
    rating: number
    simulator_section?: string | null
    barcode?: string
    expiry_date?: string | null
    reservation_enabled?: boolean
  }>,
  callerUserId?: string,
) {
  const db = getAdminDb()
  const productSnap = await db.collection("products").doc(id).get()
  if (!productSnap.exists) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND }
  }

  const existingProduct = productSnap.data() as ProductRecord | undefined

  // التحقق من الملكية سيرفر-سايد (إجباري)
  const uid = await getCurrentUid()
  if (!uid || existingProduct?.store_id !== uid) {
    return { success: false, error: PRODUCT_ERROR_CODES.UNAUTHORIZED_PRODUCT_ACCESS }
  }

  if (formData.price !== undefined && (!Number.isFinite(formData.price) || formData.price <= 0)) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRICE_MUST_BE_POSITIVE }
  }
  if (formData.cost_price !== undefined && (!Number.isFinite(formData.cost_price) || formData.cost_price <= 0)) {
    return { success: false, error: PRODUCT_ERROR_CODES.COST_PRICE_MUST_BE_POSITIVE }
  }
  if (formData.stock !== undefined && (!Number.isFinite(formData.stock) || formData.stock < 0)) {
    return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
  }
  // السماح بـ stock = 0 عند تفعيل الحجز المسبق
  if (formData.stock === 0 && !formData.reservation_enabled && !existingProduct?.reservation_enabled) {
    return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
  }

  const existingPrice = Number(existingProduct?.price)
  const existingCostPrice = Number(existingProduct?.cost_price ?? existingProduct?.price)
  const effectivePrice = formData.price ?? existingPrice
  const effectiveCostPrice = formData.cost_price ?? existingCostPrice

  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRICE_MUST_BE_POSITIVE }
  }
  if (!Number.isFinite(effectiveCostPrice) || effectiveCostPrice <= 0) {
    return { success: false, error: PRODUCT_ERROR_CODES.COST_PRICE_MUST_BE_POSITIVE }
  }
  if (effectivePrice < effectiveCostPrice) {
    return { success: false, error: PRODUCT_ERROR_CODES.SELLING_PRICE_BELOW_COST }
  }

  const docRef = db.collection("products").doc(id)

  // قائمة سماح صريحة للحقول القابلة للتعديل — نمنع mass-assignment.
  // (سابقًا كان يُنشر formData كله، فيقدر البائع يزوّر rating لمنتجه.)
  const ALLOWED_FIELDS = [
    "name",
    "description",
    "price",
    "cost_price",
    "category",
    "stock",
    "image_url",
    "simulator_section",
    "barcode",
    "expiry_date",
    "reservation_enabled",
  ] as const
  const sanitized: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (formData[key] !== undefined) sanitized[key] = formData[key]
  }

  const updateData = cleanUndefined({
    ...sanitized,
    profit_per_unit: calculateProfitPerUnit(effectivePrice, effectiveCostPrice),
    updated_at: new Date().toISOString(),
  })

  try {
    await docRef.set(updateData, { merge: true })
  } catch (error: unknown) {
    return { success: false, error: PRODUCT_ERROR_CODES.UPDATE_PRODUCT_FAILED }
  }

  const updatedSnap = await docRef.get()
  if (!updatedSnap.exists) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND }
  }

  revalidatePath("/seller/products", "page")
  revalidatePath(`/product/${id}`, "page")
  revalidateTag("products", "max")
  revalidateTag(`product-${id}`, "max")
  return { success: true, data: mapProduct(updatedSnap) }
}

export async function deleteProduct(id: string, callerUserId?: string) {
  const db = getAdminDb()

  // التحقق من ملكية المنتج سيرفر-سايد (إجباري)
  const uid = await getCurrentUid()
  if (!uid) {
    return { success: false, error: PRODUCT_ERROR_CODES.UNAUTHORIZED_PRODUCT_ACCESS }
  }
  const productSnap = await db.collection("products").doc(id).get()
  if (!productSnap.exists) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND }
  }
  if (productSnap.data()?.store_id !== uid) {
    return { success: false, error: PRODUCT_ERROR_CODES.UNAUTHORIZED_PRODUCT_ACCESS }
  }

  try {
    await db.collection("products").doc(id).delete()
  } catch (error: unknown) {
    return { success: false, error: PRODUCT_ERROR_CODES.DELETE_PRODUCT_FAILED }
  }

  revalidatePath("/seller/products", "page")
  revalidateTag("products", "max")
  return { success: true }
}

export async function getProductsByStoreId(storeId: string) {
  const db = getAdminDb()
  // هل المستدعي هو مالك المتجر؟ غير المالك لا يجب أن يرى تكلفة/ربح المنتج.
  const isOwner = await requireOwner(storeId)

  // متجر محظور صراحةً (is_approved === false): نخفي منتجاته عن العامة (mirror getStores) لكن المالك
  // يظل يرى/يدير منتجاته. المتاجر بلا الحقل (قيد المراجعة/قديمة) تبقى ظاهرة.
  if (!isOwner) {
    const storeUserSnap = await db.collection("users").doc(storeId).get()
    if ((storeUserSnap.data() as { store?: { is_approved?: boolean } } | undefined)?.store?.is_approved === false) {
      return serializeData([])
    }
  }

  const snapshot = await db.collection("products").where("store_id", "==", storeId).get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => {
    const data = doc.data() as ProductRecord
    if (!isOwner) {
      delete (data as Record<string, unknown>).cost_price
      delete (data as Record<string, unknown>).profit_per_unit
    }
    return { id: doc.id, ...data }
  })

  // Fetch this store's offers WITH their doc id, and delegate to the shared findBestDiscount so the
  // store page uses the SAME activeness rules as checkout (Cairo tz + flash-hour window + quantity cap).
  // سابقًا كان الحساب هنا بيوم UTC بلا نافذة فلاش ولا حد كمية، فيختلف السعر المعروض عمّا يُحاسَب فعلًا.
  const offersSnapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const activeOffers = offersSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as OfferRecord) }))

  const enriched = products.map((product) => {
    const p = product as ProductRecord & { id: string }
    const { discount_percentage, offer_title } = findBestDiscountShared(
      { id: p.id, category: p.category, store_id: p.store_id },
      activeOffers,
    )
    return {
      ...product,
      discount_percentage,
      offer_title,
    }
  })

  enriched.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
  return serializeData(enriched)
}

// ==================== الأكثر مبيعًا داخل المتجر (قسم عام على صفحة المتجر) ====================

const TOP_SELLERS_POS_SCAN = 500 // سقف فواتير الكاشير المقروءة لكل حساب
const TOP_SELLERS_ORDERS_SCAN = 150 // سقف طلبات التوصيل المقروءة لكل حساب
// نافذة الاحتساب وعدد الأصناف ثابتان عمدًا — ليسا وسيطين من المستدعي: هذه الدالة نقطة عامة،
// وأي قيمة يتحكّم بها المتصل تدخل مفتاح الذاكرة المؤقتة فتصنع آلاف المفاتيح لنفس المتجر، كل
// واحد منها إخفاق يقرأ مئات المستندات (مضخّم قراءات على قاعدة إنتاج بالخطة المجانية).
const TOP_SELLERS_WINDOW_DAYS = 60
const TOP_SELLERS_LIMIT = 12

// ترتيب أصناف المتجر بالكمية المُباعة. يُرجع **معرّفات مرتَّبة فقط** بلا كميات ولا مستندات منتجات:
// (أ) الصفحة تملك المنتجات أصلًا وتربطها محليًّا، (ب) عناصر pos_sales تحمل cost_price/profit_per_unit
// فإرجاعها خامًا كان سيكشف هامش ربح التاجر، (ج) هذه الدالة نقطة عامة تُستدعى بأي معرّف متجر —
// إرجاع الكميات كان سيسلّم منافسًا حجم مبيعات كل صنف عند أي تاجر.
//
// المصدران: فواتير الكاشير (pos_sales — استعلام واحد، العناصر مضمَّنة) وطلبات التوصيل
// (orders + order_items). لا نلمس أي مسار كتابة (لا عدّاد مبيعات على مستند المنتج) — قراءة فقط.
// قصور معروف (v1): الطلبات متعددة المتاجر لا تُحتسب — تمييزها يحتاج
// (store_ids array-contains + نافذة تاريخ) وهو فهرس مركّب غير منشور.
async function _getStoreTopSellersImpl(storeId: string): Promise<string[]> {
  const db = getAdminDb()

  // خروج مبكّر قبل أي استعلام: المعرّف يأتي من المستدعي (نقطة عامة)، ومعرّف وهمي كان يمضي إلى
  // استعلامَي pos_sales/orders فيكلّف قراءات على كل معرّف مختلَق — مضخّم قراءات رخيص على قاعدة
  // بالخطة المجانية. الآن معرّف غير موجود أو ليس بائعًا = قراءة واحدة ثم انتهاء.
  // ويشمل ذلك مرآة حظر المتجر (نفس قاعدة getProductsByStoreId/getStores).
  const storeUserSnap = await db.collection("users").doc(storeId).get()
  const storeUser = storeUserSnap.data() as { role?: string; store?: { is_approved?: boolean } } | undefined
  if (!storeUserSnap.exists || storeUser?.role !== "seller" || storeUser?.store?.is_approved === false) {
    return []
  }

  const cutoff = new Date(Date.now() - TOP_SELLERS_WINDOW_DAYS * 24 * 3600 * 1000).toISOString()
  const qtyByProduct = new Map<string, number>()
  const addQty = (productId: unknown, quantity: unknown) => {
    const id = typeof productId === "string" ? productId : ""
    const qty = Number(quantity) || 0
    if (!id || qty <= 0) return
    qtyByProduct.set(id, (qtyByProduct.get(id) || 0) + qty)
  }

  // أحدث مستندات متجر من مجموعة، بسقف صارم. الشكل المفضَّل (مساواة + ترتيب تنازلي بالتاريخ)
  // يطابق الفهارس المركّبة المعلَنة (orders/pos_sales: store_id + created_at)، ويقرأ الأحدث فقط
  // بدل شريحة عشوائية. إن رُفض (اتجاه فهرس مختلف) نسقط لمساواة مفردة ونفلتر في الذاكرة —
  // نفس احتياطي getMerchantToday في dashboard.ts. الفشل هنا يُخفي القسم ولا يكسر الصفحة.
  const recentByStore = async (collection: string, cap: number) => {
    const base = db.collection(collection).where("store_id", "==", storeId)
    try {
      return (await base.orderBy("created_at", "desc").limit(cap).get()).docs
    } catch (err) {
      // نُسجّل الهبوط للمسار المتدهور: بلا ذلك يصير الترتيب التقريبي دائمًا وصامتًا
      // (التجميع مخزَّن 6 ساعات فالتسجيل لا يتكرّر أكثر من ~4 مرات يوميًّا لكل متجر)
      logError(`[getStoreTopSellers] ${collection} orderBy fallback`, err)
      try {
        // اتجاه الفهرس المعلَن تصاعدي: نستبدل الترتيب التنازلي بنافذة زمنية يخدمها نفس الفهرس
        return (await base.where("created_at", ">=", cutoff).limit(cap).get()).docs
      } catch {
        return (await base.limit(cap).get()).docs
      }
    }
  }

  // ── الكاشير (pos_sales) ──
  const posDocs = await recentByStore("pos_sales", TOP_SELLERS_POS_SCAN)
  for (const doc of posDocs) {
    const sale = doc.data() as Record<string, any>
    if (String(sale.created_at || "") < cutoff) continue
    // الكمية بوحدة البيع كما سجّلها الكاشير (قطعة/شريط/علبة) — ترتيب تقريبي مثل لوحة التاجر.
    for (const item of Array.isArray(sale.items) ? sale.items : []) addQty(item?.product_id, item?.quantity)
  }

  // ── التوصيل (orders + order_items) ──
  const orderDocs = await recentByStore("orders", TOP_SELLERS_ORDERS_SCAN)
  const countedOrderIds = orderDocs
    .filter((doc) => {
      const o = doc.data() as Record<string, any>
      if (String(o.created_at || "") < cutoff) return false
      if (o.status === "cancelled") return false
      // الاستفسارات (واتساب/اتصال) طلبات شكلية بلا أصناف مُباعة — لا تُحتسب مبيعًا
      return !(o.order_type === "inquiry" || o.status === "inquiry")
    })
    .map((doc) => doc.id)

  for (const chunk of chunkArray(countedOrderIds, 10)) {
    if (!chunk.length) continue
    const snap = await db.collection("order_items").where("order_id", "in", chunk).get()
    snap.docs.forEach((doc) => {
      const it = doc.data() as Record<string, any>
      addQty(it?.product_id, it?.quantity)
    })
  }

  return Array.from(qtyByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SELLERS_LIMIT)
    .map(([productId]) => productId)
}

/**
 * معرّفات أكثر أصناف المتجر مبيعًا، مرتَّبة تنازليًّا — للعرض العام على صفحة المتجر.
 * مخزَّن 6 ساعات بوسم خاص به: وسم "products" يُبطَل مع كل مزامنة مخزون يومية (import.ts)
 * فكان التجميع يُعاد حسابه مع كل مزامنة بلا داعٍ — والإشارة نفسها بطيئة التغيّر.
 */
export async function getStoreTopSellers(storeId: string): Promise<string[]> {
  if (typeof storeId !== "string" || !storeId) return []
  // حدّ معدل على المدخل العام: الكاش يحمي تكرار نفس المعرّف، لكنه لا يحمي من *تدوير* المعرّفات
  // (كل معرّف جديد = مفتاح كاش جديد = إخفاق). فشل الحدّ يُخفي القسم فقط ولا يكسر الصفحة.
  if (!(await checkRateLimit("store_top_sellers", 60, 60_000))) return []
  return unstable_cache(
    () => _getStoreTopSellersImpl(storeId),
    ["store-top-sellers", storeId],
    { revalidate: 21600, tags: [`store-top-sellers-${storeId}`] },
  )()
}

async function _searchProductsImpl(normalizedQuery: string) {
  const products = await getProducts()

  if (!normalizedQuery) {
    return products
  }

  return products.filter((product: ProductRecord) => {
    const name = (product.name || "").toLowerCase()
    const description = (product.description || "").toLowerCase()
    const storeName = (product.stores?.name || "").toLowerCase()
    return name.includes(normalizedQuery) || description.includes(normalizedQuery) || storeName.includes(normalizedQuery)
  })
}

// Search reuses cached getProducts() and additionally caches each normalized
// query result for 60 seconds. This is still in-memory filtering and not
// full-text search; move to Algolia/Typesense (or indexed search fields) at scale.
export async function searchProducts(query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  return unstable_cache(
    () => _searchProductsImpl(normalizedQuery),
    ["products-search", normalizedQuery || "all"],
    { revalidate: 60, tags: ["products"] },
  )()
}

export async function getRelatedProducts(productId: string, category: string, limit = 4) {
  const db = getAdminDb()
  const queryLimit = Math.max(1, limit + 1)
  const snapshot = await db
    .collection("products")
    .where("category", "==", category)
    .limit(queryLimit)
    .get()
  const products = snapshot.docs.map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))

  const filtered = products
    .filter((product: ProductRecord & { id: string }) => product.id !== productId)
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product: ProductRecord) => product.store_id).filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  // إسقاط منتجات المتاجر المحظورة صراحةً (is_approved === false) — mirror getStores !== false
  const visible = filtered.filter((product: ProductRecord & { id: string }) => {
    const store = product.store_id ? storeMap.get(product.store_id) : undefined
    return !(store && store.is_approved === false)
  })

  return serializeData(visible.map((product: ProductRecord & { id: string }) => attachStore(product, storeMap)))
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
    filtered.map((product: ProductRecord) => product.store_id).filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  // Fetch active offers for these products
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers").where("store_id", "==", storeId).get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data()).filter(offer =>
    offer.start_date <= today && offer.end_date >= today
  )

  return serializeData(filtered
    // إسقاط منتجات المتاجر المحظورة صراحةً (is_approved === false) — mirror getStores !== false
    .filter((product: ProductRecord & { id: string }) => {
      const store = product.store_id ? storeMap.get(product.store_id) : undefined
      return !(store && store.is_approved === false)
    })
    .map((product: ProductRecord & { id: string }) => {
      const productWithStore = attachStore(product, storeMap)
      const { discount_percentage } = findBestDiscount(product, activeOffers, today)
      return {
        ...productWithStore,
        discount_percentage
      }
    }))
}

// Get products from other stores (excluding current product and current store)
export async function getProductsFromOtherStores(productId: string, storeId: string, limit = 4) {
  const db = getAdminDb()
  // Only fetch a limited number of products from other stores instead of ALL products
  const snapshot = await db.collection("products")
    .where("store_id", "!=", storeId)
    .limit(limit * 3) // fetch a bit more to allow filtering
    .get()
  const products = snapshot.docs
    .map((doc: DocumentSnapshot) => ({ id: doc.id, ...(doc.data() as ProductRecord) }))
    .filter((p: ProductRecord & { id: string }) => p.id !== productId)

  const filtered = products
    .sort((a: ProductRecord, b: ProductRecord) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, limit)

  const storeMap = await getStoreMap(
    db,
    filtered.map((product: ProductRecord) => product.store_id).filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  // Fetch only active offers (not all offers)
  const today = new Date().toISOString().split('T')[0]
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", today)
    .get()
  const activeOffers = offersSnapshot.docs.map(doc => doc.data()).filter(offer =>
    offer.start_date <= today && offer.end_date >= today
  )

  return serializeData(filtered
    // إسقاط منتجات المتاجر المحظورة صراحةً (is_approved === false) — mirror getStores !== false
    .filter((product: ProductRecord & { id: string }) => {
      const store = product.store_id ? storeMap.get(product.store_id) : undefined
      return !(store && store.is_approved === false)
    })
    .map((product: ProductRecord & { id: string }) => {
      const productWithStore = attachStore(product, storeMap)
      const { discount_percentage } = findBestDiscount(product, activeOffers, today)
      return {
        ...productWithStore,
        discount_percentage
      }
    }))
}

// زيادة/نقص المخزون ذرّيًا بمقدار delta — يمنع سباق "لقطة قديمة" حين يكتب البائع قيمة مطلقة
// محسوبة على العميل فوق خصومات طلبات متزامنة (FieldValue.increment). للمالك فقط.
export async function incrementProductStock(id: string, delta: number) {
  const db = getAdminDb()
  const productSnap = await db.collection("products").doc(id).get()
  if (!productSnap.exists) {
    return { success: false, error: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND }
  }
  const existing = productSnap.data() as ProductRecord | undefined
  const uid = await getCurrentUid()
  if (!uid || existing?.store_id !== uid) {
    return { success: false, error: PRODUCT_ERROR_CODES.UNAUTHORIZED_PRODUCT_ACCESS }
  }
  // أكشن إضافة كمية فقط — نرفض صفر أو سالب حتى لا يُدفع المخزون للسالب عبر delta سالب.
  const inc = Math.trunc(Number(delta))
  if (!Number.isFinite(inc) || inc <= 0) {
    return { success: false, error: PRODUCT_ERROR_CODES.STOCK_MUST_BE_POSITIVE }
  }
  const docRef = db.collection("products").doc(id)
  const now = new Date().toISOString()
  try {
    await docRef.update({ stock: FieldValue.increment(inc), updated_at: now })
  } catch (error: unknown) {
    return { success: false, error: PRODUCT_ERROR_CODES.UPDATE_PRODUCT_FAILED }
  }
  revalidatePath("/seller/products", "page")
  revalidateTag("products", "max")
  const fresh = await docRef.get()
  return { success: true, data: serializeData({ id, ...(fresh.data() as ProductRecord) }) }
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

export async function uploadProductImage(formData: FormData) {
  try {
    const file = formData.get("file") as File
    const storeId = formData.get("storeId") as string

    if (!file || !storeId) {
      return { success: false, error: PRODUCT_ERROR_CODES.MISSING_FILE_OR_STORE_ID }
    }

    // التحقق من الهوية والملكية سيرفر-سايد — نشتق uid من الجلسة ولا نثق بـ callerId القادم من العميل.
    // (سابقًا كان الحارس callerId && callerId !== storeId يُتخطّى بمجرد حذف callerId.)
    const uid = await getCurrentUid()
    if (!uid || uid !== storeId) {
      return { success: false, error: PRODUCT_ERROR_CODES.UNAUTHORIZED_IMAGE_UPLOAD }
    }

    // التحقق من نوع الملف
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { success: false, error: PRODUCT_ERROR_CODES.UNSUPPORTED_IMAGE_TYPE }
    }

    // التحقق من حجم الملف
    if (file.size > MAX_IMAGE_SIZE) {
      return { success: false, error: PRODUCT_ERROR_CODES.IMAGE_TOO_LARGE }
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `products/${storeId}/${fileName}`

    // Convert File to Buffer for reliable server-side upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const key = await putObject(PUBLIC_BUCKET, filePath, buffer, file.type)

    // نُعيد **المسار** لا رابطًا مطلقًا: الرابط يُركَّب وقت العرض عبر storageUrl من قاعدة
    // واحدة، فلا يُحفَر اسم مزوّد التخزين داخل البيانات ولا يحتاج تغييره ترحيلًا لاحقًا.
    return { success: true, url: key }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Image upload internal error:", msg)
    return { success: false, error: PRODUCT_ERROR_CODES.IMAGE_UPLOAD_INTERNAL_ERROR, detail: msg }
  }
}
