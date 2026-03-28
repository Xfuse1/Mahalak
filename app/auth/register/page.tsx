"use client"

import type React from "react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Chrome, LockKeyhole, MapPinned, UserPlus } from "lucide-react"
import { Header } from "../../../components/header"
import { Footer } from "../../../components/footer"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { EyeOpenIcon, EyeOffIcon } from "../../../components/ui/icons"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { getUserByPhone, storePendingRegistration } from "../../../lib/actions/profile"
import { normalizeEgyptPhone } from "../../../lib/utils/phone"

export default function CustomerRegisterPage() {
  const router = useRouter()
  const { signInWithGoogle, user } = useAuth()
  const { t } = useLanguage()

  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  const errorRef = useRef<HTMLDivElement>(null)

  const countriesAndCities: Record<string, string[]> = {
    مصر: [
      "القاهرة",
      "الجيزة",
      "الإسكندرية",
      "الشرقية",
      "الدقهلية",
      "البحيرة",
      "المنيا",
      "المنوفية",
      "الغربية",
      "القليوبية",
      "كفر الشيخ",
      "سوهاج",
      "أسيوط",
      "قنا",
      "الأقصر",
      "أسوان",
      "الفيوم",
      "بني سويف",
      "بورسعيد",
      "الإسماعيلية",
      "السويس",
      "دمياط",
      "شمال سيناء",
      "جنوب سيناء",
      "البحر الأحمر",
      "الوادي الجديد",
      "مطروح",
    ],
  }

  useEffect(() => {
    if (user) {
      router.push(user.role === "seller" ? "/seller/dashboard" : "/")
    }
  }, [user, router])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [error])

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
      setError(t("تعذر التسجيل بواسطة Google. حاول مرة أخرى.", "Could not continue with Google. Please try again."))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get("name") as string).trim()
    const email = (formData.get("email") as string).trim()
    const phone = normalizeEgyptPhone(formData.get("phone") as string)
    const street = (formData.get("street") as string).trim()
    const city = selectedCity.trim()
    const country = selectedCountry.trim()
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    try {
      if (!name || name.length < 3) {
        setError(t("الاسم يجب أن يكون 3 أحرف على الأقل", "Name must be at least 3 characters"))
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !emailRegex.test(email)) {
        setError(t("يرجى إدخال بريد إلكتروني صحيح", "Please enter a valid email address"))
        return
      }

      if (!phone) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح", "Please enter a valid Egyptian phone number"))
        return
      }

      const phoneCheck = await getUserByPhone(phone)
      if (phoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        return
      }

      if (!street || street.length < 2) {
        setError(t("يرجى إدخال عنوان الشارع", "Please enter the street address"))
        return
      }

      if (!country || !city) {
        setError(t("يرجى اختيار الدولة والمدينة", "Please choose the country and city"))
        return
      }

      if (!password || password.length < 6) {
        setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"))
        return
      }

      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError(t("كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل", "Password must contain at least one letter and one number"))
        return
      }

      if (password !== confirmPassword) {
        setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
        return
      }

      const storeResult = await storePendingRegistration({
        email,
        password,
        name,
        phone,
        street,
        city,
        country,
        role: "customer",
      })

      if (!storeResult.success || !storeResult.token) {
        setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
        return
      }

      sessionStorage.setItem("pendingRegistrationToken", storeResult.token)
      router.push(`/auth/verify-phone?phone=${encodeURIComponent(phone)}&role=customer&returnUrl=/`)
    } finally {
      setIsLoading(false)
    }
  }

  const fieldClassName =
    "h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition focus-visible:border-blue-300 focus-visible:ring-blue-100 sm:h-14"

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#ffffff_42%,#f8fafc_100%)]">
      <Header />

      <main className="px-3 py-4 md:px-6 md:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-4xl">
          <section className="rounded-[2rem] bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 backdrop-blur">
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="space-y-5 px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-[0_12px_30px_rgba(59,130,246,0.18)]">
                      <UserPlus className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl font-black text-slate-900 md:text-2xl lg:text-3xl">
                        {t("إنشاء حساب عميل", "Create Customer Account")}
                      </CardTitle>
                      <CardDescription className="max-w-xl text-xs leading-6 text-slate-500 md:text-sm md:leading-7 lg:text-base">
                        {t("رتبنا الحقول داخل النموذج نفسه لتكون أوضح وأهدأ بصريًا وأسهل في الإكمال من أول نظرة.", "The form is now calmer, clearer, and easier to complete at a glance.")}
                      </CardDescription>
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-5 md:gap-3">
                  <div className="rounded-2xl bg-blue-50/70 px-2 py-3 text-center md:px-4 md:text-start">
                    <div className="mx-auto mb-0 inline-flex rounded-xl bg-white p-2 text-blue-600 shadow-sm md:mx-0 md:mb-2">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <p className="hidden text-sm font-bold text-slate-900 md:block">{t("البيانات الأساسية", "Basic Details")}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center md:px-4 md:text-start">
                    <div className="mx-auto mb-0 inline-flex rounded-xl bg-white p-2 text-slate-600 shadow-sm md:mx-0 md:mb-2">
                      <MapPinned className="h-4 w-4" />
                    </div>
                    <p className="hidden text-sm font-bold text-slate-900 md:block">{t("العنوان", "Address")}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center md:px-4 md:text-start">
                    <div className="mx-auto mb-0 inline-flex rounded-xl bg-white p-2 text-slate-600 shadow-sm md:mx-0 md:mb-2">
                      <LockKeyhole className="h-4 w-4" />
                    </div>
                    <p className="hidden text-sm font-bold text-slate-900 md:block">{t("الأمان", "Security")}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-5 md:px-6 md:pb-7 lg:px-8 lg:pb-8">
                {error && (
                  <div ref={errorRef} className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900 md:text-lg">{t("المعلومات الأساسية", "Basic Information")}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{t("ابدأ ببيانات الحساب الرئيسية.", "Start with the main account details.")}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="register-name" className="text-sm font-semibold text-slate-700">
                          {t("الاسم الكامل", "Full Name")}
                        </Label>
                        <Input id="register-name" name="name" required className={fieldClassName} />
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="register-email" className="text-sm font-semibold text-slate-700">
                          {t("البريد الإلكتروني", "Email")}
                        </Label>
                        <Input id="register-email" name="email" type="email" required className={fieldClassName} />
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="register-phone" className="text-sm font-semibold text-slate-700">
                          {t("رقم الهاتف", "Phone Number")}
                        </Label>
                        <Input id="register-phone" name="phone" type="tel" required placeholder="01012345678" className={fieldClassName} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900 md:text-lg">{t("العنوان", "Address")}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{t("أدخل عنوانك بشكل مرتب لتسهيل التوصيل لاحقًا.", "Add your address in a clean, easy-to-review way.")}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 lg:col-span-2">
                        <Label htmlFor="register-street" className="text-sm font-semibold text-slate-700">
                          {t("الشارع", "Street")}
                        </Label>
                        <Input id="register-street" name="street" required className={fieldClassName} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-country" className="text-sm font-semibold text-slate-700">
                          {t("الدولة", "Country")}
                        </Label>
                        <Select
                          name="country"
                          required
                          value={selectedCountry}
                          onValueChange={(value) => {
                            setSelectedCountry(value)
                            setSelectedCity("")
                          }}
                        >
                          <SelectTrigger id="register-country" className={fieldClassName}>
                            <SelectValue placeholder={t("اختر الدولة", "Choose country")} />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(countriesAndCities).map((country) => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-city" className="text-sm font-semibold text-slate-700">
                          {t("المدينة", "City")}
                        </Label>
                        <Select name="city" required value={selectedCity} onValueChange={setSelectedCity} disabled={!selectedCountry}>
                          <SelectTrigger id="register-city" className={fieldClassName}>
                            <SelectValue placeholder={selectedCountry ? t("اختر المدينة", "Choose city") : t("اختر الدولة أولًا", "Choose country first")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(countriesAndCities[selectedCountry] || []).map((cityItem) => (
                              <SelectItem key={cityItem} value={cityItem}>
                                {cityItem}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-black text-slate-900 md:text-lg">{t("الأمان", "Security")}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{t("اختر كلمة مرور قوية وسهلة التذكّر بالنسبة لك.", "Choose a password that feels secure and easy for you to remember.")}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="text-sm font-semibold text-slate-700">
                          {t("كلمة المرور", "Password")}
                        </Label>
                        <div className="relative">
                          <Input
                            id="register-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className={`${fieldClassName} pe-12`}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 end-0 flex items-center px-4 text-slate-400 transition hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="register-confirm-password" className="text-sm font-semibold text-slate-700">
                          {t("تأكيد كلمة المرور", "Confirm Password")}
                        </Label>
                        <Input
                          id="register-confirm-password"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          required
                          className={fieldClassName}
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-sm font-bold shadow-lg transition hover:from-blue-700 hover:to-blue-800 sm:h-14 sm:text-base"
                    disabled={isLoading || isGoogleLoading}
                  >
                    {isLoading ? t("جاري إنشاء الحساب...", "Creating account...") : t("إنشاء حساب", "Create Account")}
                  </Button>
                </form>

                <div className="my-6 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-slate-400">{t("أو", "Or")}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading}
                  className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:h-14 sm:text-base"
                >
                  <Chrome className="h-5 w-5" />
                  {isGoogleLoading ? t("جاري المتابعة...", "Continuing...") : t("التسجيل بواسطة Google", "Continue with Google")}
                </Button>

                <p className="mt-6 text-center text-sm text-slate-500">
                  {t("لديك حساب بالفعل؟", "Already have an account?")}{" "}
                  <Link href="/auth" className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                    {t("سجل دخولك الآن", "Sign in now")}
                  </Link>
                </p>

                <p className="mt-3 text-center text-sm text-slate-500">
                  {t("هل أنت تاجر؟", "Are you a seller?")}{" "}
                  <Link href="/auth/seller" className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                    {t("انتقل لصفحة التاجر", "Go to seller page")}
                  </Link>
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
