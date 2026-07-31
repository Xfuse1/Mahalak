// المنطق المشترك لمطابقة أعمدة الاستيراد عبر مزوّدي الـAI (Gemini / OpenAI-compatible) — مصدر واحد
// للـprompt والتحقّق كي لا يفترق السلوك بين المزوّدين. موديول محايد (بلا "use server")، لا يرمي.

export const AI_FIELDS = ["name", "price", "cost_price", "stock", "category", "brand", "unit", "sku", "barcode"] as const

export type ColumnMap = Partial<Record<(typeof AI_FIELDS)[number], number>>

// نصّ الـprompt الموحّد: نمرّر العناوين وصفوف العيّنة كما هي (بترتيب رقم العمود) ونطلب أرقام الأعمدة.
export function buildColumnMapPrompt(
  headers: { index: number; label: string }[],
  sampleRows: string[][],
): string {
  const headerList = headers.map((h) => `${h.index}: "${h.label}"`).join("\n")
  const samples = sampleRows.slice(0, 5).map((r) => JSON.stringify(r)).join("\n")
  return (
    `أنت تساعد في استيراد كتالوج منتجات من ملف تصدير برنامج كاشير.\n` +
    `فيما يلي أعمدة الملف (رقم_العمود: "العنوان") وبعض صفوف العيّنة (مصفوفات بترتيب رقم العمود).\n` +
    `حدّد أي رقم عمود يقابل كل حقل. القواعد المهمة:\n` +
    `- price = سعر بيع الوحدة للعميل (النهائي)، وليس التكلفة ولا سعر الشراء ولا "الإجمالى" (سعر×كمية).\n` +
    `- cost_price = تكلفة/سعر شراء الوحدة.\n` +
    `- stock = الكمية/الرصيد المتاح، وليس أي قيمة مالية.\n` +
    `أرجِع JSON فقط بهذا الشكل، بأرقام الأعمدة أو null لكل حقل غير موجود:\n` +
    `{"name":n,"price":n,"cost_price":n,"stock":n,"category":n,"brand":n,"unit":n,"sku":n,"barcode":n}\n\n` +
    `الأعمدة:\n${headerList}\n\nصفوف عيّنة:\n${samples}`
  )
}

// يتحقّق من مخرجات الموديل: كائن، لكل حقل قيمة رقم صحيح ≥0 ضمن أعمدة صالحة. يرجّع الخريطة أو null لو فاضية.
export function parseColumnMap(
  out: unknown,
  headers: { index: number; label: string }[],
): ColumnMap | null {
  if (!out || typeof out !== "object") return null
  const o = out as Record<string, unknown>
  const map: ColumnMap = {}
  const validCols = new Set(headers.map((h) => h.index))
  for (const f of AI_FIELDS) {
    const v = o[f]
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && validCols.has(v)) map[f] = v
  }
  return Object.keys(map).length ? map : null
}
