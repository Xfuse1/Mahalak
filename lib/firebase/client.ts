import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type Auth, type ConfirmationResult } from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function getFirebaseApp(): FirebaseApp {
  if (getApps().length) {
    return getApp()
  }

  return initializeApp(firebaseConfig)
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export function getFirestoreClient(): Firestore {
  return getFirestore(getFirebaseApp())
}

// Phone Authentication helpers
let recaptchaVerifier: RecaptchaVerifier | null = null

// Store confirmationResult in window to persist across page navigations
declare global {
  interface Window {
    __firebaseConfirmationResult?: ConfirmationResult | null
  }
}

function getConfirmationResult(): ConfirmationResult | null {
  if (typeof window !== 'undefined') {
    return window.__firebaseConfirmationResult || null
  }
  return null
}

function setConfirmationResult(result: ConfirmationResult | null): void {
  if (typeof window !== 'undefined') {
    window.__firebaseConfirmationResult = result
  }
}

// ==================== OTP Rate Limiting ====================

const OTP_STORAGE_KEY = "otp_rate_limit"
const OTP_COOLDOWNS = [60, 120, 300] // Progressive cooldown: 1min, 2min, 5min
const OTP_MAX_SENDS_PER_HOUR = 5
const OTP_LOCKOUT_DURATION = 30 * 60 * 1000 // 30 min lockout after max attempts

interface OTPRateLimitData {
  sendCount: number
  lastSendTime: number
  verifyAttempts: number
  lastVerifyTime: number
  lockedUntil: number
  phone: string
}

function getOTPRateLimitData(): OTPRateLimitData {
  if (typeof window === 'undefined') {
    return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
  }
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY)
    if (!raw) return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
    const data = JSON.parse(raw) as OTPRateLimitData
    // Reset if more than 1 hour has passed since last send
    if (Date.now() - data.lastSendTime > 60 * 60 * 1000) {
      return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
    }
    return data
  } catch {
    return { sendCount: 0, lastSendTime: 0, verifyAttempts: 0, lastVerifyTime: 0, lockedUntil: 0, phone: "" }
  }
}

function saveOTPRateLimitData(data: OTPRateLimitData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

export function getOTPCooldownRemaining(): number {
  const data = getOTPRateLimitData()
  if (data.lockedUntil > Date.now()) {
    return Math.ceil((data.lockedUntil - Date.now()) / 1000)
  }
  const cooldownIndex = Math.min(data.sendCount - 1, OTP_COOLDOWNS.length - 1)
  const cooldownSeconds = cooldownIndex >= 0 ? OTP_COOLDOWNS[cooldownIndex] : 0
  const elapsed = (Date.now() - data.lastSendTime) / 1000
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed))
}

export function getOTPAttemptsRemaining(): number {
  const data = getOTPRateLimitData()
  return Math.max(0, 3 - data.verifyAttempts)
}

function checkOTPSendAllowed(phone: string): { allowed: boolean; error?: string; cooldown?: number } {
  const data = getOTPRateLimitData()

  // Check lockout
  if (data.lockedUntil > Date.now()) {
    const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000 / 60)
    return { allowed: false, error: `تم تجاوز عدد المحاولات. يرجى الانتظار ${remaining} دقيقة`, cooldown: Math.ceil((data.lockedUntil - Date.now()) / 1000) }
  }

  // Reset counts if phone changed
  if (data.phone && data.phone !== phone) {
    return { allowed: true }
  }

  // Check hourly send limit
  if (data.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
    const lockData = { ...data, lockedUntil: Date.now() + OTP_LOCKOUT_DURATION }
    saveOTPRateLimitData(lockData)
    return { allowed: false, error: "تم تجاوز الحد الأقصى للإرسال. يرجى المحاولة بعد 30 دقيقة", cooldown: OTP_LOCKOUT_DURATION / 1000 }
  }

  // Check progressive cooldown
  const cooldown = getOTPCooldownRemaining()
  if (cooldown > 0) {
    return { allowed: false, error: `يرجى الانتظار ${cooldown} ثانية قبل إعادة الإرسال`, cooldown }
  }

  return { allowed: true }
}

function recordOTPSend(phone: string): void {
  const data = getOTPRateLimitData()
  const newData: OTPRateLimitData = {
    ...data,
    sendCount: data.phone === phone ? data.sendCount + 1 : 1,
    lastSendTime: Date.now(),
    verifyAttempts: data.phone === phone ? data.verifyAttempts : 0,
    phone,
    lockedUntil: data.lockedUntil,
  }
  saveOTPRateLimitData(newData)
}

function recordOTPVerifyAttempt(): { allowed: boolean; error?: string } {
  const data = getOTPRateLimitData()
  const newAttempts = data.verifyAttempts + 1

  if (newAttempts > 3) {
    return { allowed: false, error: "تم تجاوز عدد المحاولات. يرجى طلب كود جديد" }
  }

  saveOTPRateLimitData({ ...data, verifyAttempts: newAttempts, lastVerifyTime: Date.now() })
  return { allowed: true }
}

