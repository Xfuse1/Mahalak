"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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
import { MapPin, Loader2, CheckCircle } from "lucide-react"
import Image from "next/image"
import { PhoneVerification } from "../../components/phone-verification"
import { getUserByPhone } from "../../lib/actions/profile"
import { uploadStoreImage } from "../../lib/actions/stores"

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
  
  // Customer phone state
  const [customerPhone, setCustomerPhone] = useState("")
  const [isCustomerPhoneVerified, setIsCustomerPhoneVerified] = useState(false)
  const [triggerCustomerSendOTP, setTriggerCustomerSendOTP] = useState(false)
  const [customerPhoneStep, setCustomerPhoneStep] = useState<"phone" | "otp" | "verified">("phone")
  
  // Phone verification state for sellers
  const [sellerPhone, setSellerPhone] = useState("")
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [triggerSendOTP, setTriggerSendOTP] = useState(false)
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp" | "verified">("phone")
  
  // Store type state for "other" option
  const [selectedStoreType, setSelectedStoreType] = useState("")
  const [customStoreType, setCustomStoreType] = useState("")
  
  // Seller document fields
  const [ownerIdNumber, setOwnerIdNumber] = useState("")
  const [idCardImage, setIdCardImage] = useState<File | null>(null)
  const [idCardImagePreview, setIdCardImagePreview] = useState<string | null>(null)
  const [commercialRegisterImage, setCommercialRegisterImage] = useState<File | null>(null)
  const [commercialRegisterImagePreview, setCommercialRegisterImagePreview] = useState<string | null>(null)
  const [taxCardImage, setTaxCardImage] = useState<File | null>(null)
  const [taxCardImagePreview, setTaxCardImagePreview] = useState<string | null>(null)
  
  // Error scroll ref
  const errorRef = useRef<HTMLDivElement>(null)
  
  // Store location state
  const [storeLocation, setStoreLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  
  // Get current location function
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t("المتصفح لا يدعم تحديد الموقع", "Browser doesn't support geolocation"))
      return
    }
    
    setIsGettingLocation(true)
    setLocationError(null)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStoreLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(t("تم رفض إذن الموقع. يرجى السماح بالوصول للموقع", "Location permission denied. Please allow location access"))
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError(t("معلومات الموقع غير متاحة", "Location information unavailable"))
            break
          case error.TIMEOUT:
            setLocationError(t("انتهت مهلة طلب الموقع", "Location request timed out"))
            break
          default:
            setLocationError(t("حدث خطأ في تحديد الموقع", "Error getting location"))
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

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
  
  // Handle document image uploads
  const handleDocImageChange = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setter(file)
      const reader = new FileReader()
      reader.onloadend = () => previewSetter(reader.result as string)
      reader.readAsDataURL(file)
    }
  }
  
  const removeDocImage = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) => () => {
    setter(null)
    previewSetter(null)
  }

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoggingIn) {
      router.push(user.role === "seller" ? "/seller/dashboard" : "/")
    }
  }, [user, router, isLoggingIn])

  // Scroll to error when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [error])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const emailOrPhone = (formData.get("emailOrPhone") as string).trim()
    const password = formData.get("password") as string

    // Detect if input is a phone number (Egyptian: starts with 01, 11 digits)
    const isPhone = /^(01[0125])\d{8}$/.test(emailOrPhone)

    let email = emailOrPhone

    try {
      if (isPhone) {
        // Look up the email associated with this phone number
        const result = await getUserByPhone(emailOrPhone)
        if (!result.success || !result.data?.email) {
          setIsLoading(false)
          setError(t("لا يوجد حساب مرتبط برقم الهاتف هذا", "No account found with this phone number"))
          return
        }
        email = result.data.email
      }

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
    setError("")

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string
    const street = formData.get("street") as string
    const city = formData.get("city") as string
    const country = formData.get("country") as string

    // ======= Comprehensive Validation =======

    // Name validation
    if (!name || name.trim().length < 3) {
      setError(t("الاسم يجب أن يكون 3 أحرف على الأقل", "Name must be at least 3 characters"))
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      setError(t("يرجى إدخال بريد إلكتروني صحيح", "Please enter a valid email address"))
      return
    }

    // Customer phone validation
    if (role === "customer") {
      const phoneRegex = /^(01[0125])\d{8}$/
      if (!customerPhone || !phoneRegex.test(customerPhone)) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)", "Please enter a valid Egyptian phone number (e.g., 01012345678)"))
        return
      }
      
      // Check if phone is already registered
      const phoneCheck = await getUserByPhone(customerPhone)
      if (phoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        return
      }

      // If phone is not verified yet, redirect to verify page
      if (!isCustomerPhoneVerified && customerPhoneStep === "phone") {
        setIsLoading(true)
        
        // Save customer data to session storage for later
        const pendingData = {
          email,
          password,
          name,
          phone: customerPhone,
          street,
          city,
          country,
          role: "customer",
        }
        sessionStorage.setItem("pendingCustomerData", JSON.stringify(pendingData))
        
        // Format phone and redirect to verify page
        const formattedPhone = customerPhone.startsWith("+") ? customerPhone : `+2${customerPhone}`
        
        router.push(`/auth/verify-phone?phone=${encodeURIComponent(formattedPhone)}&role=customer&returnUrl=/`)
        return
      }
      
      // If we're in OTP step, wait for verification
      if (!isCustomerPhoneVerified && customerPhoneStep === "otp") {
        setError(t("يرجى إدخال كود التحقق أولاً", "Please enter the verification code first"))
        return
      }
    }

    // Address validation
    if (!street || street.trim().length < 2) {
      setError(t("يرجى إدخال عنوان الشارع", "Please enter the street address"))
      return
    }
    if (!city || city.trim().length < 2) {
      setError(t("يرجى إدخال اسم المدينة", "Please enter the city name"))
      return
    }
    if (!country || country.trim().length < 2) {
      setError(t("يرجى إدخال اسم الدولة", "Please enter the country name"))
      return
    }

    // Password validation
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

    let sellerData
    if (role === "seller") {
      const phone = sellerPhone
      const storeName = formData.get("storeName") as string
      const storeDescription = formData.get("storeDescription") as string
      // Use custom store type if "خدمات أخرى" is selected
      const storeType = selectedStoreType === "خدمات أخرى" ? customStoreType : selectedStoreType

      // Seller phone validation
      const sellerPhoneRegex = /^(01[0125])\d{8}$/
      if (!phone || !sellerPhoneRegex.test(phone)) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)", "Please enter a valid Egyptian phone number (e.g., 01012345678)"))
        return
      }
      
      // Check if seller phone is already registered
      const sellerPhoneCheck = await getUserByPhone(phone)
      if (sellerPhoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        return
      }
      
      // Seller document validations
      if (!ownerIdNumber || ownerIdNumber.trim().length < 10) {
        setError(t("يرجى إدخال رقم بطاقة صاحب المتجر (14 رقم)", "Please enter the store owner's ID card number (14 digits)"))
        return
      }
      if (!idCardImage) {
        setError(t("يرجى رفع صورة البطاقة", "Please upload the ID card image"))
        return
      }
      if (!commercialRegisterImage) {
        setError(t("يرجى رفع صورة السجل التجاري", "Please upload the commercial register image"))
        return
      }
      if (!taxCardImage) {
        setError(t("يرجى رفع صورة البطاقة الضريبية", "Please upload the tax card image"))
        return
      }

      // Store name validation
      if (!storeName || storeName.trim().length < 3) {
        setError(t("اسم المتجر يجب أن يكون 3 أحرف على الأقل", "Store name must be at least 3 characters"))
        return
      }

      // Store description validation
      if (!storeDescription || storeDescription.trim().length < 10) {
        setError(t("وصف المتجر يجب أن يكون 10 أحرف على الأقل", "Store description must be at least 10 characters"))
        return
      }

      // Store type validation
      if (!storeType) {
        setError(t("يرجى اختيار نوع المتجر", "Please select a store type"))
        return
      }
      
      // التحقق من رفع لوجو المتجر
      if (!storeLogo) {
        setError(t("يرجى رفع لوجو المتجر", "Please upload a store logo"))
        return
      }
      
      // Validate custom store type when "خدمات أخرى" is selected
      if (selectedStoreType === "خدمات أخرى" && !customStoreType.trim()) {
        setError(t("يرجى تحديد نوع المتجر", "Please specify the store type"))
        return
      }

      // If phone is not verified yet, trigger OTP send and redirect to verify page
      if (!isPhoneVerified && phoneStep === "phone") {
        setIsLoading(true)
        
        // Upload logo and document images to Supabase first (base64 is too large for sessionStorage)
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`
        
        const uploadFile = async (file: File | null, prefix: string): Promise<string | null> => {
          if (!file) return null
          try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("storeId", `${tempId}/${prefix}`)
            const res = await uploadStoreImage(fd)
            return res.success && res.url ? res.url : null
          } catch (err) {
            console.error(`[v0] Failed to pre-upload ${prefix}:`, err)
            return null
          }
        }
        
        const [storeLogoUrl, idCardImageUrl, commercialRegisterImageUrl, taxCardImageUrl] = await Promise.all([
          uploadFile(storeLogo, "logo"),
          uploadFile(idCardImage, "id-card"),
          uploadFile(commercialRegisterImage, "commercial-register"),
          uploadFile(taxCardImage, "tax-card"),
        ])
        
        // Save seller data to session storage for later
        const pendingData = {
          email,
          password,
          name,
          phone,
          storeName,
          storeDescription,
          storeType,
          storeLogoUrl,
          ownerIdNumber,
          idCardImageUrl,
          commercialRegisterImageUrl,
          taxCardImageUrl,
          street,
          city,
          country,
          latitude: storeLocation?.latitude,
          longitude: storeLocation?.longitude,
        }
        sessionStorage.setItem("pendingSellerData", JSON.stringify(pendingData))
        
        // Format phone and redirect to verify page (OTP will be sent there)
        const formattedPhone = phone.startsWith("+") ? phone : `+2${phone}`
        
        // Redirect to verify page - OTP will be sent from there
        router.push(`/auth/verify-phone?phone=${encodeURIComponent(formattedPhone)}&role=seller&returnUrl=/seller/dashboard`)
        return
      }
      
      // If we're in OTP step, wait for verification
      if (!isPhoneVerified && phoneStep === "otp") {
        setError(t("يرجى إدخال كود التحقق أولاً", "Please enter the verification code first"))
        return
      }

      // Combine address fields for the store
      const storeAddress = [street, city, country].filter(Boolean).join(", ")
      
      sellerData = { phone, storeName, storeDescription, storeType, storeLogo, address: storeAddress, latitude: storeLocation?.latitude, longitude: storeLocation?.longitude }
    }

    setIsLoading(true)

    try {
      setIsLoggingIn(true)
      const success = await register(email, password, name, role, sellerData, street, city, country, role === "customer" ? customerPhone : undefined)

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
                    className={`h-14 text-base font-bold rounded-xl transition-all duration-300 ${role === "customer" ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl" : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"}`}
                  >
                    {t("عميل", "Customer")}
                  </Button>
                  <Button
                    type="button"
                    variant={role === "seller" ? "default" : "outline"}
                    onClick={() => setRole("seller")}
                    className={`h-14 text-base font-bold rounded-xl transition-all duration-300 ${role === "seller" ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl" : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"}`}
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
                  <div ref={errorRef} className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="login-emailOrPhone" className="text-base font-medium text-gray-700">
                        {t("البريد الإلكتروني أو رقم الهاتف", "Email or Phone Number")}
                      </Label>
                      <Input
                        id="login-emailOrPhone"
                        name="emailOrPhone"
                        type="text"
                        required
                        placeholder={t("example@email.com أو 01012345678", "example@email.com or 01012345678")}
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
                        {t("الاسم الكامل", "Full Name")} <span className="text-red-500">*</span>
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
                        {t("البريد الإلكتروني", "Email")} <span className="text-red-500">*</span>
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

                    {role === "customer" && (
                      <PhoneVerification
                        phoneNumber={customerPhone}
                        onPhoneChange={setCustomerPhone}
                        onVerified={setIsCustomerPhoneVerified}
                        isVerified={isCustomerPhoneVerified}
                        language={language}
                        triggerSendOTP={triggerCustomerSendOTP}
                        onOTPSent={(success, error) => {
                          setTriggerCustomerSendOTP(false)
                          if (!success && error) {
                            setError(error)
                          }
                        }}
                        onStepChange={setCustomerPhoneStep}
                      />
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-street" className="text-base">
                        {t("الشارع", "Street")} <span className="text-red-500">*</span>
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
                        {t("المدينة", "City")} <span className="text-red-500">*</span>
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
                        {t("الدولة", "Country")} <span className="text-red-500">*</span>
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
                        <PhoneVerification
                          phoneNumber={sellerPhone}
                          onPhoneChange={setSellerPhone}
                          onVerified={setIsPhoneVerified}
                          isVerified={isPhoneVerified}
                          language={language}
                          triggerSendOTP={triggerSendOTP}
                          onOTPSent={(success, error) => {
                            setTriggerSendOTP(false)
                            if (!success && error) {
                              setError(error)
                            }
                          }}
                          onStepChange={setPhoneStep}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="register-storeName" className="text-base">
                            {t("اسم المتجر", "Store Name")} <span className="text-red-500">*</span>
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
                            {t("وصف المتجر", "Store Description")} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="register-storeDescription"
                            name="storeDescription"
                            type="text"
                            required
                            placeholder={t("وصف مختصر عن متجرك", "Brief description of your store")}
                            className="h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-storeType" className="text-base">
                            {t("نوع المتجر", "Store Type")} <span className="text-red-500">*</span>
                          </Label>
                          <Select 
                            name="storeType" 
                            required
                            value={selectedStoreType}
                            onValueChange={(value) => {
                              setSelectedStoreType(value)
                              if (value !== "خدمات أخرى") {
                                setCustomStoreType("")
                              }
                            }}
                          >
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
                        
                        {/* Custom Store Type - shown when "Other Services" is selected */}
                        {selectedStoreType === "خدمات أخرى" && (
                          <div className="space-y-2">
                            <Label htmlFor="register-customStoreType" className="text-base">
                              {t("حدد نوع المتجر", "Specify Store Type")} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="register-customStoreType"
                              name="customStoreType"
                              type="text"
                              required
                              value={customStoreType}
                              onChange={(e) => setCustomStoreType(e.target.value)}
                              placeholder={t("مثال: مستلزمات حيوانات أليفة", "Example: Pet Supplies")}
                              className="h-12"
                            />
                          </div>
                        )}
                        
                        {/* Store Logo Upload */}
                        <div className="space-y-2">
                          <Label htmlFor="register-storeLogo" className="text-base">
                            {t("لوجو المتجر", "Store Logo")} <span className="text-red-500">*</span>
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
                        
                        {/* Owner ID Card Number */}
                        <div className="space-y-2">
                          <Label htmlFor="register-ownerIdNumber" className="text-base">
                            {t("رقم بطاقة صاحب المتجر", "Store Owner ID Card Number")} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="register-ownerIdNumber"
                            name="ownerIdNumber"
                            type="text"
                            dir="ltr"
                            required
                            value={ownerIdNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "")
                              setOwnerIdNumber(val)
                            }}
                            placeholder="12345678901234"
                            className="h-12"
                            maxLength={14}
                          />
                          <p className="text-xs text-gray-500">
                            {t("أدخل الرقم القومي المكون من 14 رقم", "Enter the 14-digit national ID number")}
                          </p>
                        </div>
                        
                        {/* ID Card Image */}
                        <div className="space-y-2">
                          <Label htmlFor="register-idCardImage" className="text-base">
                            {t("صورة البطاقة", "ID Card Image")} <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex flex-col items-center gap-3">
                            {idCardImagePreview ? (
                              <div className="relative w-full">
                                <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                                  <Image src={idCardImagePreview} alt="ID Card" width={300} height={128} className="w-full h-full object-cover" />
                                </div>
                                <button type="button" onClick={removeDocImage(setIdCardImage, setIdCardImagePreview)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <label htmlFor="register-idCardImage" className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span className="text-sm text-gray-500">{t("اضغط لرفع صورة البطاقة", "Click to upload ID card image")}</span>
                              </label>
                            )}
                            <input id="register-idCardImage" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleDocImageChange(setIdCardImage, setIdCardImagePreview)} className="hidden" />
                          </div>
                        </div>
                        
                        {/* Commercial Register Image */}
                        <div className="space-y-2">
                          <Label htmlFor="register-commercialRegister" className="text-base">
                            {t("صورة السجل التجاري", "Commercial Register Image")} <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex flex-col items-center gap-3">
                            {commercialRegisterImagePreview ? (
                              <div className="relative w-full">
                                <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                                  <Image src={commercialRegisterImagePreview} alt="Commercial Register" width={300} height={128} className="w-full h-full object-cover" />
                                </div>
                                <button type="button" onClick={removeDocImage(setCommercialRegisterImage, setCommercialRegisterImagePreview)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <label htmlFor="register-commercialRegister" className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span className="text-sm text-gray-500">{t("اضغط لرفع صورة السجل التجاري", "Click to upload commercial register image")}</span>
                              </label>
                            )}
                            <input id="register-commercialRegister" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleDocImageChange(setCommercialRegisterImage, setCommercialRegisterImagePreview)} className="hidden" />
                          </div>
                        </div>
                        
                        {/* Tax Card Image */}
                        <div className="space-y-2">
                          <Label htmlFor="register-taxCard" className="text-base">
                            {t("صورة البطاقة الضريبية", "Tax Card Image")} <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex flex-col items-center gap-3">
                            {taxCardImagePreview ? (
                              <div className="relative w-full">
                                <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                                  <Image src={taxCardImagePreview} alt="Tax Card" width={300} height={128} className="w-full h-full object-cover" />
                                </div>
                                <button type="button" onClick={removeDocImage(setTaxCardImage, setTaxCardImagePreview)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <label htmlFor="register-taxCard" className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span className="text-sm text-gray-500">{t("اضغط لرفع صورة البطاقة الضريبية", "Click to upload tax card image")}</span>
                              </label>
                            )}
                            <input id="register-taxCard" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleDocImageChange(setTaxCardImage, setTaxCardImagePreview)} className="hidden" />
                          </div>
                        </div>
                        
                        {/* Store Location */}
                        <div className="space-y-2">
                          <Label className="text-base">
                            {t("موقع المتجر (اختياري)", "Store Location (Optional)")}
                          </Label>
                          <div className="flex flex-col gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={getCurrentLocation}
                              disabled={isGettingLocation}
                              className="h-12 w-full flex items-center justify-center gap-2"
                            >
                              {isGettingLocation ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  {t("جاري تحديد الموقع...", "Getting location...")}
                                </>
                              ) : storeLocation ? (
                                <>
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                  {t("تم تحديد الموقع", "Location captured")}
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-5 w-5" />
                                  {t("تحديد موقع المتجر الحالي", "Get current store location")}
                                </>
                              )}
                            </Button>
                            
                            {storeLocation && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                                <div className="flex items-center gap-2 text-green-700">
                                  <MapPin className="h-4 w-4" />
                                  <span className="font-medium">{t("تم تحديد الموقع بنجاح", "Location captured successfully")}</span>
                                </div>
                                <div className="mt-1 text-green-600 text-xs">
                                  Lat: {storeLocation.latitude.toFixed(6)}, Lng: {storeLocation.longitude.toFixed(6)}
                                </div>
                              </div>
                            )}
                            
                            {locationError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                                {locationError}
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-500">
                              {t("يمكنك تحديد الموقع لاحقاً من إعدادات المتجر", "You can set location later from store settings")}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-base">
                        {t("كلمة المرور", "Password")} <span className="text-red-500">*</span>
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
                        {t("تأكيد كلمة المرور", "Confirm Password")} <span className="text-red-500">*</span>
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
