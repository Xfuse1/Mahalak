// تطبيع النص العربي للبحث المحلي (داخل المتجر). ملف نقي بلا "use server" — تستورده مكوّنات العميل.
//
// لماذا: أسماء المنتجات مكتوبة بصيغ متعدّدة (استيراد Excel من كاشيرات مختلفة + إدخال يدوي)، فنفس
// الصنف قد يُكتب «باراسيتامول» و«براسيتامول»، و«ادوية» و«أدوية»، و«شاي أحمر» بتشكيل أو بتطويل.
// مقارنة نصية خام تُفشل بحث العميل داخل متجر فيه آلاف الأصناف، فيظن أن الصنف غير موجود.
//
// التطبيع مقصود أن يكون *فضفاضًا في اتجاه واحد*: يوسّع المطابقة ولا يضيّقها أبدًا.

// المحارف التي تُوحَّد: ألف بكل صورها، ياء/ألف مقصورة، تاء مربوطة/هاء، واو بهمزة، همزة على نبرة.
//
// والحروف الفارسية/الأردية معها: ملفات الكاشير وصفحات الموردين تُدخلها بالنسخ واللصق، والكاف
// والياء الفارسيتان (U+06A9 / U+06CC) متطابقتان بصريًّا مع العربيتين ⇒ عطل يستحيل على التاجر أو
// العميل تشخيصه: «کريم» المكتوبة بكاف فارسية لا تطابق «كريم» أبدًا.
const CHAR_MAP: Record<string, string> = {
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "آ": "ا", // آ → ا
  "ٱ": "ا", // ٱ → ا
  "ى": "ي", // ى → ي
  "ة": "ه", // ة → ه
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
  // فارسية/أردية → أقرب حرف عربي
  "ک": "ك", // كاف فارسية U+06A9 — متطابقة بصريًّا مع ك
  "ی": "ي", // ياء فارسية U+06CC — متطابقة بصريًّا مع ي
  "ھ": "ه", // هاء أردية U+06BE
  "ە": "ه", // هاء كردية U+06D5
  "پ": "ب", // پ → ب (ڤولتارين/بولتارين)
  "ڤ": "ف", // ڤ → ف (ڤولتارين ← فولتارين)
  "ڨ": "ف", // ڨ → ف
  "چ": "ج", // چ → ج
  "گ": "ج", // گ → ج
  "ژ": "ز", // ژ → ز
  "ٹ": "ت", // ٹ → ت
  "ڈ": "د", // ڈ → د
  "ڑ": "ر", // ڑ → ر
}

// التشكيل + التطويل: يُحذفان تمامًا (لا يحملان معنى في البحث).
//
// النطاق موسَّع عن السابق `[ً-ْٰـ]` لأنه كان يترك علامات تنجو فعليًّا: U+0610–U+061A (علامات
// الصلاة والوقف) و U+0656 و U+06D6–U+06ED (علامات المصحف). التحقّق كان بالتشغيل لا بالقراءة.
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

// محارف تحكّم غير مرئية تحقنها ملفات Excel والكاشير العربية وصفحات الويب المنسوخة.
//
// هذه أخطر ما في الملف: `NFKC` لا يحذفها، و`\s` لا يطابقها، فتنجو حتى نهاية التطبيع. وحين تقع
// *وسط* الكلمة — وهو ما تفعله محرّرات ثنائية الاتجاه — تصير «بنا‏دول» نصًّا لا يطابق «بنادول»
// إطلاقًا، والعميل يرى صفر نتائج بلا سبب مفهوم ولا وسيلة تشخيص.
const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g

// الأرقام العربية-الهندية (٠-٩) والفارسية (۰-۹) → أرقام لاتينية، كي يجد «شريط 20» مَن كتب «شريط ٢٠».
const ARABIC_INDIC_START = 0x0660
const EXTENDED_ARABIC_INDIC_START = 0x06f0

// حدود الكلمات: أي شيء ليس حرفًا ولا رقمًا. المُقسِّم السابق كان يقسم على المسافة وحدها، فكان
// «بنادول،اكسترا» رمزًا واحدًا لا وجود له في أي منتج ⇒ صفر نتائج.
//
// ملاحظة توافق: `\p{L}` و`\p{N}` مدعومان منذ iOS Safari 11.3 فهما آمنان، لكن lookbehind لم يصل
// إلا في 16.4 ويرمي SyntaxError وقت تحليل الموديول (أي يُسقط الصفحة كلها) ⇒ فصل حدود الرقم عن
// الحرف يتمّ بـ`replace` لا بـ`split` بـlookbehind.
const NON_WORD = /[^\p{L}\p{N}]+/u
const DIGIT_THEN_LETTER = /(\p{N})(\p{L})/gu
const LETTER_THEN_DIGIT = /(\p{L})(\p{N})/gu

