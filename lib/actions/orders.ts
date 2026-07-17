"use server"

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore"
import { FieldValue } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { logServerError } from "../server-error-log"
import { getCurrentUid, getCurrentUser, hasAdminAccess, requireOwner } from "../auth/session"
import { getCurrentDriverId } from "../auth/driver-session"
import { chunkArray } from "../firebase/firestore-helpers"
import { logError } from "../logger"
import { createNotification, sendReviewRequestNotification } from "../notifications-internal"
import { applyOfferDiscount, findBestDiscount, getActiveOffersForStores } from "../utils/offer-discount"
import { sendPushToOwner } from "../server-push"

// تحقق من الكمية: عدد صحيح موجب ضمن حد معقول — يمنع الكميات السالبة (التي تُحوّل
// خصم المخزون إلى زيادة) أو الكسرية أو NaN القادمة من العميل.
const MAX_LINE_QUANTITY = 100000
function validateQuantity(raw: unknown): number {
  const qty = Number(raw)
  if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_LINE_QUANTITY) {
    throw new Error("Invalid quantity")
  }
  return qty
}

// تحقق من مبلغ مالي اختياري (رسوم/عمولة): رقم منتهٍ غير سالب، وإلا 0.
function sanitizeMoney(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

type RecordMap = {
  id: string
  [key: string]: unknown
}

type OrderItemRecord = {
  id: string
  order_id: string
  product_id: string
  quantity?: number
  price?: number
  name?: string
  image_url?: string | null
  [key: string]: unknown
}

type OrderRecord = {
  id: string
  order_type?: string
  store_id?: string
  customer_id?: string
  driver_id?: string
  driver_name?: string
  status?: string
  total?: number
  created_at?: string
  delivery_address?: string
  timeline?: TimelineEntry[]
  pickup_stops?: PickupStop[]
  [key: string]: unknown
}

type ItemProductRef = {
  id: string
  name: string
  image_url: string | null
}

type OrderItemWithProduct = OrderItemRecord & {
  products: ItemProductRef | null
}

// Timeline entry type for order tracking
type TimelineEntry = {
  status: string
  timestamp: string
  note?: string
}

// Pickup stop type for multi-store orders
export type PickupStop = {
  store_id: string
  store_name: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
    image_url?: string | null
  }[]
  subtotal: number
  status: "pending" | "confirmed" | "rejected" | "picked_up"
  confirmed_at?: string | null
  picked_up_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }

  return undefined
}

function isInquiryOrder(order: OrderRecord) {
  return (
    order.order_type === "inquiry" ||
    order.status === "inquiry" ||
    order.delivery_address === "Contact via WhatsApp" ||
    order.delivery_address === "Contact via Phone"
  )
}

async function fetchDocsMap(db: Firestore, collection: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, RecordMap>()
  }

  const refs = uniqueIds.map((id) => db.collection(collection).doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, RecordMap>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      map.set(doc.id, { ...(doc.data() as Record<string, unknown>), id: doc.id })
    }
  })

  return map
}

// Fetch store data from users collection (stores are now embedded in users)
async function fetchStoresMap(db: Firestore, storeIds: string[]) {
  const uniqueIds = Array.from(new Set(storeIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map<string, RecordMap>()
  }

  // Store IDs are now User IDs
  const refs = uniqueIds.map((id) => db.collection("users").doc(id))
  const docs = await db.getAll(...refs)
  const map = new Map<string, RecordMap>()

  docs.forEach((doc: DocumentSnapshot) => {
    if (doc.exists) {
      const data = doc.data()
      if (data?.store) {
        map.set(doc.id, {
          id: doc.id,
          seller_id: doc.id,
          ...data.store,
        })
      }
    }
  })

  return map
}

async function getOrderItemsByOrderIds(db: Firestore, orderIds: string[]) {
  const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)))
  if (uniqueIds.length === 0) return [] as OrderItemRecord[]

  const items: OrderItemRecord[] = []
  const chunks = chunkArray(uniqueIds, 10)

  for (const chunk of chunks) {
    const snapshot = await db.collection("order_items").where("order_id", "in", chunk).get()
    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const orderId = typeof data.order_id === "string" ? data.order_id : ""
      const productId = typeof data.product_id === "string" ? data.product_id : ""
      items.push({
        ...(data as Record<string, unknown>),
        id: doc.id,
        order_id: orderId,
        product_id: productId,
      })
    })
  }

  return items
}

// Get a single order by ID
export async function getOrderById(orderId: string, callerUserId?: string) {
  try {
    const db = getAdminDb()

    // First try to find by document ID
    let orderDoc = await db.collection("orders").doc(orderId).get()

    // If not found, try to find by order_id field
    if (!orderDoc.exists) {
      const snapshot = await db
        .collection("orders")
        .where("order_id", "==", orderId)
        .limit(1)
        .get()

      if (snapshot.empty) {
        return null
      }
      orderDoc = snapshot.docs[0]
    }

    const orderData = orderDoc.data()
    if (!orderData) return null

    // التحقق من الهوية سيرفر-سايد (إجباري): المستدعي إمّا العميل أو التاجر أو السائق
    const uid = await getCurrentUid()
    const isCustomer = orderData.customer_id === uid
    const isSeller = orderData.store_id === uid
    const isDriver = orderData.driver_id === uid
    if (!uid || (!isCustomer && !isSeller && !isDriver)) {
      return null
    }

    // Get order items
    const itemsSnapshot = await db
      .collection("order_items")
      .where("order_id", "==", orderDoc.id)
      .get()

    const productIds = itemsSnapshot.docs.map((doc) => doc.data().product_id).filter(Boolean)
    const productMap = await fetchDocsMap(db, "products", productIds)

    const items = itemsSnapshot.docs.map((doc) => {
      const itemData = doc.data()
      const product = productMap.get(itemData.product_id)
      return {
        ...itemData,
        id: doc.id,
        name: product?.name || itemData.name,
        image_url: product?.image_url || itemData.image_url,
      }
    })

    // Convert Timestamps to strings
    const createdAt = orderData.created_at?.toDate?.()?.toISOString?.() || orderData.created_at
    const updatedAt = orderData.updated_at?.toDate?.()?.toISOString?.() || orderData.updated_at

    // لا نُعيد كود التسليم عبر هذه الدالة (يستدعيها البائع أيضًا) — يبقى الإثبات مع العميل عبر قوائمه
    const orderSafe = { ...orderData } as Record<string, unknown>
    delete orderSafe.delivery_code
    return {
      id: orderDoc.id,
      order_id: orderDoc.id,
      ...orderSafe,
      items,
      created_at: createdAt,
      updated_at: updatedAt,
    }
  } catch (error) {
    logError("[v0] Error fetching order:", error)
    return null
  }
}

// حدّ أقصى لقوائم الطلبات: يمنع إعادة قراءة كامل تاريخ الطلبات في كل استطلاع (تكلفة Firestore
// تكبر بلا حد). نجلب الأحدث أولًا عبر فهرس (store_id/customer_id + created_at) الموجود مسبقًا.
const STORE_ORDERS_LIMIT = 200
const CUSTOMER_ORDERS_LIMIT = 100

