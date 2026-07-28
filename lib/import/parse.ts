// استيراد كتالوج المنتجات من ملفات برامج الكاشير (Excel/CSV). محلّل + كشف صف العناوين + مطابقة
// أعمدة بالكلمات المفتاحية (عربي/إنجليزي) + تطبيع القيم. مصمَّم ليتحسّن لاحقًا بمطابقة الـAI (Gemini)،
// لكنه يعمل وحده على ملفات كاشير حقيقية (اختُبر على تقرير مخزون صيدلية 1715 صفًا).
import * as XLSX from "xlsx"

export type FieldKey = "name" | "price" | "cost_price" | "stock" | "unit" | "brand" | "sku" | "barcode" | "category" | "image"
export type Mapping = Partial<Record<FieldKey, number>> // الحقل → رقم العمود في الملف
export type HeaderCell = { index: number; label: string }
export type ProductDraft = {
  name: string
  price: number
  cost_price: number
  stock: number
  unit?: string
  brand?: string
  sku?: string
  barcode?: string
  category?: string
  image_url?: string
}
export type ExtractResult = {
  sheetNames: string[]
  sheetName: string
  headerRowIndex: number
  headers: HeaderCell[]
  mapping: Mapping
  totalDataRows: number
  drafts: ProductDraft[]
  stats: { extracted: number; skipped: number; priceBelowCost: number; zeroStock: number }
  warnings: string[]
}

const KW: Record<FieldKey, string[]> = {
  name: ["الاسم", "الإسم", "اسم الصنف", "اسم المنتج", "الصنف", "المنتج", "البيان", "name", "product", "item", "description", "desc", "title"],
  price: ["سعر البيع", "س.البيع", "سعر", "البيع", "price", "selling", "retail", "sale price", "unit price"],
  cost_price: ["م.التكلفة", "التكلفة", "تكلفة", "سعر الشراء", "م.الشراء", "الشراء", "cost", "purchase", "buy price", "wholesale"],
  stock: ["الكمية", "كمية", "المخزون", "مخزون", "رصيد", "المتاح", "stock", "quantity", "qty", "balance", "on hand", "available"],
  unit: ["الوحدة", "وحدة", "unit", "uom"],
  brand: ["الشركة", "شركة", "الماركة", "ماركة", "brand", "company", "manufacturer", "vendor", "supplier", "الموزع", "الموردون"],
  sku: ["الكود", "كود", "رقم الصنف", "code", "sku", "item code", "ref", "الرقم"],
  barcode: ["باركود", "الباركود", "barcode", "gtin", "ean", "upc"],
  category: ["التصنيف", "تصنيف", "القسم", "المجموعة", "الفئة", "category", "cat", "group", "department", "type", "class"],
  image: ["صورة", "الصورة", "image", "img", "photo", "picture", "url", "link"],
}
// عناوين لا يصحّ أن تُطابَق كسعر البيع أو التكلفة أو المخزون (إجمالى = سعر×كمية، نسبة، ضريبة…)
const NEG: Partial<Record<FieldKey, string[]>> = {
  price: ["إجمالى", "اجمالى", "اجمالي", "إجمالي", "total", "تكلفة", "التكلفة", "cost", "ربح", "نسبة", "%", "خصم", "ضريبة", "شراء"],
  cost_price: ["إجمالى", "اجمالى", "اجمالي", "إجمالي", "total", "ربح", "نسبة", "%", "بيع"],
  stock: ["إجمالى", "اجمالى", "total", "تكلفة", "cost", "قيمة", "value", "سعر", "price"],
}

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase()
const includesAny = (label: string, kws: string[]) => { const l = norm(label); return kws.some((k) => l.includes(norm(k))) }

// رقم عربي/إنجليزي: يشيل الفواصل والعملة والرموز، ويحوّل الأرقام العربية الهندية.
const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" }
export function parseNum(v: unknown): number {
  if (v == null || v === "") return NaN
  let s = String(v).replace(/[٠-٩]/g, (d) => AR_DIGITS[d] || d)
  s = s.replace(/[^\d.\-]/g, "")
  if (!s || s === "-" || s === ".") return NaN
  return Number(s)
}

// صف العناوين قد لا يكون الأول (تقارير الكاشير فيها صفوف عنوان فوق الجدول). نختار الصف بأعلى عدد
// خلايا تطابق كلمات العناوين المعروفة.
export function detectHeaderRow(rows: unknown[][]): number {
  const allKw = Object.values(KW).flat()
  let best = 0, bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const cells = (rows[i] || []).map(norm).filter(Boolean)
    if (cells.length < 3) continue
    let score = 0
    for (const c of cells) if (allKw.some((k) => c.includes(norm(k)))) score++
    if (score > bestScore) { bestScore = score; best = i }
  }
  return best
}

