"use server"

import type { DocumentSnapshot, Query } from "firebase-admin/firestore"
import { revalidatePath, revalidateTag } from "next/cache"
import { unstable_cache } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { putObject, presignGet, PUBLIC_BUCKET, PRIVATE_BUCKET } from "../storage/r2"
import { isKycKey } from "../storage/kyc-key"
import { serializeData } from "../firebase/firestore-helpers"
import { logError } from "../logger"
import { checkRateLimit } from "../utils/rate-limit"
import { matchesSearch, normalizeArabic, searchTokens } from "../utils/arabic"
import { hasValidConsent, isPharmacyCategory, PHARMACY_CONSENT_VERSION, type PharmacyConsent } from "../ai/pharmacy-consent"

export type StoreRecord = {
  seller_id: string
  name?: string
  description?: string
  address?: string
  phone?: string
  category?: string
  category_id?: string
  latitude?: number | null
  longitude?: number | null
  whatsapp_number?: string
  support_email?: string
  owner_id_number?: string
  id_card_image_url?: string | null
  id_card_image_back_url?: string | null
  commercial_register_image_url?: string | null
  tax_card_image_url?: string | null
  tax_card_image_back_url?: string | null
  image_url?: string
  open_time?: string
  close_time?: string
  working_days?: string
  return_policy?: string
  // شحن مجاني: التاجر يتحمّل أجرة التوصيل بدل العميل. cap = سقف ما يتحمّله لكل طلب (0/غياب = يتحمّل الكل).
  free_shipping?: boolean
  free_shipping_cap?: number | null
  // بروفايل استيراد الكاشير (يُكتب سيرفر-سايد من import.ts فقط، لا عبر updateStore) — لتفعيل «المزامنة اليومية».
  import_profile?: { mapping?: Record<string, number>; default_category?: string; updated_at?: string }
  is_approved?: boolean
  rating?: number
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

type EmbeddedStoreRecord = Omit<StoreRecord, "seller_id">

export type Store = StoreRecord & { id: string }

type ActiveOffer = {
  store_id?: string
  start_date?: string
  end_date?: string
  discount_percentage?: number
  title?: string
}

type StoreWithActiveOffer = Store & {
  activeOffer: {
    discount_percentage?: number
    title?: string
  } | null
}

export type StoreCreateInput = {
  seller_id: string
  name: string
  address: string
  phone: string
  category: string
  category_id?: string
  description?: string
  latitude?: number
  longitude?: number
  whatsapp_number?: string
  support_email?: string
  owner_id_number?: string
  id_card_image_url?: string
  id_card_image_back_url?: string
  commercial_register_image_url?: string
  tax_card_image_url?: string
  tax_card_image_back_url?: string
  image_url?: string
  open_time?: string
  close_time?: string
  working_days?: string
  return_policy?: string
}

export type StoreUpdateInput = {
  name: string
  description: string
  address: string
  phone: string
  image_url: string
  category: string
  open_time: string
  close_time: string
  working_days: string
  support_email: string
  whatsapp_number: string
  return_policy: string
  rating: number
  latitude: number
  longitude: number
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

// مستندات KYC تُخزَّن في bucket خاص (kyc-documents) كمسارات. تُقدَّم عبر signed URLs
// قصيرة العمر للمالك/الأدمن فقط. القيم القديمة (روابط http عامة) تُمرَّر كما هي.
// غير مُصدَّر: ملف "use server" لا يُصدّر إلا دوال async (Next.js)
const KYC_FIELDS = [
  "id_card_image_url",
  "id_card_image_back_url",
  "commercial_register_image_url",
  "tax_card_image_url",
  "tax_card_image_back_url",
] as const

export async function signKycFields<T extends Record<string, unknown>>(store: T): Promise<T> {
  for (const f of KYC_FIELDS) {
    const v = store[f]
    if (typeof v !== "string" || !v) continue
    // القيم القديمة (روابط http عامة) تُمرَّر كما هي دون توقيع.
    if (v.startsWith("http")) continue
    // لا نوقّع إلا ما يشبه مفتاح مستند KYC صحيح الشكل. قبل هذا كان يُوقَّع أي مسار غير-http،
    // فتتحوّل الدالة إلى أوراكل توقيع لأي كائن في الـbucket الخاص. isKycKey يقصرها على
    // مستندات KYC (شكلًا)، ويمنع الاجتياز وتوجيه الحقل إلى كائن آخر. مفتاح غير مطابق
    // يُترك كما هو ولا يُوقَّع — العميل لا يستطيع جلبه من bucket خاص، فلا تسريب.
    if (!isKycKey(v)) {
      logError(`[stores] signKycFields refused a non-KYC-shaped key in ${f}`, new Error(String(v).slice(0, 120)))
      continue
    }
    try {
      ;(store as Record<string, unknown>)[f] = await presignGet(PRIVATE_BUCKET, v, 300)
    } catch (error) {
      // الفشل هنا كان يمسح الحقل بصمت (data?.signedUrl || null)، فيختفي المستند من واجهة
      // المراجعة كأنه غير مرفوع أصلًا. نُبقي القيمة ونُسجّل: صورة لا تُحمَّل أوضح من لا شيء.
      logError(`[stores] signKycFields presign failed for ${f}`, error)
    }
  }
  return store
}

/**
 * Fetch the current category name from the categories collection by ID.
 * This ensures we always use the latest name even if admin renames it.
 */
export async function getCategoryNameById(categoryId: string): Promise<string | null> {
  if (!categoryId) return null
  try {
    const db = getAdminDb()
    const doc = await db.collection("categories").doc(categoryId).get()
    if (!doc.exists) return null
    return (doc.data()?.name as string) || null
  } catch {
    return null
  }
}

function normalizeStoreName(name: string) {
  return name.trim().toLowerCase()
}

// Helper to extract store from user document
// Store ID is now the same as User ID (seller_id)
function extractStore(doc: DocumentSnapshot): Store | null {
  if (!doc.exists) {
    console.log(`[debug] Document ${doc.id} does not exist`);
    return null;
  }
  const data = doc.data() as any

  // Requirement: Role must be seller
  if (data?.role !== "seller") {
    console.log(`[debug] User ${doc.id} has role ${data?.role}, not seller`);
    return null;
  }

  const storeData = data?.store || {}

  // Fallbacks for fields that might be at the root
  const name = storeData.name || data?.full_name || "متجر غير معروف"
  const phone = storeData.phone || data?.phone || ""
  // Combine city and street for address if direct address is missing
  const cityStreetAddress = [data?.city, data?.street].filter(Boolean).join(", ")
  const address = storeData.address || cityStreetAddress || ""
  const description = storeData.description || ""

  // قائمة سماح بالحقول العامة فقط — نمنع تسريب بيانات KYC الحسّاسة للبائع
  // (الرقم القومي owner_id_number وروابط صور البطاقة/السجل التجاري/البطاقة الضريبية)
  // لأي زائر عبر server actions العامة (getStore/getStores تُستهلك في صفحات عامة).
  return serializeData({
    id: doc.id, // Store ID = User ID
    seller_id: doc.id,
    name,
    phone,
    address,
    description,
    category: storeData.category,
    category_id: storeData.category_id,
    latitude: storeData.latitude ?? null,
    longitude: storeData.longitude ?? null,
    whatsapp_number: storeData.whatsapp_number,
    support_email: storeData.support_email,
    image_url: storeData.image_url,
    open_time: storeData.open_time,
    close_time: storeData.close_time,
    working_days: storeData.working_days,
    return_policy: storeData.return_policy,
    is_approved: storeData.is_approved,
    rating: storeData.rating,
    created_at: storeData.created_at,
    updated_at: storeData.updated_at,
  }) as Store;
}

// نسخة خاصة بالمالك تشمل حقول KYC — تُستخدم فقط في لوحة البائع بعد التحقق من الجلسة.
function extractStoreForOwner(doc: DocumentSnapshot): Store | null {
  const base = extractStore(doc)
  if (!base) return null
  const storeData = (doc.data() as any)?.store || {}
  return serializeData({
    ...base,
    owner_id_number: storeData.owner_id_number,
    id_card_image_url: storeData.id_card_image_url ?? null,
    id_card_image_back_url: storeData.id_card_image_back_url ?? null,
    commercial_register_image_url: storeData.commercial_register_image_url ?? null,
    tax_card_image_url: storeData.tax_card_image_url ?? null,
    tax_card_image_back_url: storeData.tax_card_image_back_url ?? null,
  }) as Store
}

// Internal implementation
async function _getStoresImpl(category?: string) {
  const db = getAdminDb()

  // Query users who are sellers and have store data
  let query: Query = db.collection("users").where("role", "==", "seller")

  const snapshot = await query.get()

  // Extract stores from user documents.
  // إخفاء المتاجر المرفوضة صراحةً (is_approved === false) فقط — نُبقي المتاجر الحالية/قيد
  // المراجعة (بدون الحقل) ظاهرة حتى لا يفرغ الموقع. للانتقال لـ"المعتمد فقط" لاحقًا:
  // نعتمد المتاجر الحالية ثم نبدّل الشرط إلى === true.
  let stores: Store[] = snapshot.docs
    .filter((doc) => {
      // إخفاء المتجر المرفوض صراحةً (store.is_approved === false) أو المالك المحظور (disabled === true
      // على جذر مستند المستخدم). القيم الأخرى (undefined/false للحظر) تظهر كالمعتاد.
      const data = doc.data() as { store?: { is_approved?: boolean }; disabled?: boolean }
      return data?.store?.is_approved !== false && data?.disabled !== true
    })
    .map((doc) => extractStore(doc))
    .filter((store): store is Store => store !== null)

  // Filter by category if provided
  if (category) {
    stores = stores.filter((store) => store.category === category)
  }

  stores.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))

  // Fetch active offers to show on store cards
  const now = new Date().toISOString()
  const offersSnapshot = await db.collection("offers")
    .where("end_date", ">=", now.split('T')[0])
    .get()

  const activeOffers: ActiveOffer[] = offersSnapshot.docs.map((doc) => doc.data() as ActiveOffer)
  const today = new Date().toISOString().split('T')[0]

  return stores.map((store) => {
    const storeOffer = activeOffers.find((offer) =>
      offer.store_id === store.id &&
      // شارة "عرض خاص" على بطاقة المتجر فقط للعروض على مستوى المتجر (لا عرض منتج/فئة واحدة)
      !(offer as { product_id?: string }).product_id &&
      !(offer as { category?: string }).category &&
      (offer.start_date || "") <= today &&
      (offer.end_date || "") >= today
    )
    return serializeData({
      ...store,
      activeOffer: storeOffer ? {
        discount_percentage: storeOffer.discount_percentage,
        title: storeOffer.title
      } : null
    }) as StoreWithActiveOffer
  })
}

