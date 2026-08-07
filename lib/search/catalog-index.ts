// فهرس الكتالوج العام (سيرفر) — يوصّل محرّك البحث المرجّح [engine.ts] بالبحث العام في الموقع.
// ملف نقي بلا I/O ولا Firestore: يستقبل قائمة المنتجات جاهزة، فيبقى قابلًا للاختبار بلا شبكة.
//
// ما كان قبله في `_searchProductsImpl`: `name.includes(q) || description.includes(q) || storeName.includes(q)`
// على الكتالوج كله. ثلاثة أعطال، كلها **مقيسة على بيانات الإنتاج** (1689 منتجًا / 25 متجرًا) لا مفترضة:
//
//   1. **لا تطبيع عربي إطلاقًا.** `toLowerCase()` لا تفعل شيئًا للعربية: «صيدليه» لا تطابق «صيدلية»،
//      و«ادويه» لا تطابق «أدوية»، و«بنادول٢٤» لا تطابق «بنادول 24». الكتالوج مستورد من ملفات كاشير
//      متعددة فالصيغ مختلطة أصلًا.
//   2. **لا جسر بين الأبجديتين.** 1531 من 1689 اسم منتج (90.6%) **لا يحوي حرفًا عربيًّا واحدًا**،
//      بينما العميل المصري يكتب «بنادول». `includes` بين أبجديتين نتيجتها صفر مهما تطابق المعنى.
//   3. **لا ترتيب.** النتائج بترتيب مستندات Firestore. ولا يُنقذها الوصف: **145 منتجًا فقط من 1689
//      لهم وصف غير فارغ** (8.6%)، و`barcode`/`active_ingredient`/`manufacturer` غير فارغة في **منتج
//      واحد** لكل منها ⇒ حقل الاسم هو عمليًّا كل ما يوجد، والترتيب عليه هو كل الفرق.
//
// المحرّك يحلّ الثلاثة وهو مختبَر بالفعل، فهذا الملف **لا يعيد بناء منطق بحث**. يفعل شيئين فقط:
// يحفظ الفهرس كي لا يُعاد بناؤه لكل استعلام، ويضيف طبقة واحدة فوقه: مطابقة اسم المتجر.

import { aliasesForToken } from "./aliases"
import { buildStoreIndex, searchStore, type SearchableProduct, type SearchTier, type StoreIndex } from "./engine"
import { isUsableKey, phoneticKey } from "./phonetic"
import { normalizeArabic, searchTokens } from "../utils/arabic"

