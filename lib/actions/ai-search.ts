"use server"

// البحث الذكي: سؤال العميل بالعامية ⇒ سلة منتجات حقيقية بأسعار السيرفر.
//
// الترتيب المُلزِم للطبقات، وكل واحدة تفشل **مغلقة** إلى البحث العادي لا إلى بطاقة نصف مبنيّة:
//   ① جلسة (المسجّلون فقط — قرار مالك)  ② علم الميزة  ③ علَم أحمر صحّي  ④ تحديد معدّل
//   ⑤ كاش  ⑥ سقف يومي للمنصّة  ⑦ الموديل (نيّة + مفاهيم فقط)  ⑧ المحرّك يجد منتجات حقيقية
//   ⑨ السيرفر يسعّر من مستند المنتج
//
// **الموديل لا يرى الكتالوج.** يُرجع أسماء أصناف عامّة، والمنتج والسعر والمخزون كلها من Firestore
// عبر `getProducts()` التي تُسقط التكلفة والربح أصلًا. أي رقم يظهر للعميل مشتقّ من مستند المنتج.

import { unstable_cache } from "next/cache"
import { createHash } from "node:crypto"
import { getCurrentUid } from "../auth/session"
import { getAdminDb } from "../firebase/admin"
import { logError } from "../logger"
import { checkRateLimit } from "../utils/rate-limit"
import { normalizeArabic, searchTokens } from "../utils/arabic"
import { cairoNow } from "../utils/offer-active"
import { catalogQueryKey, matchConcept, type CatalogProduct } from "../search/catalog-index"
import { hasRedFlag, type IntentKind, type SearchIntent } from "../ai/intent"
import { geminiIntent, isGeminiEnabled } from "../ai/gemini"
import { intentOpenAICompat, isOpenAICompatEnabled } from "../ai/openai-compat"
import { readAiSearchSettings, type AiSearchMode } from "../ai/search-settings"
import { isOtcEligible } from "../ai/otc"
import { hasValidConsent, isPharmacyCategory } from "../ai/pharmacy-consent"
import { AI_SEARCH_ERROR, type AiSearchErrorCode } from "../ai/search-errors"
import { getProducts } from "./products"

export type AiProduct = {
  id: string
  name: string
  /** السعر قبل الخصم كما في مستند المنتج. */
  price: number
  /** السعر بعد خصم العرض النشط — محسوب سيرفر-سايد، لا يُقبل من العميل. */
  unit_price: number
  discount_percentage: number
  image_url: string | null
  stock: number
  store_id: string
  store_name: string
}

export type AiMatch = {
  concept: string
  product: AiProduct | null
  /** المنتج لم يطابق المفهوم مطابقةً تامّة (مرادف/صوتي/جزئي) ⇒ تعرضه الواجهة موسومًا «بديل». */
  is_alternative: boolean
}

export type AiBasket = {
  kind: "multi" | "single"
  store_ids: string[]
  store_names: string[]
  groups: { name: string; matches: AiMatch[] }[]
  /** مجموع أسعار الوحدات المتاحة بعد الخصم. جنيه مصري، منزلتان. */
  subtotal: number
  matched: number
  total_concepts: number
}

/** صيدلية يمكن للعميل سؤالها قبل الطلب — تُرفَق مع نتائج الأعراض وحدها. */
export type AiPharmacyContact = { store_id: string; name: string; phone: string | null }

export type AiSearchSuccess = {
  success: true
  intent: IntentKind
  title: string
  mode: AiSearchMode
  baskets: AiBasket[]
  /** مفاهيم لم يوجد لها أي منتج في أي متجر — تُعرض بصدق وتُسجَّل كطلب سوق غير ملبّى. */
  unmatched: string[]
  cached: boolean
  notice?: string
  /** غير فارغة في نتائج الأعراض فقط: زرّ «اسأل صيدلي» يظهر فور الترشيح (قرار مالك). */
  pharmacies?: AiPharmacyContact[]
}

export type AiSearchFailure = { success: false; error: string; code: AiSearchErrorCode }

// الرموز في [lib/ai/search-errors.ts] لا هنا: ملف "use server" لا يُصدِّر إلا دوالّ async،
// وتصدير كائن منه يكسر البناء (خطأ مُجمِّع لا يمسكه tsc ولا الاختبارات).

const CACHE_COLLECTION = "ai_search_cache"
const USAGE_COLLECTION = "ai_search_usage"
const USER_USAGE_COLLECTION = "ai_search_user_usage"
const LOG_COLLECTION = "ai_search_logs"

// حدّ الطول: استعلام أطول من ذلك ليس بحثًا بل حمولة. القصّ قبل أي عمل (وقبل الموديل) لأن الطول
// يدخل تكلفة النداء ومفتاح الكاش معًا.
const MAX_QUERY_LEN = 300

// حارس الإساءة: نافذة قصيرة لا يملك الأدمن تعطيلها. الرقم يسع بحثًا بشريًا متتابعًا بمراحل
// (استعلام كل ثلاث ثوانٍ لدقيقة كاملة) ويكسر أي حلقة آلية.
const BURST_LIMIT = 20
const BURST_WINDOW_MS = 60_000