export async function getCustomerOrders(customerId: string) {
  // التحقق سيرفر-سايد: العميل يقرأ طلباته فقط
  if (!(await requireOwner(customerId))) return []
  const db = getAdminDb()
  const snapshot = await db
    .collection("orders")
    .where("customer_id", "==", customerId)
    .orderBy("created_at", "desc")
    .limit(CUSTOMER_ORDERS_LIMIT)
    .get()
  // Filter out multi-store and inquiry records from regular customer orders
  const orders: OrderRecord[] = snapshot.docs
    .map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id } as OrderRecord))
    .filter((order) => order.order_type !== "multi_store" && !isInquiryOrder(order))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  // Use fetchStoresMap for stores (now embedded in users collection)
  const storeMap = await fetchStoresMap(
    db,
    orders.map((order) => order.store_id || ""),
  )

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item) => item.product_id),
  )

  const itemsByOrder = new Map<string, OrderItemWithProduct[]>()
  orderItems.forEach((item) => {
    const product = productMap.get(item.product_id)
    const entry: OrderItemWithProduct = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: typeof product.name === "string" ? product.name : "",
          image_url: typeof product.image_url === "string" ? product.image_url : null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order) => {
    const store = order.store_id ? storeMap.get(order.store_id) : null
    return {
      ...order,
      stores: store
        ? {
          id: store.id,
          name: typeof store.name === "string" ? store.name : "",
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

export async function getPendingOrdersCount(storeId: string): Promise<number> {
  // التحقق سيرفر-سايد: التاجر يقرأ عدّاد متجره فقط
  if (!(await requireOwner(storeId))) return 0
  const db = getAdminDb()
  try {
    // Count single-store pending orders
    const singleSnap = await db.collection("orders")
      .where("store_id", "==", storeId)
      .where("status", "==", "pending")
      .get()
    let count = singleSnap.size

    // Count multi-store orders where this store's stop is pending — مقيّدة بمتجر هذا البائع
    // عبر الفهرس store_ids (array-contains) بدل قراءة كل طلبات المنصة على كل استطلاع.
    const multiSnap = await db.collection("orders")
      .where("order_type", "==", "multi_store")
      .where("store_ids", "array-contains", storeId)
      .get()
    multiSnap.docs.forEach((doc) => {
      const stops: PickupStop[] = (doc.data().pickup_stops as PickupStop[]) || []
      const myStop = stops.find((s) => s.store_id === storeId)
      if (myStop && myStop.status === "pending") {
        count++
      }
    })

    return count
  } catch (error) {
    logError("[getPendingOrdersCount] Error:", error)
    return 0
  }
}

export async function getStoreOrders(storeId: string, callerId: string) {
  // التحقق من الهوية سيرفر-سايد (لا نثق بـ callerId من العميل)
  if (!(await requireOwner(storeId))) {
    logError("[getStoreOrders] Unauthorized access attempt", { storeId })
    return []
  }

  const db = getAdminDb()
  const snapshot = await db
    .collection("orders")
    .where("store_id", "==", storeId)
    .orderBy("created_at", "desc")
    .limit(STORE_ORDERS_LIMIT)
    .get()
  // Exclude inquiry records from standard seller order lists
  const orders: OrderRecord[] = snapshot.docs
    .map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id } as OrderRecord))
    .filter((order) => !isInquiryOrder(order))

  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

  if (orders.length === 0) {
    return []
  }

  const orderItems = await getOrderItemsByOrderIds(
    db,
    orders.map((order) => order.id),
  )

  const productMap = await fetchDocsMap(
    db,
    "products",
    orderItems.map((item) => item.product_id),
  )

  const customerMap = await fetchDocsMap(
    db,
    "users",
    orders.map((order) => order.customer_id || ""),
  )

  const itemsByOrder = new Map<string, OrderItemWithProduct[]>()
  orderItems.forEach((item) => {
    const product = productMap.get(item.product_id)
    const entry: OrderItemWithProduct = {
      ...item,
      products: product
        ? {
          id: product.id,
          name: typeof product.name === "string" ? product.name : "",
          image_url: typeof product.image_url === "string" ? product.image_url : null,
        }
        : null,
    }

    if (!itemsByOrder.has(item.order_id)) {
      itemsByOrder.set(item.order_id, [])
    }
    itemsByOrder.get(item.order_id)!.push(entry)
  })

  return orders.map((order) => {
    const profile = order.customer_id ? customerMap.get(order.customer_id) : null
    // إخفاء كود التسليم عن البائع: هو الطرف الذي يُطالَب بالكود عند التسليم، فلا يجب أن يراه
    // مسبقًا وإلا انهار إثبات COD (يقدر يعلّم "تم التوصيل" بلا حضور العميل). العميل يراه في /account.
    const orderSafe = { ...order } as Record<string, unknown>
    delete orderSafe.delivery_code
    return {
      ...orderSafe,
      profiles: profile
        ? {
          id: profile.id,
          full_name: typeof profile.full_name === "string" ? profile.full_name : null,
          email: typeof profile.email === "string" ? profile.email : "",
          phone: typeof profile.phone === "string" ? profile.phone : null,
        }
        : null,
      order_items: itemsByOrder.get(order.id) || [],
    }
  })
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  callerId: string,
  callerRole: "seller" | "driver" | "admin",
  note?: string,
  deliveryCode?: string
) {
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  // Create new timeline entry
  const timelineEntry: TimelineEntry = {
    status,
    timestamp: now,
    ...(note && { note }),
  }

  try {
    // Get current order to check if timeline exists
    const currentOrder = await docRef.get()
    const currentData = currentOrder.data()

    if (!currentData) {
      return { success: false, error: "Order not found" }
    }

    // التحقق من الصلاحية: مستخدمو Firebase (تاجر/أدمن) عبر الجلسة، والسائقون عبر نظام PIN المنفصل
    const caller = await getCurrentUser()
    if (caller) {
      const isStoreOwner = currentData.store_id === caller.uid
      // admin أو superAdmin يتجاوز فحص ملكية المتجر (superAdmin مجموعة فائقة من admin).
      if (!hasAdminAccess(caller.role) && !isStoreOwner) {
        return { success: false, error: "Unauthorized: not your store order" }
      }
    } else {
      // لا توجد جلسة Firebase → يُسمح فقط بالسائق المُعيّن، مُصادَقًا عبر كوكي جلسة السائق
      // (لا نثق بـ callerId/callerRole القادمين من العميل)
      const sessionDriverId = await getCurrentDriverId()
      if (!sessionDriverId || currentData.driver_id !== sessionDriverId) {
        return { success: false, error: "Unauthorized" }
      }
      // الطلبات متعددة المتاجر تُدار حصراً عبر آلة حالة الاستلام (confirmStorePickup/markStorePickedUp/
      // markOrderDeliveredByDriver). بدون هذا القيد كان السائق يقدر يضبط أي حالة غير نهائية فيتخطّى تدفق الاستلام.
      if (currentData.order_type === "multi_store") {
        return { success: false, error: "طلبات المتاجر المتعددة تُدار عبر تدفق الاستلام" }
      }
      // السائق لا يُنهي الطلب عبر هذا المسار: التسليم يتم حصراً عبر markOrderDeliveredByDriver
      // (بكود تأكيد UX-05)، والإلغاء ليس من صلاحيته. بدون هذا القيد كان يقدر يعلّم "مُسلّم" بلا كود.
      if (status === "delivered" || status === "cancelled") {
        return { success: false, error: "على السائق إتمام التسليم عبر كود التأكيد" }
      }
    }

    // قصر دائرة لو لم تتغيّر الحالة — يمنع تكرار الإشعارات/الخط الزمني وإعادة تشغيل آثار الإلغاء
    if (currentData.status === status) {
      const snap = await docRef.get()
      const noopData = snap.exists ? ({ ...snap.data(), id: snap.id } as Record<string, unknown>) : null
      if (noopData) delete noopData.delivery_code // لا نسرّب كود التسليم للبائع/السائق في رد الحالة
      return { success: true, data: noopData }
    }

    // منع الخروج من حالة نهائية (مُسلّم/ملغى) لغير الأدمن — يمنع إعادة التسليم وإحياء الطلبات الملغاة
    const TERMINAL_STATUSES = ["delivered", "cancelled"]
    if (
      !hasAdminAccess(caller?.role) &&
      TERMINAL_STATUSES.includes(String(currentData.status)) &&
      currentData.status !== status
    ) {
      return { success: false, error: "لا يمكن تغيير حالة طلب منتهٍ (مُسلّم/ملغى)" }
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: now,
    }

    // If timeline exists, append to it; otherwise create new array
    if (currentData?.timeline && Array.isArray(currentData.timeline)) {
      updatePayload.timeline = [...currentData.timeline, timelineEntry]
    } else {
      // Initialize timeline with ordered status if creating fresh timeline
      const initialTimeline: TimelineEntry[] = []
      if (status !== "ordered" && status !== "pending") {
        // Add ordered entry if it doesn't exist
        initialTimeline.push({
          status: "ordered",
          timestamp: currentData?.created_at || now,
        })
      }
      initialTimeline.push(timelineEntry)
      updatePayload.timeline = initialTimeline
    }

    // If order is delivered, mark delivery timestamp
    if (status === "delivered") {
      // UX-05: إثبات التسليم — البائع يُنهي الطلب أحادي المتجر عبر القائمة بكود التأكيد الذي يعرضه العميل.
      // لو الطلب يحمل كودًا (كل الطلبات الجديدة تحمله) نطابقه بصرامة؛ الطلبات القديمة بلا كود تُسمح (تسامح).
      const expectedCode = String(currentData.delivery_code || "").trim()
      if (expectedCode) {
        // قفل ضد التخمين العنيف: بعد 5 محاولات خاطئة نُجمّد المطابقة 15 دقيقة (كود من 4 أرقام).
        const attempts = Number(currentData.delivery_code_attempts) || 0
        const lockedUntil = Number(currentData.delivery_code_locked_until) || 0
        if (lockedUntil > Date.now()) {
          return { success: false, error: "محاولات كثيرة، حاول لاحقًا" }
        }
        if (String(deliveryCode || "").trim() !== expectedCode) {
          const nextAttempts = attempts + 1
          await docRef.update({
            delivery_code_attempts: nextAttempts,
            ...(nextAttempts >= 5
              ? { delivery_code_locked_until: Date.now() + 15 * 60 * 1000, delivery_code_attempts: 0 }
              : {}),
          })
          return { success: false, error: "كود التأكيد غير صحيح" }
        }
        // نجاح المطابقة: صفّر العدّاد وأزل القفل
        updatePayload.delivery_code_attempts = 0
        updatePayload.delivery_code_locked_until = FieldValue.delete()
      }
      updatePayload.delivered_at = now
    }

    await docRef.set(updatePayload, { merge: true })

    // استعادة المخزون عند الإلغاء — مرة واحدة فقط (علم stock_restored يمنع التكرار).
    // مقصورة على الطلبات أحادية المتجر: الطلبات متعددة المتاجر تُستعاد لكل محطة عبر
    // rejectStorePickup (وعناصرها في pickup_stops لا في order_items)، فتجنّبًا للاستعادة
    // المزدوجة لا نلمسها هنا.
    if (status === "cancelled" && currentData.order_type !== "multi_store") {
      try {
        const itemsSnap = await db.collection("order_items").where("order_id", "==", orderId).get()
        // ذرّية: نعيد قراءة stock_restored داخل معاملة ونضبطه مرة واحدة، فلا يستعيد إلغاءان
        // متزامنان (نقرتان / أدمن+تاجر) المخزون مرتين. الدُفعة السابقة لم تكن تكتشف التعارض.
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(docRef)
          if (fresh.data()?.stock_restored) return
          for (const itemDoc of itemsSnap.docs) {
            const it = itemDoc.data()
            const qty = Number(it.quantity) || 0
            if (it.product_id && qty > 0) {
              tx.update(db.collection("products").doc(it.product_id), {
                stock: FieldValue.increment(qty),
              })
            }
          }
          tx.update(docRef, { stock_restored: true })
        })
      } catch (restoreErr) {
        logError("[orders] Error restoring stock on cancel:", restoreErr)
      }
    }

    // Send review request notification when order is delivered
    if (status === "delivered" && currentData?.customer_id) {
      await sendReviewRequestNotification({
        user_id: currentData.customer_id,
        order_id: orderId,
        driver_name: currentData.driver_name,
      })
    } else if (currentData?.customer_id && status !== "ordered") {
      // Send general status update notification for all statuses including pending and reviewing
      const statusMessages: Record<string, { ar: string, en: string }> = {
        pending: { ar: "تم استلام طلبك وهو قيد الانتظار", en: "Your order has been received and is pending" },
        reviewing: { ar: "طلبك قيد المراجعة الآن", en: "Your order is being reviewed" },
        confirmed: { ar: "تم تأكيد طلبك بنجاح", en: "Your order has been confirmed" },
        processing: { ar: "طلبك قيد التجهيز الآن", en: "Your order is being processed" },
        shipped: { ar: "تم شحن طلبك", en: "Your order has been shipped" },
        on_the_way: { ar: "طلبك في الطريق إليك", en: "Your order is on the way" },
        cancelled: { ar: "تم إلغاء طلبك", en: "Your order has been cancelled" },
      }

      const message = statusMessages[status] || {
        ar: `تم تحديث حالة طلبك إلى: ${status}`,
        en: `Your order status has been updated to: ${status}`
      }

      // Use /account for single-store orders, /account/edit-order for multi-store
      const notificationLink = currentData.order_type === "multi_store"
        ? `/account/edit-order/${orderId}`
        : `/account`

      await createNotification({
        user_id: currentData.customer_id,
        title: "تحديث حالة الطلب",
        title_en: "Order Status Update",
        message: message.ar,
        message_en: message.en,
        type: "order_status",
        link: notificationLink,
        data: { order_id: orderId, status }
      })

      // FCM web-push للعميل بتحديث الحالة (أفضل-جهد؛ لا يرمي أبدًا ولا-عملية حتى ضبط VAPID)
      await sendPushToOwner("user", currentData.customer_id, {
        title: "تحديث حالة الطلب",
        body: message.ar,
        link: notificationLink,
      })
    }
  } catch (error: unknown) {
    logError("[v0] Error updating order status:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to update order status" }
  }

  const updatedSnap = await docRef.get()
  revalidatePath("/seller/orders")
  revalidatePath("/account")
  const updatedData = updatedSnap.exists ? ({ ...updatedSnap.data(), id: updatedSnap.id } as Record<string, unknown>) : null
  if (updatedData) delete updatedData.delivery_code // لا نسرّب كود التسليم للبائع/السائق في رد الحالة
  return { success: true, data: updatedData }
}

