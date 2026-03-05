"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { User, Phone, MapPin, FileText, Navigation, Loader2 } from "lucide-react"
import type { CheckoutItem } from "@/lib/types/checkout"

export default function CheckoutPage() {
  const { t, language } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const { items: cartItems } = useCartStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Check if this is "Buy Now" mode (single product) or cart mode
  const isBuyNowMode = searchParams.get("mode") === "buynow"
  
  const [buyNowItem, setBuyNowItem] = useState<CheckoutItem | null>(null)
  
  // Get items based on mode
  const items: CheckoutItem[] = isBuyNowMode && buyNowItem ? [buyNowItem] : cartItems
  
  // Calculate total with discounts
  const total = items.reduce((sum, item) => {
    const discountedPrice = item.discount_percentage && item.discount_percentage > 0
      ? item.price - (item.price * item.discount_percentage / 100)
      : item.price
    return sum + discountedPrice * item.quantity
  }, 0)

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    notes: "",
    latitude: "",
    longitude: "",
  })

  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [attempted, setAttempted] = useState(false)

  // Load buy now item from sessionStorage
  useEffect(() => {
    if (isBuyNowMode) {
      const stored = sessionStorage.getItem("buyNowItem")
      if (stored) {
        setBuyNowItem(JSON.parse(stored))
      } else {
        // No buy now item, redirect back
        router.push("/")
      }
    }
  }, [isBuyNowMode, router])

  // Populate form with user data when available
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: user.name || prev.fullName,
        phone: user.phone || prev.phone,
        street: user.street || user.address || prev.street,
        city: user.city || prev.city,
        state: user.state || prev.state,
      }))
    }
  }, [user])

  // Redirect if cart is empty (only in cart mode)
  useEffect(() => {
    if (!authLoading && !isBuyNowMode && cartItems.length === 0) {
      router.push("/cart")
    }
  }, [cartItems, authLoading, router, isBuyNowMode])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Get current location using Geolocation API
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t("المتصفح لا يدعم تحديد الموقع", "Your browser doesn't support geolocation"))
      return
    }

    setIsGettingLocation(true)
    setLocationError("")

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        
        // Save coordinates
        setFormData((prev) => ({
          ...prev,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        }))

        // Only fill address fields if they are empty (user hasn't typed anything)
        // Try to get address from coordinates using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${language}`
          )
          const data = await response.json()
          
          if (data && data.address) {
            const address = data.address
            setFormData((prev) => ({
              ...prev,
              // Only fill if empty
              street: prev.street || address.road || address.street || address.neighbourhood || "",
              city: prev.city || address.city || address.town || address.village || address.county || "",
              state: prev.state || address.state || address.governorate || "",
            }))
          }
        } catch {
          // Location was still saved even if reverse geocoding failed
        }

        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(t("تم رفض إذن الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح", "Location permission denied. Please allow access from browser settings"))
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError(t("معلومات الموقع غير متاحة", "Location information unavailable"))
            break
          case error.TIMEOUT:
            setLocationError(t("انتهت مهلة طلب الموقع", "Location request timed out"))
            break
          default:
            setLocationError(t("حدث خطأ أثناء تحديد الموقع", "An error occurred while getting location"))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const isValidEgyptianPhone = (phone: string) => {
    const cleaned = phone.replace(/\s|-/g, "")
    return /^(01[0125])\d{8}$/.test(cleaned)
  }

  const handleContinue = () => {
    // Mark form as attempted to show validation
    setAttempted(true)
    
    // Validate required fields - location is required, address fields are optional
    if (!formData.fullName || !formData.phone || !formData.latitude || !formData.longitude) {
      return
    }

    if (!isValidEgyptianPhone(formData.phone)) {
      return
    }

    // Store checkout data in sessionStorage for the delivery page
    sessionStorage.setItem("checkoutData", JSON.stringify(formData))
    
    // Pass mode to delivery page
    const deliveryUrl = isBuyNowMode ? "/checkout/delivery?mode=buynow" : "/checkout/delivery"
    router.push(deliveryUrl)
  }

  if (authLoading || (isBuyNowMode && !buyNowItem)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">{t("تأكيد البيانات", "Confirm Details")}</h1>
            <p className="text-gray-500">
              {t("يرجى مراجعة بياناتك قبل المتابعة", "Please review your information before proceeding")}
            </p>
          </div>

          {/* Order Summary */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                {t("ملخص الطلب", "Order Summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {items.map((item) => {
                const hasDiscount = item.discount_percentage && item.discount_percentage > 0
                const discountedPrice = hasDiscount
                  ? item.price - (item.price * item.discount_percentage! / 100)
                  : item.price
                const itemTotal = discountedPrice * item.quantity
                
                return (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-sm">
                      <Image src={item.image_url || "/placeholder.svg"} alt={item.name} fill loading="lazy" sizes="64px" className="object-cover" />
                      {hasDiscount && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          -{item.discount_percentage}%
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{item.name}</h3>
                      <p className="text-sm text-gray-500">x{item.quantity}</p>
                    </div>
                    <div className="text-right">
                      {hasDiscount && (
                        <p className="text-xs text-gray-400 line-through">{(item.price * item.quantity).toFixed(2)}</p>
                      )}
                      <p className={`font-extrabold bg-gradient-to-r ${hasDiscount ? 'from-emerald-600 to-green-600' : 'from-blue-600 to-blue-800'} bg-clip-text text-transparent`}>
                        {itemTotal.toFixed(2)} <span className="text-sm text-gray-500">{t("جنيه", "EGP")}</span>
                      </p>
                    </div>
                  </div>
                )
              })}
              <div className="border-t border-dashed pt-4 flex justify-between items-center">
                <span className="font-bold text-gray-700">{t("الإجمالي", "Total")}</span>
                <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  {total.toFixed(2)} <span className="text-base text-gray-500">{t("جنيه", "EGP")}</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information Form */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
              <CardTitle className="text-lg flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                {t("بيانات العميل", "Customer Information")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="fullName" className={`flex items-center gap-2 font-medium ${attempted && !formData.fullName ? "text-red-600" : "text-gray-700"}`}>
                  <User className="h-4 w-4" />
                  {t("الاسم الكامل", "Full Name")} *
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder={t("أدخل اسمك الكامل", "Enter your full name")}
                  required
                  className={`h-12 rounded-xl ${attempted && !formData.fullName ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {attempted && !formData.fullName && (
                  <p className="text-sm text-red-600">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className={`flex items-center gap-2 font-medium ${attempted && (!formData.phone || !isValidEgyptianPhone(formData.phone)) ? "text-red-600" : "text-gray-700"}`}>
                  <Phone className="h-4 w-4" />
                  {t("رقم الهاتف", "Phone Number")} *
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder={t("أدخل رقم هاتفك", "Enter your phone number")}
                  required
                  className={`h-12 rounded-xl ${attempted && (!formData.phone || !isValidEgyptianPhone(formData.phone)) ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:border-blue-500 focus:ring-blue-500"}`}
                />
                {attempted && !formData.phone && (
                  <p className="text-sm text-red-600">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
                {attempted && formData.phone && !isValidEgyptianPhone(formData.phone) && (
                  <p className="text-sm text-red-600">{t("رقم هاتف مصري غير صحيح (مثال: 01012345678)", "Invalid Egyptian phone number (e.g. 01012345678)")}</p>
                )}
              </div>

              {/* Location Detection Button - Required */}
              <div className="space-y-2">
                <Label className={`flex items-center gap-2 font-medium ${attempted && (!formData.latitude || !formData.longitude) ? "text-red-600" : "text-gray-700"}`}>
                  <Navigation className="h-4 w-4" />
                  {t("تحديد الموقع", "Detect Location")} *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  className={`w-full h-12 rounded-xl transition-all ${
                    formData.latitude && formData.longitude
                      ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                      : attempted && (!formData.latitude || !formData.longitude)
                      ? "border-red-500 text-red-500 hover:bg-red-50"
                      : "border-blue-500 text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {isGettingLocation ? (
                    <>
                      <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                      {t("جاري تحديد الموقع...", "Getting location...")}
                    </>
                  ) : (
                    <>
                      <Navigation className="ms-2 h-5 w-5" />
                      {t("استخدم موقعي الحالي", "Use My Current Location")}
                    </>
                  )}
                </Button>
                {locationError && (
                  <p className="text-sm text-red-600">{locationError}</p>
                )}
                {attempted && (!formData.latitude || !formData.longitude) && !locationError && (
                  <p className="text-sm text-red-600">{t("يرجى تحديد موقعك للتوصيل", "Please detect your location for delivery")}</p>
                )}
                {formData.latitude && formData.longitude && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1 bg-emerald-50 p-2 rounded-lg">
                    <MapPin className="h-4 w-4" />
                    {t("تم تحديد موقعك بنجاح", "Location detected successfully")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="street" className="flex items-center gap-2 font-medium text-gray-700">
                  <MapPin className="h-4 w-4" />
                  {t("العنوان / الشارع", "Street Address")} ({t("اختياري", "Optional")})
                </Label>
                <Input
                  id="street"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  placeholder={t("أدخل عنوانك التفصيلي", "Enter your detailed address")}
                  className="h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="font-medium text-gray-700">{t("المدينة", "City")} ({t("اختياري", "Optional")})</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder={t("المدينة", "City")}
                    className="h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="font-medium text-gray-700">{t("المحافظة", "State/Province")}</Label>
                  <Input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder={t("المحافظة", "State")}
                    className="h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="flex items-center gap-2 font-medium text-gray-700">
                  <FileText className="h-4 w-4" />
                  {t("ملاحظات إضافية", "Additional Notes")}
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder={t("أي ملاحظات خاصة بالتوصيل...", "Any special delivery notes...")}
                  rows={3}
                  className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <Button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] h-14 text-lg mt-4"
                size="lg"
              >
                {t("متابعة لاختيار الدليفري", "Continue to Select Delivery")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
