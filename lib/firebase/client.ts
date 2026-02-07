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

export function getFirebaseApp(): FirebaseApp {
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
    console.warn("[v0] reCAPTCHA container not found:", containerId)
    return null
  }
  
  // Check if container already has reCAPTCHA rendered
  if (container.hasChildNodes()) {
    console.log("[v0] reCAPTCHA already rendered, reusing...")
    return recaptchaVerifier
  }
  
  try {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved - will proceed with phone auth
        console.log("[v0] reCAPTCHA verified")
      },
      "expired-callback": () => {
        // Reset reCAPTCHA
        console.log("[v0] reCAPTCHA expired")
      },
    })
    
    return recaptchaVerifier
  } catch (error: any) {
    console.error("[v0] Error initializing reCAPTCHA:", error.message)
    return null
  }
}

/**
 * Send OTP to phone number
 * @param phoneNumber - Phone number with country code (e.g., +201012345678)
 * @returns Promise<boolean> - true if OTP sent successfully
 */
export async function sendPhoneOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getFirebaseAuth()
    
    // Auto-initialize reCAPTCHA if not done
    if (!recaptchaVerifier) {
      // Create a temporary container if needed
      let container = document.getElementById("recaptcha-container")
      if (!container) {
        container = document.createElement("div")
        container.id = "recaptcha-container"
        container.style.display = "none"
        document.body.appendChild(container)
      }
      
      recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => console.log("[v0] reCAPTCHA verified"),
      })
    }
    
    // Format phone number if needed
    let formattedPhone = phoneNumber.trim()
    if (!formattedPhone.startsWith("+")) {
      // Assume Egypt if no country code
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+2" + formattedPhone
      } else {
        formattedPhone = "+20" + formattedPhone
      }
    }
    
    console.log("========== PHONE DEBUG ==========")
    console.log("Original phone input:", phoneNumber)
    console.log("Formatted phone sent to Firebase:", formattedPhone)
    console.log("Expected test number in Firebase: +201550448160")
    console.log("Are they equal?", formattedPhone === "+201550448160")
    console.log("==================================")
    
    const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier)
    setConfirmationResult(result)
    console.log("[v0] OTP sent successfully to:", formattedPhone)
    
    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error sending OTP:", error)
    
    // Reset reCAPTCHA on error
    if (recaptchaVerifier) {
      recaptchaVerifier.clear()
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
export async function verifyPhoneOTP(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const confirmationResult = getConfirmationResult()
    
    console.log("========== OTP VERIFY DEBUG ==========")
    console.log("OTP code entered:", code)
    console.log("confirmationResult exists?", !!confirmationResult)
    console.log("Expected test code: 111111")
    console.log("Are they equal?", code === "111111")
    console.log("======================================")
    
    if (!confirmationResult) {
      console.log("ERROR: No confirmationResult found in window!")
      return { success: false, error: "لم يتم إرسال كود التحقق بعد" }
    }
    
    const result = await confirmationResult.confirm(code)
    console.log("[v0] Phone verified successfully:", result.user.phoneNumber)
    
    // Clear the confirmation result after successful verification
    setConfirmationResult(null)
    
    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error verifying OTP:", error)
    
    let errorMessage = "كود التحقق غير صحيح"
    if (error.code === "auth/invalid-verification-code") {
      errorMessage = "كود التحقق غير صحيح"
    } else if (error.code === "auth/code-expired") {
      errorMessage = "انتهت صلاحية كود التحقق. يرجى طلب كود جديد"
    }
    
    return { success: false, error: errorMessage }
  }
}

/**
 * Clear reCAPTCHA verifier and confirmation result
 */
export function clearPhoneAuth(): void {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear()
    recaptchaVerifier = null
  }
  setConfirmationResult(null)
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ""
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "")
  
  // Format as Egyptian number
  if (digits.startsWith("20") && digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  
  return phone
}
