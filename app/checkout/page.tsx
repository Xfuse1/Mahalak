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

type CheckoutItem = {
  id: string
  name: string
  price: number
  category?: string
  image_url?: string | null
  store_id?: string
  store_name?: string
  description?: string
  quantity: number
}

export default function CheckoutPage() {
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const { items: cartItems } = useCartStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Check if this is "Buy Now" mode (single product) or cart mode
  const isBuyNowMode = searchParams.get("mode") === "buynow"
  
  const [buyNowItem, setBuyNowItem] = useState<CheckoutItem | null>(null)
  
  // Get items based on mode
  const items: CheckoutItem[] = isBuyNowMode && buyNowItem ? [buyNowItem] : cartItems
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

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
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar`
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
        } catch (error) {
          console.error("Error getting address from coordinates:", error)
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

  const handleContinue = () => {
    // Mark form as attempted to show validation
    setAttempted(true)
    
    // Validate required fields - location is required, address fields are optional
    if (!formData.fullName || !formData.phone || !formData.latitude || !formData.longitude) {
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
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <p className="text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
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

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-2 text-center">{t("تأكيد البيانات", "Confirm Details")}</h1>
          <p className="text-gray-600 text-center mb-8">
            {t("يرجى مراجعة بياناتك قبل المتابعة", "Please review your information before proceeding")}
          </p>

          {/* Order Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("ملخص الطلب", "Order Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <Image src={item.image_url || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-gray-600">x{item.quantity}</p>
                  </div>
                  <p className="font-bold text-[#1F478B]">
                    {(item.price * item.quantity).toFixed(2)} {t("جنيه", "EGP")}
                  </p>
                </div>
              ))}
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-semibold">{t("الإجمالي", "Total")}</span>
                <span className="text-xl font-bold text-[#1F478B]">
                  {total.toFixed(2)} {t("جنيه", "EGP")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("بيانات العميل", "Customer Information")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className={`flex items-center gap-2 ${attempted && !formData.fullName ? "text-red-600" : ""}`}>
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
                  className={attempted && !formData.fullName ? "border-red-500 focus:ring-red-500" : ""}
                />
                {attempted && !formData.fullName && (
                  <p className="text-sm text-red-600">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className={`flex items-center gap-2 ${attempted && !formData.phone ? "text-red-600" : ""}`}>
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
                  className={attempted && !formData.phone ? "border-red-500 focus:ring-red-500" : ""}
                />
                {attempted && !formData.phone && (
                  <p className="text-sm text-red-600">{t("هذا الحقل مطلوب", "This field is required")}</p>
                )}
              </div>

              {/* Location Detection Button - Required */}
              <div className="space-y-2">
                <Label className={`flex items-center gap-2 ${attempted && (!formData.latitude || !formData.longitude) ? "text-red-600" : ""}`}>
                  <Navigation className="h-4 w-4" />
                  {t("تحديد الموقع", "Detect Location")} *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  className={`w-full ${
                    attempted && (!formData.latitude || !formData.longitude)
                      ? "border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      : "border-[#1F478B] text-[#1F478B] hover:bg-[#1F478B] hover:text-white"
                  }`}
                >
                  {isGettingLocation ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      {t("جاري تحديد الموقع...", "Getting location...")}
                    </>
                  ) : (
                    <>
                      <Navigation className="ml-2 h-5 w-5" />
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
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {t("تم تحديد موقعك بنجاح", "Location detected successfully")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="street" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t("العنوان / الشارع", "Street Address")} ({t("اختياري", "Optional")})
                </Label>
                <Input
                  id="street"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  placeholder={t("أدخل عنوانك التفصيلي", "Enter your detailed address")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("المدينة", "City")} ({t("اختياري", "Optional")})</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder={t("المدينة", "City")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t("المحافظة", "State/Province")}</Label>
                  <Input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder={t("المحافظة", "State")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="flex items-center gap-2">
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
                />
              </div>

              <Button
                onClick={handleContinue}
                className="w-full bg-[#1F478B] hover:bg-[#163a6e] mt-4"
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