export async function createOrder(orderData: {
  customer_id: string
  store_id: string
  total: number
  delivery_address: string
  customer_name?: string
  customer_phone?: string
  delivery_city?: string
  delivery_state?: string
  delivery_latitude?: number
  delivery_longitude?: number
  delivery_notes?: string
  landmark?: string
  delivery_company?: string
  delivery_price?: number
  driver_id?: string
  driver_name?: string
  idempotency_key?: string
  items: { product_id: string; quantity: number; price: number }[]
}) {
  // التحقق سيرفر-سايد: العميل ينشئ طلبًا باسمه فقط
  if (!(await requireOwner(orderData.customer_id))) {
    return { success: false, error: "Unauthorized" }
  }
  const db = getAdminDb()
  const now = new Date().toISOString()
  // إعادة احتساب الخصم سيرفر-سايد حتى يُحاسَب العميل بالسعر المخفّض الذي رآه، لا الكامل.
  const activeOffers = await getActiveOffersForStores([orderData.store_id])
  const today = now.split("T")[0]

  // سعر التوصيل يُشتق من مستند السائق سيرفر-سايد إن وُجد سائق — لا نثق بقيمة العميل (مبلغ COD).
  let serverDeliveryPrice = sanitizeMoney(orderData.delivery_price)
  if (orderData.driver_id) {
    const driverSnap = await db.collection("drivers").doc(orderData.driver_id).get()
    if (driverSnap.exists) {
      // رفض الطلب لو السائق المختار محظور (disabled === true) — نفس شكل الفشل (success:false + error)
      if (driverSnap.data()?.disabled === true) {
        return { success: false, error: "السائق غير متاح" }
      }
      serverDeliveryPrice = sanitizeMoney(Number(driverSnap.data()?.price ?? 0))
    }
  }

  // تتبّع العروض المُطبَّقة لتحديث كميتها المستهلكة بعد نجاح المعاملة (حد كمية العرض)
  const appliedOffers = new Map<string, number>()

  try {
    const result = await db.runTransaction(async (transaction) => {
      appliedOffers.clear() // إعادة الضبط مع كل محاولة (المعاملة قد تُعاد)
      // Step 0: idempotency — لو نفس مفتاح الدفع أنشأ طلبًا قبل كده، نرجّع الطلب القائم بدل تكراره.
      // (يمنع الطلب المزدوج من الضغط المتكرر/إعادة محاولة الشبكة). المفتاح مُنمَّط بالعميل فلا يتصادم بين العملاء.
      const idemRef = orderData.idempotency_key
        ? db.collection("order_idempotency").doc(`${orderData.customer_id}:${orderData.idempotency_key}`)
        : null
      if (idemRef) {
        const idemDoc = await transaction.get(idemRef)
        if (idemDoc.exists) {
          return { orderId: String(idemDoc.data()?.order_id || ""), orderPayload: null as Record<string, unknown> | null, storeId: orderData.store_id, deduped: true }
        }
      }
      // FIX 7: رفض الطلبات للمتاجر المحظورة (is_approved === false) — نقرأ مستند المتجر داخل المعاملة.
      // المتاجر القديمة/قيد المراجعة (بلا الحقل) تبقى مسموحة (mirror getStores !== false).
      const storeUserSnap = await transaction.get(db.collection("users").doc(orderData.store_id))
      if ((storeUserSnap.data() as { store?: { is_approved?: boolean } } | undefined)?.store?.is_approved === false) {
        throw new Error("Store not available")
      }
      // Step 1: Read and verify stock + prices atomically
      // تجميع الكميات حسب product_id قبل الفحص — يمنع تجاوز المخزون لو تكرّر نفس المنتج في عدة أسطر
      // (كل سطر كان يُفحص ضد كامل المخزون ثم يُخصم على حدة → بيع بالسالب).
      const qtyByProduct = new Map<string, number>()
      for (const item of orderData.items) {
        const q = validateQuantity(item.quantity)
        qtyByProduct.set(item.product_id, (qtyByProduct.get(item.product_id) || 0) + q)
      }

      const verifiedItems: { product_id: string; quantity: number; price: number; productRef: FirebaseFirestore.DocumentReference }[] = []
      for (const [productId, quantity] of qtyByProduct) {
        const productRef = db.collection("products").doc(productId)
        const productDoc = await transaction.get(productRef)
        if (!productDoc.exists) {
          throw new Error("Product not found")
        }
        const productData = productDoc.data()
        const availableStock = productData?.stock ?? 0
        if (quantity > availableStock) {
          throw new Error(`Requested quantity for "${productData?.name || 'product'}" (${quantity}) exceeds available stock (${availableStock})`)
        }
        // السعر يُشتق من مستند المنتج فقط — لا رجوع لسعر العميل (كان منفذًا للتلاعب بالسعر).
        const basePrice = Number(productData?.price)
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          throw new Error(`Invalid price for "${productData?.name || 'product'}"`)
        }
        const finalPrice = applyOfferDiscount(
          {
            id: productId,
            category: productData?.category as string | undefined,
            store_id: (productData?.store_id as string | undefined) ?? orderData.store_id,
            price: basePrice,
          },
          activeOffers,
          today,
        )
        const appliedOffer = findBestDiscount(
          {
            id: productId,
            category: productData?.category as string | undefined,
            store_id: (productData?.store_id as string | undefined) ?? orderData.store_id,
          },
          activeOffers,
        )
        if (appliedOffer.offer_id && appliedOffer.discount_percentage > 0) {
          appliedOffers.set(appliedOffer.offer_id, (appliedOffers.get(appliedOffer.offer_id) || 0) + quantity)
        }
        verifiedItems.push({
          product_id: productId,
          quantity,
          price: finalPrice,
          productRef,
        })
      }

      // Step 2: Calculate verified total (الكمية مُتحقَّقة، ورسوم التوصيل مُشتقّة من السائق)
      const verifiedSubtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const verifiedTotal = verifiedSubtotal + serverDeliveryPrice

      const orderRef = db.collection("orders").doc()

      const orderPayload: Record<string, unknown> = {
        customer_id: orderData.customer_id,
        store_id: orderData.store_id,
        total: Number(verifiedTotal),
        delivery_address: orderData.delivery_address,
        status: "pending",
        created_at: now,
        updated_at: now,
        // UX-05: كود تأكيد تسليم (إثبات) — يعرضه العميل للبائع/السائق عند التسليم (مثل الطلب متعدد المتاجر)
        delivery_code: String(Math.floor(1000 + Math.random() * 9000)),
        timeline: [
          {
            status: "ordered",
            timestamp: now,
          } as TimelineEntry,
        ],
      }

      // Add optional delivery details
      if (orderData.customer_name) orderPayload.customer_name = orderData.customer_name
      if (orderData.customer_phone) orderPayload.customer_phone = orderData.customer_phone
      if (orderData.delivery_city) orderPayload.delivery_city = orderData.delivery_city
      if (orderData.delivery_state) orderPayload.delivery_state = orderData.delivery_state
      if (orderData.delivery_notes) orderPayload.delivery_notes = orderData.delivery_notes
      if (orderData.landmark) orderPayload.landmark = orderData.landmark
      if (orderData.delivery_company) orderPayload.delivery_company = orderData.delivery_company
      orderPayload.delivery_price = serverDeliveryPrice

      // Add driver information
      if (orderData.driver_id) orderPayload.driver_id = orderData.driver_id
      if (orderData.driver_name) orderPayload.driver_name = orderData.driver_name

      // Add coordinates if available
      if (orderData.delivery_latitude !== undefined && orderData.delivery_longitude !== undefined) {
        orderPayload.delivery_latitude = Number(orderData.delivery_latitude)
        orderPayload.delivery_longitude = Number(orderData.delivery_longitude)
      }

      // Step 3: Create order atomically
      transaction.set(orderRef, orderPayload)

      // Step 4: Create order items atomically
      verifiedItems.forEach((item) => {
        const itemRef = db.collection("order_items").doc()
        transaction.set(itemRef, {
          order_id: orderRef.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          created_at: now,
        })
      })

      // Step 5: Decrement stock atomically
      for (const item of verifiedItems) {
        transaction.update(item.productRef, {
          stock: FieldValue.increment(-item.quantity),
          updated_at: now,
        })
      }

      // Step 6: تسجيل مفتاح idempotency داخل نفس المعاملة الذرّية
      if (idemRef) {
        transaction.set(idemRef, { order_id: orderRef.id, customer_id: orderData.customer_id, created_at: now })
      }

      return { orderId: orderRef.id, orderPayload: orderPayload as Record<string, unknown> | null, storeId: orderData.store_id, deduped: false }
    })

    // لو كان الطلب مكررًا (نفس مفتاح idempotency) نرجّع الطلب القائم دون خصم مخزون/إشعار مرة أخرى
    if (result.deduped) {
      return { success: true, data: { id: result.orderId } }
    }

    // تحديث الكمية المستهلكة للعروض المُطبَّقة (غير حرج — لا يفشل الطلب)
    try {
      for (const [offerId, qty] of appliedOffers) {
        await db.collection("offers").doc(offerId).update({ used_quantity: FieldValue.increment(qty) })
      }
    } catch { /* non-critical */ }

    // Notifications outside transaction (non-critical)
    try {
      await createNotification({
        user_id: result.storeId,
        title: "طلب جديد",
        title_en: "New Order",
        message: `لديك طلب جديد برقم ${result.orderId}`,
        message_en: `You have a new order: ${result.orderId}`,
        type: "new_order",
        link: "/seller/orders",
        data: { order_id: result.orderId, store_id: result.storeId },
      })
    } catch (notifyErr) {
      // إشعار البائع فشل — لا يفشل الطلب، لكن نسجّله (سبب محتمل لتأخّر قبول الطلبات)
      await logServerError("createOrder.notify", notifyErr, { order_id: result.orderId, store_id: result.storeId })
    }

    // FCM web-push للبائع (أفضل-جهد؛ sendPushToOwner لا يرمي أبدًا ولا-عملية حتى ضبط VAPID)
    await sendPushToOwner("user", result.storeId, {
      title: "طلب جديد",
      body: "لديك طلب جديد",
      link: "/seller/orders",
    })

    revalidatePath("/account")
    return { success: true, data: { id: result.orderId, ...result.orderPayload } }
  } catch (error: unknown) {
    await logServerError("createOrder", error, { customer_id: orderData.customer_id, store_id: orderData.store_id })
    return { success: false, error: getErrorMessage(error) || "Failed to create order" }
  }
}

