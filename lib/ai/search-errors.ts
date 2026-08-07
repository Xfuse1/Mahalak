// رموز أخطاء البحث الذكي — ملف **نقي** بلا `"use server"` وبلا I/O، يستورده السيرفر والعميل معًا.
//
// لماذا ملف مستقلّ لا ثابت داخل [lib/actions/ai-search.ts]: ملف `"use server"` لا يجوز أن يُصدِّر
// إلا دوالّ async — تصديرُ كائنٍ منه **يكسر البناء** (خطأ مُجمِّع لا خطأ أنواع، فلا `tsc --noEmit`
// ولا `npm test` يمسكه). والريبو يعرّف نظائره داخل ملفات الأفعال **بلا `export`** أصلًا
// (`POS_FEATURE_ERROR` في pos-features.ts، `PRODUCT_ERROR_CODES` في products.ts) لأن مستهلكها
// هناك هو الملف نفسه. أما هذه فتقرؤها الواجهة لتفرّع على الرمز، فتحتاج بيتًا محايدًا.
//
// والواجهة تتفرّع على **الرمز لا على النصّ**: تغيير رسالة عربية معروضة لا يجوز أن يكسر منطقًا.

export const AI_SEARCH_ERROR = {
  DISABLED: "disabled",
  UNAUTHENTICATED: "unauthenticated",
  RATE_LIMITED: "rate_limited",
  QUOTA: "quota",
  RED_FLAG: "red_flag",
  SYMPTOM_LOCKED: "symptom_locked",
  NO_INTENT: "no_intent",
  SERVER: "server_error",
} as const

export type AiSearchErrorCode = (typeof AI_SEARCH_ERROR)[keyof typeof AI_SEARCH_ERROR]
