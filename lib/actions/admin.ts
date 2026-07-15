"use server"

// ADM-01: لوحة الأدمن — اعتماد/رفض المتاجر (حوكمة).
// كل الأكشن تتحقق من دور admin سيرفر-سايد (يُشتق من قاعدة البيانات، لا من العميل).

import { revalidatePath, revalidateTag } from "next/cache"
import { FieldValue } from "firebase-admin/firestore"
import type { Firestore } from "firebase-admin/firestore"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUser } from "../auth/session"
import { serializeData, chunkArray } from "../firebase/firestore-helpers"
import { createNotification } from "../notifications-internal"
import { signKycFields } from "./stores"
import type { PickupStop } from "./orders"
import { logError } from "../logger"

export type AdminStore = {
  id: string
  name: string
  phone?: string
  address?: string
  category?: string
  image_url?: string | null
  is_approved: boolean
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

async function ensureAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") return null
  return user
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
// نجلب الأحدث عبر فهرس الحقل الواحد created_at (متوفّر تلقائيًا) ثم نُرشّح الحالة/الاستفسار في الذاكرة.
// لا نُدرج delivery_code في الملخّص إطلاقًا.
export async function getAdminOrders(
  opts?: { status?: string; limit?: number },
): Promise<{ success: boolean; orders?: AdminOrderSummary[]; error?: string }> {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const cap = Math.min(Math.max(Number(opts?.limit) || 100, 1), 300)
    const snap = await db.collection("orders").orderBy("created_at", "desc").limit(cap).get()

    let rows: Record<string, any>[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    // استبعاد طلبات الاستفسار (pseudo-orders)
    rows = rows.filter((o) => !isInquiryOrderLike(o))
    // فلترة الحالة (اختياري) — في الذاكرة لتجنّب الحاجة لفهرس مركّب
    const statusFilter = opts?.status && opts.status !== "all" ? opts.status : null
    if (statusFilter) rows = rows.filter((o) => String(o.status || "") === statusFilter)

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
      // pickup_stops لا تحتوي كود التسليم (هو حقل top-level) — آمن إدراجها للطلب متعدد المتاجر
      pickup_stops: isMulti ? (serializeData(data.pickup_stops || []) as PickupStop[]) : undefined,
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

      if (!alreadyRestored) {
        if (data.order_type === "multi_store") {
          const stops: any[] = Array.isArray(data.pickup_stops) ? data.pickup_stops : []
          for (const stop of stops) {
            // المرفوضة استُعيدت عبر rejectStorePickup؛ المُستَلَمة خرجت بضاعتها فعليًا
            if (stop?.status === "rejected" || stop?.status === "picked_up") continue
            for (const it of stop?.items || []) {
              const qty = Number(it?.quantity) || 0
              if (it?.product_id && qty > 0) {
                tx.update(db.collection("products").doc(String(it.product_id)), {
                  stock: FieldValue.increment(qty),
                })
              }
            }
          }
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
