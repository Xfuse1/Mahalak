"use client"

// بطاقة إقرار الصيدلية لمسار الأعراض (إعدادات البائع).
//
// مكوّن مستقلّ لا قسم داخل نموذج الإعدادات: الإعدادات نموذج واحد يُحفَظ بزرّ واحد، وهذا **توقيع
// إقرار** له فعله ووقته ونسخته. دمجه في «حفظ التغييرات» كان يجعل الصيدلية توقّع التزامًا قانونيًّا
// وهي تعدّل مواعيد العمل.

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, Loader2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { logError } from "@/lib/logger"
import { getPharmacyConsent, setPharmacyConsent } from "@/lib/actions/stores"
import {
  PHARMACY_CONSENT_INTRO,
  PHARMACY_CONSENT_TERMS,
  PHARMACY_CONSENT_TITLE,
  type PharmacyConsent,
} from "@/lib/ai/pharmacy-consent"

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })
  } catch {
    return iso
  }
}

export function PharmacyConsentCard() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [consent, setConsent] = useState<PharmacyConsent | null>(null)
  const [checked, setChecked] = useState(false)

  // فشل القراءة حالة ثالثة، لا «لم يوقّع».
  //
  // `consent = null` هو نفسه تمثيل «لم يوقّع»، فبلا تمييز كان انقطاعٌ عابر يعرض على صيدلية موقِّعة
  // نموذجَ التوقيع من جديد — فتظنّ أن إقرارها ضاع، أو تعتقد أنها غير ظاهرة وهي ظاهرة.
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await getPharmacyConsent()
      if (res.success) setConsent(res.consent ?? null)
      else setFailed(true)
    } catch (e) {
      logError("[seller/settings] getPharmacyConsent", e)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async (accept: boolean) => {
    setSaving(true)
    try {
      const res = await setPharmacyConsent(accept)
      if (res.success) {
        toast.success(accept ? "تم توقيع الإقرار" : "تم سحب الإقرار")
        setChecked(false)
        await load()
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[seller/settings] setPharmacyConsent", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-xl">
            <ShieldCheck className="h-5 w-5 text-accent" />
          </div>
          {PHARMACY_CONSENT_TITLE}
        </CardTitle>
        <CardDescription>{PHARMACY_CONSENT_INTRO}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-6">
        {failed ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="space-y-3">
              <p className="text-sm text-foreground">تعذّر قراءة حالة الإقرار. لا نعرض لك نموذج التوقيع كي لا توقّع مرّتين.</p>
              <Button type="button" variant="outline" onClick={load} className="rounded-xl">
                إعادة المحاولة
              </Button>
            </div>
          </div>
        ) : consent ? (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-bold text-foreground">الإقرار موقَّع — صيدليتك تظهر في نتائج الأعراض</p>
                <p className="mt-1 text-sm text-muted-foreground">بتاريخ {fmt(consent.accepted_at)}</p>
              </div>
            </div>
            <Button type="button" variant="outline" disabled={saving} onClick={() => submit(false)} className="rounded-xl gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              سحب الإقرار وإيقاف الظهور
            </Button>
          </>
        ) : (
          <>
            <ol className="space-y-3">
              {PHARMACY_CONSENT_TERMS.map((term, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span>{term}</span>
                </li>
              ))}
            </ol>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>بدون هذا الإقرار تعمل صيدليتك على المنصّة كالمعتاد — الإقرار يخصّ ظهورك في نتائج الأعراض وحدها.</span>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[var(--primary)]"
              />
              <span>قرأت البنود أعلاه وأوافق عليها بصفتي مسؤول الصيدلية.</span>
            </label>

            <Button type="button" disabled={!checked || saving} onClick={() => submit(true)} className="rounded-xl gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              توقيع الإقرار
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
