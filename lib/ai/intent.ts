// طبقة فهم النيّة للبحث الذكي. ملف **نقي** بلا شبكة ولا Firestore: يبني الـprompt ويتحقّق من الردّ،
// والنداء نفسه في [gemini.ts] و[openai-compat.ts] — نفس فصل [column-map.ts] المستخدَم في الاستيراد.
//
// العقد الحاكم للميزة كلها: **الموديل لا يرى الكتالوج ولا يذكر منتجًا ولا سعرًا.** يُرجع «مفاهيم»
// (أسماء أصناف عامّة) فقط، ثم يبحث عنها محرّكُنا في المنتجات الحقيقية ويسعّرها السيرفر من مستنداتها.
// لهذا لا يوجد سطح هلوسة أصلًا: أسوأ ما يفعله الموديل هو اقتراح مكوّن غير موجود، فيظهر «غير متوفر».

export const INTENT_KINDS = ["recipe", "symptom", "product", "generic"] as const
export type IntentKind = (typeof INTENT_KINDS)[number]

export type IntentItem = {
  /** اسم الطبق/المجموعة كما يُعرض للعميل («كشري مصري»). */
  name: string
  /** أصناف تُشترى، لا كميات ولا خطوات تحضير. */
  concepts: string[]
}

export type SearchIntent = {
  intent: IntentKind
  title: string
  items: IntentItem[]
}

// حدود الشكل. ليست تجميلًا: الرد يُعرض في واجهة ويُخزَّن في Firestore، ونصّ بلا حدّ من موديل
// يعني بطاقة مكسورة أو مستندًا منتفخًا. القصّ هنا مرّة واحدة بدل تكراره في كل مستهلك.
const MAX_ITEMS = 3
// أقصى عدد عناصر يُفحَص أصلًا (قبل القبول). سقفٌ على العمل لا على الناتج.
const MAX_SCANNED_ITEMS = 64
const MAX_TITLE_LEN = 80
const MAX_NAME_LEN = 60
const MAX_CONCEPT_LEN = 40

export function buildIntentPrompt(query: string, maxConcepts: number): string {
  const cap = Math.max(1, Math.min(50, Math.floor(maxConcepts) || 12))
  // العربية المصرية منصوصة في الـprompt: العميل يكتب «عايز اعمل» و«حاسس اني»، وموديل يردّ بالفصحى
  // يعطي مفاهيم لا تطابق أسماء أصناف السوق المصري («عدس بجبة» لا «عدس مقشور»).
  return `أنت طبقة فهم نيّة لمتجر إلكتروني مصري. المستخدم كتب استعلامًا بالعامية المصرية.

أرجع JSON فقط، بلا أي نص خارجه، بالشكل:
{"intent":"recipe|symptom|product|generic","title":"عنوان عربي قصير","items":[{"name":"اسم الطبق أو المجموعة","concepts":["صنف","صنف"]}]}

القواعد:
- "concepts" أسماء **أصناف تُباع في متجر مصري** بالعامية الشائعة (مثال: «عدس بجبة» لا «عدسيات»)، بلا كميات وبلا خطوات تحضير وبلا علامات تجارية أجنبية إن وُجد المكافئ المحلي.
- أقصى ${MAX_ITEMS} عناصر، وأقصى ${cap} مفهومًا في المجموع.
- "recipe" لطلب أكلة أو وجبة، "symptom" لشكوى صحية، "product" لطلب صنف أو غرض محدّد، "generic" لغير ذلك.
- لو الاستعلام شكوى صحية: أرجع أصنافًا مرتبطة فقط. **ممنوع تمامًا** ذكر جرعة أو مدّة أو نصيحة علاجية أو تشخيص.
- "title" وصف عربي قصير لما فهمته، بلا مقدّمات.

الاستعلام: ${String(query).slice(0, 300)}`
}

// محارف تحكّم غير مرئية — نفس مجموعة [lib/utils/arabic.ts] وللسبب نفسه: تنجو من `trim` ومن المسافات،
// فتُفسد المطابقة لاحقًا في محرّك البحث. تُكتب بالهروب لا حرفيًّا كي تبقى مرئية لمن يقرأ الملف.
const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g

function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return ""
  return value
    .replace(INVISIBLE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
}

/**
 * يتحقّق من ردّ الموديل ويقصّه على الحدود. يُرجع `null` إن لم يبقَ مفهوم واحد صالح — وهي الحالة
 * التي يسقط فيها المُستدعي للبحث العادي بدل أن يعرض بطاقة فارغة.
 *
 * متساهل عمدًا في الشكل وصارم في المحتوى: موديل يردّ `items` بدل `concepts` أو يلفّ الردّ في مصفوفة
 * أمرٌ يقع فعلًا، وإسقاط الاستعلام كلّه بسببه خسارة بلا مقابل. أما ما يُعرَض ويُسعَّر فيمرّ بالحدود كلّها.
 */
