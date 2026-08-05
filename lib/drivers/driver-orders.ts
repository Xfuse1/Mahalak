import { getAdminDb } from "@/lib/firebase/admin"
import { chunkArray } from "@/lib/firebase/firestore-helpers"
import type { PickupStop } from "@/lib/actions/orders"

// تغذية طلبات السائق (طبقة محايدة، لا "use server") — يستدعيها route handler الخاص بـ/api/driver/orders.
// أمان: DTO بقائمة سماح صريحة — لا نُرجع أبدًا كود التسليم (delivery_code) ولا أي حقل غير مُدرَج.
// السائق يُدخل الكود من العميل عند الباب (إثبات تسليم)، فلا يجب أن يراه في القائمة.

export type DriverOrderItem = {
  product_id: string
  name?: string
  quantity: number
  price: number
  image_url?: string | null
}

export type DriverOrder = {
  id: string
  order_type: "single" | "multi_store"
  status: string
  is_dispatch: boolean // طلب توزيع؟ التطبيق يُظهر أفعال التوزيع للطلبات هذه فقط
  distance_km?: number // مسافة المتجر→العميل (تقدير للسائق قبل القبول)
  total: number
  delivery_price: number
  driver_fee?: number // أجرة السائق الكاملة (= delivery_price بلا شحن مجاني؛ أكبر منه مع الشحن المجاني حيث يتحمّل التاجر)
  created_at?: string
  updated_at?: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  delivery_city?: string
  delivery_notes?: string
  landmark?: string
  delivery_latitude?: number
  delivery_longitude?: number
  // لقطة موقع/عنوان المتجر (نقطة الاستلام) — تُكشف فقط بعد الإسناد (scope="assigned") مثل بيانات العميل
  store_name?: string
  store_address?: string
  store_latitude?: number
  store_longitude?: number
  offer_expires_at_ms?: number // للعروض المتاحة: وقت انتهاء العرض (عدّاد تنازلي في التطبيق)
  items?: DriverOrderItem[] // الطلب الأحادي
  pickup_stops?: PickupStop[] // المتعدد (كود التسليم ليس داخل المحطات — هو على مستوى الطلب فنُسقطه)
}

const DRIVER_ORDERS_LIMIT = 100
const OFFERS_LIMIT = 100 // أقصى عدد عروض تُعاد للتطبيق
const OFFERS_SCAN_CAP = 300 // سقف المسح قبل الترشيح (انظر التعليق في getAvailableOffers)

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined
}

// لقطة متجر (نقطة استلام) تُقرأ من مستند البائع عند غيابها عن مستند الطلب.
type StoreSnapshot = { name?: string; address?: string; latitude?: number; longitude?: number }

// ذاكرة قصيرة داخل العملية: التطبيق يستطلع كل 30 ثانية، والطلبات القديمة تنقصها اللقطة دائمًا
// (إخفاق دائم)، فبلا هذه الذاكرة كنّا نعيد قراءة نفس مستند البائع مرّتين في الدقيقة لكل سائق أبدًا.
// بيانات المتجر (اسم/عنوان/موقع) شبه ثابتة، فتقادُم عشر دقائق مقبول تمامًا هنا.
const STORE_SNAPSHOT_TTL_MS = 10 * 60 * 1000
const storeSnapshotCache = new Map<string, { at: number; value: StoreSnapshot | null }>()

