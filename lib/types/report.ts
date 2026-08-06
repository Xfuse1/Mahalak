// أنواع وثوابت البلاغ عن المحتوى — وحدة نقية بلا "use server" عمدًا.
// ملفات lib/actions/* تحمل "use server"، و Next.js لا يسمح بتصدير أي شيء غير دالة async منها،
// فثابت مثل REPORT_REASONS يكسر البناء لو عاش هناك. الواجهة (زرّ الإبلاغ) تستورده من هنا.

/** أسباب البلاغ — قائمة سماح مغلقة تُستخدم للتحقق سيرفر-سايد ولبناء عنوان التذكرة. */
export const REPORT_REASONS = {
  counterfeit: "منتج مقلّد أو غير أصلي",
  prohibited: "منتج ممنوع أو غير قانوني",
  offensive: "محتوى مسيء أو غير لائق",
  misleading: "وصف أو صور مضلِّلة",
  spam: "محتوى مكرر أو سبام",
  other: "سبب آخر",
} as const

export type ReportReason = keyof typeof REPORT_REASONS

export const REPORTABLE_TYPES = ["product", "store", "driver", "order"] as const
export type ReportableType = (typeof REPORTABLE_TYPES)[number]
