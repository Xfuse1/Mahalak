"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Building2, LockKeyhole, MapPinned, Store } from "lucide-react"
import { Header } from "../../../../components/header"
import { Footer } from "../../../../components/footer"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select"
import Link from "next/link"
import { useAuth } from "../../../../lib/auth-context"
import { useLanguage } from "../../../../lib/language-context"
import { EyeOpenIcon, EyeOffIcon } from "../../../../components/ui/icons"
import dynamic from "next/dynamic"
import { getUserByPhone, storePendingRegistration } from "../../../../lib/actions/profile"
import { SellerFields } from "../../../../components/auth/seller-fields"
import { UploadDialog } from "../../../../components/auth/upload-dialog"
import { normalizeEgyptPhone } from "../../../../lib/utils/phone"
import { uploadStoreDocument, checkStoreNameExists } from "../../../../lib/actions/stores"
import { getFirestoreClient } from "../../../../lib/firebase/client"
import { collection, getDocs } from "firebase/firestore"
import type { CategoryItem } from "../../../../components/auth/seller-fields"

const MapPicker = dynamic(
  () => import("../../../../components/map-picker").then(m => ({ default: m.MapPicker })),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-4">جاري التحميل...</div> }
)

export default function SellerRegisterPage() {
  const router = useRouter()
  const { user, firebaseUser } = useAuth()
  const { t, language } = useLanguage()
  const isRTL = language === "ar"

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn] = useState(false)
  
  const isGoogleUser = firebaseUser?.providerData?.some((provider) => provider.providerId === "google.com") ?? false

  const [sellerPhone, setSellerPhone] = useState("")

  const [selectedStoreType, setSelectedStoreType] = useState("")
  const [selectedStoreTypeId, setSelectedStoreTypeId] = useState("")

  const [storeCategories, setStoreCategories] = useState<CategoryItem[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)

  const [ownerIdNumber, setOwnerIdNumber] = useState("")
  const [idCardImageFront, setIdCardImageFront] = useState<File | null>(null)
  const [idCardImageFrontPreview, setIdCardImageFrontPreview] = useState<string | null>(null)
  const [idCardImageBack, setIdCardImageBack] = useState<File | null>(null)
  const [idCardImageBackPreview, setIdCardImageBackPreview] = useState<string | null>(null)
  const [commercialRegisterImage, setCommercialRegisterImage] = useState<File | null>(null)
  const [commercialRegisterImagePreview, setCommercialRegisterImagePreview] = useState<string | null>(null)
  const [taxCardImageFront, setTaxCardImageFront] = useState<File | null>(null)
  const [taxCardImageFrontPreview, setTaxCardImageFrontPreview] = useState<string | null>(null)
  const [taxCardImageBack, setTaxCardImageBack] = useState<File | null>(null)
  const [taxCardImageBackPreview, setTaxCardImageBackPreview] = useState<string | null>(null)

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [activeUploadTarget, setActiveUploadTarget] = useState<string>("")
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isCheckingStoreName, setIsCheckingStoreName] = useState(false)
  const [storeNameExists, setStoreNameExists] = useState(false)
  const storeNameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showMapPicker, setShowMapPicker] = useState(false)
  const [storeLocation, setStoreLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const [storeLogo, setStoreLogo] = useState<File | null>(null)
  const [storeLogoPreview, setStoreLogoPreview] = useState<string | null>(null)

  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedCity, setSelectedCity] = useState("")

  const errorRef = useRef<HTMLDivElement>(null)
  const fieldClassName =
    "h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 sm:h-14"

  const countriesAndCities: Record<string, string[]> = {
    "مصر": ["القاهرة", "الجيزة", "الإسكندرية", "الشرقية", "الدقهلية", "البحيرة", "المنيا", "المنوفية", "الغربية", "القليوبية", "كفر الشيخ", "سوهاج", "أسيوط", "قنا", "الأقصر", "أسوان", "الفيوم", "بني سويف", "بورسعيد", "الإسماعيلية", "السويس", "دمياط", "شمال سيناء", "جنوب سيناء", "البحر الأحمر", "الوادي الجديد", "مطروح"],
  }

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

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsCategoriesLoading(true)
        const db = getFirestoreClient()
        const categoriesRef = collection(db, "categories")
        const snapshot = await getDocs(categoriesRef)
        const cats: CategoryItem[] = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
        })).filter(cat => cat.name)
        setStoreCategories(cats)
      } catch (err) {
        console.error("Error fetching categories:", err)
      } finally {
        setIsCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    if (user && !isLoggingIn) {
      if (user.role === "seller") {
        router.push("/seller/dashboard")
      }
    }
  }, [user, router, isLoggingIn])

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [error])

  const handleStoreNameChange = (value: string) => {
    if (storeNameTimeoutRef.current) {
      clearTimeout(storeNameTimeoutRef.current)
    }
    setStoreNameExists(false)

    if (value.trim().length >= 3) {
      storeNameTimeoutRef.current = setTimeout(async () => {
        setIsCheckingStoreName(true)
        try {
          const exists = await checkStoreNameExists(value.trim())
          setStoreNameExists(exists)
        } catch (err) {
          console.error("Error checking store name:", err)
        }
        setIsCheckingStoreName(false)
      }, 500)
    }
  }

  const openUploadDialog = (target: string) => {
    setActiveUploadTarget(target)
    setUploadDialogOpen(true)
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024
  const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"]

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return t(
        "نوع الملف غير مدعوم. الأنواع المسموحة: JPEG, PNG, WebP",
        "Unsupported file type. Allowed types: JPEG, PNG, WebP"
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return t(
        "حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت",
        "File is too large. Maximum size is 5MB"
      )
    }
    return null
  }

  const handleUploadedFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const preview = reader.result as string
      switch (activeUploadTarget) {
        case "idCardFront":
          setIdCardImageFront(file)
          setIdCardImageFrontPreview(preview)
          break
        case "idCardBack":
          setIdCardImageBack(file)
          setIdCardImageBackPreview(preview)
          break
        case "commercialRegister":
          setCommercialRegisterImage(file)
          setCommercialRegisterImagePreview(preview)
          break
        case "taxCardFront":
          setTaxCardImageFront(file)
          setTaxCardImageFrontPreview(preview)
          break
        case "taxCardBack":
          setTaxCardImageBack(file)
          setTaxCardImageBackPreview(preview)
          break
      }
    }
    reader.readAsDataURL(file)
    setUploadDialogOpen(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUploadedFile(file)
    e.target.value = ""
  }

  const removeImage = (target: string) => {
    switch (target) {
      case "idCardFront":
        setIdCardImageFront(null)
        setIdCardImageFrontPreview(null)
        break
      case "idCardBack":
        setIdCardImageBack(null)
        setIdCardImageBackPreview(null)
        break
      case "commercialRegister":
        setCommercialRegisterImage(null)
        setCommercialRegisterImagePreview(null)
        break
      case "taxCardFront":
        setTaxCardImageFront(null)
        setTaxCardImageFrontPreview(null)
        break
      case "taxCardBack":
        setTaxCardImageBack(null)
        setTaxCardImageBackPreview(null)
        break
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        e.target.value = ""
        return
      }
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

  const handleRegistrationSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = ((formData.get("name") as string) || user?.name || "").trim()
    const email = ((formData.get("email") as string) || user?.email || "").trim()
    const password = !isGoogleUser ? (formData.get("password") as string) : ""
    const confirmPassword = !isGoogleUser ? (formData.get("confirmPassword") as string) : ""
    const city = selectedCity.trim()
    const country = selectedCountry.trim()

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

      if (!city || city.length < 2) {
        setError(t("يرجى إدخال اسم المدينة", "Please enter the city name"))
        return
      }

      if (!country || country.length < 2) {
        setError(t("يرجى إدخال اسم الدولة", "Please enter the country name"))
        return
      }

      if (!isGoogleUser) {
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
      }

      const normalizedSellerPhone = normalizeEgyptPhone(sellerPhone)
      const storeName = (formData.get("storeName") as string).trim()
      const storeDescription = (formData.get("storeDescription") as string).trim()
      const storeType = selectedStoreType

      if (!normalizedSellerPhone) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح", "Please enter a valid Egyptian phone number"))
        return
      }

      const sellerPhoneCheck = await getUserByPhone(normalizedSellerPhone)
      if (sellerPhoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        return
      }

      if (!storeName || storeName.length < 3) {
        setError(t("اسم المتجر يجب أن يكون 3 أحرف على الأقل", "Store name must be at least 3 characters"))
        return
      }

      if (storeNameExists) {
        setError(t("اسم المتجر مسجل بالفعل. يرجى اختيار اسم آخر", "Store name is already taken. Please choose a different name"))
        return
      }

      if (!storeType) {
        setError(t("يرجى اختيار نوع المتجر", "Please select a store type"))
        return
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}`
      const uploadFile = async (file: File | null, prefix: string, kind: "logo" | "kyc" = "kyc"): Promise<string | null> => {
        if (!file) {
          return null
        }

        try {
          const uploadData = new FormData()
          uploadData.append("file", file)
          uploadData.append("regId", tempId)
          uploadData.append("prefix", prefix)
          uploadData.append("kind", kind)
          const result = await uploadStoreDocument(uploadData)
          return result.success && result.value ? result.value : null
        } catch (uploadError) {
          console.error(`[auth/register] Failed to pre-upload ${prefix}:`, uploadError)
          return null
        }
      }

      const [
        storeLogoUrl,
        idCardImageFrontUrl,
        idCardImageBackUrl,
        commercialRegisterImageUrl,
        taxCardImageFrontUrl,
        taxCardImageBackUrl,
      ] = await Promise.all([
        uploadFile(storeLogo, "logo", "logo"),
        uploadFile(idCardImageFront, "id-card-front", "kyc"),
        uploadFile(idCardImageBack, "id-card-back", "kyc"),
        uploadFile(commercialRegisterImage, "commercial-register", "kyc"),
        uploadFile(taxCardImageFront, "tax-card-front", "kyc"),
        uploadFile(taxCardImageBack, "tax-card-back", "kyc"),
      ])

      const storeResult = await storePendingRegistration({
        email,
        password: isGoogleUser ? undefined : password,
        name,
        role: "seller",
        phone: normalizedSellerPhone,
        storeName,
        storeDescription: storeDescription || undefined,
        storeType,
        storeTypeId: selectedStoreTypeId,
        storeLogoUrl: storeLogoUrl || undefined,
        ownerIdNumber: ownerIdNumber || undefined,
        idCardImageUrl: idCardImageFrontUrl || undefined,
        idCardImageBackUrl: idCardImageBackUrl || undefined,
        commercialRegisterImageUrl: commercialRegisterImageUrl || undefined,
        taxCardImageUrl: taxCardImageFrontUrl || undefined,
        taxCardImageBackUrl: taxCardImageBackUrl || undefined,
        city,
        country,
        latitude: storeLocation?.latitude,
        longitude: storeLocation?.longitude,
      })

      if (!storeResult.success || !storeResult.token) {
        setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
        return
      }

      sessionStorage.setItem("pendingRegistrationToken", storeResult.token)
      // كلمة المرور تبقى في العميل فقط (لا تُخزَّن على الخادم)
      if (!isGoogleUser && password) sessionStorage.setItem("pendingRegistrationPassword", password)
      router.push(`/auth/verify-phone?phone=${encodeURIComponent(normalizedSellerPhone)}&role=seller&returnUrl=/seller/dashboard`)
    } catch (registrationError: any) {
      if (registrationError?.message?.includes("already registered")) {
        setError(t("البريد الإلكتروني مسجل بالفعل", "Email already registered"))
      } else {
        setError(t("فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.", "Account creation failed. Please try again."))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_34%),linear-gradient(180deg,#eef4ff_0%,#f8fbff_22%,#ffffff_52%,#e8f0ff_100%)]">
      <Header />

      <main className="px-3 py-4 md:px-6 md:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-4xl">
          <Card className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <CardHeader className="space-y-5 px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_12px_30px_rgba(59,130,246,0.18)]">
                    <Store className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-black text-slate-900 md:text-2xl lg:text-3xl">
                      {t("إنشاء حساب بائع", "Create Seller Account")}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-xs leading-6 text-slate-500 md:text-sm md:leading-7 lg:text-base">
                      {t("ركزنا على ترتيب الحقول داخل الفورم نفسها لتكون أوضح، أقل ازدحامًا، وأسهل في المتابعة خطوة بخطوة.", "The form is now more organized, calmer, and easier to follow step by step.")}
                    </CardDescription>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-5 md:gap-3">
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-2 py-3 text-center shadow-[0_12px_30px_rgba(37,99,235,0.12)] ring-1 ring-primary/20 md:px-4 md:text-start">
                  <div className="mx-auto mb-0 inline-flex rounded-xl border border-primary/20 bg-white p-2 text-primary shadow-[0_6px_16px_rgba(37,99,235,0.14)] md:mx-0 md:mb-2">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <p className="hidden text-sm font-bold text-slate-900 md:block">{t("الحساب والعنوان", "Account & Address")}</p>
                </div>
                <div className="rounded-2xl border border-slate-300 bg-slate-50 px-2 py-3 text-center shadow-[0_10px_25px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 md:px-4 md:text-start">
                  <div className="mx-auto mb-0 inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm md:mx-0 md:mb-2">
                    <MapPinned className="h-4 w-4" />
                  </div>
                  <p className="hidden text-sm font-bold text-slate-900 md:block">{t("المتجر والوثائق", "Store & Documents")}</p>
                </div>
                <div className="rounded-2xl border border-slate-300 bg-slate-50 px-2 py-3 text-center shadow-[0_10px_25px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 md:px-4 md:text-start">
                  <div className="mx-auto mb-0 inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm md:mx-0 md:mb-2">
                    <LockKeyhole className="h-4 w-4" />
                  </div>
                  <p className="hidden text-sm font-bold text-slate-900 md:block">{t("الأمان", "Security")}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-5 md:px-6 md:pb-7 lg:px-8 lg:pb-8">
              {error && (
                <div ref={errorRef} className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegistrationSubmit} className="space-y-6">
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                  <h3 className="mb-4 text-base font-black text-slate-900 md:text-lg">{t("بيانات الحساب والعنوان", "Account and Address")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="register-name" className="text-sm font-semibold text-slate-700">
                    {t("الاسم الكامل", "Full Name")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="register-name"
                    name="name"
                    type="text"
                    required
                    placeholder={t("أحمد محمد", "Ahmed Mohamed")}
                    defaultValue={isGoogleUser ? (user?.name || firebaseUser?.displayName || "") : undefined}
                    readOnly={isGoogleUser}
                    className={fieldClassName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-semibold text-slate-700">
                    {t("البريد الإلكتروني", "Email")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    required
                    placeholder="example@email.com"
                    defaultValue={isGoogleUser ? (user?.email || firebaseUser?.email || "") : undefined}
                    readOnly={isGoogleUser}
                    className={fieldClassName}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-country" className="text-sm font-semibold text-slate-700">
                      {t("الدولة", "Country")} <span className="text-red-500">*</span>
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
                        {Object.keys(countriesAndCities).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-city" className="text-sm font-semibold text-slate-700">
                      {t("المدينة", "City")} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      name="city"
                      required
                      value={selectedCity}
                      onValueChange={setSelectedCity}
                      disabled={!selectedCountry}
                    >
                      <SelectTrigger id="register-city" className={fieldClassName}>
                        <SelectValue placeholder={selectedCountry ? t("اختر المدينة", "Choose city") : t("اختر الدولة أولاً", "Choose country first")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(countriesAndCities[selectedCountry] || []).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                </div>

                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                  <h3 className="mb-4 text-base font-black text-slate-900 md:text-lg">{t("بيانات المتجر والوثائق", "Store Details and Documents")}</h3>
                <SellerFields
                  t={t}
                  isRTL={isRTL}
                  language={language}
                  categories={storeCategories}
                  isCategoriesLoading={isCategoriesLoading}
                  sellerPhone={sellerPhone}
                  setSellerPhone={setSellerPhone}
                  handleStoreNameChange={handleStoreNameChange}
                  isCheckingStoreName={isCheckingStoreName}
                  storeNameExists={storeNameExists}
                  selectedStoreType={selectedStoreType}
                  setSelectedStoreType={setSelectedStoreType}
                  selectedStoreTypeId={selectedStoreTypeId}
                  setSelectedStoreTypeId={setSelectedStoreTypeId}
                  storeLogoPreview={storeLogoPreview}
                  handleLogoChange={handleLogoChange}
                  removeStoreLogo={removeStoreLogo}
                  ownerIdNumber={ownerIdNumber}
                  setOwnerIdNumber={setOwnerIdNumber}
                  idCardImageFrontPreview={idCardImageFrontPreview}
                  idCardImageBackPreview={idCardImageBackPreview}
                  commercialRegisterImagePreview={commercialRegisterImagePreview}
                  taxCardImageFrontPreview={taxCardImageFrontPreview}
                  taxCardImageBackPreview={taxCardImageBackPreview}
                  removeImage={removeImage}
                  openUploadDialog={openUploadDialog}
                  storeLocation={storeLocation}
                  getCurrentLocation={getCurrentLocation}
                  isGettingLocation={isGettingLocation}
                  locationError={locationError}
                  setShowMapPicker={setShowMapPicker}
                />
                </div>

                {!isGoogleUser && (
                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-3 md:p-5">
                    <h3 className="mb-4 text-base font-black text-slate-900 md:text-lg">{t("الأمان", "Security")}</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="text-sm font-semibold text-slate-700">
                          {t("كلمة المرور", "Password")} <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative group">
                          <Input
                            id="register-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            className={`${fieldClassName} pe-10`}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-400 transition group-hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-confirm" className="text-sm font-semibold text-slate-700">
                          {t("تأكيد كلمة المرور", "Confirm Password")} <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative group">
                          <Input
                            id="register-confirm"
                            name="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            className={`${fieldClassName} pe-10`}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 end-0 flex items-center px-3 text-slate-400 transition group-hover:text-slate-600"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-primary text-sm font-bold shadow-lg transition-all hover:scale-[1.01] hover:bg-primary/90 hover:shadow-xl active:scale-[0.99] md:h-14 md:text-base"
                  disabled={isLoading}
                >
                  {isLoading ? t("جاري إنشاء الحساب...", "Creating account...") : t("إنشاء حساب", "Create Account")}
                </Button>

                <div className="pt-4 text-center text-sm text-slate-500">
                  <p>
                    {t("هل لديك حساب بالفعل؟", "Already have an account?")} {" "}
                    <Link href="/auth/seller/login" className="text-primary hover:text-primary/80 font-medium hover:underline">
                      {t("سجل الدخول هنا", "Login here")}
                    </Link>
                  </p>
                  <p className="mt-3">
                    {t("تريد التسجيل كعميل؟", "Want to register as a customer?")}{" "}
                    <Link href="/auth/register" className="text-primary hover:text-primary/80 font-medium hover:underline">
                      {t("اذهب لفورم العميل", "Go to customer form")}
                    </Link>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />

      <UploadDialog
        t={t}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        fileInputRef={fileInputRef}
        cameraInputRef={cameraInputRef}
        onFileChange={handleFileInputChange}
      />

      <MapPicker
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={(lat, lng) => {
          setStoreLocation({ latitude: lat, longitude: lng })
          setLocationError(null)
        }}
        initialLat={storeLocation?.latitude}
        initialLng={storeLocation?.longitude}
        language={language}
      />
    </div>
  )
}
