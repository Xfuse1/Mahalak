"use client"

// زرّ الإبلاغ عن محتوى — متطلَّب سياسة المحتوى المُنشأ بواسطة المستخدمين في Google Play.
// التجّار يرفعون أسماء وأوصاف وصور المنتجات، فلازم يكون أمام العميل طريق مباشر للإبلاغ من
// نفس الصفحة التي يرى فيها المحتوى، لا عبر نموذج دعم عام لا يعرف عن أي عنصر يتحدث.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Flag, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useAuth } from "../lib/auth-context"
import { useLanguage } from "../lib/language-context"
import { useToast } from "./ui/toast"
import { reportContent } from "../lib/actions/complaints"
import { REPORT_REASONS, type ReportReason, type ReportableType } from "../lib/types/report"
import { logError } from "../lib/logger"

interface ReportButtonProps {
  targetType: ReportableType
  targetId: string
  targetName?: string
  /** full = زرّ بعرض كامل داخل عمود إجراءات؛ icon = أيقونة مضغوطة بجانب المشاركة */
  variant?: "icon" | "full"
  className?: string
}

export function ReportButton({ targetType, targetId, targetName, variant = "icon", className = "" }: ReportButtonProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("counterfeit")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleOpen = () => {
    // الإبلاغ يتطلّب هوية (لمنع الإغراق ولمتابعة البلاغ) — نفس مسار بقية الأفعال المحمية
    if (!user) {
      router.push("/auth")
      return
    }
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await reportContent({ target_type: targetType, target_id: targetId, reason, message })
      if (res?.success) {
        toast.success(t("وصلنا بلاغك وهنراجعه", "Your report was received and will be reviewed"))
        setOpen(false)
        setMessage("")
      } else {
        toast.error(res?.error || t("تعذّر إرسال البلاغ", "Could not send the report"))
      }
    } catch (err) {
      logError("[report-button] submit", err)
      toast.error(t("تعذّر إرسال البلاغ، حاول مرة أخرى", "Could not send the report, please try again"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {variant === "full" ? (
        <Button variant="outline" onClick={handleOpen} className={`flex-1 bg-transparent w-full ${className}`}>
          <Flag className="ms-2 h-5 w-5" />
          {t("إبلاغ عن المحتوى", "Report content")}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          aria-label={t("إبلاغ عن المحتوى", "Report content")}
          title={t("إبلاغ عن المحتوى", "Report content")}
          className={`text-muted-foreground hover:text-destructive ${className}`}
        >
          <Flag className="h-5 w-5" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-destructive" />
              {t("إبلاغ عن المحتوى", "Report content")}
            </DialogTitle>
            <DialogDescription>
              {targetName
                ? t(`بلاغ عن: ${targetName}`, `Reporting: ${targetName}`)
                : t("اختر سبب البلاغ وسنراجعه", "Choose a reason and we will review it")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">{t("سبب البلاغ", "Reason")}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
                <SelectTrigger id="report-reason" className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {REPORT_REASONS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-message">{t("تفاصيل (اختياري)", "Details (optional)")}</Label>
              <Textarea
                id="report-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t("اكتب أي تفاصيل تساعدنا في المراجعة", "Add any details that help our review")}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting} className="rounded-xl">
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={submitting} className="rounded-xl gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("أرسل البلاغ", "Send report")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
