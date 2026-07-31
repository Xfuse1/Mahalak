"use server"

// استيراد كتالوج المنتجات بالجملة من ملف كاشير (Excel/CSV). خطوتان: (1) parseImportFile يُرجّع
// المطابقة المقترحة + معاينة + تحذيرات؛ (2) commitImport يُعيد قراءة الملف (سلامة: القيم تُشتق من
// الملف لا من العميل) ويُنشئ المنتجات على دفعات. الملكية سيرفر-سايد: المتجر المستهدف = uid المستدعي.

import { createHash } from "crypto"
import { revalidatePath, revalidateTag } from "next/cache"
import { FieldPath, FieldValue, type Firestore, type DocumentReference } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentUid } from "@/lib/auth/session"
import { logError } from "@/lib/logger"
import { calculateProfitPerUnit } from "@/lib/utils/product-pricing"
import { extractTable, type Mapping } from "@/lib/import/parse"
import { computeSyncPlan, normalizeSku, type ExistingProduct } from "@/lib/import/sync"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { geminiMapColumns, isGeminiEnabled } from "@/lib/ai/gemini"
import { mapColumnsOpenAICompat, isOpenAICompatEnabled } from "@/lib/ai/openai-compat"

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB — ملفات المخزون نصّية صغيرة عادةً
const MAX_PRODUCTS = 20000 // سقف أمان لكل رفعة
const COMMIT_CHUNK_MAX = 400 // أقل من حدّ الدُفعة (500) بهامش

// مفاتيح المطابقة المعروفة فقط — نمنع نسخ مفاتيح عشوائية من العميل (تضخّم مستند المتجر عند حفظ البروفايل).
const FIELD_KEYS = new Set(["name", "price", "cost_price", "stock", "unit", "brand", "sku", "barcode", "category", "image"])
function parseMapping(raw: FormDataEntryValue | null): Mapping | undefined {
  if (!raw) return undefined
  try {
    const o = JSON.parse(String(raw))
    const m: Mapping = {}
    for (const k of Object.keys(o)) {
      if (!FIELD_KEYS.has(k)) continue
      const v = Number(o[k]); if (Number.isInteger(v) && v >= 0) (m as any)[k] = v
    }
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
      // احفظ بروفايل الاستيراد (المطابقة + التصنيف الافتراضي) على المتجر — كي تظهر «مزامنة يومية»
      // في الرفعات القادمة بلا إعادة ضبط. لا نثق بمطابقة العميل: نحفظ المطابقة المُعقَّمة المستعملة فعلاً.
      try {
        await db.collection("users").doc(uid).update({
          "store.import_profile": { mapping: res.mapping, default_category: defaultCategory, updated_at: now },
        })
      } catch (e) { logError("[import] save import_profile", e) }
      revalidatePath("/seller/products")
      try { revalidateTag("products", "max") } catch {}
    }
    return { ok: true as const, created, total: all.length, nextOffset, done }
  } catch (e) {
    logError("[import] commitImport", e)
    return { ok: false as const, error: "commit_failed" }
  }
}

// ─── مزامنة المخزون اليومية (تحديث بدل إنشاء) ───
// التاجر يرفع تصدير الكاشير كل يوم؛ نطابق بالكود (import_sku) ونحدّث المخزون+السعر+التكلفة، نضيف
// الجديد (بجلب صور تلقائي)، ونصفّر ما غاب عن الملف. الصور الموجودة لا تُلمَس. القيم تُشتق من الملف
// سيرفر-سايد (لا نثق بالعميل)؛ والملكية = uid المستدعي والمطابقة داخل استعلام store_id == uid.

const SYNC_EXISTING_CAP = MAX_PRODUCTS // سقف حجم الكتالوج الذي تدعمه المزامنة أحادية-التمريرة

