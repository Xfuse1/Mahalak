"use server"

// ADM-01: لوحة الأدمن — اعتماد/رفض المتاجر (حوكمة).
// كل الأكشن تتحقق من دور admin سيرفر-سايد (يُشتق من قاعدة البيانات، لا من العميل).

import { revalidatePath, revalidateTag } from "next/cache"
import { FieldValue } from "firebase-admin/firestore"
import type { Firestore, Query, DocumentReference } from "firebase-admin/firestore"
import { getAdminDb, getAdminAuth } from "../firebase/admin"
import { getCurrentUser } from "../auth/session"
import { serializeData, chunkArray } from "../firebase/firestore-helpers"
import { createNotification } from "../notifications-internal"
import { signKycFields } from "./stores"
import type { PickupStop } from "./orders"
import { logError } from "../logger"
import { normalizeEgyptPhone, getEgyptPhoneLookupCandidates } from "../utils/phone"
import { readDispatchSettings, computeDeliveryFee } from "../delivery/fee"
import { notifyDriversOfOffer } from "../delivery/driver-push"
import { sendPushToOwner } from "../server-push"

export type AdminStore = {
  id: string
  name: string
  phone?: string
  address?: string
  category?: string
  image_url?: string | null
  is_approved: boolean
  // التوثيق والتمييز (شارة زرقاء + مميّز). المتجر مضمَّن snake_case، لكن نقرأ كل الصيغ احتياطًا.
  is_verified: boolean
  is_featured: boolean
  owner_id_number?: string
  id_card_image_url?: string | null
  id_card_image_back_url?: string | null
  commercial_register_image_url?: string | null
  tax_card_image_url?: string | null
  tax_card_image_back_url?: string | null
  created_at?: string
}

// ADM-03: سائق كما يراه الأدمن — حقول عامة فقط (لا نُرجع أبدًا pin/pin_hash/pin_salt).
export type AdminDriver = {
  id: string
  name: string
  phone?: string
  vehicle_type?: string
  rating: number
  total_deliveries: number
  is_available: boolean
  is_online: boolean
  is_approved: boolean
  price: number
  areas?: string[]
  created_at?: string
}

// حارس لوحة الإدارة: يقبل admin و superAdmin (superAdmin مجموعة فائقة من admin) — غير حسّاس
// لحالة الأحرف. isAdminRole مُعرَّفة أدناه (function declaration مرفوعة hoisted).
async function ensureAdmin() {
  const user = await getCurrentUser()
  if (!user || !isAdminRole(user.role)) return null
  return user
}

// حارس أفعال إدارة المسؤولين: يتطلّب superAdmin تحديدًا (لا يكفي admin). superAdmin يُدار خارج
// اللوحة (bootstrap عبر custom claims) ولا يُنشأ/يُسحب من هذه الواجهة إطلاقًا.
async function ensureSuperAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const r = String(user.role || "").toLowerCase()
  return r === "superadmin" || r === "super_admin" ? user : null
}

// قائمة كل المتاجر (وثائق البائعين) لمراجعة الأدمن — تشمل KYC للتحقق. قيد المراجعة أولًا.
export async function getAdminStores(): Promise<{ success: boolean; stores?: AdminStore[]; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const snap = await db.collection("users").where("role", "==", "seller").get()
    const stores: AdminStore[] = snap.docs
      .map((d) => {
        const data = d.data() as Record<string, any>
        const s = (data?.store || {}) as Record<string, any>
        return serializeData({
          id: d.id,
          name: s.name || data?.full_name || "متجر بدون اسم",
          phone: s.phone || data?.phone || "",
          address: s.address || [data?.city, data?.street].filter(Boolean).join(", ") || "",
          category: s.category || "",
          image_url: s.image_url ?? null,
          is_approved: s.is_approved === true,
          // نقرأ التوثيق/التمييز بكل الصيغ (snake/bare/camel) لأن مصدر الكتابة قد يختلف (Flutter/الموقع)
          is_verified: s.is_verified === true || s.verified === true || s.isVerified === true,
          is_featured: s.is_featured === true || s.featured === true || s.isFeatured === true,
          owner_id_number: s.owner_id_number || "",
          id_card_image_url: s.id_card_image_url ?? null,
          id_card_image_back_url: s.id_card_image_back_url ?? null,
          commercial_register_image_url: s.commercial_register_image_url ?? null,
          tax_card_image_url: s.tax_card_image_url ?? null,
          tax_card_image_back_url: s.tax_card_image_back_url ?? null,
          created_at: s.created_at || data?.created_at || "",
        }) as AdminStore
      })
    // ملاحظة: لا نُرشّح على الاسم — كل مستند دوره seller يجب أن يكون قابلًا للمراجعة/الاعتماد
    // (بائع بلا اسم كان يختفي تمامًا من قائمة الأدمن فلا يُعتمد ولا يُرفض).

    // قيد المراجعة (غير معتمد) أولًا
    stores.sort((a, b) => Number(a.is_approved) - Number(b.is_approved))
    // تقديم مستندات KYC عبر signed URLs قصيرة العمر (الأدمن مخوّل) بدل روابط عامة
    await Promise.all(stores.map((s) => signKycFields(s as unknown as Record<string, unknown>)))
    return { success: true, stores }
  } catch (error) {
    logError("[admin] getAdminStores", error)
    return { success: false, error: "تعذّر تحميل المتاجر" }
  }
}

// اعتماد/رفض متجر — يضبط store.is_approved ويُخطر البائع.
export async function setStoreApproval(storeId: string, approved: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const userRef = db.collection("users").doc(storeId)
    const snap = await userRef.get()
    if (!snap.exists || (snap.data() as Record<string, any>)?.role !== "seller") {
      return { success: false, error: "المتجر غير موجود" }
    }

    await userRef.update({
      "store.is_approved": approved,
      "store.updated_at": new Date().toISOString(),
    })

    // إخطار البائع (لا نُفشل العملية إن فشل الإشعار)
    try {
      await createNotification({
        user_id: storeId,
        title: approved ? "تم اعتماد متجرك ✅" : "تم رفض متجرك",
        title_en: approved ? "Your store is approved ✅" : "Your store was rejected",
        message: approved
          ? "تهانينا! متجرك الآن معتمد وجاهز للعمل."
          : "للأسف لم يُعتمد متجرك بعد. يرجى مراجعة بياناتك ومستنداتك.",
        message_en: approved
          ? "Congratulations! Your store is now approved."
          : "Your store was not approved. Please review your details and documents.",
        type: approved ? "store_confirmed" : "store_rejected",
        link: "/seller/dashboard",
      })
    } catch (e) {
      logError("[admin] approval notification", e)
    }

    revalidatePath("/admin/stores")
    // إبطال كاش المتاجر أيضًا حتى ينعكس الاعتماد/الرفض فورًا على الواجهة العامة (getStores/getStore)
    revalidateTag("stores", "max")
    revalidateTag(`store-${storeId}`, "max")
    return { success: true }
  } catch (error) {
    logError("[admin] setStoreApproval", error)
    return { success: false, error: "تعذّر تحديث الحالة" }
  }
}

// ==================== توثيق/تمييز المتاجر + عمليات جماعية + إحصاءات ====================
// دمج أفعال إدارة المتاجر من لوحة Flutter التي كانت مفقودة في Next.js.
// كل الأفعال مُقيّدة بـ ensureAdmin() (الدور يُشتق من قاعدة البيانات سيرفر-سايد) وتستخدم Admin SDK.

// توثيق متجر (الشارة الزرقاء). حرِج: واجهة العملاء لا تقرأ حقل التوثيق حاليًا (لا شارة في بطاقة/صفحة
// المتجر — راجع components/store-card.tsx و app/store/[id]) — فالشارة الزرقاء في اللقطة من لوحة Flutter.
// المتجر مضمَّن في users/{uid}.store بأسلوب snake_case (is_approved…)، لذا الأرجح أن Flutter يقرأ is_verified.
// للمتانة نكتب الصيغ الثلاث (snake + bare + camel) بنفس القيمة تمامًا كما فعل إصلاح اعتماد السائق
// (كتب isApproved + is_approved معًا) — فأيًّا كان ما يقرؤه أي عميل يُضبط بنفس القيمة.
export async function setStoreVerified(storeId: string, verified: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const userRef = db.collection("users").doc(storeId)
    const snap = await userRef.get()
    if (!snap.exists || (snap.data() as Record<string, any>)?.role !== "seller") {
      return { success: false, error: "المتجر غير موجود" }
    }
    await userRef.update({
      "store.is_verified": verified,
      "store.verified": verified,
      "store.isVerified": verified,
      "store.updated_at": new Date().toISOString(),
    })
    revalidatePath("/admin/stores")
    // إبطال كاش المتاجر حتى ينعكس التوثيق فور توصيل الواجهة العامة لقراءته مستقبلًا
    revalidateTag("stores", "max")
    revalidateTag(`store-${storeId}`, "max")
    return { success: true }
  } catch (error) {
    logError("[admin] setStoreVerified", error)
    return { success: false, error: "تعذّر تحديث حالة التوثيق" }
  }
}

// تمييز متجر (featured). تنبيه: واجهة العملاء لا تستهلك علم "مميّز" بعد — قسم «متاجر مميزة» في الصفحة
// الرئيسية (app/page.tsx) يعرض أول 4 متاجر فقط (allStores.slice(0,4)) دون قراءة أي حقل. نكتب العلم
// (استخدمته Flutter) بالصيغ الثلاث، لكنه لن يظهر في المتجر حتى تُوصَل الواجهة لقراءته لاحقًا.
export async function setStoreFeatured(storeId: string, featured: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const userRef = db.collection("users").doc(storeId)
    const snap = await userRef.get()
    if (!snap.exists || (snap.data() as Record<string, any>)?.role !== "seller") {
      return { success: false, error: "المتجر غير موجود" }
    }
    await userRef.update({
      "store.is_featured": featured,
      "store.featured": featured,
      "store.isFeatured": featured,
      "store.updated_at": new Date().toISOString(),
    })
    revalidatePath("/admin/stores")
    revalidateTag("stores", "max")
    revalidateTag(`store-${storeId}`, "max")
    return { success: true }
  } catch (error) {
    logError("[admin] setStoreFeatured", error)
    return { success: false, error: "تعذّر تحديث حالة التمييز" }
  }
}

// اعتماد/رفض جماعي لعدة متاجر — دفعات ذرّية مُقسّمة عند 400 عملية (حدّ Firestore 500).
// أمان/متانة: نقرأ مستندات كل دفعة عبر getAll ونحدّث فقط الموجودة ودورها seller
//   (batch.update على مستند غير موجود يُفشل الدفعة كاملةً). لا نُخطر البائعين هنا (قد يكونون كثرًا).
export async function bulkSetStoreApproval(storeIds: string[], approved: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, updated: 0, failed: 0, error: "ليس لديك صلاحية" }
  const ids = Array.from(
    new Set((Array.isArray(storeIds) ? storeIds : []).map((s) => String(s || "").trim()).filter(Boolean)),
  )
  if (ids.length === 0) return { success: false, updated: 0, failed: 0, error: "لم يتم تحديد أي متجر" }
  if (ids.length > 2000) return { success: false, updated: 0, failed: 0, error: "عدد المتاجر المحدَّدة كبير جدًا" }
  const db = getAdminDb()
  const now = new Date().toISOString()
  let updated = 0
  let failed = 0
  // كل دفعة معزولة في try/catch خاص بها: فشل دفعة (مثلًا مستند حُذف في نافذة السباق بين getAll
  // والـcommit، أو خطأ عابر) لا يُسقط بقية الدفعات ولا يُخفي ما نجح فعلًا. نجمع updated/failed.
  for (const chunk of chunkArray(ids, 400)) {
    try {
      const refs = chunk.map((id) => db.collection("users").doc(id))
      const docs = await db.getAll(...refs)
      const batch = db.batch()
      let inBatch = 0
      docs.forEach((doc) => {
        if (doc.exists && (doc.data() as Record<string, any>)?.role === "seller") {
          batch.update(doc.ref, { "store.is_approved": approved, "store.updated_at": now })
          inBatch++
        }
      })
      if (inBatch > 0) {
        await batch.commit()
        updated += inBatch
      }
    } catch (error) {
      logError("[admin] bulkSetStoreApproval chunk", error)
      failed += chunk.length
    }
  }
  // نُبطل كاش المتاجر طالما تغيّر شيء فعلًا حتى لا تبقى الواجهة العامة تعرض حالة اعتماد قديمة
  // (تاج "stores" يغطّي getStores و getStore معًا).
  if (updated > 0) {
    revalidatePath("/admin/stores")
    revalidateTag("stores", "max")
  }
  // فشل كلي (لم يُحدَّث شيء) = خطأ؛ وإلا ننجح ونُبلّغ بالعدد الفعلي (قد يكون جزئيًا).
  if (updated === 0 && failed > 0) {
    return { success: false, updated, failed, error: "تعذّر تنفيذ العملية الجماعية" }
  }
  return { success: true, updated, failed }
}

// إحصاءات سريعة لكل متجر عبر تجميعات count() رخيصة (لا تقرأ أي وثيقة، ولا تحتاج فهرسًا مركّبًا):
//   • productCount = count(products where store_id == id)
//   • orderCount   = طلبات أحادية المتجر (store_id == id) + طلبات متعددة المتاجر (store_ids array-contains id)
//     — الطلب المتعدد لا يحمل store_id علويًّا بل مصفوفة store_ids، فنعدّه بالاستعلامين (مجموعتان منفصلتان).
// ملاحظة: أزلنا مجموع الإيراد عمدًا — sum(total) المفلتَر بـstore_id يتطلّب فهرسًا مركّبًا غير منشور
//   (فيرجع صفرًا صامتًا)، ويطوي الحالات الملغاة/المرفوضة/الاستفسار، ولا يطال إيراد الطلب المتعدد
//   (مبلغه متداخل في pickup_stops) — فرقم مضلِّل. إيراد المتجر يحتاج تقريرًا تحليليًّا مستقلًّا (بند مؤجّل).
// لا نُرجع أي حقول حسّاسة (أرقام فقط).
export type AdminStoreStats = {
  productCount: number
  orderCount: number
}

export async function getStoreStats(
  storeId: string,
): Promise<{ success: boolean; stats?: AdminStoreStats; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const id = String(storeId || "").trim()
  if (!id) return { success: false, error: "معرّف غير صالح" }
  try {
    const db = getAdminDb()
    const products = db.collection("products").where("store_id", "==", id)
    const singleOrders = db.collection("orders").where("store_id", "==", id)
    const multiOrders = db.collection("orders").where("store_ids", "array-contains", id)
    const [productCount, singleCount, multiCount] = await Promise.all([
      safeCount("store.products", products),
      safeCount("store.orders.single", singleOrders),
      safeCount("store.orders.multi", multiOrders),
    ])
    return { success: true, stats: { productCount, orderCount: singleCount + multiCount } }
  } catch (error) {
    logError("[admin] getStoreStats", error)
    return { success: false, error: "تعذّر تحميل إحصاءات المتجر" }
  }
}

