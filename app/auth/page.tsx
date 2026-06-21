"use client"

import type React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { LoginForm } from "../../components/auth/login-form"
import { useAuth } from "../../lib/auth-context"
import { useLanguage } from "../../lib/language-context"
import { getUserByPhone } from "../../lib/actions/profile"
import { normalizeEgyptPhone } from "../../lib/utils/phone"

export default function AuthPage() {
  const router = useRouter()
  const { login, signInWithGoogle, user } = useAuth()
  const { t } = useLanguage()

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user && !isLoggingIn) {
      router.push(user.role === "seller" ? "/seller/dashboard" : "/")
    }
  }, [user, router, isLoggingIn])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [error])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    setIsLoggingIn(true)

    const formData = new FormData(e.currentTarget)
    const emailOrPhone = (formData.get("emailOrPhone") as string).trim()
    const password = formData.get("password") as string

    const normalizedPhone = emailOrPhone.includes("@") ? null : normalizeEgyptPhone(emailOrPhone)
    let email = emailOrPhone

    try {
      if (normalizedPhone) {
        const result = await getUserByPhone(normalizedPhone)
        if (!result.success || !result.data?.email) {
          setError(t("لا يوجد حساب مرتبط برقم الهاتف هذا", "No account found with this phone number"))
          return
        }
        email = result.data.email
      }

      const success = await login(email, password, "customer")
      if (success) {
        router.push("/")
      }
    } catch (loginError: any) {
      if (loginError.message === "Invalid login credentials") {
        setError(t("البريد الإلكتروني أو كلمة المرور غير صحيحة", "Invalid email or password"))
      } else if (loginError.message === "Invalid role for this account type") {
        setError(t("هذا الحساب ليس حساب عميل. استخدم صفحة التاجر إذا كان الحساب خاصًا ببائع.", "This account is not a customer account. Use the seller page for seller accounts."))
      } else {
        setError(t("فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.", "Login failed. Please try again."))
      }
    } finally {
      setIsLoading(false)
      setIsLoggingIn(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setIsGoogleLoading(true)

    try {
      const role = await signInWithGoogle()
      router.push(role === "seller" ? "/seller/dashboard" : "/")
    } catch (googleError: any) {
      if (googleError?.message === "Google sign-in cancelled") {
        return
      }
      setError(t("تعذر تسجيل الدخول بواسطة Google. حاول مرة أخرى.", "Could not continue with Google. Please try again."))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#ffffff_42%,#f8fafc_100%)]">
      <Header />

      <main className="px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <section>
            <Card className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
              <CardHeader className="space-y-3 border-b border-slate-100 bg-white px-5 py-6 sm:px-8">
                <CardTitle className="text-2xl font-black text-slate-900 sm:text-3xl">
                  {t("تسجيل دخول العميل", "Customer Login")}
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-500 sm:text-base">
                  {t("أدخل بريدك الإلكتروني أو رقم هاتفك ثم كلمة المرور للمتابعة.", "Enter your email or phone number and password to continue.")}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
                {error && (
                  <div ref={errorRef} className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {error}
                  </div>
                )}

                <LoginForm
                  onSubmit={handleLogin}
                  onGoogleSignIn={handleGoogleSignIn}
                  isLoading={isLoading}
                  isGoogleLoading={isGoogleLoading}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  t={t}
                  registerHref="/auth/register"
                />

                <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
                  {t("هل تريد الدخول كبائع؟", "Want to sign in as a seller?")}{" "}
                  <Link href="/auth/seller" className="font-semibold text-primary hover:text-primary/80 hover:underline">
                    {t("افتح بوابة التاجر", "Open seller gateway")}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
