"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language-context"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"))
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => {
        router.push("/auth")
      }, 2000)
    } catch (error: any) {
      setError(
        t(
          "حدث خطأ أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.",
          "An error occurred while resetting your password. Please try again.",
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
              <CardTitle className="text-2xl text-center">{t("إعادة تعيين كلمة المرور", "Reset Password")}</CardTitle>
              <CardDescription className="text-center">
                {t("أدخل كلمة المرور الجديدة الخاصة بك", "Enter your new password")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                  <p className="text-center text-lg font-medium">
                    {t("تم تغيير كلمة المرور بنجاح!", "Password Changed Successfully!")}
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    {t("جاري تحويلك إلى صفحة تسجيل الدخول...", "Redirecting to login page...")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-base">
                      {t("كلمة المرور الجديدة", "New Password")}
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-base">
                      {t("تأكيد كلمة المرور", "Confirm Password")}
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? t("جاري التحديث...", "Updating...") : t("تحديث كلمة المرور", "Update Password")}
                  </Button>
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
