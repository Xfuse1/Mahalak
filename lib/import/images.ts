// مصادر صور المنتجات لخطّ استيراد الكتالوج (المرحلة 2). سيرفر فقط، أفضل-جهد، لا يرمي.
//  - بالباركود: Open Food Facts (مجاني، صور بترخيص مفتوح CC) — يُطبَّق تلقائيًّا.
//  - بالاسم: نقطة توصيل قابلة للضبط (searchImageByName) — معطّلة حتى يوفّر المالك مزوّد بحث الصور
//    (مفاتيح جوجل). نتائج البحث تحتاج مراجعة التاجر (حقوق الملكية) فتُحفظ كمرشَّح لا كصورة نهائية.
// الصور تُنزَّل وتُعاد استضافتها على R2 (تحكّم + ثبات) وتُخزَّن كـ«مفتاح».
import { randomUUID } from "node:crypto"
import { lookup } from "node:dns/promises"
import { putObject } from "@/lib/storage/r2"
import { getAdminDb } from "@/lib/firebase/admin"
import { logError } from "@/lib/logger"

const MAX_IMG_BYTES = 5 * 1024 * 1024
const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }

// عنوان خاص/محلي؟ (IPv4: 0.x، 10.x، 127.x، 169.254.x، 172.16–31.x، 192.168.x، 100.64–127.x —
// IPv6: ::1، ::، fe80:، fc/fd، والمعيّنة ::ffff:… بصيغتيها النقطية والسداسية نفحص جزءها الـIPv4).
function isPrivateIp(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    // يبدو IPv4 لكن أوكتته خارج النطاق: نعتبره غير آمن (مقفول عند الشك) بدل السماح به.
    if (a > 255 || b > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) return true
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }
  const v6 = ip.toLowerCase()
  if (v6 === "::1" || v6 === "::") return true
  if (v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd")) return true
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6)
  if (mapped) return isPrivateIp(mapped[1])
  // الصيغة السداسية ::ffff:HHHH:HHHH (كل هكستيت 1–4 خانات hex = 16 بتًا من الـIPv4؛ «1» تعني 0x0001).
  // تصل من مسار DNS المُحلَّل (lookup قد يعيد عنوانًا معيّنًا من سجل AAAA). مثال: 7f00:1 = 127.0.0.1.
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6)
  if (mappedHex) {
    const h1 = parseInt(mappedHex[1], 16)
    const h2 = parseInt(mappedHex[2], 16)
    return isPrivateIp(`${(h1 >> 8) & 255}.${h1 & 255}.${(h2 >> 8) & 255}.${h2 & 255}`)
  }
  return false
}

// يقبل فقط روابط http/https العامة: يرفض localhost وأي host يُحلّ (حرفيًّا أو عبر DNS) لعنوان
// خاص/محلي، ويرفض عند فشل التحليل (مقفول عند الشك). حماية SSRF لما يصير الرابط متأثّرًا بالتاجر.
async function isSafePublicUrl(u: string): Promise<boolean> {
  let url: URL
  try {
    url = new URL(u)
  } catch {
    return false
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost")) return false
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host
  // عنوان IPv4 نقطي حرفي: فحص مباشر بلا DNS.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return !isPrivateIp(bare)
  // أي IPv6 حرفي يُرفض قاطعًا: محلّل URL يحوّل ::ffff:a.b.c.d النقطية إلى سداسية (::ffff:7f00:1)
  // فيفوت فحص الصيغة النقطية، وروابط الصور المشروعة تستخدم أسماء مضيفات لا IPv6 حرفيًّا إطلاقًا.
  if (bare.includes(":")) return false
  try {
    const addrs = await lookup(host, { all: true })
    if (!addrs.length) return false
    return addrs.every((a) => !isPrivateIp(a.address))
  } catch {
    return false
  }
}

// يستنتج امتداد الصورة من أوائل البايتات (توقيع الملف) لا من ترويسة الخادم التي قد يزيّفها المصدر.
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png"
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg"
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif" // "GIF8"
  if (buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // "RIFF"
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp" // "WEBP"
  return null
}

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
  if (!(await isSafePublicUrl(sourceUrl))) return null // SSRF: نرفض العناوين الداخلية/المحلية
  try {
    // redirect: "error" كي لا تتخطّى إعادةُ توجيه إلى host داخلي فحصَ isSafePublicUrl.
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMs), redirect: "error" })
    if (!res.ok) return null
    const len = Number(res.headers.get("content-length") || 0)
    if (len && len > MAX_IMG_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_IMG_BYTES || buf.byteLength < 100) return null
    // النوع يُستنتج من توقيع البايتات لا من ترويسة content-type (قد يعلن المصدر image/png لجسم ليس صورة).
    const ext = sniffImageExt(buf)
    if (!ext) return null // ليست صورة معروفة
    const key = `products/${storeId}/imp-${randomUUID()}.${ext}`
    await putObject("public", key, buf, TYPE_BY_EXT[ext])
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
