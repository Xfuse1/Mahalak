"use server"

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "../firebase/admin"
import { logError } from "../logger"
import { createDriverSession, clearDriverSession } from "../auth/driver-session"
import { checkRateLimit } from "../utils/rate-limit"
import { logServerError } from "../server-error-log"

export type Driver = {
  id: string
  name: string
  phone?: string
  photo_url?: string
  vehicle_type?: string // سيارة، موتوسيكل، إلخ
  rating: number
  total_deliveries: number
  is_available: boolean
  is_online?: boolean
  is_approved: boolean // تم التأكيد من الأدمن
  price: number
  areas?: string[] // المناطق التي يغطيها
  created_at?: string
  updated_at?: string
}

// Get all approved drivers sorted by rating (available first, then by rating)
export async function getDrivers(): Promise<Driver[]> {
  try {
    const db = getAdminDb()
    // Prefer modern schema field first, then fallback for legacy docs.
    let snapshot = await db
      .collection("drivers")
      .where("isApproved", "==", true)
      .get()

    if (snapshot.empty) {
      snapshot = await db
        .collection("drivers")
        .where("is_approved", "==", true)
        .get()
    }

    const drivers: Driver[] = snapshot.docs.map((doc): Driver => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name || "",
        phone: data.phone,
        photo_url: data.photoUrl || data.photo_url,
        vehicle_type: data.vehicleType || data.vehicle_type,
        rating: data.rating || 0,
        total_deliveries: data.totalDeliveries || data.total_deliveries || 0,
        is_available: data.isActive ?? data.is_available ?? true,
        is_online: data.isOnline ?? data.is_online ?? false,
        is_approved: data.isApproved ?? data.is_approved ?? false,
        price: data.price || 0,
        areas: data.areas,
        // Convert Timestamps to strings
        created_at: data.createdAt?.toDate?.()?.toISOString?.() || data.created_at,
        updated_at: data.updatedAt?.toDate?.()?.toISOString?.() || data.updated_at,
      }
    })

    // Sort: available first, then by rating descending
    drivers.sort((a, b) => {
      // First, sort by availability (available first)
      if (a.is_available !== b.is_available) {
        return a.is_available ? -1 : 1
      }
      // Then by rating descending
      return (b.rating || 0) - (a.rating || 0)
    })

    return drivers
  } catch (error) {
    logError("[v0] Error fetching drivers:", error)
    return []
  }
}

// Get a single driver by ID
export async function getDriverById(id: string): Promise<Driver | null> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("drivers").doc(id).get()
    
    if (!doc.exists) {
      return null
    }

    // لا ننشر doc.data() كاملًا — كان يسرّب حقل pin السرّي (استيلاء على حساب سائق).
    // نُرجع الحقول العامة فقط بنفس تعيين getDrivers.
    const data = doc.data() || {}
    return {
      id: doc.id,
      name: data.name || "",
      phone: data.phone,
      photo_url: data.photoUrl || data.photo_url,
      vehicle_type: data.vehicleType || data.vehicle_type,
      rating: data.rating || 0,
      total_deliveries: data.totalDeliveries || data.total_deliveries || 0,
      is_available: data.isActive ?? data.is_available ?? true,
      is_online: data.isOnline ?? data.is_online ?? false,
      is_approved: data.isApproved ?? data.is_approved ?? false,
      price: data.price || 0,
      areas: data.areas,
      created_at: data.createdAt?.toDate?.()?.toISOString?.() || data.created_at,
      updated_at: data.updatedAt?.toDate?.()?.toISOString?.() || data.updated_at,
    }
  } catch (error) {
    return null
  }
}

// ==================== تحصين PIN السائق ====================
// نفس نمط تشفير PIN نقطة البيع (scrypt) — لا نخزّن/نقارن الـ PIN كنص صريح.
const DRIVER_PIN_MAX_ATTEMPTS = 5
const DRIVER_PIN_LOCK_MS = 15 * 60 * 1000 // قفل 15 دقيقة بعد تجاوز المحاولات (مضاد للتخمين)

// scrypt غير متزامن (لا يحجب حلقة الأحداث) — نقطة دخول السائق عامّة فنتجنّب الحجب المتزامن
const scryptAsync = promisify(scryptCb) as (pin: string, salt: string, keylen: number) => Promise<Buffer>

async function deriveDriverPinHash(pin: string, salt: string): Promise<string> {
  return (await scryptAsync(pin, salt, 64)).toString("hex")
}

