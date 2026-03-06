import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type Auth, type ConfirmationResult } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import { normalizeEgyptPhone } from "@/lib/utils/phone"

export type OTPFlow = "register" | "forgot-password" | "other"

type OTPSendOptions = {
  containerId?: string
  flow?: OTPFlow
}

type OTPVerifyOptions = {
  flow?: OTPFlow
}

type OTPSessionMeta = {
  flow: OTPFlow
  phone: string
  sentAt: number
  cooldownEndsAt: number
}

export type OTPStatus = {
  phone: string | null
  cooldownRemaining: number
  attemptsRemaining: number
  hasRequestedCode: boolean
  sessionLost: boolean
}

type OTPSendResult = {
  success: boolean
  error?: string
  cooldown?: number
  attemptsRemaining?: number
  phone?: string
  sessionLost?: boolean
}

type OTPVerifyResult = {
  success: boolean
  error?: string
  attemptsRemaining?: number
  phone?: string
  sessionLost?: boolean
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const REQUIRED_FIREBASE_WEB_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const

const OTP_STORAGE_KEY = "otp_rate_limit"
const OTP_SESSION_KEY_PREFIX = "otp_session:"
const OTP_COOLDOWNS = [60, 120, 300]
const OTP_MAX_SENDS_PER_HOUR = 5
const OTP_LOCKOUT_DURATION = 30 * 60 * 1000

let recaptchaVerifier: RecaptchaVerifier | null = null

declare global {
  interface Window {
    __firebaseConfirmationResult?: ConfirmationResult | null
    __firebaseConfirmationFlow?: OTPFlow | null
    __firebaseConfirmationPhone?: string | null
  }
}

interface OTPRateLimitData {
  sendCount: number
  lastSendTime: number
  verifyAttempts: number
  lastVerifyTime: number
  lockedUntil: number
  phone: string
}

function getMissingFirebaseWebEnv() {
  return REQUIRED_FIREBASE_WEB_ENV.filter((key) => {
    const value = process.env[key]
    return typeof value !== "string" || !value.trim()
  })
}

function assertFirebaseWebConfigured() {
  const missing = getMissingFirebaseWebEnv()
  if (!missing.length) {
    return
  }

  const message = `Missing Firebase Web env vars: ${missing.join(", ")}`
  console.error(`[auth/otp] ${message}`)
  throw new Error(message)
}

function getFirebaseApp(): FirebaseApp {
  assertFirebaseWebConfigured()

  if (getApps().length) {
    return getApp()
  }

  return initializeApp({
    apiKey: firebaseConfig.apiKey!,
    authDomain: firebaseConfig.authDomain!,
    projectId: firebaseConfig.projectId!,
    storageBucket: firebaseConfig.storageBucket!,
    messagingSenderId: firebaseConfig.messagingSenderId!,
    appId: firebaseConfig.appId!,
    measurementId: firebaseConfig.measurementId,
  })
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export function getFirestoreClient(): Firestore {
  return getFirestore(getFirebaseApp())
}

function getConfirmationState() {
  if (typeof window === "undefined") {
    return { result: null, flow: null, phone: null } as const
  }

  return {
    result: window.__firebaseConfirmationResult || null,
    flow: window.__firebaseConfirmationFlow || null,
    phone: window.__firebaseConfirmationPhone || null,
  } as const
}

function setConfirmationState(result: ConfirmationResult | null, flow: OTPFlow | null, phone: string | null) {
  if (typeof window === "undefined") {
    return
  }

  window.__firebaseConfirmationResult = result
  window.__firebaseConfirmationFlow = flow
  window.__firebaseConfirmationPhone = phone
}

function getSessionKey(flow: OTPFlow) {
  return `${OTP_SESSION_KEY_PREFIX}${flow}`
}

function getOTPSessionMeta(flow: OTPFlow): OTPSessionMeta | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = sessionStorage.getItem(getSessionKey(flow))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as OTPSessionMeta
    if (!parsed.phone || parsed.flow !== flow) {
      sessionStorage.removeItem(getSessionKey(flow))
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function setOTPSessionMeta(flow: OTPFlow, meta: OTPSessionMeta) {
  if (typeof window === "undefined") {
    return
  }

  sessionStorage.setItem(getSessionKey(flow), JSON.stringify(meta))
}

function clearOTPSessionMeta(flow?: OTPFlow) {
  if (typeof window === "undefined") {
    return
  }

  if (flow) {
    sessionStorage.removeItem(getSessionKey(flow))
    return
  }

  for (const key of ["register", "forgot-password", "other"] as OTPFlow[]) {
    sessionStorage.removeItem(getSessionKey(key))
  }
}

function getOTPRateLimitData(): OTPRateLimitData {
  if (typeof window === "undefined") {
    return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
  }

  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY)
    if (!raw) {
      return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
    }

    const data = JSON.parse(raw) as OTPRateLimitData
    if (Date.now() - data.lastSendTime > 60 * 60 * 1000) {
      return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
    }

    return data
  } catch {
    return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
  }
}

function saveOTPRateLimitData(data: OTPRateLimitData) {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors.
  }
}