// Check if a store name already exists in the database
export async function checkStoreNameExists(storeName: string): Promise<boolean> {
  const db = getAdminDb()
  const normalizedName = normalizeStoreName(storeName)

  if (!normalizedName) {
    return false
  }

  const snapshot = await db.collection("users").where("store_name_lower", "==", normalizedName).limit(1).get()

  return !snapshot.empty
}

// Cached version of getStores (revalidates every 120 seconds)
export async function getStores(category?: string) {
  return unstable_cache(
    () => _getStoresImpl(category),
    ["stores", category || "all"],
    { revalidate: 120, tags: ["stores"] }
  )()
}

// Internal getStore implementation
async function _getStoreImpl(id: string) {
  const db = getAdminDb()
  // Store ID is now User ID
  const docSnap = await db.collection("users").doc(id).get()

  if (!docSnap.exists) {
    return null
  }

  const store = extractStore(docSnap)
  if (!store) {
    return null
  }

  // إخفاء المتجر المرفوض صراحةً أو المالك المحظور (disabled === true على جذر مستند المستخدم)
  // من العرض العام (المالك يرى متجره عبر getStoreByUserId)
  const rootData = docSnap.data() as { store?: { is_approved?: boolean }; disabled?: boolean }
  if (rootData?.store?.is_approved === false || rootData?.disabled === true) {
    return null
  }

  return store
}