export async function createContactInquiry(inquiryData: {
  customer_id: string
  product_id: string
  store_id: string
  price: number
  contact_method: "whatsapp" | "call"
}) {
  // الهوية تُشتق من الجلسة — لا نثق بـ customer_id القادم من العميل (يمنع تلفيق استفسارات باسم الغير)
  if (!(await requireOwner(inquiryData.customer_id))) {
    return { success: false, error: "Unauthorized" }
  }

  const db = getAdminDb()
  const now = new Date().toISOString()
  const orderRef = db.collection("orders").doc()

  const deliveryAddress = inquiryData.contact_method === "whatsapp" ? "Contact via WhatsApp" : "Contact via Phone"

  const orderPayload = {
    customer_id: inquiryData.customer_id,
    store_id: inquiryData.store_id,
    total: Number(inquiryData.price),
    delivery_address: deliveryAddress,
    status: "inquiry",
    order_type: "inquiry",
    contact_method: inquiryData.contact_method,
    inquiry_product_id: inquiryData.product_id,
    created_at: now,
    updated_at: now,
  }

  try {
    await orderRef.set(orderPayload)
  } catch (error: unknown) {
    logError("[v0] Error creating contact inquiry:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to create inquiry" }
  }

  try {
    await db.collection("order_items").doc().set({
      order_id: orderRef.id,
      product_id: inquiryData.product_id,
      quantity: 1,
      price: Number(inquiryData.price),
      created_at: now,
    })
  } catch (error: unknown) {
    logError("[v0] Error creating order item:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to create inquiry item" }
  }

  revalidatePath("/account")
  revalidatePath("/seller/orders")
  return { success: true, data: { id: orderRef.id, ...orderPayload } }
}

// Change driver for an order (after rejection or customer request)
export async function changeOrderDriver(
  orderId: string,
  customerId: string,
  newDriverId: string,
  newDriverName: string,
  _newDeliveryPrice: number
) {
  // التحقق سيرفر-سايد: العميل يعدّل طلبه فقط
  if (!(await requireOwner(customerId))) {
    return { success: false, error: "Unauthorized" }
  }
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const orderDoc = await docRef.get()
    if (!orderDoc.exists) {
      return { success: false, error: "Order not found" }
    }

    const orderData = orderDoc.data()

    // Verify the customer owns this order
    if (orderData?.customer_id !== customerId) {
      return { success: false, error: "You are not allowed to modify this order" }
    }

    // Only allow driver change if status is driver_rejected or pending
    if (orderData?.status !== "driver_rejected" && orderData?.status !== "pending") {
      return { success: false, error: "Driver cannot be changed at this stage" }
    }

    // التحقق من السائق سيرفر-سايد: يجب أن يكون موجودًا ومعتمَدًا — ونأخذ اسمه من المستند
    const driverSnap = await db.collection("drivers").doc(newDriverId).get()
    if (!driverSnap.exists) {
      return { success: false, error: "Driver not found" }
    }
    const driverData = driverSnap.data()
    // اعتماد السائق: نطبّع الحقلين (الحديث isApproved والقديم is_approved) ونرفض غير المعتمد أو
    // الناقص كليهما. (سابقًا `=== false` كان يمرّر مستندات المخطط الحديث ومستندات ناقصة الحقلين.)
    const driverApproved = driverData?.isApproved ?? driverData?.is_approved ?? false
    if (!driverApproved) {
      return { success: false, error: "Driver is not approved" }
    }
    // رفض السائق المحظور (disabled === true) — نفس شكل فشل السائق غير المعتمد
    if (driverData?.disabled === true) {
      return { success: false, error: "السائق غير متاح" }
    }
    const verifiedDriverName = (driverData?.name as string) || newDriverName
    // سعر التوصيل يُشتق من مستند السائق سيرفر-سايد — لا نثق بقيمة العميل (كانت تسمح بجعله 0).
    const safeDeliveryPrice = sanitizeMoney(Number(driverData?.price ?? 0))

    // Calculate new total (subtract old delivery price, add new)
    const oldDeliveryPrice = orderData.delivery_price || 0
    const productTotal = (orderData.total || 0) - oldDeliveryPrice
    const newTotal = productTotal + safeDeliveryPrice

    // Create timeline entry
    const timelineEntry: TimelineEntry = {
      status: "driver_changed",
      timestamp: now,
      note: `تم تغيير السائق إلى ${verifiedDriverName}`,
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: "pending", // Reset to pending for new driver to accept
      driver_id: newDriverId,
      driver_name: verifiedDriverName,
      delivery_price: safeDeliveryPrice,
      total: newTotal,
      driver_rejected_at: null,
      driver_rejection_reason: null,
      updated_at: now,
    }

    // Add to timeline
    if (orderData?.timeline && Array.isArray(orderData.timeline)) {
      updatePayload.timeline = [...orderData.timeline, timelineEntry]
    } else {
      updatePayload.timeline = [timelineEntry]
    }

    await docRef.set(updatePayload, { merge: true })

    revalidatePath("/account")
    revalidatePath("/seller/orders")

    return { success: true }
  } catch (error: unknown) {
    logError("[v0] Error changing driver:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to change driver" }
  }
}

