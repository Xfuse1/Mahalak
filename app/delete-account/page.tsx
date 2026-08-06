"use client"

// صفحة حذف الحساب العامة — الرابط الذي يُكتب في نموذج «Data safety» على Google Play.
// لازم تفتح **بدون تسجيل دخول**، ولهذا تعيش خارج /account (الميدلوير يحرس /account/:path*
// ويحوّل الزائر بلا كوكي إلى /auth، فلو وُضعت هناك لرآها مراجع Play صفحة تسجيل دخول).

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/toast"
import { requestAccountDeletion } from "@/lib/actions/account-deletion"
import { logError } from "@/lib/logger"
import { Trash2, Smartphone, Mail, CheckCircle2, Loader2, ShieldCheck, Clock } from "lucide-react"

export default function DeleteAccountPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const toast = useToast()

  const [contact, setContact] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await requestAccountDeletion({ contact, note })
      if (res?.success) {
        setSent(true)
        setContact("")
        setNote("")
      } else {
        toast.error(res?.error || t("تعذّر إرسال الطلب", "Could not send the request"))
      }
    } catch (err) {
      logError("[delete-account] submit", err)
      toast.error(t("تعذّر إرسال الطلب، حاول مرة أخرى", "Could not send the request, please try again"))
    } finally {
      setSubmitting(false)
    }
  }

  const deleted = [
    t("اسمك وبريدك الإلكتروني ورقم هاتفك", "Your name, email and phone number"),
    t("عنوان التوصيل والموقع الجغرافي المحفوظ", "Delivery address and saved location"),
    t("تقييماتك وتعليقاتك على المتاجر والمنتجات", "Your ratings and comments on stores and products"),
    t("إشعاراتك وتوكنات الأجهزة المرتبطة بحسابك", "Your notifications and device tokens"),
    t("حساب الدخول نفسه (لا يمكن تسجيل الدخول به بعدها)", "The sign-in account itself"),
  ]

  const retained = [
    t("سجل الطلبات المكتملة وفواتيرها — بدون بياناتك الشخصية", "Completed order records and invoices — stripped of your personal data"),
    t("المبالغ المحصّلة والتسويات المالية مع التجّار والسائقين", "Collected amounts and settlements with merchants and drivers"),
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* العنوان */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
              <Trash2 className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-2">
              {t("حذف الحساب وبياناتك", "Delete your account and data")}
            </h1>
            <p className="text-muted-foreground">
              {t("تطبيق ومنصة محلك — Mahalak", "Mahalak app and platform")}
            </p>
          </div>

          {/* الطريقة الأسرع: من داخل التطبيق */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-7 mb-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {t("الطريقة الأسرع — من داخل التطبيق", "Fastest way — inside the app")}
            </h2>
            <ol className="space-y-2 text-muted-foreground ps-5 list-decimal marker:text-primary marker:font-bold">
              <li>{t("افتح تطبيق محلك وسجّل الدخول بحسابك", "Open the Mahalak app and sign in")}</li>
              <li>{t("ادخل على «حسابي» ثم تبويب «الملف الشخصي»", "Go to My account, then the Profile tab")}</li>
              <li>{t("انزل لقسم «حذف الحساب» واضغط «حذف حسابي»", "Scroll to Delete account and tap Delete my account")}</li>
              <li>{t("اكتب عبارة التأكيد واضغط تأكيد — يتم الحذف فورًا", "Type the confirmation phrase and confirm — deletion is immediate")}</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-4">
              {t(
                "لو حسابك حساب تاجر، اطلب الحذف من لوحة التاجر — نغلق متجرك فورًا ويكتمل الحذف بعد تسوية أي مستحقات.",
                "If you have a merchant account, request deletion from the seller dashboard.",
              )}
            </p>
            {user && (
              <Button asChild className="mt-5 rounded-xl">
                <Link href="/account">{t("افتح صفحة حسابي", "Open my account")}</Link>
              </Button>
            )}
          </section>

          {/* طلب بدون تسجيل دخول */}
          <section className="rounded-2xl border border-border bg-card p-6 md:p-7 mb-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              {t("مش قادر تدخل على حسابك؟ اطلب الحذف من هنا", "Can't sign in? Request deletion here")}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {t(
                "اكتب البريد الإلكتروني أو رقم الهاتف المسجَّل بالحساب، وهنراجع الطلب وننفّذه.",
                "Enter the email or phone number registered on the account and we will process the request.",
              )}
            </p>

            {sent ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-foreground mb-1">{t("وصلنا طلبك", "We received your request")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "هننفّذ الحذف خلال 30 يومًا كحد أقصى. لو احتجنا نتأكد من هويتك هنتواصل معك على نفس البيانات.",
                      "We will process the deletion within 30 days at most.",
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">{t("البريد الإلكتروني أو رقم الهاتف", "Email or phone number")}</Label>
                  <Input
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    required
                    minLength={5}
                    maxLength={200}
                    placeholder={t("example@mail.com أو 01012345678", "example@mail.com or 01012345678")}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder={t("أي تفاصيل تساعدنا في تحديد حسابك", "Any details that help us find your account")}
                    className="rounded-xl"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full rounded-xl gap-2 h-11">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("أرسل طلب الحذف", "Send deletion request")}
                </Button>
              </form>
            )}
          </section>

          {/* إيه اللي بيتحذف وإيه اللي بيتحفظ */}
          <section className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-foreground">
                <Trash2 className="w-4 h-4 text-destructive" />
                {t("اللي بيتحذف نهائيًا", "Permanently deleted")}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {deleted.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-bold mb-3 flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t("اللي بنحتفظ بيه", "What we retain")}
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {retained.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                {t(
                  "السجلات دي مطلوبة قانونيًا ومحاسبيًا للتاجر والسائق، وبنحتفظ بيها بعد إزالة كل ما يربطها بك.",
                  "These records are required for accounting and are kept only after removing everything linking them to you.",
                )}
              </p>
            </div>
          </section>

          {/* المدة والتواصل */}
          <section className="rounded-2xl bg-secondary p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">{t("مدة التنفيذ", "Processing time")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("فوري من داخل التطبيق · حتى 30 يومًا للطلبات المرسلة من هنا", "Immediate in-app · up to 30 days for requests sent here")}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{t("للاستفسار:", "Questions:")}</span> 010 55161600
            </div>
          </section>

          <p className="text-center text-sm text-muted-foreground mt-8">
            <Link href="/privacy" className="text-primary hover:underline">
              {t("سياسة الخصوصية", "Privacy policy")}
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