// سوابق التعريف، الأطول أولًا كي لا تبتلع «ال» ما بعدها فتترك «وال» بلا معالجة.
const AL_PREFIXES = ["وال", "بال", "كال", "فال", "لل", "ال"]

// أقصر جذع مقبول بعد تجريد التعريف. دونه يصير التجريد تخريبًا: «الف» ⇒ «ف»، «الم» ⇒ «م».
const MIN_STEM_LENGTH = 3

/**
 * يُرجع صيغة قابلة للمقارنة من أي نص: حروف صغيرة، بلا تشكيل/تطويل، بلا محارف تحكّم غير مرئية،
 * بألف/ياء/هاء موحّدة، بحروف فارسية معرَّبة، بأرقام لاتينية، وبمسافات مضغوطة.
 * آمن على النص الإنجليزي (يمرّ كما هو بعد التصغير).
 */
export function normalizeArabic(input: unknown): string {
  if (typeof input !== "string" || !input) return ""

  let out = ""
  for (const ch of input.normalize("NFKC")) {
    const code = ch.codePointAt(0)!
    if (code >= ARABIC_INDIC_START && code <= ARABIC_INDIC_START + 9) {
      out += String(code - ARABIC_INDIC_START)
      continue
    }
    if (code >= EXTENDED_ARABIC_INDIC_START && code <= EXTENDED_ARABIC_INDIC_START + 9) {
      out += String(code - EXTENDED_ARABIC_INDIC_START)
      continue
    }
    out += CHAR_MAP[ch] ?? ch
  }

  return out
    .replace(INVISIBLE, "")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * يجرّد أداة التعريف من أول الكلمة بشرط أن يبقى جذع ذو معنى.
 * «الشاي» ⇒ «شاي» كي يجدها مَن خزّن «شاي ليبتون»، بينما «الف» و«علاج» تمرّان بلا مساس.
 */
export function stripAl(token: string): string {
  for (const prefix of AL_PREFIXES) {
    if (token.startsWith(prefix) && token.length - prefix.length >= MIN_STEM_LENGTH) {
      return token.slice(prefix.length)
    }
  }
  return token
}

/**
 * يقسّم نصًّا مطبَّعًا إلى كلمات على أي حدّ غير أبجدي-رقمي، ويفصل الرقم عن الحرف.
 * «بنادول،اكسترا» ⇒ ["بنادول","اكسترا"] و«500mg» ⇒ ["500","mg"] كي يجدها مَن كتب «500 مج».
 */
export function splitSearchTokens(text: unknown): string[] {
  const normalized = normalizeArabic(text)
  if (!normalized) return []
  return normalized
    .replace(DIGIT_THEN_LETTER, "$1 $2")
    .replace(LETTER_THEN_DIGIT, "$1 $2")
    .split(NON_WORD)
    .filter(Boolean)
}

/**
 * مطابقة بحث: هل يحتوي `haystack` على كل كلمات `query` (بأي ترتيب) بعد التطبيع؟
 * الترتيب الحرّ مقصود: العميل يكتب «شاي ليبتون» والمنتج مخزَّن «ليبتون شاي أحمر 100 فتلة».
 */
export function matchesSearch(haystack: string, normalizedQueryTokens: string[]): boolean {
  if (normalizedQueryTokens.length === 0) return true
  const target = normalizeArabic(haystack)
  if (!target) return false
  return normalizedQueryTokens.every((token) => target.includes(token))
}

/**
 * يقسّم استعلام المستخدم إلى كلمات مطبَّعة مجرّدة من أداة التعريف.
 *
 * تجريد «ال» على الاستعلام وحده توسيعٌ محضٌ للاسترجاع مع دلالة `includes`: «الشاي» ⇒ «شاي»
 * تطابق «شاي ليبتون» **و** «الشاي الأحمر» معًا، فلا تضيق المطابقة في أي حال.
 */
export function searchTokens(query: string): string[] {
  return splitSearchTokens(query).map(stripAl).filter(Boolean)
}