// Get orders with driver_rejected status for a customer
export async function getRejectedOrdersForCustomer(customerId: string) {
  if (!(await requireOwner(customerId))) return { success: true, orders: [] }
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("customer_id", "==", customerId)
      .where("status", "==", "driver_rejected")
      .get()

    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching rejected orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// ========================================
// Multi-Store Order Functions
// ========================================

// Create a multi-store order with pickup stops
export async function createMultiStoreOrder(orderData: {
  customer_id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  delivery_city?: string
  delivery_state?: string
  delivery_latitude?: number
  delivery_longitude?: number
  delivery_notes?: string
  landmark?: string
  driver_id: string
  driver_name: string
  delivery_price: number
  driver_commission: number
  pickup_stops: PickupStop[]
  idempotency_key?: string
}) {
  // التحقق سيرفر-سايد: العميل ينشئ طلبًا باسمه فقط
  if (!(await requireOwner(orderData.customer_id))) {
    return { success: false, error: "Unauthorized" }
  }
  const db = getAdminDb()
  const now = new Date().toISOString()
  const orderRef = db.collection("orders").doc()
  // إعادة احتساب الخصم سيرفر-سايد لكل متاجر الطلب (نفس السعر المخفّض الذي رآه العميل)
  const storeIdsForOffers = Array.from(
    new Set((orderData.pickup_stops || []).map((s) => s.store_id).filter(Boolean)),
  ) as string[]
  const activeOffers = await getActiveOffersForStores(storeIdsForOffers)
  const today = now.split("T")[0]

  // سعر التوصيل يُشتق من مستند السائق سيرفر-سايد — لا نثق بقيمة العميل (مبلغ COD).
  let serverDeliveryPrice = sanitizeMoney(orderData.delivery_price)
  if (orderData.driver_id) {
    const driverSnap = await db.collection("drivers").doc(orderData.driver_id).get()
    if (driverSnap.exists) {
      // رفض الطلب لو السائق المختار محظور (disabled === true) — نفس شكل الفشل (success:false + error)
      if (driverSnap.data()?.disabled === true) {
        return { success: false, error: "السائق غير متاح" }
      }
      serverDeliveryPrice = sanitizeMoney(Number(driverSnap.data()?.price ?? 0))
    }
  }

  // تتبّع العروض المُطبَّقة لتحديث كميتها المستهلكة بعد نجاح المعاملة (حد كمية العرض)
  const appliedOffers = new Map<string, number>()

  try {
    const result = await db.runTransaction(async (transaction) => {
      appliedOffers.clear() // إعادة الضبط مع كل محاولة (المعاملة قد تُعاد)
      // Step 0: idempotency — منع الطلب المزدوج (نفس مفتاح الدفع) عبر مساحة اسم بالعميل
      const idemRef = orderData.idempotency_key
        ? db.collection("order_idempotency").doc(`${orderData.customer_id}:${orderData.idempotency_key}`)
        : null
      if (idemRef) {
        const idemDoc = await transaction.get(idemRef)
        if (idemDoc.exists) {
          return { orderId: String(idemDoc.data()?.order_id || ""), orderPayload: null as Record<string, unknown> | null, stops: [] as PickupStop[], deduped: true }
        }
      }
      // FIX 7: رفض الطلب لو أي متجر محطة محظور (is_approved === false) — نقرأ مستندات المتاجر داخل المعاملة
      const uniqueStoreIds = Array.from(
        new Set((orderData.pickup_stops || []).map((s) => s.store_id).filter(Boolean)),
      ) as string[]
      for (const sid of uniqueStoreIds) {
        const storeUserSnap = await transaction.get(db.collection("users").doc(sid))
        if ((storeUserSnap.data() as { store?: { is_approved?: boolean } } | undefined)?.store?.is_approved === false) {
          throw new Error("Store not available")
        }
      }
      // Step 1: Read and verify stock + prices atomically.
      // تجميع الكميات لكل product_id عبر كل المحطات — للفحص والخصم مرة واحدة فقط، فلا يتجاوز
      // المخزون لو تكرّر نفس المنتج (كل تكرار كان يُفحص ضد كامل المخزون ويُخصم على حدة → بيع بالسالب).
      const qtyByProduct = new Map<string, number>()
      for (const stop of orderData.pickup_stops) {
        for (const item of stop.items) {
          const q = validateQuantity(item.quantity)
          qtyByProduct.set(item.product_id, (qtyByProduct.get(item.product_id) || 0) + q)
        }
      }

      const priceByProduct = new Map<string, number>()
      const productRefs: { ref: FirebaseFirestore.DocumentReference; quantity: number }[] = []
      for (const [productId, totalQty] of qtyByProduct) {
        const productRef = db.collection("products").doc(productId)
        const productDoc = await transaction.get(productRef)
        if (!productDoc.exists) {
          throw new Error("Product not found")
        }
        const productData = productDoc.data()
        const availableStock = productData?.stock ?? 0
        if (totalQty > availableStock) {
          throw new Error(`Requested quantity for "${productData?.name || 'product'}" (${totalQty}) exceeds available stock (${availableStock})`)
        }
        // السعر يُشتق من مستند المنتج فقط — لا رجوع لسعر العميل.
        const basePrice = Number(productData?.price)
        if (!Number.isFinite(basePrice) || basePrice <= 0) {
          throw new Error(`Invalid price for "${productData?.name || 'product'}"`)
        }
        const finalPrice = applyOfferDiscount(
          {
            id: productId,
            category: productData?.category as string | undefined,
            store_id: productData?.store_id as string | undefined,
            price: basePrice,
          },
          activeOffers,
          today,
        )
        priceByProduct.set(productId, finalPrice)
        productRefs.push({ ref: productRef, quantity: totalQty })
        const appliedOffer = findBestDiscount(
          {
            id: productId,
            category: productData?.category as string | undefined,
            store_id: productData?.store_id as string | undefined,
          },
          activeOffers,
        )
        if (appliedOffer.offer_id && appliedOffer.discount_percentage > 0) {
          appliedOffers.set(appliedOffer.offer_id, (appliedOffers.get(appliedOffer.offer_id) || 0) + totalQty)
        }
      }

      // بناء المحطات المُتحقَّقة بالسعر المُحتسب لكل منتج (المجاميع الفرعية تبقى لكل سطر كما هي)
      const verifiedStops: PickupStop[] = []
      for (const stop of orderData.pickup_stops) {
        const verifiedItems: PickupStop["items"] = stop.items.map((item) => ({
          ...item,
          quantity: validateQuantity(item.quantity),
          price: priceByProduct.get(item.product_id) ?? 0,
        }))
        const verifiedSubtotal = verifiedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
        verifiedStops.push({
          ...stop,
          items: verifiedItems,
          subtotal: verifiedSubtotal,
        })
      }

      // Calculate subtotal from verified stops (رسوم التوصيل مُشتقّة من السائق)
      const subtotal = verifiedStops.reduce((sum, stop) => sum + stop.subtotal, 0)
      const total = subtotal + serverDeliveryPrice

      // Prepare pickup stops with default status
      const stops: PickupStop[] = verifiedStops.map((stop) => ({
        ...stop,
        status: "pending",
        confirmed_at: null,
        picked_up_at: null,
        rejected_at: null,
        rejection_reason: null,
      }))
      const storeIds = Array.from(new Set(stops.map((stop) => stop.store_id).filter(Boolean)))

      const orderPayload: Record<string, unknown> = {
        order_type: "multi_store",
        customer_id: orderData.customer_id,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        driver_id: orderData.driver_id,
        driver_name: orderData.driver_name,
        delivery_address: orderData.delivery_address,
        delivery_city: orderData.delivery_city || "",
        delivery_state: orderData.delivery_state || "",
        delivery_notes: orderData.delivery_notes || "",
        landmark: orderData.landmark || "",
        delivery_price: serverDeliveryPrice,
        driver_commission: sanitizeMoney(orderData.driver_commission),
        store_ids: storeIds,
        pickup_stops: stops,
        subtotal: Number(subtotal),
        total: Number(total),
        status: "pending",
        payment_status: "cod",
        // UX-05: كود تأكيد تسليم (إثبات) — يعرضه العميل للسائق عند الاستلام
        delivery_code: String(Math.floor(1000 + Math.random() * 9000)),
        timeline: [{ status: "ordered", timestamp: now } as TimelineEntry],
        created_at: now,
        updated_at: now,
      }

      if (orderData.delivery_latitude !== undefined && orderData.delivery_longitude !== undefined) {
        orderPayload.delivery_latitude = Number(orderData.delivery_latitude)
        orderPayload.delivery_longitude = Number(orderData.delivery_longitude)
      }

      // Step 2: Create order atomically
      transaction.set(orderRef, orderPayload)

      // Step 3: Create order_items atomically
      for (let i = 0; i < stops.length; i++) {
        for (const item of stops[i].items) {
          const itemRef = db.collection("order_items").doc()
          transaction.set(itemRef, {
            order_id: orderRef.id,
            product_id: item.product_id,
            quantity: Number(item.quantity),
            price: Number(item.price),
            store_id: stops[i].store_id,
            stop_index: i,
            created_at: now,
          })
        }
      }

      // Step 4: Decrement stock atomically
      for (const { ref, quantity } of productRefs) {
        transaction.update(ref, {
          stock: FieldValue.increment(-quantity),
          updated_at: now,
        })
      }

      // Step 5: تسجيل مفتاح idempotency داخل نفس المعاملة الذرّية
      if (idemRef) {
        transaction.set(idemRef, { order_id: orderRef.id, customer_id: orderData.customer_id, created_at: now })
      }

      return { orderId: orderRef.id, orderPayload: orderPayload as Record<string, unknown> | null, stops, deduped: false }
    })

    // طلب مكرر (نفس مفتاح idempotency) → نرجّع الطلب القائم دون خصم/إشعار مكرر
    if (result.deduped) {
      return { success: true, data: { id: result.orderId } }
    }

    // تحديث الكمية المستهلكة للعروض المُطبَّقة (غير حرج — لا يفشل الطلب)
    try {
      for (const [offerId, qty] of appliedOffers) {
        await db.collection("offers").doc(offerId).update({ used_quantity: FieldValue.increment(qty) })
      }
    } catch { /* non-critical */ }

    // Notifications outside transaction (non-critical)
    try {
      const notifBatch = db.batch()
      for (const stop of result.stops) {
        const notifRef = db.collection("notifications").doc()
        notifBatch.set(notifRef, {
          user_id: stop.store_id,
          type: "new_multi_order",
          title: "طلب جديد 🛒",
          title_en: "New Order 🛒",
          message: `لديك طلب جديد يحتوي على ${stop.items.length} منتج بقيمة ${stop.subtotal} جنيه`,
          message_en: `You have a new order with ${stop.items.length} items worth ${stop.subtotal} EGP`,
          link: "/seller/orders",
          data: { order_id: result.orderId, store_id: stop.store_id },
          is_read: false,
          created_at: now,
        })
      }

      const driverNotifRef = db.collection("notifications").doc()
      notifBatch.set(driverNotifRef, {
        user_id: orderData.driver_id,
        type: "new_multi_order",
        title: "طلب توصيل جديد 🚗",
        title_en: "New Delivery Order 🚗",
        message: `لديك طلب جديد من ${result.stops.length} متجر. في انتظار تأكيد المتاجر.`,
        message_en: `New order from ${result.stops.length} stores. Waiting for store confirmations.`,
        link: `/driver/orders?driverId=${orderData.driver_id}`,
        data: { order_id: result.orderId },
        is_read: false,
        created_at: now,
      })

      await notifBatch.commit()
    } catch (notifyErr) {
      // إشعارات المتاجر/السائق فشلت — لا يفشل الطلب، لكن نسجّلها (قد تفسّر تأخّر القبول)
      await logServerError("createMultiStoreOrder.notify", notifyErr, { order_id: result.orderId })
    }

    // FCM web-push لكل متجر محطة وللسائق (أفضل-جهد؛ لا يرمي أبدًا ولا-عملية حتى ضبط VAPID)
    await Promise.all([
      ...result.stops.map((stop) =>
        sendPushToOwner("user", stop.store_id, {
          title: "طلب جديد",
          body: "لديك طلب جديد",
          link: "/seller/orders",
        }),
      ),
      ...(orderData.driver_id
        ? [
            sendPushToOwner("driver", orderData.driver_id, {
              title: "طلب توصيل جديد",
              body: "لديك طلب توصيل جديد",
              link: `/driver/orders?driverId=${orderData.driver_id}`,
            }),
          ]
        : []),
    ])

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, data: { id: result.orderId, ...result.orderPayload } }
  } catch (error: unknown) {
    await logServerError("createMultiStoreOrder", error, { customer_id: orderData.customer_id })
    return { success: false, error: getErrorMessage(error) || "Failed to create order" }
  }
}