export function getOTPCooldownRemaining(flow?: OTPFlow): number {
  const data = getOTPRateLimitData()
  const flowMeta = flow ? getOTPSessionMeta(flow) : null

  const rateLimitCooldown = data.lockedUntil > Date.now()
    ? Math.ceil((data.lockedUntil - Date.now()) / 1000)
    : Math.max(
        0,
        Math.ceil(
          (Math.max(0, OTP_COOLDOWNS[Math.min(data.sendCount - 1, OTP_COOLDOWNS.length - 1)] || 0) * 1000 -
            (Date.now() - data.lastSendTime)) /
            1000,
        ),
      )

  const sessionCooldown = flowMeta ? Math.max(0, Math.ceil((flowMeta.cooldownEndsAt - Date.now()) / 1000)) : 0

  return Math.max(rateLimitCooldown, sessionCooldown)
}

export function getOTPAttemptsRemaining(flow?: OTPFlow): number {
  if (flow && !getOTPSessionMeta(flow)) {
    return 3
  }

  const data = getOTPRateLimitData()
  return Math.max(0, 3 - data.verifyAttempts)
}

export function getOTPStatus(flow: OTPFlow): OTPStatus {
  const meta = getOTPSessionMeta(flow)
  const confirmationState = getConfirmationState()

  return {
    phone: meta?.phone || null,
    cooldownRemaining: getOTPCooldownRemaining(flow),
    attemptsRemaining: getOTPAttemptsRemaining(flow),
    hasRequestedCode: Boolean(meta),
    sessionLost: Boolean(meta && (!confirmationState.result || confirmationState.flow !== flow || confirmationState.phone !== meta.phone)),
  }
}

function checkOTPSendAllowed(phone: string): { allowed: boolean; error?: string; cooldown?: number } {
  const data = getOTPRateLimitData()

  if (data.lockedUntil > Date.now()) {
    return {
      allowed: false,
      error: `تم تجاوز عدد المحاولات. يرجى الانتظار ${Math.ceil((data.lockedUntil - Date.now()) / 1000 / 60)} دقيقة`,
      cooldown: Math.ceil((data.lockedUntil - Date.now()) / 1000),
    }
  }

  if (data.phone && data.phone !== phone) {
    return { allowed: true }
  }

  if (data.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
    const lockData = { ...data, lockedUntil: Date.now() + OTP_LOCKOUT_DURATION }
    saveOTPRateLimitData(lockData)
    return {
      allowed: false,
      error: "تم تجاوز الحد الأقصى للإرسال. يرجى المحاولة بعد 30 دقيقة",
      cooldown: OTP_LOCKOUT_DURATION / 1000,
    }
  }

  const cooldown = getOTPCooldownRemaining()
  if (cooldown > 0) {
    return { allowed: false, error: `يرجى الانتظار ${cooldown} ثانية قبل إعادة الإرسال`, cooldown }
  }

  return { allowed: true }
}