// ==================== ADM-03: إدارة السائقين ====================
// كل الأكشن مُقيّدة بـ ensureAdmin() (يُشتق الدور من قاعدة البيانات، لا من العميل).

// قائمة كل السائقين لمراجعة الأدمن — قيد المراجعة أولًا ثم الأحدث.
// أمان: نعيّن الحقول العامة فقط — لا نُرجع أبدًا pin/pin_hash/pin_salt.
export async function getAdminDrivers(): Promise<{ success: boolean; drivers?: AdminDriver[]; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    // حد أعلى معقول للقراءة (أسطول السائقين صغير عادةً)
    const snap = await db.collection("drivers").limit(500).get()
    const drivers: AdminDriver[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, any>
      // نطبّع camelCase-أو-snake تمامًا مثل getDrivers حتى يبقى موقع العميل متسقًا.
      return serializeData({
        id: d.id,
        name: data.name || "",
        phone: data.phone || "",
        vehicle_type: data.vehicleType || data.vehicle_type || "",
        rating: data.rating || 0,
        total_deliveries: data.totalDeliveries || data.total_deliveries || 0,
        is_available: data.isActive ?? data.is_available ?? true,
        is_online: data.isOnline ?? data.is_online ?? false,
        is_approved: (data.isApproved ?? data.is_approved) === true,
        price: data.price || 0,
        areas: Array.isArray(data.areas) ? data.areas : [],
        created_at: data.createdAt?.toDate?.()?.toISOString?.() || data.created_at || "",
      }) as AdminDriver
    })

    // قيد المراجعة (غير معتمد) أولًا، ثم الأحدث أولًا
    drivers.sort((a, b) => {
      if (a.is_approved !== b.is_approved) return Number(a.is_approved) - Number(b.is_approved)
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
    return { success: true, drivers }
  } catch (error) {
    logError("[admin] getAdminDrivers", error)
    return { success: false, error: "تعذّر تحميل السائقين" }
  }
}

// اعتماد/رفض سائق.
// حرِج: نكتب الحقلين isApproved و is_approved بنفس القيمة حتى يبقى استعلام getDrivers متسقًا
// (getDrivers يفلتر على isApproved أولًا ثم is_approved كبديل). كذلك نضبط updated_at.
export async function setDriverApproval(driverId: string, approved: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const ref = db.collection("drivers").doc(driverId)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "السائق غير موجود" }

    await ref.update({
      isApproved: approved,
      is_approved: approved,
      updated_at: new Date().toISOString(),
    })

    revalidatePath("/admin/drivers")
    return { success: true }
  } catch (error) {
    logError("[admin] setDriverApproval", error)
    return { success: false, error: "تعذّر تحديث الحالة" }
  }
}

// تفعيل/إيقاف توفّر السائق — نكتب الحقلين isActive و is_available معًا
// (getDrivers يقرأ is_available من isActive أولًا ثم is_available كبديل).
export async function setDriverAvailability(driverId: string, available: boolean) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const ref = db.collection("drivers").doc(driverId)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "السائق غير موجود" }

    await ref.update({
      isActive: available,
      is_available: available,
      updated_at: new Date().toISOString(),
    })

    revalidatePath("/admin/drivers")
    return { success: true }
  } catch (error) {
    logError("[admin] setDriverAvailability", error)
    return { success: false, error: "تعذّر تحديث الحالة" }
  }
}

// إنشاء/تسجيل سائق جديد من لوحة الأدمن. الدخول يتم بالهاتف + OTP، فالهاتف لازم يكون صالحًا وفريدًا.
// نكتب الحقلين (isApproved/is_approved و isActive/is_available) معًا للتوافق مع getDrivers والطبقة المشتركة.
export async function createDriver(input: {
  name: string
  phone: string
  price?: number
  vehicle_type?: string
  areas?: string[]
  approved?: boolean
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }

  const name = String(input.name || "").trim()
  if (!name) return { success: false, error: "اسم السائق مطلوب" }

  // الهاتف صالح ومصري — نخزّنه بصيغة محلية 01xxxxxxxxx (مطابقة لبيانات السائقين الحالية والعرض).
  const normalized = normalizeEgyptPhone(input.phone)
  if (!normalized) return { success: false, error: "رقم هاتف مصري غير صالح" }
  const localPhone = `0${normalized.slice(3)}`

  const priceNum = Number(input.price)
  const price = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0
  const areas = Array.isArray(input.areas)
    ? input.areas.map((a) => String(a).trim()).filter(Boolean).slice(0, 50)
    : []
  const vehicleType = String(input.vehicle_type || "").trim()
  const approved = input.approved !== false // افتراضيًا معتمَد (الأدمن هو المُنشئ)

  try {
    const db = getAdminDb()
    // تفرّد الهاتف (حرِج): الدخول بالهاتف — رقمان متطابقان يجعلان findDriverIdByPhone ملتبسًا.
    // نرفض أي تطابق بأي صيغة من صيغ الهاتف.
    const candidates = getEgyptPhoneLookupCandidates(input.phone)
    for (const cand of candidates) {
      const dup = await db.collection("drivers").where("phone", "==", cand).limit(1).get()
      if (!dup.empty) return { success: false, error: "رقم الهاتف مستخدم بالفعل لسائق آخر" }
    }

    const now = new Date().toISOString()
    const ref = db.collection("drivers").doc()
    await ref.set({
      name,
      phone: localPhone,
      isApproved: approved,
      is_approved: approved,
      isActive: true,
      is_available: true,
      isOnline: false,
      rating: 0,
      totalDeliveries: 0,
      price,
      ...(vehicleType ? { vehicleType, vehicle_type: vehicleType } : {}),
      ...(areas.length ? { areas } : {}),
      created_at: now,
      updated_at: now,
    })

    revalidatePath("/admin/drivers")
    return { success: true, id: ref.id }
  } catch (error) {
    logError("[admin] createDriver", error)
    return { success: false, error: "تعذّر إنشاء السائق" }
  }
}

// ==================== لوحة مراقبة التوزيع (تشغيل يومي) ====================
export type DispatchMonitorOrder = {
  id: string
  status: string
  order_type: string
  customer_name?: string
  store_names: string[]
  driver_id?: string
  driver_name?: string
  driver_lat?: number
  driver_lng?: number
  driver_location_at?: string
  dropoff_lat?: number
  dropoff_lng?: number
  delivery_price?: number
  total?: number
  offer_round?: number
  offer_expires_at_ms?: number
  stalled?: boolean
  stops_summary?: string // للمتعدد: "2/3 مؤكَّد" أو استلام
  created_at?: string
}
export type DispatchMonitorDriver = {
  id: string
  name: string
  phone?: string
  is_online: boolean
  active_orders: number
}

// لقطة حيّة لعمليات التوزيع: الطلبات النشطة (offering/accepted/on_the_way) + مواقع سائقيها +
// السائقون المتاحون. للأدمن فقط. لا تكشف كود التسليم.
export async function getDispatchMonitor(): Promise<{
  ok: boolean
  orders?: DispatchMonitorOrder[]
  drivers?: DispatchMonitorDriver[]
  error?: string
}> {
  const admin = await ensureAdmin()
  if (!admin) return { ok: false, error: "forbidden" }
  try {
    const db = getAdminDb()
    const ACTIVE = ["offering", "accepted", "on_the_way"]
    // نرشّح بالحالة النشطة على مستوى القاعدة (فهرس مفرد تلقائي على status) ثم is_dispatch في JS.
    // سابقًا كان الاستعلام is_dispatch==true بحدّ 400 بلا ترتيب: وبما أن is_dispatch لا يُعاد أبدًا إلى
    // false عند التسليم/الإلغاء، تتراكم الطلبات المنتهية بلا حدّ وتُزيح الطلبات النشطة خارج نافذة الـ400
    // (معرّفات المستندات عشوائية بلا orderBy)، فتختفي طلبات حيّة صامتةً من اللوحة بمجرد تجاوز 400 طلب
    // توزيع تراكمي. الاستعلام بالحالة النشطة (عددها محدود بطبيعته) يزيل هذا الانقطاع الصامت.
    const snap = await db.collection("orders").where("status", "in", ACTIVE).limit(400).get()
    const raw = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) } as Record<string, any>))
      .filter((o) => o.is_dispatch === true)
    // أسماء المتاجر: نجمع كل store_id/store_ids ونجلبها دفعةً.
    const storeIds = new Set<string>()
    for (const o of raw) {
      if (o.store_id) storeIds.add(o.store_id)
      for (const sid of o.store_ids || []) storeIds.add(sid)
      for (const s of o.pickup_stops || []) if (s?.store_id) storeIds.add(s.store_id)
    }
    const storeNameById = new Map<string, string>()
    for (const chunk of chunkArray(Array.from(storeIds), 10)) {
      if (!chunk.length) continue
      const refs = chunk.map((id) => db.collection("users").doc(id))
      const docs = await db.getAll(...refs)
      docs.forEach((doc) => {
        const store = (doc.data() as { store?: { name?: string } } | undefined)?.store
        if (store?.name) storeNameById.set(doc.id, store.name)
      })
    }
    const activeByDriver = new Map<string, number>()
    const orders: DispatchMonitorOrder[] = raw.map((o) => {
      if (o.driver_id) activeByDriver.set(o.driver_id, (activeByDriver.get(o.driver_id) || 0) + 1)
      const stopStores: string[] = (o.pickup_stops || []).map((s: any) => s?.store_name || storeNameById.get(s?.store_id) || "متجر")
      const store_names = o.order_type === "multi_store"
        ? stopStores
        : [o.store_name || storeNameById.get(o.store_id) || "متجر"]
      let stops_summary: string | undefined
      if (o.order_type === "multi_store" && Array.isArray(o.pickup_stops)) {
        const total = o.pickup_stops.length
        if (o.status === "accepted" || o.status === "on_the_way") {
          // on_the_way = كل المتاجر استُلمت (dispatch.ts يشترط ذلك للانتقال) فالوصف الصحيح "استُلم".
          const picked = o.pickup_stops.filter((s: any) => s?.status === "picked_up").length
          stops_summary = `${picked}/${total} استُلم`
        } else {
          const conf = o.pickup_stops.filter((s: any) => s?.status === "confirmed" || s?.status === "picked_up").length
          stops_summary = `${conf}/${total} مؤكَّد`
        }
      }
      const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined)
      return {
        id: o.id,
        status: String(o.status),
        order_type: String(o.order_type || "single"),
        customer_name: typeof o.customer_name === "string" ? o.customer_name : undefined,
        store_names,
        driver_id: o.driver_id || undefined,
        driver_name: typeof o.driver_name === "string" ? o.driver_name : undefined,
        driver_lat: num(o.driver_lat),
        driver_lng: num(o.driver_lng),
        driver_location_at: typeof o.driver_location_at === "string" ? o.driver_location_at : undefined,
        dropoff_lat: num(o.delivery_latitude),
        dropoff_lng: num(o.delivery_longitude),
        delivery_price: num(o.delivery_price),
        total: num(o.total),
        offer_round: num(o.offer_round),
        offer_expires_at_ms: num(o.offer_expires_at_ms) || undefined, // للوحة: تكشف عرضًا منتهيًا لكن ما زال offering (كرون متجمّد)
        stalled: o.dispatch_stalled === true,
        stops_summary,
        created_at: typeof o.created_at === "string" ? o.created_at : undefined,
      }
    })
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    // حدّ 500 اتساقًا مع باقي قراءات الأدمن للسائقين (getAdminDrivers/getAdminAccounts) — تُستدعى كل 15ث
    // لكل لوحة مفتوحة، فقراءة غير محدودة تكبر خطّيًّا مع الأسطول.
    const dsnap = await db.collection("drivers").limit(500).get()
    const drivers: DispatchMonitorDriver[] = dsnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) } as Record<string, any>))
      .filter((d) => (d.isApproved ?? d.is_approved ?? false) === true && d.disabled !== true)
      .map((d) => ({
        id: d.id,
        name: d.name || "سائق",
        phone: typeof d.phone === "string" ? d.phone : undefined,
        // الحقل الغائب = غير متاح (?? false)، اتساقًا مع getAdminDrivers — وإلا ظهر سائق لم يفعّل حالته
        // "متاح" هنا و"غير متاح" في /admin/drivers على نفس البيانات.
        is_online: (d.isOnline ?? d.is_online ?? false) === true,
        active_orders: activeByDriver.get(d.id) || 0,
      }))
      .sort((a, b) => Number(b.is_online) - Number(a.is_online))
    return { ok: true, orders, drivers }
  } catch (e) {
    logError("[admin] getDispatchMonitor", e)
    return { ok: false, error: "server_error" }
  }
}

// ==================== إنقاذ طلبات التوزيع من اللوحة ====================
// طلب توزيع قد يعلق: لم يقبله أي سائق (dispatch_stalled)، أو قبِله سائق ثم تخلّى عنه قبل الاستلام.
// آلة الحالة لا تملك إعادة إسناد تلقائية بعد القبول، فنمنح الأدمن فعلين يدويين ذرّيين من اللوحة.

