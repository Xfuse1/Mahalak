import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { getAdminDb } from "@/lib/firebase/admin"
import { normalizeEgyptPhone } from "@/lib/utils/phone"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { findDriverIdByPhone } from "@/lib/drivers/driver-repo"
import { sendSms } from "@/lib/sms/send"
import { logError } from "@/lib/logger"

// دخول السائق بـ (هاتف + OTP) — بديل نظيف لنظام PIN القديم (بلا حساب فعّال ولا شاشة إنشاء).
// نخزّن الكود مُشفّرًا (scrypt) لا كنص صريح، بصلاحية قصيرة واستخدام مرة واحدة، مع كبح بالـIP
// وتهدئة إعادة الإرسال. لا نكشف أبدًا إن كان الرقم سائقًا (منع تعداد الحسابات).

const scryptAsync = promisify(scryptCb) as (pw: string, salt: string, keylen: number) => Promise<Buffer>
const OTP_TTL_MS = 5 * 60 * 1000 // صلاحية الكود 5 دقائق
const OTP_RESEND_COOLDOWN_MS = 60 * 1000 // لا نُعيد الإرسال لنفس الرقم قبل 60 ثانية (مضاد لإغراق الـSMS)
const OTP_MAX_VERIFY_ATTEMPTS = 5 // قفل الكود بعد 5 محاولات خاطئة
const OTP_DAILY_CAP = 8 // سقف يومي لرسائل نفس الرقم — مضاد لقصف SMS المكلّف على رقم سائق معروف

async function hashCode(code: string, salt: string): Promise<string> {
  return (await scryptAsync(code, salt, 64)).toString("hex")
}

function generateCode(): string {
  // كود من 6 أرقام بمولّد آمن تشفيريًا (لا Math.random)
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export async function requestDriverOtp(
  rawPhone: string,
): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const normalized = normalizeEgyptPhone(rawPhone)
  if (!normalized) return { ok: false, error: "invalid_phone" }
  // كبح بالـIP فوق ضوابط الرقم: يمنع مهاجمًا من عنوان واحد يقصف أرقامًا كثيرة.
  if (!(await checkRateLimit("driverOtpRequest", 20, 15 * 60 * 1000))) {
    return { ok: false, error: "rate_limited" }
  }
  try {
    const driver = await findDriverIdByPhone(rawPhone)
    // منع تعداد الحسابات: الرد ثابت { ok: true } سواء كان الرقم سائقًا أم لا (لا حقل cooldown مميِّز)،
    // ولا نُرسل SMS إلا لسائق فعليّ. (يبقى تسريب زمني نظري لا يُستغل عمليًا عبر الشبكة في نطاق البايلوت.)
    if (!driver) return { ok: true }

    // نحسب الكود/الملح/التجزئة قبل المعاملة (لا scrypt داخل المعاملة، وزمن المسار أكثر توحّدًا).
    const code = generateCode()
    const salt = randomBytes(16).toString("hex")
    const hash = await hashCode(code, salt)
    const db = getAdminDb()
    const ref = db.collection("driver_otps").doc(normalized)
    const now = Date.now()

    // فحص-واحجز ذرّيًا داخل معاملة: تهدئة إعادة الإرسال (60ث) + سقف يومي. يمنع تجاوز الطلبات المتزامنة
    // (كان القراءة والكتابة منفصلتين فينفلت القصف) ويمنع الكتابة فوق كود سائق شرعيّ (فوز أول طلب فقط).
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      let dailyCount = 1
      let dailyResetMs = now + 24 * 60 * 60 * 1000
      if (snap.exists) {
        const d = snap.data() as { last_sent_ms?: number; daily_count?: number; daily_reset_ms?: number }
        if (d.last_sent_ms && now - d.last_sent_ms < OTP_RESEND_COOLDOWN_MS) {
          return { send: false as const }
        }
        if (d.daily_reset_ms && now < d.daily_reset_ms) {
          dailyResetMs = d.daily_reset_ms
          dailyCount = (d.daily_count || 0) + 1
          if (dailyCount > OTP_DAILY_CAP) return { send: false as const }
        }
      }
      tx.set(ref, {
        driver_id: driver.id,
        hash,
        salt,
        expires_at: now + OTP_TTL_MS,
        attempts: 0,
        last_sent_ms: now,
        daily_count: dailyCount,
        daily_reset_ms: dailyResetMs,
        created_at: new Date().toISOString(),
      })
      return { send: true as const }
    })

    if (!decision.send) return { ok: true } // تهدئة/سقف يومي — بلا إرسال، وبنفس الرد الموحّد (لا تسريب)
    const res = await sendSms(normalized, `كود دخول محلك: ${code}`)
    // في التطوير فقط (لا الإنتاج) وحين لا مزوّد SMS بعد: نُعيد الكود لتسهيل الاختبار من طرف واحد.
    const devCode = process.env.NODE_ENV !== "production" && !res.ok ? code : undefined
    return { ok: true, devCode }
  } catch (err) {
    logError("[driver-otp] request", err)
    return { ok: false, error: "server_error" }
  }
}

export async function verifyDriverOtp(
  rawPhone: string,
  code: string,
): Promise<{ success: boolean; driverId?: string; error?: string }> {
  const normalized = normalizeEgyptPhone(rawPhone)
  if (!normalized) return { success: false, error: "invalid_phone" }
  if (!(await checkRateLimit("driverOtpVerify", 30, 15 * 60 * 1000))) {
    return { success: false, error: "rate_limited" }
  }
  const db = getAdminDb()
  const ref = db.collection("driver_otps").doc(normalized)
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) return { success: false, error: "invalid_code" }
      const data = snap.data() as {
        hash?: string
        salt?: string
        expires_at?: number
        attempts?: number
        driver_id?: string
      }
      if (!data.expires_at || data.expires_at < Date.now()) {
        tx.delete(ref)
        return { success: false, error: "expired" }
      }
      if ((data.attempts || 0) >= OTP_MAX_VERIFY_ATTEMPTS) {
        return { success: false, error: "too_many_attempts" }
      }
      const providedHash = await hashCode(String(code || ""), data.salt || "")
      const a = Buffer.from(providedHash, "hex")
      const b = Buffer.from(data.hash || "", "hex")
      const ok = a.length === b.length && timingSafeEqual(a, b) // مقارنة زمن-ثابت
      if (!ok) {
        tx.update(ref, { attempts: (data.attempts || 0) + 1 })
        return { success: false, error: "invalid_code" }
      }
      // نجاح: استخدام مرة واحدة — نحذف الكود فورًا
      tx.delete(ref)
      if (!data.driver_id) return { success: false, error: "server_error" }
      return { success: true, driverId: data.driver_id }
    })
  } catch (err) {
    logError("[driver-otp] verify", err)
    return { success: false, error: "server_error" }
  }
}