export function parseIntent(raw: unknown, maxConcepts: number): SearchIntent | null {
  const cap = Math.max(1, Math.min(50, Math.floor(maxConcepts) || 12))
  const root = Array.isArray(raw) ? raw[0] : raw
  if (!root || typeof root !== "object") return null
  const obj = root as Record<string, unknown>

  const kind = INTENT_KINDS.includes(obj.intent as IntentKind) ? (obj.intent as IntentKind) : "generic"
  const title = cleanText(obj.title, MAX_TITLE_LEN)

  // الحلقة تتوقّف عند سقف العناصر أو المفاهيم، لكن مصفوفةً ضخمة كلُّ عناصرها بلا مفاهيم صالحة
  // لا تُحرّك أيًّا من العدّادين ⇒ لفٌّ بطول ما يرسله المزوّد. الردّ مصدرٌ خارجي، فيُقصّ عند الحدّ.
  const rawItems = (Array.isArray(obj.items) ? obj.items : []).slice(0, MAX_SCANNED_ITEMS)
  const items: IntentItem[] = []
  // التكرار يُمنع عبر العناصر كلها لا داخل العنصر وحده: «بصل» في طبقين يُنتج بحثين متطابقين
  // ونتيجتين متطابقتين في سلة واحدة — أي أن العميل يدفع مرّتين ثمن نفس الصنف.
  const seenConcepts = new Set<string>()
  let total = 0

  for (const rawItem of rawItems) {
    if (items.length >= MAX_ITEMS || total >= cap) break
    if (!rawItem || typeof rawItem !== "object") continue
    const itemObj = rawItem as Record<string, unknown>
    const name = cleanText(itemObj.name, MAX_NAME_LEN)
    const rawConcepts = Array.isArray(itemObj.concepts) ? itemObj.concepts : []

    const concepts: string[] = []
    for (const rawConcept of rawConcepts) {
      if (total >= cap) break
      const concept = cleanText(rawConcept, MAX_CONCEPT_LEN)
      if (!concept) continue
      const dedupeKey = concept.toLowerCase()
      if (seenConcepts.has(dedupeKey)) continue
      seenConcepts.add(dedupeKey)
      concepts.push(concept)
      total++
    }

    if (concepts.length) items.push({ name: name || title || "نتائج", concepts })
  }

  if (!items.length) return null
  return { intent: kind, title: title || items[0].name, items }
}

// كلمات تُصدَّر بها الجملة الطالبة في العامية المصرية. وجودها إشارة نيّة لا إشارة صنف: مَن يكتب
// «عايز أعمل كشري» لا يبحث عن صنف اسمه «عايز».
const INTENT_OPENERS = [
  "عايز", "عاوز", "محتاج", "نفسي", "ازاي", "إزاي", "ايه", "إيه", "حاسس", "عندي",
  "اعمل", "أعمل", "هعمل", "ينفع", "ممكن", "افضل", "أفضل", "احسن", "أحسن", "مش لاقي",
]

/**
 * كلمات **حالة** تكفي وحدها لاختيار الوضع الذكي، ولو جاءت كلمةً واحدة.
 *
 * لازمة لأن قاعدة «أربع كلمات أو كلمة طلب» تفوّت أوضح الأمثلة على الإطلاق: «جعان» كلمة واحدة بلا
 * فعل طلب ⇒ كانت تُعامَل كاسم صنف فيبحث عنها البحثُ العادي حرفيًّا ولا يجدها. وهي تحديدًا المثال
 * الذي بُنيت الميزة حوله.
 *
 * الشرط: كلمةٌ تصف **حال المستخدم** ولا تصلح اسمًا لصنف يُباع. لهذا لا تدخل هنا كلمات مثل «عصير»
 * أو «دواء» — لها منتجات بأسمائها. والاختيار اقتراحٌ لا إلزام: المبدّل يبقى بيد المستخدم.
 */
const STATE_WORDS = [
  "جعان", "جعانه", "جعانة", "عطشان", "عطشانه", "مصدع", "مصدعه", "تعبان", "تعبانه",
  "زهقان", "بردان", "سخن", "مرهق", "مخنوق", "دايخ", "دايخه", "وجعان", "تعبانه",
]

/**
 * هل يُحوَّل هذا الاستعلام تلقائيًّا للبحث الذكي؟
 *
 * البوابة سلوكية لا لغوية: كلمة أو كلمتان بحثٌ عن صنف («بنادول»، «شامبو كلير») والبحث العادي أسرع
 * وأدقّ فيهما، بينما الجملة أو السؤال نيّةٌ لا اسم. الزرّ يبقى للتحكّم اليدوي في الحالتين — هذه
 * الدالّة تختار الافتراضي فقط، ولا تمنع المستخدم من شيء.
 */
