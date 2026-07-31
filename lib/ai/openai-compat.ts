// عميل OpenAI-compatible خفيف (سيرفر فقط) — أفضل-جهد، لا يرمي أبدًا. المفتاح من env؛ عند غيابه أو
// أي خطأ (429 حصة/شبكة/تحليل) يعود null فيسقط المُستدعي لما بعده (Gemini ثم الاستدلال).
// لا يُستورَد من كود العميل. الافتراضي: NVIDIA API catalog (موديل glm-5.2) عبر /chat/completions.
import { logError } from "@/lib/logger"
import { buildColumnMapPrompt, parseColumnMap, type ColumnMap } from "./column-map"

const BASE = (process.env.IMPORT_AI_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "")
const MODEL = process.env.IMPORT_AI_MODEL || "z-ai/glm-5.2"

function getKey(): string | null {
  return process.env.IMPORT_AI_API_KEY || null
}

export function isOpenAICompatEnabled(): boolean {
  return !!getKey()
}

// يطلب ردًّا JSON من واجهة OpenAI Chat Completions. يعود null عند أي فشل.
export async function openAICompatJSON(prompt: string, timeoutMs = 15000): Promise<unknown | null> {
  const key = getKey()
  if (!key) return null
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      // 429 = حصة، 4xx/5xx = مؤقت — كلها تسقط بلا ضجيج مفرط.
      if (res.status !== 429) logError("[openai-compat] http " + res.status, (await res.text().catch(() => "")).slice(0, 200))
      return null
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> }
    const raw = data?.choices?.[0]?.message?.content
    if (typeof raw !== "string" || !raw) return null
    // قشط أسوار Markdown دفاعًا: بعض الموديلات تُغلّف JSON بـ```json ... ``` رغم response_format.
    let text: string = raw.trim()
    const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(text)
    if (fence) text = fence[1].trim()
    return JSON.parse(text)
  } catch (e) {
    logError("[openai-compat] request", e)
    return null
  }
}

// يقترح مطابقة الأعمدة من العناوين + صفوف عيّنة. يعود {field: colIndex} أو null.
// نفس توقيع geminiMapColumns بالضبط؛ الـprompt والتحقّق من column-map.ts المشترك.
export async function mapColumnsOpenAICompat(
  headers: { index: number; label: string }[],
  sampleRows: string[][],
): Promise<ColumnMap | null> {
  if (!isOpenAICompatEnabled() || !headers.length) return null
  const out = await openAICompatJSON(buildColumnMapPrompt(headers, sampleRows))
  return parseColumnMap(out, headers)
}