// الطلب يحمل لقطة المتجر (اسم/عنوان/إحداثيات) وقت الإنشاء، لكن اللقطة تُكتب *شرطيًّا*: الطلبات
// المُنشأة قبل إضافتها، والمتاجر التي لم تكن قد ضبطت عنوانها/موقعها وقت الطلب، تُخزَّن بلا نقطة
// استلام — فيرى السائق وجهة التسليم فقط ولا يعرف من أين يستلم. نكمل الناقص من مستند البائع وقت
// القراءة (نفس احتياطي getStoreMap في lib/actions/products.ts: العنوان من store.address ثم
// المدينة/الشارع). قراءة واحدة مجمّعة لكل المتاجر الناقصة، ولا تُستدعى إطلاقًا في تغذية العروض.
async function fetchStoreSnapshots(
  db: ReturnType<typeof getAdminDb>,
  storeIds: string[],
): Promise<Map<string, StoreSnapshot>> {
  const now = Date.now()
  const map = new Map<string, StoreSnapshot>()
  const missing: string[] = []

  for (const id of new Set(storeIds.filter(Boolean))) {
    const cached = storeSnapshotCache.get(id)
    if (cached && now - cached.at < STORE_SNAPSHOT_TTL_MS) {
      if (cached.value) map.set(id, cached.value)
      continue
    }
    missing.push(id)
  }

  // حدّ أعلى بسيط ضد نمو الذاكرة بلا سقف في عملية طويلة العمر (عدد المتاجر صغير عمليًّا)
  if (storeSnapshotCache.size > 500) storeSnapshotCache.clear()

  for (const chunk of chunkArray(missing, 10)) {
    if (!chunk.length) continue
    const docs = await db.getAll(...chunk.map((id) => db.collection("users").doc(id)))
    docs.forEach((doc) => {
      const data = (doc.exists ? doc.data() : null) as Record<string, any> | null
      // حارس الدور إلزامي: مستند users قد يخصّ عميلًا عاديًّا، وبلا هذا الشرط كان الاحتياطي
      // (full_name / city+street) يضع اسم شخص وعنوان سكنه في تغذية السائق لو حمل الطلب
      // معرّف متجر خاطئًا. كل قارئ آخر لهذا المستند يفرض role === "seller" (getStoreMap/extractStore).
      if (!data || data.role !== "seller") {
        storeSnapshotCache.set(doc.id, { at: now, value: null })
        return
      }
      const store = (data.store || {}) as Record<string, any>
      const value: StoreSnapshot = {
        name: str(store.name) || str(data.full_name),
        address: str(store.address) || [data.city, data.street].filter(Boolean).join("، ") || undefined,
        latitude: typeof store.latitude === "number" ? store.latitude : undefined,
        longitude: typeof store.longitude === "number" ? store.longitude : undefined,
      }
      storeSnapshotCache.set(doc.id, { at: now, value })
      map.set(doc.id, value)
    })
  }
  return map
}

// إعادة بناء محطات الاستلام بقائمة سماح صريحة (نفس ضمان الطلب الأحادي) — لا نمرّر أي حقل غير مُدرَج
// من مستند Firestore (دفاع عمق ضد تسريب حقول مستقبلية قد تُكتب داخل pickup_stops).
// full=false (تغذية العروض قبل القبول) يُبقي الموقع الدقيق للمتجر مخفيًّا — يُكشف فقط بعد الإسناد.
function mapPickupStops(raw: unknown, full: boolean, stores?: Map<string, StoreSnapshot>): PickupStop[] {
  if (!Array.isArray(raw)) return []
  const STATUSES = ["pending", "confirmed", "rejected", "picked_up"]
  return raw.map((s: Record<string, any>) => {
    const fallback = full ? stores?.get(str(s?.store_id) || "") : undefined
    const lat = typeof s?.store_latitude === "number" ? s.store_latitude : fallback?.latitude
    const lng = typeof s?.store_longitude === "number" ? s.store_longitude : fallback?.longitude
    const address = str(s?.store_address) || fallback?.address
    return {
      store_id: str(s?.store_id) || "",
      store_name: str(s?.store_name) || fallback?.name || "",
      ...(full && typeof lat === "number" ? { store_latitude: lat } : {}),
      ...(full && typeof lng === "number" ? { store_longitude: lng } : {}),
      ...(full && address ? { store_address: address } : {}),
      items: Array.isArray(s?.items)
        ? s.items.map((it: Record<string, any>) => ({
            product_id: str(it?.product_id) || "",
            name: str(it?.name) || "",
            quantity: num(it?.quantity),
            price: num(it?.price),
            image_url: typeof it?.image_url === "string" ? it.image_url : null,
          }))
        : [],
      subtotal: num(s?.subtotal),
      status: (STATUSES.includes(s?.status) ? s.status : "pending") as PickupStop["status"],
      confirmed_at: str(s?.confirmed_at) ?? null,
      picked_up_at: str(s?.picked_up_at) ?? null,
      rejected_at: str(s?.rejected_at) ?? null,
      rejection_reason: str(s?.rejection_reason) ?? null,
    }
  })
}

export async function getDriverOrders(driverId: string): Promise<DriverOrder[]> {
  const db = getAdminDb()
  // مساواة بحقل واحد (driver_id) — يخدمها الفهرس المفرد التلقائي؛ نرتّب في JS لتفادي فهرس مركّب.
  const snap = await db.collection("orders").where("driver_id", "==", driverId).get()

  const raw = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
    // الاستفسارات ليست توصيلات — نستبعدها من قائمة السائق
    .filter((o) => o.order_type !== "inquiry" && o.status !== "inquiry")

  raw.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
  return hydrateDriverOrders(db, raw.slice(0, DRIVER_ORDERS_LIMIT))
}