// Cached version
export async function getStore(id: string) {
  return unstable_cache(
    () => _getStoreImpl(id),
    ["store", id],
    { revalidate: 120, tags: ["stores", `store-${id}`] }
  )()
}

export async function getStoreByUserId(userId: string) {
  // Since store is embedded in user document, store ID = user ID.
  // المالك (تطابق الجلسة) يحصل على بياناته الكاملة شاملة KYC (للوحة الإعدادات)؛
  // غير المالك يحصل على النسخة العامة فقط (بدون الرقم القومي/صور المستندات).
  const uid = await getCurrentUid()
  if (uid && uid === userId) {
    const docSnap = await getAdminDb().collection("users").doc(userId).get()
    if (!docSnap.exists) return null
    const owner = extractStoreForOwner(docSnap)
    return owner ? await signKycFields(owner as Record<string, unknown>) as typeof owner : null
  }
  return getStore(userId)
}

export async function createStore(storeData: StoreCreateInput) {
  // التحقق سيرفر-سايد: المستخدم ينشئ متجره فقط (معرّف المتجر = معرّفه)
  const uid = await getCurrentUid()
  if (!uid || uid !== storeData.seller_id) {
    return { success: false, error: "Unauthorized" }
  }

  // حقول KYC تأتي حرفيًا من العميل. نرفض أي قيمة ليست مفتاح KYC صحيح الشكل (ولا رابطًا قديمًا):
  // يمنع توجيه حقل KYC إلى صورة منتج أو مسار اجتياز، ويمنع كتابة قيمة يرفض signKycFields توقيعها
  // لاحقًا فتظهر للمراجع كحقل معطوب. (لا يُثبت الملكية — مفتاح بائع آخر صحيح الشكل يمرّ؛ إغلاق
  // ذلك يحتاج حصر المفاتيح بـuid المالك، وهو إعادة تصميم منفصلة.)
  for (const f of KYC_FIELDS) {
    const v = (storeData as Record<string, unknown>)[f]
    if (v == null || v === "") continue
    if (typeof v === "string" && (v.startsWith("http") || isKycKey(v))) continue
    return { success: false, error: "قيمة مستند التحقق غير صالحة" }
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  // Store data is embedded in user document
  const userRef = db.collection("users").doc(storeData.seller_id)

  const storePayload = {
    name: storeData.name,
    description: storeData.description || "",
    address: storeData.address,
    phone: storeData.phone,
    category: storeData.category,
    category_id: storeData.category_id || "",
    latitude: storeData.latitude || null,
    longitude: storeData.longitude || null,
    whatsapp_number: storeData.whatsapp_number || storeData.phone,
    support_email: storeData.support_email || "",
    owner_id_number: storeData.owner_id_number || "",
    id_card_image_url: storeData.id_card_image_url || null,
    id_card_image_back_url: storeData.id_card_image_back_url || null,
    commercial_register_image_url: storeData.commercial_register_image_url || null,
    tax_card_image_url: storeData.tax_card_image_url || null,
    tax_card_image_back_url: storeData.tax_card_image_back_url || null,
    is_approved: false,
    rating: 0,
    created_at: now,
    updated_at: now,
  }

  try {
    await userRef.set(
      {
        store: storePayload,
        store_name_lower: normalizeStoreName(storeData.name),
        updated_at: now,
      },
      { merge: true },
    )
  } catch (error: unknown) {
    logError("[v0] Error creating store:", error)
    return { success: false, error: getErrorMessage(error, "Failed to create store") }
  }

  // Return store ID = seller_id
  return { success: true, data: { id: storeData.seller_id, seller_id: storeData.seller_id, ...storePayload } }
}

export async function updateStore(
  id: string,
  formData: Partial<StoreUpdateInput>,
  callerId?: string,
) {
  // التحقق من الملكية سيرفر-سايد (إجباري — معرّف المتجر = معرّف المستخدم)
  const uid = await getCurrentUid()
  if (!uid || uid !== id) {
    return { success: false, error: "ليس لديك صلاحية لتعديل هذا المتجر" }
  }

  const db = getAdminDb()
  // Store ID = User ID
  const userRef = db.collection("users").doc(id)

  // قائمة سماح صريحة لحقول العرض القابلة للتعديل من المالك.
  // منع mass-assignment: بدونها كان البائع يقدر يبعت { is_approved: true } فيعتمد متجره بنفسه،
  // أو يزوّر rating، أو يكتب فوق created_at/حقول KYC. الاعتماد يتم فقط عبر أدمن (setStoreApproval).
  const ALLOWED_STORE_FIELDS = [
    "name",
    "description",
    "address",
    "phone",
    "image_url",
    "category",
    "open_time",
    "close_time",
    "working_days",
    "support_email",
    "whatsapp_number",
    "return_policy",
    "latitude",
    "longitude",
  ] as const

  // Build the update object for nested store field (allowlisted only)
  const storeUpdates: Record<string, unknown> = {}
  for (const key of ALLOWED_STORE_FIELDS) {
    const value = (formData as Record<string, unknown>)[key]
    if (value !== undefined) {
      storeUpdates[`store.${key}`] = value
    }
  }
  // شحن مجاني: مُعقَّم صراحةً (لا يُنسخ خامًا) — boolean صريح وسقف رقمي صحيح غير سالب (0 = يتحمّل الكل).
  const fdRaw = formData as Record<string, unknown>
  if (fdRaw.free_shipping !== undefined) {
    storeUpdates["store.free_shipping"] = fdRaw.free_shipping === true || fdRaw.free_shipping === "true"
  }
  if (fdRaw.free_shipping_cap !== undefined) {
    storeUpdates["store.free_shipping_cap"] = Math.max(0, Math.floor(Number(fdRaw.free_shipping_cap) || 0))
  }
  if (typeof formData.name === "string") {
    storeUpdates["store_name_lower"] = normalizeStoreName(formData.name)
  }
  storeUpdates["store.updated_at"] = new Date().toISOString()
  storeUpdates["updated_at"] = new Date().toISOString()

  try {
    await userRef.update(storeUpdates)
  } catch (error: unknown) {
    logError("[v0] Error updating store:", error)
    return { success: false, error: getErrorMessage(error, "Failed to update store") }
  }

  const updatedSnap = await userRef.get()
  if (!updatedSnap.exists) {
    console.warn("[v0] Update succeeded but user not found:", id)
    return { success: false, error: "Store not found or not permitted" }
  }

  const store = extractStore(updatedSnap)
  if (!store) {
    return { success: false, error: "Store data not found" }
  }

  revalidatePath("/seller/settings", "page")
  revalidatePath(`/store/${id}`, "page")
  revalidateTag("stores", "max")
  revalidateTag(`store-${id}`, "max")
  return { success: true, data: store }
}

// ==================== إقرار الصيدلية لمسار الأعراض ====================
// حقل موافقة مستقلّ عن `updateStore`: قائمة السماح هناك حقول عرض يعدّلها التاجر كما يشاء، وهذا
// **إثبات التزام** يُكتب بختم زمني ونسخة نصّ ولا يُقبل من حمولة عامّة مع بقية الحقول.

export async function getPharmacyConsent(): Promise<{
  success: boolean
  consent?: PharmacyConsent | null
  currentVersion?: number
  error?: string
}> {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "سجّل الدخول أولًا" }
  try {
    const snap = await getAdminDb().collection("users").doc(uid).get()
    const raw = (snap.data() as { store?: { pharmacy_ai_consent?: unknown } } | undefined)?.store?.pharmacy_ai_consent
    return {
      success: true,
      consent: hasValidConsent(raw) ? (raw as PharmacyConsent) : null,
      currentVersion: PHARMACY_CONSENT_VERSION,
    }
  } catch (error) {
    logError("[stores] getPharmacyConsent", error)
    return { success: false, error: "تعذّر تحميل حالة الإقرار" }
  }
}