// يحمّل منتجات المتجر (حقول قليلة) لبناء خطة المزامنة + خريطة الأسماء للمعاينة.
async function loadExistingForSync(db: Firestore, uid: string) {
  // نستعلم واحدًا فوق السقف للتمييز بين «عند السقف بالضبط» (مقبول) و«أكثر منه» (overflow).
  const snap = await db.collection("products").where("store_id", "==", uid)
    .select("import_sku", "stock", "price", "cost_price", "name").limit(SYNC_EXISTING_CAP + 1).get()
  const overflow = snap.size > SYNC_EXISTING_CAP
  const existing: ExistingProduct[] = []
  const nameById = new Map<string, string>()
  let withSku = 0
  for (const d of snap.docs.slice(0, SYNC_EXISTING_CAP)) {
    const data = d.data() as Record<string, unknown>
    const sku = String(data.import_sku ?? "")
    if (normalizeSku(sku)) withSku++
    existing.push({
      id: d.id,
      sku,
      stock: Number(data.stock) || 0,
      price: Number(data.price) || 0,
      cost_price: Number(data.cost_price) || 0,
    })
    nameById.set(d.id, String(data.name ?? ""))
  }
  return { existing, nameById, overflow, withSku }
}

// حالة المزامنة: هل رفع التاجر قبل كده (عنده بروفايل)؟ وما المطابقة/التصنيف المحفوظان (لملء الواجهة).
export async function getImportProfile() {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  try {
    const db = getAdminDb()
    const userDoc = await db.collection("users").doc(uid).get()
    const store = userDoc.data()?.store as Record<string, unknown> | undefined
    const profile = store?.import_profile as { mapping?: Mapping; default_category?: string } | undefined
    return {
      ok: true as const,
      hasProfile: !!profile?.mapping,
      mapping: (profile?.mapping ?? null) as Mapping | null,
      defaultCategory: String(profile?.default_category ?? ""),
    }
  } catch (e) {
    logError("[import] getImportProfile", e)
    return { ok: false as const, error: "server_error" }
  }
}

// (أ) معاينة المزامنة: يقرأ الملف + الكتالوج ويحسب الخطة. لا يكتب شيئًا.
export async function syncCatalogPreview(formData: FormData) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  if (!(await checkRateLimit("import_sync_preview:" + uid, 30, 60_000))) return { ok: false as const, error: "rate_limited" }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false as const, error: "no_file" }
  if (file.size > MAX_FILE_BYTES) return { ok: false as const, error: "file_too_large" }
  const mapping = parseMapping(formData.get("mapping"))
  try {
    const db = getAdminDb()
    if (!(await db.collection("users").doc(uid).get()).data()?.store?.is_approved) return { ok: false as const, error: "store_not_approved" }
    const buf = await file.arrayBuffer()
    const res = extractTable(buf, mapping)
    if (res.drafts.length > MAX_PRODUCTS) return { ok: false as const, error: "too_many_products" }
    if (res.mapping.sku == null) return { ok: false as const, error: "no_sku_column" } // المزامنة تتطلّب عمود الكود
    const { existing, nameById, overflow, withSku } = await loadExistingForSync(db, uid)
    if (overflow) return { ok: false as const, error: "catalog_too_large" }
    // كتالوج حالي بلا أي أكواد (استُورد أول مرة بلا عمود كود) ⇒ المزامنة ستكرّره بالكامل — نمنعها.
    if (existing.length > 0 && withSku === 0) return { ok: false as const, error: "catalog_has_no_codes" }
    const fields = { hasStock: res.mapping.stock != null, hasCost: res.mapping.cost_price != null }
    const plan = computeSyncPlan(existing, res.drafts, fields)
    const warnings = [...res.warnings]
    if (!fields.hasStock) warnings.push("الملف مافيهوش عمود «المخزون» — مش هنعدّل الكميات ولا نصفّر أي صنف، بس نحدّث الأسعار ونضيف الجديد.")
    // خطورة: ملف جزئي (يصفّر نسبة كبيرة) أو كتالوج مكرَّر (ينشئ نسبة كبيرة) — نطلب تأكيدًا صريحًا في الواجهة.
    const zeroRatio = existing.length ? plan.zeroIds.length / existing.length : 0
    const createRatio = existing.length ? plan.creates.length / existing.length : 0
    const risky = existing.length > 20 && (zeroRatio > 0.3 || createRatio > 0.5)
    return {
      ok: true as const,
      total: res.drafts.length,
      existingCount: existing.length,
      risky,
      headers: res.headers, // كي يعدّل التاجر المطابقة لو اختلف شكل ملف الكاشير
      mapping: res.mapping,
      headerRowIndex: res.headerRowIndex,
      counts: {
        update: plan.updates.length,
        create: plan.creates.length,
        zero: plan.zeroIds.length,
        unchanged: plan.matchedUnchanged,
        noSku: plan.noSku,
        dupSkuInFile: plan.dupSkuInFile,
      },
      samples: {
        update: plan.updates.slice(0, 6).map((u) => ({ name: nameById.get(u.id) || "", stock: u.stock, price: u.price })),
        create: plan.creates.slice(0, 6).map((c) => ({ name: c.name, stock: Math.max(0, Math.round(Number(c.stock) || 0)), price: c.price })),
        zero: plan.zeroIds.slice(0, 6).map((id) => nameById.get(id) || ""),
      },
      warnings,
    }
  } catch (e) {
    logError("[import] syncCatalogPreview", e)
    return { ok: false as const, error: "server_error" }
  }
}

