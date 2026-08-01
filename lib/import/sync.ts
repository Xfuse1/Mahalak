// منطق «مزامنة المخزون اليومية»: يقارن ملف الكاشير اليومي بالكتالوج الحالي ويحسب خطة التحديث —
// دالة نقية (بلا Firestore) كي تُختبَر رقميًّا. المطابقة بالكود (import_sku). القرارات (مثبَّتة مع المالك):
//   • كود موجود  → تحديث المخزون + السعر + التكلفة (ونحافظ على الاسم/الصورة/الوصف/الفئة = شغل التاجر اليدوي).
//   • كود جديد   → إضافة منتج (يدخل طابور جلب الصور).
//   • كود في الكتالوج ومش في ملف النهاردة → مخزون = صفر (نفد) — للمستورَد-بكود فقط.
//   • صف بلا كود → يُتجاهَل (كي لا يتكرّر كل يوم).
import { calculateProfitPerUnit } from "../utils/product-pricing"
import type { ProductDraft } from "./parse"

// المنتج الموجود كما نقرأه من Firestore (حقول قليلة عبر .select).
export type ExistingProduct = {
  id: string
  sku: string // import_sku (قد يكون فارغًا ⇒ لا يُطابَق ولا يُصفَّر — منتج يدوي مثلاً)
  stock: number
  price: number
  cost_price: number
  expiry?: string // expiry_date الحالي (YYYY-MM-DD) — للمقارنة عند مزامنة الصلاحية
}

export type SyncUpdate = {
  id: string
  sku: string
  stock: number
  price: number
  cost_price: number
  profit_per_unit: number
  expiry?: string // يُضبط فقط عند تغيّر تاريخ الصلاحية (وإلا لا نلمسه)
}

export type SyncPlan = {
  updates: SyncUpdate[] // منتجات موجودة تغيّر فيها المخزون/السعر/التكلفة فعلاً
  creates: ProductDraft[] // أكواد جديدة لا مثيل لها في الكتالوج
  zeroIds: string[] // موجود بكود وغاب عن الملف ومخزونه > 0 ⇒ يُصفَّر
  matchedUnchanged: number // طوبق لكن بلا تغيير (لا كتابة)
  noSku: number // صفوف الملف بلا كود (مُتجاهَلة)
  dupSkuInFile: number // أكواد مكرّرة داخل الملف نفسه (يفوز الأخير)
}

// تطبيع الكود للمطابقة: توحيد الأرقام العربية-الهندية (كي يطابق كود "١٢٣" في استيراد قديم كودَ "123"
// في ملف اليوم) + قصّ/توحيد المسافات + حالة الأحرف (الأكواد قد تكون أبجدية-رقمية).
const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" }
export function normalizeSku(raw: unknown): string {
  return String(raw ?? "").replace(/[٠-٩]/g, (d) => AR_DIGITS[d] || d).replace(/\s+/g, " ").trim().toLowerCase()
}

// أي حقول يوفّرها ملف اليوم فعلاً — لا نحدّث حقلًا غائبًا عن الملف (كي لا نمحو تكلفة/مخزون التاجر).
export type SyncFields = { hasStock: boolean; hasCost: boolean; hasExpiry?: boolean }

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const intStock = (n: unknown) => Math.max(0, Math.round(Number(n) || 0))
const eqMoney = (a: number, b: number) => Math.round((Number(a) || 0) * 100) === Math.round((Number(b) || 0) * 100)

// يحسب خطة المزامنة من (الكتالوج الحالي + مسودّات الملف). لا يكتب شيئًا.
// fields: أي حقول يوفّرها الملف — بلا عمود مخزون لا نحدّث المخزون ولا نصفّر؛ بلا عمود تكلفة نُبقي
// التكلفة القديمة (نعيد حساب الربح من السعر الجديد). الافتراضي: الملف يوفّر الاثنين (توافق الاختبارات).
export function computeSyncPlan(existing: ExistingProduct[], drafts: ProductDraft[], fields: SyncFields = { hasStock: true, hasCost: true }): SyncPlan {
  // خريطة الملف بالكود (آخر تكرار يفوز) + عدّ التكرار + الصفوف بلا كود.
  const fileBySku = new Map<string, ProductDraft>()
  let noSku = 0
  let dupSkuInFile = 0
  for (const d of drafts) {
    const sku = normalizeSku(d.sku)
    if (!sku) { noSku++; continue }
    if (fileBySku.has(sku)) dupSkuInFile++
    fileBySku.set(sku, d)
  }

  // كل أكواد الكتالوج الحالية (غير الفارغة) — لتحديد أيّ كود في الملف جديد فعلاً.
  const existingSkuSet = new Set<string>()
  for (const e of existing) { const s = normalizeSku(e.sku); if (s) existingSkuSet.add(s) }

  const updates: SyncUpdate[] = []
  const zeroIds: string[] = []
  let matchedUnchanged = 0

  for (const e of existing) {
    const sku = normalizeSku(e.sku)
    if (!sku) continue // بلا كود ⇒ لا يُطابَق ولا يُصفَّر (لا نلمس المنتجات اليدوية)
    const d = fileBySku.get(sku)
    if (d) {
      // القيم الفعّالة: المخزون من الملف فقط لو فيه عمود مخزون (وإلا نُبقي القديم)؛ التكلفة من الملف
      // فقط لو فيه عمود تكلفة (وإلا نُبقي القديمة — لا نمحو هامش التاجر). السعر دائمًا من الملف (إلزامي).
      const stock = fields.hasStock ? intStock(d.stock) : intStock(e.stock)
      const price = round2(d.price)
      const cost = fields.hasCost
        ? round2(Math.min(Number(d.cost_price), price)) // التكلفة لا تتجاوز السعر
        : round2(Math.min(Number(e.cost_price), price)) // نُبقي القديمة لكن لا تتجاوز السعر الجديد
      // الصلاحية: نحدّثها فقط لو الملف فيه عمود صلاحية وقيمته موجودة ومختلفة (لا نمحو القديمة ببلاغ).
      const newExpiry = fields.hasExpiry && d.expiry ? String(d.expiry) : ""
      const expiryChanged = !!newExpiry && newExpiry !== String(e.expiry || "")
      const sameMoneyStock = eqMoney(e.price, price) && eqMoney(e.cost_price, cost) && intStock(e.stock) === stock
      if (sameMoneyStock && !expiryChanged) {
        matchedUnchanged++
      } else {
        const u: SyncUpdate = { id: e.id, sku, stock, price, cost_price: cost, profit_per_unit: calculateProfitPerUnit(price, cost) }
        if (expiryChanged) u.expiry = newExpiry
        updates.push(u)
      }
    } else if (fields.hasStock && intStock(e.stock) > 0) {
      // كود موجود في الكتالوج لكنه غاب عن ملف النهاردة ⇒ نفد ⇒ صفّر (فقط لو الملف ملف مخزون ومخزونه > 0).
      zeroIds.push(e.id)
    }
  }

  // الجديد: أكواد الملف اللي مالهاش مثيل في الكتالوج كله.
  const creates: ProductDraft[] = []
  for (const [sku, d] of fileBySku) if (!existingSkuSet.has(sku)) creates.push(d)

  return { updates, creates, zeroIds, matchedUnchanged, noSku, dupSkuInFile }
}
