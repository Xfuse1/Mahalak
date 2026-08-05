// IA-01: حساب المسافة الجغرافية (Haversine) لترتيب «الأقرب إليك».

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // نصف قطر الأرض بالكيلومتر
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceAr(km: number): string {
  if (!Number.isFinite(km)) return ""
  if (km < 1) return `${Math.round(km * 1000)} م`
  if (km < 10) return `${km.toFixed(1)} كم`
  return `${Math.round(km)} كم`
}

// مسافة متجر من المستخدم، أو null إن نقص أي إحداثي.
export function storeDistanceKm(
  user: { lat: number; lng: number } | null,
  store: { latitude?: number | null; longitude?: number | null },
): number | null {
  if (!user) return null
  const lat = store.latitude
  const lng = store.longitude
  if (typeof lat !== "number" || typeof lng !== "number") return null
  return haversineKm(user.lat, user.lng, lat, lng)
}

/**
 * هل يقع الكيان داخل نصف قطر maxKm من المستخدم؟
 * نصف قطر غير مفعَّل (null/0) ⇒ true للجميع. مسافة مجهولة (موقع المستخدم غير معروف أو المتجر
 * بلا إحداثيات) ⇒ false عند تفعيل النصف قطر: الفلتر وعدٌ صريح («ضمن X كم»)، وإبقاء المجهول
 * داخله يكسر الوعد. الواجهة مسؤولة عن إعلام المستخدم بعدد المستبعَدين لغياب الموقع.
 */
export function withinKm(
  user: { lat: number; lng: number } | null,
  entity: { latitude?: number | null; longitude?: number | null },
  maxKm: number | null,
): boolean {
  if (maxKm == null || !(maxKm > 0)) return true
  const distance = storeDistanceKm(user, entity)
  return distance != null && distance <= maxKm
}
