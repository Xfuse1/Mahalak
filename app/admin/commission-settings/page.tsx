"use client"

// إعدادات العمولة ورسوم التوصيل (أدمن) — دمج لوحة Flutter داخل /admin.
// تحرّر عمولة المنصّة الثابتة (settings/driverCommission.rate) + سعر التوصيل الأساسي (settings/delivery).
// حرِج: الموقع يقرأ settings/driverCommission.rate عبر getDriverCommission — الحفظ يُبقيه دائمًا.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { logError } from "@/lib/logger"
import {
  getCommissionSettings,
  setCommissionSettings,
  getDispatchSettings,
  updateDispatchSettings,
  getAiSearchSettings,
  updateAiSearchSettings,
  type CommissionSettings,
} from "@/lib/actions/admin"
import type { AiSearchMode } from "@/lib/ai/search-settings"
import { Coins, Truck, Save, Loader2, Info, Gauge, Power, Sparkles, Lock } from "lucide-react"

const AI_MODE_LABELS: Record<AiSearchMode, string> = {
  single_store: "من متجر واحد فقط",
  multi_store: "أرخص سعر من عدة متاجر",
  customer_choice: "يختار العميل بنفسه",
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

export default function AdminCommissionSettingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [rate, setRate] = useState("")
  const [deliveryBasePrice, setDeliveryBasePrice] = useState("")
  // إعدادات التوزيع (العدّاد) — المرحلة 1، خلف مفتاح تفعيل
  const [dispatchEnabled, setDispatchEnabled] = useState(false)
  const [baseFare, setBaseFare] = useState("")
  const [perKm, setPerKm] = useState("")
  const [offerTimeout, setOfferTimeout] = useState("")
  const [bidCap, setBidCap] = useState("")
  const [savingDispatch, setSavingDispatch] = useState(false)
  // البحث الذكي — المرحلة 0: الإعدادات فقط. الميزة نفسها لم تُبنَ بعد، والعلم مطفأ افتراضيًا.
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiOtc, setAiOtc] = useState(false)
  const [aiMode, setAiMode] = useState<AiSearchMode>("customer_choice")
  const [aiDailyCap, setAiDailyCap] = useState("")
  const [aiUserCap, setAiUserCap] = useState("")
  const [aiCacheHours, setAiCacheHours] = useState("")
  const [aiMaxConcepts, setAiMaxConcepts] = useState("")
  const [aiCanEdit, setAiCanEdit] = useState(false)
  const [savingAi, setSavingAi] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, dres, ares] = await Promise.all([
        getCommissionSettings(),
        getDispatchSettings(),
        getAiSearchSettings(),
      ])
      if (res.success && res.settings) {
        setSettings(res.settings)
        setRate(String(res.settings.rate ?? 0))
        setDeliveryBasePrice(String(res.settings.deliveryBasePrice ?? 0))
      } else {
        setError(true)
      }
      if (dres.success && dres.settings) {
        setDispatchEnabled(dres.settings.enabled)
        setBaseFare(String(dres.settings.base_fare))
        setPerKm(String(dres.settings.per_km_rate))
        setOfferTimeout(String(dres.settings.offer_timeout_sec))
        setBidCap(String(dres.settings.bid_cap_pct))
      }
      if (ares.success && ares.settings) {
        setAiEnabled(ares.settings.enabled)
        setAiOtc(ares.settings.otc_enabled)
        setAiMode(ares.settings.mode)
        setAiDailyCap(String(ares.settings.daily_call_cap))
        setAiUserCap(String(ares.settings.per_user_daily_cap))
        setAiCacheHours(String(ares.settings.cache_ttl_hours))
        setAiMaxConcepts(String(ares.settings.max_concepts))
        setAiCanEdit(ares.canEdit === true)
      }
    } catch (e) {
      logError("[admin/commission-settings] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    const rateNum = Number(rate)
    if (rate.trim() === "" || !Number.isFinite(rateNum) || rateNum < 0) {
      toast.error("أدخل قيمة عمولة صحيحة (رقم ≥ 0)")
      return
    }
    const dpTrimmed = deliveryBasePrice.trim()
    const dpNum = Number(deliveryBasePrice)
    if (dpTrimmed !== "" && (!Number.isFinite(dpNum) || dpNum < 0)) {
      toast.error("أدخل رسوم توصيل صحيحة (رقم ≥ 0)")
      return
    }
    setSaving(true)
    try {
      const res = await setCommissionSettings({
        rate: rateNum,
        deliveryBasePrice: dpTrimmed === "" ? undefined : dpNum,
      })
      if (res.success) {
        toast.success("تم حفظ الإعدادات")
        await load()
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[admin/commission-settings] save", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDispatch = async () => {
    const bf = Number(baseFare)
    const pk = Number(perKm)
    const to = Number(offerTimeout)
    const bc = Number(bidCap)
    if (![bf, pk, bc].every((n) => Number.isFinite(n) && n >= 0) || !Number.isFinite(to) || to < 10) {
      toast.error("تأكد من القيم (أرقام ≥ 0، والمهلة ≥ 10 ثواني)")
      return
    }
    setSavingDispatch(true)
    try {
      const res = await updateDispatchSettings({
        enabled: dispatchEnabled,
        base_fare: bf,
        per_km_rate: pk,
        offer_timeout_sec: to,
        bid_cap_pct: bc,
      })
      if (res.success) {
        toast.success("تم حفظ إعدادات التوزيع")
        await load()
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[admin/commission-settings] save dispatch", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setSavingDispatch(false)
    }
  }

  const handleSaveAi = async () => {
    // الحقل الفارغ يُترك بلا تغيير ولا يُرسَل. `Number("")` تساوي صفرًا، وصفر السقف يعني **بلا سقف**:
    // مسحُ حقل ظنًّا أنه اختياري كان يُلغي سقف فاتورة الموديل على مستوى المنصّة كلها بصمت.
    const numOrSkip = (raw: string) => (raw.trim() === "" ? undefined : Number(raw))
    const nums = {
      daily_call_cap: numOrSkip(aiDailyCap),
      per_user_daily_cap: numOrSkip(aiUserCap),
      cache_ttl_hours: numOrSkip(aiCacheHours),
      max_concepts: numOrSkip(aiMaxConcepts),
    }
    const provided = Object.values(nums).filter((n): n is number => n !== undefined)
    if (!provided.every((n) => Number.isFinite(n) && n >= 0) || (nums.max_concepts ?? 1) < 1) {
      toast.error("تأكد من القيم (أرقام ≥ 0، وعدد المكوّنات ≥ 1)")
      return
    }
    setSavingAi(true)
    try {
      const res = await updateAiSearchSettings({ enabled: aiEnabled, otc_enabled: aiOtc, mode: aiMode, ...nums })
      if (res.success) {
        toast.success("تم حفظ إعدادات البحث الذكي")
        await load()
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[admin/commission-settings] save ai-search", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setSavingAi(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">العمولات ورسوم التوصيل</h1>
        <p className="text-sm text-muted-foreground">
          اضبط عمولة المنصّة الثابتة ورسوم التوصيل الأساسية. تُطبَّق العمولة فورًا على الموقع.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل الإعدادات. حاول مرة أخرى." onRetry={load} />
      ) : (
        <div className="max-w-xl">
          <Card className="border border-border">
            <CardContent className="p-5 space-y-6">
              {/* عمولة المنصّة الثابتة (settings/driverCommission.rate) */}
              <div className="space-y-2">
                <Label htmlFor="rate" className="flex items-center gap-2 font-bold text-foreground">
                  <Coins className="h-4 w-4 text-primary" /> عمولة المنصّة لكل توصيلة (بالجنيه)
                </Label>
                <Input
                  id="rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  مبلغ ثابت بالجنيه المصري (وليس نسبة مئوية) يمثّل حصّة المنصّة على كل طلب توصيل.
                </p>
              </div>

              {/* سعر التوصيل الأساسي (settings/delivery) */}
              <div className="space-y-2">
                <Label htmlFor="delivery" className="flex items-center gap-2 font-bold text-foreground">
                  <Truck className="h-4 w-4 text-primary" /> رسوم التوصيل الأساسية (بالجنيه)
                </Label>
                <Input
                  id="delivery"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  value={deliveryBasePrice}
                  onChange={(e) => setDeliveryBasePrice(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  القيمة الأساسية لرسوم التوصيل. حاليًا رسوم الطلب تُشتق من سعر السائق المختار عند الدفع.
                </p>
              </div>

              {/* حقول إضافية محفوظة (شرائح) — للعرض فقط، تبقى كما هي عند الحفظ */}
              {settings?.extraCommissionFields && settings.extraCommissionFields.length > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                  <p className="text-xs font-bold text-foreground">قيم إضافية محفوظة (شرائح) — تُحفَظ كما هي:</p>
                  {settings.extraCommissionFields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span dir="ltr">{f.key}</span>
                      <span>{f.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                {settings?.updated_at ? (
                  <span className="text-xs text-muted-foreground">آخر تحديث: {fmtDate(settings.updated_at)}</span>
                ) : (
                  <span />
                )}
                <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-1 ms-auto">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* المرحلة 1: إعدادات التوزيع (العدّاد) — خلف مفتاح تفعيل، لا تؤثر على الموقع حتى تُفعَّل */}
          <Card className="border border-border mt-4">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-foreground">
                    <Gauge className="h-4 w-4 text-primary" /> نظام التوزيع (العدّاد)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    توزيع تلقائي للطلبات على السائقين ورسوم بالعدّاد (فتح العداد + سعر الكيلومتر). خلف مفتاح
                    تفعيل — <span className="font-medium">لا يؤثر على الموقع حتى تفعّله</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDispatchEnabled((v) => !v)}
                  className={`rounded-xl gap-1 ${dispatchEnabled ? "border-primary text-primary" : "text-muted-foreground"}`}
                >
                  <Power className="h-4 w-4" /> {dispatchEnabled ? "مفعّل" : "متوقف"}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseFare" className="font-medium text-foreground">فتح العداد (بالجنيه)</Label>
                  <Input id="baseFare" type="number" inputMode="decimal" min={0} step="0.5" value={baseFare} onChange={(e) => setBaseFare(e.target.value)} className="h-11 rounded-xl" placeholder="10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="perKm" className="font-medium text-foreground">سعر الكيلومتر (بالجنيه)</Label>
                  <Input id="perKm" type="number" inputMode="decimal" min={0} step="0.5" value={perKm} onChange={(e) => setPerKm(e.target.value)} className="h-11 rounded-xl" placeholder="1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offerTimeout" className="font-medium text-foreground">مهلة قبول العرض (ثانية)</Label>
                  <Input id="offerTimeout" type="number" inputMode="numeric" min={10} step="5" value={offerTimeout} onChange={(e) => setOfferTimeout(e.target.value)} className="h-11 rounded-xl" placeholder="90" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bidCap" className="font-medium text-foreground">أقصى مزايدة فوق السعر (%)</Label>
                  <Input id="bidCap" type="number" inputMode="numeric" min={0} step="5" value={bidCap} onChange={(e) => setBidCap(e.target.value)} className="h-11 rounded-xl" placeholder="50" />
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                مثال: فتح عداد {baseFare || "10"}ج + {perKm || "1"}ج/كم — مشوار 3 كم ={" "}
                {(Number(baseFare || "10") + Number(perKm || "1") * 3).toFixed(0)}ج تقريبًا.
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button onClick={handleSaveDispatch} disabled={savingDispatch} className="rounded-xl gap-1">
                  {savingDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ إعدادات التوزيع
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* البحث الذكي — المرحلة 0: الإعدادات فقط، الميزة لم تُبنَ بعد. الحفظ لـ superAdmin وحده. */}
          <Card className="border border-border mt-4">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-foreground">
                    <Sparkles className="h-4 w-4 text-accent" /> البحث الذكي
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    يحوّل سؤال العميل («أكل للغدا») إلى سلة جاهزة من منتجات المتاجر. خلف مفتاح تفعيل —{" "}
                    <span className="font-medium">لا يؤثر على الموقع حتى تفعّله</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!aiCanEdit}
                  onClick={() => setAiEnabled((v) => !v)}
                  className={`rounded-xl gap-1 ${aiEnabled ? "border-accent text-accent" : "text-muted-foreground"}`}
                >
                  <Power className="h-4 w-4" /> {aiEnabled ? "مفعّل" : "متوقف"}
                </Button>
              </div>

              {!aiCanEdit && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-1.5">
                  <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  للعرض فقط — تعديل هذه الإعدادات متاح لمدير النظام (superAdmin) وحده.
                </div>
              )}

              {/* سلة الوصفة: من متجر واحد أم من عدة متاجر أم يختار العميل */}
              <div className="space-y-2">
                <Label className="font-medium text-foreground">مصدر سلة الوصفة</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(AI_MODE_LABELS) as AiSearchMode[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant="outline"
                      disabled={!aiCanEdit}
                      onClick={() => setAiMode(mode)}
                      className={`rounded-xl text-sm ${aiMode === mode ? "border-accent text-accent" : "text-muted-foreground"}`}
                    >
                      {AI_MODE_LABELS[mode]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  السلة من عدة متاجر تُنشئ طلبًا لكل متجر برحلة سائق واحدة بمحطات — رسوم التوصيل مجموع المسافات.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aiDailyCap" className="font-medium text-foreground">سقف نداءات الذكاء يوميًّا (المنصّة)</Label>
                  <Input id="aiDailyCap" type="number" inputMode="numeric" min={0} step="100" disabled={!aiCanEdit} value={aiDailyCap} onChange={(e) => setAiDailyCap(e.target.value)} className="h-11 rounded-xl" placeholder="2000" />
                  <p className="text-xs text-destructive">0 = بلا سقف (فاتورة مفتوحة). اتركه فارغًا كي لا تغيّر القيمة المحفوظة.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiUserCap" className="font-medium text-foreground">سقف نداءات المستخدم يوميًّا</Label>
                  <Input id="aiUserCap" type="number" inputMode="numeric" min={0} step="5" disabled={!aiCanEdit} value={aiUserCap} onChange={(e) => setAiUserCap(e.target.value)} className="h-11 rounded-xl" placeholder="30" />
                  <p className="text-xs text-muted-foreground">0 = بلا سقف لكل مستخدم.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiCacheHours" className="font-medium text-foreground">عمر النتيجة المحفوظة (ساعة)</Label>
                  <Input id="aiCacheHours" type="number" inputMode="numeric" min={0} step="1" disabled={!aiCanEdit} value={aiCacheHours} onChange={(e) => setAiCacheHours(e.target.value)} className="h-11 rounded-xl" placeholder="12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiMaxConcepts" className="font-medium text-foreground">أقصى عدد مكوّنات في السلة</Label>
                  <Input id="aiMaxConcepts" type="number" inputMode="numeric" min={1} step="1" disabled={!aiCanEdit} value={aiMaxConcepts} onChange={(e) => setAiMaxConcepts(e.target.value)} className="h-11 rounded-xl" placeholder="12" />
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium text-foreground text-sm">مسار الأعراض (منتجات الصيدلية)</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      يعرض منتجات مرتبطة بعَرَض يذكره العميل. مفتاح منفصل عمدًا: يعمل فقط لمنتجات لا تحتاج
                      روشتة، ومن صيدليات وقّعت الإقرار، وبلا أي جرعة أو نصيحة طبية.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!aiCanEdit}
                    onClick={() => setAiOtc((v) => !v)}
                    className={`rounded-xl gap-1 ${aiOtc ? "border-accent text-accent" : "text-muted-foreground"}`}
                  >
                    <Power className="h-4 w-4" /> {aiOtc ? "مفعّل" : "متوقف"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button onClick={handleSaveAi} disabled={savingAi || !aiCanEdit} className="rounded-xl gap-1">
                  {savingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ إعدادات البحث الذكي
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