// عدد المرشّحين لكل مفهوم. يخدم ثلاثة مستهلكين: اختيار الأرخص، وتغطية «أفضل متجر»، وسلة المتجر
// الواحد بعد الفلترة — وكلها تعمل على نفس القائمة، فضيقها يُفقر الثلاثة معًا.
const CONCEPT_CANDIDATES = 40

// نسخة محلّية من `roundMoney` كالنسخ القائمة في `pos.ts` و`pos-features.ts` و`pos-pharmacy.ts`.
// قاعدة الريبو: «استخدم الموجودة في الملف الذي تعمل فيه»، وهذا ملف جديد لا نسخة فيه — وملفات
// `lib/actions/*` كلها `"use server"` فلا تُصدَّر منها مساعدات داخلية. توحيدها بند مفتوح يقرّره
// المالك (AGENTS.md §6/3) لأنه يمسّ حسابات مال قائمة، فلا يُقرَّر عرَضًا داخل ميزة أخرى.
function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

// السعر الفعلي للوحدة = سعر المستند ناقص نسبة العرض النشط التي حسبتها getProducts سيرفر-سايد.
// الخصم يُحدّ بين 0 و100 قبل الاستعمال: نسبة فاسدة في مستند عرض قديم كانت تُنتج سعرًا سالبًا.
function effectiveUnitPrice(price: unknown, discountPercentage: unknown): number {
  const base = Math.max(0, Number(price) || 0)
  const pct = Math.min(100, Math.max(0, Number(discountPercentage) || 0))
  return roundMoney(base - (base * pct) / 100)
}

function toAiProduct(product: CatalogProduct & Record<string, unknown>): AiProduct {
  const price = Math.max(0, Number(product.price) || 0)
  const pct = Math.min(100, Math.max(0, Number(product.discount_percentage) || 0))
  return {
    id: product.id,
    name: typeof product.name === "string" ? product.name : "",
    price: roundMoney(price),
    unit_price: effectiveUnitPrice(price, pct),
    discount_percentage: pct,
    image_url: typeof product.image_url === "string" ? product.image_url : null,
    stock: Math.max(0, Math.floor(Number(product.stock) || 0)),
    store_id: typeof product.store_id === "string" ? product.store_id : "",
    store_name: product.stores?.name || (typeof product.storeName === "string" ? product.storeName : "") || "",
  }
}

function cacheKeyOf(query: string): string {
  // مشتقّ من نفس تطبيع المحرّك: «الشاي» و«شاي» استعلام واحد فعليًّا، فيشتركان في مدخلة واحدة.
  // والتجزئة لأن مُعرّف مستند Firestore لا يقبل "/" ومحدود الطول، لا لإخفاء شيء.
  return createHash("sha1").update(catalogQueryKey(query) || "-").digest("hex")
}

/**
 * عدّاد نداءات الموديل اليومي على مستوى المنصّة. يُزاد **قبل** النداء لا بعده.
 *
 * الترتيب مقصود: زيادة العدّاد بعد نجاح النداء تعني أن موجة متزامنة تتجاوز السقف كلّها معًا قبل أن
 * يرى أيٌّ منها العدّاد. والسقف هنا حارس فاتورة، وحارس الفاتورة الذي يتأخّر خطوةً لا يحرس شيئًا.
 * يفشل **مفتوحًا** عند خطأ بنيوي (نفس نموذج `checkRateLimit`): عطل في عدّاد لا يُسقط ميزة.
 */
async function reserveModelCall(dailyCap: number): Promise<boolean> {
  if (!dailyCap || dailyCap <= 0) return true // 0 = بلا سقف (قرار أدمن صريح، معلَن في اللوحة)
  try {
    // حدّ اليوم بتوقيت القاهرة لا UTC — اتّفاقية قائمة في الريبو (`cairoNow` في offer-active،
    // `cairoDay` في driver-status). بـUTC كان «السقف اليومي» يُصفَّر الساعة الثانية أو الثالثة
    // فجرًا بتوقيت المستخدم، فيُقرأ الرقم في اللوحة على أنه يومٌ وهو يومان مقطوعان.
    const day = cairoNow().date
    const ref = getAdminDb().collection(USAGE_COLLECTION).doc(day)
    return await getAdminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const used = Number((snap.data() as { calls?: number } | undefined)?.calls || 0)
      if (used >= dailyCap) return false
      tx.set(ref, { calls: used + 1, updated_at: new Date().toISOString() }, { merge: true })
      return true
    })
  } catch (error) {
    logError("[ai-search] reserveModelCall", error)
    return true
  }
}

