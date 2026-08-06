"use client"

// ADM-02: صفحة الدعم — يقدّم المستخدم شكوى ويتابع شكاواه السابقة.
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { BackButton } from "../../components/back-button"
import { Card, CardContent } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Spinner } from "../../components/ui/spinner"
import { EmptyState } from "../../components/ui/empty-state"
import { useToast } from "../../components/ui/toast"
import { useAuth } from "../../lib/auth-context"
import { useLanguage } from "../../lib/language-context"
import { logError } from "../../lib/logger"
import { submitComplaint, getMyComplaints, type Complaint } from "../../lib/actions/complaints"
import { LifeBuoy, Send, Clock, CheckCircle2, Loader2 } from "lucide-react"

const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

export default function SupportPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const toast = useToast()
  const [list, setList] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      setList(await getMyComplaints())
    } catch (e) {
      logError("[support] load", e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
      return
    }
    if (user) load()
  }, [user, isLoading, router, load])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const formEl = e.currentTarget
    setSubmitting(true)
    try {
      const res = await submitComplaint({
        subject: String(form.get("subject") || ""),
        message: String(form.get("message") || ""),
        target_type: String(form.get("target_type") || "other") as "order" | "store" | "driver" | "other",
        order_id: String(form.get("order_id") || "") || undefined,
      })
      if (res.success) {
        toast.success(t("تم إرسال شكواك، سنتابعها قريبًا", "Your complaint was sent"))
        formEl.reset()
        load()
      } else {
        toast.error(res.error || t("تعذّر الإرسال", "Failed to send"))
      }
    } catch (e) {
      logError("[support] submit", e)
      toast.error(t("تعذّر الإرسال", "Failed to send"))
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading || !user) return null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-6">
            <BackButton />
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("الدعم والشكاوى", "Support & Complaints")}</h1>
              <p className="text-sm text-muted-foreground">{t("أخبرنا بأي مشكلة وسيتابعها فريقنا", "Tell us any issue and our team will follow up")}</p>
            </div>
          </div>

          <Card className="border border-border mb-8">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-subject">{t("الموضوع", "Subject")} *</Label>
                  <Input id="c-subject" name="subject" required placeholder={t("مثال: مشكلة في طلب", "e.g. Issue with an order")} className="h-11 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-type">{t("النوع", "Type")}</Label>
                    <select id="c-type" name="target_type" className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm">
                      <option value="order">{t("طلب", "Order")}</option>
                      <option value="store">{t("متجر", "Store")}</option>
                      <option value="driver">{t("سائق", "Driver")}</option>
                      <option value="other">{t("أخرى", "Other")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-order">{t("رقم الطلب (اختياري)", "Order # (optional)")}</Label>
                    <Input id="c-order" name="order_id" className="h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-msg">{t("التفاصيل", "Details")} *</Label>
                  <textarea
                    id="c-msg" name="message" required rows={4} maxLength={2000}
                    placeholder={t("اشرح المشكلة بالتفصيل", "Describe the issue in detail")}
                    className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full rounded-xl gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("إرسال", "Send")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <h2 className="font-bold text-foreground mb-3">{t("شكاواي السابقة", "My Complaints")}</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" label={t("جاري التحميل...", "Loading...")} className="flex-col" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon={LifeBuoy} title={t("لا توجد شكاوى", "No complaints yet")} description={t("شكاواك ستظهر هنا", "Your complaints will appear here")} />
          ) : (
            <div className="space-y-3">
              {list.map((c) => (
                <Card key={c.id} className="border border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-foreground">{c.subject}</p>
                      {/* أي حالة غير "open" تعني تذكرة مغلقة (resolved/action_taken/rejected).
                          الشرط الثنائي القديم كان يُظهر بلاغًا أُزيل محتواه بـ«قيد المراجعة» للأبد. */}
                      {c.status !== "open" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3" />{" "}
                          {c.status === "action_taken"
                            ? t("تمت الإزالة", "Content removed")
                            : c.status === "rejected"
                              ? t("مرفوض", "Rejected")
                              : t("تمت المعالجة", "Resolved")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                          <Clock className="h-3 w-3" /> {t("قيد المراجعة", "Open")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.message}</p>
                    {c.admin_note && (
                      <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2 text-sm">
                        <span className="font-bold text-primary">{t("رد الدعم: ", "Support: ")}</span>
                        {c.admin_note}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">{fmtDate(c.created_at)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
