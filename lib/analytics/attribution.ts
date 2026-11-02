// مصدر الزيارة (إعلان / رابط / مباشر) — يُلتقط في المتصفح عند الهبوط ويُرفق بالطلب عند إنشائه.
//
// ملف نقي عمدًا (ليس "use server"): يستورده مكوّن عميل (الالتقاط) وملف أفعال الطلبات (التعقيم).
// دوال المتصفح محروسة بـ typeof window ولا تُستدعى سيرفر-سايد.
//
// لماذا «آخر لمسة غير مباشرة»: التنقّل الداخلي والزيارة المباشرة لا يمحوان مصدرًا سابقًا، فمن دخل
// من إعلان ثم رجع بعد يومين بكتابة العنوان يُنسب طلبه للإعلان. «أول لمسة» تُحفظ بجانبها للمقارنة.

export const ATTRIBUTION_STORAGE_KEY = "mahalak_attribution_v1"
/** أقصى عمر للمسة تُنسب إليها طلبات — يغطي نافذة ميتا الافتراضية (7 أيام نقر) بهامش. */
export const ATTRIBUTION_MAX_AGE_S = 30 * 24 * 3600

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const
const CLICK_ID_KEYS = ["fbclid", "gclid"] as const

export type AttributionTouch = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
  landing_path?: string
  referrer_host?: string
  /** ميلي ثانية بساعة جهاز العميل — لا يُرسَل للسيرفر؛ يُرسَل العمر بدلًا منه (انظر ageSeconds). */
  ts: number
}

export type StoredAttribution = { first?: AttributionTouch; last?: AttributionTouch }

/** ما يرسله المتصفح مع الطلب. العمر نسبي لأن ساعات الموبايلات الرخيصة كثيرًا ما تكون خاطئة. */
export type AttributionPayload = Omit<AttributionTouch, "ts"> & {
  age_s: number
  fbc?: string
  fbp?: string
  first?: Omit<AttributionTouch, "ts"> & { age_s: number }
}

export type AttributionChannel = "meta_ads" | "meta" | "google_ads" | "paid" | "utm" | "referral"

/** ما يُكتب في مستند الطلب (حقل attribution). */
export type OrderAttribution = {
  channel: AttributionChannel
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
  fbc?: string
  fbp?: string
  landing_path?: string
  referrer_host?: string
  touched_at: string
  first_channel?: AttributionChannel
  first_utm_source?: string
  first_utm_campaign?: string
  first_touched_at?: string
}

const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta", "messenger", "an", "audience_network"])
const PAID_MEDIUMS = new Set(["paid", "cpc", "ppc", "cpm", "paid_social", "paidsocial", "paid-social", "social_paid", "ads", "ad", "sponsored"])
const META_HOST = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|messenger\.com)$/

// ═══ التنظيف ═══

// نصّ قياس من مدخل عام يُعرض لاحقًا في لوحة الأدمن: نحذف المحارف التحكمية والأقواس والاقتباسات
// (React يهرّبها أصلًا، لكن المستند يُقرأ أيضًا من لوحة Flutter وتصديرات) ونقصّ الطول.
const STRIPPED = new Set(["<", ">", '"', "'", "`", "\\"])

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const v = Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && code !== 0x7f && !STRIPPED.has(ch)
    })
    .join("")
    .trim()
    .slice(0, max)
  return v || undefined
}

// معرّفات النقر (fbclid/gclid/_fbc/_fbp) أبجدية رقمية بفواصل محدودة — أي محرف خارجها يُسقط القيمة كلها
function cleanId(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  const v = value.trim()
  if (!v || v.length > max || !/^[A-Za-z0-9._-]+$/.test(v)) return undefined
  return v
}

function cleanPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const path = value.split(/[?#]/)[0]
  if (!path.startsWith("/") || path.startsWith("//")) return undefined
  return cleanText(path, 200)
}

function cleanHost(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const v = value.trim().toLowerCase()
  if (!v || v.length > 100 || !/^[a-z0-9.-]+$/.test(v)) return undefined
  return v
}

function cleanAge(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > ATTRIBUTION_MAX_AGE_S) return null
  return Math.floor(value)
}

type TouchFields = Omit<AttributionTouch, "ts">

function cleanTouch(raw: Record<string, unknown>): TouchFields {
  const out: TouchFields = {}
  for (const key of UTM_KEYS) {
    const v = cleanText(raw[key], 150)
    if (v) out[key] = key === "utm_source" || key === "utm_medium" ? v.toLowerCase() : v
  }
  const fbclid = cleanId(raw.fbclid, 500)
  if (fbclid) out.fbclid = fbclid
  const gclid = cleanId(raw.gclid, 500)
  if (gclid) out.gclid = gclid
  const landing = cleanPath(raw.landing_path)
  if (landing) out.landing_path = landing
  const host = cleanHost(raw.referrer_host)
  if (host) out.referrer_host = host
  return out
}

function hasSignal(t: TouchFields): boolean {
  return Boolean(t.utm_source || t.utm_medium || t.utm_campaign || t.fbclid || t.gclid || t.referrer_host)
}

// ═══ التصنيف ═══

/**
 * قناة اللمسة. fbclid وحده لا يعني إعلانًا: فيسبوك يلصقه بكل رابط خارجي، منشورًا عاديًا كان أو
 * إعلانًا — فهو «meta». «meta_ads» يحتاج utm_medium مدفوعًا، لذا تُضاف معاملات UTM لروابط الإعلانات.
 */
export function classifyChannel(t: TouchFields): AttributionChannel {
  const source = (t.utm_source || "").toLowerCase()
  const medium = (t.utm_medium || "").toLowerCase()
  const paid = PAID_MEDIUMS.has(medium)
  const metaSource = META_SOURCES.has(source) || (t.referrer_host ? META_HOST.test(t.referrer_host) : false)
  if (metaSource && paid) return "meta_ads"
  if (t.gclid || (source === "google" && paid)) return "google_ads"
  if (metaSource || t.fbclid) return "meta"
  if (paid) return "paid"
  if (source) return "utm"
  return "referral"
}

// ═══ المتصفح: الالتقاط عند الهبوط ═══

/**
 * لمسة من عنوان الهبوط، أو null إن كانت الزيارة مباشرة/تنقّلًا داخليًا (فلا تمحو مصدرًا سابقًا).
 * `ownHost` يُمرَّر لتجاهل المُحيل الداخلي (التنقّل بين صفحات الموقع نفسه).
 */
export function touchFromLocation(
  search: string,
  referrer: string,
  pathname: string,
  ownHost: string,
  nowMs: number,
): AttributionTouch | null {
  const params = new URLSearchParams(search)
  const raw: Record<string, unknown> = { landing_path: pathname }
  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    const v = params.get(key)
    if (v) raw[key] = v
  }
  let refHost = ""
  try {
    refHost = referrer ? new URL(referrer).hostname.toLowerCase() : ""
  } catch {
    refHost = ""
  }
  const own = ownHost.toLowerCase().replace(/^www\./, "")
  if (refHost && refHost.replace(/^www\./, "") !== own) raw.referrer_host = refHost

  const touch = cleanTouch(raw)
  if (!hasSignal(touch)) return null
  return { ...touch, ts: nowMs }
}

export function mergeTouch(stored: StoredAttribution | null, touch: AttributionTouch): StoredAttribution {
  return { first: stored?.first ?? touch, last: touch }
}

function readStored(): StoredAttribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as StoredAttribution) : null
  } catch {
    return null
  }
}

