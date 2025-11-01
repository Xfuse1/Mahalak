"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, register, user } = useAuth()
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const roleParam = searchParams.get("role") as "customer" | "seller" | null
  const [role, setRole] = useState<"customer" | "seller">(roleParam || "customer")

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push(user.role === "seller" ? "/seller/dashboard" : "/")
    }
  }, [user, router])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const success = await login(email, password, role)

      if (success) {
        router.push(role === "seller" ? "/seller/dashboard" : "/")
      }
    } catch (error: any) {
      if (error.message === "Email not confirmed") {
        setError(
          t(
            "يرجى تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق الوارد الخاص بك.",
            "Please confirm your email first. Check your inbox.",
          ),
        )
      } else if (error.message === "Invalid role for this account type") {
        setError(
          t("نوع الحساب غير صحيح. يرجى اختيار النوع الصحيح.", "Invalid account type. Please select the correct type."),
        )
      } else if (error.message === "Invalid login credentials") {
        setError(t("البريد الإلكتروني أو كلمة المرور غير صحيحة", "Invalid email or password"))
      } else {
        setError(t("فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.", "Login failed. Please try again."))
      }
    }

    setIsLoading(false)
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string
    const street = formData.get("street") as string
    const city = formData.get("city") as string
    const country = formData.get("country") as string

    let sellerData
    if (role === "seller") {
      const phone = formData.get("phone") as string
      const storeName = formData.get("storeName") as string
      const storeDescription = formData.get("storeDescription") as string
      const address = formData.get("address") as string
      const storeType = formData.get("storeType") as string

      if (!phone || !storeName || !address || !storeType) {
        setError(t("يرجى ملء جميع الحقول المطلوبة", "Please fill all required fields"))
        setIsLoading(false)
        return
      }

      sellerData = { phone, storeName, storeDescription, address, storeType }
    }

    if (password !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    try {
      const success = await register(email, password, name, role, sellerData, street, city, country)

      if (success) {
        router.push(role === "seller" ? "/seller/dashboard" : "/")
      }
    } catch (error: any) {
      if (error.message?.includes("already registered")) {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
      } else {
        setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
      }
    }

    setIsLoading(false)
  }

  return (
  <div suppressHydrationWarning className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-center">{t("مرحباً بك في محلك", "Welcome to Mahalak")}</CardTitle>
              <CardDescription className="text-center">
                {role === "seller"
                  ? t("سجل دخولك كبائع", "Login as a seller")
                  : t("سجل دخولك كعميل", "Login as a customer")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Role Selection */}
              <div className="mb-8">
                <Label className="mb-3 block text-base">{t("نوع الحساب", "Account Type")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={role === "customer" ? "default" : "outline"}
                    onClick={() => setRole("customer")}
                    className={`h-12 text-base font-semibold ${role === "customer" ? "bg-[#1F478B] hover:bg-[#1a3a70] shadow-md" : ""}`}
                  >
                    {t("عميل", "Customer")}
                  </Button>
                  <Button
                    type="button"
                    variant={role === "seller" ? "default" : "outline"}
                    onClick={() => setRole("seller")}
                    className={`h-12 text-base font-semibold ${role === "seller" ? "bg-[#1F478B] hover:bg-[#1a3a70] shadow-md" : ""}`}
                  >
                    {t("بائع", "Seller")}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-gray-200 p-1 rounded-lg">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-600 font-bold text-base transition-all rounded-md"
                  >
                    {t("تسجيل الدخول", "Login")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-600 font-bold text-base transition-all rounded-md"
                  >
                    {t("إنشاء حساب", "Create Account")}
                  </TabsTrigger>
                </TabsList>

                {error && (
                  <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
                )}

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-base">
                        {t("البريد الإلكتروني", "Email")}
                      </Label>
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        required
                        placeholder="example@email.com"
                        className="h-12"
                      />
                    </div>
                     <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-base">
                          {t("كلمة المرور", "Password")}
                        </Label>
                        <Link href="/auth/forgot-password" className="text-sm text-[#1F478B] hover:underline">
                          {t("هل نسيت كلمة السر؟", "Forgot Password?")}
                        </Link>
                      </div>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="h-12"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? t("جاري تسجيل الدخول...", "Logging in...") : t("تسجيل الدخول", "Login")}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-base">
                        {t("الاسم الكامل", "Full Name")}
                      </Label>
                      <Input
                        id="register-name"
                        name="name"
                        type="text"
                        required
                        placeholder={t("أحمد محمد", "Ahmed Mohamed")}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-base">
                        {t("البريد الإلكتروني", "Email")}
                      </Label>
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        required
                        placeholder="example@email.com"
                        className="h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-street" className="text-base">
                        {t("الشارع", "Street")}
                      </Label>
                      <Input
                        id="register-street"
                        name="street"
                        type="text"
                        required
                        placeholder={t("شارع الجامعة", "University Street")}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-city" className="text-base">
                        {t("المدينة", "City")}
                      </Label>
                      <Input
                        id="register-city"
                        name="city"
                        type="text"
                        required
                        placeholder={t("القاهرة", "Cairo")}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-country" className="text-base">
                        {t("الدولة", "Country")}
                      </Label>
                      <Input
                        id="register-country"
                        name="country"
                        type="text"
                        required
                        placeholder={t("مصر", "Egypt")}
                        className="h-12"
                      />
                    </div>

                    {role === "seller" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="register-phone" className="text-base">
                            {t("رقم الهاتف", "Phone Number")}
                          </Label>
                          <Input
                            id="register-phone"
                            name="phone"
                            type="tel"
                            required
                            placeholder="01055161600"
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-storeName" className="text-base">
                            {t("اسم المتجر", "Store Name")}
                          </Label>
                          <Input
                            id="register-storeName"
                            name="storeName"
                            type="text"
                            required
                            placeholder={t("متجر الإلكترونيات", "Electronics Store")}
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-storeDescription" className="text-base">
                            {t("وصف المتجر", "Store Description")}
                          </Label>
                          <Input
                            id="register-storeDescription"
                            name="storeDescription"
                            type="text"
                            placeholder={t("وصف مختصر عن متجرك", "Brief description of your store")}
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-address" className="text-base">
                            {t("عنوان المتجر", "Store Address")}
                          </Label>
                          <Input
                            id="register-address"
                            name="address"
                            type="text"
                            required
                            placeholder={t("القاهرة، مصر", "Cairo, Egypt")}
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-storeType" className="text-base">
                            {t("نوع المتجر", "Store Type")}
                          </Label>
                          <Select name="storeType" required>
                            <SelectTrigger id="register-storeType" className="h-12">
                              <SelectValue placeholder={t("اختر نوع المتجر", "Choose store type")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="بقالة">{t("بقالة", "Grocery")}</SelectItem>
                              <SelectItem value="صحة">{t("صحة", "Health")}</SelectItem>
                              <SelectItem value="ملابس">{t("ملابس", "Clothing")}</SelectItem>
                              <SelectItem value="إلكترونيات">{t("إلكترونيات", "Electronics")}</SelectItem>
                              <SelectItem value="أغذية">{t("أغذية", "Food")}</SelectItem>
                              <SelectItem value="أثاث">{t("أثاث", "Furniture")}</SelectItem>
                              <SelectItem value="خدمات أخرى">{t("خدمات أخرى", "Other Services")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-base">
                        {t("كلمة المرور", "Password")}
                      </Label>
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="text-base">
                        {t("تأكيد كلمة المرور", "Confirm Password")}
                      </Label>
                      <Input
                        id="register-confirm"
                        name="confirmPassword"
                        type="password"
                        required
                        placeholder="••••••••"
                        className="h-12"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? t("جاري إنشاء الحساب...", "Creating account...") : t("إنشاء حساب", "Create Account")}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
