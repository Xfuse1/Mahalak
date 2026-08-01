"use client"

// استيراد كتالوج المنتجات من ملف كاشير (Excel/CSV). وضعان:
//  • «استيراد جديد» — رفع → مطابقة أعمدة قابلة للتعديل + معاينة → نشر على دفعات مع شريط تقدّم.
//  • «تحديث المخزون (مزامنة)» — يظهر بعد أول استيراد: رفع تصدير الكاشير اليومي → معاينة الفروق
//    (تحديث/جديد/تصفير) بالمطابقة المحفوظة → تطبيق. الصور الموجودة لا تُلمَس؛ الجديد يتجابله صور تلقائيًّا.
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { Card, CardContent } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Spinner } from "../../../components/ui/spinner"
import { useToast } from "../../../components/ui/toast"
import { useAuth } from "../../../lib/auth-context"
import { parseImportFile, commitImport, startImageFetch, getImportProfile, syncCatalogPreview, syncCatalogApply } from "../../../lib/actions/import"
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Package, RefreshCw, PlusCircle, ArrowUpCircle, XCircle } from "lucide-react"

type HeaderCell = { index: number; label: string }
type Draft = { name: string; price: number; cost_price: number; stock: number; unit?: string; brand?: string; sku?: string; barcode?: string; category?: string }
type ParseRes = {
  headers: HeaderCell[]
  mapping: Record<string, number>
  headerRowIndex: number
  total: number
  totalRows: number
  preview: Draft[]
  stats: { extracted: number; skipped: number; priceBelowCost: number; zeroStock: number }
  warnings: string[]
  aiUsed?: boolean
}
type SyncSample = { name: string; stock: number; price: number }
type SyncPreviewRes = {
  total: number
  existingCount: number
  risky: boolean
  headers: HeaderCell[]
  mapping: Record<string, number>
  headerRowIndex: number
  counts: { update: number; create: number; zero: number; unchanged: number; noSku: number; dupSkuInFile: number }
  samples: { update: SyncSample[]; create: SyncSample[]; zero: string[] }
  warnings: string[]
}
type SyncResult = { updated: number; created: number; zeroed: number; unchanged: number; noSku: number }
type Mode = "fresh" | "sync"

const FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "name", label: "اسم المنتج", required: true },
  { key: "price", label: "سعر البيع", required: true },
  { key: "cost_price", label: "التكلفة" },
  { key: "stock", label: "المخزون" },
  { key: "category", label: "التصنيف" },
  { key: "brand", label: "الشركة / الماركة" },
  { key: "unit", label: "الوحدة" },
  { key: "sku", label: "الكود" },
  { key: "barcode", label: "الباركود" },
  { key: "expiry", label: "تاريخ الصلاحية" },
  { key: "image", label: "رابط الصورة" },
]

const SYNC_ERR: Record<string, string> = {
  store_not_approved: "متجرك لسه مش معتمد — راجع الإدارة",
  rate_limited: "محاولات كتير — استنى شوية وأعد المحاولة",
  file_too_large: "الملف كبير جدًا (الحد 15 ميجا)",
  too_many_products: "الملف كبير جدًا (فوق 20 ألف منتج)",
  no_sku_column: "المزامنة محتاجة عمود «الكود» عشان تطابق الأصناف — حدّده في المطابقة أو استخدم «استيراد جديد»",
  catalog_has_no_codes: "كتالوجك الحالي اتستورد بلا عمود «الكود» فمفيش مفتاح للمطابقة — المزامنة هتكرّر المنتجات. اعمل «استيراد جديد» بعمود الكود الأول.",
  catalog_too_large: "كتالوجك كبير جدًا للمزامنة أحادية-التمريرة حاليًّا — راجعنا",
  commit_failed: "حصل خطأ أثناء التطبيق — أعد المحاولة",
}

