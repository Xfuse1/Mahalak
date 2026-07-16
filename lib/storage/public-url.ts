/**
 * محوِّل قيم التخزين → رابط قابل للعرض.
 *
 * العقد: Firestore يخزّن **مسارًا** (مثل `products/<uid>/x.jpg`) وليس رابطًا مطلقًا.
 * الرابط الكامل يُركَّب هنا وقت العرض من قاعدة واحدة. أي نقلة تخزين مستقبلية =
 * تغيير `NEXT_PUBLIC_R2_PUBLIC_BASE` فقط — بلا إعادة كتابة للبيانات.
 *
 * هذا الملف **ليس** "use server": مكوّنات العميل تستورده. يجب أن يبقى نقيًا ومتزامنًا.
 *
 * خصائص إلزامية (كسر أي منها يُسقِط صورًا على الإنتاج):
 *  1. **ثنائي الاتجاه بشكل دائم** — القيم المطلقة القديمة تُمرَّر كما هي. ليست طبقة مؤقتة:
 *     سلال التسوّق في localStorage تحمل روابط Supabase مطلقة في متصفحات حقيقية الآن،
 *     ولا يصلها أي backfill. لا تجعل هذا صارمًا أبدًا.
 *  2. **تمرير data:/blob:** — معاينات الرفع (FileReader/URL.createObjectURL) تمرّ من هنا.
 *  3. **تمرير المسارات المطلقة المحلية (/)** — مثل /placeholder.svg.
 *  4. **مُتماثل (idempotent)** — آمن للتطبيق في طبقة القراءة وطبقة العرض معًا.
 */

// قاعدة العرض العام (نطاق R2 المخصص). غير مضبوطة = لم نُفعّل R2 بعد.
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE || "").replace(/\/+$/, "")

/** القيمة جاهزة للعرض كما هي؟ (رابط مطلق قديم / معاينة / أصل محلي) */
function isRenderable(v: string): boolean {
  return /^(https?:\/\/|data:|blob:|\/)/i.test(v)
}

/**
 * يحوّل قيمة تخزين مُخزَّنة إلى رابط قابل للعرض، أو null إن تعذّر.
 * - رابط مطلق/معاينة/أصل محلي → كما هو (تمرير).
 * - مسار + قاعدة مضبوطة → رابط كامل.
 * - مسار + قاعدة غير مضبوطة → null (يتحوّل إلى placeholder عبر imgSrc) بدل رابط مكسور.
 */
export function storageUrl(value?: string | null): string | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (!v) return null
  if (isRenderable(v)) return v
  if (!PUBLIC_BASE) return null
  return `${PUBLIC_BASE}/${v.replace(/^\/+/, "")}`
}

/** نفس storageUrl لكن يعيد الصورة البديلة بدل null — للاستخدام المباشر في src. */
export function imgSrc(value?: string | null, fallback = "/placeholder.svg"): string {
  return storageUrl(value) || fallback
}
