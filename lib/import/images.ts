// مصادر صور المنتجات لخطّ استيراد الكتالوج (المرحلة 2). سيرفر فقط، أفضل-جهد، لا يرمي.
//  - بالباركود: Open Food Facts (مجاني، صور بترخيص مفتوح CC) — يُطبَّق تلقائيًّا.
//  - بالاسم: نقطة توصيل قابلة للضبط (searchImageByName) — معطّلة حتى يوفّر المالك مزوّد بحث الصور
//    (مفاتيح جوجل). نتائج البحث تحتاج مراجعة التاجر (حقوق الملكية) فتُحفظ كمرشَّح لا كصورة نهائية.
// الصور تُنزَّل وتُعاد استضافتها على R2 (تحكّم + ثبات) وتُخزَّن كـ«مفتاح».
import { randomUUID } from "node:crypto"
import { putObject } from "@/lib/storage/r2"
import { getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"

const MAX_IMG_BYTES = 5 * 1024 * 1024
const EXT_BY_TYPE: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }

// باركود صالح (GTIN 8–14 رقمًا).
export function isValidBarcode(bc?: string): boolean {
  const s = String(bc || "").replace(/\D/g, "")
  return s.length >= 8 && s.length <= 14
}

// صورة المنتج من Open Food Facts عبر الباركود. يعود رابط الصورة أو null.
export async function imageUrlFromBarcode(barcode: string, timeoutMs = 8000): Promise<string | null> {
  const bc = String(barcode || "").replace(/\D/g, "")
  if (!isValidBarcode(bc)) return null
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${bc}?fields=image_url,image_front_url`,
      { headers: { "User-Agent": "Mahalak-Import/1.0 (m7lk.com)" }, signal: AbortSignal.timeout(timeoutMs) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { product?: { image_url?: string; image_front_url?: string } }
    const url = data?.product?.image_front_url || data?.product?.image_url
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null
  } catch (e) {
    logError("[import-images] barcode", e)
    return null
  }
}

// نقطة توصيل بحث الصور بالاسم — معطّلة حتى يُضبط المزوّد (مفاتيح المالك). تعود null الآن.
// عند التوصيل: تُرجِع رابط صورة مرشَّحة (تحتاج مراجعة التاجر لحقوق الملكية).
export async function searchImageByName(_name: string): Promise<string | null> {
  // TODO(المالك): وصّل مزوّد بحث صور جوجل هنا (Custom Search / غيره) عبر env عند توفّر الطريقة.
  if (!process.env.IMAGE_SEARCH_API_KEY) return null
  return null
}

// ينزّل صورة من رابط ويعيد استضافتها على R2 العام؛ يعيد المفتاح أو null.
export async function fetchAndStoreImage(sourceUrl: string, storeId: string, timeoutMs = 12000): Promise<string | null> {
  if (!/^https?:\/\//.test(sourceUrl)) return null
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase()
    const ext = EXT_BY_TYPE[type]
    if (!ext) return null // ليست صورة معروفة
    const len = Number(res.headers.get("content-length") || 0)
    if (len && len > MAX_IMG_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_IMG_BYTES || buf.byteLength < 100) return null
    const key = `products/${storeId}/imp-${randomUUID()}.${ext}`
    await putObject("public", key, buf, type)
    return key
  } catch (e) {
    logError("[import-images] fetchStore", e)
    return null
  }
}

export type ImageOutcome =
  | { kind: "applied"; key: string; source: "barcode" }
  | { kind: "review"; key: string; source: "search" }
  | { kind: "none" }

// يحلّ صورة منتج: الباركود أولًا (يُطبَّق تلقائيًّا)، ثم البحث بالاسم (مرشَّح للمراجعة). يعيد النتيجة.
export async function resolveProductImage(
  product: { barcode?: string; name?: string },
  storeId: string,
): Promise<ImageOutcome> {
  if (isValidBarcode(product.barcode)) {
    const src = await imageUrlFromBarcode(product.barcode!)
    if (src) {
      const key = await fetchAndStoreImage(src, storeId)
      if (key) return { kind: "applied", key, source: "barcode" }
    }
  }
  if (product.name) {
    const src = await searchImageByName(product.name)
    if (src) {
      const key = await fetchAndStoreImage(src, storeId)
      if (key) return { kind: "review", key, source: "search" }
    }
  }
  return { kind: "none" }
}

const IMG_BATCH = 15 // جلب الصورة بطيء (استدعاء خارجي + رفع) — دفعة صغيرة لكل تيك كرون
// ميزانية 8ث تنهي المكنسة داخل حدّ دوال Vercel Hobby (10ث). ما يتبقّى يلتقطه التيك التالي.
const IMG_BUDGET_MS = 8_000

// مكنسة جلب الصور: تعالج المنتجات المطلوب لها صور (image_status="queued") على دفعات. باركود ⇒ تُطبَّق
// تلقائيًّا؛ بحث بالاسم ⇒ مرشَّح للمراجعة (حاليًّا معطّل). يستدعيها كرون. لكل متجر بعد موافقته الصريحة.
export async function processQueuedImages(): Promise<{ scanned: number; applied: number; review: number; none: number }> {
  const db = getAdminDb()
  const out = { scanned: 0, applied: 0, review: 0, none: 0 }
  const snap = await db.collection("products").where("image_status", "==", "queued").limit(IMG_BATCH).get()
  out.scanned = snap.size
  const start = Date.now()
  for (const doc of snap.docs) {
    if (Date.now() - start > IMG_BUDGET_MS) break
    const p = doc.data() as Record<string, any>
    let outcome: ImageOutcome
    try {
      outcome = await resolveProductImage({ barcode: p.barcode, name: p.name }, String(p.store_id || ""))
    } catch {
      outcome = { kind: "none" }
    }
    const now = new Date().toISOString()
    try {
      if (outcome.kind === "applied") {
        await doc.ref.update({ image_url: outcome.key, image_status: "done", image_source: outcome.source, updated_at: now })
        out.applied++
      } else if (outcome.kind === "review") {
        await doc.ref.update({ image_candidate: outcome.key, image_status: "review", image_source: outcome.source, updated_at: now })
        out.review++
      } else {
        await doc.ref.update({ image_status: "none", updated_at: now })
        out.none++
      }
    } catch (e) {
      logError("[import-images] update " + doc.id, e)
    }
  }
  return out
}