// Store confirms its part of a multi-store order
export async function confirmStorePickup(orderId: string, storeId: string) {
  if (!(await requireOwner(storeId))) return { success: false, error: "Unauthorized" }
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    // معاملة ذرّية: القراءة + تعديل المصفوفة + الكتابة داخل runTransaction تمنع فقدان
    // تحديثات متجر عند تأكيد متجرين بالتزامن (merge لا يدمج عناصر المصفوفات).
    const txResult = await db.runTransaction(async (tx) => {
      const orderDoc = await tx.get(docRef)
      if (!orderDoc.exists) {
        return { ok: false as const, error: "Order not found" }
      }

      const orderData = orderDoc.data() as Record<string, any>
      if (orderData?.order_type !== "multi_store") {
        return { ok: false as const, error: "This is not a multi-store order" }
      }
      // حارس الحالة النهائية للطلب (mirror markOrderDeliveredByDriver): آلة حالة المحطات كانت
      // تفحص stop.status فقط، فأمكن تأكيد محطة في طلب ملغى/مُسلَّم فيُحيا الطلب المُنهى.
      if (orderData?.status === "cancelled" || orderData?.status === "delivered") {
        return { ok: false as const, error: "الطلب مُنهى ولا يمكن تعديله" }
      }

      const stops: PickupStop[] = orderData.pickup_stops || []
      const stopIndex = stops.findIndex((s) => s.store_id === storeId)
      if (stopIndex === -1) {
        return { ok: false as const, error: "Your store was not found in this order" }
      }
      if (stops[stopIndex].status !== "pending") {
        return { ok: false as const, error: "This order has already been handled" }
      }

      stops[stopIndex].status = "confirmed"
      stops[stopIndex].confirmed_at = now

      const allConfirmed = stops.every((s) => s.status === "confirmed" || s.status === "rejected")
      const hasAnyConfirmed = stops.some((s) => s.status === "confirmed")

      const timelineEntry: TimelineEntry = {
        status: "store_confirmed",
        timestamp: now,
        note: `${stops[stopIndex].store_name} أكد الطلب`,
      }
      const timeline = [...(orderData.timeline || []), timelineEntry]

      const updatePayload: Record<string, unknown> = {
        pickup_stops: stops,
        timeline,
        updated_at: now,
      }

      if (allConfirmed && hasAnyConfirmed) {
        updatePayload.status = "confirmed"
        const activeStops = stops.filter((s) => s.status === "confirmed")
        const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
        updatePayload.subtotal = newSubtotal
        // يطابق صيغة الإنشاء: الإجمالي الفرعي + رسوم التوصيل فقط
        updatePayload.total = newSubtotal + (orderData.delivery_price || 0)
        timeline.push({
          status: "all_confirmed",
          timestamp: now,
          note: "كل المتاجر أكدت الطلب",
        })
        updatePayload.timeline = timeline
      }

      tx.set(docRef, updatePayload, { merge: true })
      return { ok: true as const, orderData, stops, stopIndex, allConfirmed, hasAnyConfirmed }
    })

    if (!txResult.ok) {
      return { success: false, error: txResult.error }
    }
    const { orderData, stops, stopIndex, allConfirmed, hasAnyConfirmed } = txResult

    // Notify customer
    const notifBatch = db.batch()

    const customerNotifRef = db.collection("notifications").doc()
    notifBatch.set(customerNotifRef, {
      user_id: orderData.customer_id,
      type: "store_confirmed",
      title: `✅ ${stops[stopIndex].store_name} أكد طلبك`,
      title_en: `✅ ${stops[stopIndex].store_name} confirmed your order`,
      message: allConfirmed && hasAnyConfirmed
        ? "كل المتاجر أكدت! السائق سيبدأ الاستلام."
        : `في انتظار تأكيد باقي المتاجر...`,
      message_en: allConfirmed && hasAnyConfirmed
        ? "All stores confirmed! Driver will start pickup."
        : `Waiting for other stores to confirm...`,
      link: `/account/edit-order/${orderId}`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    // Notify driver
    const driverNotifRef = db.collection("notifications").doc()
    notifBatch.set(driverNotifRef, {
      user_id: orderData.driver_id,
      type: "store_confirmed",
      title: `✅ ${stops[stopIndex].store_name} أكد الطلب`,
      title_en: `✅ ${stops[stopIndex].store_name} confirmed`,
      message: allConfirmed && hasAnyConfirmed
        ? "كل المتاجر أكدت الطلب. يمكنك البدء في الاستلام."
        : `في انتظار تأكيد باقي المتاجر...`,
      message_en: allConfirmed && hasAnyConfirmed
        ? "All stores confirmed. You can start pickup."
        : `Waiting for other stores...`,
      link: `/driver/orders?driverId=${orderData.driver_id}`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allConfirmed: allConfirmed && hasAnyConfirmed }
  } catch (error: unknown) {
    logError("[v0] Error confirming store pickup:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to confirm order" }
  }
}

// Store rejects its part of a multi-store order
export async function rejectStorePickup(orderId: string, storeId: string, reason?: string) {
  if (!(await requireOwner(storeId))) return { success: false, error: "Unauthorized" }
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    // معاملة ذرّية تمنع فقدان التحديثات عند رفض/تأكيد متجرين بالتزامن
    const txResult = await db.runTransaction(async (tx) => {
      const orderDoc = await tx.get(docRef)
      if (!orderDoc.exists) {
        return { ok: false as const, error: "Order not found" }
      }

      const orderData = orderDoc.data() as Record<string, any>
      if (orderData?.order_type !== "multi_store") {
        return { ok: false as const, error: "This is not a multi-store order" }
      }
      // حارس الحالة النهائية للطلب (mirror markOrderDeliveredByDriver): بدونه أمكن رفض محطة في
      // طلب ملغى/مُسلَّم — يستعيد المخزون مجددًا (تكرار) أو يُعيد كتابة حالة طلب مُنهى.
      if (orderData?.status === "cancelled" || orderData?.status === "delivered") {
        return { ok: false as const, error: "الطلب مُنهى ولا يمكن تعديله" }
      }

      const stops: PickupStop[] = orderData.pickup_stops || []
      const stopIndex = stops.findIndex((s) => s.store_id === storeId)
      if (stopIndex === -1) {
        return { ok: false as const, error: "Your store was not found in this order" }
      }
      if (stops[stopIndex].status !== "pending") {
        return { ok: false as const, error: "This order has already been handled" }
      }

      stops[stopIndex].status = "rejected"
      stops[stopIndex].rejected_at = now
      stops[stopIndex].rejection_reason = reason || "المتجر غير متاح"

      const allRejected = stops.every((s) => s.status === "rejected")
      const allResponded = stops.every((s) => s.status === "confirmed" || s.status === "rejected")
      const hasAnyConfirmed = stops.some((s) => s.status === "confirmed")

      const timelineEntry: TimelineEntry = {
        status: "store_rejected",
        timestamp: now,
        note: `${stops[stopIndex].store_name} رفض الطلب: ${reason || "غير متاح"}`,
      }
      const timeline = [...(orderData.timeline || []), timelineEntry]

      const updatePayload: Record<string, unknown> = {
        pickup_stops: stops,
        timeline,
        updated_at: now,
      }

      if (allRejected) {
        updatePayload.status = "cancelled"
        timeline.push({
          status: "cancelled",
          timestamp: now,
          note: "تم إلغاء الطلب لأن جميع المتاجر رفضت",
        })
        updatePayload.timeline = timeline
      } else if (allResponded && hasAnyConfirmed) {
        updatePayload.status = "confirmed"
        const activeStops = stops.filter((s) => s.status === "confirmed")
        const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
        updatePayload.subtotal = newSubtotal
        // يطابق صيغة الإنشاء: الإجمالي الفرعي + رسوم التوصيل فقط
        updatePayload.total = newSubtotal + (orderData.delivery_price || 0)
        timeline.push({
          status: "all_confirmed",
          timestamp: now,
          note: "تم تأكيد الطلب من المتاجر المتاحة",
        })
        updatePayload.timeline = timeline
      }

      tx.set(docRef, updatePayload, { merge: true })
      return { ok: true as const, orderData, stops, stopIndex, allRejected }
    })

    if (!txResult.ok) {
      return { success: false, error: txResult.error }
    }
    const { orderData, stops, stopIndex, allRejected } = txResult

    // استعادة مخزون عناصر المتجر الرافض — آمنة من التكرار بفضل فحص الحالة pending أعلاه.
    // المخزون خُصم عند إنشاء الطلب، فيجب إعادته عند رفض المتجر وإلا يتسرّب نهائيًا.
    try {
      const rejectedItems = stops[stopIndex].items || []
      if (rejectedItems.length > 0) {
        const restoreBatch = db.batch()
        for (const it of rejectedItems) {
          const qty = Number(it.quantity) || 0
          if (it.product_id && qty > 0) {
            restoreBatch.update(db.collection("products").doc(it.product_id), {
              stock: FieldValue.increment(qty),
            })
          }
        }
        await restoreBatch.commit()
      }
    } catch (restoreErr) {
      logError("[orders] Error restoring stock on store rejection:", restoreErr)
    }

    // Notifications
    const notifBatch = db.batch()

    const customerNotifRef = db.collection("notifications").doc()
    notifBatch.set(customerNotifRef, {
      user_id: orderData.customer_id,
      type: "store_rejected",
      title: `❌ ${stops[stopIndex].store_name} رفض الطلب`,
      title_en: `❌ ${stops[stopIndex].store_name} rejected your order`,
      message: allRejected
        ? "للأسف كل المتاجر رفضت الطلب. تم إلغاؤه."
        : `${reason || "المتجر غير متاح"}. تم خصم المبلغ الخاص بهذا المتجر.`,
      message_en: allRejected
        ? "All stores rejected. Order cancelled."
        : `${reason || "Store unavailable"}. Amount deducted.`,
      link: `/account/edit-order/${orderId}`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    const driverNotifRef = db.collection("notifications").doc()
    notifBatch.set(driverNotifRef, {
      user_id: orderData.driver_id,
      type: "store_rejected",
      title: `❌ ${stops[stopIndex].store_name} رفض الطلب`,
      title_en: `❌ ${stops[stopIndex].store_name} rejected`,
      message: allRejected
        ? "كل المتاجر رفضت الطلب. تم إلغاؤه."
        : `المتجر رفض. الطلب يستمر مع باقي المتاجر.`,
      message_en: allRejected
        ? "All stores rejected. Order cancelled."
        : `Store rejected. Order continues with others.`,
      link: `/driver/orders?driverId=${orderData.driver_id}`,
      data: { order_id: orderId },
      is_read: false,
      created_at: now,
    })

    await notifBatch.commit()

    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true, allRejected, orderCancelled: allRejected }
  } catch (error: unknown) {
    logError("[v0] Error rejecting store pickup:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to reject order" }
  }
}

// Driver marks pickup from a specific store
// driverId يُحتفظ به للتوافق مع المستدعي لكن لا يُوثَق به؛ الهوية من جلسة السائق سيرفر-سايد.
export async function markStorePickedUp(orderId: string, _driverId: string, storeId: string) {
  // مصادقة السائق سيرفر-سايد عبر كوكي الجلسة (لا نثق بـ driverId القادم من العميل/الرابط)
  const sessionDriverId = await getCurrentDriverId()
  if (!sessionDriverId) {
    return { success: false, error: "Unauthorized" }
  }
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    // معاملة ذرّية تمنع فقدان التحديثات عند استلام السائق من متجرين بالتتابع السريع
    const txResult = await db.runTransaction(async (tx) => {
      const orderDoc = await tx.get(docRef)
      if (!orderDoc.exists) {
        return { ok: false as const, error: "Order not found" }
      }

      const orderData = orderDoc.data() as Record<string, any>
      if (orderData?.driver_id !== sessionDriverId) {
        return { ok: false as const, error: "You are not allowed to update this order" }
      }
      // حارس الحالة النهائية للطلب (mirror markOrderDeliveredByDriver): بدونه أمكن استلام محطة في
      // طلب ملغى/مُسلَّم — يعيد الطلب المُنهى إلى picking_up/on_the_way.
      if (orderData?.status === "cancelled" || orderData?.status === "delivered") {
        return { ok: false as const, error: "الطلب مُنهى ولا يمكن تعديله" }
      }

      const stops: PickupStop[] = orderData.pickup_stops || []
      const stopIndex = stops.findIndex((s) => s.store_id === storeId)
      if (stopIndex === -1) {
        return { ok: false as const, error: "Store not found in this order" }
      }
      if (stops[stopIndex].status !== "confirmed") {
        return { ok: false as const, error: "Store has not confirmed this order yet" }
      }

      stops[stopIndex].status = "picked_up"
      stops[stopIndex].picked_up_at = now

      // الطلب يصبح "في الطريق" فقط عندما تُستلم كل المحطات غير المرفوضة — بما فيها
      // أي محطة ما زالت pending (وإلا يُخطَر العميل مبكرًا وتُترك بضاعة محطة لم تؤكَّد).
      const activeStops = stops.filter((s) => s.status !== "rejected")
      const allPickedUp = activeStops.length > 0 && activeStops.every((s) => s.status === "picked_up")
      const pickedCount = stops.filter((s) => s.status === "picked_up").length
      const totalActive = activeStops.length

      const timelineEntry: TimelineEntry = {
        status: "picked_up_from_store",
        timestamp: now,
        note: `السائق استلم من ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
      }
      const timeline = [...(orderData.timeline || []), timelineEntry]

      const updatePayload: Record<string, unknown> = {
        pickup_stops: stops,
        timeline,
        updated_at: now,
      }

      if (allPickedUp) {
        updatePayload.status = "on_the_way"
        timeline.push({
          status: "on_the_way",
          timestamp: now,
          note: "السائق استلم كل المنتجات وفي الطريق للعميل",
        })
        updatePayload.timeline = timeline
      } else {
        updatePayload.status = "picking_up"
      }

      tx.set(docRef, updatePayload, { merge: true })
      return { ok: true as const, orderData, stops, stopIndex, allPickedUp, pickedCount, totalActive }
    })

    if (!txResult.ok) {
      return { success: false, error: txResult.error }
    }
    const { orderData, stops, stopIndex, allPickedUp, pickedCount, totalActive } = txResult

    // Notify customer
    const notifRef = db.collection("notifications").doc()
    await notifRef.set({
      user_id: orderData.customer_id,
      type: allPickedUp ? "all_items_picked" : "driver_picked_from_store",
      title: allPickedUp
        ? "✅ السائق استلم كل المنتجات"
        : `📦 استلام من ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
      title_en: allPickedUp
        ? "✅ Driver picked up all items"
        : `📦 Picked up from ${stops[stopIndex].store_name} (${pickedCount}/${totalActive})`,
      message: allPickedUp
        ? "السائق في الطريق إليك الآن!"
        : `السائق استلم منتجاتك من ${stops[stopIndex].store_name}`,
      message_en: allPickedUp
        ? "Driver is on the way to you!"
        : `Driver picked up from ${stops[stopIndex].store_name}`,
      link: `/account/edit-order/${orderId}`,
      data: { order_id: orderId, store_id: storeId },
      is_read: false,
      created_at: now,
    })

    revalidatePath("/account")
    return { success: true, allPickedUp }
  } catch (error: unknown) {
    logError("[v0] Error marking store picked up:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to update pickup status" }
  }
}

// UX-05: إتمام التسليم للعميل بإثبات (كود تأكيد) — يحوّل الطلب إلى "delivered" ويسجّل النقدية المحصّلة (COD).
export async function markOrderDeliveredByDriver(orderId: string, code: string) {
  const sessionDriverId = await getCurrentDriverId()
  if (!sessionDriverId) return { success: false, error: "Unauthorized" }
  const db = getAdminDb()
  const docRef = db.collection("orders").doc(orderId)
  const now = new Date().toISOString()

  try {
    const txResult = await db.runTransaction(async (tx) => {
      const orderDoc = await tx.get(docRef)
      if (!orderDoc.exists) return { ok: false as const, error: "Order not found" }
      const o = orderDoc.data() as Record<string, any>
      if (o.driver_id !== sessionDriverId) return { ok: false as const, error: "غير مصرح لك بهذا الطلب" }
      // طلبات التوزيع تُسلَّم حصراً عبر تدفق التوزيع (lib/delivery/dispatch.driverDeliver) — يمنع تجاوز
      // سقف/قفل كود التوزيع عبر هذا المسار القديم (متعدد المتاجر). التوزيع أحادي المتجر أصلًا.
      if (o.is_dispatch === true) return { ok: false as const, error: "طلب توزيع — استخدم تدفق التوزيع" }
      if (o.status === "delivered") return { ok: false as const, error: "تم تسليم الطلب بالفعل" }
      if (o.status === "cancelled") return { ok: false as const, error: "الطلب ملغى" }
      if (o.status !== "on_the_way") return { ok: false as const, error: "أكمل استلام كل المتاجر أولًا" }
      // إثبات التسليم: لو الطلب يحمل كودًا (وكل الطلبات الجديدة تحمله) نطابقه بصرامة. الطلبات القديمة
      // (قبل UX-05) بلا كود تُسمح بالإتمام حتى لا تعلق دون تسليم؛ السائق لا يقدر يحذف كود طلب جديد.
      const expected = String(o.delivery_code || "").trim()
      if (expected) {
        // قفل ضد التخمين العنيف: بعد 5 محاولات خاطئة نُجمّد المطابقة 15 دقيقة (كود من 4 أرقام).
        const attempts = Number(o.delivery_code_attempts) || 0
        const lockedUntil = Number(o.delivery_code_locked_until) || 0
        if (lockedUntil > Date.now()) {
          return { ok: false as const, error: "محاولات كثيرة، حاول لاحقًا" }
        }
        if (String(code).trim() !== expected) {
          const nextAttempts = attempts + 1
          tx.update(docRef, {
            delivery_code_attempts: nextAttempts,
            ...(nextAttempts >= 5
              ? { delivery_code_locked_until: Date.now() + 15 * 60 * 1000, delivery_code_attempts: 0 }
              : {}),
          })
          return { ok: false as const, error: "كود التأكيد غير صحيح" }
        }
      }
      const timeline = [
        ...(o.timeline || []),
        { status: "delivered", timestamp: now, note: "تم التسليم للعميل بكود التأكيد" } as TimelineEntry,
      ]
      tx.set(
        docRef,
        {
          status: "delivered",
          delivered_at: now,
          cash_collected: Number(o.total || 0),
          delivery_verified: true,
          delivery_code_attempts: 0,
          delivery_code_locked_until: FieldValue.delete(),
          timeline,
          updated_at: now,
        },
        { merge: true },
      )
      return { ok: true as const, customerId: o.customer_id as string }
    })

    if (!txResult.ok) return { success: false, error: txResult.error }

    // إشعار العميل بالتسليم + طلب التقييم
    try {
      const notifRef = db.collection("notifications").doc()
      await notifRef.set({
        user_id: txResult.customerId,
        type: "order_delivered",
        title: "✅ تم تسليم طلبك",
        title_en: "✅ Your order was delivered",
        message: "نتمنى أن ينال إعجابك! قيّم تجربتك من فضلك.",
        message_en: "We hope you enjoyed it! Please rate your experience.",
        link: `/review/${orderId}`,
        is_read: false,
        created_at: now,
      })
    } catch (e) {
      logError("[orders] delivered notification", e)
    }

    revalidatePath("/account")
    return { success: true }
  } catch (error: unknown) {
    logError("[orders] markOrderDeliveredByDriver", error)
    return { success: false, error: getErrorMessage(error) || "Failed to mark delivered" }
  }
}

// Get multi-store orders for a specific store (seller view)
export async function getMultiStoreOrdersForStore(storeId: string) {
  if (!(await requireOwner(storeId))) return { success: true, orders: [] }
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("store_ids", "array-contains", storeId)
      .get()

    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => {
        // إخفاء كود التسليم عن البائع — وإلا أمكنه تعليم الطلب مُسلَّمًا بلا حضور العميل (إثبات COD)
        const data = { id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<string, unknown>
        delete data.delivery_code
        return data as OrderRecord
      })
      .filter((order) => order.order_type === "multi_store")
      .map((order) => {
        const stops: PickupStop[] = order.pickup_stops || []
        const stop = stops.find((s) => s.store_id === storeId)
        return {
          ...order,
          my_stop: stop,
        }
      })

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get multi-store orders for a driver
export async function getMultiStoreOrdersForDriver(driverId: string) {
  // مصادقة السائق سيرفر-سايد عبر كوكي الجلسة — لا نُرجع طلبات سائق آخر بناءً على معرّف من العميل
  const sessionDriverId = await getCurrentDriverId()
  if (!sessionDriverId || sessionDriverId !== driverId) {
    return { success: false, error: "Unauthorized", orders: [] }
  }
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("driver_id", "==", driverId)
      .get()

    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => {
        // إخفاء كود التسليم عن البائع/السائق — يُدخله السائق من العميل عند الباب (إثبات تسليم حقيقي)
        const data = { id: doc.id, ...(doc.data() as Record<string, unknown>) } as Record<string, unknown>
        delete data.delivery_code
        return data as OrderRecord
      })
      .filter((order) => order.order_type === "multi_store")

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching driver multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get multi-store orders for a customer
export async function getCustomerMultiStoreOrders(customerId: string) {
  if (!(await requireOwner(customerId))) return { success: true, orders: [] }
  const db = getAdminDb()

  try {
    const snapshot = await db
      .collection("orders")
      .where("customer_id", "==", customerId)
      .get()

    // العميل يجب أن يرى كود التسليم (يعرضه للسائق عند الاستلام) — لا نحذفه من مسار العميل.
    const orders: OrderRecord[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as OrderRecord))
      .filter((order) => order.order_type === "multi_store")

    // Sort by created_at descending in JS
    orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))

    return { success: true, orders }
  } catch (error: unknown) {
    logError("[v0] Error fetching customer multi-store orders:", error)
    return { success: false, error: getErrorMessage(error), orders: [] }
  }
}