// إلغاء طلب توزيع عالق + استعادة كل المخزون (أحادي عبر order_items، متعدد عبر pickup_stops).
// لأي حالة غير نهائية. علم stock_restored يمنع الاستعادة المزدوجة (تنسيقًا مع مسار الإلغاء/الرفض الآخر).
export async function adminCancelDispatchOrder(orderId: string, reason?: string) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false as const, error: "forbidden" }
  if (typeof orderId !== "string" || !orderId) return { success: false as const, error: "bad_request" }
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  const r = String(reason || "").trim().slice(0, 280)
  try {
    // قراءة order_items خارج المعاملة (القراءات-قبل-الكتابات). المعاملة تُعيد قراءة الطلب وتستعيد
    // المخزون وتضبط العلم ذرّيًّا معًا — فلا يعلق stock_restored=true بلا استعادة فعلية لو فشلت الكتابة.
    const itemsSnap = await db.collection("order_items").where("order_id", "==", orderId).get()
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.status === "delivered" || o.status === "cancelled") return { ok: false as const, error: "already_terminal" }
      const alreadyRestored = o.stock_restored === true
      let terminalizedStops: Array<Record<string, any>> | null = null
      if (!alreadyRestored) {
        if (o.order_type === "multi_store") {
          const stops: PickupStop[] = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
          terminalizedStops = stops.map((stop) => {
            // المرفوضة استُعيدت مسبقًا، والمُستَلَمة خرجت بضاعتها فعليًا مع السائق — لا نعيدها (وإلا مخزون وهمي).
            if (stop?.status === "rejected" || stop?.status === "picked_up") return stop
            for (const it of stop?.items || []) {
              const q = Number(it?.quantity) || 0
              if (it?.product_id && q > 0) tx.update(db.collection("products").doc(String(it.product_id)), { stock: FieldValue.increment(q) })
            }
            return { ...stop, status: "cancelled" }
          })
        } else {
          for (const itemDoc of itemsSnap.docs) {
            const it = itemDoc.data() as Record<string, any>
            const q = Number(it.quantity) || 0
            if (it.product_id && q > 0) tx.update(db.collection("products").doc(String(it.product_id)), { stock: FieldValue.increment(q) })
          }
        }
      }
      tx.update(ref, {
        status: "cancelled",
        stock_restored: true,
        offer_expires_at_ms: FieldValue.delete(),
        timeline: [...(Array.isArray(o.timeline) ? o.timeline : []), { status: "cancelled", timestamp: now, note: `إلغاء إداري${r ? ": " + r : ""}` }],
        updated_at: now,
        ...(terminalizedStops ? { pickup_stops: terminalizedStops } : {}),
      })
      return { ok: true as const, customerId: o.customer_id as string | undefined }
    })
    if (!out.ok) return { success: false as const, error: out.error }
    if (out.customerId) {
      try {
        await createNotification({ user_id: out.customerId, type: "order_status", title: "⚠️ أُلغي طلبك", title_en: "⚠️ Your order was cancelled", message: "أُلغي الطلب من الإدارة. يمكنك إعادة الطلب.", message_en: "The order was cancelled by support. You can reorder.", link: "/account", data: { order_id: orderId, status: "cancelled" } })
        await sendPushToOwner("user", out.customerId, { title: "⚠️ أُلغي طلبك", body: "أُلغي الطلب من الإدارة. يمكنك إعادة الطلب.", link: "/account" })
      } catch (e) { logError("[admin] adminCancelDispatchOrder notify", e) }
    }
    revalidatePath("/admin/dispatch")
    return { success: true as const }
  } catch (e) {
    logError("[admin] adminCancelDispatchOrder", e)
    return { success: false as const, error: "server_error" }
  }
}

// إعادة عرض طلب توزيع عالق على السائقين: يزيل السائق (لو مُسنَد ولم يستلم بعد)، يعيد الحالة إلى
// offering بجولة جديدة ومهلة جديدة، يصفّر rejected_by/dispatch_stalled، ثم يبثّ العرض. مقصور على
// offering (متعثّر) أو accepted (سائق تخلّى قبل الاستلام) — بعد الاستلام (on_the_way) البضاعة مع
// السائق فلا يصحّ إعادة العرض (استخدم الإلغاء).
export async function adminReofferDispatchOrder(orderId: string) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false as const, error: "forbidden" }
  if (typeof orderId !== "string" || !orderId) return { success: false as const, error: "bad_request" }
  const settings = await readDispatchSettings()
  const db = getAdminDb()
  const ref = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { ok: false as const, error: "order_not_found" }
      const o = snap.data() as Record<string, any>
      if (o.is_dispatch !== true) return { ok: false as const, error: "not_dispatch_order" }
      if (o.status !== "offering" && o.status !== "accepted") return { ok: false as const, error: "cannot_reoffer_state" }
      // متعدد المتاجر: لو استُلم أي متجر فالبضاعة بدأت تتجمّع مع السائق — لا نعيد العرض.
      const stops: PickupStop[] = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
      if (o.order_type === "multi_store" && stops.some((s) => s.status === "picked_up")) {
        return { ok: false as const, error: "already_picking_up" }
      }
      const update: Record<string, unknown> = {
        status: "offering",
        driver_id: FieldValue.delete(),
        driver_name: FieldValue.delete(),
        driver_lat: FieldValue.delete(),
        driver_lng: FieldValue.delete(),
        driver_heading: FieldValue.delete(),
        driver_location_at: FieldValue.delete(),
        accepted_at: FieldValue.delete(),
        offer_expires_at_ms: Date.now() + settings.offer_timeout_sec * 1000,
        offer_round: 1,
        rejected_by: [],
        dispatch_stalled: FieldValue.delete(),
        timeline: [...(Array.isArray(o.timeline) ? o.timeline : []), { status: "offering", timestamp: now, note: "إعادة عرض إدارية" }],
        updated_at: now,
      }
      // لو كان الطلب أُسنِد بعرض سعر (مزايدة)، فإعادة العرض ترجّع رسم العدّاد الأصلي وتصحّح الإجمالي —
      // وإلا نعيد عرضه بسعر مزايدة قديم لسائق آخر. نعيد الحساب من المسافة المخزّنة فقط (بلاها نترك السعر).
      let newFee = Number(o.delivery_price) || 0
      const km = Number(o.distance_km)
      if (Number.isFinite(km)) {
        newFee = computeDeliveryFee(km, settings)
        update.delivery_price = newFee
        update.total = Math.max(0, (Number(o.total) || 0) + (newFee - (Number(o.delivery_price) || 0)))
      }
      tx.update(ref, update)
      return {
        ok: true as const,
        customerId: o.customer_id as string | undefined,
        // نُرجع الرسم المكتوب فعلًا (لا القديم) كي يُعلن للسائقين نفس السعر المخزّن على الطلب.
        deliveryPrice: newFee as number | undefined,
        deliveryCity: o.delivery_city as string | undefined,
        distanceKm: o.distance_km as number | undefined,
      }
    })
    if (!out.ok) return { success: false as const, error: out.error }
    try {
      await notifyDriversOfOffer({ id: orderId, delivery_price: out.deliveryPrice, delivery_city: out.deliveryCity, distance_km: out.distanceKm, rejected_by: [] })
    } catch (e) { logError("[admin] adminReoffer push", e) }
    if (out.customerId) {
      try {
        await createNotification({ user_id: out.customerId, type: "order_status", title: "🔄 نعيد البحث عن سائق", title_en: "🔄 Re-searching for a driver", message: "أعدنا عرض طلبك على السائقين.", message_en: "We re-offered your order to drivers.", link: "/account", data: { order_id: orderId, status: "offering" } })
        await sendPushToOwner("user", out.customerId, { title: "🔄 نعيد البحث عن سائق", body: "أعدنا عرض طلبك على السائقين.", link: "/account" })
      } catch (e) { logError("[admin] adminReoffer notify", e) }
    }
    revalidatePath("/admin/dispatch")
    return { success: true as const }
  } catch (e) {
    logError("[admin] adminReofferDispatchOrder", e)
    return { success: false as const, error: "server_error" }
  }
}

// ==================== المرحلة 1: إعدادات التوزيع (العدّاد) ====================
// كل النظام خلف علم enabled (افتراضيًا false) — لا تأثير على الموقع الحي حتى يفعّله الأدمن.

export async function getDispatchSettings() {
  const admin = await ensureAdmin()
  if (!admin) return { success: false as const, error: "ليس لديك صلاحية" }
  try {
    return { success: true as const, settings: await readDispatchSettings() }
  } catch (error) {
    logError("[admin] getDispatchSettings", error)
    return { success: false as const, error: "تعذّر تحميل إعدادات التوزيع" }
  }
}

export async function updateDispatchSettings(input: {
  enabled?: boolean
  base_fare?: number
  per_km_rate?: number
  offer_timeout_sec?: number
  bid_cap_pct?: number
}): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  // نضيف الحقل فقط إن كان رقمًا صالحًا ≥ الحد الأدنى؛ أول قيمة غير صالحة تُرجِع اسم الحقل (فشل بلا كتابة).
  const putNum = (key: string, v: unknown, min: number, max: number): string | null => {
    if (v === undefined) return null
    const n = Number(v)
    if (!Number.isFinite(n) || n < min || n > max) return key // حدّ أدنى وأعلى (يحمي من الخطأ الكتابي)
    patch[key] = n
    return null
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled === true
  const bad =
    putNum("base_fare", input.base_fare, 0, 100000) ||
    putNum("per_km_rate", input.per_km_rate, 0, 100000) ||
    putNum("offer_timeout_sec", input.offer_timeout_sec, 10, 600) || // مهلة بين 10ث و10 دقائق
    putNum("bid_cap_pct", input.bid_cap_pct, 0, 100) // المزايدة لا تتجاوز 100%
  if (bad) return { success: false, error: "قيمة غير صحيحة" }

  try {
    await getAdminDb().collection("settings").doc("dispatch").set(patch, { merge: true })
    revalidatePath("/admin/commission-settings")
    return { success: true }
  } catch (error) {
    logError("[admin] updateDispatchSettings", error)
    return { success: false, error: "تعذّر حفظ إعدادات التوزيع" }
  }
}

// إحصاءات سريعة لكل سائق — أرقام فقط، بلا أي حقول حسّاسة (لا نقرأ/نُرجع أبدًا pin/pin_hash/pin_salt).
//   • assignedOrders = count(orders where driver_id == id) — استعلام مساواة بحقل واحد يخدمه الفهرس
//     التلقائي أحادي-الحقل (بلا فهرس مركّب). يغطّي الطلب الأحادي والمتعدد معًا لأن كليهما يحمل
//     driver_id علويًّا عند الإسناد (createOrder + createMultiStoreOrder + changeOrderDriver في orders.ts).
//   • completedDeliveries + ratingCount = قيم مُزالة-التطبيع نقرؤها من مستند السائق مباشرةً (قراءة
//     واحدة، بلا استعلام ولا حساب). rating_count يُعاد حسابه من order_reviews في reviews.ts؛
//     total_deliveries حقل مُزال-التطبيع تعرضه بطاقة السائق أصلًا.
// حرِج: تعمّدنا عدم حساب عدّاد "مُسلَّم" مفلتَر بالحالة (driver_id== AND status==) لأنه يتطلّب فهرسًا
//   مركّبًا غير منشور (غائب من firestore.indexes.json) فيرجع صفرًا صامتًا عبر safeCount — نعرض بدلًا
//   منه عدّاد التوصيلات المُزال-التطبيع.
export type AdminDriverStats = {
  assignedOrders: number
  completedDeliveries: number
  ratingCount: number
}

export async function getDriverStats(
  driverId: string,
): Promise<{ success: boolean; stats?: AdminDriverStats; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const id = String(driverId || "").trim()
  if (!id) return { success: false, error: "معرّف غير صالح" }
  try {
    const db = getAdminDb()
    // قراءة واحدة لمستند السائق (للقيم المُزالة-التطبيع) + عدّاد مساواة بحقل واحد للطلبات المُسندة.
    const [driverDoc, assignedOrders] = await Promise.all([
      db.collection("drivers").doc(id).get(),
      safeCount("driver.orders.assigned", db.collection("orders").where("driver_id", "==", id)),
    ])
    if (!driverDoc.exists) return { success: false, error: "السائق غير موجود" }
    const data = driverDoc.data() as Record<string, any>
    // نقرأ الحقول المُزالة-التطبيع بكل الصيغ (camel/snake) دون حساب — لا نمسّ أي حقل حسّاس.
    const completedDeliveries = Number(data.totalDeliveries ?? data.total_deliveries ?? 0) || 0
    const ratingCount = Number(data.rating_count ?? data.ratingCount ?? 0) || 0
    return { success: true, stats: { assignedOrders, completedDeliveries, ratingCount } }
  } catch (error) {
    logError("[admin] getDriverStats", error)
    return { success: false, error: "تعذّر تحميل إحصاءات السائق" }
  }
}

// ==================== ADM-04: إدارة الحسابات (تفعيل/تعطيل الحسابات) ====================
// أداة حوكمة: عرض العملاء/البائعين/السائقين وتفعيل/تعطيل (حظر) الحساب. التعطيل مُنفَّذ إجباريًا
// سيرفر-سايد (ليس تجميليًا):
//   • العميل/البائع (حساب Firebase Auth): admin.auth().updateUser(uid,{disabled}) يجعل Firebase نفسه
//     يرفض إصدار توكنات جديدة، و getCurrentUid() (verifySessionCookie بـ checkRevoked=true) يرفض
//     الجلسة الحالية فورًا. + علم users/{uid}.disabled (عرض + طبقة دفاع تُفحص في getCurrentUser).
//   • السائق (جلسة PIN مخصّصة، بلا Firebase Auth): علم drivers/{id}.disabled يفحصه getCurrentDriverId
//     على كل طلب فيُعامَل السائق كغير موثّق فورًا.
// حرِج (أمان): لا نُرجع أبدًا أي أسرار (pin/pin_hash/pin_salt) ولا نسمح بتعطيل حساب إداري
//   (admin/superAdmin) ولا بأن يُعطّل الأدمن حسابه هو.

// فحص دور إداري على القيمة الخام (قد تكون superAdmin من لوحة Flutter) — للحارس، غير حسّاس لحالة الأحرف.
function isAdminRole(role: unknown): boolean {
  const r = String(role || "").toLowerCase()
  return r === "admin" || r === "superadmin" || r === "super_admin"
}

// حساب كما يراه الأدمن — إسقاط آمن بلا أي أسرار.
export type AdminAccount = {
  uid: string
  name: string
  phone?: string
  email?: string
  role: "customer" | "seller" | "driver"
  disabled: boolean
  // أعلام اختيارية حسب الدور (اعتماد المتجر/السائق + توثيق الهاتف) — للعرض فقط.
  is_approved?: boolean
  phone_verified?: boolean
  created_at?: string
}

export type AccountRoleFilter = "customer" | "seller" | "driver" | "all"

// إسقاط مستند users → AdminAccount (عميل/بائع). نستبعد الأدمن (غير قابل للإدارة هنا) بإرجاع null.
function mapUserAccount(id: string, data: Record<string, any>): AdminAccount | null {
  const role = String(data?.role || "customer")
  if (isAdminRole(role)) return null
  const isSeller = role === "seller"
  const store = (data?.store || {}) as Record<string, any>
  return serializeData({
    uid: id,
    name: (isSeller ? store.name : "") || data?.full_name || data?.name || "",
    phone: store.phone || data?.phone || "",
    email: data?.email || "",
    role: isSeller ? "seller" : "customer",
    disabled: data?.disabled === true,
    is_approved: isSeller ? store.is_approved === true : undefined,
    phone_verified: data?.phone_verified === true,
    created_at: data?.created_at || "",
  }) as AdminAccount
}

