// سجل أخطاء دائم على Firestore (سيرفر فقط) — يجعل الأعطال الحرجة مرئية بدل ضياعها في لوجات
// المنصّة المؤقتة. لا يُستورَد أبدًا من مكوّنات العميل (يستخدم Admin SDK). أفضل-جهد: لا يرمي أبدًا،
// حتى لا يتسبّب تسجيل الخطأ نفسه في عطل. المجموعة error_logs يقرأها الأدمن فقط (قواعد isAdmin).
import { getAdminDb } from "./firebase/admin"

export async function logServerError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

  // اطبع دائمًا (تشخيص فوري في لوجات المنصّة أثناء التطوير/الإنتاج)
  console.error(`[${source}]`, message, context ?? "")

  try {
    const db = getAdminDb()
    let safeContext: Record<string, unknown> | null = null
    if (context) {
      try {
        safeContext = JSON.parse(JSON.stringify(context)) as Record<string, unknown>
      } catch {
        safeContext = null
      }
    }

    await db.collection("error_logs").add({
      source,
      message: String(message).slice(0, 2000),
      stack: error instanceof Error && error.stack ? error.stack.slice(0, 4000) : null,
      context: safeContext,
      created_at: new Date().toISOString(),
    })
  } catch {
    // لا نرمي أبدًا من طبقة تسجيل الأخطاء (تجنّب حلقات فشل)
  }
}