function recordOTPSend(phone: string) {
  const data = getOTPRateLimitData()
  const newData: OTPRateLimitData = {
    ...data,
    sendCount: data.phone === phone ? data.sendCount + 1 : 1,
    lastSendTime: Date.now(),
    verifyAttempts: 0,
    lastVerifyTime: 0,
    phone,
    lockedUntil: data.lockedUntil,
  }

  saveOTPRateLimitData(newData)
}

function recordOTPVerifyAttempt() {
  const data = getOTPRateLimitData()
  const newAttempts = data.verifyAttempts + 1

  if (newAttempts > 3) {
    return { allowed: false, error: "تم تجاوز عدد المحاولات. يرجى طلب كود جديد" }
  }

  saveOTPRateLimitData({ ...data, verifyAttempts: newAttempts, lastVerifyTime: Date.now() })
  return { allowed: true }
}

function clearOTPRateLimitData() {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.removeItem(OTP_STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}

function ensureRecaptchaContainer(containerId: string) {
  if (typeof document === "undefined") {
    return containerId
  }

  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement("div")
    container.id = containerId
    container.style.display = "none"
    document.body.appendChild(container)
  } else {
    container.innerHTML = ""
  }

  return containerId
}

function mapSendError(error: any) {
  switch (error?.code) {
    case "auth/invalid-phone-number":
      return "رقم الهاتف غير صحيح"
    case "auth/too-many-requests":
      return "تم إرسال عدد كبير من الطلبات. يرجى المحاولة لاحقاً"
    case "auth/quota-exceeded":
      return "تم تجاوز الحد اليومي للرسائل"
    case "auth/unauthorized-domain":
      return "هذا الدومين غير مصرح له بإرسال كود التحقق"
    case "auth/operation-not-allowed":
      return "خدمة التحقق عبر الهاتف غير مفعلة حالياً"
    case "auth/captcha-check-failed":
      return "فشل التحقق الأمني. أعد المحاولة"
    case "auth/network-request-failed":
      return "تعذر الاتصال بخدمة التحقق. تحقق من الإنترنت"
    case "auth/invalid-app-credential":
      return "بيانات تطبيق Firebase غير صالحة أو غير مكتملة"
    default:
      if (typeof error?.message === "string" && error.message.startsWith("Missing Firebase Web env vars:")) {
        return "إعدادات Firebase الخاصة بالتحقق غير مكتملة"
      }
      return "فشل إرسال كود التحقق"
  }
}

function mapVerifyError(error: any, attemptsRemaining: number) {
  switch (error?.code) {
    case "auth/invalid-verification-code":
      return attemptsRemaining > 0
        ? `كود التحقق غير صحيح. المحاولات المتبقية: ${attemptsRemaining}`
        : "تم تجاوز عدد المحاولات. يرجى طلب كود جديد"
    case "auth/code-expired":
      return "انتهت صلاحية كود التحقق. يرجى طلب كود جديد"
    case "auth/network-request-failed":
      return "تعذر الاتصال بخدمة التحقق. تحقق من الإنترنت"
    default:
      return "حدث خطأ أثناء التحقق من الكود"
  }
}

export function initRecaptchaVerifier(containerId = "recaptcha-container"): RecaptchaVerifier | null {
  try {
    const auth = getFirebaseAuth()
    ensureRecaptchaContainer(containerId)

    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear()
      } catch {
        // Ignore.
      }
    }

    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        recaptchaVerifier = null
      },
    })

    return recaptchaVerifier
  } catch (error: any) {
    console.error("[auth/otp] Error initializing reCAPTCHA:", error?.message || error)
    return null
  }
}