// إسقاط مستند drivers → AdminAccount. لا نقرأ/نُرجع أبدًا pin/pin_hash/pin_salt.
function mapDriverAccount(id: string, data: Record<string, any>): AdminAccount {
  return serializeData({
    uid: id,
    name: data?.name || "",
    phone: data?.phone || "",
    role: "driver",
    disabled: data?.disabled === true,
    is_approved: (data?.isApproved ?? data?.is_approved) === true,
    created_at: data?.createdAt?.toDate?.()?.toISOString?.() || data?.created_at || "",
  }) as AdminAccount
}

// قائمة الحسابات حسب الدور — إسقاط آمن بلا أسرار. مقيّدة بحدّ أعلى (البحث/الفلترة يتمّان في الواجهة).
export async function getAdminAccounts(
  roleFilter: AccountRoleFilter = "all",
): Promise<{ success: boolean; accounts?: AdminAccount[]; truncated?: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const USERS_CAP = 1000
  const DRIVERS_CAP = 500
  try {
    const db = getAdminDb()
    const accounts: AdminAccount[] = []
    let truncated = false // بلغنا السقف — بعض الحسابات قد لا تظهر (نُنبّه الأدمن)

    const wantUsers = roleFilter === "customer" || roleFilter === "seller" || roleFilter === "all"
    const wantDrivers = roleFilter === "driver" || roleFilter === "all"

    if (wantUsers) {
      let q: Query = db.collection("users")
      if (roleFilter === "customer") q = q.where("role", "==", "customer")
      else if (roleFilter === "seller") q = q.where("role", "==", "seller")
      // حدّ أعلى وقائي (قاعدة العملاء قد تكبر) — لا نقرأ المجموعة كاملةً دون سقف.
      const snap = await q.limit(USERS_CAP).get()
      if (snap.size >= USERS_CAP) truncated = true
      snap.docs.forEach((d) => {
        const acc = mapUserAccount(d.id, d.data() as Record<string, any>)
        if (acc) accounts.push(acc)
      })
    }

    if (wantDrivers) {
      const snap = await db.collection("drivers").limit(DRIVERS_CAP).get()
      if (snap.size >= DRIVERS_CAP) truncated = true
      snap.docs.forEach((d) => accounts.push(mapDriverAccount(d.id, d.data() as Record<string, any>)))
    }

    if (truncated) logError("[admin] getAdminAccounts truncated at cap", { roleFilter })

    // المعطَّلون أولًا (لجذب انتباه الأدمن)، ثم الأحدث أولًا.
    accounts.sort((a, b) => {
      if (a.disabled !== b.disabled) return Number(b.disabled) - Number(a.disabled)
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
    return { success: true, accounts, truncated }
  } catch (error) {
    logError("[admin] getAdminAccounts", error)
    return { success: false, error: "تعذّر تحميل الحسابات" }
  }
}

// تفعيل/تعطيل (حظر) حساب. الإنفاذ إجباري سيرفر-سايد (انظر رأس القسم).
// حراس: (1) لا يُعطّل الأدمن حسابه هو، (2) لا يُعطَّل حساب إداري (admin/superAdmin).
export async function setAccountDisabled(
  uid: string,
  disabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const id = String(uid || "").trim()
  if (!id) return { success: false, error: "معرّف غير صالح" }
  // حارس: لا يُعطّل الأدمن نفسه (يمنع قفله لنفسه خارج اللوحة)
  if (id === admin.uid) return { success: false, error: "لا يمكنك تعطيل حسابك" }

  const now = new Date().toISOString()
  try {
    const db = getAdminDb()

    // نحلّ نوع الحساب سيرفر-سايد: مستخدم (عميل/بائع) في users أولًا، وإلا سائق في drivers.
    const userRef = db.collection("users").doc(id)
    const userSnap = await userRef.get()

    if (userSnap.exists) {
      const data = userSnap.data() as Record<string, any>
      // حارس: لا نُعطّل حسابًا إداريًا (الحوكمة للعملاء/البائعين/السائقين فقط)
      if (isAdminRole(data?.role)) {
        return { success: false, error: "لا يمكن تعطيل حساب إداري" }
      }
      // إنفاذ عبر Firebase Auth: updateUser(disabled) يرفض التوكنات الجديدة + يُبطل الجلسة الحالية
      // (checkRevoked=true في getCurrentUid). إن لم يوجد سجل Auth (بيانات مصدّرة/بذور) نتابع بعلم
      // Firestore وحده — يُنفَّذ عبر getCurrentUser. أي خطأ Auth آخر يُرمى ليُعالَج في الـcatch الخارجي.
      const setAuthDisabled = async () => {
        try {
          await getAdminAuth().updateUser(id, { disabled })
        } catch (e) {
          if ((e as { code?: string })?.code !== "auth/user-not-found") throw e
        }
      }
      const setFirestoreDisabled = () =>
        userRef.update({ disabled, disabled_at: disabled ? now : null, updated_at: now })
      // ترتيب الكتابتين حسب الاتجاه ليكون الفشل الجزئي دائمًا في الجانب الآمن (يبقى مقفولًا):
      //   • تعطيل: Auth أولًا (لو فشلت Firestore بعده يبقى الحساب مقفولًا فعلًا عبر checkRevoked).
      //   • تفعيل: Firestore أولًا (لو فشل Auth بعده يبقى مقفولًا بعلم Firestore حتى إعادة المحاولة —
      //     نتفادى فتح Auth وترك علم Firestore عالقًا فيُحجب المستخدم الشرعي في getCurrentUser).
      if (disabled) {
        await setAuthDisabled()
        await setFirestoreDisabled()
      } else {
        await setFirestoreDisabled()
        await setAuthDisabled()
      }
      revalidatePath("/admin/accounts")
      // حظر بائع يجب أن يُخفي متجره من الواجهة العامة فورًا (قراءات المتاجر تستبعد disabled) — نُبطل الكاش.
      if (data?.role === "seller") revalidateTag("stores", "max")
      return { success: true }
    }

    // سائق؟ (بلا Firebase Auth — الإنفاذ عبر علم drivers/{id}.disabled الذي يفحصه getCurrentDriverId)
    const driverRef = db.collection("drivers").doc(id)
    const driverSnap = await driverRef.get()
    if (driverSnap.exists) {
      await driverRef.update({ disabled, disabled_at: disabled ? now : null, updated_at: now })
      revalidatePath("/admin/accounts")
      return { success: true }
    }

    return { success: false, error: "الحساب غير موجود" }
  } catch (error) {
    logError("[admin] setAccountDisabled", error)
    return { success: false, error: "تعذّر تحديث حالة الحساب" }
  }
}

// ==================== إدارة الطلبات (قائمة/تفاصيل/إلغاء مع استعادة المخزون) ====================
// النطاق: عرض + تفاصيل + إلغاء-مع-استعادة-مخزون فقط (لا تعديل حالة ولا تعيين سائق بعد).
// أمان: كل الأكشن مُقيّدة بـ ensureAdmin()، والدور مُشتق من قاعدة البيانات سيرفر-سايد.
// خصوصية: لا نُرجع أبدًا delivery_code (كود إثبات التسليم الخاص بالعميل) — لا في القائمة ولا في التفاصيل.

// ملخّص طلب كما يراه الأدمن — بلا كود التسليم إطلاقًا.
export type AdminOrderSummary = {
  id: string
  order_type: "single" | "multi_store"
  status: string
  total: number
  created_at: string
  customer_name: string
  customer_phone: string
  store_id: string
  store_name: string
  driver_name: string
  items_count: number
}

// عنصر ضمن تفاصيل الطلب
export type AdminOrderItem = {
  id: string
  product_id: string
  name: string
  quantity: number
  price: number
  store_id?: string
}

// تفاصيل طلب كاملة للأدمن — بلا كود التسليم إطلاقًا.
export type AdminOrderDetail = {
  id: string
  order_type: "single" | "multi_store"
  status: string
  total: number
  subtotal?: number
  delivery_price?: number
  created_at: string
  updated_at?: string
  delivered_at?: string
  cancelled_at?: string
  cancel_reason?: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  delivery_address?: string
  delivery_city?: string
  delivery_state?: string
  delivery_notes?: string
  landmark?: string
  store_id?: string
  store_name?: string
  driver_id?: string
  driver_name?: string
  driver_phone?: string
  items: AdminOrderItem[]
  pickup_stops?: PickupStop[]
}

// طلب استفسار تواصل (WhatsApp/Call) — نستبعده من قوائم الطلبات (mirror isInquiryOrder في orders.ts)
function isInquiryOrderLike(o: Record<string, any>): boolean {
  return (
    o.order_type === "inquiry" ||
    o.status === "inquiry" ||
    o.delivery_address === "Contact via WhatsApp" ||
    o.delivery_address === "Contact via Phone"
  )
}

function toIso(v: any): string {
  if (!v) return ""
  if (typeof v?.toDate === "function") return v.toDate().toISOString()
  return String(v)
}

// جلب دفعة مستندات بالمعرّفات (getAll) → خريطة id→data
async function getDocsMap(db: Firestore, collection: string, ids: string[]): Promise<Map<string, Record<string, any>>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const map = new Map<string, Record<string, any>>()
  if (unique.length === 0) return map
  const refs = unique.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  docs.forEach((doc) => {
    if (doc.exists) map.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, any>) })
  })
  return map
}

// عدد أسطر كل طلب (order_items) دفعة واحدة عبر استعلامات in مُقطّعة (حد 10 لكل استعلام)
async function getItemsCountMap(db: Firestore, orderIds: string[]): Promise<Map<string, number>> {
  const unique = Array.from(new Set(orderIds.filter(Boolean)))
  const map = new Map<string, number>()
  if (unique.length === 0) return map
  for (const chunk of chunkArray(unique, 10)) {
    const snap = await db.collection("order_items").where("order_id", "in", chunk).get()
    snap.docs.forEach((doc) => {
      const oid = String(doc.data().order_id || "")
      if (oid) map.set(oid, (map.get(oid) || 0) + 1)
    })
  }
  return map
}

// قائمة الطلبات (أحادية + متعددة المتاجر) الأحدث أولًا، مقيّدة بحدّ أعلى.
// فلترة سيرفر-سايد (لا تقتصر على أحدث نافذة فيتعذّر إيجاد/إلغاء الطلبات الأقدم):
//   • status حقيقي (غير "all") ⇒ .where("status","==",status) — استعلام مساواة بفهرس حقل واحد تلقائي
//     (لا نضمّه إلى orderBy(created_at) لأن ذلك يتطلّب فهرسًا مركّبًا غير موجود؛ نرتّب في الذاكرة).
//   • query ⇒ نحلّه سيرفر-سايد: إن طابق معرّف طلب فبحث مباشر بالمستند، وإلا نعامله كرقم هاتف
//     عبر .where("customer_phone","==",query) (بعد trim).
// لا نُدرج delivery_code في الملخّص إطلاقًا (يُبنى من حقول محدّدة فلا يتسرّب الكود).
export async function getAdminOrders(
  opts?: { status?: string; query?: string; limit?: number },
): Promise<{ success: boolean; orders?: AdminOrderSummary[]; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const cap = Math.min(Math.max(Number(opts?.limit) || 100, 1), 300)
    const statusFilter = opts?.status && opts.status !== "all" ? String(opts.status) : null
    const rawQuery = String(opts?.query || "").trim()

    let rows: Record<string, any>[] = []

    if (rawQuery) {
      // بحث: نجرّب معرّف طلب أولًا (قراءة مستند مباشرة)، وإلا نعامله كرقم هاتف.
      const byId = await db.collection("orders").doc(rawQuery).get()
      if (byId.exists) {
        rows = [{ id: byId.id, ...(byId.data() as Record<string, any>) }]
      } else {
        const snap = await db.collection("orders").where("customer_phone", "==", rawQuery).limit(cap).get()
        rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
      }
      // عند البحث نطبّق فلتر الحالة (إن وُجد) في الذاكرة كي تبقى النتائج متسقة مع اللسان النشط
      if (statusFilter) rows = rows.filter((o) => String(o.status || "") === statusFilter)
    } else if (statusFilter) {
      // فلتر حالة سيرفر-سايد (مساواة بفهرس حقل واحد) — نرتّب الأحدث أولًا في الذاكرة
      const snap = await db.collection("orders").where("status", "==", statusFilter).limit(cap).get()
      rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    } else {
      // "الكل": أحدث نافذة عبر فهرس created_at الحقل-الواحد (متوفّر تلقائيًا)
      const snap = await db.collection("orders").orderBy("created_at", "desc").limit(cap).get()
      rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    }

    // استبعاد طلبات الاستفسار (pseudo-orders)
    rows = rows.filter((o) => !isInquiryOrderLike(o))
    // ترتيب الأحدث أولًا في الذاكرة (مسارات where/البحث لا تحمل orderBy)
    rows.sort((a, b) => toIso(b.created_at).localeCompare(toIso(a.created_at)))

    const storeIds = rows
      .filter((o) => o.order_type !== "multi_store")
      .map((o) => String(o.store_id || ""))
    const customerIds = rows.map((o) => String(o.customer_id || ""))

    const [storeMap, customerMap, itemsCountMap] = await Promise.all([
      getDocsMap(db, "users", storeIds),
      getDocsMap(db, "users", customerIds),
      getItemsCountMap(db, rows.map((o) => o.id)),
    ])

    const orders: AdminOrderSummary[] = rows.map((o) => {
      const isMulti = o.order_type === "multi_store"
      const storeUser = !isMulti && o.store_id ? storeMap.get(String(o.store_id)) : null
      const customerUser = o.customer_id ? customerMap.get(String(o.customer_id)) : null
      return {
        id: o.id,
        order_type: isMulti ? "multi_store" : "single",
        status: String(o.status || ""),
        total: Number(o.total) || 0,
        created_at: toIso(o.created_at),
        customer_name: String(o.customer_name || customerUser?.full_name || ""),
        customer_phone: String(o.customer_phone || customerUser?.phone || ""),
        store_id: isMulti ? "" : String(o.store_id || ""),
        store_name: isMulti ? "متعدد المتاجر" : String(storeUser?.store?.name || ""),
        driver_name: String(o.driver_name || ""),
        items_count: itemsCountMap.get(o.id) || 0,
      }
    })

    return { success: true, orders }
  } catch (error) {
    logError("[admin] getAdminOrders", error)
    return { success: false, error: "تعذّر تحميل الطلبات" }
  }
}

