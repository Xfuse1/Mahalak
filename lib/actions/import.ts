"use server"

// استيراد كتالوج المنتجات بالجملة من ملف كاشير (Excel/CSV). خطوتان: (1) parseImportFile يُرجّع
// المطابقة المقترحة + معاينة + تحذيرات؛ (2) commitImport يُعيد قراءة الملف (سلامة: القيم تُشتق من
// الملف لا من العميل) ويُنشئ المنتجات على دفعات. الملكية سيرفر-سايد: المتجر المستهدف = uid المستدعي.

import { revalidatePath, revalidateTag } from "next/cache"
import { FieldPath, FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { logError } from "@/lib/logger"
import { calculateProfitPerUnit } from "@/lib/utils/product-pricing"
import { extractTable, type Mapping } from "@/lib/import/parse"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { geminiMapColumns, isGeminiEnabled } from "@/lib/ai/gemini"
import { mapColumnsOpenAICompat, isOpenAICompatEnabled } from "@/lib/ai/openai-compat"

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
    const userOverride = parseMapping(formData.get("mapping"))
    let res = extractTable(buf, userOverride)
    let aiUsed = false
    // على التحليل الأول فقط (بلا تخصيص من التاجر) نطلب من الـAI تحسين المطابقة — يفوز على الاستدلال
    // حيث يعطي قيمة. الترتيب: OpenAI-compatible (NVIDIA) ثم Gemini؛ أي فشل/غياب مفتاح ⇒ نُبقي
    // الاستدلال (لا شيء يكسر).
    if (!userOverride) {
      let ai: Awaited<ReturnType<typeof geminiMapColumns>> = null
      if (isOpenAICompatEnabled()) ai = await mapColumnsOpenAICompat(res.headers, res.sampleRows)
      if (!ai && isGeminiEnabled()) ai = await geminiMapColumns(res.headers, res.sampleRows)
      if (ai) {
        res = extractTable(buf, { ...res.mapping, ...ai })
        aiUsed = true
      }
    }
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
      aiUsed,
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
  // معرّف جلسة الاستيراد من العميل (يُعقَّم): يجعل إعادة التزام نفس الدفعة تكتب فوق نفس المستندات.
  const importId = String(formData.get("importId") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 60)

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
    // فهرس الحلقة i على chunk هو الفهرس المحلي للصف؛ الفهرس العام = offset + i ولا يتأثر بالصفوف
    // المتخطّاة (continue)، فيبقى الربط صف↔معرّف ثابتًا عبر إعادة المحاولة.
    for (let i = 0; i < chunk.length; i++) {
      const d = chunk[i]
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
        // حالة الصورة: من الملف = "file"؛ بلا صورة = "pending" (مرشَّح لجلب صور لاحقًا بموافقة التاجر).
        image_status: d.image_url ? "file" : "pending",
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
      if (importId) {
        // معرّف deterministic لكل صف داخل جلسة الاستيراد: إعادة التزام نفس الدفعة بعد انقطاع
        // الرد تكتب فوق نفس المستندات (idempotent) بدل إنشاء منتجات مكرَّرة.
        batch.set(db.collection("products").doc(`imp_${uid}_${importId}_${offset + i}`), payload)
      } else {
        // توافق خلفي: عميل بلا importId يُبقي السلوك القديم بمعرّف عشوائي.
        batch.set(db.collection("products").doc(), payload)
      }
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

// (3) موافقة صريحة على جلب الصور: يعلّم منتجات المتجر بلا صورة (pending) → queued فتلتقطها مكنسة
// الكرون. الباركود يُطبَّق تلقائيًّا؛ البحث بالاسم (لاحقًا) مرشَّح للمراجعة.
export async function startImageFetch() {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  if (!(await checkRateLimit("import_imgfetch:" + uid, 10, 60_000))) return { ok: false as const, error: "rate_limited" }
  try {
    const db = getAdminDb()
    const snap = await db.collection("products").where("store_id", "==", uid).where("image_status", "==", "pending").limit(10000).get()
    const docs = snap.docs
    let queued = 0
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch()
      for (const d of docs.slice(i, i + 400)) { batch.update(d.ref, { image_status: "queued" }); queued++ }
      await batch.commit()
    }
    return { ok: true as const, queued }
  } catch (e) {
    logError("[import] startImageFetch", e)
    return { ok: false as const, error: "server_error" }
  }
}

// حالة جلب الصور لمتجر التاجر (عدّاد لكل حالة) — لعرض التقدّم.
export async function getImageStatus() {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const statuses = ["pending", "queued", "processing", "done", "review", "none", "file"] as const
    const counts: Record<string, number> = {}
    await Promise.all(
      statuses.map(async (s) => {
        const q = await db.collection("products").where("store_id", "==", uid).where("image_status", "==", s).count().get()
        counts[s] = q.data().count
      }),
    )
    return { ok: true as const, counts }
  } catch (e) {
    logError("[import] getImageStatus", e)
    return { ok: false as const, error: "server_error" }
  }
}

