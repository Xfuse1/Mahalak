"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import Link from "next/link"
import { useAuth } from "../../lib/auth-context"
import { useLanguage } from "../../lib/language-context"
import { EyeOpenIcon, EyeOffIcon } from "../../components/ui/icons"
import Image from "next/image"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, register, user } = useAuth()
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [storeLogo, setStoreLogo] = useState<File | null>(null)
  const [storeLogoPreview, setStoreLogoPreview] = useState<string | null>(null)

  const roleParam = searchParams.get("role") as "customer" | "seller" | null
  const [role, setRole] = useState<"customer" | "seller">(roleParam || "customer")

  // Handle store logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setStoreLogo(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setStoreLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeStoreLogo = () => {
    setStoreLogo(null)
    setStoreLogoPreview(null)
  }

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoggingIn) {
      router.push(user.role === "seller" ? "/seller/dashboard" : "/")
    }
  }, [user, router, isLoggingIn])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      setIsLoggingIn(true)
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
    setIsLoggingIn(false)
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

      sellerData = { phone, storeName, storeDescription, address, storeType, storeLogo }
    }

    if (password !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    try {
      setIsLoggingIn(true)
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
    setIsLoggingIn(false)
  }

  return (
    <div suppressHydrationWarning className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-md">
          <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
            <CardHeader className="space-y-3 pt-8 pb-4 bg-gradient-to-br from-blue-50 to-white">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <CardTitle className="text-2xl text-center font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("مرحباً بك في محلك", "Welcome to Mahalak")}</CardTitle>
              <CardDescription className="text-center text-gray-500">
                {role === "seller"
                  ? t("سجل دخولك كبائع", "Login as a seller")
                  : t("سجل دخولك كعميل", "Login as a customer")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Role Selection */}
              <div className="mb-8">
                <Label className="mb-3 block text-base font-medium text-gray-700">{t("نوع الحساب", "Account Type")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={role === "customer" ? "default" : "outline"}
                    onClick={() => setRole("customer")}
                    className={`h-14 text-base font-bold rounded-xl transition-all duration-300 ${role === "customer" ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl" : "hover:bg-blue-50 hover:border-blue-300"}`}
                  >
                    {t("عميل", "Customer")}
                  </Button>
                  <Button
                    type="button"
                    variant={role === "seller" ? "default" : "outline"}
                    onClick={() => setRole("seller")}
                    className={`h-14 text-base font-bold rounded-xl transition-all duration-300 ${role === "seller" ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl" : "hover:bg-blue-50 hover:border-blue-300"}`}
                  >
                    {t("بائع", "Seller")}
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-gray-100 p-1.5 rounded-2xl">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md data-[state=inactive]:text-gray-500 font-bold text-base transition-all rounded-xl"
                  >
                    {t("تسجيل الدخول", "Login")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md data-[state=inactive]:text-gray-500 font-bold text-base transition-all rounded-xl"
                  >
                    {t("إنشاء حساب", "Create Account")}
                  </TabsTrigger>
                </TabsList>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-base font-medium text-gray-700">
                        {t("البريد الإلكتروني", "Email")}
                      </Label>
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        required
                        placeholder="example@email.com"
                        className="h-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-base font-medium text-gray-700">
                          {t("كلمة المرور", "Password")}
                        </Label>
                        <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors">
                          {t("هل نسيت كلمة السر؟", "Forgot Password?")}
                        </Link>
                      </div>
                      <div className="relative group">
                        <Input
                          id="login-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="h-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all pr-12"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-gray-600 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                        
                        {/* Store Logo Upload */}
                        <div className="space-y-2">
                          <Label htmlFor="register-storeLogo" className="text-base">
                            {t("لوجو المتجر", "Store Logo")}
                          </Label>
                          <div className="flex flex-col items-center gap-4">
                            {storeLogoPreview ? (
                              <div className="relative">
                                <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                                  <Image
                                    src={storeLogoPreview}
                                    alt="Store Logo Preview"
                                    width={96}
                                    height={96}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={removeStoreLogo}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <label
                                htmlFor="register-storeLogo"
                                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm text-gray-500">{t("اضغط لرفع لوجو المتجر", "Click to upload store logo")}</span>
                                <span className="text-xs text-gray-400 mt-1">{t("PNG, JPG حتى 2MB", "PNG, JPG up to 2MB")}</span>
                              </label>
                            )}
                            <input
                              id="register-storeLogo"
                              name="storeLogo"
                              type="file"
                              accept="image/png, image/jpeg, image/jpg, image/webp"
                              onChange={handleLogoChange}
                              className="hidden"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-base">
                        {t("كلمة المرور", "Password")}
                      </Label>
                      <div className="relative group">
                        <Input
                          id="register-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="h-12 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 group-hover:text-gray-700"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="text-base">
                        {t("تأكيد كلمة المرور", "Confirm Password")}
                      </Label>
                      <div className="relative group">
                        <Input
                          id="register-confirm"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          className="h-12 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 group-hover:text-gray-700"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                        </button>
                      </div>
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
