"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language-context"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess(false)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setSuccess(true)
    } catch (error: any) {
      setError(
        t(
          "حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.",
          "An error occurred while sending the password reset link. Please try again.",
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-center">{t("نسيت كلمة المرور؟", "Forgot Password?")}</CardTitle>
              <CardDescription className="text-center">
                {t(
                  "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور",
                  "Enter your email and we'll send you a link to reset your password",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                    <p className="text-center text-lg font-medium">
                      {t("تم إرسال رابط إعادة التعيين!", "Reset Link Sent!")}
                    </p>
                    <p className="text-center text-sm text-muted-foreground">
                      {t(
                        "يرجى التحقق من بريدك الإلكتروني واتباع التعليمات لإعادة تعيين كلمة المرور.",
                        "Please check your email and follow the instructions to reset your password.",
                      )}
                    </p>
                  </div>
                  <Button onClick={() => router.push("/auth")} className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70]">
                    {t("العودة إلى تسجيل الدخول", "Back to Login")}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base">
                      {t("البريد الإلكتروني", "Email")}
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="h-12"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? t("جاري الإرسال...", "Sending...") : t("إرسال رابط إعادة التعيين", "Send Reset Link")}
                  </Button>

                  <div className="text-center">
                    <Link
                      href="/auth"
                      className="inline-flex items-center gap-2 text-sm text-[#1F478B] hover:underline"
                    >
                      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                      {t("العودة إلى تسجيل الدخول", "Back to Login")}
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
