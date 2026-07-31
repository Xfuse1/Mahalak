// عميل Gemini خفيف (سيرفر فقط) — أفضل-جهد، لا يرمي أبدًا. المفتاح من env؛ عند غيابه أو أي خطأ
// (429 حصة/شبكة/تحليل) يعود null فيسقط المُستدعي للمنطق الاستدلالي. لا يُستورَد من كود العميل.
//
// ملاحظة: المالك سيوفّر لاحقًا "طريقة معالجة مفاتيح جوجل" (تدوير مفاتيح مجانية لتجاوز حدّ الحصة).
// getGeminiKey هي نقطة التوصيل — عدّلها عندها؛ باقي الكود لا يتغيّر.
import { logError } from "@/lib/logger"
import { buildColumnMapPrompt, parseColumnMap, type ColumnMap } from "./column-map"

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
// الـprompt والتحقّق في column-map.ts المشترك (مصدر واحد مع المزوّد OpenAI-compatible).
export async function geminiMapColumns(
  headers: { index: number; label: string }[],
  sampleRows: string[][],
): Promise<ColumnMap | null> {
  if (!isGeminiEnabled() || !headers.length) return null
  const out = await geminiJSON(buildColumnMapPrompt(headers, sampleRows))
  return parseColumnMap(out, headers)
}
