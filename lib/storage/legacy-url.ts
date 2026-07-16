/**
 * مُحلِّل الروابط القديمة: رابط Supabase عام مطلق → مفتاح التخزين (المسار).
 *
 * مستهلكان اثنان يتشاركان هذا المحلِّل عمدًا — منطق واحد، مجموعة اختبارات واحدة:
 *  1. أداة الترحيل سيرفر‑سايد (تعيد كتابة حقول Firestore مرة واحدة أخيرة).
 *  2. ترحيل سلة التسوّق في localStorage (لا يصلها أي backfill — تعيش في متصفح المستخدم).
 *
 * **صارم عمدًا**: ما لا يطابق الشكل المتوقَّع بالضبط يُعيد null، والمستدعي يترك القيمة
 * كما هي. التخمين هنا يعني صورًا مكسورة على الإنتاج؛ ترك القيمة يعني أنها تبقى تعمل
 * عبر التمرير في storageUrl. الفشل الآمن هو "لا تلمس".
 *
 * الشكل المتوقَّع:
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<key...>
 *                                                              ^^^^^^^^ هذا ما نريده
 */

const SUPABASE_PUBLIC_OBJECT =
  /^https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/([^/?#]+)\/(.+)$/i

export type LegacyRef = { bucket: string; key: string }

/** يفكّك رابط Supabase عام إلى { bucket, key }، أو null إن لم يطابق الشكل بالضبط. */
export function parseLegacySupabaseUrl(value: unknown): LegacyRef | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (!v) return null

  const m = v.match(SUPABASE_PUBLIC_OBJECT)
  if (!m) return null

  const bucket = m[1]
  // نزيل أي query/hash (رموز كاش مثل ?t=...) ثم نفكّ ترميز النسبة المئوية للمسافات/العربية.
  const rawKey = m[2].split("#")[0].split("?")[0]
  if (!rawKey) return null

  let key: string
  try {
    key = decodeURIComponent(rawKey)
  } catch {
    // ترميز تالف — لا نخمّن.
    return null
  }

  // حارس اجتياز المسار: مفتاح يهرب من البادئة يُرفض بدل أن يُكتب في قاعدة البيانات.
  if (key.includes("..") || key.startsWith("/")) return null

  return { bucket, key }
}

/**
 * يحوّل رابطًا قديمًا إلى مساره إن كان من الـbucket المتوقَّع، وإلا null.
 * تمرير الـbucket المتوقَّع يمنع سحب كائنات من bucket خاص إلى حقلٍ عام عن طريق الخطأ.
 */
export function legacyUrlToKey(value: unknown, expectedBucket = "product-images"): string | null {
  const ref = parseLegacySupabaseUrl(value)
  if (!ref) return null
  if (ref.bucket !== expectedBucket) return null
  return ref.key
}
