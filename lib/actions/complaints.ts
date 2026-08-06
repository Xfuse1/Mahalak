"use server"

// ADM-02: نظام الشكاوى/الدعم — يقدّم المستخدم شكوى، ويراجعها/يحلّها الأدمن.
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid, getCurrentUser, hasAdminAccess } from "../auth/session"
import { cleanUndefined } from "../firebase/firestore-helpers"
import { createNotification } from "../notifications-internal"
import { checkRateLimit } from "../utils/rate-limit"
import { logError } from "../logger"
// الثوابت والأنواع في وحدة نقية — ملف "use server" لا يصدّر إلا دوال async
import { REPORT_REASONS, REPORTABLE_TYPES, type ReportReason, type ReportableType } from "../types/report"

export type Complaint = {
  id: string
  user_id: string
  user_name?: string
  user_phone?: string
  subject: string
  message: string
  target_type: "order" | "store" | "driver" | "product" | "other"
  order_id?: string
  // بلاغ عن محتوى: أي عنصر بالضبط (معرّف المنتج / معرّف المتجر = uid البائع / معرّف السائق)
  target_id?: string
  target_name?: string // يُحلّ سيرفر-سايد من المستند نفسه — لا يُقبل من العميل
  reason?: ReportReason
  status: "open" | "resolved" | "action_taken" | "rejected"
  admin_note?: string
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}


function err(e: unknown, fb: string) {
  return e instanceof Error && e.message ? e.message : fb
}

async function ensureAdmin() {
  const user = await getCurrentUser()
  // يقبل admin و superAdmin (superAdmin مجموعة فائقة من admin) — غير حسّاس لحالة الأحرف.
  return user && hasAdminAccess(user.role) ? user : null
}

export async function submitComplaint(input: {
  subject: string
  message: string
  target_type?: "order" | "store" | "driver" | "other"
  order_id?: string
}) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "يجب تسجيل الدخول" }
  // نقطة عامة تكتب مستندًا لكل نداء — بلا حدّ معدل كانت تُملأ المجموعة بضغطة زر متكررة
  if (!(await checkRateLimit("submit_complaint:" + uid, 5, 60 * 60 * 1000))) {
    return { success: false, error: "محاولات كثيرة، حاول بعد قليل" }
  }
  const subject = (input.subject || "").trim()
  const message = (input.message || "").trim()
  if (!subject || !message) return { success: false, error: "العنوان والرسالة مطلوبان" }
  if (message.length > 2000) return { success: false, error: "الرسالة طويلة جدًا (الحد 2000 حرف)" }

  try {
    const db = getAdminDb()
    const userSnap = await db.collection("users").doc(uid).get()
    const u = (userSnap.data() || {}) as Record<string, unknown>
    const now = new Date().toISOString()
    const ref = db.collection("complaints").doc()
    await ref.set(
      cleanUndefined({
        user_id: uid,
        user_name: (u.full_name as string) || undefined,
        user_phone: (u.phone as string) || undefined,
        subject,
        message,
        target_type: input.target_type || "other",
        order_id: input.order_id?.trim() || undefined,
        status: "open",
        created_at: now,
        updated_at: now,
      }),
    )
    revalidatePath("/admin/complaints")
    revalidatePath("/support")
    return { success: true, data: { id: ref.id } }
  } catch (e) {
    logError("[complaints] submit", e)
    return { success: false, error: err(e, "تعذّر إرسال الشكوى") }
  }
}

/**
 * بلاغ عن محتوى (منتج/متجر/سائق/طلب) — متطلَّب سياسة المحتوى المُنشأ بواسطة المستخدمين في
 * Google Play: التجّار يرفعون منتجات وصورًا، فلازم يكون لدى العميل طريق مباشر للإبلاغ.
 * يُعاد استخدام مجموعة complaints نفسها كي يظهر البلاغ في طابور /admin/complaints المبني أصلًا.
 */
