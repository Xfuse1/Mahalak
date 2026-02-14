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
import dynamic from "next/dynamic"
import { getUserByPhone, storePendingRegistration } from "../../lib/actions/profile"
import { LoginForm } from "../../components/auth/login-form"
import { SellerFields } from "../../components/auth/seller-fields"
import { UploadDialog } from "../../components/auth/upload-dialog"

// Lazy load phone verification (heavy: Firebase reCAPTCHA)
const PhoneVerification = dynamic(
  () => import("../../components/phone-verification").then(m => ({ default: m.PhoneVerification })),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-4">جاري التحميل...</div> }
)
import { uploadStoreImage, checkStoreNameExists } from "../../lib/actions/stores"
import { getFirestoreClient } from "../../lib/firebase/client"
import { collection, getDocs } from "firebase/firestore"
import type { CategoryItem } from "../../components/auth/seller-fields"

// Lazy load map picker
const MapPicker = dynamic(
  () => import("../../components/map-picker").then(m => ({ default: m.MapPicker })),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-4">جاري التحميل...</div> }
)

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
  
  // Store type state
  const [selectedStoreType, setSelectedStoreType] = useState("")
  
  // Categories from Firestore
  const [storeCategories, setStoreCategories] = useState<CategoryItem[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  
  // Seller document fields
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
  
  // Upload method dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [activeUploadTarget, setActiveUploadTarget] = useState<string>("")
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Store name uniqueness check
  const [isCheckingStoreName, setIsCheckingStoreName] = useState(false)
  const [storeNameExists, setStoreNameExists] = useState(false)
  const storeNameTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false)
  
  // Country/City selection
  const [selectedCountry, setSelectedCountry] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  
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

  // Fetch categories from Firestore
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
        })).filter(cat => cat.name) // filter out any without name
        setStoreCategories(cats)
      } catch (err) {
        console.error("Error fetching categories:", err)
      } finally {
        setIsCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // Countries and cities data (حالياً مصر فقط - سيتم إضافة دول أخرى لاحقاً)
  const countriesAndCities: Record<string, string[]> = {
    "مصر": ["القاهرة", "الجيزة", "الإسكندرية", "الشرقية", "الدقهلية", "البحيرة", "المنيا", "المنوفية", "الغربية", "القليوبية", "كفر الشيخ", "سوهاج", "أسيوط", "قنا", "الأقصر", "أسوان", "الفيوم", "بني سويف", "بورسعيد", "الإسماعيلية", "السويس", "دمياط", "شمال سيناء", "جنوب سيناء", "البحر الأحمر", "الوادي الجديد", "مطروح"],
  }

  // Handle store name check
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

  // Open upload dialog for a specific target
  const openUploadDialog = (target: string) => {
    setActiveUploadTarget(target)
    setUploadDialogOpen(true)
  }
  
  // File validation constants
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
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

  // Handle file from upload or camera
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

  // Handle store logo upload
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
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string
    const street = formData.get("street") as string
    const city = selectedCity || ""
    const country = selectedCountry || ""

    // ======= Comprehensive Validation =======

    // Name validation
    if (!name || name.trim().length < 3) {
      setError(t("الاسم يجب أن يكون 3 أحرف على الأقل", "Name must be at least 3 characters"))
      setIsLoading(false)
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      setError(t("يرجى إدخال بريد إلكتروني صحيح", "Please enter a valid email address"))
      setIsLoading(false)
      return
    }

    // Customer phone validation
    if (role === "customer") {
      const phoneRegex = /^(01[0125])\d{8}$/
      if (!customerPhone || !phoneRegex.test(customerPhone)) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)", "Please enter a valid Egyptian phone number (e.g., 01012345678)"))
        setIsLoading(false)
        return
      }
      
      // Check if phone is already registered
      const phoneCheck = await getUserByPhone(customerPhone)
      if (phoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        setIsLoading(false)
        return
      }

      // If phone is not verified yet, redirect to verify page
      if (!isCustomerPhoneVerified && customerPhoneStep === "phone") {
        
        // Store registration data server-side (password never touches sessionStorage)
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
        const storeResult = await storePendingRegistration(pendingData)
        if (!storeResult.success || !storeResult.token) {
          setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
          setIsLoading(false)
          return
        }
        // Only store the token in sessionStorage, not the password
        sessionStorage.setItem("pendingRegistrationToken", storeResult.token)
        
        // Format phone and redirect to verify page
        const formattedPhone = customerPhone.startsWith("+") ? customerPhone : `+2${customerPhone}`
        
        router.push(`/auth/verify-phone?phone=${encodeURIComponent(formattedPhone)}&role=customer&returnUrl=/`)
        return
      }
      
      // If we're in OTP step, wait for verification
      if (!isCustomerPhoneVerified && customerPhoneStep === "otp") {
        setError(t("يرجى إدخال كود التحقق أولاً", "Please enter the verification code first"))
        setIsLoading(false)
        return
      }
    }

    // Address validation
    if (!street || street.trim().length < 2) {
      setError(t("يرجى إدخال عنوان الشارع", "Please enter the street address"))
      setIsLoading(false)
      return
    }
    if (!city || city.trim().length < 2) {
      setError(t("يرجى إدخال اسم المدينة", "Please enter the city name"))
      setIsLoading(false)
      return
    }
    if (!country || country.trim().length < 2) {
      setError(t("يرجى إدخال اسم الدولة", "Please enter the country name"))
      setIsLoading(false)
      return
    }

    // Password validation
    if (!password || password.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"))
      setIsLoading(false)
      return
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(t("كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل", "Password must contain at least one letter and one number"))
      setIsLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    let sellerData
    if (role === "seller") {
      const phone = sellerPhone
      const storeName = formData.get("storeName") as string
      const storeDescription = formData.get("storeDescription") as string
      const storeType = selectedStoreType

      // Seller phone validation
      const sellerPhoneRegex = /^(01[0125])\d{8}$/
      if (!phone || !sellerPhoneRegex.test(phone)) {
        setError(t("يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)", "Please enter a valid Egyptian phone number (e.g., 01012345678)"))
        setIsLoading(false)
        return
      }
      
      // Check if seller phone is already registered
      const sellerPhoneCheck = await getUserByPhone(phone)
      if (sellerPhoneCheck.success) {
        setError(t("رقم الهاتف مسجل بالفعل في حساب آخر", "This phone number is already registered to another account"))
        setIsLoading(false)
        return
      }
      
      // Seller document validations
      if (!ownerIdNumber || ownerIdNumber.length !== 14) {
        setError(t("رقم البطاقة يجب أن يكون 14 رقم بالضبط", "ID card number must be exactly 14 digits"))
        setIsLoading(false)
        return
      }
      if (!idCardImageFront) {
        setError(t("يرجى رفع صورة وجه البطاقة", "Please upload the front side of the ID card"))
        setIsLoading(false)
        return
      }
      if (!idCardImageBack) {
        setError(t("يرجى رفع صورة ظهر البطاقة", "Please upload the back side of the ID card"))
        setIsLoading(false)
        return
      }

      // Store name validation
      if (!storeName || storeName.trim().length < 3) {
        setError(t("اسم المتجر يجب أن يكون 3 أحرف على الأقل", "Store name must be at least 3 characters"))
        setIsLoading(false)
        return
      }
      
      // Check store name uniqueness
      if (storeNameExists) {
        setError(t("اسم المتجر مسجل بالفعل. يرجى اختيار اسم آخر", "Store name is already taken. Please choose a different name"))
        setIsLoading(false)
        return
      }

      // Store description validation
      if (!storeDescription || storeDescription.trim().length < 10) {
        setError(t("وصف المتجر يجب أن يكون 10 أحرف على الأقل", "Store description must be at least 10 characters"))
        setIsLoading(false)
        return
      }

      // Store type validation
      if (!storeType) {
        setError(t("يرجى اختيار نوع المتجر", "Please select a store type"))
        setIsLoading(false)
        return
      }
      
      // التحقق من رفع لوجو المتجر
      if (!storeLogo) {
        setError(t("يرجى رفع لوجو المتجر", "Please upload a store logo"))
        setIsLoading(false)
        return
      }
      


      // If phone is not verified yet, trigger OTP send and redirect to verify page
      if (!isPhoneVerified && phoneStep === "phone") {
        
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
        
        const [storeLogoUrl, idCardImageFrontUrl, idCardImageBackUrl, commercialRegisterImageUrl, taxCardImageFrontUrl, taxCardImageBackUrl] = await Promise.all([
          uploadFile(storeLogo, "logo"),
          uploadFile(idCardImageFront, "id-card-front"),
          uploadFile(idCardImageBack, "id-card-back"),
          uploadFile(commercialRegisterImage, "commercial-register"),
          uploadFile(taxCardImageFront, "tax-card-front"),
          uploadFile(taxCardImageBack, "tax-card-back"),
        ])
        
        // Store registration data server-side (password never touches sessionStorage)
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
          idCardImageUrl: idCardImageFrontUrl,
          idCardImageBackUrl,
          commercialRegisterImageUrl,
          taxCardImageUrl: taxCardImageFrontUrl,
          taxCardImageBackUrl,
          street,
          city,
          country,
          latitude: storeLocation?.latitude,
          longitude: storeLocation?.longitude,
        }
        const storeResult = await storePendingRegistration(pendingData)
        if (!storeResult.success || !storeResult.token) {
          setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
          setIsLoading(false)
          return
        }
        // Only store the token in sessionStorage, not the password
        sessionStorage.setItem("pendingRegistrationToken", storeResult.token)
        
        // Format phone and redirect to verify page (OTP will be sent there)
        const formattedPhone = phone.startsWith("+") ? phone : `+2${phone}`
        
        // Redirect to verify page - OTP will be sent from there
        router.push(`/auth/verify-phone?phone=${encodeURIComponent(formattedPhone)}&role=seller&returnUrl=/seller/dashboard`)
        return
      }
      
      // If we're in OTP step, wait for verification
      if (!isPhoneVerified && phoneStep === "otp") {
        setError(t("يرجى إدخال كود التحقق أولاً", "Please enter the verification code first"))
        setIsLoading(false)
        return
      }

      // Combine address fields for the store
      const storeAddress = [street, city, country].filter(Boolean).join(", ")
      
      sellerData = { phone, storeName, storeDescription, storeType, storeLogo, address: storeAddress, latitude: storeLocation?.latitude, longitude: storeLocation?.longitude }
    }

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
                  <LoginForm
                    onSubmit={handleLogin}
                    isLoading={isLoading}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    t={t}
                  />
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
                        recaptchaId="recaptcha-container-customer"
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
                      <Label htmlFor="register-country" className="text-base">
                        {t("الدولة", "Country")} <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        name="country"
                        required
                        value={selectedCountry}
                        onValueChange={(value) => {
                          setSelectedCountry(value)
                          setSelectedCity("") // Reset city when country changes
                        }}
                      >
                        <SelectTrigger id="register-country" className="h-12">
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
                      <Label htmlFor="register-city" className="text-base">
                        {t("المدينة", "City")} <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        name="city"
                        required
                        value={selectedCity}
                        onValueChange={setSelectedCity}
                        disabled={!selectedCountry}
                      >
                        <SelectTrigger id="register-city" className="h-12">
                          <SelectValue placeholder={selectedCountry ? t("اختر المدينة", "Choose city") : t("اختر الدولة أولاً", "Choose country first")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(countriesAndCities[selectedCountry] || []).map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {role === "seller" && (
                      <SellerFields
                        t={t}
                        isRTL={isRTL}
                        language={language}
                        setError={setError}
                        categories={storeCategories}
                        isCategoriesLoading={isCategoriesLoading}
                        sellerPhone={sellerPhone}
                        setSellerPhone={setSellerPhone}
                        isPhoneVerified={isPhoneVerified}
                        setIsPhoneVerified={setIsPhoneVerified}
                        triggerSendOTP={triggerSendOTP}
                        setTriggerSendOTP={setTriggerSendOTP}
                        phoneStep={phoneStep}
                        setPhoneStep={setPhoneStep}
                        handleStoreNameChange={handleStoreNameChange}
                        isCheckingStoreName={isCheckingStoreName}
                        storeNameExists={storeNameExists}
                        selectedStoreType={selectedStoreType}
                        setSelectedStoreType={setSelectedStoreType}

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
                          className="h-12 pe-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 group-hover:text-gray-700"
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
                          className="h-12 pe-10"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 end-0 flex items-center px-3 text-gray-500 group-hover:text-gray-700"
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
      
      <UploadDialog
        t={t}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        fileInputRef={fileInputRef}
        cameraInputRef={cameraInputRef}
        onFileChange={handleFileInputChange}
      />
      
      {/* Map Picker Dialog */}
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
