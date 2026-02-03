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
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="mb-6">
            <BackButton />
          </div>

          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg shadow-blue-500/30">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {t("اختر سائق التوصيل", "Select Delivery Driver")}
            </h1>
            <p className="text-gray-600 mt-2">
              {t("اختر السائق المناسب لتوصيل طلبك", "Choose a driver to deliver your order")}
            </p>
          </div>

          {/* Drivers List */}
          <div className="space-y-4 mb-8">
            {loadingDrivers ? (
              <div className="text-center py-12 bg-white rounded-2xl shadow-md">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                <p className="text-gray-600 mt-3">{t("جاري تحميل السائقين...", "Loading drivers...")}</p>
              </div>
            ) : sortedDrivers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl shadow-md">
                <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Truck className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600">{t("لا يوجد سائقين متاحين حالياً", "No drivers available at the moment")}</p>
              </div>
            ) : (
              sortedDrivers.map((driver, index) => (
                <Card
                  key={driver.id}
                  className={`cursor-pointer transition-all duration-300 border-0 rounded-2xl overflow-hidden ${!driver.is_available
                    ? "opacity-60 bg-gray-50 ring-2 ring-red-200"
                    : selectedDriver === driver.id
                      ? "ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 bg-blue-50"
                      : "hover:shadow-lg hover:-translate-y-1 bg-white shadow-md"
                    }`}
                  onClick={() => driver.is_available && setSelectedDriver(driver.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Rank Badge */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg ${!driver.is_available ? "bg-gray-200 text-gray-500" :
                        index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-900" :
                          index === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700" :
                            index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-500 text-orange-900" :
                              "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600"
                        }`}>
                        {index + 1}
                      </div>

                      {/* Driver Photo */}
                      <div className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl ${!driver.is_available ? "grayscale" : ""} bg-gray-100 shadow-md`}>
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
                          <div className={`h-full w-full flex items-center justify-center ${!driver.is_available ? "bg-gray-400" : "bg-gradient-to-br from-blue-500 to-blue-600"} text-white text-xl font-bold`}>
                            {driver.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Driver Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg text-gray-800">{driver.name}</h3>
                          {driver.is_available ? (
                            <span className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              {t("متاح", "Available")}
                            </span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                              {t("غير متاح", "Unavailable")}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {/* Rating */}
                          <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium text-sm text-gray-800">{driver.rating?.toFixed(1) || "0.0"}</span>
                            <span className="text-xs text-gray-500">({driver.total_deliveries || 0})</span>
                          </div>

                          {/* Vehicle Type */}
                          {driver.vehicle_type && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                              <Car className="h-4 w-4" />
                              <span>{driver.vehicle_type}</span>
                            </div>
                          )}
                        </div>

                        {/* Areas */}
                        {driver.areas && driver.areas.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2 truncate">
                            {t("المناطق:", "Areas:")} {driver.areas.join("، ")}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="text-center">
                        <p className={`text-xl font-bold ${!driver.is_available ? "text-gray-400" : "bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent"}`}>
                          {driver.price}
                        </p>
                        <p className="text-xs text-gray-500">{t("جنيه", "EGP")}</p>
                        {selectedDriver === driver.id && (
                          <div className="mt-2 w-6 h-6 mx-auto rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
            }
          </div >

          {/* Order Summary */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-5 space-y-4">
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
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-semibold text-lg">{t("الإجمالي", "Total")}</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  {grandTotal.toFixed(2)} {t("جنيه", "EGP")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Address Summary */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 mb-2">{t("عنوان التوصيل", "Delivery Address")}</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{checkoutData.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>
                        {checkoutData.street}, {checkoutData.city}
                        {checkoutData.state && `, ${checkoutData.state}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{checkoutData.phone}</span>
                    </div>
                  </div>
                  {checkoutData.latitude && checkoutData.longitude && (
                    <div className="mt-3">
                      <a
                        href={`https://www.google.com/maps?q=${checkoutData.latitude},${checkoutData.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <MapPin className="h-4 w-4" />
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
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-14 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
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
