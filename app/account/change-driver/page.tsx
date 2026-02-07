"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { Star, Truck, CheckCircle, Loader2, User, Car, AlertTriangle } from "lucide-react"
import { getDrivers, getDriverCommission, type Driver } from "@/lib/actions/delivery"
import { changeOrderDriver } from "@/lib/actions/orders"

export default function ChangeDriverPage() {
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get("orderId") || ""
  const currentDriverId = searchParams.get("currentDriverId") || ""

  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(true)
  const [driverCommission, setDriverCommission] = useState<number>(0)
  const [error, setError] = useState("")

  // Fetch drivers and commission from database
  useEffect(() => {
    const fetchData = async () => {
      setLoadingDrivers(true)
      try {
        const [fetchedDrivers, commission] = await Promise.all([
          getDrivers(),
          getDriverCommission()
        ])
        // Filter out the current driver who rejected
        const availableDrivers = fetchedDrivers.filter(d => d.id !== currentDriverId)
        setDrivers(availableDrivers)
        setDriverCommission(commission)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoadingDrivers(false)
      }
    }

    fetchData()
  }, [currentDriverId])

  // Sort drivers by rating (highest first)
  const sortedDrivers = [...drivers].sort((a, b) => (b.rating || 0) - (a.rating || 0))

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  // Redirect if no orderId
  useEffect(() => {
    if (!orderId) {
      router.push("/account")
    }
  }, [orderId, router])

  const selectedDriverData = sortedDrivers.find((d) => d.id === selectedDriver)

  const handleConfirm = async () => {
    if (!selectedDriver || !user || !orderId) {
      setError(t("يرجى اختيار سائق", "Please select a driver"))
      return
    }

    const driverData = sortedDrivers.find(d => d.id === selectedDriver)
    if (!driverData) {
      setError(t("السائق غير موجود", "Driver not found"))
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const result = await changeOrderDriver(
        orderId,
        user.id,
        driverData.id,
        driverData.name,
        driverData.price + driverCommission
      )

      if (result.success) {
        alert(t("تم تغيير السائق بنجاح!", "Driver changed successfully!"))
        router.push("/account")
      } else {
        setError(result.error || t("حدث خطأ", "An error occurred"))
      }
    } catch (err) {
      console.error("Error changing driver:", err)
      setError(t("حدث خطأ أثناء تغيير السائق", "Error changing driver"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
              <p className="text-gray-600 mt-4">{t("جاري التحميل...", "Loading...")}</p>
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

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <BackButton />

          {/* Warning Banner */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden bg-amber-50 border-l-4 border-l-amber-500">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-800 mb-1">
                    {t("تم رفض الطلب من السائق", "Order Rejected by Driver")}
                  </h3>
                  <p className="text-amber-700 text-sm">
                    {t("السائق السابق رفض توصيل طلبك. يرجى اختيار سائق آخر لإكمال التوصيل.", 
                       "The previous driver rejected your order. Please select another driver to complete delivery.")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            {t("اختر سائق جديد", "Select New Driver")}
          </h1>

          {/* Drivers List */}
          {loadingDrivers ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
              <p className="text-gray-600 mt-4">{t("جاري تحميل السائقين...", "Loading drivers...")}</p>
            </div>
          ) : sortedDrivers.length === 0 ? (
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-8 text-center">
                <Truck className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">{t("لا يوجد سائقين متاحين حالياً", "No drivers available at the moment")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 mb-6">
              {sortedDrivers.map((driver) => (
                <Card
                  key={driver.id}
                  className={`cursor-pointer transition-all duration-300 border-2 rounded-2xl overflow-hidden ${
                    selectedDriver === driver.id
                      ? "border-blue-500 shadow-xl bg-blue-50/50"
                      : "border-transparent shadow-lg hover:shadow-xl hover:border-gray-200"
                  } ${!driver.is_available ? "opacity-60" : ""}`}
                  onClick={() => driver.is_available && setSelectedDriver(driver.id)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {/* Driver Photo */}
                      <div className="relative">
                        {driver.photo_url ? (
                          <Image
                            src={driver.photo_url}
                            alt={driver.name}
                            width={64}
                            height={64}
                            className="rounded-xl object-cover shadow-md"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                            <User className="w-8 h-8 text-white" />
                          </div>
                        )}
                        {selectedDriver === driver.id && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Driver Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-bold text-lg">{driver.name}</h3>
                          <span className={`text-sm px-3 py-1 rounded-full ${
                            driver.is_available 
                              ? "bg-green-100 text-green-700" 
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {driver.is_available ? t("متاح", "Available") : t("غير متاح", "Unavailable")}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                          {/* Rating */}
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium">{driver.rating?.toFixed(1) || "0.0"}</span>
                          </div>

                          {/* Vehicle Type */}
                          {driver.vehicle_type && (
                            <div className="flex items-center gap-1">
                              <Car className="w-4 h-4 text-gray-400" />
                              <span>{driver.vehicle_type}</span>
                            </div>
                          )}

                          {/* Deliveries Count */}
                          <div className="flex items-center gap-1">
                            <Truck className="w-4 h-4 text-gray-400" />
                            <span>{driver.total_deliveries || 0} {t("توصيلة", "deliveries")}</span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">{t("سعر التوصيل", "Delivery Price")}</span>
                          <span className="font-bold text-blue-600 text-lg">
                            {driver.price} {t("جنيه", "EGP")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Confirm Button */}
          <Button
            onClick={handleConfirm}
            disabled={!selectedDriver || isSubmitting}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                {t("تأكيد السائق الجديد", "Confirm New Driver")}
              </>
            )}
          </Button>

          {selectedDriverData && (
            <p className="text-center text-gray-500 text-sm mt-4">
              {t("سيتم إضافة", "Will add")} {selectedDriverData.price + driverCommission} {t("جنيه للطلب", "EGP to order")}
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
