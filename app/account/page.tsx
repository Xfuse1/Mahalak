"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { BackButton } from "../../components/back-button"
import { useAuth } from "../../lib/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Package, UserIcon, MapPin, Loader2, Store, Eye } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "../../lib/language-context"
import { getStoreByUserId } from "../../lib/actions/stores"
import { getCustomerOrders } from "../../lib/actions/orders"
import { updateProfile } from "../../lib/actions/profile"
import { OrderTrackingModal } from "../../components/order-tracking-modal"
import type { TimelineEntry } from "../../components/order-tracking-timeline"
import { formatAddress } from "../../lib/utils"

type Order = {
  id: string
  created_at: string
  total: number
  status: string
  delivery_address: string
  timeline?: TimelineEntry[]
  order_items: {
    id: string
    quantity: number
    price: number
    products: {
      id: string
      name: string
      image_url: string
    }
  }[]
  stores: {
    id: string
    name: string
  }
}

export default function AccountPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [hasStore, setHasStore] = useState(false)
  const [checkingStore, setCheckingStore] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
      return
    }

    if (user?.role === "seller") {
      router.push("/seller/dashboard")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function fetchOrders() {
      if (!user?.id) return

      try {
        setOrdersLoading(true)
        setOrdersError(null)
        console.log("[v0] Fetching orders for customer:")
        const data = await getCustomerOrders(user.id)
        console.log("[v0] Fetched orders:")
        setOrders(data as Order[])
      } catch (error) {
        console.error("[v0] Error fetching orders:", error)
        setOrdersError(t("حدث خطأ في تحميل الطلبات", "Error loading orders"))
      } finally {
        setOrdersLoading(false)
      }
    }

    fetchOrders()

    async function checkStore() {
      if (user?.id) {
        try {
          const store = await getStoreByUserId(user.id)
          if (store) setHasStore(true)
        } catch (e) { }
        finally { setCheckingStore(false) }
      }
    }
    checkStore()
  }, [user?.id, t])

  if (isLoading || !user) {
    return null
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { ar: string; en: string }> = {
      pending: { ar: "قيد الانتظار", en: "Pending" },
      processing: { ar: "قيد المعالجة", en: "Processing" },
      shipped: { ar: "تم الشحن", en: "Shipped" },
      delivered: { ar: "تم التوصيل", en: "Delivered" },
      cancelled: { ar: "ملغي", en: "Cancelled" },
    }
    return statusMap[status] ? t(statusMap[status].ar, statusMap[status].en) : status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colorMap[status] || "bg-gray-100 text-gray-800"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(t("ar-EG", "en-US"), {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("حسابي", "My Account")}</h1>
            <p className="text-gray-500 mt-1">{t("إدارة حسابك وطلباتك", "Manage your account and orders")}</p>
          </div>

          {hasStore && (
            <Card className="mb-8 border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg">
                      <Store className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 text-lg">{t("أنت تملك متجراً مسجلاً", "You have a registered store")}</p>
                      <p className="text-sm text-amber-700">{t("انتقل إلى لوحة التاجر لإدارة منتجاتك وطلباتك", "Go to the merchant dashboard to manage your products and orders")}</p>
                    </div>
                  </div>
                  <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
                    <Link href="/seller/dashboard">{t("لوحة التاجر", "Seller Dashboard")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-6 bg-white shadow-lg rounded-2xl p-2 border-0">
              <TabsTrigger value="orders" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all">
                <Package className="ml-2 h-4 w-4" />
                {t("طلباتي", "My Orders")}
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all">
                <UserIcon className="ml-2 h-4 w-4" />
                {t("الملف الشخصي", "Profile")}
              </TabsTrigger>
              <TabsTrigger value="address" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all">
                <MapPin className="ml-2 h-4 w-4" />
                {t("العناوين", "Addresses")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    {t("طلباتي", "My Orders")}
                  </CardTitle>
                  <CardDescription>
                    {t("تتبع جميع طلباتك وحالتها", "Track all your orders and their status")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {ordersLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <span className="text-gray-500">{t("جاري التحميل...", "Loading...")}</span>
                    </div>
                  ) : ordersError ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-red-500" />
                      </div>
                      <p className="text-red-600">{ordersError}</p>
                    </div>
                  ) : orders.length > 0 ? (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-blue-200 hover:shadow-lg transition-all duration-300 group">
                          {/* Card Header */}
                          <div className="bg-gradient-to-r from-gray-50 to-white border-b p-5 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border shadow-sm flex items-center justify-center flex-shrink-0">
                                <Store className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform" />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 leading-tight mb-1">
                                  {order.stores?.name || t("متجر غير معروف", "Unknown Store")}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span>{formatDate(order.created_at)}</span>
                                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                                  <span className="font-mono bg-gray-100 px-2 py-1 rounded-lg border">#{order.id.slice(0, 8)}</span>
                                </div>
                              </div>
                            </div>
                            <span
                              className={`px-4 py-2 rounded-xl text-xs font-bold ${getStatusColor(order.status)}`}
                            >
                              {getStatusText(order.status)}
                            </span>
                          </div>

                          {/* Card Body */}
                          <div className="p-5">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <Package className="h-5 w-5 text-gray-400" />
                                <span>
                                  {order.order_items?.length || 0} {t("منتجات", "Items")}
                                </span>
                              </div>
                              {order.delivery_address && (
                                <div className="flex items-start gap-3 text-sm text-gray-600">
                                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-1">{formatAddress(order.delivery_address)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="px-5 pb-5 pt-0 flex flex-row items-center justify-between gap-4 border-t border-dashed pt-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">{t("الإجمالي", "Total Value")}</p>
                              <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                {Number(order.total).toFixed(2)} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
                              </p>
                            </div>

                            <Button
                              variant="default"
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-5"
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsTrackingModalOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4 ml-2" />
                              {t("تتبع الطلب", "Track Order")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                        <Package className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg">{t("لا توجد طلبات بعد", "No orders yet")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <UserIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    {t("الملف الشخصي", "Profile")}
                  </CardTitle>
                  <CardDescription>{t("إدارة معلوماتك الشخصية", "Manage your personal information")}</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form
                    className="space-y-5"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const form = e.currentTarget as HTMLFormElement
                      const fd = new FormData(form)
                      const name = fd.get("name")?.toString() || ""
                      const phone = fd.get("phone")?.toString() || ""

                      try {
                        if (!user?.id) return
                        const res = await updateProfile(user.id, { full_name: name, phone })
                        if (res && res.success) {
                          alert(t("تم حفظ التعديلات بنجاح", "Changes saved successfully"))
                          router.refresh()
                        } else {
                          alert(t("فشل في حفظ التعديلات", "Failed to save changes"))
                          console.error("[v0] Failed to update profile:", res?.error)
                        }
                      } catch (err) {
                        console.error("[v0] Error submitting profile form:", err)
                        alert(t("حدث خطأ أثناء الحفظ", "Error occurred while saving"))
                      }
                    }}
                  >
                    <div>
                      <Label htmlFor="name" className="text-gray-700 font-medium">{t("الاسم الكامل", "Full Name")}</Label>
                      <Input id="name" name="name" defaultValue={user.name} className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-gray-700 font-medium">{t("البريد الإلكتروني", "Email")}</Label>
                      <Input id="email" type="email" defaultValue={user.email} disabled className="mt-2 h-12 rounded-xl bg-gray-100" />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-gray-700 font-medium">{t("رقم الهاتف", "Phone Number")}</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="01xxxxxxxxx" defaultValue={user.phone || ""} className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <Button type="submit" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8 py-3">
                      {t("حفظ التغييرات", "Save Changes")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    {t("عناوين التوصيل", "Delivery Addresses")}
                  </CardTitle>
                  <CardDescription>
                    {t("إدارة عناوين التوصيل الخاصة بك", "Manage your delivery addresses")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <form
                    className="space-y-5"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!user?.id) return

                      const form = e.currentTarget as HTMLFormElement
                      const fd = new FormData(form)
                      const country = (fd.get("country") as string) || ""
                      const city = (fd.get("city") as string) || ""
                      const street = (fd.get("street") as string) || ""

                      try {
                        const res = await updateProfile(user.id, { street, city, country })
                        if (res && res.success) {
                          alert(t("تم حفظ العنوان بنجاح", "Address saved successfully"))
                          router.refresh()
                        } else {
                          alert(t("فشل في حفظ العنوان", "Failed to save address"))
                          console.error("[v0] Failed to update address:", res?.error)
                        }
                      } catch (err) {
                        console.error("[v0] Error saving address:", err)
                        alert(t("حدث خطأ أثناء الحفظ", "Error occurred while saving"))
                      }
                    }}
                  >
                    <div>
                      <Label htmlFor="country" className="text-gray-700 font-medium">{t("الدولة", "Country")}</Label>
                      <Input id="country" name="country" placeholder={t("مصر", "Egypt")} defaultValue={user.country || ""} className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <Label htmlFor="city" className="text-gray-700 font-medium">{t("المدينة", "City")}</Label>
                      <Input id="city" name="city" placeholder={t("القاهرة", "Cairo")} defaultValue={user.city || ""} className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <Label htmlFor="street" className="text-gray-700 font-medium">{t("الشارع", "Street")}</Label>
                      <Input id="street" name="street" placeholder={t("الشارع، المنطقة", "Street, Area")} defaultValue={user.street || ""} className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <Button type="submit" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8 py-3">
                      {t("حفظ العنوان", "Save Address")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      {/* Order Tracking Modal */}
      {selectedOrder && (
        <OrderTrackingModal
          order={selectedOrder}
          isOpen={isTrackingModalOpen}
          onClose={() => {
            setIsTrackingModalOpen(false)
            setSelectedOrder(null)
          }}
        />
      )}
    </div>
  )
}