// (ب) تطبيق المزامنة: يعيد قراءة الملف + الكتالوج، يحسب الخطة، ويكتب على دفعات (تحديث/تصفير/إضافة).
export async function syncCatalogApply(formData: FormData) {
  const uid = await getCurrentUid()
  if (!uid) return { ok: false as const, error: "unauthenticated" }
  if (!(await checkRateLimit("import_sync_apply:" + uid, 6, 60_000))) return { ok: false as const, error: "rate_limited" }
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false as const, error: "no_file" }
  if (file.size > MAX_FILE_BYTES) return { ok: false as const, error: "file_too_large" }
  const mapping = parseMapping(formData.get("mapping"))
  const defaultCategory = String(formData.get("defaultCategory") || "").trim().slice(0, 60) || "عام"
  try {
    const db = getAdminDb()
    if (!(await db.collection("users").doc(uid).get()).data()?.store?.is_approved) return { ok: false as const, error: "store_not_approved" }
    const buf = await file.arrayBuffer()
    const res = extractTable(buf, mapping)
    if (res.drafts.length > MAX_PRODUCTS) return { ok: false as const, error: "too_many_products" }
    if (res.mapping.sku == null) return { ok: false as const, error: "no_sku_column" }
    const { existing, overflow, withSku } = await loadExistingForSync(db, uid)
    if (overflow) return { ok: false as const, error: "catalog_too_large" }
    if (existing.length > 0 && withSku === 0) return { ok: false as const, error: "catalog_has_no_codes" }
    const fields = { hasStock: res.mapping.stock != null, hasCost: res.mapping.cost_price != null }
    const plan = computeSyncPlan(existing, res.drafts, fields)
    const now = new Date().toISOString()

    // معرّف deterministic لكل كود جديد (idempotent تحت الضغط المزدوج). لا يتصادم مع منتجات الاستيراد
    // الأول لأنها تُطابَق بالاستعلام (import_sku) لا بالمعرّف.
    const detId = (sku: string) => `imp_${uid}_s_${createHash("sha1").update(normalizeSku(sku)).digest("hex").slice(0, 24)}`

    type Op = { kind: "update" | "create"; ref: DocumentReference; data: Record<string, unknown> }
    const ops: Op[] = []

    // تحديث: المخزون + السعر + التكلفة + الربح (الاسم/الصورة/الفئة تبقى كما هي — لا نمرّرها).
    // reservation_enabled نضبطه true فقط عند مخزون صفر (كي يمرّ تحقّق المنتج)؛ للمخزون الموجب لا نمسّه
    // (نحافظ على إعداد التاجر اليدوي للحجز).
    for (const u of plan.updates) {
      const data: Record<string, unknown> = {
        stock: u.stock, price: u.price, cost_price: u.cost_price, profit_per_unit: u.profit_per_unit, updated_at: now,
      }
      if (u.stock === 0) data.reservation_enabled = true
      ops.push({ kind: "update", ref: db.collection("products").doc(u.id), data })
    }
    // تصفير ما غاب عن الملف (نفد) — للمستورَد-بكود فقط، والمنتج موجود مؤكَّد (قُرئ من DB).
    for (const id of plan.zeroIds) {
      ops.push({ kind: "update", ref: db.collection("products").doc(id), data: {
        stock: 0, reservation_enabled: true, updated_at: now,
      } })
    }
    // إضافة الجديد (بنفس شكل حمولة الاستيراد؛ بلا صورة ⇒ queued فيلتقطه كرون الصور تلقائيًّا).
    for (const d of plan.creates) {
      const stock = Math.max(0, Math.round(Number(d.stock) || 0))
      const price = Math.round(Number(d.price) * 100) / 100
      let cost = Math.round(Math.min(Number(d.cost_price), Number(d.price)) * 100) / 100
      if (!Number.isFinite(cost) || cost <= 0) cost = price
      ops.push({ kind: "create", ref: db.collection("products").doc(detId(String(d.sku))), data: {
        name: d.name, description: "", price, cost_price: cost, profit_per_unit: calculateProfitPerUnit(price, cost),
        category: d.category && d.category.length ? d.category.slice(0, 60) : defaultCategory,
        stock, image_url: d.image_url || "",
        image_status: d.image_url ? "file" : "queued",
        store_id: uid, barcode: d.barcode || "", simulator_section: null,
        reservation_enabled: stock === 0, rating: 0, rating_count: 0, imported: true,
        import_unit: d.unit || "", import_sku: d.sku || "", created_at: now, updated_at: now,
      } })
    }

    for (let i = 0; i < ops.length; i += COMMIT_CHUNK_MAX) {
      const slice = ops.slice(i, i + COMMIT_CHUNK_MAX)
      const batch = db.batch()
      for (const op of slice) {
        if (op.kind === "create") batch.set(op.ref, op.data)
        else batch.update(op.ref, op.data)
      }
      try {
        await batch.commit()
      } catch (e) {
        // فشل الدفعة (غالبًا مستند حُذف بالتزامن ⇒ update يرفض الدفعة كلها) — نلتزم العمليات فرادى
        // ونتخطّى الفاشلة، بدل كتابة جزئية تُبلَّغ كفشل.
        logError("[import] sync batch fallback", e)
        for (const op of slice) {
          try { if (op.kind === "create") await op.ref.set(op.data); else await op.ref.update(op.data) }
          catch (e2) { logError("[import] sync op skipped", e2) }
        }
      }
    }

    // حدّث البروفايل بالمطابقة/التصنيف المستعملين فعلاً (لو التاجر عدّل المطابقة).
    try {
      await db.collection("users").doc(uid).update({
        "store.import_profile": { mapping: res.mapping, default_category: defaultCategory, updated_at: now },
      })
    } catch (e) { logError("[import] sync save profile", e) }

    revalidatePath("/seller/products")
    try { revalidateTag("products", "max") } catch {}
    return {
      ok: true as const,
      updated: plan.updates.length,
      created: plan.creates.length,
      zeroed: plan.zeroIds.length,
      unchanged: plan.matchedUnchanged,
      noSku: plan.noSku,
    }
  } catch (e) {
    logError("[import] syncCatalogApply", e)
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
