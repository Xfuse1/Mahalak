import { getAdminDb } from "@/lib/firebase/admin"
import { haversineKm } from "@/lib/utils/geo"

// إعدادات التوزيع + رسوم العدّاد (المرحلة 1). كل النظام خلف علم enabled — وهو false لا تأثير
// إطلاقًا على الموقع الحي (يفضل checkout الحالي باختيار السائق كما هو). القيم الافتراضية = قرار المالك.

export type DispatchSettings = {
  enabled: boolean // علم الميزة: هل نظام التوزيع + رسوم العدّاد مفعّل؟
  base_fare: number // فتح العداد (ج)
  per_km_rate: number // سعر الكيلومتر (ج)
  offer_timeout_sec: number // مهلة قبول العرض قبل إعادة التوزيع/التصعيد
  bid_cap_pct: number // أقصى نسبة يزوّد بها السائق فوق السعر المحسوب (مزايدة)
}

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  enabled: false,
  base_fare: 10,
  per_km_rate: 1,
  offer_timeout_sec: 90,
  bid_cap_pct: 50,
}

function numOr(v: unknown, dflt: number, min = 0): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? n : dflt
}

// رسوم التوصيل بنموذج العدّاد: فتح العداد + سعر الكيلومتر × المسافة. جنيهات صحيحة غير سالبة.
// مسافة غير صالحة/سالبة تُعامَل كصفر (فتح العداد فقط)، وإعدادات غير صالحة ترجع للافتراضيات.
export function computeDeliveryFee(
  distanceKm: number,
  s: Pick<DispatchSettings, "base_fare" | "per_km_rate">,
): number {
  const km = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0
  const base = numOr(s?.base_fare, DEFAULT_DISPATCH_SETTINGS.base_fare)
  const perKm = numOr(s?.per_km_rate, DEFAULT_DISPATCH_SETTINGS.per_km_rate)
  return Math.max(0, Math.round(base + perKm * km))
}

type Coords = { lat?: number | null; lng?: number | null }

// يحسب الرسوم من إحداثيات المتجر والعميل (Haversine). يرجّع null إن نقص أي إحداثي — عندها يقرّر
// المُستدعي البديل (مثلًا رسم أساسي base_fare) بدل رقم مضلِّل.
export function computeDeliveryFeeFromCoords(
  store: Coords | null | undefined,
  customer: Coords | null | undefined,
  s: Pick<DispatchSettings, "base_fare" | "per_km_rate">,
): number | null {
  if (
    !store ||
    !customer ||
    typeof store.lat !== "number" ||
    typeof store.lng !== "number" ||
    typeof customer.lat !== "number" ||
    typeof customer.lng !== "number"
  ) {
    return null
  }
  const km = haversineKm(store.lat, store.lng, customer.lat, customer.lng)
  return computeDeliveryFee(km, s)
}

// قراءة إعدادات التوزيع من settings/dispatch مع دمج الافتراضيات. fail-safe: أي خطأ يرجع الافتراضيات
// (enabled=false) فلا يتعطّل شيء بسبب قراءة إعدادات.
export async function readDispatchSettings(): Promise<DispatchSettings> {
  try {
    const snap = await getAdminDb().collection("settings").doc("dispatch").get()
    const d = (snap.exists ? snap.data() : {}) as Partial<DispatchSettings> | undefined
    return {
      enabled: d?.enabled === true,
      base_fare: numOr(d?.base_fare, DEFAULT_DISPATCH_SETTINGS.base_fare),
      per_km_rate: numOr(d?.per_km_rate, DEFAULT_DISPATCH_SETTINGS.per_km_rate),
      offer_timeout_sec: numOr(d?.offer_timeout_sec, DEFAULT_DISPATCH_SETTINGS.offer_timeout_sec, 10),
      bid_cap_pct: numOr(d?.bid_cap_pct, DEFAULT_DISPATCH_SETTINGS.bid_cap_pct),
    }
  } catch {
    return { ...DEFAULT_DISPATCH_SETTINGS }
  }
}
