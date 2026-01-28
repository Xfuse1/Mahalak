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

      <main className="flex-1 py-8 bg-secondary">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8">{t("حسابي", "My Account")}</h1>

          {hasStore && (
            <Card className="mb-8 border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Store className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900">{t("أنت تملك متجراً مسجلاً", "You have a registered store")}</p>
                      <p className="text-sm text-amber-700">{t("انتقل إلى لوحة التاجر لإدارة منتجاتك وطلباتك", "Go to the merchant dashboard to manage your products and orders")}</p>
                    </div>
                  </div>
                  <Button asChild className="bg-amber-600 hover:bg-amber-700">
                    <Link href="/seller/dashboard">{t("لوحة التاجر", "Seller Dashboard")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="orders" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <Package className="ml-2 h-4 w-4" />
                {t("طلباتي", "My Orders")}
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <UserIcon className="ml-2 h-4 w-4" />
                {t("الملف الشخصي", "Profile")}
              </TabsTrigger>
              <TabsTrigger value="address" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <MapPin className="ml-2 h-4 w-4" />
                {t("العناوين", "Addresses")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>{t("طلباتي", "My Orders")}</CardTitle>
                  <CardDescription>
                    {t("تتبع جميع طلباتك وحالتها", "Track all your orders and their status")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-[#1F478B]" />
                      <span className="mr-2">{t("جاري التحميل...", "Loading...")}</span>
                    </div>
                  ) : ordersError ? (
                    <div className="text-center py-8">
                      <p className="text-red-600">{ordersError}</p>
                    </div>
                  ) : orders.length > 0 ? (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-lg">
                                {t("طلب من", "Order from")} {order.stores?.name || t("متجر غير معروف", "Unknown Store")}
                              </p>
                              <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {t("رقم الطلب:", "Order ID:")} {order.id.slice(0, 8)}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}
                            >
                              {getStatusText(order.status)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              <span>
                                {order.order_items?.length || 0} {t("منتج", "items")}
                              </span>
                              {order.delivery_address && (
                                <p className="text-xs mt-1">
                                  {t("العنوان:", "Address:")} {order.delivery_address}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[#1F478B] border-[#1F478B] hover:bg-[#1F478B]/10"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setIsTrackingModalOpen(true)
                                }}
                              >
                                <Eye className="h-4 w-4 ml-1" />
                                {t("تتبع الطلب", "Track Order")}
                              </Button>
                              <div className="text-left">
                                <p className="text-xl font-bold text-[#1F478B]">
                                  {Number(order.total).toFixed(2)} {t("جنيه", "EGP")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600">{t("لا توجد طلبات بعد", "No orders yet")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>{t("الملف الشخصي", "Profile")}</CardTitle>
                  <CardDescription>{t("إدارة معلوماتك الشخصية", "Manage your personal information")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
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
                          // refresh the page so AuthProvider reloads profile and UI reflects changes
                          router.refresh()
                        } else {
                          console.error("[v0] Failed to update profile:", res?.error)
                        }
                      } catch (err) {
                        console.error("[v0] Error submitting profile form:", err)
                      }
                    }}
                  >
                    <div>
                      <Label htmlFor="name">{t("الاسم الكامل", "Full Name")}</Label>
                      <Input id="name" name="name" defaultValue={user.name} />
                    </div>
                    <div>
                      <Label htmlFor="email">{t("البريد الإلكتروني", "Email")}</Label>
                      <Input id="email" type="email" defaultValue={user.email} disabled />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t("رقم الهاتف", "Phone Number")}</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="01xxxxxxxxx" defaultValue={user.phone || ""} />
                    </div>
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]">
                      {t("حفظ التغييرات", "Save Changes")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle>{t("عناوين التوصيل", "Delivery Addresses")}</CardTitle>
                  <CardDescription>
                    {t("إدارة عناوين التوصيل الخاصة بك", "Manage your delivery addresses")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
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
                          router.refresh()
                        } else {
                          console.error("[v0] Failed to update address:", res?.error)
                        }
                      } catch (err) {
                        console.error("[v0] Error saving address:", err)
                      }
                    }}
                  >
                    <div>
                      <Label htmlFor="country">{t("الدولة", "Country")}</Label>
                      <Input id="country" name="country" placeholder={t("مصر", "Egypt")} defaultValue={user.country || ""} />
                    </div>
                    <div>
                      <Label htmlFor="city">{t("المدينة", "City")}</Label>
                      <Input id="city" name="city" placeholder={t("القاهرة", "Cairo")} defaultValue={user.city || ""} />
                    </div>
                    <div>
                      <Label htmlFor="street">{t("الشارع", "Street")}</Label>
                      <Input id="street" name="street" placeholder={t("الشارع، المنطقة", "Street, Area")} defaultValue={user.street || ""} />
                    </div>
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]">
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
