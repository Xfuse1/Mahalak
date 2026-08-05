// قواعد فعالية العرض — وحدة نقية بلا أي استيراد سيرفري، عمدًا.
//
// لماذا منفصلة عن offer-discount.ts: ذاك الملف يستورد firebase-admin فلا تستطيع مكوّنات العميل
// استيراده. وقسم «العروض» في صفحة المتجر (مكوّن عميل) يجب أن يقرّر «هل هذا العرض فعّال الآن؟»
// بنفس القاعدة التي يحسب بها الخادم السعر — وإلا عرضنا حملة منتهية بأسعار كاملة، أو أخفينا حملة
// يطبّقها الحساب فعلًا. القاعدة تعيش هنا مرة واحدة، و offer-discount.ts يستوردها.

export type OfferTiming = {
  start_date?: string
  end_date?: string
  quantity?: number
  used_quantity?: number
  duration_hours?: number
}

/** الوقت الحالي بتوقيت القاهرة (يتعامل مع التوقيت الصيفي تلقائيًا عبر Intl) بدل UTC. */
export function cairoNow(): { date: string; hourFraction: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00"
  let hh = parseInt(get("hour"), 10)
  if (hh === 24) hh = 0
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hourFraction: hh + parseInt(get("minute"), 10) / 60 }
}

/** هل هذا عرض فلاش؟ (يوم واحد + مدة بالساعات تبدأ من منتصف الليل) */
export function isFlashOffer(offer: OfferTiming): boolean {
  const startDay = String(offer.start_date || "").split("T")[0]
  const endDay = String(offer.end_date || "").split("T")[0]
  const durationH = Number(offer.duration_hours)
  return Boolean(startDay) && startDay === endDay && Number.isFinite(durationH) && durationH > 0
}

/**
 * هل العرض نشط الآن بتوقيت القاهرة؟ يطابق getOfferStatus في واجهة البائع:
 * عرض الفلاش (نفس اليوم + duration_hours) ينتهي بعد duration_hours من منتصف الليل.
 */
export function isOfferActiveNow(offer: OfferTiming, cairoToday?: string, hourFraction?: number): boolean {
  const now = cairoToday != null && hourFraction != null ? { date: cairoToday, hourFraction } : cairoNow()
  const startDay = String(offer.start_date || "").split("T")[0]
  const endDay = String(offer.end_date || "").split("T")[0]
  if (startDay && startDay > now.date) return false // قادم
  if (endDay && endDay < now.date) return false // منتهٍ
  if (isFlashOffer(offer)) {
    if (now.date !== startDay || now.hourFraction > Number(offer.duration_hours)) return false
  }
  return true
}

/** الكمية المتبقّية في عرض محدود الكمية، أو null إن كان بلا حدّ. */
export function offerRemainingQuantity(offer: OfferTiming): number | null {
  const cap = Number(offer.quantity)
  if (!Number.isFinite(cap) || cap <= 0) return null
  return Math.max(0, cap - (Number(offer.used_quantity) || 0))
}

/** هل نفدت كمية العرض؟ (نفس شرط التخطّي في findBestDiscount) */
export function isOfferSoldOut(offer: OfferTiming): boolean {
  const remaining = offerRemainingQuantity(offer)
  return remaining !== null && remaining <= 0
}

/**
 * الثواني المتبقّية على انتهاء عرض الفلاش، أو null لغير الفلاش/المنتهي.
 * تُحسب من فرق الساعات بتوقيت القاهرة فلا تحتاج بناء لحظة زمنية بمنطقة زمنية (غير موثوق في المتصفّح).
 */
export function flashRemainingSeconds(offer: OfferTiming): number | null {
  if (!isFlashOffer(offer)) return null
  const { date, hourFraction } = cairoNow()
  if (date !== String(offer.start_date || "").split("T")[0]) return null
  const remainingHours = Number(offer.duration_hours) - hourFraction
  if (!(remainingHours > 0)) return null
  return Math.round(remainingHours * 3600)
}

/** صياغة عدّاد تنازلي HH:MM:SS من عدد ثوانٍ. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
