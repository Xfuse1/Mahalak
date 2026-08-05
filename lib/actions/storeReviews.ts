"use server"

import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { logError } from "@/lib/logger"
import { checkRateLimit } from "@/lib/utils/rate-limit"

type ReviewRecord = Record<string, any>

// بوابة التقييم: أي حالة طلب تُعتبر إثباتًا كافيًا أن هذا المتجر سلّم بضاعته لهذا العميل؟
//
// "delivered" إثبات قاطع لأي طلب: إنهاؤه يتطلّب كود التأكيد الرباعي الذي يحمله العميل
// (lib/actions/orders.ts + lib/delivery/dispatch.ts) ولا يراه البائع في ردود الحالة.
//
// لكن قصر البوابة على "delivered" وحده كان يحجب عملاء استلموا طلبهم فعلًا: الكود قد لا يُدخَل
// أبدًا (البائع/السائق ينسى) فيبقى الطلب عالقًا في "on_the_way" للأبد. لذلك نقبل طبقة ثانية
// «خرجت البضاعة من المتجر مع السائق» — **لكن لطلبات التوزيع وحدها**:
//   • في طلب التوزيع لا يستطيع البائع لمس الحالة إطلاقًا؛ `updateOrderStatus` يرفض أي طلب
//     is_dispatch صراحةً، والانتقالات تكتبها معاملات lib/delivery/dispatch.ts بعد مصادقة السائق.
//   • أما الطلب العادي (توصيل ذاتي) فالبائع نفسه يضبط "shipped"/"on_the_way"/… بضغطة زر بلا أي
//     إثبات — فقبولها كان يفتح زراعة تقييمات: حساب عميل وهمي + طلب من متجرك + «تم الشحن» + 5 نجوم.
// "shipped" مستبعَدة نهائيًّا: لا تظهر في آلة حالات التوزيع أصلًا، فهي حالة بائع خالصة.
const ALWAYS_FULFILLED = ["delivered"]
const DISPATCH_ONLY_FULFILLED = ["on_the_way", "picked_up", "picking_up"]
const FULFILLED_STATUSES = [...ALWAYS_FULFILLED, ...DISPATCH_ONLY_FULFILLED]

// هل تُثبت حالة هذا الطلب تسليمًا من المتجر؟ (يطبَّق على الطلب الأحادي والمتعدد معًا)
function provesFulfilment(order: { status?: string; is_dispatch?: boolean }): boolean {
  const status = String(order.status)
  if (ALWAYS_FULFILLED.includes(status)) return true
  return order.is_dispatch === true && DISPATCH_ONLY_FULFILLED.includes(status)
}

// سقف مسح طلبات العميل في مسار الطلب متعدد المتاجر (يُستدعى فقط عند فشل المسار السريع).
// مقايضة معلومة: عميل تجاوز هذا العدد من الطلبات ومشتراه من المتجر أقدم من آخر 200 طلب لن يقدر
// على التقييم. رفع السقف يرفع تكلفة كل نداء فاشل، والبديل الصحيح (فهرس
// customer_id + store_ids array-contains) يحتاج نشر فهرس وهو قرار المالك.
const CUSTOMER_ORDERS_SCAN = 200

async function recentCustomerOrders(db: ReturnType<typeof getAdminDb>, customerId: string) {
  const base = db.collection("orders").where("customer_id", "==", customerId)
  try {
    // فهرس معلَن: orders (customer_id ASC, created_at DESC)
    return (await base.orderBy("created_at", "desc").limit(CUSTOMER_ORDERS_SCAN).get()).docs
  } catch (err) {
    // الهبوط هنا ليس تفصيلًا: بلا ترتيب يصير السقف شريحة عشوائية بترتيب المعرّف، فقد يفوّت طلبًا
    // مؤهِّلًا ويحجب مشتريًا شرعيًّا. نُسجّله كي لا يصير المسار المتدهور دائمًا وصامتًا.
    logError("[storeReviews] recentCustomerOrders orderBy fallback", err)
    return (await base.limit(CUSTOMER_ORDERS_SCAN).get()).docs
  }
}

export async function getUserStoreReview(storeId: string, customerId: string) {
  const uid = await getCurrentUid()
  if (!uid || uid !== customerId) return null

  const db = getAdminDb()

  const snapshot = await db
    .collection("store_reviews")
    .where("store_id", "==", storeId)
    .where("customer_id", "==", customerId)
    .limit(1)
    .get()

  const docSnap = snapshot.docs[0]
  if (!docSnap) {
    return null
  }

  return { id: docSnap.id, ...(docSnap.data() as ReviewRecord) }
}

