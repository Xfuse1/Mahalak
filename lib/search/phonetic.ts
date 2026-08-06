// جسر صوتي بين العربي واللاتيني لأسماء المنتجات. ملف نقي بلا I/O — يستورده العميل.
//
// لماذا هذا الملف موجود أصلًا: كتالوج الصيدلية على المنصّة مستورَد من ملف كاشير، و**96% من
// أسماء أصنافه لا تحوي حرفًا عربيًّا واحدًا** (قياس على 1594 اسمًا: 1529 لاتينية بالكامل)، بينما
// العميل المصري يكتب «بنادول» و«كتافلام». المشكلة إذن ليست أن العربية مكتوبة بصور مختلفة — بل أن
// المخزون بأبجدية والعميل بأبجدية أخرى.
//
// ولماذا لا تكفي مسافة التحرير: المسافة بين «بنادول» و«Panadol» تساوي طول السلسلة كاملًا، فأي
// تصحيح إملائي مهما تساهل لا يعبر هذه الفجوة. الحلّ هو إسقاط الأبجديتين في فضاء ثالث مشترك.
//
// الفكرة: احذف الحركات (لا تُكتب في العربية أصلًا ولا يُعتمد عليها في النقل الحرفي)، ووحّد
// الأصوات التي يخلط بينها النقل المصري (b=p فلا فرق بين بنادول وPanadol، f=v=ph، k=c=q، g=j)،
// ثم اضغط التكرار. الناتج مفتاح قصير يتطابق عبر الأبجديتين.

// الحروف العربية → أصواتها. المدخل يجب أن يكون مطبَّعًا بـ`normalizeArabic` أولًا (فلا همزات
// ولا تاء مربوطة ولا تشكيل). الحروف المُهمَلة (ا/ع/ء) نادرًا ما تُمثَّل في النقل اللاتيني.
const AR_PHON: Record<string, string> = {
  "ب": "b",
  "ت": "t", "ث": "t", "ط": "t",
  "ج": "g", "غ": "g",
  "ح": "h", "ه": "h",
  "خ": "k", "ك": "k", "ق": "k",
  "د": "d", "ض": "d",
  "ذ": "z", "ز": "z", "ظ": "z",
  "ر": "r",
  "س": "s", "ص": "s",
  "ش": "x",
  "ف": "f",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ع": "", "ا": "", "ء": "",
}

const ARABIC_RANGE = /[؀-ۿ]/
const REPEATED = /(.)\1+/g

/**
 * أقصر مفتاح صوتي يُسمح باستعماله. دون ذلك تكثر التصادمات الضارّة.
 *
 * العتبة 3 لا 4، والفارق مقيس: عند 4 نخسر «سيتال» ← `CETAL 500 MG` (مفتاحها `stl`). وعند 3
 * نكسبها ونخسر «ادول» و«ريفو» (مفتاحهما بطول 2) — وهاتان يغطّيهما جدول الأسماء البديلة اليدوي،
 * وهو أدقّ من أي اشتقاق صوتي للأسماء القصيرة.
 */
export const PHONETIC_MIN_KEY = 3

// و/ي: صامتتان في أول الكلمة فقط (وارفارين ⇒ w)، وحرفا مدّ في وسطها فتُهمَلان كالحركات.
function phoneticAr(word: string): string {
  let out = ""
  const chars = Array.from(word)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === "و" || ch === "ي") {
      if (i === 0) out += ch === "و" ? "w" : "y"
      continue
    }
    out += AR_PHON[ch] ?? (/[a-z0-9]/.test(ch) ? ch : "")
  }
  return out.replace(REPEATED, "$1")
}

// ترتيب الاستبدالات مُلزِم: الثنائيات (ph/sh/ch…) قبل المفردات، و«c» قبل الصائتة قبل «c» العامّة.
function phoneticLatin(word: string): string {
  const folded = word
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/kh/g, "k")
    .replace(/sh/g, "x")
    .replace(/ch/g, "k")
    .replace(/th/g, "t")
    .replace(/ck/g, "k")
    .replace(/qu/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/p/g, "b")
    .replace(/v/g, "f")
    .replace(/j/g, "g")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/[^a-z]/g, "")

  let out = ""
  for (let i = 0; i < folded.length; i++) {
    const ch = folded[i]
    if ("aeiou".includes(ch)) continue
    if ((ch === "w" || ch === "y") && i !== 0) continue
    out += ch
  }
  return out.replace(REPEATED, "$1")
}

/**
 * يُرجع المفتاح الصوتي لكلمة واحدة مطبَّعة. الكلمة العربية واللاتينية المتكافئتان تُعطيان
 * المفتاح نفسه: `phoneticKey("بنادول") === phoneticKey("panadol") === "bndl"`.
 *
 * المفتاح الأقصر من `PHONETIC_MIN_KEY` غير صالح للاستعمال — على المستدعي فحص الطول.
 */
export function phoneticKey(token: string): string {
  if (!token) return ""
  return ARABIC_RANGE.test(token) ? phoneticAr(token) : phoneticLatin(token)
}

/** هل هذا المفتاح صالح للمطابقة الصوتية؟ (طوله يبلغ العتبة) */
export function isUsableKey(key: string): boolean {
  return key.length >= PHONETIC_MIN_KEY
}