export function shouldUseAiSearch(query: string): boolean {
  const text = String(query || "").trim()
  if (!text) return false
  if (text.includes("?") || text.includes("؟")) return true
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length >= 4) return true
  if (words.some((word) => INTENT_OPENERS.includes(word))) return true
  // كلمة الحالة تكفي وحدها — «جعان» وحدها نيّةٌ كاملة لا اسم صنف.
  return words.some((word) => STATE_WORDS.includes(word))
}

// أعلام حمراء: شكاوى لا يجوز أن يقابلها عرض منتجات إطلاقًا مهما كان الإعداد.
//
// بوابة سلامة لا تصفية جودة، ولهذا هي **حتمية سيرفر-سايد** لا مبنية على تصنيف الموديل: الموديل قد
// يصنّف «بينزف» كـ`product` فيمرّ، والقائمة هنا تراه في الحالتين.
//
// حدّ القائمة مقصود: الطوارئ فقط. «حامل» و«مرضعة» و«رضيع» **ليست** طوارئ — بل موانع صرف دواء،
// ومكانها بوابة الأصناف التي لا تحتاج روشتة في المرحلة 2. إدراجها هنا كان يعني ردّ «توجّه للطوارئ»
// على أمّ تشتري لبن أطفال، وحجب «لبن رضيع» وهو صنف يُباع فعلًا على المنصّة.
// **المفردات عامّية مصرية لا فصحى.** هذا شرط عمل لا أسلوب: الآليّة (تجريد السوابق واللواحق ونافذة
// الحشو) تعمل، لكن مَن يكتب في تطبيق مصري لا يقول «تقيّؤ دموي» بل «بيرجّع دم»، ولا «تسمّم» بل
// «ابني شرب فلاش». قائمةٌ فصيحة تجعل البوابة تمسك الصياغة التي لا تُكتَب وتُفلت التي تُكتَب.
const RED_FLAG_TERMS = [
  // فقدان وعي وتنفّس
  "اغماء", "فقدت الوعي", "مش واعي", "مش بيرد", "مش بيفوق", "غيبوبة",
  "تشنجات", "تشنج", "بيتشنج", "ضيق تنفس", "مش قادر اتنفس", "مش بيتنفس",
  "صعوبة تنفس", "نفسه واقف", "اختناق", "زور مسدود",

  // قلب وأوعية
  "الم صدر", "وجع صدر", "جلطة", "سكتة", "شلل", "لساني تقل", "وشي مايل",

  // نزف — بالفصحى وبالعامّية معًا
  "نزيف", "بينزف", "ينزف", "قيء دم", "بيرجع دم", "ترجيع دم", "رجع دم",
  "براز اسود", "دم مع البراز", "دم في البراز", "بيتبرز دم",

  // جرعات زائدة (ابتلاع المواد في `RED_FLAG_PAIRS` أدناه — تتابع الكلمات لا يكفي له)
  "تسمم", "جرعة زايدة", "جرعة زائدة", "اخد الشريط كله", "اكل الشريط", "بلع الشريط",

  // لدغات وعضّات
  "قرصة تعبان", "لدغة تعبان", "لدغة عقرب", "قرصة عقرب", "عضة كلب", "عضني كلب",

  // إصابات
  "حروق", "كسر", "انتحار",
]

// الصرف العربي يكسر المطابقة بالكلمة الكاملة من الطرفين: سوابق تلتصق بالأول («بألم»، «وبنزيف»)
// ولواحق ملكية تلتصق بالآخر («صدري»، «صدرها»). كلا الحالتين مقيسة على الاختبار لا مفترضة —
// «حاسس بألم صدر» و«ألم في صدري» كانتا تُفلتان من البوابة.
//
// الشرط الطولي يمنع التخريب في الاتجاه الآخر: «بصل» ⇒ «صل» تجعل من كلمة بقالةٍ ضجيجًا، فلا يُجرَّد
// حرفٌ إلا إن بقي بعده جذع ذو معنى (ثلاثة محارف فأكثر).
const CLITIC_PREFIXES = ["و", "ف", "ب", "ل", "ك"]
const POSSESSIVE_SUFFIXES = ["ها", "ي", "ه", "ك"]
const MIN_STEM = 3
const MAX_CLITICS = 2

