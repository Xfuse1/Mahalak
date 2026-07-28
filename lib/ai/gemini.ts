// عميل Gemini خفيف (سيرفر فقط) — أفضل-جهد، لا يرمي أبدًا. المفتاح من env؛ عند غيابه أو أي خطأ
// (429 حصة/شبكة/تحليل) يعود null فيسقط المُستدعي للمنطق الاستدلالي. لا يُستورَد من كود العميل.
//
// ملاحظة: المالك سيوفّر لاحقًا "طريقة معالجة مفاتيح جوجل" (تدوير مفاتيح مجانية لتجاوز حدّ الحصة).
// getGeminiKey هي نقطة التوصيل — عدّلها عندها؛ باقي الكود لا يتغيّر.
import { logError } from "@/lib/logger"

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"

function getGeminiKey(): string | null {
  return process.env.GEMINI_API_KEY || null
}

export function isGeminiEnabled(): boolean {
  return !!getGeminiKey()
}

// يطلب من Gemini ردًّا JSON. يعود null عند أي فشل.
export async function geminiJSON(prompt: string, timeoutMs = 15000): Promise<unknown | null> {
  const key = getGeminiKey()
  if (!key) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        // المفتاح في ترويسة x-goog-api-key لا في الـURL (المفاتيح في الروابط تتسرّب لسجلّات البروكسي).
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    )
    if (!res.ok) {
      // 429 = حصة، 4xx/5xx = مؤقت — كلها تسقط للاستدلال بلا ضجيج مفرط.
      if (res.status !== 429) logError("[gemini] http " + res.status, await res.text().catch(() => ""))
      return null
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    return JSON.parse(text)
  } catch (e) {
    logError("[gemini] request", e)
    return null
  }
}

// يقترح مطابقة الأعمدة من العناوين + صفوف عيّنة. يعود {field: colIndex} أو null.
// نمرّر العناوين وصفوف العيّنة كما هي (بترتيب رقم العمود) ونطلب أرقام الأعمدة.
const AI_FIELDS = ["name", "price", "cost_price", "stock", "category", "brand", "unit", "sku", "barcode"] as const

export async function geminiMapColumns(
  headers: { index: number; label: string }[],
  sampleRows: string[][],
): Promise<Partial<Record<(typeof AI_FIELDS)[number], number>> | null> {
  if (!isGeminiEnabled() || !headers.length) return null
  const headerList = headers.map((h) => `${h.index}: "${h.label}"`).join("\n")
  const samples = sampleRows.slice(0, 5).map((r) => JSON.stringify(r)).join("\n")
  const prompt =
    `أنت تساعد في استيراد كتالوج منتجات من ملف تصدير برنامج كاشير.\n` +
    `فيما يلي أعمدة الملف (رقم_العمود: "العنوان") وبعض صفوف العيّنة (مصفوفات بترتيب رقم العمود).\n` +
    `حدّد أي رقم عمود يقابل كل حقل. القواعد المهمة:\n` +
    `- price = سعر بيع الوحدة للعميل (النهائي)، وليس التكلفة ولا سعر الشراء ولا "الإجمالى" (سعر×كمية).\n` +
    `- cost_price = تكلفة/سعر شراء الوحدة.\n` +
    `- stock = الكمية/الرصيد المتاح، وليس أي قيمة مالية.\n` +
    `أرجِع JSON فقط بهذا الشكل، بأرقام الأعمدة أو null لكل حقل غير موجود:\n` +
    `{"name":n,"price":n,"cost_price":n,"stock":n,"category":n,"brand":n,"unit":n,"sku":n,"barcode":n}\n\n` +
    `الأعمدة:\n${headerList}\n\nصفوف عيّنة:\n${samples}`
  const out = await geminiJSON(prompt)
  if (!out || typeof out !== "object") return null
  const o = out as Record<string, unknown>
  const map: Partial<Record<(typeof AI_FIELDS)[number], number>> = {}
  const validCols = new Set(headers.map((h) => h.index))
  for (const f of AI_FIELDS) {
    const v = o[f]
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && validCols.has(v)) map[f] = v
  }
  return Object.keys(map).length ? map : null
}
