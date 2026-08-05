const EGYPT_LOCAL_MOBILE_REGEX = /^01[0125]\d{8}$/
const EGYPT_CANONICAL_MOBILE_REGEX = /^\+201[0125]\d{8}$/

function sanitizePhone(rawPhone: string) {
  // تحويل الأرقام العربية-الهندية (٠-٩) والفارسية الممتدة (۰-۹) إلى ASCII حتى لا تُرفض
  // الأرقام المكتوبة بالعربية في تطبيق عربي أساسًا.
  const westernized = rawPhone.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })
  // إزالة المسافات/الأقواس/الشرطات، وتحويل بادئة 00 الدولية إلى + (مثل 0020… → +20…)
  const cleaned = westernized.replace(/[\s()-]/g, "")
  return cleaned.replace(/^00/, "+")
}

function toLocalEgyptPhone(rawPhone: string): string | null {
  const sanitized = sanitizePhone(rawPhone)

  if (EGYPT_LOCAL_MOBILE_REGEX.test(sanitized)) {
    return sanitized
  }

  if (EGYPT_CANONICAL_MOBILE_REGEX.test(sanitized)) {
    return `0${sanitized.slice(3)}`
  }

  if (/^201[0125]\d{8}$/.test(sanitized)) {
    return `0${sanitized.slice(2)}`
  }

  if (/^\+?2?01[0125]\d{8}$/.test(sanitized)) {
    const digits = sanitized.replace(/\D/g, "")
    return digits.startsWith("2") ? digits.slice(1) : digits
  }

  if (/^1[0125]\d{8}$/.test(sanitized)) {
    return `0${sanitized}`
  }

  return null
}

export function normalizeEgyptPhone(rawPhone: string): string | null {
  const localPhone = toLocalEgyptPhone(rawPhone)
  if (!localPhone) {
    return null
  }

  return `+20${localPhone.slice(1)}`
}

/**
 * رقم صالح لرابط wa.me: أرقام فقط بمفتاح دولي بلا «+».
 * متسامح عمدًا ولا يمرّ بـ normalizeEgyptPhone: أرقام بعض المتاجر أرضية أو بمفتاح غير مصري،
 * وكان المُطبِّع الصارم يُرجع null لها فيتحوّل زرّ واتساب إلى زرّ ميت. يُرجع "" لما لا يصلح.
 */
export function toWhatsAppDigits(rawPhone: unknown): string {
  if (typeof rawPhone !== "string" || !rawPhone) return ""
  let digits = sanitizePhone(rawPhone).replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("00")) digits = digits.slice(2)
  // صيغة محلية (تبدأ بصفر) ⇒ نفترض مصر كافتراضي معقول: 01012345678 → 201012345678
  if (digits.startsWith("0")) digits = `20${digits.slice(1)}`
  return digits.length >= 8 ? digits : ""
}

export function getEgyptPhoneLookupCandidates(rawPhone: string): string[] {
  const candidates = new Set<string>()
  const sanitized = sanitizePhone(rawPhone)
  const normalizedPhone = normalizeEgyptPhone(rawPhone)

  if (normalizedPhone) {
    candidates.add(normalizedPhone)
    candidates.add(`0${normalizedPhone.slice(3)}`)
    candidates.add(normalizedPhone.slice(1))
  }

  if (sanitized) {
    candidates.add(sanitized)
    candidates.add(sanitized.replace(/^\+/, ""))
  }

  return Array.from(candidates).filter(Boolean)
}
