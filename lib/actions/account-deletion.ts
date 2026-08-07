"use server"

// حذف الحساب — متطلَّب إلزامي من Google Play لأي تطبيق يسمح بإنشاء حسابات:
// مسار داخل التطبيق + رابط عام يطلب منه غير المسجَّل الحذف.
//
// المبدأ الحاكم: نحذف *الشخص* ونُبقي *السجل التجاري*. طلبات الدفع عند الاستلام فواتير التاجر
// وسجل أرباح السائق، فحذفها يفسد دفاتر طرف ثالث لم يطلب شيئًا؛ لذلك تُجرَّد من بيانات العميل
// (اسم/هاتف/عنوان/إحداثيات/كود تسليم) وتبقى بأرقامها. هذا ما تعلنه صفحة /delete-account حرفيًّا.

import { cookies } from "next/headers"
import { revalidatePath, revalidateTag } from "next/cache"
import { FieldValue } from "firebase-admin/firestore"
import type { Firestore, Query } from "firebase-admin/firestore"
import { getAdminDb, getAdminAuth } from "../firebase/admin"
import { getCurrentUid, getCurrentUser, hasAdminAccess, SESSION_COOKIE_NAME } from "../auth/session"
import { checkRateLimit } from "../utils/rate-limit"
import { normalizeEgyptPhone } from "../utils/phone"
import { logError } from "../logger"

// نص التأكيد الذي يجب أن يكتبه المستخدم بيده. ليس زينة واجهة: الأكشن نقطة POST عامة، وبوليان
// بسيط كان يعني أن أي طلب مُلفَّق يمحو حسابًا. النص العربي نفسه هو الحارس.
const CONFIRM_PHRASE = "حذف حسابي"

const DELETED_NAME = "مستخدم محذوف"
const DELETED_ADDRESS = "عنوان محذوف"

// حد Firestore الصلب 500 عملية لكل دفعة — نلتزم 400 مثل admin.ts احتياطًا لعمليات مصاحبة.
const BATCH_CHUNK = 400
// سقف حجم الحساب الذي يُحذف تلقائيًّا. أكبر من ذلك يُحوَّل للمراجعة اليدوية بدل تنفيذ نصفه.
const MAX_DOCS_PER_COLLECTION = 5000

// حالات تعني أن الطلب انتهى (لا يمنع الحذف). أي حالة أخرى = طلب جارٍ.
const TERMINAL_ORDER_STATUSES = ["delivered", "cancelled", "rejected", "driver_rejected", "inquiry"]

function isInquiryLike(o: Record<string, any>): boolean {
  return (
    o.order_type === "inquiry" ||
    o.status === "inquiry" ||
    o.delivery_address === "Contact via WhatsApp" ||
    o.delivery_address === "Contact via Phone"
  )
}

/** يحذف نتائج استعلام على دفعات. يُرجع عدد المستندات المحذوفة. */
async function deleteQueryInChunks(db: Firestore, query: Query): Promise<number> {
  const snap = await query.limit(MAX_DOCS_PER_COLLECTION).get()
  let deleted = 0
  for (let i = 0; i < snap.docs.length; i += BATCH_CHUNK) {
    const batch = db.batch()
    snap.docs.slice(i, i + BATCH_CHUNK).forEach((doc) => batch.delete(doc.ref))
    await batch.commit()
    deleted += Math.min(BATCH_CHUNK, snap.docs.length - i)
  }
  return deleted
}

export type AccountDeletionSummary = {
  role: string
  path: "self_serve" | "seller_request" | "blocked"
  activeOrders: number
}

/** ملخّص يُعرض للمستخدم قبل التأكيد: أي مسار ينطبق عليه، وهل يمنعه شيء. */
export async function getAccountDeletionSummary(): Promise<{
  success: boolean
  data?: AccountDeletionSummary
  error?: string
}> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false, error: "يجب تسجيل الدخول أولًا" }

    const db = getAdminDb()
    const snap = await db.collection("users").doc(uid).get()
    const data = (snap.data() || {}) as Record<string, any>
    const role = String(data.role || "customer")

    if (hasAdminAccess(role)) {
      return { success: true, data: { role, path: "blocked", activeOrders: 0 } }
    }

    const ordersSnap = await db.collection("orders").where("customer_id", "==", uid).get()
    const activeOrders = ordersSnap.docs.filter((doc) => {
      const o = doc.data() as Record<string, any>
      return !TERMINAL_ORDER_STATUSES.includes(String(o.status))
    }).length

    return {
      success: true,
      data: { role, path: role === "seller" ? "seller_request" : "self_serve", activeOrders },
    }
  } catch (error) {
    logError("[account-deletion] getAccountDeletionSummary", error)
    return { success: false, error: "تعذّر قراءة بيانات الحساب" }
  }
}