/** الحدّ الأدنى الذي يحتاجه الفهرس من مستند المنتج. كل الحقول اختيارية عدا المعرّف. */
export type CatalogProduct = {
  id: string
  name?: string | null
  description?: string | null
  category?: string | null
  stock?: number | null
  rating?: number | null
  rating_count?: number | null
  active_ingredient?: string | null
  barcode?: string | null
  manufacturer?: string | null
  store_id?: string | null
  /** يُختَم في كل إنشاء/تعديل/تغيير مخزون — هو ما يجعل بصمة الفهرس ترى تعديل المحتوى. */
  updated_at?: string | null
  /** اسم المتجر كما يصل في حمولة القائمة (`publicStoreFields`)، أو المسطَّح `storeName`. */
  stores?: { name?: string | null } | null
  storeName?: string | null
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/** اسم متجر المنتج من أي من الصيغتين اللتين تصلان من `getProducts` (المتداخلة والمسطَّحة). */
export function storeNameOf(product: CatalogProduct): string {
  return textOrEmpty(product.stores?.name) || textOrEmpty(product.storeName)
}

function toSearchable(product: CatalogProduct): SearchableProduct {
  return {
    id: product.id,
    name: textOrEmpty(product.name),
    description: product.description ?? null,
    category: product.category ?? null,
    stock: Number(product.stock ?? 0),
    rating: Number(product.rating ?? 0),
    rating_count: Number(product.rating_count ?? 0),
    active_ingredient: product.active_ingredient ?? null,
    barcode: product.barcode ?? null,
    manufacturer: product.manufacturer ?? null,
  }
}

// شبكة أمان زمنية، لا آلية الإبطال الأساسية (تلك هي البصمة أدناه). ليست «مساوية» لنافذة
// `unstable_cache` في `getProducts`: الساعتان متراكبتان لا متزامنتان، فبيانات عمرها 59 ثانية قد
// يُبنى منها فهرس يعيش 60 ثانية أخرى ⇒ الحدّ الأعلى للتقادم ≈120 ثانية لو كانت البصمة وحدها هي
// الحارس. لهذا لا يُترك التقادم للزمن أصلًا.
const INDEX_TTL_MS = 60_000

// البصمة تغطّي الإضافة والحذف وإعادة الترتيب **وتعديل المحتوى**: `updated_at` يُختَم في كل إنشاء
// وتعديل وتغيير مخزون (products.ts:485, 584, 951)، فتصحيح تاجر لاسم صنف يُبطل الفهرس فورًا بدل
// أن ينتظر انتهاء العمر — وهي الحالة التي يبحث فيها العميل بالتهجئة الجديدة فلا يجد شيئًا.
// المرور مرّة واحدة رخيص (≈1689 مستندًا) مقابل إعادة بناء تُقسّم آلاف الأسماء وتحسب مفاتيحها الصوتية.
function fingerprint(products: readonly CatalogProduct[]): string {
  let out = String(products.length)
  let newest = ""
  for (const product of products) {
    out += "|" + product.id
    const stamp = typeof product.updated_at === "string" ? product.updated_at : ""
    if (stamp > newest) newest = stamp
  }
  return out + "@" + newest
}

let cached: { index: StoreIndex; key: string; builtAt: number } | null = null

/** يبني فهرس الكتالوج أو يعيد المحفوظ إن كانت البيانات نفسها ولم ينتهِ عمره. */
export function getCatalogIndex(products: readonly CatalogProduct[], now = Date.now()): StoreIndex {
  const key = fingerprint(products)
  if (cached && cached.key === key && now - cached.builtAt < INDEX_TTL_MS) return cached.index
  const index = buildStoreIndex(products.map(toSearchable))
  cached = { index, key, builtAt: now }
  return index
}

// ترتيب منتجات المتجر المطابِق اسمه: المتوفّر أولًا ثم الأعلى تقييمًا — نفس قاعدة المحرّك
// (`compareScored`) كي لا يختلف سلوك الذيل عن سلوك الصدارة.
function compareByAvailability(a: CatalogProduct, b: CatalogProduct): number {
  const aIn = Number(a.stock ?? 0) > 0
  const bIn = Number(b.stock ?? 0) > 0
  if (aIn !== bIn) return aIn ? -1 : 1
  return Number(b.rating ?? 0) - Number(a.rating ?? 0)
}

// أقصر كلمة يُسمح لها بمطابقة *وسط* اسم المتجر. نفس عتبة `MIN_SUBSTRING_LEN` في المحرّك وللسبب
// نفسه، مضروبًا في الأثر: «جرّ متجر» ليس نتيجةً زائدة بل كتالوجه كلّه — 1557 صنفًا في أكبر متجر.
//
// وهذا **التضييق الوحيد المقصود** مقابل `storeName.includes(q)` القديمة، وهو مقيس لا مقدَّر: على
// 438 استعلامًا حقيقيًّا (38 يدويًّا + 400 مولَّدًا من أسماء منتجات الإنتاج نفسها) لم يفقد الجديد
// شيئًا إلا في استعلامين من حرفين اثنين صادفا وسط اسم متجر — «يد» داخل «صيدلية د/رامي البارودي»
// فأغرقت 1557 صنفًا، و«بي» داخل «خلطبيطه». إغراق العميل بكتالوج متجر لأنه كتب حرفين ليس نتيجة
// يخسرها، والعتبة تمنعه. أي استعلام من ثلاثة أحرف فأكثر يجد متجره كما كان.
const MIN_STORE_SUBSTRING_LEN = 4

/**
 * معرّفات المتاجر التي يغطّي اسمُها الاستعلامَ **كاملًا** (كل كلماته، لا أيّها).
 *
 * التغطية الكاملة لا الجزئية: مَن كتب «عطارة الأقصر» يقصد المتجر، ومَن كتب «زيت» لا يقصد كل منتجات
 * متجر اسمه «زيوت ومكسّرات».
 *
 * والمطابقة على ثلاث درجات لكل كلمة: كلمة كاملة، فبادئة كلمة، فسلسلة داخل الاسم للكلمات الطويلة
 * وحدها. الدرجة الثالثة ليست ترفًا: أسماء المتاجر المصرية تُكتب موصولة («سوبرماركت النور»)، فقصر
 * المطابقة على حدود الكلمات كان يُسقط استعلام «ماركت» تمامًا وهو ما كانت `includes` القديمة تجده.
 */
function storesMatchingName(products: readonly CatalogProduct[], tokens: readonly string[]): Set<string> {
  const nameByStore = new Map<string, string>()
  for (const product of products) {
    const storeId = textOrEmpty(product.store_id)
    if (!storeId || nameByStore.has(storeId)) continue
    nameByStore.set(storeId, storeNameOf(product))
  }

  const matched = new Set<string>()
  for (const [storeId, name] of nameByStore) {
    if (!name) continue
    const nameTokens = searchTokens(name)
    if (!nameTokens.length) continue
    const joined = nameTokens.join(" ")
    const covered = tokens.every(
      (token) =>
        nameTokens.some((nt) => nt === token || nt.startsWith(token)) ||
        (token.length >= MIN_STORE_SUBSTRING_LEN && joined.includes(token)),
    )
    if (covered) matched.add(storeId)
  }
  return matched
}

/**
 * ذيل الإنقاذ: ما تحتويه أسماؤه/أوصافه كلَّ كلمات الاستعلام كسلاسل فرعية ولم يلتقطه المحرّك.
 *
 * سببه واحد ومقيس: المحرّك يمنع المطابقة داخل الكلمة لما دون أربعة محارف (وهو منع صائب — «dol»
 * كانت تلتقط «مودافينيل»)، فاستعلام «سكر» على الإنتاج فقد صنفًا واحدًا كانت `includes` القديمة
 * تجده. العتبة تحمي **الترتيب** لا **الاسترجاع**، والفرق أن هذه النتائج تُلحَق في الذيل: لا تزاحم
 * تطابقًا حقيقيًّا على الصدارة، ولا يخسر مستخدمٌ نتيجةً يراها اليوم.
 *
 * وهو مُعمَّم على السلوك القديم لا مساوٍ له: القديم يطابق الاستعلام الخام متّصلًا على نص خام،
 * وهذا يطابق كل كلمة على حدة بعد التطبيع ⇒ كل ما كان يجده القديم يجده هذا وزيادة.
 */
function substringTail<T extends CatalogProduct>(
  products: readonly T[],
  tokens: readonly string[],
  seen: ReadonlySet<string>,
): T[] {
  const out: T[] = []
  for (const product of products) {
    if (seen.has(product.id)) continue
    const haystack = normalizeArabic(`${textOrEmpty(product.name)} ${textOrEmpty(product.description)}`)
    if (!haystack) continue
    if (tokens.every((token) => haystack.includes(token))) out.push(product)
  }
  out.sort(compareByAvailability)
  return out
}

/**
 * البحث العام في كتالوج كل المتاجر: ترتيب المحرّك أولًا، ثم منتجات المتاجر التي طابق اسمُها.
 *
 * إلحاق منتجات المتجر في الذيل لا في المتن مقصود: مَن كتب اسم متجر يريد المتجر (وتبويب المتاجر
 * يعرضه)، فإقحام 1557 صنفًا فوق تطابقات المنتجات كان يدفن المقصود. وإسقاط الطبقة كلّيًّا كان
 * سيخسر ما تُرجعه `storeName.includes(q)` اليوم، وهو ما لا يجوز.
 *
 * حدّ التغطية الوحيد موصوف عند `MIN_STORE_SUBSTRING_LEN` — وهو الاستثناء الوحيد المقيس على 438
 * استعلامًا حقيقيًّا. ما عداه: كل ما تجده `includes` القديمة يجده هذا (انظر `substringTail`).
 */
export function searchCatalog<T extends CatalogProduct>(products: readonly T[], query: string, now = Date.now()): T[] {
  const tokens = searchTokens(query)
  if (!tokens.length) return [...products]

  const index = getCatalogIndex(products, now)
  const outcome = searchStore(index, query, { expand: aliasesForToken })

  const byId = new Map<string, T>()
  for (const product of products) byId.set(product.id, product)

  const ordered: T[] = []
  const seen = new Set<string>()
  for (const id of outcome.ids) {
    const product = byId.get(id)
    if (!product || seen.has(id)) continue
    seen.add(id)
    ordered.push(product)
  }

  // ترتيب الذيلين مقصود: «متجرك هو المقصود» إشارةٌ أقوى من «الحروف صادفت وسط كلمة».
  const matchedStores = storesMatchingName(products, tokens)
  if (matchedStores.size) {
    const storeTail = products.filter(
      (product) => !seen.has(product.id) && matchedStores.has(textOrEmpty(product.store_id)),
    )
    storeTail.sort(compareByAvailability)
    for (const product of storeTail) {
      seen.add(product.id)
      ordered.push(product)
    }
  }

  ordered.push(...substringTail(products, tokens, seen))

  return ordered
}

/**
 * مطابقة **مفهوم واحد** (مكوّن من سلة البحث الذكي) بمنتجات حقيقية: ترتيب المحرّك وحده، بلا ذيل
 * اسم المتجر ولا ذيل السلسلة الفرعية.
 *
 * إقصاء الذيلين شرط صحّة لا تبسيط: البحث العام يريد ألّا يخسر نتيجةً يراها المستخدم، أما السلة
 * فتأخذ **النتيجة الأولى وتضعها في العربة**. ذيلٌ يُرجع منتجات متجر لأن اسمه صادف كلمة، أو صنفًا
 * صادفت حروفه وسط كلمة، يعني صنفًا خاطئًا يشتريه العميل فعلًا لا نتيجةً زائدة يتجاهلها.
 *
 * و`tier` يُرجَع لأنه إشارة الثقة التي حسبها المحرّك أصلًا: `exact` = المقصود بعينه، وما دونه
 * (`alias`/`phonetic`/`partial`) بديلٌ معقول تُعلّمه الواجهة «بديل» بدل أن تمرّره كأنه المطلوب.
 */
export function matchConcept<T extends CatalogProduct>(
  products: readonly T[],
  concept: string,
  options: { storeId?: string; limit?: number; now?: number } = {},
): { items: T[]; tier: SearchTier } {
  const tokens = searchTokens(concept)
  if (!tokens.length) return { items: [], tier: "empty" }

  const index = getCatalogIndex(products, options.now ?? Date.now())
  const head = headToken(tokens)
  const byId = new Map<string, T>()
  for (const product of products) byId.set(product.id, product)
  const limit = Math.max(1, options.limit ?? 5)

  const collectFor = (text: string, minStrength: number): { items: T[]; tier: SearchTier } => {
    const outcome = searchStore(index, text, { expand: aliasesForToken })
    const scored: Array<{ product: T; strength: number; at: number }> = []
    let at = 0
    for (const id of outcome.ids) {
      const product = byId.get(id)
      at++
      if (!product) continue
      if (options.storeId && textOrEmpty(product.store_id) !== options.storeId) continue
      // حارس السلة: اسم المنتج لازم يحمل الكلمة الحاملة مهما قالت الطبقة التي أنتجت النتيجة.
      const strength = headStrength(product, head)
      if (strength < minStrength) continue
      scored.push({ product, strength, at })
    }
    // إعادة ترتيب محلّية على المقبولين وحدهم: المحرّك يُقدّم الطبقة الصوتية على جدول المرادفات عمدًا
    // (مَن كتب «بنادول» يريد `Panadol` قبل «سيتال»)، لكن على مفهومٍ **تُشترى** نتيجته ينقلب الميزان:
    // «أيبوبروفين» كانت تُرجع `BARAFFIN OIL` (تصادف صوتي) قبل `BRUFEN` (مرادف مكتوب بيد بشرية).
    scored.sort((a, b) => (b.strength - a.strength) || (a.at - b.at))
    return { items: scored.slice(0, limit).map((s) => s.product), tier: outcome.tier }
  }

  const full = collectFor(concept, STRENGTH_PHONETIC)
  if (full.items.length) return full

  // المفهوم كلّه لم يُطابَق ⇒ أعد المحاولة بالكلمة الحاملة وحدها.
  //
  // إسقاط التخصيص لا الصنف: «حفاضات أطفال» في كتالوج لا يذكر «أطفال» على العبوة ⇒ «حفاضات بامبرز»
  // هي المقصود بعينه. أما ترك سُلَّم إرخاء المحرّك يختار ما يُسقطه فقد كان يُسقط **الصنف** ويُبقي
  // التخصيص، فيعيد «سرنجة شراب أطفال» — ويشتريها العميل.
  //
  // والعتبة هنا أعلى: بعد إسقاط تخصيصٍ لا نقبل أيضًا إشارةً ضعيفة. البادئة والمرادف كلاهما مقبول
  // على المفهوم الكامل ومرفوض هنا — «حمام كريم» كانت تصير «منظف الحمامات» (بادئة)، و«لبن صناعي»
  // تصير «body milk» (مرادف عابر للّغتين على كلمة عامّة).
  if (tokens.length > 1) {
    const fallback = collectFor(head, STRENGTH_EXACT)
    if (fallback.items.length) return { items: fallback.items, tier: "partial" }
  }

  return { items: [], tier: "empty" }
}

// أقصر كلمة يُوثق بمطابقتها كبادئة داخل الاسم. دونها المطابقة صدفة حروف: «خل» تطابق «خلطة
// لتنظيف الأطباق»، و«بن» تطابق «بنطلون».
const MIN_HEAD_LEN = 3

/**
 * الكلمة الحاملة للمعنى في المفهوم — أوّل كلمة ذات طول معتبر.
 *
 * العربية رأسية-أولى في التركيب الإضافي والوصفي: «حفاضات أطفال»، «لبن بودرة»، «زيت جوز هند»،
 * «منظف سيراميك» — الأولى هي الصنف والبقية تخصيص. ولهذا تُشترط الأولى تحديدًا لا أيّ كلمة:
 * اشتراط «أيّ كلمة» يقبل «سرنجة شراب **أطفال**» لطلب «**حفاضات** أطفال».
 */
function headToken(tokens: readonly string[]): string {
  return tokens.find((token) => token.length >= MIN_HEAD_LEN) ?? tokens[0]
}

// درجات قوّة المطابقة، من الأقوى للأضعف. ترتيبها هو ترتيب الثقة: الكلمة نفسها أوثق من مرادف
// مكتوب بيد بشرية، والمرادف أوثق من بادئة، والبادئة أوثق من تصادف صوتي.
const STRENGTH_NONE = 0
const STRENGTH_PHONETIC = 1
const STRENGTH_PREFIX = 2
const STRENGTH_ALIAS = 3
const STRENGTH_EXACT = 4

/**
 * قوّة حمل **اسم** المنتج لكلمةِ المفهوم الحاملة.
 *
 * الاسم وحده لا الوصف ولا الفئة: الوصف حقلٌ حرّ يكتب فيه التاجر ما يشاء، ومطابقته كانت تُرجع
 * «ربع ملوحة منظفة» لطلب «بصل». وهذا شرط قبولٍ في **السلة** فقط — البحث العام يبقى واسعًا كما هو،
 * لأن نتيجةً ضعيفة هناك يتجاوزها المستخدم، وهنا تدخل عربته.
 */
function headStrength(product: CatalogProduct, head: string): number {
  if (!head) return STRENGTH_NONE
  const nameTokens = searchTokens(textOrEmpty(product.name))
  if (!nameTokens.length) return STRENGTH_NONE

  if (nameTokens.some((nt) => nt === head)) return STRENGTH_EXACT

  const aliases = aliasesForToken(head)
  if (aliases.length && nameTokens.some((nt) => aliases.includes(nt))) return STRENGTH_ALIAS

  if (head.length >= MIN_HEAD_LEN && nameTokens.some((nt) => nt.startsWith(head))) return STRENGTH_PREFIX

  // النقحرة تعبر الأبجديتين حيث يعجز النصّ: «بلسم» ⇄ `BALSAM`. مقصورة على المفاتيح الصالحة
  // (ثلاثة محارف فأكثر) وإلا كثرت التصادمات.
  const key = phoneticKey(head)
  if (isUsableKey(key) && nameTokens.some((nt) => phoneticKey(nt) === key)) return STRENGTH_PHONETIC

  return STRENGTH_NONE
}

/**
 * مفتاح كاش مستقرّ للاستعلام: الكلمات المطبَّعة المجرَّدة من أداة التعريف مرتّبةً كما كُتبت.
 *
 * الاشتقاق من نفس خطّ الأنابيب الذي يستهلكه المحرّك يجعل تساوي المفتاح **مكافئًا** لتساوي النتيجة:
 * «الشاي» و«شاي» و« شاي  » تُنتج المفتاح ذاته لأنها تُنتج التوكنات ذاتها، فتشترك في مدخلة كاش واحدة
 * بدل ثلاث. أي مفتاح لا يمرّ بنفس التطبيع يخاطر بأن يخدم استعلامًا نتيجةَ استعلام آخر.
 */
export function catalogQueryKey(query: string): string {
  return searchTokens(query).join(" ")
}
