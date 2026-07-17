import { getAdminDb } from "@/lib/firebase/admin"
import { getEgyptPhoneLookupCandidates } from "@/lib/utils/phone"

// طبقة سائق مشتركة محايدة (لا "use server") — مصدر الحقيقة الوحيد لشكل السائق العام
// وقراءته، تستدعيها كلٌّ من server actions (lib/actions/delivery.ts) و route handlers
// (app/api/driver/*). لا تكشف أبدًا الحقول السرّية (pin/pin_hash/pin_salt/otp).

export type DriverProfile = {
  id: string
  name: string
  phone?: string
  photo_url?: string
  vehicle_type?: string // سيارة، موتوسيكل، إلخ
  rating: number
  total_deliveries: number
  is_available: boolean
  is_online?: boolean
  is_approved: boolean // تم التأكيد من الأدمن
  price: number
  areas?: string[] // المناطق التي يغطيها
  created_at?: string
  updated_at?: string
}

// تعيين مستند drivers/{id} إلى الحقول العامة فقط. يطبّع المخطط الحديث (camelCase من لوحة
// deliverzler/Flutter) والقديم (snake_case) معًا حتى تبقى القراءة متسقة مهما كان مصدر المستند.
export function mapDriverDoc(id: string, data: Record<string, unknown>): DriverProfile {
  const d = data as Record<string, any>
  return {
    id,
    name: d.name || "",
    phone: d.phone,
    photo_url: d.photoUrl || d.photo_url,
    vehicle_type: d.vehicleType || d.vehicle_type,
    rating: d.rating || 0,
    total_deliveries: d.totalDeliveries || d.total_deliveries || 0,
    is_available: d.isActive ?? d.is_available ?? true,
    is_online: d.isOnline ?? d.is_online ?? false,
    is_approved: d.isApproved ?? d.is_approved ?? false,
    price: d.price || 0,
    areas: d.areas,
    created_at: d.createdAt?.toDate?.()?.toISOString?.() || d.created_at,
    updated_at: d.updatedAt?.toDate?.()?.toISOString?.() || d.updated_at,
  }
}

// قراءة ملف سائق عام واحد. حساب محظور (disabled === true) يُعامَل كغير موجود (null).
export async function getDriverPublicProfile(id: string): Promise<DriverProfile | null> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("drivers").doc(id).get()
    if (!doc.exists) return null
    const data = doc.data() || {}
    if ((data as { disabled?: boolean }).disabled === true) return null
    return mapDriverDoc(doc.id, data)
  } catch {
    return null
  }
}

// إيجاد سائق بالهاتف: نطبّع ونجرّب صيغ الهاتف المتعددة (المستندات القديمة قد تخزّنه بأي صيغة).
// يُرجع المعرّف فقط؛ حساب محظور يُعامَل كغير موجود.
export async function findDriverIdByPhone(rawPhone: string): Promise<{ id: string } | null> {
  const db = getAdminDb()
  const candidates = getEgyptPhoneLookupCandidates(rawPhone)
  for (const cand of candidates) {
    const snap = await db.collection("drivers").where("phone", "==", cand).limit(1).get()
    if (!snap.empty) {
      const doc = snap.docs[0]
      const dd = doc.data() as { disabled?: boolean; isApproved?: boolean; is_approved?: boolean }
      // حساب محظور أو مرفوض صراحةً يُعامَل كغير موجود (لا OTP، لا دخول). سياسة لطيفة مثل المتاجر:
      // نحجب المرفوض صراحةً (=== false) فقط، لا الحقل الغائب/undefined — كي لا نقفل سائقًا قديمًا بلا الحقل.
      if (dd?.disabled === true) return null
      if (dd?.isApproved === false || dd?.is_approved === false) return null
      return { id: doc.id }
    }
  }
  return null
}
