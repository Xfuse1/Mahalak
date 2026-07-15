"use server"

// ADM-01: لوحة الأدمن — اعتماد/رفض المتاجر (حوكمة).
// كل الأكشن تتحقق من دور admin سيرفر-سايد (يُشتق من قاعدة البيانات، لا من العميل).

import { revalidatePath, revalidateTag } from "next/cache"
import { getAdminDb } from "../firebase/admin"
import { getCurrentUser } from "../auth/session"
import { serializeData } from "../firebase/firestore-helpers"
import { createNotification } from "../notifications-internal"
import { signKycFields } from "./stores"
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
