"use client"

// ترحيل البيانات (لمرة واحدة): تعبئة store.category_id للمتاجر القديمة + تجذير (grandfather) اعتماد
// المتاجر غير المضبوطة تمهيدًا لوضع «المعتمد فقط». كل العمل يجري سيرفر-سايد عبر أفعال مُقيّدة
// بـ ensureAdmin() (Firebase Admin SDK على Vercel) — المالك يُشغّلها بضغطة زر، ولا يخرج أي سرّ للعميل.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { logError } from "@/lib/logger"
import {
  previewStoreBackfill,
  runStoreBackfill,
  type StoreBackfillPreview,
  type StoreBackfillResult,
} from "@/lib/actions/admin"
import { Database, RefreshCw, Play, Tag, ShieldCheck, Loader2, Info, CheckCircle2 } from "lucide-react"

export default function AdminMigrationsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [preview, setPreview] = useState<StoreBackfillPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<StoreBackfillResult | null>(null)

  const [backfillCategoryId, setBackfillCategoryId] = useState(true)
  const [grandfatherApproval, setGrandfatherApproval] = useState(true)

  const loadPreview = useCallback(async () => {
    setPreviewing(true)
    try {
      const res = await previewStoreBackfill()
      if (res.success && res.preview) {
        setPreview(res.preview)
      } else {
        toast.error(res.error || "تعذّر حساب المعاينة")
      }
    } catch (e) {
      logError("[admin/migrations] preview", e)
      toast.error("تعذّر حساب المعاينة")
    } finally {
      setPreviewing(false)
    }
  }, [toast])

  // معاينة تلقائية عند فتح الصفحة (قراءة فقط).
  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleRun = async () => {
    if (!backfillCategoryId && !grandfatherApproval) {
      toast.error("اختر عملية واحدة على الأقل")
      return
    }
    const lines: string[] = []
    if (backfillCategoryId) {
      lines.push(
        preview
          ? `• تعبئة معرّف الفئة لـ ${preview.categoryIdResolvable} متجرًا (سيُتخطّى ${preview.categoryIdUnresolvable} غير قابل للحلّ).`
          : "• تعبئة معرّف الفئة للمتاجر القابلة للحلّ.",
      )
    }
    if (grandfatherApproval) {
      lines.push(
        preview
          ? `• تجذير الاعتماد لـ ${preview.approvedUnset} متجرًا غير مضبوط (المرفوضة صراحةً تبقى مرفوضة).`
          : "• تجذير اعتماد المتاجر غير المضبوطة (المرفوضة صراحةً تبقى مرفوضة).",
      )
    }
    const ok = await confirm({
      title: "تشغيل الترحيل",
      message: `سيتم تنفيذ ما يلي على مستندات البائعين فقط:\n${lines.join("\n")}\n\nالعملية آمنة وقابلة لإعادة التشغيل (idempotent).`,
      confirmText: "تشغيل",
      cancelText: "تراجع",
      variant: "default",
    })
    if (!ok) return

    setRunning(true)
    setLastResult(null)
    try {
      const res = await runStoreBackfill({ backfillCategoryId, grandfatherApproval })
      if (res.success && res.result) {
        setLastResult(res.result)
        toast.success("اكتمل الترحيل")
        // إعادة معاينة كي تعكس الأعداد الجديدة (يفترض أن تصبح الناقصة القابلة للحلّ صفرًا).
        await loadPreview()
      } else {
        toast.error(res.error || "تعذّر تنفيذ الترحيل")
      }
    } catch (e) {
      logError("[admin/migrations] run", e)
      toast.error("تعذّر تنفيذ الترحيل")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" /> ترحيل البيانات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            أداة لمرة واحدة: تعبئة معرّف الفئة (category_id) للمتاجر القديمة، وتجذير اعتماد المتاجر غير
            المضبوطة تمهيدًا لوضع «المعتمد فقط».
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadPreview}
          disabled={previewing || running}
          className="rounded-xl gap-1"
        >
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} معاينة
        </Button>
      </div>

      {/* ملاحظة تفسيرية */}
      <div className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-foreground">
        <p className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>تعبئة معرّف الفئة:</strong> المتاجر القديمة بلا <code>category_id</code> تُسقَط من تعاقب
            إعادة تسمية الفئة. نعبّئه من مطابقة اسم فئة المتجر باسم فئة موجودة (المتاجر غير المطابِقة تُترك كما
            هي). <br />
            <strong>تجذير الاعتماد:</strong> يعتمد المتاجر الحالية غير المضبوطة (لا <code>true</code> ولا{" "}
            <code>false</code>) تحضيرًا للتبديل إلى وضع «المعتمد فقط» حتى لا يفرغ الموقع. المتاجر{" "}
            <strong>المرفوضة صراحةً تبقى مرفوضة</strong>، والمعتمدة تبقى كما هي. العملية آمنة وقابلة لإعادة
            التشغيل (لا تُغيّر ما هو مضبوط أصلًا) ولا تلمس إلا مساري <code>store.category_id</code> و{" "}
            <code>store.is_approved</code> على مستندات البائعين فقط.
          </span>
        </p>
      </div>

      {/* جدول المعاينة */}
      <Card className="mb-5">
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-border">
            <h2 className="font-bold text-foreground">المعاينة (قراءة فقط)</h2>
            {previewing && <Spinner size="sm" />}
          </div>
          {preview ? (
            <div className="divide-y divide-border text-sm">
              <Row label="إجمالي البائعين" value={preview.totalSellers} strong />
              <SectionLabel icon={Tag} text="معرّف الفئة (category_id)" />
              <Row label="ناقص معرّف الفئة" value={preview.missingCategoryId} />
              <Row label="قابل للتعبئة (اسم فئة مطابق)" value={preview.categoryIdResolvable} tone="good" />
              <Row label="غير قابل للتعبئة (لا فئة مطابقة)" value={preview.categoryIdUnresolvable} tone="warn" />
              <SectionLabel icon={ShieldCheck} text="حالة الاعتماد (is_approved)" />
              <Row label="معتمد (true)" value={preview.approvedTrue} tone="good" />
              <Row label="مرفوض صراحةً (false)" value={preview.approvedFalse} tone="warn" />
              <Row label="غير مضبوط (سيُجذَّر)" value={preview.approvedUnset} />
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              {previewing ? (
                <Spinner size="lg" label="جاري حساب المعاينة..." className="flex-col" />
              ) : (
                <p className="text-sm text-muted-foreground">اضغط «معاينة» لعرض الأعداد.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* خيارات + تشغيل */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <h2 className="font-bold text-foreground mb-3">تشغيل الترحيل</h2>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={backfillCategoryId}
                onChange={(e) => setBackfillCategoryId(e.target.checked)}
                disabled={running}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" /> تعبئة معرّف الفئة (category_id)
                </span>
                <span className="text-muted-foreground">
                  يضبط <code>store.category_id</code> للمتاجر الناقصة القابلة للحلّ فقط.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={grandfatherApproval}
                onChange={(e) => setGrandfatherApproval(e.target.checked)}
                disabled={running}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> تجذير الاعتماد (grandfather approval)
                </span>
                <span className="text-muted-foreground">
                  يضبط <code>store.is_approved = true</code> للمتاجر غير المضبوطة فقط (المرفوضة صراحةً تبقى
                  مرفوضة).
                </span>
              </span>
            </label>
          </div>

          <div className="mt-5">
            <Button
              onClick={handleRun}
              disabled={running || previewing || (!backfillCategoryId && !grandfatherApproval)}
              className="rounded-xl gap-1"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} تشغيل الترحيل
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* نتيجة آخر تشغيل */}
      {lastResult && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-5">
            <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> نتيجة آخر تشغيل
            </h2>
            <div className="divide-y divide-border text-sm">
              <Row label="متاجر كُتب لها معرّف الفئة" value={lastResult.categoryIdSet} tone="good" />
              <Row label="متاجر مُنحت الاعتماد" value={lastResult.approvalGranted} tone="good" />
              <Row label="متاجر تُخطّيت (غير قابلة للحلّ)" value={lastResult.skippedUnresolvable} tone="warn" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: number
  strong?: boolean
  tone?: "good" | "warn"
}) {
  const valueClass =
    tone === "good" ? "text-primary" : tone === "warn" ? "text-destructive" : "text-foreground"
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <span className={strong ? "font-bold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`font-bold tabular-nums ${strong ? "text-lg text-foreground" : valueClass}`}>{value}</span>
    </div>
  )
}

function SectionLabel({ icon: Icon, text }: { icon: typeof Tag; text: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-secondary/40 text-xs font-bold text-secondary-foreground">
      <Icon className="h-3.5 w-3.5" /> {text}
    </div>
  )
}