export async function upsertStoreReview(storeId: string, customerId: string, rating: number, comment?: string) {
  // الهوية تُشتق من الجلسة الموثّقة — لا نثق بـ customerId القادم من العميل
  const uid = await getCurrentUid()
  if (!uid || uid !== customerId) {
    return { success: false, average: null, error: "سجّل الدخول أولًا لتقييم المتجر" }
  }

  const db = getAdminDb()

  // بوابة الشراء: لا يقيّم المتجر إلا من استلم منه طلبًا فعلًا (مضاد لتقييمات وهمية).
  // الطلب أحادي المتجر يحمل store_id، أمّا الطلب متعدد المتاجر فلا يحمله إطلاقًا — يحمل
  // store_ids (مصفوفة) + pickup_stops. الشرط القديم كان على store_id وحده، فكل من اشترى ضمن
  // سلة متعددة المتاجر كان يُمنع من التقييم بلا سبب ويرى «يجب الشراء من المتجر قبل تقييمه».
  //
  // مسار سريع (الغالبية العظمى): طلب أحادي المتجر — ثلاث مساواتٍ تخدمها الفهارس المفردة
  // بالدمج. `in` يتوسّع إلى مساواتٍ فلا يستدعي فهرسًا مركّبًا. الاستعلام يُضيّق فقط، والحكم
  // النهائي لـ provesFulfilment (الحالة الوسيطة لا تُثبت شيئًا خارج طلبات التوزيع)، فنجلب بضعة
  // مستندات لا واحدًا: قد يسبق طلبٌ حالته وسيطة طلبًا آخر مُسلَّمًا فعلًا من نفس المتجر.
  const singleSnap = await db.collection("orders")
    .where("customer_id", "==", customerId)
    .where("store_id", "==", storeId)
    .where("status", "in", FULFILLED_STATUSES)
    .limit(10)
    .get()

  const provenSingle = singleSnap.docs.some((doc) =>
    provesFulfilment(doc.data() as { status?: string; is_dispatch?: boolean }),
  )

  // مسار الطلب متعدد المتاجر: لا يحمل store_id إطلاقًا، ودمج array-contains مع مساواة يستلزم
  // فهرسًا مركّبًا غير منشور ⇒ نمسح أحدث طلبات هذا العميل وحده ونفصل في JS. مقيَّد بسقف صارم
  // وبالفهرس المعلَن (customer_id + created_at DESC) كي لا تتحوّل ضغطة نجمة إلى مسح تاريخ كامل.
  //
  // حدّ المعدل يحرس هذا المسار وحده: هو الأغلى (حتى CUSTOMER_ORDERS_SCAN قراءة) وهو أيضًا المسار
  // الذي يسلكه *كل نداء فاشل* — أي أن من لم يشترِ من المتجر يدفع أغلى استعلام في الدالة، فيصلح
  // مضخّم قراءات بالتكرار على قاعدة إنتاج بالخطة المجانية. المشتري الشرعي يمرّ من المسار السريع
  // (قراءة واحدة) ولا يمسّه الحدّ أصلًا. fail-open مثل بقية استخدامات الحارس في الريبو.
  if (!provenSingle && !(await checkRateLimit("store_review_gate:" + customerId, 20, 60_000))) {
    return { success: false, average: null, error: "محاولات كثيرة، حاول بعد قليل" }
  }

  const multiDocs = provenSingle ? [] : await recentCustomerOrders(db, customerId)

  const boughtFromStore = provenSingle || multiDocs.some((doc) => {
    const o = doc.data() as {
      status?: string
      is_dispatch?: boolean
      order_type?: string
      delivery_address?: string
      store_id?: string
      store_ids?: unknown
      pickup_stops?: { store_id?: string; status?: string }[]
    }
    // الاستفسار (واتساب/اتصال) يُخزَّن كمستند طلب لأي متجر بضغطة زر بلا أي بيع — احتسابه
    // كان سيحوّل البوابة إلى مزرعة تقييمات مجانية.
    if (
      o.order_type === "inquiry" ||
      o.status === "inquiry" ||
      o.delivery_address === "Contact via WhatsApp" ||
      o.delivery_address === "Contact via Phone"
    ) {
      return false
    }
    if (!provesFulfilment(o)) return false
    if (o.store_id === storeId) return true
    if (!Array.isArray(o.store_ids) || !o.store_ids.includes(storeId)) return false
    // الطلب متعدد المتاجر: حالة الطلب كلها لا تكفي — قد يكون هذا المتجر تحديدًا رفض محطته أو لم
    // يؤكّدها أصلًا بينما سُلّم باقي الطلب. الإثبات هو استلام السائق من محطته (picked_up)، ونقبل
    // "confirmed" فقط حين يكون الطلب كلّه مُسلَّمًا (إثبات على مستوى الطلب).
    const stops = o.pickup_stops
    if (!Array.isArray(stops)) return true // طلب قديم بلا محطات: وجوده ضمن store_ids يكفي
    return stops.some(
      (s) =>
        s?.store_id === storeId &&
        (s?.status === "picked_up" || (o.status === "delivered" && s?.status === "confirmed")),
    )
  })

  if (!boughtFromStore) {
    return {
      success: false,
      average: null,
      error: "التقييم متاح بعد اكتمال تسليم طلبك من هذا المتجر",
    }
  }

  const r = Math.max(1, Math.min(5, Math.round(Number(rating))))
  const now = new Date().toISOString()

  try {
    const existingSnap = await db
      .collection("store_reviews")
      .where("store_id", "==", storeId)
      .where("customer_id", "==", customerId)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0]
      await doc.ref.update({
        rating: r,
        comment: comment || null,
        updated_at: now
      })
    } else {
      await db.collection("store_reviews").add({
        store_id: storeId,
        customer_id: customerId,
        rating: r,
        comment: comment || null,
        created_at: now,
        updated_at: now,
      })
    }

    // Recalculate average
    const rowsSnap = await db.collection("store_reviews").where("store_id", "==", storeId).get()
    const ratings = rowsSnap.docs.map((doc) => Number(doc.data().rating || 0))
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0

    // الكتابة مباشرة عبر admin — لا نمرّ عبر updateStore المحميّة بملكية المتجر،
    // لأن المُقيّم عميل (uid !== storeId) فكانت updateStore تفشل دائمًا والتقييم لا يُحفظ.
    await db.collection("users").doc(storeId).update({
      "store.rating": avg,
      "store.rating_count": ratings.length,
      "store.updated_at": now,
    })

    return { success: true, average: avg }
  } catch (error: any) {
    // الواجهة تعرض نصّ الخطأ للمستخدم مباشرةً، فلا نمرّر رسالة Firestore الداخلية إليه
    logError("[storeReviews] upsertStoreReview", error)
    return { success: false, average: null, error: "تعذّر حفظ التقييم، حاول مرة أخرى" }
  }
}