export async function reportContent(input: {
  target_type: ReportableType
  target_id: string
  reason: ReportReason
  message?: string
}): Promise<{ success: boolean; error?: string; data?: { id: string } }> {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "يجب تسجيل الدخول" }

  if (!(await checkRateLimit("report_content:" + uid, 10, 60 * 60 * 1000))) {
    return { success: false, error: "محاولات كثيرة، حاول بعد قليل" }
  }

  const targetType = input?.target_type
  const reason = input?.reason
  const targetId = String(input?.target_id || "").trim()
  if (!REPORTABLE_TYPES.includes(targetType)) return { success: false, error: "نوع غير صالح" }
  if (!reason || !(reason in REPORT_REASONS)) return { success: false, error: "سبب غير صالح" }
  if (!targetId) return { success: false, error: "العنصر غير محدد" }

  const message = String(input?.message || "").trim().slice(0, 2000)

  try {
    const db = getAdminDb()

    // اسم العنصر يُقرأ من المستند لا من العميل — وغياب المستند يمنع تلفيق بلاغات لمعرّفات وهمية
    let targetName = ""
    if (targetType === "product") {
      const snap = await db.collection("products").doc(targetId).get()
      if (!snap.exists) return { success: false, error: "العنصر غير موجود" }
      targetName = String((snap.data() as Record<string, any>)?.name || "")
    } else if (targetType === "store") {
      const snap = await db.collection("users").doc(targetId).get()
      const data = snap.data() as Record<string, any> | undefined
      if (!snap.exists || data?.role !== "seller") return { success: false, error: "العنصر غير موجود" }
      targetName = String(data?.store?.name || "")
    } else if (targetType === "driver") {
      const snap = await db.collection("drivers").doc(targetId).get()
      if (!snap.exists) return { success: false, error: "العنصر غير موجود" }
      targetName = String((snap.data() as Record<string, any>)?.name || "")
    } else {
      const snap = await db.collection("orders").doc(targetId).get()
      if (!snap.exists) return { success: false, error: "العنصر غير موجود" }
      targetName = `#${targetId.slice(-6)}`
    }

    // بلاغ مفتوح من نفس المستخدم على نفس العنصر: نرجع نجاحًا بلا تذكرة ثانية — الضغط المتكرر
    // لا يجب أن يُغرق الطابور، ولا أن يُظهر للمستخدم خطأً وهو لم يخطئ. (مساواة فقط ⇒ بلا فهرس مركّب)
    const existing = await db
      .collection("complaints")
      .where("user_id", "==", uid)
      .where("target_id", "==", targetId)
      .where("status", "==", "open")
      .limit(1)
      .get()
    if (!existing.empty) {
      return { success: true, data: { id: existing.docs[0].id } }
    }

    const userSnap = await db.collection("users").doc(uid).get()
    const u = (userSnap.data() || {}) as Record<string, unknown>
    const now = new Date().toISOString()
    const ref = db.collection("complaints").doc()

    await ref.set(
      cleanUndefined({
        user_id: uid,
        user_name: (u.full_name as string) || undefined,
        user_phone: (u.phone as string) || undefined,
        // العنوان يُبنى من سبب البلاغ كي تعمل بطاقة الأدمن الحالية (تعرض subject) بلا تعديل
        subject: `بلاغ: ${REPORT_REASONS[reason]}`,
        message: message || REPORT_REASONS[reason],
        target_type: targetType,
        target_id: targetId,
        target_name: targetName || undefined,
        reason,
        status: "open",
        created_at: now,
        updated_at: now,
      }),
    )

    revalidatePath("/admin/complaints")
    return { success: true, data: { id: ref.id } }
  } catch (e) {
    logError("[complaints] reportContent", e)
    return { success: false, error: "تعذّر إرسال البلاغ" }
  }
}

export async function getMyComplaints(): Promise<Complaint[]> {
  const uid = await getCurrentUid()
  if (!uid) return []
  const db = getAdminDb()
  const snap = await db.collection("complaints").where("user_id", "==", uid).get()
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Complaint)
  list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
  return list
}

export async function getAdminComplaints(): Promise<{ success: boolean; complaints?: Complaint[]; error?: string }> {
  if (!(await ensureAdmin())) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const snap = await db.collection("complaints").get()
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Complaint)
    // المفتوحة أولًا، ثم الأحدث
    list.sort((a, b) => {
      const sa = a.status === "open" ? 0 : 1
      const sb = b.status === "open" ? 0 : 1
      if (sa !== sb) return sa - sb
      return (b.created_at || "").localeCompare(a.created_at || "")
    })
    return { success: true, complaints: list }
  } catch (e) {
    logError("[complaints] getAdmin", e)
    return { success: false, error: "تعذّر تحميل الشكاوى" }
  }
}

/**
 * إغلاق تذكرة. `outcome` اختياري ويبقى "resolved" افتراضيًا — التوقيع القديم بوسيطين
 * يظل يعمل كما هو. "action_taken" تعني أن المحتوى أُزيل فعلًا (أثر تدقيقي يفرّق بين
 * «رددنا على الشكوى» و«حذفنا المنتج»).
 */
export async function resolveComplaint(
  id: string,
  note?: string,
  outcome: "resolved" | "action_taken" | "rejected" = "resolved",
) {
  const admin = await ensureAdmin()
  if (!admin) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const ref = db.collection("complaints").doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "الشكوى غير موجودة" }
    const now = new Date().toISOString()
    await ref.update(
      cleanUndefined({
        status: outcome,
        admin_note: note?.trim() || undefined,
        resolved_by: admin.uid,
        resolved_at: now,
        updated_at: now,
      }),
    )
    try {
      await createNotification({
        user_id: String(snap.data()?.user_id),
        title: "تم الرد على شكواك ✅",
        title_en: "Your complaint was addressed ✅",
        message: note?.trim() || "تمت معالجة شكواك من قبل فريق الدعم.",
        message_en: note?.trim() || "Your complaint has been handled by support.",
        type: "general",
        link: "/support",
      })
    } catch (e) {
      logError("[complaints] resolve notification", e)
    }
    revalidatePath("/admin/complaints")
    return { success: true }
  } catch (e) {
    logError("[complaints] resolve", e)
    return { success: false, error: err(e, "تعذّر تحديث الشكوى") }
  }
}
