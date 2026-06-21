"use server"

// ADM-02: نظام الشكاوى/الدعم — يقدّم المستخدم شكوى، ويراجعها/يحلّها الأدمن.
import { revalidatePath } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUid, getCurrentUser } from "../auth/session"
import { cleanUndefined } from "../firebase/firestore-helpers"
import { createNotification } from "./notifications"
import { logError } from "../logger"

export type Complaint = {
  id: string
  user_id: string
  user_name?: string
  user_phone?: string
  subject: string
  message: string
  target_type: "order" | "store" | "driver" | "other"
  order_id?: string
  status: "open" | "resolved"
  admin_note?: string
  created_at: string
  updated_at: string
}

function err(e: unknown, fb: string) {
  return e instanceof Error && e.message ? e.message : fb
}

async function ensureAdmin() {
  const user = await getCurrentUser()
  return user && user.role === "admin" ? user : null
}

export async function submitComplaint(input: {
  subject: string
  message: string
  target_type?: "order" | "store" | "driver" | "other"
  order_id?: string
}) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "يجب تسجيل الدخول" }
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

export async function resolveComplaint(id: string, note?: string) {
  if (!(await ensureAdmin())) return { success: false, error: "ليس لديك صلاحية" }
  try {
    const db = getAdminDb()
    const ref = db.collection("complaints").doc(id)
    const snap = await ref.get()
    if (!snap.exists) return { success: false, error: "الشكوى غير موجودة" }
    await ref.update(
      cleanUndefined({
        status: "resolved",
        admin_note: note?.trim() || undefined,
        updated_at: new Date().toISOString(),
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
