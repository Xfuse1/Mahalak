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
import { getCommissionSettings, setCommissionSettings, type CommissionSettings } from "@/lib/actions/admin"
import { Coins, Truck, Save, Loader2, Info } from "lucide-react"

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

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getCommissionSettings()
      if (res.success && res.settings) {
        setSettings(res.settings)
        setRate(String(res.settings.rate ?? 0))
        setDeliveryBasePrice(String(res.settings.deliveryBasePrice ?? 0))
      } else {
        setError(true)
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
        </div>
      )}
    </div>
  )
}