/** كل الصور المعقولة لكلمة واحدة: هي نفسها، ومجرّدةً من سوابقها ولواحقها ما بقي لها معنى. */
function wordForms(token: string): string[] {
  const forms = new Set<string>([token])
  let stem = token
  for (let i = 0; i < MAX_CLITICS; i++) {
    if (stem.length - 1 < MIN_STEM || !CLITIC_PREFIXES.includes(stem[0])) break
    stem = stem.slice(1)
    forms.add(stem)
  }
  for (const base of Array.from(forms)) {
    for (const suffix of POSSESSIVE_SUFFIXES) {
      if (base.endsWith(suffix) && base.length - suffix.length >= MIN_STEM) {
        forms.add(base.slice(0, -suffix.length))
      }
    }
  }
  return Array.from(forms)
}

/**
 * أزواج (فعل ابتلاع، مادة خطِرة) — تُطابَق بالتواجد في الاستعلام لا بالتتابع.
 *
 * لأن هذه الحالة تحديدًا تكسر مطابقةَ التتابع من طرفين معًا، وكلاهما مقيس على صياغات حقيقية:
 * الفعل يأتي **مصرَّفًا** («بلعت»، «شربوا») فلا يساوي المصدر، والمادة تأتي **بعيدة** عنه
 * («شرب اللي في ازازة الفلاش» — ثلاث كلمات بينهما). ونافذة الحشو لا تُوسَّع لأجلها: توسيعها يفتح
 * تطابقات كاذبة في كل المصطلحات الأخرى.
 *
 * الفعل يُطابَق كبادئة («بلع» ⊂ «بلعت») والمادة ككلمة كاملة. وهذا آمن من الالتباس: «شراب» ليست
 * «شرب» بادئةً (ألف بينهما)، و«مشروب» لا تبدأ بها، و«بطارية» وحدها بلا فعل ابتلاع لا تُفعّل شيئًا.
 */
const RED_FLAG_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["شرب", "كلور"], ["شرب", "فلاش"], ["شرب", "سبرتو"], ["شرب", "كحول"],
  ["شرب", "مبيد"], ["شرب", "بنزين"], ["شرب", "جاز"], ["شرب", "مطهر"], ["شرب", "ديتول"],
  ["بلع", "بطارية"], ["بلع", "لمبة"], ["بلع", "عملة"], ["بلع", "دبوس"], ["بلع", "مسمار"],
  ["بلع", "مفتاح"], ["بلع", "زرار"],
]

// كلمات حشو مسموح بها بين كلمتي المصطلح الواحد. «ضيق في التنفس» و«ألم في صدري» أشيع في العامية من
// الصيغة المتلاصقة، وصفرُ حشوٍ كان يعني بوابةً تمسك الصياغة الفصيحة وتُفلت الصياغة الحقيقية.
const MAX_GAP = 1

/**
 * هل يحمل الاستعلام علَمًا أحمر يوجب إحالة طبية بلا أي عرض منتجات؟
 *
 * المطابقة على **تتابع كلمات** لا على سلسلة نصّية: «دم» يجب ألا تلتقط «دمياط» ولا «مدمس». ولهذا
 * يُحقن المُقسِّم (`searchTokens`) بدل التطبيع وحده — فتبقى قاعدة التقسيم واحدة في المشروع كلّه
 * ويبقى هذا الملف نقيًّا قابلًا للاختبار بلا اعتماد.
 */
export function hasRedFlag(query: string, tokenize: (input: string) => string[]): boolean {
  const tokens = tokenize(String(query || ""))
  if (!tokens.length) return false
  const forms = tokens.map(wordForms)

  const matchesAt = (needle: string[], start: number): boolean => {
    let at = start
    for (let j = 0; j < needle.length; j++) {
      if (j > 0) {
        // ابحث عن الكلمة التالية داخل نافذة الحشو المسموح بها
        let found = -1
        for (let step = 1; step <= MAX_GAP + 1 && at + step < forms.length; step++) {
          if (forms[at + step].includes(needle[j])) {
            found = at + step
            break
          }
        }
        if (found < 0) return false
        at = found
        continue
      }
      if (!forms[at].includes(needle[j])) return false
    }
    return true
  }

  for (const term of RED_FLAG_TERMS) {
    const needle = tokenize(term)
    if (!needle.length) continue
    for (let i = 0; i < forms.length; i++) {
      if (matchesAt(needle, i)) return true
    }
  }

  // أزواج الابتلاع: تواجدٌ في الاستعلام لا تتابعٌ فيه، والفعل يُطابَق كبادئة لأنه يأتي مصرَّفًا.
  const has = (needle: string, asPrefix: boolean) =>
    forms.some((wordForms) => wordForms.some((w) => (asPrefix ? w.startsWith(needle) : w === needle)))
  for (const [verb, substance] of RED_FLAG_PAIRS) {
    const v = tokenize(verb)[0]
    const s = tokenize(substance)[0]
    if (v && s && has(v, true) && has(s, false)) return true
  }

  return false
}