/**
 * حذف حساب العميل نهائيًّا. الهوية من الجلسة فقط — لا تقبل الدالة أي معرّف من العميل.
 * ترتيب الخطوات مقصود: حذف حساب المصادقة **أخيرًا**. لو انهار شيء قبله يظل المستخدم قادرًا على
 * الدخول والضغط مرة أخرى (كل خطوة حذف أو كتابة فوقية ⇒ التكرار آمن)؛ ولو حُذف أولًا لبقيت
 * بياناته يتيمة بلا أي طريق للوصول إليها.
 */
export async function deleteMyAccount(input: { confirm: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false, error: "يجب تسجيل الدخول أولًا" }

    if (String(input?.confirm || "").trim() !== CONFIRM_PHRASE) {
      return { success: false, error: `اكتب «${CONFIRM_PHRASE}» للتأكيد` }
    }

    if (!(await checkRateLimit("delete_account:" + uid, 3, 60 * 60 * 1000))) {
      return { success: false, error: "محاولات كثيرة، حاول بعد قليل" }
    }

    const db = getAdminDb()
    const userRef = db.collection("users").doc(uid)
    const userSnap = await userRef.get()
    const userData = (userSnap.data() || {}) as Record<string, any>
    const role = String(userData.role || "customer")

    // حسابات الإدارة لا تُحذف من واجهة العميل — نفس منطق حماية admin.ts من قفل اللوحة على نفسها
    if (hasAdminAccess(role)) {
      return { success: false, error: "لا يمكن حذف حساب إداري من هنا — تواصل مع الدعم" }
    }

    // التاجر لا يُحذف تلقائيًّا: متجره يحمل كتالوجًا وتسويات نقدية ودفاتر ديون لأطراف أخرى.
    if (role === "seller") {
      return { success: false, error: "SELLER_REQUIRES_REVIEW" }
    }

    // طلب جارٍ = التزام قائم بين العميل والتاجر والسائق. الحذف وسطه يترك طرفًا بلا بيانات تواصل.
    const ordersSnap = await db.collection("orders").where("customer_id", "==", uid).get()
    const activeOrders = ordersSnap.docs.filter((doc) => {
      const o = doc.data() as Record<string, any>
      return !TERMINAL_ORDER_STATUSES.includes(String(o.status))
    })
    if (activeOrders.length > 0) {
      return { success: false, error: "لا يمكن حذف الحساب وعندك طلبات جارية — استلمها أو ألغِها أولًا" }
    }

    const now = new Date().toISOString()

    // شاهد قبر يُكتب أولًا: يجعل التنفيذ المتقطّع قابلًا للاستئناف ويترك أثرًا للتدقيق بلا أي
    // بيانات شخصية (معرّف وتواريخ فقط).
    await db.collection("account_deletions").doc(uid).set({
      uid,
      role,
      status: "in_progress",
      started_at: now,
    })

    // (1) تجريد الطلبات من بيانات العميل مع إبقاء أرقامها
    for (let i = 0; i < ordersSnap.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch()
      for (const doc of ordersSnap.docs.slice(i, i + BATCH_CHUNK)) {
        const o = doc.data() as Record<string, any>
        const patch: Record<string, unknown> = {
          customer_name: DELETED_NAME,
          customer_phone: FieldValue.delete(),
          delivery_notes: FieldValue.delete(),
          landmark: FieldValue.delete(),
          delivery_latitude: FieldValue.delete(),
          delivery_longitude: FieldValue.delete(),
          delivery_code: FieldValue.delete(),
          customer_deleted: true,
          customer_deleted_at: now,
          updated_at: now,
        }
        // مستندات الاستفسار تُصنَّف بنص delivery_address نفسه — الكتابة فوقه تحوّلها إلى
        // "طلب حقيقي" في قوائم البائع والأدمن.
        if (!isInquiryLike(o)) patch.delivery_address = DELETED_ADDRESS
        batch.update(doc.ref, patch)
      }
      await batch.commit()
    }

    // (2) تقييمات المنتجات — تُحذف ثم يُعاد حساب متوسط كل منتج متأثّر ذرّيًا
    const productReviews = await db.collection("reviews").where("customer_id", "==", uid).get()
    const affectedProducts = new Set(
      productReviews.docs.map((doc) => String((doc.data() as Record<string, any>).product_id || "")).filter(Boolean),
    )
    await deleteQueryInChunks(db, db.collection("reviews").where("customer_id", "==", uid))
    for (const productId of affectedProducts) {
      try {
        const rows = await db.collection("reviews").where("product_id", "==", productId).get()
        const ratings = rows.docs.map((d) => Number((d.data() as Record<string, any>).rating || 0)).filter((n) => n > 0)
        const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0
        await db.runTransaction(async (tx) => {
          tx.update(db.collection("products").doc(productId), { rating: avg, rating_count: ratings.length })
        })
      } catch (err) {
        // متوسط تقييم غير محدَّث لا يوقف حذف حساب — نُسجّله ونكمل
        logError("[account-deletion] recompute product rating", err)
      }
    }

    // (3) تقييمات المتاجر (تحمل تعليقًا حرًّا = بيانات شخصية) + إعادة حساب تقييم المتجر
    const storeReviews = await db.collection("store_reviews").where("customer_id", "==", uid).get()
    const affectedStores = new Set(
      storeReviews.docs.map((doc) => String((doc.data() as Record<string, any>).store_id || "")).filter(Boolean),
    )
    await deleteQueryInChunks(db, db.collection("store_reviews").where("customer_id", "==", uid))
    for (const storeId of affectedStores) {
      try {
        const rows = await db.collection("store_reviews").where("store_id", "==", storeId).get()
        const ratings = rows.docs.map((d) => Number((d.data() as Record<string, any>).rating || 0)).filter((n) => n > 0)
        const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0
        await db.collection("users").doc(storeId).update({
          "store.rating": avg,
          "store.rating_count": ratings.length,
          "store.updated_at": now,
        })
      } catch (err) {
        logError("[account-deletion] recompute store rating", err)
      }
    }

    // (4) تقييمات الطلب: نُبقي تقييم السائق الرقمي (سجل جودته) ونمحو ما يخصّ العميل
    const orderReviews = await db.collection("order_reviews").where("customer_id", "==", uid).get()
    for (let i = 0; i < orderReviews.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch()
      orderReviews.docs.slice(i, i + BATCH_CHUNK).forEach((doc) => {
        batch.update(doc.ref, {
          customer_id: null,
          driver_comment: FieldValue.delete(),
          customer_deleted: true,
          updated_at: now,
        })
      })
      await batch.commit()
    }

    // (5) الشكاوى: المحلولة تُحذف، والمفتوحة تُجرَّد كي لا يُقطع نزاع دعم جارٍ
    const complaints = await db.collection("complaints").where("user_id", "==", uid).get()
    for (let i = 0; i < complaints.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch()
      complaints.docs.slice(i, i + BATCH_CHUNK).forEach((doc) => {
        const c = doc.data() as Record<string, any>
        if (c.status === "resolved") batch.delete(doc.ref)
        else
          batch.update(doc.ref, {
            user_id: null,
            user_name: DELETED_NAME,
            user_phone: FieldValue.delete(),
            updated_at: now,
          })
      })
      await batch.commit()
    }

    // (6) بيانات لا قيمة لها بعد الحذف — تُمحى بالكامل
    await deleteQueryInChunks(db, db.collection("notifications").where("user_id", "==", uid))
    await deleteQueryInChunks(
      db,
      db.collection("fcm_tokens").where("owner_type", "==", "user").where("owner_id", "==", uid),
    )
    await deleteQueryInChunks(db, db.collection("password_reset_tokens").where("userId", "==", uid))
    await deleteQueryInChunks(db, db.collection("order_idempotency").where("customer_id", "==", uid))
    // سجلّ استعلامات البحث الذكي. سياسة الخصوصية تَعِد نصًّا بأن «حذف حسابك يحذف سجلّ استعلاماتك
    // المرتبط به» — ووعدٌ في سياسة بلا كود يُنفّذه أسوأ من عدم الوعد: هو ما يُقاس عليه في مراجعة
    // متجر التطبيقات وفي أي مساءلة. (`ai_search_cache` غير مشمولة عمدًا: مفتاحها تجزئة الاستعلام
    // ولا تحمل معرّف مستخدم إطلاقًا، فلا شيء فيها «مرتبط بحسابك» يُحذَف.)
    await deleteQueryInChunks(db, db.collection("ai_search_logs").where("user_id", "==", uid))
    // وعدّاد البحث اليومي معها: يحمل `user_id` صراحةً، فهو «سجلّ مرتبط بحسابك» بنصّ الوعد نفسه.
    await deleteQueryInChunks(db, db.collection("ai_search_user_usage").where("user_id", "==", uid))

    // (7) مستند المستخدم
    await userRef.delete()

    // (8) حساب المصادقة — نقطة اللا رجعة، وآخر خطوة بيانات عمدًا
    try {
      await getAdminAuth().deleteUser(uid)
    } catch (err) {
      if ((err as { code?: string })?.code !== "auth/user-not-found") throw err
    }

    // (9) إنهاء الجلسة فورًا
    try {
      const cookieStore = await cookies()
      cookieStore.delete(SESSION_COOKIE_NAME)
    } catch {
      // الكوكي يفشل التحقق تلقائيًّا بعد حذف الحساب (checkRevoked) — الحذف هنا تنظيف لا أمان
    }

    await db.collection("account_deletions").doc(uid).set(
      { status: "completed", completed_at: new Date().toISOString() },
      { merge: true },
    )

    revalidatePath("/account")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    logError("[account-deletion] deleteMyAccount", error)
    return { success: false, error: "تعذّر حذف الحساب، حاول مرة أخرى أو تواصل مع الدعم" }
  }
}