/**
 * يوقّع الإقرار أو يسحبه. الهوية من الجلسة، والنسخة من الخادم لا من العميل.
 *
 * أخذ رقم النسخة من الحمولة كان سيسمح للتاجر بتسجيل موافقة على نسخة لم يرها (أو نسخة مستقبلية)،
 * فيسقط الإثبات كلّه. القيمة المخزَّنة هنا هي دائمًا نصّ اليوم.
 */
export async function setPharmacyConsent(accept: boolean): Promise<{ success: boolean; error?: string }> {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "سجّل الدخول أولًا" }
  try {
    const ref = getAdminDb().collection("users").doc(uid)
    const snap = await ref.get()
    const data = snap.data() as { role?: string; store?: { category?: string } } | undefined
    if (!snap.exists || data?.role !== "seller" || !data?.store) {
      return { success: false, error: "ليس لديك متجر" }
    }
    // فئة المتجر تُفحَص سيرفر-سايد. الفحص في `app/seller/settings` حراسةُ عرض لا إذن — والأكشن
    // نقطة نهاية عامة تُستدعى بلا واجهة. وبنود الإقرار نفسها تبدأ بـ«أُقرّ بأن الصيدلية مرخَّصة»،
    // فتوقيعُ بقّالٍ عليها ليس مخالفة إجرائية بل إسقاطٌ للأساس القانوني الذي بُني عليه المسار كلّه.
    // (يُفحَص عند القراءة أيضًا — انظر `readConsentingPharmacyIds` — لأن الفئة تتغيّر بعد التوقيع.)
    if (accept && !isPharmacyCategory(data.store.category, normalizeArabic)) {
      return { success: false, error: "هذا الإقرار للصيدليات فقط" }
    }
    const value: PharmacyConsent | null = accept
      ? { version: PHARMACY_CONSENT_VERSION, accepted_at: new Date().toISOString(), accepted_by: uid }
      : null
    await ref.update({
      "store.pharmacy_ai_consent": value,
      "store.updated_at": new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    revalidateTag("stores", "max")
    return { success: true }
  } catch (error) {
    logError("[stores] setPharmacyConsent", error)
    return { success: false, error: "تعذّر حفظ الإقرار" }
  }
}

// بحث المتاجر بنفس تطبيع بحث المنتجات. `toLowerCase()` وحدها لا تفعل شيئًا للعربية، فكانت
// «صيدليه» لا تجد «صيدلية» و«عطاره» لا تجد «عطارة» — وهي الصيغ التي يكتبها العميل فعلًا.
// الفئة داخل نصّ البحث لأن أسماء المتاجر الحقيقية لا تحمل نوعها («فاتحة خير» متجر منظفات)،
// ومطابقة كل الكلمات (لا أيّها) تُبقي الاستعلام الأطول مضيِّقًا لا موسِّعًا.
export async function searchStores(query: string) {
  const stores = await getStores()
  const tokens = searchTokens(query)

  if (!tokens.length) {
    return stores
  }

  return stores.filter((store) => {
    const haystack = [store.name, store.description, store.category]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" ")
    return matchesSearch(haystack, tokens)
  })
}

