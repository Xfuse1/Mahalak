import { unstable_cache } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"

// إعدادات البحث الذكي (settings/aiSearch). كل النظام خلف علم `enabled` — وهو **false افتراضيًا**،
// فلا أثر إطلاقًا على الموقع الحي حتى يفعّله الأدمن. نفس النمط المُثبت في [lib/delivery/fee.ts]:
// القراءة تفشل-مفتوحة إلى الافتراضيات، فخطأ في قراءة إعدادات لا يُسقط بحثًا.
//
// السقوف ليست تحسينًا اختياريًا: نداء الموديل مدفوع لكل استعلام، وصفحة بحث عامة بلا سقف هي فاتورة
// مفتوحة لأي زائر (أو سكربت) يعيد تحميل الصفحة. `daily_call_cap` هو خط الدفاع الأخير حين تفشل
// كل الطبقات قبله (تسجيل الدخول، تحديد المعدل، الكاش).

export type AiSearchMode = "single_store" | "multi_store" | "customer_choice"

export const AI_SEARCH_MODES: readonly AiSearchMode[] = ["single_store", "multi_store", "customer_choice"]

export type AiSearchSettings = {
  /** علم الميزة: هل زر «البحث الذكي» يظهر ويعمل؟ */
  enabled: boolean
  /** سلة الوصفة: من متجر واحد، أو أرخص من عدة متاجر، أو يختار العميل بنفسه. */
  mode: AiSearchMode
  /** سقف نداءات الموديل يوميًّا على مستوى المنصّة كلها. 0 = بلا سقف (غير موصى به). */
  daily_call_cap: number
  /** سقف نداءات الموديل يوميًّا لكل مستخدم. 0 = بلا سقف. */
  per_user_daily_cap: number
  /** عمر نتيجة الاستعلام المحفوظة بالساعات. 0 = بلا كاش. */
  cache_ttl_hours: number
  /** أقصى عدد مكوّنات/مفاهيم يُسمح للموديل بإرجاعها في الاستعلام الواحد. */
  max_concepts: number
  /** مسار الأعراض/الصيدلية (المرحلة 2) — علم منفصل عن `enabled` عمدًا: مخاطرته القانونية أعلى. */
  otc_enabled: boolean
}

export const DEFAULT_AI_SEARCH_SETTINGS: AiSearchSettings = {
  enabled: false,
  mode: "customer_choice",
  daily_call_cap: 2000,
  per_user_daily_cap: 30,
  cache_ttl_hours: 12,
  max_concepts: 12,
  otc_enabled: false,
}

function numOr(v: unknown, dflt: number, min = 0): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= min ? n : dflt
}

function modeOr(v: unknown, dflt: AiSearchMode): AiSearchMode {
  return AI_SEARCH_MODES.includes(v as AiSearchMode) ? (v as AiSearchMode) : dflt
}

/**
 * يقرأ `settings/aiSearch` مدموجًا بالافتراضيات. أي خطأ (شبكة/صلاحية/مستند ناقص) يُرجع
 * الافتراضيات — أي `enabled: false` — فالفشل يُطفئ الميزة ولا يفتحها.
 */
export async function readAiSearchSettings(): Promise<AiSearchSettings> {
  return unstable_cache(readAiSearchSettingsUncached, ["ai-search-settings"], {
    revalidate: 60,
    tags: ["ai-search-settings"],
  })()
}

// محفوظة 60 ثانية: `aiSearch` تقرأ الإعدادات في **كل** استدعاء وقبل حارس المعدّل، فبلا حفظ كان كل
// طلب — حتى المرفوض لتجاوز الحدّ — قراءةَ Firestore. الإعداد واحد للمنصّة لا بيانات مستخدم، وتبديل
// الأدمن يُبطِل الكاش فورًا عبر `revalidateTag("ai-search-settings")` في `updateAiSearchSettings`.
async function readAiSearchSettingsUncached(): Promise<AiSearchSettings> {
  try {
    const snap = await getAdminDb().collection("settings").doc("aiSearch").get()
    const d = (snap.exists ? snap.data() : {}) as Partial<AiSearchSettings> | undefined
    return {
      enabled: d?.enabled === true,
      mode: modeOr(d?.mode, DEFAULT_AI_SEARCH_SETTINGS.mode),
      daily_call_cap: numOr(d?.daily_call_cap, DEFAULT_AI_SEARCH_SETTINGS.daily_call_cap),
      per_user_daily_cap: numOr(d?.per_user_daily_cap, DEFAULT_AI_SEARCH_SETTINGS.per_user_daily_cap),
      cache_ttl_hours: numOr(d?.cache_ttl_hours, DEFAULT_AI_SEARCH_SETTINGS.cache_ttl_hours),
      max_concepts: numOr(d?.max_concepts, DEFAULT_AI_SEARCH_SETTINGS.max_concepts, 1),
      otc_enabled: d?.otc_enabled === true,
    }
  } catch {
    return { ...DEFAULT_AI_SEARCH_SETTINGS }
  }
}
