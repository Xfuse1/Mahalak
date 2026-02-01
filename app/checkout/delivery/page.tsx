"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { Star, Truck, CheckCircle, MapPin, Loader2, User, Phone, Car } from "lucide-react"
import { createOrder } from "@/lib/actions/orders"
import { getDrivers, type Driver } from "@/lib/actions/delivery"

type CheckoutData = {
  fullName: string
  phone: string
  street: string
  city: string
  state: string
  notes: string
  latitude: string
  longitude: string
}

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

export default function DeliveryPage() {
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const { items: cartItems, clear: clearCart } = useCartStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check if this is "Buy Now" mode (single product) or cart mode
  const isBuyNowMode = searchParams.get("mode") === "buynow"

  const [buyNowItem, setBuyNowItem] = useState<CheckoutItem | null>(null)

  // Get items based on mode
  const items: CheckoutItem[] = isBuyNowMode && buyNowItem ? [buyNowItem] : cartItems
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)

  // Fetch drivers from database
  useEffect(() => {
    const fetchDrivers = async () => {
      setLoadingDrivers(true)
      try {
        const fetchedDrivers = await getDrivers()
        setDrivers(fetchedDrivers)
      } catch (error) {
        console.error("Error fetching drivers:", error)
      } finally {
        setLoadingDrivers(false)
      }
    }

    fetchDrivers()
  }, [])

  // Sort drivers by rating (highest first) - already sorted from server but ensure client-side too
  const sortedDrivers = [...drivers].sort((a, b) => (b.rating || 0) - (a.rating || 0))

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

  // Load checkout data from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("checkoutData")
    if (stored) {
      setCheckoutData(JSON.parse(stored))
    } else {
      // No checkout data, redirect back
      const checkoutUrl = isBuyNowMode ? "/checkout?mode=buynow" : "/checkout"
      router.push(checkoutUrl)
    }
  }, [router, isBuyNowMode])

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

  const selectedDriverData = sortedDrivers.find((d) => d.id === selectedDriver)
  const deliveryPrice = selectedDriverData?.price || 0
  const grandTotal = total + deliveryPrice

  const handleConfirmOrder = async () => {
    if (!selectedDriver || !checkoutData || !user) {
      alert(t("يرجى اختيار سائق التوصيل", "Please select a delivery driver"))
      return
    }

    setIsSubmitting(true)

    try {
      // Group items by store_id
      const itemsByStore = items.reduce((acc, item) => {
        const storeId = item.store_id || "default"
        if (!acc[storeId]) {
          acc[storeId] = []
        }
        acc[storeId].push(item)
        return acc
      }, {} as Record<string, typeof items>)

      // Create an order for each store
      for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
        const storeTotal = storeItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

        const fullAddress = `${checkoutData.street}, ${checkoutData.city}${checkoutData.state ? `, ${checkoutData.state}` : ""}`

        const orderData = {
          customer_id: user.id,
          store_id: storeId,
          total: storeTotal + deliveryPrice,
          delivery_address: fullAddress,
          customer_name: checkoutData.fullName,
          customer_phone: checkoutData.phone,
          delivery_city: checkoutData.city,
          delivery_state: checkoutData.state,
          delivery_latitude: checkoutData.latitude ? parseFloat(checkoutData.latitude) : undefined,
          delivery_longitude: checkoutData.longitude ? parseFloat(checkoutData.longitude) : undefined,
          delivery_notes: checkoutData.notes,
          driver_id: selectedDriverData?.id,
          driver_name: selectedDriverData?.name,
          delivery_price: deliveryPrice,
          items: storeItems.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }

        const result = await createOrder(orderData)

        if (!result.success) {
          throw new Error(result.error || "Failed to create order")
        }
      }

      // Clear data based on mode
      if (isBuyNowMode) {
        // Only clear buy now item, keep cart intact
        sessionStorage.removeItem("buyNowItem")
      } else {
        // Clear cart
        clearCart()
      }
      sessionStorage.removeItem("checkoutData")

      // Redirect to success page or orders page
      alert(t("تم تأكيد طلبك بنجاح!", "Your order has been confirmed successfully!"))
      router.push("/account")
    } catch (error) {
      console.error("Error creating order:", error)
      alert(t("حدث خطأ أثناء إنشاء الطلب", "An error occurred while creating the order"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || !checkoutData || (isBuyNowMode && !buyNowItem)) {
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-2 text-center">{t("اختر سائق التوصيل", "Select Delivery Driver")}</h1>
          <p className="text-gray-600 text-center mb-8">
            {t("اختر السائق المناسب لتوصيل طلبك", "Choose a driver to deliver your order")}
          </p>

          {/* Drivers List */}
          <div className="space-y-4 mb-8">
            {loadingDrivers ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1F478B]" />
                <p className="text-gray-600 mt-2">{t("جاري تحميل السائقين...", "Loading drivers...")}</p>
              </div>
            ) : sortedDrivers.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">{t("لا يوجد سائقين متاحين حالياً", "No drivers available at the moment")}</p>
              </div>
            ) : (
              sortedDrivers.map((driver, index) => (
                <Card
                  key={driver.id}
                  className={`cursor-pointer transition-all ${!driver.is_available
                      ? "opacity-60 bg-gray-50 border-2 border-red-400"
                      : selectedDriver === driver.id
                        ? "ring-2 ring-[#1F478B] bg-blue-50"
                        : "hover:shadow-md"
                    }`}
                  onClick={() => driver.is_available && setSelectedDriver(driver.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Top Row for Mobile (Rank + Photo + Price) */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                        <div className="flex items-center gap-3">
                          {/* Rank Badge */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${!driver.is_available ? "bg-gray-200 text-gray-500" :
                              index === 0 ? "bg-yellow-400 text-yellow-900" :
                                index === 1 ? "bg-gray-300 text-gray-700" :
                                  index === 2 ? "bg-orange-400 text-orange-900" :
                                    "bg-gray-100 text-gray-600"
                            }`}>
                            {index + 1}
                          </div>

                          {/* Driver Photo */}
                          <div className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full ${!driver.is_available ? "grayscale" : ""} bg-gray-100`}>
                            {driver.photo_url ? (
                              <Image
                                src={driver.photo_url}
                                alt={driver.name}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                            ) : (
                              <div className={`h-full w-full flex items-center justify-center ${!driver.is_available ? "bg-gray-400" : "bg-[#1F478B]"} text-white text-xl font-bold`}>
                                {driver.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Price for Mobile Only */}
                        <div className="sm:hidden text-left">
                          <p className={`text-lg font-bold ${!driver.is_available ? "text-gray-400" : "text-[#1F478B]"}`}>
                            {driver.price} {t("جنيه", "EGP")}
                          </p>
                        </div>
                      </div>

                      {/* Driver Info */}
                      <div className="flex-1 w-full">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{driver.name}</h3>
                          {driver.is_available ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              {t("متاح", "Available")}
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              {t("غير متاح", "Unavailable")}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {/* Rating */}
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium text-sm">{driver.rating?.toFixed(1) || "0.0"}</span>
                            <span className="text-xs text-gray-500">({driver.total_deliveries || 0} {t("توصيلة", "deliveries")})</span>
                          </div>

                          {/* Vehicle Type */}
                          {driver.vehicle_type && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Car className="h-4 w-4" />
                              <span>{driver.vehicle_type}</span>
                            </div>
                          )}
                        </div>

                        {/* Areas */}
                        {driver.areas && driver.areas.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t("المناطق:", "Areas:")} {driver.areas.join("، ")}
                          </p>
                        )}
                      </div>

                      {/* Price for Tablet/Desktop */}
                      <div className="hidden sm:block text-left">
                        <p className={`text-lg font-bold ${!driver.is_available ? "text-gray-400" : "text-[#1F478B]"}`}>
                          {driver.price} {t("جنيه", "EGP")}
                        </p>
                        {selectedDriver === driver.id && (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1 mr-auto" />
                        )}
                      </div>

                      {/* Selected Indicator for Mobile */}
                      {selectedDriver === driver.id && (
                        <div className="sm:hidden absolute top-4 left-4">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Order Summary */}
          <Card className="mb-6">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t("المنتجات", "Products")}</span>
                <span className="font-medium">{total.toFixed(2)} {t("جنيه", "EGP")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t("التوصيل", "Delivery")}</span>
                <span className="font-medium">
                  {selectedDriver ? `${deliveryPrice} ${t("جنيه", "EGP")}` : "-"}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold text-lg">{t("الإجمالي", "Total")}</span>
                <span className="text-xl font-bold text-[#1F478B]">
                  {grandTotal.toFixed(2)} {t("جنيه", "EGP")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address Summary */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-[#1F478B] mt-1" />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{t("عنوان التوصيل", "Delivery Address")}</h4>
                  <p className="text-sm text-gray-600">
                    {checkoutData.fullName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {checkoutData.street}, {checkoutData.city}
                    {checkoutData.state && `, ${checkoutData.state}`}
                  </p>
                  <p className="text-sm text-gray-600">{checkoutData.phone}</p>
                  {checkoutData.latitude && checkoutData.longitude && (
                    <div className="mt-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <a
                        href={`https://www.google.com/maps?q=${checkoutData.latitude},${checkoutData.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#1F478B] hover:underline"
                      >
                        {t("عرض الموقع على الخريطة", "View location on map")}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirm Button */}
          <Button
            onClick={handleConfirmOrder}
            className="w-full bg-[#1F478B] hover:bg-[#163a6e]"
            size="lg"
            disabled={!selectedDriver || isSubmitting}
          >
            {isSubmitting
              ? t("جاري تأكيد الطلب...", "Confirming order...")
              : t("تأكيد الطلب", "Confirm Order")}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