/** يُستدعى مرة عند تحميل الصفحة. يُرجع اللمسة الملتقطة (إن وُجدت) لاستخدامها في أدوات أخرى. */
export function captureAttribution(): AttributionTouch | null {
  if (typeof window === "undefined") return null
  try {
    const touch = touchFromLocation(
      window.location.search,
      document.referrer,
      window.location.pathname,
      window.location.hostname,
      Date.now(),
    )
    if (!touch) return null
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(mergeTouch(readStored(), touch)))
    return touch
  } catch {
    // تخزين ممتلئ/محجوب (وضع خاص في بعض المتصفحات المدمجة) — القياس لا يكسر الصفحة أبدًا
    return null
  }
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

function withoutTs(touch: AttributionTouch): TouchFields {
  const copy: Partial<AttributionTouch> = { ...touch }
  delete copy.ts
  return copy
}

function ageSeconds(ts: unknown, nowMs: number): number | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null
  return cleanAge(Math.max(0, (nowMs - ts) / 1000))
}

/** مصدر الطلب كما يُرسل مع إنشائه — null إن لم توجد لمسة صالحة خلال 30 يومًا. */
export function getAttributionForOrder(): AttributionPayload | null {
  if (typeof window === "undefined") return null
  try {
    const stored = readStored()
    const last = stored?.last
    const now = Date.now()
    const age = last ? ageSeconds(last.ts, now) : null
    if (!last || age === null) return null
    const payload: AttributionPayload = { ...withoutTs(last), age_s: age }
    const fbc = readCookie("_fbc")
    const fbp = readCookie("_fbp")
    if (fbc) payload.fbc = fbc
    if (fbp) payload.fbp = fbp
    const first = stored?.first
    const firstAge = first ? ageSeconds(first.ts, now) : null
    if (first && firstAge !== null) payload.first = { ...withoutTs(first), age_s: firstAge }
    return payload
  } catch {
    return null
  }
}

// ═══ السيرفر: التعقيم قبل الكتابة في مستند الطلب ═══

/**
 * يحوّل مدخل العميل إلى حقل attribution آمن، أو null. أفعال الطلبات نقاط عامة: لا نخزّن أي مفتاح
 * غير معروف، ولا نصًّا بلا قصّ، والقناة تُعاد حسابها هنا لا تُقبل من العميل. التاريخ يُشتق من
 * ساعة السيرفر ناقص العمر المرسل، فساعة جهاز خاطئة لا تُفسد التاريخ المخزَّن.
 */
export function sanitizeAttribution(raw: unknown, nowMs: number = Date.now()): OrderAttribution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const input = raw as Record<string, unknown>
  const age = cleanAge(input.age_s)
  if (age === null) return null
  const last = cleanTouch(input)
  if (!hasSignal(last)) return null

  const out: OrderAttribution = {
    channel: classifyChannel(last),
    ...last,
    touched_at: new Date(nowMs - age * 1000).toISOString(),
  }
  const fbc = cleanId(input.fbc, 600)
  if (fbc) out.fbc = fbc
  const fbp = cleanId(input.fbp, 100)
  if (fbp) out.fbp = fbp

  const firstRaw = input.first
  if (firstRaw && typeof firstRaw === "object" && !Array.isArray(firstRaw)) {
    const firstInput = firstRaw as Record<string, unknown>
    const firstAge = cleanAge(firstInput.age_s)
    const first = cleanTouch(firstInput)
    if (firstAge !== null && hasSignal(first)) {
      out.first_channel = classifyChannel(first)
      if (first.utm_source) out.first_utm_source = first.utm_source
      if (first.utm_campaign) out.first_utm_campaign = first.utm_campaign
      out.first_touched_at = new Date(nowMs - firstAge * 1000).toISOString()
    }
  }
  return out
}

/** تسمية القناة في لوحة الأدمن. */
export const CHANNEL_LABEL: Record<AttributionChannel, string> = {
  meta_ads: "إعلان ميتا",
  meta: "فيسبوك/إنستجرام",
  google_ads: "إعلان جوجل",
  paid: "إعلان",
  utm: "رابط حملة",
  referral: "موقع خارجي",
}