/**
 * السقف اليومي **لكل مستخدم**. عدّاد خاص لا `checkRateLimit`.
 *
 * السبب دقيق ويهمّ: `checkRateLimit` تبني مُعرّف مستندها دائمًا كـ`${action}:${ip}`
 * ([lib/utils/rate-limit.ts](../utils/rate-limit.ts))، فحقن المعرّف في اسم الفعل يعطي حدًّا لكل
 * **(مستخدم، IP)** لا لكل مستخدم — تبديل شبكة (واي-فاي ⇄ بيانات الجوّال) يمنح حصّةً يومية جديدة
 * كاملة. وهذا مقبول لحارس الاندفاع (الـIP هو المقصود هناك)، وغير مقبول لسقف تقول عنه اللوحة إنه
 * «لكل مستخدم». المفتاح هنا (المعرّف + اليوم) لا يحمل IP إطلاقًا.
 *
 * يفشل **مفتوحًا** عند خطأ بنيوي كبقية طبقات الحدّ: حارس الاندفاع أعلاه يبقى قائمًا.
 */
async function reserveUserSearch(uid: string, dailyCap: number): Promise<boolean> {
  if (!dailyCap || dailyCap <= 0) return true // 0 = بلا سقف (قرار أدمن صريح، معلَن في اللوحة)
  try {
    // حدّ اليوم بتوقيت القاهرة لا UTC — اتّفاقية قائمة في الريبو (`cairoNow` في offer-active،
    // `cairoDay` في driver-status). بـUTC كان «السقف اليومي» يُصفَّر الساعة الثانية أو الثالثة
    // فجرًا بتوقيت المستخدم، فيُقرأ الرقم في اللوحة على أنه يومٌ وهو يومان مقطوعان.
    const day = cairoNow().date
    const db = getAdminDb()
    const ref = db.collection(USER_USAGE_COLLECTION).doc(`${uid}_${day}`)
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const used = Number((snap.data() as { searches?: number } | undefined)?.searches || 0)
      if (used >= dailyCap) return false
      tx.set(ref, { user_id: uid, day, searches: used + 1, updated_at: new Date().toISOString() }, { merge: true })
      return true
    })
  } catch (error) {
    logError("[ai-search] reserveUserSearch", error)
    return true
  }
}

async function readCache(key: string, ttlHours: number): Promise<SearchIntent | null> {
  if (!ttlHours || ttlHours <= 0) return null
  try {
    const snap = await getAdminDb().collection(CACHE_COLLECTION).doc(key).get()
    if (!snap.exists) return null
    const data = snap.data() as { intent?: SearchIntent; created_at_ms?: number } | undefined
    if (!data?.intent || !Array.isArray(data.intent.items)) return null
    const age = Date.now() - Number(data.created_at_ms || 0)
    if (age > ttlHours * 3_600_000) return null
    return data.intent
  } catch (error) {
    logError("[ai-search] readCache", error)
    return null
  }
}