async function verifyDriverPinHash(pin: string, hash: string, salt: string): Promise<boolean> {
  const expected = Buffer.from(hash, "hex")
  const provided = Buffer.from(await deriveDriverPinHash(pin, salt), "hex")
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

// Verify driver login with PIN — مُشفّر + قفل بعد محاولات + ترحيل تلقائي للـ PIN القديم (نص صريح)
export async function verifyDriverLogin(
  driverId: string,
  pin: string,
): Promise<{ success: boolean; locked?: boolean; retryAfterMinutes?: number }> {
  try {
    // كبح بالـIP فوق القفل بالحساب: أرقام السائقين مكشوفة عبر getDrivers، فبدون كبح بالـIP
    // يقدر مهاجم من عنوان واحد يقفل حسابات كثيرة بالتتابع (حجب خدمة على الأسطول). 30 محاولة/15د.
    if (!(await checkRateLimit("verifyDriverLogin", 30, 15 * 60 * 1000))) {
      return { success: false, locked: true, retryAfterMinutes: 15 }
    }
    const db = getAdminDb()
    const driverRef = db.collection("drivers").doc(driverId)
    const nowMs = Date.now()

    const outcome = await db.runTransaction(async (tx) => {
      const doc = await tx.get(driverRef)
      if (!doc.exists) return { result: "fail" as const }
      const data = doc.data() || {}

      // 1) هل الحساب مقفول حاليًا بسبب محاولات فاشلة متتالية؟
      const lockedUntil = Number(data.pin_locked_until || 0)
      if (lockedUntil && lockedUntil > nowMs) {
        return { result: "locked" as const, retryAfterMinutes: Math.ceil((lockedUntil - nowMs) / 60000) }
      }

      // 2) التحقق: مسار مُشفّر (hash+salt) وإلا مسار قديم (نص صريح) مع ترحيل عند النجاح
      const hash = typeof data.pin_hash === "string" ? data.pin_hash : ""
      const salt = typeof data.pin_salt === "string" ? data.pin_salt : ""
      const legacyPin = data.pin != null ? String(data.pin) : ""
      const provided = String(pin || "")

      let ok = false
      let migrate = false
      // مسار مُشفّر أولًا
      if (hash && salt) {
        ok = await verifyDriverPinHash(provided, hash, salt)
      }
      // مسار النص الصريح: للسائق غير المُرحَّل بعد، أو عند إعادة تعيين الـ PIN من لوحة الأدمن.
      // (تطبيق Flutter يكتب حقل pin نصًّا صريحًا فقط؛ فوجوده = تعيين مُعتمَد يجب أن يفوز حتى لو
      //  كان هناك pin_hash قديم — وإلا لن يستطيع السائق الدخول بعد إعادة التعيين = تراجُع حقيقي.)
      if (!ok && legacyPin) {
        const a = Buffer.from(provided)
        const b = Buffer.from(legacyPin)
        ok = a.length === b.length && timingSafeEqual(a, b) // مقارنة زمن-ثابت
        migrate = ok // نُعيد التشفير بملح جديد ونحذف النص الصريح عند النجاح
      }

      if (!ok) {
        const attempts = Number(data.pin_attempts || 0) + 1
        if (attempts >= DRIVER_PIN_MAX_ATTEMPTS) {
          tx.update(driverRef, { pin_attempts: 0, pin_locked_until: nowMs + DRIVER_PIN_LOCK_MS })
          return { result: "locked" as const, retryAfterMinutes: Math.ceil(DRIVER_PIN_LOCK_MS / 60000) }
        }
        tx.update(driverRef, { pin_attempts: attempts })
        return { result: "fail" as const }
      }

      // نجاح: صفّر العدّاد وأزل القفل، ورحّل الـ PIN القديم إلى hash إن لزم
      const update: Record<string, unknown> = {
        pin_attempts: 0,
        pin_locked_until: FieldValue.delete(),
      }
      if (migrate) {
        const newSalt = randomBytes(16).toString("hex")
        update.pin_hash = await deriveDriverPinHash(provided, newSalt)
        update.pin_salt = newSalt
        update.pin = FieldValue.delete() // إزالة النص الصريح نهائيًا بعد الترحيل/إعادة التعيين
      }
      tx.update(driverRef, update)
      return { result: "success" as const }
    })

    if (outcome.result === "success") {
      // إصدار جلسة سائق موثّقة سيرفر-سايد (كوكي) — تُستخدم لتأمين دوال السائق
      await createDriverSession(driverId)
      return { success: true }
    }
    if (outcome.result === "locked") {
      return { success: false, locked: true, retryAfterMinutes: outcome.retryAfterMinutes }
    }
    return { success: false }
  } catch (err) {
    await logServerError("verifyDriverLogin", err, { driverId })
    return { success: false }
  }
}

// تسجيل خروج السائق (إنهاء الجلسة)
export async function driverLogout(): Promise<{ success: boolean }> {
  await clearDriverSession()
  return { success: true }
}

// Get driver commission rate from settings
export async function getDriverCommission(): Promise<number> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("settings").doc("driverCommission").get()
    
    if (!doc.exists) {
      return 0
    }

    const data = doc.data()
    return data?.rate || 0
  } catch (error) {
    logError("[v0] Error fetching driver commission:", error)
    return 0
  }
}

// Check if simulator is enabled from settings
export async function isSimulatorEnabled(): Promise<boolean> {
  try {
    const db = getAdminDb()
    const doc = await db.collection("settings").doc("simulator").get()
    
    if (!doc.exists) {
      return false
    }

    const data = doc.data()
    return data?.enabled === true
  } catch (error) {
    logError("[v0] Error fetching simulator settings:", error)
    return false
  }
}
