"use server"

// استيراد كتالوج المنتجات بالجملة من ملف كاشير (Excel/CSV). خطوتان: (1) parseImportFile يُرجّع
// المطابقة المقترحة + معاينة + تحذيرات؛ (2) commitImport يُعيد قراءة الملف (سلامة: القيم تُشتق من
// الملف لا من العميل) ويُنشئ المنتجات على دفعات. الملكية سيرفر-سايد: المتجر المستهدف = uid المستدعي.

import { revalidatePath, revalidateTag } from "next/cache"
import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { logError } from "@/lib/logger"
import { calculateProfitPerUnit } from "@/lib/utils/product-pricing"
import { extractTable, type Mapping } from "@/lib/import/parse"
import { checkRateLimit } from "@/lib/utils/rate-limit"

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB — ملفات المخزون نصّية صغيرة عادةً
const MAX_PRODUCTS = 20000 // سقف أمان لكل رفعة
const COMMIT_CHUNK_MAX = 400 // أقل من حدّ الدُفعة (500) بهامش

function parseMapping(raw: FormDataEntryValue | null): Mapping | undefined {
  if (!raw) return undefined
  try {
    const o = JSON.parse(String(raw))
    const m: Mapping = {}
    for (const k of Object.keys(o)) { const v = Number(o[k]); if (Number.isInteger(v) && v >= 0) (m as any)[k] = v }
    return m
  } catch { return undefined }
}

// (1) تحليل الملف + معاينة. لا يكتب شيئًا. يتطلّب جلسة (تاجر).
export async function parseImportFile(formData: FormData) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  if (!(await checkRateLimit("import_parse:" + uid, 30, 60_000))) return { ok: false as const, error: "rate_limited" }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false as const, error: "no_file" }
  if (file.size > MAX_FILE_BYTES) return { ok: false as const, error: "file_too_large" }
  try {
    const buf = await file.arrayBuffer()
    const res = extractTable(buf, parseMapping(formData.get("mapping")))
    return {
      ok: true as const,
      sheetName: res.sheetName,
      sheetNames: res.sheetNames,
      headerRowIndex: res.headerRowIndex,
      headers: res.headers,
      mapping: res.mapping,
      total: res.stats.extracted,
      totalRows: res.totalDataRows,
      preview: res.drafts.slice(0, 100), // معاينة فقط — الالتزام يعيد قراءة الملف
      stats: res.stats,
      warnings: res.warnings,
    }
  } catch (e) {
    logError("[import] parseImportFile", e)
    return { ok: false as const, error: "parse_failed" }
  }
}

// (2) الالتزام على دفعات: يعيد قراءة الملف ويُنشئ منتجات [offset, offset+limit). العميل يكرّر حتى done.
export async function commitImport(formData: FormData) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  // كبح إنشاء منتجات بالجملة (100 دفعة/دقيقة تكفي استيرادًا كبيرًا وتحدّ الإساءة).
  if (!(await checkRateLimit("import_commit:" + uid, 100, 60_000))) return { ok: false as const, error: "rate_limited" }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false as const, error: "no_file" }
  if (file.size > MAX_FILE_BYTES) return { ok: false as const, error: "file_too_large" }
  const mapping = parseMapping(formData.get("mapping"))
  const defaultCategory = String(formData.get("defaultCategory") || "").trim().slice(0, 60) || "عام"
  const offset = Math.max(0, Number(formData.get("offset") || 0))
  const limit = Math.min(Math.max(1, Number(formData.get("limit") || COMMIT_CHUNK_MAX)), COMMIT_CHUNK_MAX)

  // تحقّق ملكية + اعتماد المتجر مرة واحدة (بدل createProduct لكل منتج) — ثم دُفعة كتابة.
  const db = getAdminDb()
  const userDoc = await db.collection("users").doc(uid).get()
  if (!userDoc.data()?.store?.is_approved) return { ok: false as const, error: "store_not_approved" }

  try {
    const buf = await file.arrayBuffer()
    const res = extractTable(buf, mapping)
    const all = res.drafts
    if (all.length > MAX_PRODUCTS) return { ok: false as const, error: "too_many_products" }
    const chunk = all.slice(offset, offset + limit)
    const now = new Date().toISOString()
    const batch = db.batch()
    let created = 0
    for (const d of chunk) {
      if (!d.name || !Number.isFinite(d.price) || d.price <= 0) continue
      let cost = Number.isFinite(d.cost_price) && d.cost_price > 0 ? d.cost_price : d.price
      if (cost > d.price) cost = d.price
      const stock = Math.max(0, Math.round(Number(d.stock) || 0))
      const payload = {
        name: d.name,
        description: "",
        price: d.price,
        cost_price: cost,
        profit_per_unit: calculateProfitPerUnit(d.price, cost),
        category: d.category && d.category.length ? d.category.slice(0, 60) : defaultCategory,
        stock,
        image_url: d.image_url || "",
        store_id: uid,
        barcode: d.barcode || "",
        simulator_section: null,
        reservation_enabled: stock === 0, // مخزون صفر ⇒ قابل للحجز كي يمرّ تحقّق المنتج ولا يضيع
        rating: 0,
        rating_count: 0,
        imported: true,
        import_unit: d.unit || "",
        import_sku: d.sku || "",
        created_at: now,
        updated_at: now,
      }
      batch.set(db.collection("products").doc(), payload)
      created++
    }
    if (created > 0) await batch.commit()
    const nextOffset = offset + chunk.length
    const done = nextOffset >= all.length
    if (done) {
      revalidatePath("/seller/products")
      try { revalidateTag("products", "max") } catch {}
    }
    return { ok: true as const, created, total: all.length, nextOffset, done }
  } catch (e) {
    logError("[import] commitImport", e)
    return { ok: false as const, error: "commit_failed" }
  }
}
