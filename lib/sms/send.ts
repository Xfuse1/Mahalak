import { logError } from "@/lib/logger"

// مُرسِل SMS قابل للتوصيل بأي مزوّد لاحقًا (القرار مفتوح: بوابة مصرية محلية / Twilio / Vonage…).
// كل مزوّد = فرع واحد يُضاف في switch أدناه؛ لا شيء في بقية الكود يتغيّر.
// حتى يُختار المزوّد ويُضبط عبر SMS_PROVIDER: وضع "غير مُهيّأ" لا يُرسل فعليًا (يسجّل في التطوير فقط).

export type SmsResult = { ok: boolean; provider: string; error?: string }

export function isSmsConfigured(): boolean {
  return Boolean((process.env.SMS_PROVIDER || "").trim())
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase().trim()
  try {
    switch (provider) {
      // مكان مزوّدات المستقبل، مثال:
      // case "smsmisr": return await sendViaSmsMisr(to, message)
      // case "twilio":  return await sendViaTwilio(to, message)
      default:
        // لم يُضبط مزوّد بعد — لا نُرسل فعليًا. في التطوير فقط نطبع لتسهيل الاختبار (لا في الإنتاج).
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log(`[sms:dev] -> ${to}: ${message}`)
        }
        return { ok: false, provider: "none" }
    }
  } catch (err) {
    logError("[sms] send failed", err)
    return { ok: false, provider: provider || "none", error: "send_failed" }
  }
}