// (2) العروض المتاحة — طلبات التوزيع المعروضة (offering) غير المُسندة بعد، ليقبلها أول سائق (أول-يفوز).
// يستبعد: غير التوزيع، المُسندة (driver_id)، المنتهية (offer_expires_at_ms)، والتي رفضها هذا السائق.
// يُرتّب الأقدم أولًا (عدالة FIFO). نفس DTO قائمة السماح — لا كود تسليم.
export async function getAvailableOffers(driverId: string): Promise<DriverOrder[]> {
  const db = getAdminDb()
  const now = Date.now()
  // مساواة بحقل واحد (status) — فهرس مفرد تلقائي؛ "offering" حالة توزيع حصريًّا. نرشّح الباقي في JS.
  // حدّ السعة: Firestore يُرجع الصفحة بترتيب المعرّف لا الأحدث، فلو تجاوزت الطلبات المعروضة
  // SCAN_CAP دفعةً واحدة فقد يختفي عرض جديد خلف عروض قديمة/منتهية. عند هذا الحجم يلزم فهرس
  // مركّب (status + created_at) مع orderBy — نتركه لأنه يتطلب نشر فهرس، وسقف اليوم أكبر بكثير
  // من حجم التجربة (متجر واحد). راقب هذا الحدّ قبل التوسّع.
  const snap = await db.collection("orders").where("status", "==", "offering").limit(OFFERS_SCAN_CAP).get()
  const raw = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
    .filter((o) => o.is_dispatch === true)
    .filter((o) => !o.driver_id)
    .filter((o) => {
      const exp = Number(o.offer_expires_at_ms || 0)
      return !exp || exp > now
    })
    .filter((o) => !(Array.isArray(o.rejected_by) && o.rejected_by.includes(driverId)))

  raw.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))
  return hydrateDriverOrders(db, raw.slice(0, OFFERS_LIMIT), "offer")
}