export async function uploadStoreImage(formData: FormData) {
  const file = formData.get("file") as File
  const storeId = formData.get("storeId") as string

  if (!file || !storeId) {
    return { success: false, error: "Missing file or store ID" }
  }

  // التحقق من الملكية سيرفر-سايد (إجباري)
  const uid = await getCurrentUid()
  if (!uid || uid !== storeId) {
    return { success: false, error: "ليس لديك صلاحية" }
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "نوع الملف غير مدعوم" }
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "الملف أكبر من 5MB" }
  }

  try {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `stores/${storeId}/${fileName}`

    const key = await putObject(PUBLIC_BUCKET, filePath, Buffer.from(await file.arrayBuffer()), file.type)

    return { success: true, url: key }
  } catch (error: unknown) {
    logError("[v0] Server upload error:", error)
    return { success: false, error: getErrorMessage(error, "Internal server error during upload") }
  }
}

const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

/**
 * رفع مستند أثناء تسجيل بائع جديد (قبل إنشاء الحساب/الجلسة).
 * الشعار (kind="logo") → bucket عام ويُعاد رابط عام. مستندات KYC (kind="kyc")
 * → bucket خاص "kyc-documents" ويُعاد المسار فقط (يُقدَّم لاحقًا عبر signed URL للمالك/الأدمن).
 * لا فحص ملكية (لا جلسة بعد) — محميّ بالتحقق من النوع/الحجم + حدّ معدل ضد الإساءة.
 */