// تفاصيل طلب كاملة (عناصر + عميل + متجر + سائق). لا نُدرج delivery_code إطلاقًا.
export async function getAdminOrderDetail(
  orderId: string,
): Promise<{ success: boolean; order?: AdminOrderDetail; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const orderDoc = await db.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) return { success: false, error: "الطلب غير موجود" }
    const data = orderDoc.data() as Record<string, any>
    const isMulti = data.order_type === "multi_store"

    // عناصر الطلب + أسماء المنتجات
    const itemsSnap = await db.collection("order_items").where("order_id", "==", orderId).get()
    const productIds = itemsSnap.docs.map((d) => String(d.data().product_id || "")).filter(Boolean)
    const [productMap, customerDoc, driverDoc] = await Promise.all([
      getDocsMap(db, "products", productIds),
      data.customer_id ? db.collection("users").doc(String(data.customer_id)).get() : Promise.resolve(null),
      data.driver_id ? db.collection("drivers").doc(String(data.driver_id)).get() : Promise.resolve(null),
    ])
    const items: AdminOrderItem[] = itemsSnap.docs.map((d) => {
      const it = d.data() as Record<string, any>
      const product = productMap.get(String(it.product_id))
      return {
        id: d.id,
        product_id: String(it.product_id || ""),
        name: String(product?.name || it.name || "منتج"),
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
        store_id: it.store_id ? String(it.store_id) : undefined,
      }
    })

    const customer = customerDoc?.exists ? (customerDoc.data() as Record<string, any>) : null
    const driver = driverDoc?.exists ? (driverDoc.data() as Record<string, any>) : null

    let storeName = ""
    if (!isMulti && data.store_id) {
      const storeDoc = await db.collection("users").doc(String(data.store_id)).get()
      storeName = String((storeDoc.data() as Record<string, any>)?.store?.name || "")
    }

    const order: AdminOrderDetail = {
      id: orderDoc.id,
      order_type: isMulti ? "multi_store" : "single",
      status: String(data.status || ""),
      total: Number(data.total) || 0,
      subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
      delivery_price: data.delivery_price != null ? Number(data.delivery_price) : undefined,
      created_at: toIso(data.created_at),
      updated_at: data.updated_at ? toIso(data.updated_at) : undefined,
      delivered_at: data.delivered_at ? toIso(data.delivered_at) : undefined,
      cancelled_at: data.cancelled_at ? toIso(data.cancelled_at) : undefined,
      cancel_reason: data.cancel_reason ? String(data.cancel_reason) : undefined,
      customer_name: String(data.customer_name || customer?.full_name || ""),
      customer_phone: String(data.customer_phone || customer?.phone || ""),
      customer_email: customer?.email ? String(customer.email) : undefined,
      delivery_address: data.delivery_address ? String(data.delivery_address) : undefined,
      delivery_city: data.delivery_city ? String(data.delivery_city) : undefined,
      delivery_state: data.delivery_state ? String(data.delivery_state) : undefined,
      delivery_notes: data.delivery_notes ? String(data.delivery_notes) : undefined,
      landmark: data.landmark ? String(data.landmark) : undefined,
      store_id: isMulti ? undefined : String(data.store_id || ""),
      store_name: isMulti ? "متعدد المتاجر" : storeName,
      driver_id: data.driver_id ? String(data.driver_id) : undefined,
      driver_name: String(data.driver_name || driver?.name || ""),
      driver_phone: driver?.phone ? String(driver.phone) : undefined,
      items,
      // pickup_stops لا تحتوي كود التسليم (هو حقل top-level) — آمن إدراجها للطلب متعدد المتاجر.
      // نطبّع كل محطة كي تكون items دائمًا مصفوفة (محطات قديمة/تالفة قد تفتقدها → تعطّل الواجهة).
      pickup_stops: isMulti
        ? (serializeData(data.pickup_stops || []) as PickupStop[]).map((s) => ({
            ...s,
            items: Array.isArray(s?.items) ? s.items : [],
          }))
        : undefined,
    }

    return { success: true, order }
  } catch (error) {
    logError("[admin] getAdminOrderDetail", error)
    return { success: false, error: "تعذّر تحميل تفاصيل الطلب" }
  }
}

// إلغاء طلب (إداري) مع استعادة المخزون ذرّيًا.
// نُطابق مسار الإلغاء/الرفض القائم في orders.ts:
//   - أحادي المتجر: استعادة من order_items (مثل updateOrderStatus عند status==="cancelled")
//   - متعدد المتاجر: لكل محطة من pickup_stops، مع تخطّي المرفوضة (استُعيدت عبر rejectStorePickup)
//     والمُستَلَمة picked_up (البضاعة خرجت فعليًا) — نفس دلالة rejectStorePickup.
// حارس: لا نُعيد الاستعادة لطلب ملغى/مُسلَّم مسبقًا، وعلم stock_restored يمنع الاستعادة المزدوجة.
export async function adminCancelOrder(orderId: string, reason: string) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const cancelReason = String(reason || "").trim()
  if (!cancelReason) return { success: false, error: "يرجى إدخال سبب الإلغاء" }
  try {
    const db = getAdminDb()
    const orderRef = db.collection("orders").doc(orderId)
    const now = new Date().toISOString()

    // القراءات على order_items تتم خارج المعاملة (مطابق لـ updateOrderStatus) — المعاملة تعيد قراءة
    // مستند الطلب وتضبط الأعلام ذرّيًا (القراءات قبل الكتابات داخل المعاملة).
    const itemsSnap = await db.collection("order_items").where("order_id", "==", orderId).get()

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)
      if (!snap.exists) return { ok: false as const, error: "الطلب غير موجود" }
      const data = snap.data() as Record<string, any>

      if (isInquiryOrderLike(data)) return { ok: false as const, error: "لا يمكن إلغاء استفسار تواصل" }

      const status = String(data.status || "")
      if (status === "cancelled") return { ok: false as const, error: "الطلب ملغى بالفعل" }
      if (status === "delivered") return { ok: false as const, error: "لا يمكن إلغاء طلب مُسلَّم" }

      const alreadyRestored = data.stock_restored === true

      // دفاع في العمق: عند إلغاء طلب متعدد المتاجر نُرمّن (نُنهي) محطاته المُستعادة أيضًا بضبط
      // حالتها إلى "cancelled" في المصفوفة المكتوبة، فتعكس المحطات إلغاء الطلب ولا تبقى
      // pending/confirmed بجانب طلب ملغى (جنبًا إلى جنب مع حارس الحالة في آلة المحطات).
      let terminalizedStops: any[] | null = null

      if (!alreadyRestored) {
        if (data.order_type === "multi_store") {
          const stops: any[] = Array.isArray(data.pickup_stops) ? data.pickup_stops : []
          terminalizedStops = stops.map((stop) => {
            // المرفوضة استُعيدت عبر rejectStorePickup؛ المُستَلَمة خرجت بضاعتها فعليًا — نتركها كما هي
            if (stop?.status === "rejected" || stop?.status === "picked_up") return stop
            for (const it of stop?.items || []) {
              const qty = Number(it?.quantity) || 0
              if (it?.product_id && qty > 0) {
                tx.update(db.collection("products").doc(String(it.product_id)), {
                  stock: FieldValue.increment(qty),
                })
              }
            }
            // المحطة المُستعادة (pending/confirmed) تُصبح "cancelled" لتعكس إلغاء الطلب
            return { ...stop, status: "cancelled" }
          })
        } else {
          for (const itemDoc of itemsSnap.docs) {
            const it = itemDoc.data() as Record<string, any>
            const qty = Number(it.quantity) || 0
            if (it.product_id && qty > 0) {
              tx.update(db.collection("products").doc(String(it.product_id)), {
                stock: FieldValue.increment(qty),
              })
            }
          }
        }
      }

      const timeline = Array.isArray(data.timeline) ? [...data.timeline] : []
      timeline.push({ status: "cancelled", timestamp: now, note: `إلغاء إداري: ${cancelReason}` })

      tx.update(orderRef, {
        status: "cancelled",
        cancelled_at: now,
        cancel_reason: cancelReason,
        stock_restored: true,
        updated_at: now,
        timeline,
        // نكتب المحطات المُرمَّنة فقط للطلب متعدد المتاجر عند الاستعادة الفعلية
        ...(terminalizedStops ? { pickup_stops: terminalizedStops } : {}),
      })

      return {
        ok: true as const,
        customerId: String(data.customer_id || ""),
        orderType: data.order_type === "multi_store" ? "multi_store" : "single",
      }
    })

    if (!result.ok) return { success: false, error: result.error }

    // إخطار العميل (أفضل-جهد؛ لا يفشل الإلغاء إن فشل الإشعار)
    if (result.customerId) {
      try {
        await createNotification({
          user_id: result.customerId,
          title: "تم إلغاء طلبك",
          title_en: "Your order was cancelled",
          message: `تم إلغاء طلبك من قبل الإدارة. السبب: ${cancelReason}`,
          message_en: `Your order was cancelled by the admin. Reason: ${cancelReason}`,
          type: "order_status",
          link: result.orderType === "multi_store" ? `/account/edit-order/${orderId}` : "/account",
          data: { order_id: orderId, status: "cancelled" },
        })
      } catch (e) {
        logError("[admin] adminCancelOrder notification", e)
      }
    }

    revalidatePath("/admin/orders")
    revalidatePath("/seller/orders")
    revalidatePath("/account")
    return { success: true }
  } catch (error) {
    logError("[admin] adminCancelOrder", error)
    return { success: false, error: "تعذّر إلغاء الطلب" }
  }
}

// ==================== إعدادات العمولة ورسوم التوصيل ====================
// إدارة settings/driverCommission و settings/delivery (دمج لوحة Flutter داخل /admin).
//
// حرِج جدًا: lib/actions/delivery.ts getDriverCommission() يقرأ data.rate بالضبط من
// settings/driverCommission، وموقع العملاء يعتمد عليه. لذلك نكتب rate دائمًا كي لا ينكسر الموقع.
//
// وحدة rate = مبلغ ثابت بالجنيه (وليست نسبة ولا كسرًا). الدليل من الاستخدام في الموقع:
//   • app/account/change-driver/page.tsx: `driverData.price + driverCommission` ويُعرَض
//     «سيتم إضافة {price + commission} جنيه للطلب» — الجمع مع سعر السائق (جنيه) ⇒ العمولة بالجنيه.
//   • lib/actions/dashboard.ts: `orderTotal - delivery - commission` — تُطرَح كمبلغ مالي.
//   • app/checkout/delivery/page.tsx: تُمرَّر كحقل driver_commission (حصّة المنصّة المالية).
// لذلك النموذج يعرضها/يكتبها كعدد جنيهات.

// مفاتيح محتملة لسعر التوصيل الأساسي في settings/delivery (خزّنه تطبيق Flutter؛ الموقع لا يقرؤه بعد).
// نكتشف المفتاح الموجود فعلًا ونكتب فوقه (round-trip آمن يطابق ما خزّنه Flutter)،
// وإلا نفترض base_price لمستند جديد.
const DELIVERY_BASE_PRICE_KEYS = ["base_price", "basePrice", "price", "base", "deliveryBasePrice", "amount", "value"]

function detectDeliveryBasePriceKey(data: Record<string, any> | null | undefined): { key: string; value: number } {
  const d = data || {}
  for (const k of DELIVERY_BASE_PRICE_KEYS) {
    const v = d[k]
    if (typeof v === "number" && Number.isFinite(v)) return { key: k, value: v }
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return { key: k, value: Number(v) }
  }
  return { key: DELIVERY_BASE_PRICE_KEYS[0], value: 0 }
}

export type CommissionSettings = {
  rate: number // عمولة المنصّة الثابتة بالجنيه (settings/driverCommission.rate) — يقرؤها الموقع
  deliveryBasePrice: number // سعر التوصيل الأساسي (settings/delivery)
  deliveryBasePriceKey: string // اسم المفتاح المُكتشَف في settings/delivery (لحفظ آمن على نفس المفتاح)
  // حقول رقمية إضافية محفوظة على settings/driverCommission (شرائح Flutter مثلًا) — للعرض فقط،
  // لا نلمسها عند الحفظ (merge:true يُبقيها كما هي).
  extraCommissionFields: { key: string; value: number }[]
  updated_at: string | null
}

// قراءة إعدادات العمولة ورسوم التوصيل. قيم افتراضية آمنة عند غياب المستندات.
export async function getCommissionSettings(): Promise<{
  success: boolean
  settings?: CommissionSettings
  error?: string
}> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const [commissionSnap, deliverySnap] = await Promise.all([
      db.collection("settings").doc("driverCommission").get(),
      db.collection("settings").doc("delivery").get(),
    ])
    const commission = (commissionSnap.exists ? commissionSnap.data() : {}) as Record<string, any>
    const delivery = (deliverySnap.exists ? deliverySnap.data() : {}) as Record<string, any>

    const rate = Number.isFinite(Number(commission.rate)) ? Number(commission.rate) : 0
    const { key: deliveryBasePriceKey, value: deliveryBasePrice } = detectDeliveryBasePriceKey(delivery)

    // شرائح/حقول رقمية إضافية على driverCommission (عدا rate/updated_at) — نعرضها كما هي دون المساس بها.
    const extraCommissionFields = Object.entries(commission)
      .filter(([k, v]) => k !== "rate" && k !== "updated_at" && typeof v === "number" && Number.isFinite(v))
      .map(([key, value]) => ({ key, value: Number(value) }))

    const updated_at: string | null =
      (typeof commission.updated_at === "string" && commission.updated_at) ||
      (typeof delivery.updated_at === "string" && delivery.updated_at) ||
      null

    return {
      success: true,
      settings: serializeData({
        rate,
        deliveryBasePrice,
        deliveryBasePriceKey,
        extraCommissionFields,
        updated_at,
      }) as CommissionSettings,
    }
  } catch (error) {
    logError("[admin] getCommissionSettings", error)
    return { success: false, error: "تعذّر تحميل الإعدادات" }
  }
}

// كتابة الإعدادات مع merge:true.
// حرِج: نكتب rate دائمًا على settings/driverCommission كي يبقى getDriverCommission يعمل،
// ولا نلمس أي حقول أخرى (الشرائح تبقى بفضل merge:true). سعر التوصيل يُكتب على المفتاح الموجود فعلًا.
export async function setCommissionSettings(input: {
  rate: number
  deliveryBasePrice?: number
}): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }

  const rate = Number(input?.rate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000) {
    return { success: false, error: "قيمة العمولة غير صالحة" }
  }

  let deliveryBasePrice: number | null = null
  if (input?.deliveryBasePrice != null && String(input.deliveryBasePrice) !== "") {
    const dp = Number(input.deliveryBasePrice)
    if (!Number.isFinite(dp) || dp < 0 || dp > 1_000_000) {
      return { success: false, error: "قيمة رسوم التوصيل غير صالحة" }
    }
    deliveryBasePrice = dp
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    // settings/driverCommission — نكتب rate دائمًا (الحقل الذي يقرؤه الموقع) + updated_at، بدمج.
    await db.collection("settings").doc("driverCommission").set({ rate, updated_at: now }, { merge: true })

    // settings/delivery — نكتب سعر التوصيل الأساسي على نفس المفتاح الموجود (اكتشاف من الخادم، بلا اسم من العميل).
    if (deliveryBasePrice != null) {
      const deliverySnap = await db.collection("settings").doc("delivery").get()
      const { key } = detectDeliveryBasePriceKey(
        deliverySnap.exists ? (deliverySnap.data() as Record<string, any>) : null,
      )
      await db.collection("settings").doc("delivery").set({ [key]: deliveryBasePrice, updated_at: now }, { merge: true })
    }

    revalidatePath("/admin/commission-settings")
    return { success: true }
  } catch (error) {
    logError("[admin] setCommissionSettings", error)
    return { success: false, error: "تعذّر حفظ الإعدادات" }
  }
}

