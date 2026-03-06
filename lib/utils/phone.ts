const EGYPT_LOCAL_MOBILE_REGEX = /^01[0125]\d{8}$/
const EGYPT_CANONICAL_MOBILE_REGEX = /^\+201[0125]\d{8}$/

function sanitizePhone(rawPhone: string) {
  return rawPhone.replace(/[\s()-]/g, "")
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

export function isValidEgyptPhone(rawPhone: string) {
  return normalizeEgyptPhone(rawPhone) !== null
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

export function maskEgyptPhone(rawPhone: string) {
  const normalizedPhone = normalizeEgyptPhone(rawPhone)
  if (!normalizedPhone) {
    return rawPhone
  }

  return `${normalizedPhone.slice(0, 6)}****${normalizedPhone.slice(-2)}`
}
