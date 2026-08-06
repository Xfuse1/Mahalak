"use server"

// حظر المتاجر من طرف العميل — متطلَّب سياسة المحتوى المُنشأ بواسطة المستخدمين في Google Play:
// المستخدم لازم يقدر يمنع محتوى تاجر معيّن عن نفسه، ويتراجع عن الحظر وقت ما يشاء.
//
// ⚠️ تحذير معماري: getStores/getStore/getProducts/getProduct/searchProducts ملفوفة بـ
// unstable_cache بمفاتيح **لا تحمل هوية المشاهد**. إضافة فلتر الحظر داخل أيٍّ منها كانت ستُقدّم
// قائمة عميل واحد المفلترة لكل الزوار لمدة الكاش. لذلك يعيش الفلتر هنا وفي المستدعي فقط.

import { FieldValue } from "firebase-admin/firestore"
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid } from "../auth/session"
import { logError } from "../logger"

// سقف القائمة: حقل مصفوفة داخل مستند المستخدم، ونموّها بلا حدّ يضخّم كل قراءة لمستند المستخدم
const MAX_BLOCKED_STORES = 200

/** معرّفات المتاجر التي حظرها المستخدم الحالي. تُرجع [] للزائر ولا ترمي أبدًا (مسار عرض). */
export async function getBlockedStoreIds(): Promise<string[]> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return []
    const snap = await getAdminDb().collection("users").doc(uid).get()
    const ids = (snap.data() as { blocked_store_ids?: unknown } | undefined)?.blocked_store_ids
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && !!id) : []
  } catch (error) {
    // فشل القراءة يجب ألّا يُفرغ الصفحة الرئيسية — نفشل مفتوحًا (بلا حظر) ونُسجّل
    logError("[blocks] getBlockedStoreIds", error)
    return []
  }
}

export async function blockStore(storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false, error: "يجب تسجيل الدخول" }
    const id = String(storeId || "").trim()
    if (!id) return { success: false, error: "المتجر غير محدد" }
    // معرّف المتجر = uid البائع، فحظر النفس يعني إخفاء متجرك عن نفسك — لا معنى له
    if (id === uid) return { success: false, error: "لا يمكنك حظر متجرك" }

    const db = getAdminDb()
    const userRef = db.collection("users").doc(uid)
    const snap = await userRef.get()
    const current = (snap.data() as { blocked_store_ids?: unknown } | undefined)?.blocked_store_ids
    const list = Array.isArray(current) ? current : []
    if (list.length >= MAX_BLOCKED_STORES && !list.includes(id)) {
      return { success: false, error: "وصلت للحد الأقصى من المتاجر المحظورة" }
    }

    await userRef.update({
      blocked_store_ids: FieldValue.arrayUnion(id),
      updated_at: new Date().toISOString(),
    })

    revalidatePath("/account")
    return { success: true }
  } catch (error) {
    logError("[blocks] blockStore", error)
    return { success: false, error: "تعذّر حظر المتجر" }
  }
}

export async function unblockStore(storeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false, error: "يجب تسجيل الدخول" }
    const id = String(storeId || "").trim()
    if (!id) return { success: false, error: "المتجر غير محدد" }

    await getAdminDb().collection("users").doc(uid).update({
      blocked_store_ids: FieldValue.arrayRemove(id),
      updated_at: new Date().toISOString(),
    })

    revalidatePath("/account")
    return { success: true }
  } catch (error) {
    logError("[blocks] unblockStore", error)
    return { success: false, error: "تعذّر إلغاء الحظر" }
  }
}

/** المتاجر المحظورة بأسمائها — لقائمة «المتاجر المحظورة» في صفحة الحساب (لإلغاء الحظر). */
export async function getBlockedStores(): Promise<Array<{ id: string; name: string }>> {
  try {
    const ids = await getBlockedStoreIds()
    if (!ids.length) return []
    const db = getAdminDb()
    const docs = await db.getAll(...ids.slice(0, MAX_BLOCKED_STORES).map((id) => db.collection("users").doc(id)))
    return docs.map((doc) => {
      const data = (doc.data() || {}) as Record<string, any>
      return { id: doc.id, name: String(data?.store?.name || "متجر") }
    })
  } catch (error) {
    logError("[blocks] getBlockedStores", error)
    return []
  }
}