/**
 * طلب حذف حساب تاجر. لا يُنفَّذ فورًا: المتجر يحمل كتالوجًا وتسويات نقدية ودفاتر ديون لأطراف
 * أخرى. لكنه **يُخفي المتجر فورًا** (is_approved=false) فيتوقف البيع لحظة الطلب، ويفتح تذكرة
 * للأدمن ينفّذ التفكيك.
 */
export async function requestSellerAccountDeletion(input: {
  reason?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const caller = await getCurrentUser()
    if (!caller) return { success: false, error: "يجب تسجيل الدخول أولًا" }
    if (hasAdminAccess(caller.role)) {
      return { success: false, error: "لا يمكن حذف حساب إداري من هنا — تواصل مع الدعم" }
    }
    if (!(await checkRateLimit("delete_account_seller:" + caller.uid, 3, 60 * 60 * 1000))) {
      return { success: false, error: "محاولات كثيرة، حاول بعد قليل" }
    }

    const db = getAdminDb()
    const uid = caller.uid

    // نقدية محتجزة عند السائقين: تسويتها حق التاجر نفسه — إغلاق الحساب قبلها يضيّع فلوسه
    const unsettled = await db
      .collection("orders")
      .where("unsettled_cod_store_ids", "array-contains", uid)
      .limit(1)
      .get()
    if (!unsettled.empty) {
      return { success: false, error: "عندك نقدية غير مسوّاة مع السائقين — سوِّها قبل إغلاق الحساب" }
    }

    const now = new Date().toISOString()
    await db.collection("users").doc(uid).update({
      "store.is_approved": false,
      "store.updated_at": now,
      deletion_requested_at: now,
      deletion_reason: String(input?.reason || "").slice(0, 2000) || null,
    })

    // تذكرة في نفس طابور /admin/complaints المبني أصلًا
    await db.collection("complaints").add({
      user_id: uid,
      user_name: caller.email || "",
      subject: "طلب حذف حساب تاجر",
      message: String(input?.reason || "").slice(0, 2000) || "طلب التاجر حذف حسابه ومتجره.",
      target_type: "other",
      status: "open",
      created_at: now,
      updated_at: now,
    })

    revalidateTag("stores", "max")
    revalidatePath("/store")
    return { success: true }
  } catch (error) {
    logError("[account-deletion] requestSellerAccountDeletion", error)
    return { success: false, error: "تعذّر إرسال الطلب، حاول مرة أخرى" }
  }
}