export async function uploadStoreDocument(formData: FormData) {
  const file = formData.get("file") as File | null
  // لا افتراضي: kind هو القرار الوحيد الذي يفصل عام عن خاص هنا، وافتراضه "logo" كان يعني
  // أن غيابه يختار الـbucket العام دون أن تراه القائمة البيضاء أدناه. الفراغ يسقط في الرفض.
  const kind = String(formData.get("kind") || "")
  const regId = String(formData.get("regId") || "")
  const prefix = String(formData.get("prefix") || "doc")

  if (!file || !regId) return { success: false, error: "Missing file or registration id" }
  if (!ALLOWED_DOC_TYPES.includes(file.type)) return { success: false, error: "نوع الملف غير مدعوم" }
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "الملف أكبر من 5MB" }
  if (!(await checkRateLimit("uploadStoreDocument", 40, 10 * 60 * 1000))) {
    return { success: false, error: "too_many_requests" }
  }

  try {
    const ext = file.name.split(".").pop() || "jpg"
    const path = `registrations/${regId}/${prefix}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // قائمة سماح صريحة: kind يأتي من العميل وهو ما يقرّر عام مقابل خاص. بلا هذه القائمة كان
    // "أي شيء ليس kyc" يعني عامًا، فقيمة مشوَّهة أو غائبة تنشر مستندًا كان يُفترض أن يبقى خاصًا.
    if (kind !== "kyc" && kind !== "logo") {
      return { success: false, error: "نوع المستند غير مدعوم" }
    }

    const bucket = kind === "kyc" ? PRIVATE_BUCKET : PUBLIC_BUCKET
    const key = await putObject(bucket, path, buffer, file.type)

    // الفرعان يُعيدان مسارًا الآن. الشعار العام يُركَّب رابطه وقت العرض، ومستند KYC يُقدَّم
    // عبر رابط موقّع قصير العمر. لا رابط مطلق يُكتب في قاعدة البيانات من أيّ مسار.
    return { success: true, value: key }
  } catch (error: unknown) {
    logError("[stores] uploadStoreDocument error:", error)
    return { success: false, error: getErrorMessage(error, "Upload failed") }
  }
}
