"use client"

import type React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { Header } from "../../../../components/header"
import { Footer } from "../../../../components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { LoginForm } from "../../../../components/auth/login-form"
import { useAuth } from "../../../../lib/auth-context"
import { useLanguage } from "../../../../lib/language-context"
import { getUserByPhone } from "../../../../lib/actions/profile"
import { normalizeEgyptPhone } from "../../../../lib/utils/phone"

export default function SellerLoginPage() {
  const router = useRouter()
  const { login, signInWithGoogle, user, logout } = useAuth()
  const { t } = useLanguage()

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user && !isLoggingIn) {
      if (user.role === "seller") {
        router.push("/seller/dashboard")
      } else {
        router.push("/auth/seller/login")
      }
    }
  }, [user, router, isLoggingIn])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [error])

  const sellerRoleError = t(
    "هذا الحساب ليس حساب تاجر. استخدم صفحة العميل إذا كان الحساب للشراء فقط.",
    "This account is not a seller account. Use the customer page if the account is for shopping only.",
  )

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    setIsLoggingIn(true)

    const formData = new FormData(e.currentTarget)
    const emailOrPhone = (formData.get("emailOrPhone") as string).trim()
    const password = formData.get("password") as string

    const normalizedLoginPhone = emailOrPhone.includes("@") ? null : normalizeEgyptPhone(emailOrPhone)
    let email = emailOrPhone

    try {
      if (normalizedLoginPhone) {
        const result = await getUserByPhone(normalizedLoginPhone)
        if (!result.success || !result.data?.email) {
          setError(t("لا يوجد حساب مرتبط برقم الهاتف هذا", "No account found with this phone number"))
          return
        }
        email = result.data.email
      }

      const success = await login(email, password, "seller")

      if (success) {
        router.push("/seller/dashboard")
      }
    } catch (loginError: any) {
      if (loginError.message === "Invalid role for this account type") {
        setError(sellerRoleError)
      } else if (loginError.message === "Invalid login credentials") {
        setError(t("البريد الإلكتروني أو كلمة المرور غير صحيحة", "Invalid email or password"))
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
    setIsLoggingIn(true)

    try {
      const role = await signInWithGoogle()

      if (role !== "seller") {
        await logout()
        setError(sellerRoleError)
        return
      }

      router.push("/seller/dashboard")
    } catch (googleError: any) {
      if (googleError?.message === "Google sign-in cancelled") {
        return
      }

      setError(t("تعذر تسجيل الدخول بواسطة Google. حاول مرة أخرى.", "Could not continue with Google. Please try again."))
    } finally {
      setIsGoogleLoading(false)
      setIsLoggingIn(false)
    }
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_35%),linear-gradient(180deg,#f7faff_0%,#ffffff_46%,#eef4ff_100%)]">
      <Header />

      <main className="px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <section>
            <Card className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
              <CardHeader className="space-y-3 border-b border-slate-100 bg-white px-5 py-6 sm:px-8">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <LayoutDashboard className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl font-black text-slate-900 sm:text-3xl">
                  {t("تسجيل دخول التاجر", "Seller Login")}
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-500 sm:text-base">
                  {t("أدخل بريدك الإلكتروني أو رقم الهاتف ثم كلمة المرور للوصول إلى لوحة التاجر.", "Enter your email or phone number and password to access your seller account.")}
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
                  registerHref="/auth/seller/register"
                />

                <div className="mt-5 text-center text-sm text-slate-500">
                  {t("هل تريد الدخول كعميل؟", "Want to sign in as a customer?")}{" "}
                  <Link href="/auth" className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                    {t("العودة لحساب العميل", "Back to customer login")}
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