/**
 * طلب حذف من الصفحة العامة (بلا تسجيل دخول) — المتطلَّب الثاني في سياسة Play.
 * مضاد للتعداد عمدًا: يُرجع نجاحًا دائمًا فلا يكشف إن كان البريد/الهاتف مسجَّلًا عندنا أصلًا.
 */
export async function requestAccountDeletion(input: {
  contact: string
  note?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const contactRaw = String(input?.contact || "").trim()
    if (contactRaw.length < 5 || contactRaw.length > 200) {
      return { success: false, error: "اكتب بريدك الإلكتروني أو رقم هاتفك المسجَّل" }
    }
    if (!(await checkRateLimit("request_account_deletion", 5, 60 * 60 * 1000))) {
      return { success: false, error: "محاولات كثيرة، حاول بعد قليل" }
    }

    const db = getAdminDb()
    const now = new Date().toISOString()
    // نُطبّع الهاتف المصري ليطابق صيغة التخزين وقت التنفيذ اليدوي
    const normalizedPhone = normalizeEgyptPhone(contactRaw)

    await db.collection("account_deletion_requests").add({
      contact: contactRaw.slice(0, 200),
      contact_normalized: normalizedPhone || contactRaw.toLowerCase().slice(0, 200),
      note: String(input?.note || "").slice(0, 2000) || null,
      status: "open",
      source: "public_page",
      created_at: now,
    })

    return { success: true }
  } catch (error) {
    logError("[account-deletion] requestAccountDeletion", error)
    // لا نكشف تفاصيل داخلية على نقطة عامة
    return { success: false, error: "تعذّر إرسال الطلب، حاول مرة أخرى" }
  }
}