async function writeCache(key: string, query: string, intent: SearchIntent, ttlHours: number): Promise<void> {
  // الكتابة تتبع القراءة: `readCache` تعود فورًا عند `ttl <= 0`، فالكتابة عندها مدخلاتٌ لا يقرأها
  // أحد أبدًا ولا تحذفها سياسة — أي تعطيلٌ للكاش يُنتج نموًّا صامتًا بدل توفير.
  if (!ttlHours || ttlHours <= 0) return
  try {
    await getAdminDb().collection(CACHE_COLLECTION).doc(key).set({
      intent,
      query: String(query).slice(0, MAX_QUERY_LEN),
      created_at_ms: Date.now(),
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    logError("[ai-search] writeCache", error)
  }
}

// سجلّ الاستعلامات. غرضه المعلَن في سياسة الاستخدام: تحسين النتائج، **وقياس الطلب غير الملبّى**
// (ما بحث عنه العملاء ولم يجدوه) — وهو أثمن مخرج في الميزة. لا نخزّن سوى المعرّف والنصّ المطبَّع.
async function logQuery(entry: {
  uid: string
  query: string
  intent: IntentKind
  concepts: string[]
  matched: number
  unmatched: string[]
  cached: boolean
}): Promise<void> {
  try {
    // الشكوى الصحّية لا يُخزَّن نصّها ولا مفاهيمها — العدّ فقط.
    //
    // ما يُسجَّل هنا مربوط بمعرّف حساب حقيقي، ونصُّ «حاسس بكذا» بيانٌ صحّي عن شخص بعينه لا سجلّ
    // تسوّق. والغرض المعلَن (قياس الطلب غير الملبّى) يتحقّق بالعدّ وحده، فلا مقابل للاحتفاظ به.
    const isHealth = entry.intent === "symptom"
    await getAdminDb().collection(LOG_COLLECTION).add({
      // **لا هوية على الصفّ الصحّي.** حجب النصّ وحده لم يكن كافيًا: صفٌّ يحمل `user_id` وطابعًا
      // زمنيًّا بدقّة الملّي و`intent: "symptom"` هو حدثٌ صحّي منسوب لشخص بعينه، وأي أدمن يرشّح
      // المجموعة يحصل على قائمة «مَن اشتكى صحّيًّا ومتى». والسياسة تَعِد بـ«عدّ مجرَّد /
      // anonymous count» — فالوعد لا يتحقّق إلا بإسقاط المعرّف نفسه. عدّاد اللوحة يعمل كما هو.
      user_id: isHealth ? null : entry.uid,
      query: isHealth ? null : String(entry.query).slice(0, MAX_QUERY_LEN),
      query_normalized: isHealth ? null : normalizeArabic(entry.query).slice(0, MAX_QUERY_LEN),
      intent: entry.intent,
      concepts: isHealth ? [] : entry.concepts.slice(0, 50),
      matched_count: entry.matched,
      unmatched: isHealth ? [] : entry.unmatched.slice(0, 50),
      unmatched_count: entry.unmatched.length,
      redacted: isHealth,
      from_cache: entry.cached,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    logError("[ai-search] logQuery", error)
  }
}

type ConceptCandidates = { concept: string; group: string; items: CatalogProduct[]; exact: boolean }

/**
 * معرّفات الصيدليات التي وقّعت إقرار مسار الأعراض **بالنسخة الحالية**، وليست محظورة ولا معطَّلة.
 *
 * قراءة مباشرة من `users` لا من `getStores()`: الأخيرة تُسقط `pharmacy_ai_consent` من حمولتها
 * العامّة عمدًا (حقل داخلي لا يخصّ العميل)، والاعتماد على حمولة عرض في بوابة صلاحية خطأ بنيوي —
 * أي إضافة حقل هناك تصير سطح إذن هنا.
 */
async function consentingPharmacies(): Promise<Set<string>> {
  // محفوظة 60 ثانية مثل `getProducts()` بجوارها: القائمة إعدادُ منصّة واحد للجميع لا بيانات مستخدم،
  // وبدون الحفظ كان **كل استعلام أعراض** يقرأ مستند كل بائع على المنصّة. توقيع إقرار أو سحبه يظهر
  // خلال دقيقة، وهو تأخّرٌ مقبول لإقرار يُوقَّع مرّة، وغير مقبول ثمنُه قراءةً كاملة لكل بحث.
  return unstable_cache(readConsentingPharmacyIds, ["ai-search-consenting-pharmacies"], {
    revalidate: 60,
    tags: ["stores"],
  })().then((ids) => new Set(ids))
}

async function readConsentingPharmacyIds(): Promise<string[]> {
  const out: string[] = []
  try {
    const snap = await getAdminDb().collection("users").where("role", "==", "seller").get()
    for (const doc of snap.docs) {
      const data = doc.data() as {
        disabled?: boolean
        store?: { category?: string; is_approved?: boolean; pharmacy_ai_consent?: unknown }
      }
      if (data?.disabled === true) continue
      if (data?.store?.is_approved === false) continue
      // الفئة تُفحَص هنا أيضًا لا عند التوقيع وحده: التاجر يملك حقل الفئة ويغيّره **بعد** التوقيع
      // عبر قائمة السماح في `updateStore`، فتوقيعٌ صحيح يوم وُقِّع لا يعني متجرًا مؤهَّلًا اليوم.
      // الفحص عند القراءة هو الوحيد الذي يرى الحالة الراهنة.
      if (!isPharmacyCategory(data?.store?.category, normalizeArabic)) continue
      if (!hasValidConsent(data?.store?.pharmacy_ai_consent)) continue
      out.push(doc.id)
    }
  } catch (error) {
    // فشل مقفول: تعذّر التحقّق من الإقرار ⇒ لا صيدلية مؤهَّلة ⇒ لا تُعرض منتجات على شكوى صحّية.
    // هذا عكس نموذج بقية الطبقات عمدًا — الخطأ هنا لا يجوز أن يفتح المسار.
    logError("[ai-search] consentingPharmacies", error)
    return []
  }
  return out
}

/**
 * يختار المتجر الذي يغطّي أكبر عدد من المفاهيم. عند التعادل: الأرخص إجمالًا.
 *
 * التعادل ليس نادرًا بل هو الحالة الغالبة على كتالوج صغير (سلة من أربعة مكوّنات يغطّيها متجران
 * كاملين)، وبلا فاصل ثابت كان الترتيب يتبع ترتيب مستندات Firestore فتتغيّر التوصية بين رسمتين
 * لنفس الاستعلام بلا سبب يراه المستخدم.
 */
function pickBestStore(candidates: ConceptCandidates[]): string | null {
  const coverage = new Map<string, { count: number; cost: number }>()
  for (const candidate of candidates) {
    const seenStores = new Set<string>()
    for (const item of candidate.items) {
      // النافد لا يُغطّي شيئًا — احتسابه كان يرشّح متجرًا «الأكثر تغطيةً» بأصناف لا تُباع.
      if (Number(item.stock ?? 0) <= 0) continue
      const storeId = typeof item.store_id === "string" ? item.store_id : ""
      if (!storeId || seenStores.has(storeId)) continue
      seenStores.add(storeId)
      const raw = item as Record<string, unknown>
      const entry = coverage.get(storeId) || { count: 0, cost: 0 }
      entry.count += 1
      entry.cost += effectiveUnitPrice(raw.price, raw.discount_percentage)
      coverage.set(storeId, entry)
    }
  }
  let best: string | null = null
  let bestEntry = { count: -1, cost: Number.POSITIVE_INFINITY }
  for (const [storeId, entry] of coverage) {
    if (entry.count > bestEntry.count || (entry.count === bestEntry.count && entry.cost < bestEntry.cost)) {
      best = storeId
      bestEntry = entry
    }
  }
  return best
}

/**
 * أرخص عنصر بين المرشّحين المتساوين في **قوّة المطابقة**.
 *
 * لا أرخص المرشّحين مطلقًا: مرشّح بقوّة أدنى صنفٌ آخر لا بديلٌ أرخص، فاختياره لسعره استبدالُ سلعة
 * بسلعة. القيد بالقوّة العليا يجعل «أرخص» تعني ما يعنيه العميل: نفس الصنف من أرخص متجر.
 */
function pickCheapest(items: CatalogProduct[]): CatalogProduct | undefined {
  if (items.length <= 1) return items[0]
  // المرشّحون مرتّبون بقوّة المطابقة تنازليًّا (matchConcept)، فالقوّة العليا هي قوّة الأول.
  const priceOf = (p: CatalogProduct) => effectiveUnitPrice((p as Record<string, unknown>).price, (p as Record<string, unknown>).discount_percentage)
  let best = items[0]
  for (const item of items) {
    if (priceOf(item) < priceOf(best)) best = item
  }
  return best
}

function buildBasket(
  candidates: ConceptCandidates[],
  kind: "multi" | "single",
  storeId: string | null,
  cheapest: boolean,
): AiBasket {
  const groups = new Map<string, AiMatch[]>()
  const storeIds: string[] = []
  const storeNames: string[] = []
  // منتج واحد لا يُحتسب مرّتين. الموديل يُخرج مترادفات في مفهومين («حفاضات أطفال» و«بامبرز»،
  // «لبن صناعي» و«لبن بودرة») فيقعان على نفس المستند — وبلا هذا كان الإجمالي يتضاعف على منتج
  // واحد (350 ⇒ 700) والسلة تحتوي بندين لصنف واحد.
  const usedProducts = new Set<string>()
  let subtotal = 0
  let matched = 0

  for (const candidate of candidates) {
    const pool = (storeId ? candidate.items.filter((item) => item.store_id === storeId) : candidate.items).filter(
      (item) => !usedProducts.has(item.id),
    )
    // النافد يُستبعد لا يُعرَض. المحرّك يرتّب المتوفّر أولًا لكنه يُرجع النافد حين لا بديل، وقبوله هنا
    // كان يُنتج سلةً كاذبة: بند بسعر يدخل الإجمالي بينما `addItems` ترفضه لاحقًا لنفاد مخزونه —
    // فيرى العميل رقمًا لا يستطيع دفعه، ويضغط «أضف السلة كلها» فيحصل على أقلّ ممّا رآه.
    const available = pool.filter((item) => Number(item.stock ?? 0) > 0)
    const chosen = cheapest ? pickCheapest(available) : available[0]
    if (chosen) usedProducts.add(chosen.id)
    let product: AiProduct | null = null
    if (chosen) {
      product = toAiProduct(chosen as CatalogProduct & Record<string, unknown>)
      subtotal += product.unit_price
      matched++
      if (product.store_id && !storeIds.includes(product.store_id)) {
        storeIds.push(product.store_id)
        storeNames.push(product.store_name)
      }
    }
    const list = groups.get(candidate.group) || []
    // «بديل» يعني: وُجد منتج لكن ليس مطابقة تامّة للمفهوم. مطابقة داخل متجر واحد قد تنزل عن
    // التامّة حتى لو كانت تامّة عالميًّا، فتُحسب هنا لا في مرحلة الترشيح.
    list.push({ concept: candidate.concept, product, is_alternative: !!product && !candidate.exact })
    groups.set(candidate.group, list)
  }

  return {
    kind,
    store_ids: storeIds,
    store_names: storeNames,
    groups: Array.from(groups.entries()).map(([name, matches]) => ({ name, matches })),
    subtotal: roundMoney(subtotal),
    matched,
    total_concepts: candidates.length,
  }
}

/**
 * أرقام الصيدليات التي ظهرت منتجاتها فعلًا في السلة — لا كل الصيدليات الموقِّعة.
 *
 * زرٌّ يتصل بصيدلية لا يعرض العميلُ شيئًا منها لا يفيده. والمصدر حمولة المنتج العامّة نفسها
 * (`publicStoreFields`) فلا يُقرأ حقل جديد ولا يُكشف ما ليس عامًّا أصلًا.
 */
function pharmacyContacts(baskets: AiBasket[], products: readonly CatalogProduct[]): AiPharmacyContact[] {
  const shown = new Set<string>()
  for (const basket of baskets) {
    for (const storeId of basket.store_ids) shown.add(storeId)
  }
  const out: AiPharmacyContact[] = []
  const seen = new Set<string>()
  for (const product of products) {
    const storeId = typeof product.store_id === "string" ? product.store_id : ""
    if (!storeId || !shown.has(storeId) || seen.has(storeId)) continue
    seen.add(storeId)
    const store = product.stores as { name?: string | null; phone?: string | null } | null | undefined
    out.push({
      store_id: storeId,
      name: store?.name || "الصيدلية",
      phone: typeof store?.phone === "string" && store.phone ? store.phone : null,
    })
  }
  return out
}

export async function aiSearch(input: { query: string }): Promise<AiSearchSuccess | AiSearchFailure> {
  const query = String(input?.query || "").trim().slice(0, MAX_QUERY_LEN)
  if (!query) return { success: false, error: "اكتب ما تريده أولًا", code: AI_SEARCH_ERROR.NO_INTENT }

  // ① الهوية من الجلسة. `getCurrentUid` لا `requireUid`: الأخيرة ترمي، والاستثناء العابر لحدود
  // server action يصل العميل كخطأ عام غير قابل للعرض (قاعدة الريبو: نُرجع كائنًا ولا نرمي أبدًا).
  const uid = await getCurrentUid()
  if (!uid) {
    return { success: false, error: "سجّل الدخول لاستخدام البحث الذكي", code: AI_SEARCH_ERROR.UNAUTHENTICATED }
  }

  try {
    // ② علم الميزة — القراءة تفشل إلى enabled:false، فالعطل يُطفئ الميزة ولا يفتحها.
    const settings = await readAiSearchSettings()
    if (!settings.enabled) {
      return { success: false, error: "البحث الذكي غير متاح حاليًا", code: AI_SEARCH_ERROR.DISABLED }
    }

    // ③ العلَم الأحمر قبل كل شيء — قبل الكاش وقبل الموديل. شكوى خطِرة لا يقابلها عرض منتجات
    // مهما كانت الإعدادات، ولا يُسأل الموديل عنها أصلًا كي لا يصنّفها بنفسه.
    if (hasRedFlag(query, searchTokens)) {
      return {
        success: false,
        error: "لو دي حالة طارئة، توجّه لأقرب طوارئ أو اتصل بالإسعاف فورًا. محلك متجر ولا يقدّم استشارة طبية.",
        code: AI_SEARCH_ERROR.RED_FLAG,
      }
    }

    // ④ تحديد المعدّل، حدّان لا حدّ واحد. المُحدِّد الوحيد في المشروع، ومفتاحه (الفعل + الـIP) —
    // نُدخل المعرّف في اسم الفعل ليصير الحدّ لكل (مستخدم، IP) بدل IP مشترك يعاقب جيرانه.
    //
    // ٤-أ) حارس الإساءة: **دائم ولا يقبل التعطيل من الإعدادات**. السقف اليومي في اللوحة حدٌّ تجاري
    // يملك الأدمن تصفيره («بلا سقف»)، وتصفيره كان يفتح المسار كلّه على مصراعيه: كل استدعاء — حتى
    // المُجاب من الكاش بلا أي نداء موديل — يكتب مستندًا في `ai_search_logs`، فحلقةٌ على استعلام
    // واحد محفوظ تكتب في Firestore بلا حدّ. الحدّ التجاري والحدّ ضدّ الإساءة شيئان مختلفان.
    if (!(await checkRateLimit(`ai_search_burst:${uid}`, BURST_LIMIT, BURST_WINDOW_MS))) {
      return { success: false, error: "شوية بالراحة — جرّب تاني بعد دقيقة.", code: AI_SEARCH_ERROR.RATE_LIMITED }
    }

    // ٤-ب) السقف اليومي لكل مستخدم (إعداد أدمن، 0 = بلا سقف).
    if (!(await reserveUserSearch(uid, settings.per_user_daily_cap))) {
      return { success: false, error: "وصلت للحد اليومي للبحث الذكي. جرّب بكرة.", code: AI_SEARCH_ERROR.RATE_LIMITED }
    }

    // ⑤ الكاش ثم ⑥ السقف ثم ⑦ الموديل — بهذا الترتيب كي لا يستهلك استعلامٌ محفوظٌ من سقف الفاتورة.
    const key = cacheKeyOf(query)
    let intent = await readCache(key, settings.cache_ttl_hours)
    const cached = intent !== null

    if (!intent) {
      if (!isGeminiEnabled() && !isOpenAICompatEnabled()) {
        return { success: false, error: "البحث الذكي غير متاح حاليًا", code: AI_SEARCH_ERROR.DISABLED }
      }
      if (!(await reserveModelCall(settings.daily_call_cap))) {
        return { success: false, error: "البحث الذكي مشغول اليوم. جرّب بعدين.", code: AI_SEARCH_ERROR.QUOTA }
      }
      // نفس سلسلة السقوط المستخدَمة في الاستيراد: Gemini ثم المزوّد المتوافق مع OpenAI.
      intent = await geminiIntent(query, settings.max_concepts)
      if (!intent) intent = await intentOpenAICompat(query, settings.max_concepts)
      // الشكوى الصحّية **لا تُحفَظ في الكاش إطلاقًا**.
      //
      // ليست دقّةً زائدة: مستند الكاش يخزّن نصّ الاستعلام الخام وقائمة مفاهيمه، وسياسة الخصوصية
      // تقول حرفيًّا إن الاستعلامات الصحّية «لا نحتفظ بنصّها ولا بتفاصيلها إطلاقًا». وعدٌ في سياسة
      // يخالفه الكود أسوأ من عدم الوعد. الثمن: نداء موديل لكل شكوى صحّية — وهو ثمن مقبول لأن
      // البديل تخزين بيان صحّي وعدَتْ سياستُنا بألّا نخزّنه.
      if (intent && intent.intent !== "symptom") {
        await writeCache(key, query, intent, settings.cache_ttl_hours)
      }
    }

    if (!intent) {
      return { success: false, error: "مقدرتش أفهم الطلب. جرّب صياغة تانية أو استخدم البحث العادي.", code: AI_SEARCH_ERROR.NO_INTENT }
    }

    // مسار الأعراض خلف علمه المنفصل عن علم الميزة — مخاطرته القانونية من نوع آخر.
    const isSymptom = intent.intent === "symptom"
    if (isSymptom && !settings.otc_enabled) {
      return {
        success: false,
        error: "البحث عن منتجات الأعراض لسه مقفول. دوّر بالاسم مباشرةً أو اسأل الصيدلية.",
        code: AI_SEARCH_ERROR.SYMPTOM_LOCKED,
      }
    }

    // ⑧ المفاهيم ⇒ منتجات حقيقية. الكتالوج يُقرأ مرّة واحدة لكل الاستعلام (getProducts محفوظة 60ث)
    // والفهرس محفوظ فوقها، فكل مفهوم تاليًا مجرّد مرور على فهرس جاهز.
    let products = (await getProducts()) as unknown as CatalogProduct[]

    // ⑧-ب) بوابة الأعراض: **تُطبَّق على الكتالوج قبل المطابقة لا على النتيجة بعدها**.
    //
    // الترتيب هنا هو الفرق بين بوابة تعمل وبوابة تبدو أنها تعمل: الترشيح ثم الفلترة كان يترك
    // مفهومًا بلا نتيجة لأن أفضل مرشّحيه سقطوا في الفلترة، بينما يوجد في الكتالوج بديل مسموح كان
    // سيُختار لو أن المطابقة رأت المسموح وحده. البوابة أوّلًا ⇒ المطابقة تعمل على ما يجوز عرضه فقط.
    const pharmacies = isSymptom ? await consentingPharmacies() : null
    if (isSymptom) {
      products = products.filter((product) => {
        const storeId = typeof product.store_id === "string" ? product.store_id : ""
        if (!storeId || !pharmacies!.has(storeId)) return false
        return isOtcEligible(product as { name?: string | null; requires_prescription?: boolean | null })
      })
      if (!products.length) {
        return {
          success: false,
          error: "مفيش صيدلية متاحة دلوقتي لعرض منتجات مرتبطة. جرّب البحث بالاسم مباشرةً.",
          code: AI_SEARCH_ERROR.SYMPTOM_LOCKED,
        }
      }
    }

    const candidates: ConceptCandidates[] = []
    for (const item of intent.items) {
      for (const concept of item.concepts) {
        // الحدّ واسع عمدًا: سلة «المتجر الواحد» تفلتر هذه القائمة بالمتجر لاحقًا، فحدٌّ ضيّق كان
        // يعني أن متجرًا يبيع الصنف لكن ترتيبه التاسع عالميًّا يُحسب كأنه لا يبيعه ⇒ تغطية منقوصة.
        const { items, tier } = matchConcept(products, concept, { limit: CONCEPT_CANDIDATES })
        candidates.push({ concept, group: item.name, items, exact: tier === "exact" })
      }
    }

    // «متعدد المتاجر» يعني حرفيًّا أفضل سعر — وهو ما تعِد به تسميته في الواجهة. و«متجر واحد»
    // لا يختار سعرًا: المتجر مُختار سلفًا، فالاختيار داخله يجب أن يتبع الصلة لا الثمن.
    const multi = buildBasket(candidates, "multi", null, true)
    // «غير متوفر» يُشتقّ من السلة المبنيّة لا من نتيجة الترشيح: مفهومٌ وُجد له مرشّحون كلُّهم نافدون
    // ليس متوفّرًا، وحسابه متوفّرًا كان يُخفيه عن قائمة الطلب غير الملبّى — وهي أثمن مخرج في الميزة.
    const unmatched = multi.groups
      .flatMap((group) => group.matches)
      .filter((match) => !match.product)
      .map((match) => match.concept)
    const bestStore = pickBestStore(candidates)
    const single = bestStore ? buildBasket(candidates, "single", bestStore, false) : null

    const baskets: AiBasket[] = []
    if (settings.mode === "single_store" && single) baskets.push(single)
    else if (settings.mode === "multi_store") baskets.push(multi)
    else {
      baskets.push(multi)
      // سلة المتجر الواحد لا تُعرض إن كانت نفسها: خيار «اختر» بخيارين متطابقين قرارٌ بلا فرق.
      if (single && (single.matched !== multi.matched || single.subtotal !== multi.subtotal)) baskets.push(single)
    }
    if (!baskets.length) baskets.push(multi)

    await logQuery({
      uid,
      query,
      intent: intent.intent,
      concepts: candidates.map((c) => c.concept),
      matched: multi.matched,
      unmatched,
      cached,
    })

    return {
      success: true,
      intent: intent.intent,
      title: intent.title,
      mode: settings.mode,
      baskets,
      unmatched,
      cached,
      // الصياغة قرار مالك ومنصوصة في شروط الاستخدام: «منتجات مرتبطة»، بلا تشخيص وبلا جرعة.
      notice: isSymptom
        ? "دي منتجات مرتبطة باللي كتبته — مش تشخيص ولا وصفة ولا جرعة. لو الأعراض مستمرة أو شديدة، اتكلم مع دكتور."
        : undefined,
      pharmacies: isSymptom ? pharmacyContacts(baskets, products) : undefined,
    }
  } catch (error) {
    logError("[ai-search] aiSearch", error)
    return { success: false, error: "حصل خطأ. جرّب تاني.", code: AI_SEARCH_ERROR.SERVER }
  }
}

/**
 * يسجّل أن العميل أضاف من نتيجة البحث الذكي إلى سلّته. مقياس النجاح الذي حدّده المالك
 * («نسبة بحث ⇒ سلة») لا يمكن حسابه بأثر رجعي: الطلب لا يحمل من أين جاء الصنف، والسلة تعيش في
 * متصفّح العميل. فإن لم يُسجَّل الحدث لحظةَ وقوعه لم يُسجَّل أبدًا.
 *
 * نقطة نهاية عامة كغيرها ⇒ جلسة + نفس حارس الاندفاع. ولا تُخزَّن معرّفات المنتجات لاستعلام صحّي.
 */
export async function logAiSearchAddToCart(input: {
  query: string
  productIds: string[]
  intent?: IntentKind
  basketKind?: "multi" | "single"
  wholeBasket?: boolean
}): Promise<{ success: boolean }> {
  const uid = await getCurrentUid()
  if (!uid) return { success: false }
  try {
    if (!(await checkRateLimit(`ai_search_burst:${uid}`, BURST_LIMIT, BURST_WINDOW_MS))) return { success: false }
    // **لا نصّ ولا معرّفات منتجات هنا إطلاقًا** — بصرف النظر عن نوع الاستعلام.
    //
    // النسخة السابقة كانت تحجب بناءً على `input.intent`، وهو حقل **يرسله العميل** على نقطة نهاية
    // عامة: طلبٌ واحد بـ`intent: "shopping"` ونصٍّ صحّي كان يكتب البيان الصحّي كاملًا ومربوطًا
    // بالمعرّف. وتصحيحُ ذلك باشتقاق النيّة سيرفر-سايد يعني نداء موديل ثانيًا لأجل التسجيل.
    // الحلّ الأصحّ أرخص: المقياس المطلوب هو **التحويل** (كم مرّة أُضيف من نتيجة بحث ذكي)، وهو
    // يتحقّق بالعدّ وحده. فلا يُخزَّن ما لا يُقاس به شيء، ويسقط سطح التسريب من أصله.
    const ids = Array.isArray(input?.productIds) ? input.productIds.filter((id) => typeof id === "string") : []
    await getAdminDb().collection(LOG_COLLECTION).add({
      event: "add_to_cart",
      user_id: uid,
      item_count: Math.min(50, ids.length),
      basket_kind: input?.basketKind === "single" || input?.basketKind === "multi" ? input.basketKind : null,
      whole_basket: input?.wholeBasket === true,
      created_at: new Date().toISOString(),
    })
    return { success: true }
  } catch (error) {
    logError("[ai-search] logAiSearchAddToCart", error)
    return { success: false }
  }
}

/**
 * حالة الميزة للواجهة — بلا مصادقة عمدًا: شريط البحث يُرسم لكل زائر ويحتاج معرفة إن كان يعرض الزرّ.
 * لا تُرجع سوى علم واحد، ولا تكشف أي إعداد آخر (سقوف/مزوّد/وضع).
 *
 * محفوظة 60 ثانية: هذه نقطة نهاية **عامة بلا مصادقة** يبلغها أي زائر، وبلا حفظ كانت كل زيارة
 * قراءةَ Firestore — أي أن إعادة تحميل الصفحة في حلقة تصير قراءات بلا سقف. القيمة إعداد منصّة
 * واحد للجميع فلا شيء خاصّ بمستخدم يُحفَظ، وتأخّر ظهور تبديل الأدمن ≤ دقيقة مقبول لعلَم عرض.
 */
export async function getAiSearchAvailability(): Promise<{ enabled: boolean }> {
  return unstable_cache(
    async () => {
      try {
        return { enabled: (await readAiSearchSettings()).enabled }
      } catch {
        return { enabled: false }
      }
    },
    ["ai-search-availability"],
    { revalidate: 60, tags: ["ai-search-settings"] },
  )()
}