// ==================== الصفحة الرئيسية للإدارة (KPIs) ====================
// getAdminDashboardStats: إحصاءات at-a-glance للوحة الإدارة (الطلبات/المتاجر/السائقون/العملاء + أحدث النشاط).
//
// أداء (حرِج): نستخدم COUNT AGGREGATIONS الرخيصة (query.count().get()) لكل الأعداد — لا نقرأ أي مجموعة
// كاملة أبدًا. الاستثناء الوحيد قراءةٌ صغيرة مقيّدة بحدّ (limit) لقائمة «أحدث الطلبات» — وليست قراءة مجموعة.
//
// متانة: كل عدّاد في try/catch مستقل (عبر safeCount) — فشل عدّاد واحد يُرجع 0 ولا يكسر الصفحة.
//
// خصوصية: قائمة أحدث الطلبات لا تتضمن أبدًا delivery_code (كود إثبات التسليم) — لا نقرؤه ولا نُرجعه.

export type AdminRecentOrder = {
  id: string
  status: string
  total: number
  customer_name: string
  created_at: string
}

export type AdminDashboardStats = {
  orders: {
    total: number
    pending: number
    confirmed: number
    on_the_way: number
    delivered: number
    cancelled: number
  }
  stores: {
    total: number
    pending: number
    // false إذا فشل عدّ المعتمدين (فهرس حقل متداخل قد يكون معفى) فتعذّر اشتقاق قيد-المراجعة بدقّة.
    pendingSupported: boolean
  }
  drivers: {
    total: number
    pending: number
  }
  customers: {
    total: number
  }
  recentOrders: AdminRecentOrder[]
}

// عدّاد آمن: count aggregation رخيص (لا يقرأ الوثائق) مع try/catch مستقل — فشله يُرجع 0.
async function safeCount(label: string, query: Query): Promise<number> {
  try {
    const snap = await query.count().get()
    return Number(snap.data().count) || 0
  } catch (e) {
    logError(`[admin] dashboard count: ${label}`, e)
    return 0
  }
}

// ==================== إدارة الفئات (الأقسام) والأقسام الفرعية ====================
// دمج شاشة الفئات من لوحة Flutter داخل /admin. كل الأكشن مُقيّدة بـ ensureAdmin() (الدور مُشتق سيرفر-سايد).
//
// حرِج جدًا — شكل الحقول الذي يقرؤه موقع العملاء (يجب عدم كسره):
//   • مستند الفئة (collection `categories`): الموقع يقرأ حقل **name** فقط (نص) + معرّف المستند (id):
//       - lib/firebase/categories.ts: query(where("name","==",storeCategory)) و doc.data().name.
//       - app/auth/seller/register/page.tsx: doc.data().name (قائمة الفئات عند التسجيل).
//       - lib/actions/stores.ts getCategoryNameById + product-form-actions getCategoryNameForForm: data.name.
//     لذلك **name** هو الحقل الحيوي — نكتبه دائمًا ولا نغيّر شكله (نص). أي حقول إضافية أنشأها
//     تطبيق Flutter (icon/order/name_en...) نحافظ عليها عبر update() الجزئي — لا نمسحها إطلاقًا.
//   • مستندات المجموعة الفرعية (categories/{id}/subcategories): الموقع يقرأ حقل **name** فقط + معرّف
//     المستند (fetchStoreSubcategories/ByKeywords/ByCategoryId في lib/firebase/categories.ts). نكتب name فقط.
//
// ملاحظة FK: المنتجات والمتاجر تشير للفئة/القسم الفرعي بالاسم (نص) لا بمعرّف المستند
// (products.category == اسم القسم، store.category == اسم الفئة). لذا حذف مستند الفئة لا يتتالى
// للمنتجات؛ ومع ذلك نمنع حذف فئة يشير إليها متجر (حارس best-effort) كي لا نُيتّم اختيار الأقسام.

export type AdminSubcategory = {
  id: string
  name: string
}

export type AdminCategory = {
  id: string
  name: string
  icon?: string
  order?: number
  subcategories: AdminSubcategory[]
}

// قائمة كل الفئات مع أقسامها الفرعية — مقيّدة بحدّ أعلى (مرجعية صغيرة عادةً).
export async function getAdminCategories(): Promise<{ success: boolean; categories?: AdminCategory[]; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const snap = await db.collection("categories").limit(200).get()
    const categories: AdminCategory[] = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as Record<string, any>
        // كل مجموعة فرعية صغيرة — حدّ أعلى وقائي
        const subSnap = await d.ref.collection("subcategories").limit(300).get()
        const subcategories: AdminSubcategory[] = subSnap.docs
          .map((s) => ({ id: s.id, name: String((s.data() as Record<string, any>).name || "") }))
          .filter((s) => s.name)
          .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        return serializeData({
          id: d.id,
          name: String(data.name || ""),
          // نعرض icon/order إن وُجدا (حقول Flutter اختيارية) — للعرض/التحرير فقط، والموقع لا يقرؤهما.
          icon: typeof data.icon === "string" && data.icon ? data.icon : undefined,
          order: typeof data.order === "number" && Number.isFinite(data.order) ? data.order : undefined,
          subcategories,
        }) as AdminCategory
      }),
    )
    // ترتيب: order (إن وُجد) ثم الاسم
    categories.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER
      const bo = b.order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name, "ar")
    })
    return { success: true, categories }
  } catch (error) {
    logError("[admin] getAdminCategories", error)
    return { success: false, error: "تعذّر تحميل الفئات" }
  }
}

// إنشاء فئة جديدة — نكتب name (حيوي) + icon/order اختياريًا. نمنع تكرار الاسم (الموقع يستعلم بالاسم).
export async function createCategory(input: {
  name: string
  icon?: string
  order?: number | null
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const name = String(input?.name || "").trim()
  if (!name) return { success: false, error: "اسم الفئة مطلوب" }
  if (name.length > 100) return { success: false, error: "اسم الفئة طويل جدًا" }
  try {
    const db = getAdminDb()
    // منع الاسم المكرّر — الموقع يستعلم where("name","==",...)، فالتكرار يجعل الاختيار غير حتمي.
    const dup = await db.collection("categories").where("name", "==", name).limit(1).get()
    if (!dup.empty) return { success: false, error: "توجد فئة بنفس الاسم" }

    const payload: Record<string, any> = { name }
    // حدود سيرفر-سايد (العميل يحدّها فقط، والأكشن عام قابل للتجاوز): icon ≤ 16 محرفًا، order رقم منتهٍ أو لا شيء.
    if (typeof input.icon === "string" && input.icon.trim()) payload.icon = input.icon.trim().slice(0, 16)
    if (input.order !== null && input.order !== undefined) {
      const orderNum = Number(input.order)
      if (Number.isFinite(orderNum)) payload.order = orderNum
    }

    const ref = await db.collection("categories").add(payload)
    revalidatePath("/admin/categories")
    return { success: true, id: ref.id }
  } catch (error) {
    logError("[admin] createCategory", error)
    return { success: false, error: "تعذّر إنشاء الفئة" }
  }
}

// تعديل فئة — تحديث جزئي: نكتب name دائمًا، ونحدّث icon/order فقط عند تمريرهما (فراغ ⇒ حذف الحقل).
// لا نستخدم set()-الكامل كي لا نمسح حقول Flutter الإضافية التي لا نعرضها.
export async function updateCategory(
  id: string,
  input: { name: string; icon?: string; order?: number | null },
): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const catId = String(id || "").trim()
  if (!catId) return { success: false, error: "معرّف الفئة مطلوب" }
  const name = String(input?.name || "").trim()
  if (!name) return { success: false, error: "اسم الفئة مطلوب" }
  if (name.length > 100) return { success: false, error: "اسم الفئة طويل جدًا" }
  try {
    const db = getAdminDb()
    const ref = db.collection("categories").doc(catId)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "الفئة غير موجودة" }
    const oldName = String((snap.data() as Record<string, any>).name || "")
    // منع تعارض الاسم مع فئة أخرى
    const dup = await db.collection("categories").where("name", "==", name).limit(2).get()
    if (dup.docs.some((d) => d.id !== catId)) return { success: false, error: "توجد فئة أخرى بنفس الاسم" }

    const patch: Record<string, any> = { name }
    if (input.icon !== undefined) {
      // حدّ سيرفر-سايد: icon ≤ 16 محرفًا (فراغ ⇒ حذف الحقل)
      const ic = String(input.icon).trim().slice(0, 16)
      patch.icon = ic ? ic : FieldValue.delete()
    }
    if (input.order !== undefined) {
      patch.order =
        input.order === null || !Number.isFinite(Number(input.order)) ? FieldValue.delete() : Number(input.order)
    }
    await ref.update(patch)

    // FIX 1 — تعاقب إعادة التسمية: الموقع يفلتر المتاجر بالاسم (store.category === name) ويحلّ الأقسام
    // الفرعية بالاسم أيضًا، فإعادة تسمية الفئة دون تحديث المتاجر تُسقطها من فلتر الموقع + منتقي أقسامها.
    // نحدّث كل متجر ينتمي للفئة بالمعرّف الثابت store.category_id (لا يتغيّر بإعادة التسمية) إلى الاسم الجديد.
    if (name !== oldName) {
      const nowIso = new Date().toISOString()
      const storesSnap = await db.collection("users").where("store.category_id", "==", catId).get()
      for (const chunk of chunkArray(storesSnap.docs, 400)) {
        const batch = db.batch()
        chunk.forEach((d) => batch.update(d.ref, { "store.category": name, "store.updated_at": nowIso }))
        await batch.commit()
      }
    }

    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error) {
    logError("[admin] updateCategory", error)
    return { success: false, error: "تعذّر تحديث الفئة" }
  }
}

// حذف فئة — حارس أمان يمنع الحذف إن كان متجر يشير للفئة بالاسم، ثم حذف المجموعة الفرعية + المستند
// في دفعة ذرّية واحدة (batch) في الحالة الشائعة (أقسام فرعية قليلة)، مع تقسيم آمن إن تجاوزت حدّ الدفعة.
export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const catId = String(id || "").trim()
  if (!catId) return { success: false, error: "معرّف الفئة مطلوب" }
  try {
    const db = getAdminDb()
    const ref = db.collection("categories").doc(catId)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "الفئة غير موجودة" }

    // FIX 2 — حارس: امنع حذف فئة يشير إليها متجر بالمعرّف الثابت store.category_id
    // (المعرّف لا يتغيّر بإعادة التسمية، بعكس الاسم). fail-closed: إن فشل الاستعلام (فهرس/بنية
    // تحتية) نمنع الحذف بدل السماح به على خطأ، حتى لا نُيتّم متاجر مرتبطة.
    try {
      const refStore = await db.collection("users").where("store.category_id", "==", catId).limit(1).get()
      if (!refStore.empty) {
        return { success: false, error: "لا يمكن حذف فئة مرتبطة بمتاجر. انقل المتاجر لفئة أخرى أولًا." }
      }
    } catch (e) {
      logError("[admin] deleteCategory store-ref check", e)
      return { success: false, error: "تعذّر التحقق من ارتباط المتاجر، حاول لاحقًا" }
    }

    // حذف المجموعة الفرعية subcategories + مستند الفئة.
    const subSnap = await ref.collection("subcategories").get()
    const subDocs = subSnap.docs
    if (subDocs.length <= 499) {
      // دفعة ذرّية واحدة (حدّ Firestore 500 عملية): كل الأقسام الفرعية + مستند الفئة معًا.
      const batch = db.batch()
      subDocs.forEach((s) => batch.delete(s.ref))
      batch.delete(ref)
      await batch.commit()
    } else {
      // نادر: عدد كبير من الأقسام الفرعية — نقسّم الحذف على دفعات ثم نحذف المستند الأب.
      for (const chunk of chunkArray(subDocs, 400)) {
        const batch = db.batch()
        chunk.forEach((s) => batch.delete(s.ref))
        await batch.commit()
      }
      await ref.delete()
    }

    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error) {
    logError("[admin] deleteCategory", error)
    return { success: false, error: "تعذّر حذف الفئة" }
  }
}

// إنشاء قسم فرعي داخل فئة — نكتب name فقط (الحقل الوحيد الذي يقرؤه الموقع). نمنع تكرار الاسم داخل الفئة.
export async function createSubcategory(
  categoryId: string,
  input: { name: string },
): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const catId = String(categoryId || "").trim()
  if (!catId) return { success: false, error: "معرّف الفئة مطلوب" }
  const name = String(input?.name || "").trim()
  if (!name) return { success: false, error: "اسم القسم الفرعي مطلوب" }
  if (name.length > 100) return { success: false, error: "الاسم طويل جدًا" }
  try {
    const db = getAdminDb()
    const catRef = db.collection("categories").doc(catId)
    const catSnap = await catRef.get()
    if (!catSnap.exists) return { success: false, error: "الفئة غير موجودة" }

    const dup = await catRef.collection("subcategories").where("name", "==", name).limit(1).get()
    if (!dup.empty) return { success: false, error: "يوجد قسم فرعي بنفس الاسم" }

    const ref = await catRef.collection("subcategories").add({ name })
    revalidatePath("/admin/categories")
    return { success: true, id: ref.id }
  } catch (error) {
    logError("[admin] createSubcategory", error)
    return { success: false, error: "تعذّر إنشاء القسم الفرعي" }
  }
}

