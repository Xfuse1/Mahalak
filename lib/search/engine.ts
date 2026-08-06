// محرّك البحث داخل المتجر: فهرس مرجّح + ترتيب بالصلة + سُلَّم إنقاذ. ملف نقي بلا I/O ولا React.
//
// ما كان قبله: `tokens.every((t) => blob.includes(t))` على blob واحد يضمّ الاسم والوصف والفئة.
// ثلاثة أعطال في سطر واحد:
//   1. لا ترتيب إطلاقًا — النتائج بترتيب مستندات Firestore، وكل صنف مستورَد تقييمه صفر، فالمقصود
//      قد يقع في الصفّ السابع والعشرين بينما 59% من النقرات في المواضع الثلاثة الأولى.
//   2. الفئة داخل الـblob — و1543 من 1557 صنفًا فئتهم «أدوية»، فكلمة «ادويه» تطابق الكتالوج كله.
//   3. `every` عقوبةٌ على الدقّة — كلمة إضافية واحدة تُفشل الاستعلام كله بدل أن تُضيّقه.
//
// الترتيب هنا مبنيّ على أن الأوزان تعبّر عن *موضع* التطابق لا عن وجوده فقط: تطابق تام لاسم
// المنتج ليس كتطابق داخل كلمة في وصفه.

import { splitSearchTokens, stripAl } from "../utils/arabic"
import { isUsableKey, phoneticKey } from "./phonetic"

export type SearchableProduct = {
  id: string
  name: string
  description?: string | null
  category?: string | null
  stock?: number
  rating?: number
  rating_count?: number
  active_ingredient?: string | null
  barcode?: string | null
  manufacturer?: string | null
}

/** الطبقة التي أنتجت النتائج — تحتاجها الواجهة كي تُعلن للعميل ما فعلته به. */
export type SearchTier = "all" | "exact" | "alias" | "phonetic" | "partial" | "empty"

export type SearchOutcome = {
  ids: string[]
  tier: SearchTier
  /** الكلمة التي أُسقطت في طبقة `partial` — تُعرض للعميل: «هذه نتائج «س» بعد إسقاط «ص»». */
  droppedToken?: string
  /**
   * اسم فئة يطابق الاستعلام مطابقةً تامّة. تعرضه الواجهة كتبويب يُنقر بدل إغراق العميل بقائمة
   * مسطّحة: مَن كتب «أدوية» يريد تصفّح الفئة لا استعراض 1543 بطاقة بلا ترتيب.
   */
  categorySuggestion?: string
}

type Entry = {
  id: string
  order: number
  rawCategory: string
  name: string
  nameTokens: string[]
  extra: string
  extraTokens: string[]
  category: string
  categoryTokens: string[]
  inStock: boolean
  popularity: number
}

export type StoreIndex = {
  entries: Entry[]
  /** مفتاح صوتي ← فهارس المُدخلات وطول التوكن (الطول يرتّب داخل الطبقة الصوتية). */
  byPhonetic: Map<string, Array<{ at: number; len: number }>>
  /** التوكن ← عدد المنتجات التي يظهر فيها. تُستعمل لاختيار أقلّ الكلمات انتقائيةً عند الإسقاط. */
  vocabulary: Map<string, number>
  /**
   * كلمات فئات تغطّي من الكتالوج أكثر من أن تكون إشارة صلة.
   *
   * وزن الفئة المنخفض يرتّب لكنه لا يمنع: «ادويه» كانت تُمرّر الكتالوج كله (1543 من 1543) لأن
   * التطابق حدث فعلًا وإن بدرجة 8. فالعلاج ليس خفض الوزن بل إسقاط التطابق حين لا يميّز شيئًا —
   * وهذا معنى IDF: كلمة في كل المستندات لا تحمل معلومة.
   */
  weakCategoryTokens: Set<string>
  /** أسماء الفئات كما تُعرض، مفهرسة بصيغتها المطبَّعة — تتيح توجيه العميل إلى تبويب الفئة. */
  categoriesByNormalized: Map<string, string>
}