// Get a multi-store order by ID for editing
export async function getMultiStoreOrderForEdit(orderId: string, customerId: string) {
  if (!(await requireOwner(customerId))) return { success: false, error: "Unauthorized" }
  const db = getAdminDb()
  
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get()
    if (!orderDoc.exists) {
      return { success: false, error: "Order not found" }
    }
    
    const orderData = orderDoc.data()
    if (!orderData) {
      return { success: false, error: "Order data is unavailable" }
    }
    
    if (orderData.customer_id !== customerId) {
      return { success: false, error: "You are not authorized to edit this order" }
    }
    
    if (orderData.order_type !== "multi_store") {
      return { success: false, error: "This is not a multi-store order" }
    }

    // Convert Timestamps
    const createdAt = orderData.created_at?.toDate?.()?.toISOString?.() || orderData.created_at
    const updatedAt = orderData.updated_at?.toDate?.()?.toISOString?.() || orderData.updated_at
    
    return { 
      success: true, 
      order: {
        id: orderDoc.id,
        ...orderData,
        created_at: createdAt,
        updated_at: updatedAt,
      }
    }
  } catch (error: unknown) {
    logError("[v0] Error fetching order for edit:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to load order" }
  }
}

// Add new pickup stops to replace rejected ones in a multi-store order
export async function addStopsToMultiStoreOrder(orderId: string, customerId: string, newStops: {
  store_id: string
  store_name: string
  items: {
    product_id: string
    name: string
    quantity: number
    price: number
    image_url?: string | null
  }[]
  subtotal: number
}[]) {
  // التحقق سيرفر-سايد: العميل يعدّل طلبه فقط
  if (!(await requireOwner(customerId))) {
    return { success: false, error: "Unauthorized" }
  }
  const db = getAdminDb()
  const now = new Date().toISOString()
  // العروض تُجلب خارج المعاملة لإعادة احتساب السعر سيرفر-سايد (لا نثق بسعر/إجمالي العميل)
  const storeIdsForOffers = Array.from(new Set((newStops || []).map((s) => s.store_id).filter(Boolean))) as string[]
  const activeOffers = await getActiveOffersForStores(storeIdsForOffers)
  const today = now.split("T")[0]

  try {
    // كل شيء داخل معاملة واحدة: التحقق + تحديث الطلب + إنشاء العناصر + خصم المخزون.
    // يمنع الفساد عند الفشل الجزئي (كان 3 commits منفصلة) ويمنع البيع الزائد عند التزامن.
    const txResult = await db.runTransaction(async (tx) => {
      const orderRef = db.collection("orders").doc(orderId)
      const orderDoc = await tx.get(orderRef)
      if (!orderDoc.exists) {
        return { ok: false as const, error: "Order not found" }
      }
      const orderData = orderDoc.data() as Record<string, any>
      if (!orderData) {
        return { ok: false as const, error: "Order data is unavailable" }
      }
      if (orderData.customer_id !== customerId) {
        return { ok: false as const, error: "You are not authorized to edit this order" }
      }
      if (orderData.order_type !== "multi_store") {
        return { ok: false as const, error: "This is not a multi-store order" }
      }
      if (orderData.status === "delivered" || orderData.status === "cancelled") {
        return { ok: false as const, error: "Completed or cancelled orders cannot be edited" }
      }

      // تجميع الكمية المطلوبة لكل منتج (مُتحقَّقة) — يمنع خصمًا مزدوجًا لو تكرر المنتج
      const qtyByProduct = new Map<string, number>()
      for (const stop of newStops) {
        for (const item of stop.items) {
          const q = validateQuantity(item.quantity)
          qtyByProduct.set(item.product_id, (qtyByProduct.get(item.product_id) || 0) + q)
        }
      }
      // كل القراءات قبل أي كتابة (شرط معاملات Firestore) — مع التقاط السعر/الفئة للاحتساب
      const productRefs = new Map<string, FirebaseFirestore.DocumentReference>()
      const productInfo = new Map<string, { price: number; category?: string; store_id?: string }>()
      for (const [pid, qty] of Array.from(qtyByProduct.entries())) {
        const ref = db.collection("products").doc(pid)
        const snap = await tx.get(ref)
        if (!snap.exists) {
          return { ok: false as const, error: "Product was not found" }
        }
        const pdata = snap.data() || {}
        const availableStock = pdata.stock ?? 0
        if (qty > availableStock) {
          return { ok: false as const, error: `Requested quantity exceeds available stock (${availableStock})` }
        }
        productRefs.set(pid, ref)
        productInfo.set(pid, {
          price: Number(pdata.price ?? 0),
          category: pdata.category as string | undefined,
          store_id: pdata.store_id as string | undefined,
        })
      }

      // إعادة بناء العناصر بأسعار السيرفر (مع الخصم) وإعادة احتساب الإجماليات — تجاهل سعر/إجمالي العميل
      const existingStops: PickupStop[] = orderData.pickup_stops || []
      const formattedNewStops: PickupStop[] = newStops.map((stop) => {
        const verifiedItems = stop.items.map((item) => {
          const info = productInfo.get(item.product_id)
          const serverPrice = applyOfferDiscount(
            {
              id: item.product_id,
              category: info?.category,
              store_id: info?.store_id ?? stop.store_id,
              price: info?.price ?? 0,
            },
            activeOffers,
            today,
          )
          return { ...item, quantity: validateQuantity(item.quantity), price: serverPrice }
        })
        const verifiedSubtotal = verifiedItems.reduce((s, it) => s + it.price * it.quantity, 0)
        return {
          ...stop,
          items: verifiedItems,
          subtotal: verifiedSubtotal,
          status: "pending",
          confirmed_at: null,
          picked_up_at: null,
          rejected_at: null,
          rejection_reason: null,
        } as PickupStop
      })
      const updatedStops = [...existingStops, ...formattedNewStops]
      const updatedStoreIds = Array.from(new Set(updatedStops.map((s) => s.store_id).filter(Boolean)))
      const activeStops = updatedStops.filter((s) => s.status !== "rejected")
      const newSubtotal = activeStops.reduce((sum, s) => sum + s.subtotal, 0)
      const newTotal = newSubtotal + sanitizeMoney(orderData.delivery_price)
      const storeNames = newStops.map((s) => s.store_name).join("، ")
      const timeline = [
        ...(orderData.timeline || []),
        { status: "order_edited", timestamp: now, note: `العميل أضاف منتجات من: ${storeNames}` } as TimelineEntry,
      ]
      const newStatus = orderData.status === "confirmed" ? "pending" : orderData.status

      // الكتابات
      tx.set(
        orderRef,
        {
          pickup_stops: updatedStops,
          store_ids: updatedStoreIds,
          subtotal: newSubtotal,
          total: newTotal,
          timeline,
          status: newStatus,
          updated_at: now,
        },
        { merge: true },
      )
      for (const stop of formattedNewStops) {
        for (const item of stop.items) {
          const itemRef = db.collection("order_items").doc()
          tx.set(itemRef, {
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            store_id: stop.store_id,
            created_at: now,
          })
        }
      }
      for (const [pid, qty] of Array.from(qtyByProduct.entries())) {
        tx.update(productRefs.get(pid)!, { stock: FieldValue.increment(-qty), updated_at: now })
      }
      return { ok: true as const, orderData, formattedNewStops }
    })

    if (!txResult.ok) {
      return { success: false, error: txResult.error }
    }
    const { orderData, formattedNewStops } = txResult

    // Notify new stores
    const notifBatch = db.batch()
    for (const stop of formattedNewStops) {
      const notifRef = db.collection("notifications").doc()
      notifBatch.set(notifRef, {
        user_id: stop.store_id,
        type: "new_multi_order",
        title: "طلب جديد 🛒",
        title_en: "New Order 🛒",
        message: `لديك طلب جديد يحتوي على ${stop.items.length} منتج بقيمة ${stop.subtotal} جنيه`,
        message_en: `You have a new order with ${stop.items.length} items worth ${stop.subtotal} EGP`,
        link: "/seller/orders",
        data: { order_id: orderId, store_id: stop.store_id },
        is_read: false,
        created_at: now,
      })
    }
    
    // Notify driver about order update
    if (orderData.driver_id) {
      const driverNotifRef = db.collection("notifications").doc()
      notifBatch.set(driverNotifRef, {
        user_id: orderData.driver_id,
        type: "order_updated",
        title: "تم تعديل الطلب 📝",
        title_en: "Order Updated 📝",
        message: `تم إضافة متاجر جديدة للطلب. يرجى مراجعة تفاصيل الطلب.`,
        message_en: `New stores added to the order. Please review order details.`,
        link: `/driver/orders?driverId=${orderData.driver_id}`,
        data: { order_id: orderId },
        is_read: false,
        created_at: now,
      })
    }
    
    await notifBatch.commit()
    
    revalidatePath("/account")
    revalidatePath("/seller/orders")
    return { success: true }
  } catch (error: unknown) {
    logError("[v0] Error adding stops to multi-store order:", error)
    return { success: false, error: getErrorMessage(error) || "Failed to edit order" }
  }
}