// تعديل قسم فرعي — نحدّث name فقط (نحافظ على أي حقول أخرى عبر update() الجزئي).
export async function updateSubcategory(
  categoryId: string,
  subId: string,
  input: { name: string },
): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const catId = String(categoryId || "").trim()
  const sId = String(subId || "").trim()
  if (!catId || !sId) return { success: false, error: "معرّف غير صالح" }
  const name = String(input?.name || "").trim()
  if (!name) return { success: false, error: "اسم القسم الفرعي مطلوب" }
  if (name.length > 100) return { success: false, error: "الاسم طويل جدًا" }
  try {
    const db = getAdminDb()
    const catRef = db.collection("categories").doc(catId)
    const subRef = catRef.collection("subcategories").doc(sId)
    const subSnap = await subRef.get()
    if (!subSnap.exists) return { success: false, error: "القسم الفرعي غير موجود" }

    const dup = await catRef.collection("subcategories").where("name", "==", name).limit(2).get()
    if (dup.docs.some((d) => d.id !== sId)) return { success: false, error: "يوجد قسم فرعي آخر بنفس الاسم" }

    await subRef.update({ name })
    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error) {
    logError("[admin] updateSubcategory", error)
    return { success: false, error: "تعذّر تحديث القسم الفرعي" }
  }
}

// حذف قسم فرعي.
export async function deleteSubcategory(
  categoryId: string,
  subId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  const catId = String(categoryId || "").trim()
  const sId = String(subId || "").trim()
  if (!catId || !sId) return { success: false, error: "معرّف غير صالح" }
  try {
    const db = getAdminDb()
    const subRef = db.collection("categories").doc(catId).collection("subcategories").doc(sId)
    const subSnap = await subRef.get()
    if (!subSnap.exists) return { success: false, error: "القسم الفرعي غير موجود" }
    await subRef.delete()
    revalidatePath("/admin/categories")
    return { success: true }
  } catch (error) {
    logError("[admin] deleteSubcategory", error)
    return { success: false, error: "تعذّر حذف القسم الفرعي" }
  }
}

export async function getAdminDashboardStats(): Promise<{
  success: boolean
  stats?: AdminDashboardStats
  error?: string
}> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const orders = db.collection("orders")
    const users = db.collection("users")
    const driversCol = db.collection("drivers")

    // كل هذه أعداد count aggregation رخيصة تُنفَّذ بالتوازي — لا قراءة مجموعة كاملة في أيٍّ منها.
    const [
      ordersAll,
      ordersInquiry,
      ordersPending,
      ordersConfirmed,
      ordersOnTheWay,
      ordersDelivered,
      ordersCancelled,
      sellersTotal,
      driversTotal,
      driversApproved,
      customersTotal,
    ] = await Promise.all([
      safeCount("orders.all", orders),
      // طلبات الاستفسار (order_type=="inquiry") — نطرحها من الإجمالي كي لا تُحتسب كطلبات حقيقية.
      safeCount("orders.inquiry", orders.where("order_type", "==", "inquiry")),
      safeCount("orders.pending", orders.where("status", "==", "pending")),
      safeCount("orders.confirmed", orders.where("status", "==", "confirmed")),
      safeCount("orders.on_the_way", orders.where("status", "==", "on_the_way")),
      safeCount("orders.delivered", orders.where("status", "==", "delivered")),
      safeCount("orders.cancelled", orders.where("status", "==", "cancelled")),
      safeCount("sellers.total", users.where("role", "==", "seller")),
      safeCount("drivers.total", driversCol),
      // المعتمدون: الموقع العام يفلتر على isApproved (delivery.ts) — نعتمد نفس الحقل الأساسي.
      safeCount("drivers.approved", driversCol.where("isApproved", "==", true)),
      safeCount("customers.total", users.where("role", "==", "customer")),
    ])

    // المتاجر قيد المراجعة = إجمالي البائعين − المعتمدين (store.is_approved==true).
    // الطرح يعالج البائعين الذين ينقص حقلهم/قيمته false ويتجنّب مزلق != مع الحقول الغائبة.
    // عدّ حقل متداخل قد يحتاج فهرسًا مُعفى؛ لذا نلفّه في try ونتراجع بأمان مع رفع علم.
    let storesPending = 0
    let storesPendingSupported = true
    try {
      const approvedSnap = await users.where("store.is_approved", "==", true).count().get()
      const storesApproved = Number(approvedSnap.data().count) || 0
      storesPending = Math.max(0, sellersTotal - storesApproved)
    } catch (e) {
      logError("[admin] dashboard count: stores.pending (nested-field index?)", e)
      storesPendingSupported = false
    }

    // أحدث الطلبات: قراءة صغيرة مقيّدة بحدّ (limit) — ليست قراءة مجموعة كاملة.
    // نجلب هامشًا إضافيًا (12) ثم نستبعد طلبات الاستفسار ونقتطع إلى 8. لا نقرأ delivery_code إطلاقًا.
    let recentOrders: AdminRecentOrder[] = []
    try {
      const snap = await orders.orderBy("created_at", "desc").limit(12).get()
      const rows: Record<string, any>[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
      recentOrders = rows
        .filter((o) => !isInquiryOrderLike(o))
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          status: String(o.status || ""),
          total: Number(o.total) || 0,
          customer_name: String(o.customer_name || ""),
          created_at: toIso(o.created_at),
          // أمان: delivery_code غير مُدرَج إطلاقًا (لا نقرؤه ولا نُسنده).
        }))
    } catch (e) {
      logError("[admin] dashboard recentOrders", e)
    }

    // الإجمالي الحقيقي = كل الطلبات − طلبات الاستفسار (pseudo-orders).
    const ordersTotal = Math.max(0, ordersAll - ordersInquiry)

    return {
      success: true,
      stats: {
        orders: {
          total: ordersTotal,
          pending: ordersPending,
          confirmed: ordersConfirmed,
          on_the_way: ordersOnTheWay,
          delivered: ordersDelivered,
          cancelled: ordersCancelled,
        },
        stores: { total: sellersTotal, pending: storesPending, pendingSupported: storesPendingSupported },
        drivers: { total: driversTotal, pending: Math.max(0, driversTotal - driversApproved) },
        customers: { total: customersTotal },
        recentOrders,
      },
    }
  } catch (error) {
    logError("[admin] getAdminDashboardStats", error)
    return { success: false, error: "تعذّر تحميل الإحصاءات" }
  }
}

// ==================== إدارة المسؤولين (ترقية/سحب صلاحية admin) — superAdmin فقط ====================
// سطح رفع صلاحيات (privilege escalation) حسّاس. كل فعل هنا مُقيّد بـ ensureSuperAdmin() (يُشتق الدور
// سيرفر-سايد من قاعدة البيانات، لا من العميل). النموذج الأمني:
//   • superAdmin فقط يدير دور "admin". دور superAdmin نفسه لا يُنشأ ولا يُسحب من هذه الواجهة إطلاقًا
//     (يُدار خارج اللوحة عبر bootstrap + custom claims).
//   • حالة الصلاحية مزدوجة ويجب أن تبقى متسقة:
//       (أ) users/{uid}.role — يقرؤه تطبيق Next.js (getCurrentUser) لكل وصول للوحة/الأفعال (يسري فورًا).
//       (ب) custom claim token.admin — تقرؤه قواعد Firestore/Storage للوصول المباشر عبر Web SDK
//           (يسري بعد تحديث توكن المستخدم — حتى ~ساعة، أو فورًا عند إبطال جلسة التحديث).
//   • ترتيب الكتابة + تراجع (rollback) لضمان "الكل أو لا شيء": لا نترك حسابًا في حالة منقسمة
//     (دور بلا claim أو claim بلا دور). التفاصيل عند كل فعل.
//   • لا نُرجع أي أسرار (لا كلمات مرور ولا هاشات) — إسقاط آمن فقط.

// مسؤول كما تعرضه شاشة إدارة المسؤولين — إسقاط آمن بلا أسرار.
export type ManagedAdmin = {
  uid: string
  name: string
  email?: string
  role: "admin" | "superAdmin"
  isSuperAdmin: boolean
}

// نتيجة البحث عن مستخدم لترقيته — إسقاط آمن بلا أسرار.
export type AdminLookupResult = {
  uid: string
  name: string
  email?: string
  role: string // الدور الخام للعرض
  isPrivileged: boolean // admin أو superAdmin بالفعل (لا يمكن ترقيته)
  isSuperAdmin: boolean
}

// قائمة الحسابات الإدارية (role ∈ {admin, superAdmin}) — superAdmin فقط. مقيّدة بحدّ أعلى (عددهم صغير).
export async function getManagedAdmins(): Promise<{ success: boolean; admins?: ManagedAdmin[]; error?: string }> {
  const caller = await ensureSuperAdmin()
  if (!caller) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    // القيم المخزَّنة فعلًا: "admin" و "superAdmin" (camelCase). نُدرج صيغًا احتياطية (in exact-match).
    const snap = await db
      .collection("users")
      .where("role", "in", ["admin", "superAdmin", "super_admin", "superadmin"])
      .limit(200)
      .get()
    const admins: ManagedAdmin[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, any>
      const store = (data?.store || {}) as Record<string, any>
      const isSuper = isSuperAdminRole(data?.role)
      return serializeData({
        uid: d.id,
        name: data?.full_name || data?.name || store?.name || "",
        email: data?.email || "",
        role: isSuper ? "superAdmin" : "admin",
        isSuperAdmin: isSuper,
      }) as ManagedAdmin
    })
    // superAdmins أولًا، ثم بالاسم
    admins.sort(
      (a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin) || (a.name || "").localeCompare(b.name || "", "ar"),
    )
    return { success: true, admins }
  } catch (error) {
    logError("[admin] getManagedAdmins", error)
    return { success: false, error: "تعذّر تحميل المسؤولين" }
  }
}

// البحث عن مستخدم بالبريد أو المعرّف لترقيته إلى admin — superAdmin فقط. إسقاط آمن بلا أسرار.
// يحلّ البريد عبر Firebase Auth (getUserByEmail) والمعرّف عبر مستند users. يُرجع علم isPrivileged
// كي تمنع الواجهة ترقية حساب إداري بالفعل (والحارس النهائي في promoteToAdmin على أي حال).
export async function lookupUserForAdmin(
  query: string,
): Promise<{ success: boolean; user?: AdminLookupResult; error?: string }> {
  const caller = await ensureSuperAdmin()
  if (!caller) return { success: false, error: "ليس لديك صلاحية" }
  const q = String(query || "").trim()
  if (!q) return { success: false, error: "أدخل بريدًا إلكترونيًا أو معرّفًا" }
  try {
    const db = getAdminDb()
    const auth = getAdminAuth()
    let uid = ""
    let authEmail = ""
    if (q.includes("@")) {
      try {
        const rec = await auth.getUserByEmail(q.toLowerCase())
        uid = rec.uid
        authEmail = rec.email || ""
      } catch (e) {
        if ((e as { code?: string })?.code === "auth/user-not-found") {
          return { success: false, error: "لا يوجد مستخدم بهذا البريد" }
        }
        throw e
      }
    } else {
      uid = q
    }
    const snap = await db.collection("users").doc(uid).get()
    if (!snap.exists) return { success: false, error: "لا يوجد مستخدم بهذا المعرّف" }
    const data = snap.data() as Record<string, any>
    const store = (data?.store || {}) as Record<string, any>
    return {
      success: true,
      user: serializeData({
        uid,
        name: data?.full_name || data?.name || store?.name || "",
        email: authEmail || data?.email || "",
        role: String(data?.role || "customer"),
        isPrivileged: isAdminRole(data?.role),
        isSuperAdmin: isSuperAdminRole(data?.role),
      }) as AdminLookupResult,
    }
  } catch (error) {
    logError("[admin] lookupUserForAdmin", error)
    return { success: false, error: "تعذّر البحث عن المستخدم" }
  }
}

// ترقية مستخدم عادي (موجود، غير إداري) إلى دور "admin".
// الحراس: superAdmin فقط · المستخدم موجود · ليس النفس · ليس admin/superAdmin بالفعل · له سجل Auth.
// ترتيب الكتابة (fail-safe): (1) users/{uid}.role="admin" أولًا (منح مرئي وقابل للسحب عبر demote)،
//   (2) custom claim admin:true آخِرًا (منح الوصول المباشر الأخطر — أقصر نافذة). لو فشلت كتابة الـclaim
//   نتراجع عن الدور فورًا (rollback) كي لا يبقى حساب منقسم. نقرأ الـclaims الحالية وندمج (نحافظ على أي claim آخر).
export async function promoteToAdmin(uid: string): Promise<{ success: boolean; error?: string }> {
  const caller = await ensureSuperAdmin()
  if (!caller) return { success: false, error: "ليس لديك صلاحية" }
  const id = String(uid || "").trim()
  if (!id) return { success: false, error: "معرّف غير صالح" }
  // حارس: لا يُعدّل المستدعي صلاحيات حسابه هو (يمنع أي تلاعب ذاتي)
  if (id === caller.uid) return { success: false, error: "لا يمكنك تعديل صلاحيات حسابك" }
  try {
    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection("users").doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "المستخدم غير موجود" }
    const data = snap.data() as Record<string, any>
    const currentRole = String(data?.role || "customer")
    // حارس: لا نُدير مديرًا عامًا (superAdmin) من هنا إطلاقًا.
    if (isSuperAdminRole(currentRole)) return { success: false, error: "لا يمكن إدارة مدير عام من هنا" }
    // ترقية جديدة فقط إن لم يكن admin بالفعل. لو كان admin مسبقًا نتابع لإعادة ضبط الـclaim فقط
    // (إصلاح حالة منقسمة: دور admin بلا claim نتيجة فشل مزدوج سابق) — idempotent وقابل لإعادة التشغيل.
    const isFreshPromote = currentRole.toLowerCase() !== "admin"

    // نقرأ الـclaims الحالية للدمج (نحافظ على أي شيء مضبوط). غياب سجل Auth ⇒ لا يمكن ضبط الـclaim
    // فنرفض قبل لمس Firestore (كي لا ننشئ admin بدور فقط لا يجتاز قواعد Firestore).
    let existingClaims: Record<string, any> = {}
    try {
      const rec = await auth.getUser(id)
      existingClaims = rec.customClaims || {}
    } catch (e) {
      if ((e as { code?: string })?.code === "auth/user-not-found") {
        return { success: false, error: "الحساب لا يملك سجل مصادقة صالح" }
      }
      throw e
    }
    // admin بالفعل ومعه claim admin:true ⇒ لا شيء لفعله. (لو الدور admin بلا claim نتابع لإصلاح الانقسام.)
    if (!isFreshPromote && existingClaims.admin === true) {
      return { success: false, error: "الحساب مسؤول بالفعل" }
    }

    const now = new Date().toISOString()
    // (1) الدور أولًا (للترقية الجديدة فقط) — نحفظ الدور السابق (previous_role) لاستعادته عند السحب
    //     بدل التحويل الأعمى إلى customer (يمنع تجريد بائع/سائق من دوره الأصلي).
    if (isFreshPromote) {
      await ref.update({ role: "admin", previous_role: currentRole, updated_at: now })
    }
    // (2) الـclaim آخِرًا (منح جديد أو إصلاح انقسام) — مع تراجع عن الدور إذا فشل (للترقية الجديدة فقط).
    try {
      await auth.setCustomUserClaims(id, { ...existingClaims, admin: true })
    } catch (e) {
      if (isFreshPromote) {
        try {
          await ref.update({ role: currentRole, previous_role: FieldValue.delete(), updated_at: new Date().toISOString() })
        } catch (re) {
          logError("[admin] promoteToAdmin rollback role", re)
        }
      }
      logError("[admin] promoteToAdmin setCustomUserClaims", e)
      return { success: false, error: "تعذّر منح الصلاحية" }
    }

    revalidatePath("/admin/manage-admins")
    revalidatePath("/admin/accounts")
    return { success: true }
  } catch (error) {
    logError("[admin] promoteToAdmin", error)
    return { success: false, error: "تعذّر منح الصلاحية" }
  }
}