// أوزان الموضع. الفجوات واسعة عمدًا كي لا يتراكم تطابقٌ ضعيفٌ حتى يعلو تطابقًا قويًّا واحدًا.
const W_NAME_EXACT = 1000
const W_NAME_PREFIX = 500
const W_NAME_TOKEN = 400
const W_NAME_TOKEN_PREFIX = 250
const W_NAME_SUBSTRING = 120
const W_EXTRA_TOKEN = 60
const W_EXTRA_SUBSTRING = 30
// الفئة بوزن ضئيل جدًّا ومقصود: هي أضعف إشارة صلة، وتُلغى تمامًا حين تغطّي أغلب الكتالوج.
const W_CATEGORY = 8

// فوق هذه النسبة من الكتالوج تكفّ كلمة الفئة عن التمييز فتُهمَل في المطابقة. صيدلية الاستيراد
// فئتها الواحدة «أدوية» تغطّي 99% من أصنافها — وهي الحالة التي كانت تُفرغ البحث من معناه.
const CATEGORY_BLOAT_RATIO = 0.3

// نصيب المرادف من وزن الكلمة الأصلية. جدول الأسماء البديلة يوحّد المجموعات التي تشترك في مادة
// فعّالة (بنادول ⇄ باراسيتامول ⇄ سيتال)، وهو سلوك مقصود ومفيد — لكنه يجعل البديل العلاجي يزاحم
// المقصود على الصدارة ما لم يُخصَم وزنه.
const ALIAS_WEIGHT = 0.35

// المرادف الذي يشارك الكلمة الأصلية مفتاحها الصوتي ليس بديلًا بل هي نفسها بأبجدية أخرى
// («ادول» ⇄ `adol`)، فيستحقّ ما يقارب وزنها الكامل.
const TRANSLITERATION_WEIGHT = 0.95

// أقصر كلمة يُسمح لها بمطابقة سلسلة فرعية داخل كلمة أخرى. دون ذلك تصير المطابقة ضجيجًا:
// المرادف «tea» كان يلتقط «TEARS GUARD»، و«dol» يلتقط «مودافينيل».
const MIN_SUBSTRING_LEN = 4

/** عدد النتائج الذي يكفي الصفحة الأولى — عنده يتوقّف سُلَّم الإنقاذ فلا ينزل لطبقة أضعف. */
export const ENOUGH_RESULTS = 10

// كلمات عامّة يكتبها العميل حول الصنف لا اسمًا له. تُسقَط أولًا عند الإرخاء لأن إسقاطها
// لا يفقد معنى الاستعلام: «برشام صداع» ⇒ «صداع».
const STOP_TERMS = new Set(["دواء", "دوا", "علاج", "برشام", "برشامه", "عبوه", "علبه", "شريط", "منتج", "صنف"])

