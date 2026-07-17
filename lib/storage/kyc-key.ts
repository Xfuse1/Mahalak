/**
 * مدقّق شكل مفتاح KYC — نقي ومتزامن.
 *
 * دفاع في العمق حول signKycFields: تلك الدالة كانت توقّع **أي** قيمة لا تبدأ بـ"http"،
 * أي أنها كانت أوراكل توقيع لأي مسار في الـbucket الخاص. هذا المدقّق يقصر التوقيع على ما
 * يشبه مستند KYC فعليًا، فيمنع توقيع كائنات خاصة أخرى، ومسارات الاجتياز، وتوجيه حقل KYC
 * إلى كائن ليس KYC.
 *
 * حدّ مقصود: هذا يتحقق من **الشكل** لا من **الملكية**. مفتاح KYC صحيح الشكل لبائع آخر
 * (لو عُرف مساره العشوائي) ما زال يجتاز هذا الفحص — إغلاق ذلك يتطلب حصر المفاتيح بـuid
 * المالك، وهو إعادة تصميم لمسار التسجيل، لا فحص شكل. راجع [[storage-migration]].
 */

// البادئات الخمس التي يرفعها التسجيل (app/auth/seller/register/page.tsx:412-416)،
// وقيمة "logo" مستبعدة عمدًا: الشعار عام ولا يُوقَّع أبدًا.
const KYC_DOC_SEGMENTS = ["id-card-front", "id-card-back", "commercial-register", "tax-card-front", "tax-card-back"]

// registrations/<id>/<doc-segment>/<file>.<ext>  أو  stores/<id>/<doc-segment>/<file>.<ext>
// <id> و<file>: أحرف/أرقام/شرطات فقط (لا "/" ولا ".." ولا مسافات). الامتداد صورة.
const KYC_KEY = new RegExp(
  `^(registrations|stores)/[A-Za-z0-9._-]+/(${KYC_DOC_SEGMENTS.join("|")})/[A-Za-z0-9._-]+\\.(jpe?g|png|gif|webp)$`,
  "i",
)

/** هل السلسلة مفتاح تخزين يشبه مستند KYC صحيح الشكل؟ (شكل لا ملكية) */
export function isKycKey(value: unknown): boolean {
  if (typeof value !== "string") return false
  const v = value.trim()
  if (!v || v.includes("..") || v.startsWith("/")) return false
  return KYC_KEY.test(v)
}