// سحب صلاحية مستخدم دوره "admin" وإعادته إلى "customer".
// الحراس: superAdmin فقط · المستخدم موجود · ليس النفس · دوره admin تحديدًا (نرفض superAdmin ونرفض
//   غير-المسؤول). ملاحظة: سحب الأخير غير ممكن لأن هذا الفعل لا يمسّ superAdmins (المستدعي superAdmin
//   يبقى دائمًا حسابًا مميّزًا) فلا نحتاج حارس "آخر مسؤول".
// ترتيب الكتابة (fail-safe): (1) سحب الـclaim (admin:false) أولًا لقطع الوصول المباشر الأخطر فورًا،
//   (2) users/{uid}.role="customer" آخِرًا؛ لو فشلت كتابة الدور نُعيد الـclaim إلى admin:true (rollback)
//   كي يبقى الحساب متسقًا (مسؤولًا كاملًا). ثم نُبطل جلسات التحديث (best-effort) كي يسري سحب الـclaim فورًا.
export async function demoteFromAdmin(uid: string): Promise<{ success: boolean; error?: string }> {
  const caller = await ensureSuperAdmin()
  if (!caller) return { success: false, error: "ليس لديك صلاحية" }
  const id = String(uid || "").trim()
  if (!id) return { success: false, error: "معرّف غير صالح" }
  if (id === caller.uid) return { success: false, error: "لا يمكنك تعديل صلاحيات حسابك" }
  try {
    const db = getAdminDb()
    const auth = getAdminAuth()
    const ref = db.collection("users").doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "المستخدم غير موجود" }
    const data = snap.data() as Record<string, any>
    const currentRole = String(data?.role || "")
    // حارس: لا نسحب superAdmin من هذه الواجهة إطلاقًا
    if (isSuperAdminRole(currentRole)) return { success: false, error: "لا يمكن سحب صلاحية مدير عام من هنا" }
    // حارس: الهدف يجب أن يكون admin تحديدًا
    if (currentRole.toLowerCase() !== "admin") return { success: false, error: "الحساب ليس مسؤولًا" }
    // نستعيد الدور السابق (previous_role) المحفوظ عند الترقية بدل التحويل الأعمى إلى customer — كي لا
    // يفقد بائع/سائق رُقّي ثم سُحب دوره الأصلي. الافتراضي customer لو لم يُحفَظ (ترقية قديمة/يدوية).
    const restoreRole = String(data?.previous_role || "customer")

    // نقرأ الـclaims الحالية للدمج. قد لا يوجد سجل Auth (بيانات مصدّرة) — عندئذٍ لا claim نسحبه.
    let existingClaims: Record<string, any> = {}
    let hasAuthRecord = true
    try {
      const rec = await auth.getUser(id)
      existingClaims = rec.customClaims || {}
    } catch (e) {
      if ((e as { code?: string })?.code === "auth/user-not-found") hasAuthRecord = false
      else throw e
    }

    const now = new Date().toISOString()
    // (1) سحب الـclaim أولًا (قطع الوصول المباشر)
    if (hasAuthRecord) {
      try {
        await auth.setCustomUserClaims(id, { ...existingClaims, admin: false })
      } catch (e) {
        logError("[admin] demoteFromAdmin setCustomUserClaims", e)
        return { success: false, error: "تعذّر سحب الصلاحية" }
      }
    }
    // (2) الدور آخِرًا (نستعيد previous_role) — مع تراجع عن الـclaim إذا فشل
    try {
      await ref.update({ role: restoreRole, previous_role: FieldValue.delete(), updated_at: now })
    } catch (e) {
      if (hasAuthRecord) {
        try {
          await auth.setCustomUserClaims(id, { ...existingClaims, admin: true })
        } catch (re) {
          logError("[admin] demoteFromAdmin rollback claim", re)
        }
      }
      logError("[admin] demoteFromAdmin role write", e)
      return { success: false, error: "تعذّر سحب الصلاحية" }
    }

    // إبطال جلسات التحديث (best-effort): يقطع مسار جلسة Next.js فورًا (getCurrentUid بـ checkRevoked=true
    // يرفض كوكي الجلسة) فيُفقَد وصول اللوحة فورًا. ملاحظة دقيقة: وصول Firestore/Storage المباشر عبر Web
    // SDK يظل ممكنًا بتوكن ID موقّع صالح حتى انتهائه (~ساعة) — القواعد لا تفحص الإبطال — فيُقطع خلال ~ساعة
    // لا فورًا. الإغلاق الجذري = منع كتابة حقل role/الأدوار الإدارية في firestore.rules (بند موثّق للمالك).
    if (hasAuthRecord) {
      try {
        await auth.revokeRefreshTokens(id)
      } catch (re) {
        logError("[admin] demoteFromAdmin revokeRefreshTokens", re)
      }
    }

    revalidatePath("/admin/manage-admins")
    revalidatePath("/admin/accounts")
    return { success: true }
  } catch (error) {
    logError("[admin] demoteFromAdmin", error)
    return { success: false, error: "تعذّر سحب الصلاحية" }
  }
}

// مساعد: هل الدور superAdmin؟ (function declaration مرفوعة hoisted — تُستعمَل أعلاه).
function isSuperAdminRole(role: unknown): boolean {
  const r = String(role || "").toLowerCase()
  return r === "superadmin" || r === "super_admin"
}

// ==================== ترحيل بيانات (لمرة واحدة): تعبئة store.category_id + تجذير الاعتماد ====================
// أداة ترحيل يُشغّلها المالك بضغطة زر (Vercel يحمل مفاتيح Admin SDK — لا يخرج أي سرّ للعميل).
// المشكلة التي تحلّها:
//   • store.category_id مفقود على المتاجر القديمة — بينما تعاقب إعادة تسمية الفئة (updateCategory) يعتمد
//     على where("store.category_id","==",catId). فالمتاجر بلا category_id تسقط من التعاقب. نُعبّئه من
//     مطابقة اسم store.category باسم مستند فئة موجود (نفس دلالة الموقع: مطابقة بالاسم الدقيق).
//   • بوابة العرض العام تُظهر حاليًا is_approved !== false (غير المضبوط يظهر). للانتقال إلى «المعتمد فقط»
//     لاحقًا يجب تجذير (grandfather) المتاجر القديمة غير المضبوطة إلى approved أولًا، وإلا يفرغ الموقع.
//
// أمان/سلامة (حرِج):
//   • كل الأفعال مُقيّدة بـ ensureAdmin() (الدور مُشتق من قاعدة البيانات سيرفر-سايد).
//   • لا نمسّ إلا مستندات البائعين (role=="seller")، وعبر مسارين منقّطين فقط: "store.category_id"
//     و "store.is_approved" — لا نكتب فوق أي حقل متجر آخر إطلاقًا (لا updated_at ولا غيره).
//   • المعاينة قراءة فقط. الكتابة idempotent (نضبط category_id فقط حين يكون فارغًا، ونمنح الاعتماد فقط
//     حين يكون غير مضبوط) — إعادة التشغيل بعد اكتمالها لا تُغيّر شيئًا.

export type StoreBackfillPreview = {
  totalSellers: number
  missingCategoryId: number // category_id فارغ/غائب
  categoryIdResolvable: number // من الناقصة: عددها الذي يطابق اسم store.category اسم فئة موجودة (قابل للتعبئة)
  categoryIdUnresolvable: number // ناقص category_id وبلا اسم فئة مطابق (لا يمكن تعبئته تلقائيًا)
  approvedTrue: number
  approvedFalse: number
  approvedUnset: number
}

export type StoreBackfillResult = {
  categoryIdSet: number // عدد المتاجر التي كُتب لها store.category_id فعلًا
  approvalGranted: number // عدد المتاجر التي مُنحت store.is_approved=true فعلًا
  skippedUnresolvable: number // ناقص category_id لكن تعذّر حلّه (تُرك كما هو)
}

// هل store.category_id مضبوط فعلًا (نص غير فارغ)؟
function hasCategoryId(store: Record<string, any>): boolean {
  const v = store?.category_id
  return typeof v === "string" && v.trim() !== ""
}

// تصنيف حالة الاعتماد: true / false صريح / غير مضبوط (undefined/null/غائب/أي شيء آخر).
function approvalState(store: Record<string, any>): "true" | "false" | "unset" {
  const v = store?.is_approved
  if (v === true) return "true"
  if (v === false) return "false"
  return "unset"
}

// خريطة اسم الفئة → معرّف المستند (مطابقة دقيقة بالاسم، مطابقة لما يفعله الموقع: where("name","==",...)).
// عند تكرار الاسم يفوز آخر مستند — مقبول لأداة ترحيل (المطلوب فقط قابلية الحلّ + معرّف صالح).
async function loadCategoryNameToIdMap(db: Firestore): Promise<Map<string, string>> {
  const snap = await db.collection("categories").get()
  const map = new Map<string, string>()
  snap.docs.forEach((d) => {
    const name = String((d.data() as Record<string, any>)?.name || "")
    if (name) map.set(name, d.id)
  })
  return map
}

// (1) معاينة (قراءة فقط): يمسح كل البائعين ويُرجع الأعداد التي يراجعها المالك قبل التشغيل.
export async function previewStoreBackfill(): Promise<{
  success: boolean
  preview?: StoreBackfillPreview
  error?: string
}> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    // نحمّل خريطة أسماء الفئات مرة واحدة لحساب قابلية الحلّ.
    const [sellersSnap, catMap] = await Promise.all([
      db.collection("users").where("role", "==", "seller").get(),
      loadCategoryNameToIdMap(db),
    ])

    let missingCategoryId = 0
    let categoryIdResolvable = 0
    let categoryIdUnresolvable = 0
    let approvedTrue = 0
    let approvedFalse = 0
    let approvedUnset = 0

    sellersSnap.docs.forEach((d) => {
      const store = ((d.data() as Record<string, any>)?.store || {}) as Record<string, any>

      if (!hasCategoryId(store)) {
        missingCategoryId++
        const name = typeof store.category === "string" ? store.category : ""
        if (name && catMap.has(name)) categoryIdResolvable++
        else categoryIdUnresolvable++
      }

      const st = approvalState(store)
      if (st === "true") approvedTrue++
      else if (st === "false") approvedFalse++
      else approvedUnset++
    })

    return {
      success: true,
      preview: serializeData({
        totalSellers: sellersSnap.size,
        missingCategoryId,
        categoryIdResolvable,
        categoryIdUnresolvable,
        approvedTrue,
        approvedFalse,
        approvedUnset,
      }) as StoreBackfillPreview,
    }
  } catch (error) {
    logError("[admin] previewStoreBackfill", error)
    return { success: false, error: "تعذّر حساب المعاينة" }
  }
}

// (2) تشغيل الترحيل (كتابة idempotent، مُقسّمة على دفعات ≤400): لا يلمس إلا المسارين المنقّطين
// "store.category_id" و "store.is_approved" على مستندات البائعين فقط.
export async function runStoreBackfill(opts: {
  backfillCategoryId?: boolean
  grandfatherApproval?: boolean
}): Promise<{ success: boolean; result?: StoreBackfillResult; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }

  const doCategoryId = opts?.backfillCategoryId === true
  const doApproval = opts?.grandfatherApproval === true
  // لا خيار مفعّل ⇒ لا شيء لفعله (لا كتابة، لا إبطال كاش).
  if (!doCategoryId && !doApproval) {
    return { success: true, result: { categoryIdSet: 0, approvalGranted: 0, skippedUnresolvable: 0 } }
  }

  try {
    const db = getAdminDb()
    const [sellersSnap, catMap] = await Promise.all([
      db.collection("users").where("role", "==", "seller").get(),
      doCategoryId ? loadCategoryNameToIdMap(db) : Promise.resolve(new Map<string, string>()),
    ])

    let categoryIdSet = 0
    let approvalGranted = 0
    let skippedUnresolvable = 0

    // نجمع لكل مستند تحتاج تغييرًا مرجعَه + كائن التحديث المنقّط (المسارين فقط)، ثم نُقسّم على دفعات.
    const updates: { ref: DocumentReference; data: Record<string, any> }[] = []

    sellersSnap.docs.forEach((d) => {
      const store = ((d.data() as Record<string, any>)?.store || {}) as Record<string, any>
      const patch: Record<string, any> = {}

      if (doCategoryId && !hasCategoryId(store)) {
        const name = typeof store.category === "string" ? store.category : ""
        const id = name ? catMap.get(name) : undefined
        if (id) patch["store.category_id"] = id
        else skippedUnresolvable++ // ناقص وغير قابل للحلّ — يُترك كما هو
      }

      if (doApproval && approvalState(store) === "unset") {
        patch["store.is_approved"] = true
      }

      if (Object.keys(patch).length > 0) {
        if ("store.category_id" in patch) categoryIdSet++
        if ("store.is_approved" in patch) approvalGranted++
        updates.push({ ref: d.ref, data: patch })
      }
    })

    // كتابة مُقسّمة (حدّ Firestore 500 عملية/دفعة — نبقى عند 400 بأمان).
    for (const chunk of chunkArray(updates, 400)) {
      const batch = db.batch()
      chunk.forEach((u) => batch.update(u.ref, u.data))
      await batch.commit()
    }

    // إبطال كاش المتاجر بعد الكتابة كي ينعكس منح الاعتماد فورًا على الواجهة العامة (getStores/getStore).
    if (updates.length > 0) {
      revalidateTag("stores", "max")
    }
    revalidatePath("/admin/migrations")

    return { success: true, result: { categoryIdSet, approvalGranted, skippedUnresolvable } }
  } catch (error) {
    logError("[admin] runStoreBackfill", error)
    return { success: false, error: "تعذّر تنفيذ الترحيل" }
  }
}
