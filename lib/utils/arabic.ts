// تطبيع النص العربي للبحث المحلي (داخل المتجر). ملف نقي بلا "use server" — تستورده مكوّنات العميل.
//
// لماذا: أسماء المنتجات مكتوبة بصيغ متعدّدة (استيراد Excel من كاشيرات مختلفة + إدخال يدوي)، فنفس
// الصنف قد يُكتب «باراسيتامول» و«براسيتامول»، و«ادوية» و«أدوية»، و«شاي أحمر» بتشكيل أو بتطويل.
// مقارنة نصية خام تُفشل بحث العميل داخل متجر فيه آلاف الأصناف، فيظن أن الصنف غير موجود.
//
// التطبيع مقصود أن يكون *فضفاضًا في اتجاه واحد*: يوسّع المطابقة ولا يضيّقها أبدًا.

// المحارف التي تُوحَّد: ألف بكل صورها، ياء/ألف مقصورة، تاء مربوطة/هاء، واو بهمزة، همزة على نبرة.
const CHAR_MAP: Record<string, string> = {
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "آ": "ا", // آ → ا
  "ٱ": "ا", // ٱ → ا
  "ى": "ي", // ى → ي
  "ة": "ه", // ة → ه
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
}

// التشكيل + التطويل: يُحذفان تمامًا (لا يحملان معنى في البحث).
const DIACRITICS = /[ً-ْٰـ]/g

// الأرقام العربية-الهندية (٠-٩) والفارسية (۰-۹) → أرقام لاتينية، كي يجد «شريط 20» مَن كتب «شريط ٢٠».
const ARABIC_INDIC_START = 0x0660
const EXTENDED_ARABIC_INDIC_START = 0x06f0

/**
 * يُرجع صيغة قابلة للمقارنة من أي نص: حروف صغيرة، بلا تشكيل/تطويل، بألف/ياء/هاء موحّدة،
 * بأرقام لاتينية، وبمسافات مضغوطة. آمن على النص الإنجليزي (يمرّ كما هو بعد التصغير).
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

  return out.replace(DIACRITICS, "").toLowerCase().replace(/\s+/g, " ").trim()
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

/** يقسّم استعلام المستخدم إلى كلمات مطبَّعة (يتجاهل الفراغات الزائدة). */
export function searchTokens(query: string): string[] {
  return normalizeArabic(query).split(" ").filter(Boolean)
}