// ترطيب مشترك: يجلب عناصر الطلبات الأحادية + منتجاتها ويبني DTO قائمة السماح لكلا التغذيتين.
// scope يحدّد اتساع الكشف: "assigned" (طلباتي، بعد الإسناد) كامل، و"offer" (عرض متاح) مُصغَّر.
async function hydrateDriverOrders(
  db: ReturnType<typeof getAdminDb>,
  orders: Record<string, any>[],
  scope: "assigned" | "offer" = "assigned",
): Promise<DriverOrder[]> {
  // عناصر الطلبات الأحادية + أسماء/صور منتجاتها (المتعدد يحمل عناصره داخل pickup_stops أصلًا)
  const singleIds = orders.filter((o) => o.order_type !== "multi_store").map((o) => o.id)
  const itemsByOrder = new Map<string, DriverOrderItem[]>()

  if (singleIds.length) {
    const rawItems: { order_id: string; product_id: string; quantity: number; price: number }[] = []
    for (const chunk of chunkArray(singleIds, 10)) {
      const isnap = await db.collection("order_items").where("order_id", "in", chunk).get()
      isnap.docs.forEach((doc) => {
        const it = doc.data()
        rawItems.push({
          order_id: str(it.order_id) || "",
          product_id: str(it.product_id) || "",
          quantity: num(it.quantity),
          price: num(it.price),
        })
      })
    }

    const productIds = Array.from(new Set(rawItems.map((i) => i.product_id).filter(Boolean)))
    const productMap = new Map<string, { name?: string; image_url: string | null }>()
    for (const chunk of chunkArray(productIds, 10)) {
      if (!chunk.length) continue
      const refs = chunk.map((id) => db.collection("products").doc(id))
      const pdocs = await db.getAll(...refs)
      pdocs.forEach((pd) => {
        if (pd.exists) {
          const p = pd.data() as Record<string, any>
          productMap.set(pd.id, { name: str(p.name), image_url: typeof p.image_url === "string" ? p.image_url : null })
        }
      })
    }

    for (const it of rawItems) {
      const prod = productMap.get(it.product_id)
      const entry: DriverOrderItem = {
        product_id: it.product_id,
        name: prod?.name,
        quantity: it.quantity,
        price: it.price,
        image_url: prod?.image_url ?? null,
      }
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, [])
      itemsByOrder.get(it.order_id)!.push(entry)
    }
  }

  // في تغذية العروض (قبل القبول) لا نكشف بيانات تواصل العميل ولا موقعه الدقيق: أي سائق مسجَّل
  // يتصفّح العروض كان سيقرأ اسم العميل وهاتفه وعنوانه بلا أي التزام بالطلب. نكتفي بالمدينة
  // والمعالم التقريبية ليقدّر المسافة، وتُكشف التفاصيل كاملةً بعد الإسناد (تغذية "طلباتي").
  const full = scope === "assigned"

  // إكمال نقطة الاستلام الناقصة من مستند البائع — بعد الإسناد فقط (نفس شرط كشف موقع المتجر).
  const storeSnapshots = full
    ? await fetchStoreSnapshots(
        db,
        orders.flatMap((o) => {
          if (o.order_type === "multi_store") {
            const stops = Array.isArray(o.pickup_stops) ? o.pickup_stops : []
            // الاسم جزء من شرط النقص كالمسار الأحادي: محطة كُتبت بلا store_name (سلة قديمة في
            // متصفّح العميل) لكن بعنوان وإحداثيات من المتجر كانت تفشل الشرط فلا تُكمَّل أبدًا،
            // فيرى السائق عنوان استلام بلا اسم متجر.
            return stops
              .filter(
                (s: Record<string, any>) =>
                  !str(s?.store_name) || !str(s?.store_address) || typeof s?.store_latitude !== "number",
              )
              .map((s: Record<string, any>) => str(s?.store_id) || "")
          }
          const missing = !str(o.store_address) || !str(o.store_name) || typeof o.store_latitude !== "number"
          return missing ? [str(o.store_id) || ""] : []
        }),
      )
    : new Map<string, StoreSnapshot>()

  return orders.map((o): DriverOrder => {
    const isMulti = o.order_type === "multi_store"
    const storeFallback = full && !isMulti ? storeSnapshots.get(str(o.store_id) || "") : undefined
    const storeLat = o.store_latitude != null ? num(o.store_latitude) : storeFallback?.latitude
    const storeLng = o.store_longitude != null ? num(o.store_longitude) : storeFallback?.longitude
    return {
      id: o.id,
      order_type: isMulti ? "multi_store" : "single",
      status: str(o.status) || "pending",
      is_dispatch: o.is_dispatch === true,
      total: num(o.total),
      delivery_price: num(o.delivery_price),
      // أجرة السائق الكاملة — يعرضها التطبيق كدخل السائق (مع الشحن المجاني delivery_price قد يكون 0 لكن السائق يأخذ حقه)
      driver_fee: o.driver_fee != null ? num(o.driver_fee) : num(o.delivery_price),
      created_at: str(o.created_at?.toDate?.()?.toISOString?.() || o.created_at),
      updated_at: str(o.updated_at?.toDate?.()?.toISOString?.() || o.updated_at),
      customer_name: full ? str(o.customer_name) : undefined,
      customer_phone: full ? str(o.customer_phone) : undefined,
      delivery_address: full ? str(o.delivery_address) : undefined,
      delivery_city: str(o.delivery_city),
      delivery_notes: full ? str(o.delivery_notes) : undefined,
      landmark: full ? str(o.landmark) : undefined,
      delivery_latitude: full && o.delivery_latitude != null ? num(o.delivery_latitude) : undefined,
      delivery_longitude: full && o.delivery_longitude != null ? num(o.delivery_longitude) : undefined,
      // موقع المتجر الدقيق (نقطة الاستلام) خلف نفس شرط الإسناد — لا يظهر في تغذية العروض
      store_name: full ? str(o.store_name) || storeFallback?.name : undefined,
      store_address: full ? str(o.store_address) || storeFallback?.address : undefined,
      store_latitude: full && typeof storeLat === "number" ? storeLat : undefined,
      store_longitude: full && typeof storeLng === "number" ? storeLng : undefined,
      distance_km: o.distance_km != null ? num(o.distance_km) : undefined,
      offer_expires_at_ms: o.offer_expires_at_ms != null ? num(o.offer_expires_at_ms) : undefined,
      ...(isMulti
        ? { pickup_stops: mapPickupStops(o.pickup_stops, full, storeSnapshots) }
        : { items: itemsByOrder.get(o.id) || [] }),
    }
  })
}