export async function sendPhoneOTP(phoneNumber: string, options: OTPSendOptions = {}): Promise<OTPSendResult> {
  const flow = options.flow || "other"
  const containerId = options.containerId || "recaptcha-container"
  const normalizedPhone = normalizeEgyptPhone(phoneNumber)

  if (!normalizedPhone) {
    return { success: false, error: "رقم الهاتف غير صحيح", attemptsRemaining: 3 }
  }

  const rateCheck = checkOTPSendAllowed(normalizedPhone)
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: rateCheck.error,
      cooldown: rateCheck.cooldown,
      attemptsRemaining: getOTPAttemptsRemaining(flow),
      phone: normalizedPhone,
      sessionLost: getOTPStatus(flow).sessionLost,
    }
  }

  try {
    const auth = getFirebaseAuth()

    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear()
      } catch {
        // Ignore.
      }
      recaptchaVerifier = null
    }

    const resolvedContainerId = ensureRecaptchaContainer(containerId)

    recaptchaVerifier = new RecaptchaVerifier(auth, resolvedContainerId, {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        recaptchaVerifier = null
      },
    })

    const result = await signInWithPhoneNumber(auth, normalizedPhone, recaptchaVerifier)
    recordOTPSend(normalizedPhone)

    const cooldown = getOTPCooldownRemaining()
    setConfirmationState(result, flow, normalizedPhone)
    setOTPSessionMeta(flow, {
      flow,
      phone: normalizedPhone,
      sentAt: Date.now(),
      cooldownEndsAt: Date.now() + cooldown * 1000,
    })

    return {
      success: true,
      cooldown,
      attemptsRemaining: getOTPAttemptsRemaining(flow),
      phone: normalizedPhone,
      sessionLost: false,
    }
  } catch (error: any) {
    console.error("[auth/otp] Send error:", error?.code || error)

    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear()
      } catch {
        // Ignore.
      }
      recaptchaVerifier = null
    }

    return {
      success: false,
      error: mapSendError(error),
      cooldown: getOTPCooldownRemaining(flow),
      attemptsRemaining: getOTPAttemptsRemaining(flow),
      phone: normalizedPhone,
      sessionLost: false,
    }
  }
}

export async function verifyPhoneOTP(code: string, options: OTPVerifyOptions = {}): Promise<OTPVerifyResult> {
  const flow = options.flow || "other"
  const sessionMeta = getOTPSessionMeta(flow)

  if (!sessionMeta) {
    return {
      success: false,
      error: "لم يتم طلب كود تحقق لهذا الإجراء بعد",
      attemptsRemaining: 3,
      sessionLost: false,
    }
  }

  const confirmationState = getConfirmationState()
  if (!confirmationState.result || confirmationState.flow !== flow || confirmationState.phone !== sessionMeta.phone) {
    return {
      success: false,
      error: "انتهت جلسة التحقق. يرجى إعادة إرسال الكود",
      attemptsRemaining: getOTPAttemptsRemaining(flow),
      phone: sessionMeta.phone,
      sessionLost: true,
    }
  }

  const attemptCheck = recordOTPVerifyAttempt()
  if (!attemptCheck.allowed) {
    return {
      success: false,
      error: attemptCheck.error,
      attemptsRemaining: 0,
      phone: sessionMeta.phone,
      sessionLost: false,
    }
  }

  try {
    await confirmationState.result.confirm(code)
    setConfirmationState(null, null, null)
    clearOTPSessionMeta(flow)
    clearOTPRateLimitData()

    return {
      success: true,
      attemptsRemaining: 3,
      phone: sessionMeta.phone,
      sessionLost: false,
    }
  } catch (error: any) {
    console.error("[auth/otp] Verify error:", error?.code || error)
    const attemptsRemaining = getOTPAttemptsRemaining(flow)

    if (error?.code === "auth/code-expired") {
      setConfirmationState(null, null, null)
    }

    return {
      success: false,
      error: mapVerifyError(error, attemptsRemaining),
      attemptsRemaining,
      phone: sessionMeta.phone,
      sessionLost: false,
    }
  }
}

export function clearPhoneAuth(flow?: OTPFlow) {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear()
    } catch {
      // Ignore.
    }
    recaptchaVerifier = null
  }

  setConfirmationState(null, null, null)
  clearOTPSessionMeta(flow)
}
