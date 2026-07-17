/**
 * تعريف الأدوار — نقي ومتزامن، بلا أي استيراد سيرفري.
 *
 * منفصل عن session.ts عمدًا: ذاك يستورد firebase-admin و next/headers فلا يمكن لمكوّن
 * عميل أن يلمسه. لكن "مَن يُعدّ أدمن؟" سؤال واحد يجب أن تكون له إجابة واحدة — نسخة
 * للسيرفر وأخرى للواجهة تعني أنهما ستفترقان يومًا، وحينها تُخفي الواجهة زرًّا يسمح به
 * السيرفر أو العكس. session.ts يُعيد تصدير هذه الدوال، فالمصدر واحد للطرفين.
 *
 * الاستخدام في العميل للعرض فقط. الإنفاذ الحقيقي سيرفر-سايد (حارس app/admin/layout.tsx
 * + ensureAdmin في كل أكشن)، لأن أي شيء يصل العميل قابل للتزوير.
 */

/** هل الدور يمنح الوصول للوحة الإدارة؟ (admin أو superAdmin) — غير حسّاس لحالة الأحرف. */
export function hasAdminAccess(role: unknown): boolean {
  const r = String(role || "").toLowerCase()
  return r === "admin" || r === "superadmin" || r === "super_admin"
}

/** هل الدور superAdmin تحديدًا؟ — غير حسّاس لحالة الأحرف (superAdmin / super_admin). */
export function hasSuperAdminAccess(role: unknown): boolean {
  const r = String(role || "").toLowerCase()
  return r === "superadmin" || r === "super_admin"
}