// ─── مراجعة صور البحث بالاسم (image_status="review") ───
// المرشَّح يُخزَّن في image_candidate ويبقى image_url فارغًا فلا يظهر للعميل، حتى يوافق التاجر
// (يُنقل المرشَّح إلى image_url والحالة done) أو يرفض (الحالة none). كل دالة تشتق الهوية من
// الجلسة وتفلتر/تتحقق من store_id == uid — لا نثق بأي معرّف من العميل.

// قائمة الصور بانتظار المراجعة لمتجر التاجر — ترقيم بمؤشر على documentId.
export async function getReviewImages(cursor?: string, limit = 40) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const pageSize = Math.min(Math.max(1, Math.floor(Number(limit) || 40)), 60)
    let q = db
      .collection("products")
      .where("store_id", "==", uid)
      .where("image_status", "==", "review")
      .orderBy(FieldPath.documentId())
      .limit(pageSize)
    if (cursor) q = q.startAfter(String(cursor))
    const snap = await q.get()
    const items = snap.docs.map((d) => ({
      id: d.id,
      name: String(d.data().name || ""),
      price: Number(d.data().price) || 0,
      image_candidate: String(d.data().image_candidate || ""),
    }))
    const nextCursor = snap.size === pageSize && snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null
    return { ok: true as const, items, nextCursor }
  } catch (e) {
    logError("[import] getReviewImages", e)
    return { ok: false as const, error: "server_error" }
  }
}

// عدّاد الصور بانتظار المراجعة — لعرضه في ترويسة الشاشة وزرّ «وافق على الكل».
export async function getReviewImagesCount() {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const q = await db.collection("products").where("store_id", "==", uid).where("image_status", "==", "review").count().get()
    return { ok: true as const, count: q.data().count }
  } catch (e) {
    logError("[import] getReviewImagesCount", e)
    return { ok: false as const, error: "server_error" }
  }
}

// موافقة على صورة مرشَّحة: تُنقل إلى image_url فتظهر للعملاء. ملكية المنتج تُتحقق قبل الكتابة.
export async function approveProductImage(productId: string) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const ref = db.collection("products").doc(String(productId))
    const doc = await ref.get()
    const p = doc.data()
    if (!doc.exists || p?.store_id !== uid) return { ok: false as const, error: "not_found" } // ملكية إلزامية
    const cand = String(p?.image_candidate || "")
    if (!cand) return { ok: false as const, error: "no_candidate" }
    await ref.update({
      image_url: cand,
      image_status: "done",
      image_candidate: FieldValue.delete(),
      updated_at: new Date().toISOString(),
    })
    revalidatePath("/seller/products")
    try { revalidateTag("products", "max") } catch {}
    return { ok: true as const }
  } catch (e) {
    logError("[import] approveProductImage", e)
    return { ok: false as const, error: "server_error" }
  }
}

// رفض صورة مرشَّحة: تُحذف وتُعلَّم الحالة none (يُعاد ترشيحها لاحقًا لو تغيّرت النتائج). image_url يبقى كما هو.
export async function rejectProductImage(productId: string) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const ref = db.collection("products").doc(String(productId))
    const doc = await ref.get()
    const p = doc.data()
    if (!doc.exists || p?.store_id !== uid) return { ok: false as const, error: "not_found" } // ملكية إلزامية
    await ref.update({
      image_status: "none",
      image_candidate: FieldValue.delete(),
      updated_at: new Date().toISOString(),
    })
    revalidatePath("/seller/products")
    return { ok: true as const }
  } catch (e) {
    logError("[import] rejectProductImage", e)
    return { ok: false as const, error: "server_error" }
  }
}

// موافقة جماعية على كل صور المراجعة (بسقف 5000) على دفعات كتابة ≤400 — الفلترة بـstore_id==uid
// في الاستعلام نفسه فلا تمسّ منتجًا لا يملكه التاجر.
export async function approveAllReviewImages() {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  if (!(await checkRateLimit("approve_all_images:" + uid, 10, 60_000))) return { ok: false as const, error: "rate_limited" }
  try {
    const db = getAdminDb()
    const snap = await db.collection("products").where("store_id", "==", uid).where("image_status", "==", "review").limit(5000).get()
    const now = new Date().toISOString()
    let approved = 0
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch()
      for (const d of snap.docs.slice(i, i + 400)) {
        const cand = String(d.data().image_candidate || "")
        if (!cand) continue
        batch.update(d.ref, {
          image_url: cand,
          image_status: "done",
          image_candidate: FieldValue.delete(),
          updated_at: now,
        })
        approved++
      }
      await batch.commit()
    }
    revalidatePath("/seller/products")
    try { revalidateTag("products", "max") } catch {}
    return { ok: true as const, approved }
  } catch (e) {
    logError("[import] approveAllReviewImages", e)
    return { ok: false as const, error: "server_error" }
  }
}