function textOf(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * خطّ الأنابيب الوحيد للنص — يمرّ عليه الفهرس والاستعلام معًا.
 *
 * وحدتهما شرط صحّة لا ترفٌ هندسي: لو جرّدنا «ال» من الاستعلام دون الفهرس لصار «شاي» يطابق
 * «الشاي الأحمر» بدرجة السلسلة الفرعية الضعيفة بدل درجة الكلمة الكاملة، ولانهار اقتراح الفئة.
 */
function prepareTokens(text: unknown): string[] {
  return splitSearchTokens(text).map(stripAl).filter(Boolean)
}

/**
 * يبني فهرس المتجر مرّة واحدة لكل قائمة منتجات. تمريرة واحدة تُنتج الحقول المطبَّعة والتوكنات
 * والمفاتيح الصوتية والمفردات معًا — لا داعي لأكثر من مرور على كتالوج فيه آلاف الأصناف.
 */
export function buildStoreIndex(products: readonly SearchableProduct[]): StoreIndex {
  const entries: Entry[] = []
  const byPhonetic = new Map<string, Array<{ at: number; len: number }>>()
  const vocabulary = new Map<string, number>()
  const categoryDf = new Map<string, number>()
  const categoriesByNormalized = new Map<string, string>()

  products.forEach((product, order) => {
    const nameTokens = prepareTokens(product.name)
    // الوصف والمادة الفعّالة والشركة والباركود: حقول ثانوية تُبحث لكنها لا تنافس الاسم.
    const extraRaw = [
      textOf(product.description),
      textOf(product.active_ingredient),
      textOf(product.manufacturer),
      textOf(product.barcode),
    ]
      .filter(Boolean)
      .join(" ")
    const extraTokens = prepareTokens(extraRaw)

    const rawCategory = textOf(product.category).trim()
    const categoryTokens = prepareTokens(rawCategory)
    if (rawCategory) categoriesByNormalized.set(categoryTokens.join(" "), rawCategory)
    for (const token of new Set(categoryTokens)) {
      categoryDf.set(token, (categoryDf.get(token) ?? 0) + 1)
    }

    const at = entries.length
    entries.push({
      id: product.id,
      order,
      rawCategory,
      name: nameTokens.join(" "),
      nameTokens,
      extra: extraTokens.join(" "),
      extraTokens,
      category: categoryTokens.join(" "),
      categoryTokens,
      inStock: Number(product.stock ?? 0) > 0,
      // تقييم موزون بعدد المراجعات: 5.0 من مراجعة واحدة يجب ألا يعلو 4.7 من مئتين.
      popularity: Number(product.rating ?? 0) * Math.log1p(Number(product.rating_count ?? 0)),
    })

    const seenInThisProduct = new Set<string>()
    for (const token of nameTokens) {
      if (!seenInThisProduct.has(token)) {
        seenInThisProduct.add(token)
        vocabulary.set(token, (vocabulary.get(token) ?? 0) + 1)
      }
      const key = phoneticKey(token)
      if (!isUsableKey(key)) continue
      const bucket = byPhonetic.get(key)
      if (bucket) bucket.push({ at, len: token.length })
      else byPhonetic.set(key, [{ at, len: token.length }])
    }
  })

  const bloatThreshold = entries.length * CATEGORY_BLOAT_RATIO
  const weakCategoryTokens = new Set<string>()
  for (const [token, count] of categoryDf) {
    if (count > bloatThreshold) weakCategoryTokens.add(token)
  }

  return { entries, byPhonetic, vocabulary, weakCategoryTokens, categoriesByNormalized }
}

/**
 * درجة توكن واحد على مُدخلة واحدة. صفر = لا تطابق إطلاقًا.
 *
 * `whole` يقصر المطابقة على الكلمة الكاملة. تستعمله المرادفات: المرادف اسمٌ كامل من الجدول لا
 * نصٌّ جزئيّ يكتبه المستخدم، فمطابقته كبادئة ضجيج محض — المرادف «tea» كان يلتقط «TEARS GUARD».
 */
function scoreToken(entry: Entry, token: string, weakCategories: Set<string>, whole = false): number {
  if (entry.name === token) return W_NAME_EXACT
  if (!whole && entry.name.startsWith(token)) return W_NAME_PREFIX

  let best = 0
  for (const nameToken of entry.nameTokens) {
    if (nameToken === token) return W_NAME_TOKEN
    if (!whole && nameToken.startsWith(token)) best = Math.max(best, W_NAME_TOKEN_PREFIX)
  }
  if (best) return best

  if (entry.extraTokens.includes(token)) return W_EXTRA_TOKEN
  // الفئة تُطابَق بالكلمة الكاملة لا بالسلسلة الفرعية، فلا يحجبها حارس الطول أدناه.
  if (!weakCategories.has(token) && entry.categoryTokens.includes(token)) return W_CATEGORY
  if (whole) return 0

  // المطابقة داخل الكلمة آخر ما يُجرَّب، وللكلمات الطويلة وحدها.
  if (token.length < MIN_SUBSTRING_LEN) return 0
  if (entry.name.includes(token)) return W_NAME_SUBSTRING
  if (entry.extra.includes(token)) return W_EXTRA_SUBSTRING
  return 0
}

type Scored = { at: number; score: number; matched: number }

// المتوفّر يسبق النافد دائمًا مهما بلغت درجة صلته — عرض صنف لا يمكن شراؤه في الصدارة إهدار
// لأثمن موضع في الصفحة. ثم الدرجة، ثم الشعبية، ثم الاسم الأقصر (الأقرب للصنف الأساسي لا العبوة
// المركّبة)، ثم الترتيب الأصلي كي يبقى الفرز مستقرًّا بين الرسمات.
function compareScored(a: Scored, b: Scored, entries: Entry[]): number {
  const ea = entries[a.at]
  const eb = entries[b.at]
  if (ea.inStock !== eb.inStock) return ea.inStock ? -1 : 1
  if (a.matched !== b.matched) return b.matched - a.matched
  if (a.score !== b.score) return b.score - a.score
  if (eb.popularity !== ea.popularity) return eb.popularity - ea.popularity
  if (ea.name.length !== eb.name.length) return ea.name.length - eb.name.length
  return ea.order - eb.order
}

function collect(scored: Scored[], entries: Entry[]): string[] {
  scored.sort((a, b) => compareScored(a, b, entries))
  return scored.map((s) => entries[s.at].id)
}

// مجموعة مكافئات لكلمة واحدة من الاستعلام: الكلمة نفسها ومرادفاتها من جدول الأسماء البديلة.
// الطبقة الدقيقة تستعمل مجموعات أحادية، وطبقة المرادفات تستعملها موسَّعة — بنفس الدالّة، فلا
// يتفرّع المنطق ولا تفترق دلالة الترتيب بين الطبقتين.
type Group = string[]

/**
 * أقوى موضع تطابق تبلغه أي كلمة في المجموعة. صفر = لم تطابق أيٌّ منها.
 *
 * الكلمة الأصلية (الموضع 0) تُقيَّم بكامل وزنها والمرادفات بجزء منه: مَن كتب «بنادول» يريد بنادول،
 * و«سيتال» بديلٌ علاجي يستحق الظهور لكن لا يستحق الصدارة. بلا هذا الخصم تعلو المرادفات على
 * المقصود متى تساوى موضع التطابق.
 */
function scoreGroup(entry: Entry, group: Group, weakCategories: Set<string>): number {
  let best = scoreToken(entry, group[0], weakCategories)
  if (group.length === 1) return best

  // النقحرة المباشرة تُميَّز عن البديل العلاجي بالمفتاح الصوتي نفسه: «adol» مفتاحها مفتاح «ادول»
  // فهي الكلمة ذاتها بأبجدية أخرى، بينما «cetal» صنف آخر بنفس المادة الفعّالة.
  const originalKey = phoneticKey(group[0])
  for (let i = 1; i < group.length; i++) {
    const raw = scoreToken(entry, group[i], weakCategories, true)
    if (!raw) continue
    const isTransliteration = originalKey.length > 0 && phoneticKey(group[i]) === originalKey
    const score = raw * (isTransliteration ? TRANSLITERATION_WEIGHT : ALIAS_WEIGHT)
    if (score > best) best = score
  }
  return best
}

/** الطبقة الدقيقة: كل مجموعة تطابق في مكان ما، والدرجة مجموع أوزان مواضعها. */
function allGroupsPass(index: StoreIndex, allowed: number[], groups: Group[]): Scored[] {
  const out: Scored[] = []
  for (const at of allowed) {
    const entry = index.entries[at]
    let total = 0
    let ok = true
    for (const group of groups) {
      const score = scoreGroup(entry, group, index.weakCategoryTokens)
      if (!score) {
        ok = false
        break
      }
      total += score
    }
    if (ok) out.push({ at, score: total, matched: groups.length })
  }
  return out
}

/** طبقة الإرخاء: تكفي مجموعة واحدة مطابِقة، والترتيب بعدد ما طابق ثم بالدرجة. */
function anyGroupPass(index: StoreIndex, allowed: number[], groups: Group[]): Scored[] {
  const out: Scored[] = []
  for (const at of allowed) {
    const entry = index.entries[at]
    let total = 0
    let matched = 0
    for (const group of groups) {
      const score = scoreGroup(entry, group, index.weakCategoryTokens)
      if (score) {
        total += score
        matched++
      }
    }
    if (matched) out.push({ at, score: total, matched })
  }
  return out
}

/**
 * الطبقة الصوتية: تعبر فجوة الأبجديتين («بنادول» ⇒ `Panadol`). طبقةُ إنقاذ فقط — لا تعمل إلا
 * إذا عجزت الطبقات النصّية، ونتائجها تُلحَق في الذيل ولا تعلو أبدًا فوق تطابق نصّي دقيق.
 *
 * الترتيب داخلها بفارق طول التوكن، وهو مقيس لا مفترض: بدونه يعيد استعلام «بروفين» صنف
 * `BARAFFIN OIL` قبل `BRUFEN` لأن مفتاحهما واحد (`brfn`).
 */
function phoneticPass(index: StoreIndex, allowed: Set<number>, tokens: string[]): Scored[] {
  // الكلمات القصيرة جدًّا لا مفتاح صالحًا لها، فتُستثنى من الشرط بدل أن تُفشله.
  const usable = tokens.map(phoneticKey).filter(isUsableKey)
  if (!usable.length) return []

  const hits = new Map<number, { matched: Set<string>; lenGap: number }>()
  usable.forEach((key, i) => {
    const queryLen = tokens[i]?.length ?? key.length
    for (const { at, len } of index.byPhonetic.get(key) ?? []) {
      if (!allowed.has(at)) continue
      const gap = Math.abs(len - queryLen)
      const prev = hits.get(at)
      if (prev) {
        prev.matched.add(key)
        prev.lenGap = Math.min(prev.lenGap, gap)
      } else {
        hits.set(at, { matched: new Set([key]), lenGap: gap })
      }
    }
  })

  // دلالة AND كالطبقة الدقيقة تمامًا. بدونها تصير الطبقة الصوتية إرخاءً صامتًا يسبق سُلَّم
  // الإرخاء المُعلَن، فيجد العميل نتائج لا يعرف لماذا ظهرت ولا أنّ كلمةً من استعلامه أُهمِلت.
  const required = new Set(usable).size
  return [...hits.entries()]
    .filter(([, h]) => h.matched.size === required)
    .map(([at, h]) => ({
      at,
      // فارق الطول يدخل الدرجة سالبًا كي يرتّب داخل الطبقة بلا حاجة إلى مقارن منفصل.
      score: h.matched.size * 100 - h.lenGap,
      matched: h.matched.size,
    }))
}

export type SearchOptions = {
  /** فئة المتجر النشطة كما تُعرض في الشريط، أو "all". */
  category?: string
  /** توسيع توكن إلى مرادفاته (جدول الأسماء البديلة). يُحقَن كي يبقى المحرّك نقيًّا وقابلًا للاختبار. */
  expand?: (token: string) => string[]
}

/**
 * يبحث في فهرس المتجر عبر سُلَّم من الطبقات، كلٌّ منها تعمل فقط إن عجزت سابقتها عن ملء الصفحة
 * الأولى. الترتيب مُلزِم: الدقّة أولًا، ثم المرادفات (حتمية)، ثم الصوت (تقريبي)، ثم الإرخاء.
 */
export function searchStore(index: StoreIndex, query: string, options: SearchOptions = {}): SearchOutcome {
  const { entries } = index
  const category = options.category && options.category !== "all" ? options.category : null

  const allowedList: number[] = []
  for (let at = 0; at < entries.length; at++) {
    if (category && entries[at].rawCategory !== category) continue
    allowedList.push(at)
  }

  const rawTokens = prepareTokens(query)
  if (!rawTokens.length) {
    return { ids: allowedList.map((at) => entries[at].id), tier: "all" }
  }

  // الكلمات العامّة تُسقَط قبل كل الطبقات لا داخل سُلَّم الإرخاء.
  //
  // موضعها هنا مقصود: «برشام بنادول» ليست استعلامًا فشل فاحتاج إرخاءً، بل استعلامٌ فيه كلمة
  // وصفية لا اسمية. إبقاؤها حتى الإرخاء يجعل الطبقات الأولى تفشل بلا سبب حقيقي، ويجعل الطبقة
  // الصوتية — وهي الأسرع في الالتقاط — تُنقذ الاستعلام بصمت فلا يُعلَم العميل أن كلمةً أُهمِلت.
  const meaningful = rawTokens.filter((token) => !STOP_TERMS.has(token))
  const genericDropped = meaningful.length && meaningful.length < rawTokens.length
    ? rawTokens.find((token) => STOP_TERMS.has(token))
    : undefined
  const tokens = meaningful.length ? meaningful : rawTokens

  // هل الاستعلام كلّه اسم فئة؟ يُرفَق دائمًا كي تعرضه الواجهة كتبويب — وهو المخرج الوحيد المعقول
  // حين تكون الفئة مُهمَلة في المطابقة لأنها تغطّي الكتالوج كله.
  const categorySuggestion = matchCategory(index, tokens)

  // ١) الطبقة الدقيقة
  const exact = allGroupsPass(index, allowedList, tokens.map((token) => [token]))
  if (exact.length >= ENOUGH_RESULTS) {
    return { ids: collect(exact, entries), tier: "exact", categorySuggestion, droppedToken: genericDropped }
  }

  const seen = new Set(exact.map((s) => s.at))
  const results = collect(exact, entries)
  let tier: SearchTier = exact.length ? "exact" : "empty"

  // ٢) الطبقة الصوتية — نقحرة مباشرة للكلمة نفسها عبر فجوة الأبجديتين.
  //
  // موضعها قبل جدول الأسماء البديلة مقصود ومقيس: الجدول يوحّد كل ما يشترك في مادة فعّالة، فـ
  // «بنادول» تجرّ معها «سيتال» و«أبيمول». وهذه بدائل يستحقّ العميل رؤيتها، لكن الصدارة لِما
  // كتبه هو. المفتاح الصوتي يعطي `Panadol` نفسها، فيسبق.
  const allowedSet = new Set(allowedList)
  const phonetic = phoneticPass(index, allowedSet, tokens).filter((s) => !seen.has(s.at))
  if (phonetic.length) {
    for (const hit of phonetic) seen.add(hit.at)
    results.push(...collect(phonetic, entries))
    if (tier === "empty") tier = "phonetic"
  }
  if (results.length >= ENOUGH_RESULTS) return { ids: results, tier, categorySuggestion, droppedToken: genericDropped }

  // ٣) جدول الأسماء البديلة — شبكة أوسع تلتقط ما عجز عنه الصوت (الأسماء القصيرة والبدائل العلاجية).
  // الدلالة: كل كلمة من الاستعلام **أو أحد مرادفاتها** يجب أن تطابق، فلا يتحوّل التوسيع إلى OR
  // فضفاض يُرجع كل ما يشترك في كلمة واحدة.
  if (options.expand) {
    const groups = tokens.map((token) => [token, ...options.expand!(token)])
    const widened = groups.some((group) => group.length > 1)
    if (widened) {
      const aliasHits = allGroupsPass(index, allowedList, groups).filter((s) => !seen.has(s.at))
      if (aliasHits.length) {
        for (const hit of aliasHits) seen.add(hit.at)
        results.push(...collect(aliasHits, entries))
        if (tier === "empty") tier = "alias"
      }
    }
  }
  if (results.length >= ENOUGH_RESULTS) return { ids: results, tier, categorySuggestion, droppedToken: genericDropped }

  // ٤) الإرخاء — أسقط أقلّ الكلمات انتقائيةً (أو كلمة عامّة) وأعد المحاولة
  if (tokens.length > 1) {
    const dropped = leastSelective(index, tokens)
    const kept = tokens.filter((token) => token !== dropped)
    if (kept.length) {
      const relaxed = allGroupsPass(index, allowedList, kept.map((token) => [token])).filter((s) => !seen.has(s.at))
      if (relaxed.length) {
        results.push(...collect(relaxed, entries))
        return { ids: results, tier: tier === "empty" ? "partial" : tier, droppedToken: dropped, categorySuggestion }
      }
    }
  }

  // ٥) آخر ما يُحاوَل: يكفي توكن واحد
  if (!results.length) {
    const loose = anyGroupPass(index, allowedList, tokens.map((token) => [token]))
    if (loose.length) return { ids: collect(loose, entries), tier: "partial", categorySuggestion, droppedToken: genericDropped }
  }

  return { ids: results, tier: results.length ? tier : "empty", categorySuggestion, droppedToken: genericDropped }
}

/**
 * يُرجع اسم الفئة الذي يغطّي الاستعلام كلّه، إن وُجد. المطابقة على مستوى التوكن لا السلسلة
 * الفرعية كي لا تُقترَح «العناية بالبشرة» لمن كتب «عناية» وحدها ويقصد شيئًا آخر.
 */
function matchCategory(index: StoreIndex, tokens: string[]): string | undefined {
  for (const [normalized, raw] of index.categoriesByNormalized) {
    const categoryTokens = normalized.split(" ").filter(Boolean)
    if (!categoryTokens.length) continue
    const covered = tokens.every((token) =>
      categoryTokens.some((categoryToken) => categoryToken === token || categoryToken.startsWith(token)),
    )
    if (covered) return raw
  }
  return undefined
}

/** الكلمة الأجدر بالإسقاط: كلمة عامّة إن وُجدت، وإلا الأكثر شيوعًا في مفردات المتجر. */
function leastSelective(index: StoreIndex, tokens: string[]): string {
  const generic = tokens.find((token) => STOP_TERMS.has(token))
  if (generic) return generic
  let worst = tokens[0]
  let worstCount = -1
  for (const token of tokens) {
    const count = index.vocabulary.get(token) ?? 0
    if (count > worstCount) {
      worstCount = count
      worst = token
    }
  }
  return worst
}