export function suggestMapping(headers: HeaderCell[]): Mapping {
  const map: Mapping = {}
  for (const field of Object.keys(KW) as FieldKey[]) {
    for (const h of headers) {
      if (!h.label) continue
      const neg = NEG[field]
      if (neg && neg.some((n) => norm(h.label).includes(norm(n)))) continue
      if (includesAny(h.label, KW[field])) { map[field] = h.index; break }
    }
  }
  return map
}

// يبني مسودّات المنتجات من صفوف البيانات وفق المطابقة، مع تطبيع + تخطّي الصفوف غير الصالحة.
export function buildDrafts(dataRows: unknown[][], mapping: Mapping) {
  const drafts: ProductDraft[] = []
  let skipped = 0, priceBelowCost = 0, zeroStock = 0
  for (const r of dataRows) {
    const name = mapping.name != null ? String(r[mapping.name] ?? "").trim() : ""
    if (!name) { skipped++; continue }
    const price = mapping.price != null ? parseNum(r[mapping.price]) : NaN
    if (!Number.isFinite(price) || price <= 0) { skipped++; continue }
    let cost = mapping.cost_price != null ? parseNum(r[mapping.cost_price]) : NaN
    if (!Number.isFinite(cost) || cost <= 0) cost = price // لا تكلفة ⇒ التكلفة = السعر (ربح 0)
    if (cost > price) { priceBelowCost++; cost = price } // تصحيح: التكلفة لا تتجاوز السعر (لتمرير التحقق)
    const stock = mapping.stock != null ? Math.max(0, Math.round(parseNum(r[mapping.stock]) || 0)) : 0
    if (stock === 0) zeroStock++
    const g = (k?: number) => (k != null ? String(r[k] ?? "").trim() : "")
    drafts.push({
      name: name.slice(0, 200),
      price: Math.round(price * 100) / 100,
      cost_price: Math.round(cost * 100) / 100,
      stock,
      unit: g(mapping.unit) || undefined,
      brand: g(mapping.brand) || undefined,
      sku: g(mapping.sku) || undefined,
      barcode: g(mapping.barcode) || undefined,
      category: g(mapping.category) || undefined,
      image_url: g(mapping.image) || undefined,
    })
  }
  return { drafts, stats: { extracted: drafts.length, skipped, priceBelowCost, zeroStock } }
}

// نقطة الدخول: يستخرج الجدول من buffer الملف (xls/xlsx/csv) ويُرجّع المطابقة والمسودّات والتحذيرات.
// override يسمح للتاجر بتصحيح المطابقة (يُدمج فوق المقترحة).
export function extractTable(buffer: ArrayBuffer | Uint8Array | Buffer, override?: Mapping): ExtractResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" })
  const headerRowIndex = detectHeaderRow(rows)
  const headers: HeaderCell[] = (rows[headerRowIndex] || [])
    .map((label, index) => ({ index, label: String(label ?? "").trim() }))
    .filter((h) => h.label)
  const suggested = suggestMapping(headers)
  // عند وجود تخصيص من التاجر نعتبره المطابقة الكاملة (لا ندمجه فوق المقترحة) — وإلا لا يمكن إلغاء
  // مطابقة حقل شاله التاجر (كان يرجع للمقترحة). بلا تخصيص (أول تحليل) ⇒ المقترحة.
  const mapping: Mapping = override ?? suggested
  const dataRows = rows.slice(headerRowIndex + 1)
  const { drafts, stats } = buildDrafts(dataRows, mapping)

  const warnings: string[] = []
  if (mapping.name == null) warnings.push("لم نتعرّف على عمود «اسم المنتج» — اختره يدويًا.")
  if (mapping.price == null) warnings.push("لم نتعرّف على عمود «سعر البيع» — اختره يدويًا.")
  if (mapping.cost_price == null) warnings.push("لا يوجد عمود «التكلفة» — سنعتبر التكلفة = السعر (ربح صفر). عدّلها لو حبيت.")
  if (mapping.category == null) warnings.push("لا يوجد عمود «التصنيف» — اختر تصنيفًا افتراضيًا لكل المنتجات.")
  if (mapping.barcode == null && mapping.image == null) warnings.push("لا يوجد باركود أو صور في الملف — الصور تُضاف لاحقًا (المرحلة 2) بالبحث بالاسم.")
  if (stats.skipped > 0) warnings.push(`تخطّينا ${stats.skipped} صفًّا (بلا اسم أو بسعر غير صالح — غالبًا صفوف فارغة/ملخّص).`)
  if (stats.priceBelowCost > 0) warnings.push(`${stats.priceBelowCost} منتج سعره أقل من تكلفته في الملف — صحّحنا التكلفة = السعر. راجعها.`)

  return { sheetNames: wb.SheetNames, sheetName, headerRowIndex, headers, mapping, totalDataRows: dataRows.length, drafts, stats, warnings }
}