function resetOTPVerifyAttempts(): void {
  const data = getOTPRateLimitData()
  saveOTPRateLimitData({ ...data, verifyAttempts: 0 })
}

function clearOTPRateLimitData(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(OTP_STORAGE_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Initialize invisible reCAPTCHA verifier for phone authentication
 * Must be called before sending OTP
 */
export function initRecaptchaVerifier(containerId: string = "recaptcha-container"): RecaptchaVerifier | null {
  // If already initialized and valid, return existing verifier
  if (recaptchaVerifier) {
    return recaptchaVerifier
  }
  
  const auth = getFirebaseAuth()
  
  // Check if container exists
  const container = document.getElementById(containerId)
  if (!container) {
    return null
  }
  
  // Check if container already has reCAPTCHA rendered
  if (container.hasChildNodes()) {
    return recaptchaVerifier
  }
  
  try {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved
      },
      "expired-callback": () => {
        // reCAPTCHA expired - will be re-rendered on next send
        recaptchaVerifier = null
      },
    })
    
    return recaptchaVerifier
  } catch (error: any) {
    console.error("[OTP] Error initializing reCAPTCHA:", error.message)
    return null
  }
}

/**
 * Send OTP to phone number
 * @param phoneNumber - Phone number with country code (e.g., +201012345678)
 * @returns Promise<boolean> - true if OTP sent successfully
 */
export async function sendPhoneOTP(phoneNumber: string): Promise<{ success: boolean; error?: string; cooldown?: number }> {
  // Format phone number first
  let formattedPhone = phoneNumber.trim()
  if (!formattedPhone.startsWith("+")) {
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+2" + formattedPhone
    } else {
      formattedPhone = "+20" + formattedPhone
    }
  }

  // Check rate limiting before proceeding
  const rateCheck = checkOTPSendAllowed(formattedPhone)
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error, cooldown: rateCheck.cooldown }
  }

  try {
    const auth = getFirebaseAuth()
    
    // Clean up old reCAPTCHA before creating a new one
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear()
      } catch (e) {
        // Ignore clear errors
      }
      recaptchaVerifier = null
    }
    
    // Remove old reCAPTCHA container and create a fresh one
    let container = document.getElementById("recaptcha-container")
    if (container) {
      container.remove()
    }
    container = document.createElement("div")
    container.id = "recaptcha-container"
    container.style.display = "none"
    document.body.appendChild(container)
    
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {},
    })
    
    const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier)
    setConfirmationResult(result)
    
    // Record successful send for rate limiting
    recordOTPSend(formattedPhone)
    
    return { success: true }
  } catch (error: any) {
    console.error("[OTP] Send error:", error.code)
    
    // Reset reCAPTCHA on error
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear() } catch { /* ignore */ }
      recaptchaVerifier = null
    }
    
    let errorMessage = "فشل إرسال كود التحقق"
    if (error.code === "auth/invalid-phone-number") {
      errorMessage = "رقم الهاتف غير صحيح"
    } else if (error.code === "auth/too-many-requests") {
      errorMessage = "تم إرسال عدد كبير من الطلبات. يرجى المحاولة لاحقاً"
    } else if (error.code === "auth/quota-exceeded") {
      errorMessage = "تم تجاوز الحد اليومي للرسائل"
    }
    
    return { success: false, error: errorMessage }
  }
}

/**
 * Verify OTP code entered by user
 * @param code - 6-digit OTP code
 * @returns Promise with verification result
 */
export async function verifyPhoneOTP(code: string): Promise<{ success: boolean; error?: string; attemptsRemaining?: number }> {
  // Check verify attempt limit
  const attemptCheck = recordOTPVerifyAttempt()
  if (!attemptCheck.allowed) {
    return { success: false, error: attemptCheck.error, attemptsRemaining: 0 }
  }

  try {
    const confirmationResult = getConfirmationResult()
    
    if (!confirmationResult) {
      return { success: false, error: "لم يتم إرسال كود التحقق بعد" }
    }
    
    const result = await confirmationResult.confirm(code)
    
    // Clear the confirmation result after successful verification
    setConfirmationResult(null)
    // Clear rate limit data on success
    clearOTPRateLimitData()
    
    return { success: true }
  } catch (error: any) {
    console.error("[OTP] Verify error:", error.code)
    
    const remaining = getOTPAttemptsRemaining()
    let errorMessage = "كود التحقق غير صحيح"
    if (error.code === "auth/invalid-verification-code") {
      errorMessage = remaining > 0 
        ? `كود التحقق غير صحيح. المحاولات المتبقية: ${remaining}`
        : "تم تجاوز عدد المحاولات. يرجى طلب كود جديد"
    } else if (error.code === "auth/code-expired") {
      errorMessage = "انتهت صلاحية كود التحقق. يرجى طلب كود جديد"
    }
    
    return { success: false, error: errorMessage, attemptsRemaining: remaining }
  }
}

/**
 * Clear reCAPTCHA verifier and confirmation result
 */
export function clearPhoneAuth(): void {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch { /* ignore */ }
    recaptchaVerifier = null
  }
  setConfirmationResult(null)
}