// معرّف عشوائي لجلسة استيراد واحدة — crypto.randomUUID مع احتياط بسيط لو غير متاح.
const genImportId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `imp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

export default function ImportPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>("fresh")
  const [hasProfile, setHasProfile] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [res, setRes] = useState<ParseRes | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [defaultCategory, setDefaultCategory] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [finished, setFinished] = useState<{ created: number } | null>(null)
  // موضع آخر دفعة نجحت — يبقى ثابتًا عبر إعادة المحاولة فيُكمّل النشر من حيث وقف بدل التكرار من الصفر.
  const [committedOffset, setCommittedOffset] = useState(0)
  // معرّف جلسة الاستيراد — يُرسل مع كل دفعة كي تعيد الكتابة فوق نفس المستندات عند إعادة المحاولة.
  const [importId, setImportId] = useState("")
  const [imgFetching, setImgFetching] = useState(false)
  const [imgQueued, setImgQueued] = useState<number | null>(null)

  // حالة المزامنة
  const [syncPreview, setSyncPreview] = useState<SyncPreviewRes | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [showSyncMapping, setShowSyncMapping] = useState(false)
  const [syncConfirmed, setSyncConfirmed] = useState(false) // بوابة تأكيد عند تصفير/إضافة نسبة كبيرة

  const doFetchImages = async () => {
    setImgFetching(true)
    try {
      const r = await startImageFetch()
      if (r.ok) setImgQueued(r.queued)
      else toast.error(r.error === "rate_limited" ? "استنى شوية وأعد المحاولة" : "تعذّر بدء جلب الصور")
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setImgFetching(false)
    }
  }

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.push("/auth"); return }
    // حمّل بروفايل الاستيراد: لو التاجر رفع قبل كده نبدأ في وضع «المزامنة» تلقائيًّا بالمطابقة المحفوظة.
    ;(async () => {
      try {
        const p = await getImportProfile()
        if (p.ok && p.hasProfile) {
          setHasProfile(true)
          setMode("sync")
          if (p.mapping) setMapping(p.mapping as Record<string, number>)
          if (p.defaultCategory) setDefaultCategory(p.defaultCategory)
        }
      } catch { /* تجاهل — نبقى على «استيراد جديد» */ } finally {
        setProfileLoaded(true)
      }
    })()
  }, [user, isLoading, router])

  const runParse = useCallback(async (f: File, override: Record<string, number> | null) => {
    setParsing(true)
    setFinished(null)
    setCommittedOffset(0) // تحليل/مطابقة جديدة ⇒ استيراد جديد من الصفر
    setImportId(genImportId()) // تحليل جديد ⇒ جلسة استيراد جديدة بمعرّف جديد
    try {
      const fd = new FormData()
      fd.set("file", f)
      if (override) fd.set("mapping", JSON.stringify(override))
      const r = await parseImportFile(fd)
      if (r.ok) {
        setRes(r as ParseRes)
        setMapping((r as ParseRes).mapping)
      } else {
        toast.error(r.error === "file_too_large" ? "الملف كبير جدًا (الحد 15 ميجا)" : "تعذّر قراءة الملف — تأكّد إنه Excel/CSV صالح")
        setRes(null)
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setParsing(false)
    }
  }, [toast])

  // معاينة المزامنة: نبعت الملف + المطابقة (المحفوظة أو المعدّلة) ونعرض الفروق.
  const runSyncPreview = useCallback(async (f: File, override: Record<string, number>) => {
    setSyncing(true)
    setSyncResult(null)
    setSyncConfirmed(false)
    try {
      const fd = new FormData()
      fd.set("file", f)
      if (override && Object.keys(override).length) fd.set("mapping", JSON.stringify(override))
      const r = await syncCatalogPreview(fd)
      if (r.ok) {
        setSyncPreview(r as SyncPreviewRes)
        setMapping((r as SyncPreviewRes).mapping)
      } else {
        toast.error(SYNC_ERR[r.error] || "تعذّر تحليل الملف")
        setSyncPreview(null)
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setSyncing(false)
    }
  }, [toast])

  const onPick = (f: File | null) => {
    if (!f) return
    setFile(f)
    setProgress(null)
    setSyncResult(null)
    if (mode === "sync") runSyncPreview(f, mapping)
    else runParse(f, null)
  }

  const changeMapping = (field: string, value: string) => {
    const next = { ...mapping }
    if (value === "") delete next[field]
    else next[field] = Number(value)
    setMapping(next)
    if (file) { if (mode === "sync") runSyncPreview(file, next); else runParse(file, next) }
  }

  const switchMode = (m: Mode) => {
    if (m === mode) return
    setMode(m)
    setRes(null)
    setSyncPreview(null)
    setSyncResult(null)
    setSyncConfirmed(false)
    setFinished(null)
    setFile(null)
    setProgress(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  const applySync = async () => {
    if (!file || !syncPreview) return
    if (mapping.sku == null) { toast.error("لازم تحدّد عمود «الكود» للمزامنة"); return }
    setApplying(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      fd.set("mapping", JSON.stringify(mapping))
      fd.set("defaultCategory", defaultCategory.trim() || "عام")
      const r = await syncCatalogApply(fd)
      if (r.ok) {
        setSyncResult({ updated: r.updated, created: r.created, zeroed: r.zeroed, unchanged: r.unchanged, noSku: r.noSku })
        toast.success("تم تحديث المخزون بنجاح 🎉")
      } else {
        toast.error(SYNC_ERR[r.error] || "تعذّر تطبيق التحديث")
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم — أعد المحاولة")
    } finally {
      setApplying(false)
    }
  }

  const publish = async () => {
    if (!file || !res) return
    if (mapping.name == null || mapping.price == null) {
      toast.error("لازم تحدّد عمودَي «اسم المنتج» و«سعر البيع» الأول")
      return
    }
    setPublishing(true)
    // نبدأ من آخر موضع نجح (استئناف بعد فشل) بدل الصفر — يمنع تكرار المنتجات المُنشأة.
    let offset = committedOffset
    setProgress({ done: offset, total: res.total })
    try {
      // نكرّر على دفعات حتى done — يتفادى حدّ زمن الطلب ويعطي تقدّمًا.
      for (let guard = 0; guard < 200; guard++) {
        const fd = new FormData()
        fd.set("file", file)
        fd.set("mapping", JSON.stringify(mapping))
        fd.set("defaultCategory", defaultCategory.trim() || "عام")
        fd.set("offset", String(offset))
        fd.set("limit", "400")
        fd.set("importId", importId)
        const r = await commitImport(fd)
        if (!r.ok) {
          toast.error(
            r.error === "store_not_approved" ? "متجرك لسه مش معتمد — راجع الإدارة"
              : r.error === "rate_limited" ? "محاولات كتير — استنى شوية وأعد المحاولة (هيكمّل من حيث وقف)"
              : r.error === "too_many_products" ? "الملف كبير جدًا (فوق 20 ألف منتج)"
              : "حصل خطأ — أعد المحاولة (هيكمّل من حيث وقف)",
          )
          break
        }
        offset = r.nextOffset
        setCommittedOffset(offset)
        setProgress({ done: offset, total: r.total })
        if (r.done) {
          setFinished({ created: r.total })
          setCommittedOffset(0)
          toast.success(`تم استيراد ${r.total} منتج بنجاح 🎉`)
          break
        }
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم — أعد المحاولة (هيكمّل من حيث وقف)")
    } finally {
      setPublishing(false)
    }
  }

  if (isLoading || !user || !profileLoaded) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  }

  const c = syncPreview?.counts

  return (
    <div className="min-h-screen bg-gray-50">
      <SellerHeader />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> {mode === "sync" ? "تحديث المخزون من ملف الكاشير" : "استيراد المنتجات من ملف"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === "sync"
              ? "ارفع تصدير الكاشير اليومي — نطابق الأصناف بالكود ونحدّث المخزون والأسعار، ونضيف الجديد. صورك الحالية ما تتلمسش."
              : "ارفع ملف Excel أو CSV من برنامج الكاشير بتاعك، ونحن نتعرّف على الأعمدة تلقائيًا. تراجع وتعدّل قبل النشر."}
          </p>
        </div>

        {/* مبدّل الوضع — يظهر فقط بعد أول استيراد (وجود بروفايل) */}
        {hasProfile && (
          <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1">
            <button
              onClick={() => switchMode("sync")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${mode === "sync" ? "bg-white shadow text-primary" : "text-gray-500"}`}
            >
              <RefreshCw className="h-4 w-4" /> تحديث المخزون
            </button>
            <button
              onClick={() => switchMode("fresh")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors ${mode === "fresh" ? "bg-white shadow text-primary" : "text-gray-500"}`}
            >
              <PlusCircle className="h-4 w-4" /> استيراد جديد
            </button>
          </div>
        )}

        {/* رفع الملف */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5">
            <input
              ref={fileInput}
              type="file"
              accept=".xls,.xlsx,.csv"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 hover:border-primary/40 rounded-xl p-8 flex flex-col items-center gap-2 transition-colors"
            >
              <UploadCloud className="h-10 w-10 text-primary" />
              <span className="font-semibold text-gray-800">{file ? file.name : (mode === "sync" ? "اختر ملف الكاشير اليومي" : "اختر ملف Excel / CSV")}</span>
              <span className="text-xs text-gray-400">.xls · .xlsx · .csv (حتى 15 ميجا)</span>
            </button>
          </CardContent>
        </Card>

        {(parsing || syncing) && (
          <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ قراءة الملف…</div>
        )}

        {/* ══════════ وضع المزامنة ══════════ */}
        {mode === "sync" && syncPreview && !syncing && (
          <>
            {syncResult ? (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-5 flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="font-bold text-gray-900 text-lg">تم تحديث المخزون بنجاح</p>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-1">
                    <div className="rounded-xl bg-blue-50 p-3"><div className="text-2xl font-bold text-blue-600">{syncResult.updated}</div><div className="text-xs text-gray-500">اتحدّث</div></div>
                    <div className="rounded-xl bg-green-50 p-3"><div className="text-2xl font-bold text-green-600">{syncResult.created}</div><div className="text-xs text-gray-500">جديد</div></div>
                    <div className="rounded-xl bg-amber-50 p-3"><div className="text-2xl font-bold text-amber-600">{syncResult.zeroed}</div><div className="text-xs text-gray-500">اتصفّر</div></div>
                  </div>
                  {syncResult.created > 0 && (
                    <p className="text-sm text-green-700 mt-1">✨ الأصناف الجديدة بتتجابلها صور تلقائيًّا في الخلفية — هتظهر تدريجيًّا.</p>
                  )}
                  <Button onClick={() => router.push("/seller/products")} className="mt-2">عرض منتجاتي</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* تحذيرات */}
                {syncPreview.warnings.length > 0 && (
                  <Card className="border-0 shadow-sm rounded-2xl bg-amber-50 ring-1 ring-amber-200">
                    <CardContent className="p-4 space-y-1.5">
                      {syncPreview.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {w}</div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ملخّص الفروق */}
                <Card className="border-0 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <h2 className="font-bold mb-1 text-gray-900">معاينة التحديث</h2>
                    <p className="text-xs text-gray-500 mb-4">قرأنا {syncPreview.total} صنف من الملف، وعندك {syncPreview.existingCount} في المتجر. المطابقة بالكود.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-blue-50 p-3 flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-blue-600 shrink-0" /><div><div className="text-xl font-bold text-blue-600">{c?.update}</div><div className="text-xs text-gray-500">هيتحدّث</div></div></div>
                      <div className="rounded-xl bg-green-50 p-3 flex items-center gap-2"><PlusCircle className="h-5 w-5 text-green-600 shrink-0" /><div><div className="text-xl font-bold text-green-600">{c?.create}</div><div className="text-xs text-gray-500">جديد</div></div></div>
                      <div className="rounded-xl bg-amber-50 p-3 flex items-center gap-2"><XCircle className="h-5 w-5 text-amber-600 shrink-0" /><div><div className="text-xl font-bold text-amber-600">{c?.zero}</div><div className="text-xs text-gray-500">هيتصفّر (نفد)</div></div></div>
                      <div className="rounded-xl bg-gray-50 p-3 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-gray-400 shrink-0" /><div><div className="text-xl font-bold text-gray-500">{c?.unchanged}</div><div className="text-xs text-gray-500">بلا تغيير</div></div></div>
                    </div>
                    {((c?.noSku ?? 0) > 0 || (c?.dupSkuInFile ?? 0) > 0) && (
                      <p className="text-xs text-gray-400 mt-3">
                        {(c?.noSku ?? 0) > 0 && `تجاهلنا ${c?.noSku} صف بلا كود. `}
                        {(c?.dupSkuInFile ?? 0) > 0 && `${c?.dupSkuInFile} كود مكرّر في الملف (أخذنا الأخير).`}
                      </p>
                    )}

                    {/* عيّنات */}
                    <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
                      {syncPreview.samples.update.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-blue-600 mb-1">أمثلة هتتحدّث</div>
                          {syncPreview.samples.update.map((s, i) => (
                            <div key={i} className="text-gray-600 truncate">{s.name} <span className="text-gray-400">→ {s.stock} قطعة · {s.price}ج</span></div>
                          ))}
                        </div>
                      )}
                      {syncPreview.samples.create.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-green-600 mb-1">أمثلة جديدة</div>
                          {syncPreview.samples.create.map((s, i) => (
                            <div key={i} className="text-gray-600 truncate">{s.name} <span className="text-gray-400">· {s.price}ج</span></div>
                          ))}
                        </div>
                      )}
                      {syncPreview.samples.zero.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-amber-600 mb-1">أمثلة هتتصفّر</div>
                          {syncPreview.samples.zero.map((n, i) => (
                            <div key={i} className="text-gray-600 truncate">{n}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* تعديل المطابقة (لو اختلف شكل الملف) */}
                <Card className="border-0 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <button onClick={() => setShowSyncMapping((v) => !v)} className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4" /> تعديل مطابقة الأعمدة {showSyncMapping ? "▲" : "▼"}
                    </button>
                    {showSyncMapping && (
                      <>
                        <p className="text-xs text-gray-500 my-3">لو الكاشير غيّر ترتيب الأعمدة، صحّحها هنا. عمود «الكود» إلزامي للمزامنة.</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {FIELDS.map((f) => (
                            <div key={f.key} className="flex items-center justify-between gap-3">
                              <Label className="text-sm text-gray-700 shrink-0 w-28">
                                {f.label}{f.key === "sku" && <span className="text-red-500"> *</span>}
                              </Label>
                              <select
                                value={mapping[f.key] ?? ""}
                                onChange={(e) => changeMapping(f.key, e.target.value)}
                                className={`flex-1 text-sm rounded-lg border px-2 py-1.5 bg-white ${f.key === "sku" && mapping.sku == null ? "border-red-300" : "border-gray-200"}`}
                              >
                                <option value="">— بلا —</option>
                                {syncPreview.headers.map((h) => (
                                  <option key={h.index} value={h.index}>{h.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                          <Label className="text-sm text-gray-700 shrink-0">التصنيف الافتراضي (للجديد)</Label>
                          <Input value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} placeholder="مثال: صيدلية" className="flex-1 max-w-xs" />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* تطبيق */}
                <Card className="border-0 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    {syncPreview.risky && (
                      <div className="mb-4 rounded-xl bg-red-50 ring-1 ring-red-200 p-4">
                        <div className="flex items-start gap-2 text-sm text-red-800 font-semibold">
                          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                          <div>
                            انتبه: التغيير كبير — {(c?.zero ?? 0) > 0 && <>هيتصفّر <b>{c?.zero}</b> صنف</>}{(c?.zero ?? 0) > 0 && (c?.create ?? 0) > 0 && " و"}{(c?.create ?? 0) > 0 && <>هيتضاف <b>{c?.create}</b> صنف</>}. ده غالبًا معناه إن الملف <b>جزئي</b> أو ملف متجر تاني. لو مقصود كمّل، غير كده راجع الملف.
                          </div>
                        </div>
                        <label className="flex items-center gap-2 mt-3 text-sm text-red-800 cursor-pointer">
                          <input type="checkbox" checked={syncConfirmed} onChange={(e) => setSyncConfirmed(e.target.checked)} className="w-4 h-4 accent-red-600" />
                          أنا متأكد إن ده الملف الصحيح، طبّق التحديث
                        </label>
                      </div>
                    )}
                    <Button onClick={applySync} disabled={applying || mapping.sku == null || (syncPreview.risky && !syncConfirmed)} className="w-full h-12 text-base">
                      {applying ? <><Loader2 className="h-5 w-5 animate-spin me-2" /> جارٍ التطبيق…</> : <><RefreshCw className="h-5 w-5 me-2" /> تطبيق التحديث</>}
                    </Button>
                    <p className="text-xs text-gray-400 mt-2 text-center">التحديث يمسّ المخزون والسعر والتكلفة فقط. الاسم والصور اللي ظبطتهم على محلك تفضل زي ما هي.</p>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ══════════ وضع الاستيراد الجديد ══════════ */}
        {mode === "fresh" && res && !parsing && (
          <>
            {/* تحذيرات */}
            {res.warnings.length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl bg-amber-50 ring-1 ring-amber-200">
                <CardContent className="p-4 space-y-1.5">
                  {res.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-800"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {w}</div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* مطابقة الأعمدة */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <h2 className="font-bold mb-1 text-gray-900 flex items-center gap-2">
                  مطابقة الأعمدة
                  {res.aiUsed && <span className="text-[11px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">✨ بمساعدة الذكاء الاصطناعي</span>}
                </h2>
                <p className="text-xs text-gray-500 mb-4">تعرّفنا على {res.total} منتج (صف العناوين رقم {res.headerRowIndex + 1}). صحّح أي عمود لو المطابقة غلط.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3">
                      <Label className="text-sm text-gray-700 shrink-0 w-28">
                        {f.label}{f.required && <span className="text-red-500"> *</span>}
                      </Label>
                      <select
                        value={mapping[f.key] ?? ""}
                        onChange={(e) => changeMapping(f.key, e.target.value)}
                        className={`flex-1 text-sm rounded-lg border px-2 py-1.5 bg-white ${f.required && mapping[f.key] == null ? "border-red-300" : "border-gray-200"}`}
                      >
                        <option value="">— بلا —</option>
                        {res.headers.map((h) => (
                          <option key={h.index} value={h.index}>{h.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  <Label className="text-sm text-gray-700 shrink-0">التصنيف الافتراضي</Label>
                  <Input
                    value={defaultCategory}
                    onChange={(e) => setDefaultCategory(e.target.value)}
                    placeholder="مثال: صيدلية / بقالة — يُستخدم للمنتجات بلا تصنيف"
                    className="flex-1 max-w-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* معاينة */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <h2 className="font-bold mb-3 text-gray-900">معاينة (أول {Math.min(res.preview.length, 30)} من {res.total})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-100">
                        <th className="text-start py-2 px-2">الاسم</th>
                        <th className="text-start py-2 px-2">السعر</th>
                        <th className="text-start py-2 px-2">التكلفة</th>
                        <th className="text-start py-2 px-2">المخزون</th>
                        <th className="text-start py-2 px-2">التصنيف</th>
                        <th className="text-start py-2 px-2">الشركة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.preview.slice(0, 30).map((d, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1.5 px-2 font-medium text-gray-800 max-w-[220px] truncate">{d.name}</td>
                          <td className="py-1.5 px-2 text-primary font-semibold">{d.price}</td>
                          <td className="py-1.5 px-2 text-gray-500">{d.cost_price}</td>
                          <td className="py-1.5 px-2">{d.stock}</td>
                          <td className="py-1.5 px-2 text-gray-500">{d.category || defaultCategory || "—"}</td>
                          <td className="py-1.5 px-2 text-gray-500 max-w-[120px] truncate">{d.brand || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* نشر */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                {finished ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <p className="font-bold text-gray-900">تم استيراد {finished.created} منتج بنجاح</p>

                    {/* جلب الصور (بموافقة التاجر) */}
                    <div className="w-full max-w-md border-t border-gray-100 pt-3 mt-1">
                      {imgQueued == null ? (
                        <>
                          <p className="text-sm text-gray-600 mb-2">
                            عايز نجيب صور للمنتجات اللي مالهاش صورة؟ نحاول بالباركود من قاعدة منتجات مرخّصة (والبحث بالاسم يتفعّل لاحقًا بمراجعتك). بيتم في الخلفية على دفعات.
                          </p>
                          <Button variant="outline" disabled={imgFetching} onClick={doFetchImages}>
                            {imgFetching ? <><Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ…</> : "✨ ابدأ جلب الصور"}
                          </Button>
                        </>
                      ) : (
                        <p className="text-sm text-green-700">
                          ✅ اتضاف {imgQueued} منتج لقائمة جلب الصور — بيتجابوا في الخلفية على دفعات، وهتظهر على منتجاتك تدريجيًّا.
                        </p>
                      )}
                    </div>

                    <Button onClick={() => router.push("/seller/products")} className="mt-1">عرض منتجاتي</Button>
                  </div>
                ) : (
                  <>
                    {publishing && progress && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>جارٍ النشر…</span>
                          <span>{progress.done} / {progress.total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                        </div>
                      </div>
                    )}
                    <Button onClick={publish} disabled={publishing} className="w-full h-12 text-base">
                      {publishing ? <><Loader2 className="h-5 w-5 animate-spin me-2" /> جارٍ النشر…</> : <><Package className="h-5 w-5 me-2" /> نشر {res.total} منتج</>}
                    </Button>
                    <p className="text-xs text-gray-400 mt-2 text-center">هتقدر تعدّل أو تحذف أي منتج بعدين من صفحة المنتجات. الصور تُضاف لاحقًا.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
