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
import { Package, UserIcon, MapPin, Store, Eye, AlertTriangle, Truck, Mail, Phone, ShoppingBag, CreditCard, CheckCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "../../lib/language-context"
import { getStoreByUserId } from "../../lib/actions/stores"
import { getCustomerOrders, getRejectedOrdersForCustomer, getCustomerMultiStoreOrders } from "../../lib/actions/orders"
import type { PickupStop } from "../../lib/actions/orders"
import { updateProfile } from "../../lib/actions/profile"
import dynamic from "next/dynamic"
import type { TimelineEntry } from "../../components/order-tracking-timeline"

// Lazy load tracking modal (only opens on user action)
const OrderTrackingModal = dynamic(
  () => import("../../components/order-tracking-modal").then(m => ({ default: m.OrderTrackingModal })),
  { ssr: false }
)

type Order = {
  id: string
  created_at: string
  total: number
  status: string
  delivery_address: string
  timeline?: TimelineEntry[]
  driver_id?: string
  driver_name?: string
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

type RejectedOrder = {
  id: string
  driver_id?: string
  driver_name?: string
  driver_rejection_reason?: string
  created_at?: string
}

export default function AccountPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [multiOrders, setMultiOrders] = useState<any[]>([])
  const [rejectedOrders, setRejectedOrders] = useState<RejectedOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [hasStore, setHasStore] = useState(false)
  const [checkingStore, setCheckingStore] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)

  const fetchOrders = async () => {
    if (!user?.id) return

    try {
      setOrdersLoading(true)
      setOrdersError(null)
      
      // Fetch each independently so one failure doesn't block the others
      const [dataResult, rejectedResult, multiResult] = await Promise.allSettled([
        getCustomerOrders(user.id),
        getRejectedOrdersForCustomer(user.id),
        getCustomerMultiStoreOrders(user.id),
      ])
      
      if (dataResult.status === "fulfilled") {
        setOrders(dataResult.value as Order[])
      } else {
        console.error("[v0] Error fetching customer orders:", dataResult.reason)
      }
      
      if (rejectedResult.status === "fulfilled" && rejectedResult.value.success) {
        setRejectedOrders(rejectedResult.value.orders as RejectedOrder[])
      }
      
      if (multiResult.status === "fulfilled" && multiResult.value.success) {
        setMultiOrders(multiResult.value.orders)
      }
      
      // Only show error if ALL fetches failed
      if (dataResult.status === "rejected" && rejectedResult.status === "rejected" && multiResult.status === "rejected") {
        setOrdersError(t("حدث خطأ في تحميل الطلبات", "Error loading orders"))
      }
    } catch (error) {
      console.error("[v0] Error fetching orders:", error)
      setOrdersError(t("حدث خطأ في تحميل الطلبات", "Error loading orders"))
    } finally {
      setOrdersLoading(false)
    }
  }

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
      reviewing: { ar: "قيد المراجعة", en: "Reviewing" },
      processing: { ar: "قيد المعالجة", en: "Processing" },
      confirmed: { ar: "تم التأكيد", en: "Confirmed" },
      shipped: { ar: "تم الشحن", en: "Shipped" },
      on_the_way: { ar: "في الطريق", en: "On The Way" },
      delivered: { ar: "تم التوصيل", en: "Delivered" },
      cancelled: { ar: "ملغي", en: "Cancelled" },
      driver_rejected: { ar: "رفض السائق", en: "Driver Rejected" },
      driver_changed: { ar: "تم تغيير السائق", en: "Driver Changed" },
    }
    return statusMap[status] ? t(statusMap[status].ar, statusMap[status].en) : status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      reviewing: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      confirmed: "bg-green-100 text-green-800",
      shipped: "bg-purple-100 text-purple-800",
      on_the_way: "bg-indigo-100 text-indigo-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      driver_rejected: "bg-orange-100 text-orange-800",
      driver_changed: "bg-sky-100 text-sky-800",
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
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("حسابي", "My Account")}</h1>
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
                <Package className="ms-2 h-4 w-4" />
                {t("طلباتي", "My Orders")}
              </TabsTrigger>
              <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all">
                <UserIcon className="ms-2 h-4 w-4" />
                {t("الملف الشخصي", "Profile")}
              </TabsTrigger>
              <TabsTrigger value="address" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all">
                <MapPin className="ms-2 h-4 w-4" />
                {t("العناوين", "Addresses")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              {/* Rejected Orders Alert */}
              {rejectedOrders.length > 0 && (
                <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden bg-amber-50 border-l-4 border-l-amber-500">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-800 mb-1">
                          {t("لديك طلبات مرفوضة من السائق", "You have orders rejected by driver")}
                        </h3>
                        <p className="text-amber-700 text-sm mb-3">
                          {t("يرجى اختيار سائق آخر لإكمال توصيل طلباتك", "Please select another driver to complete your deliveries")}
                        </p>
                        <div className="space-y-2">
                          {rejectedOrders.map((rejOrder) => (
                            <div key={rejOrder.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-200">
                              <div className="flex items-center gap-3">
                                <Truck className="h-5 w-5 text-amber-600" />
                                <span className="text-sm text-gray-700">
                                  {t("طلب رقم", "Order #")} {rejOrder.id.slice(-6)}
                                </span>
                              </div>
                              <Link href={`/account/change-driver?orderId=${rejOrder.id}&currentDriverId=${rejOrder.driver_id || ""}`}>
                                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white">
                                  {t("اختر سائق", "Select Driver")}
                                </Button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-xl">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      {t("طلباتي", "My Orders")}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchOrders}
                      disabled={ordersLoading}
                      className="rounded-xl"
                    >
                      <RefreshCw className={`h-4 w-4 ms-2 ${ordersLoading ? 'animate-spin' : ''}`} />
                      {t("تحديث", "Refresh")}
                    </Button>
                  </div>
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
                                  <span className="line-clamp-1">{order.delivery_address}</span>
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
                              <Eye className="h-4 w-4 ms-2" />
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

              {/* Multi-Store Orders */}
              {multiOrders.length > 0 && (
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden mt-6">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-white border-b">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-xl">
                        <Store className="h-5 w-5 text-purple-600" />
                      </div>
                      {t("طلبات متعددة المتاجر", "Multi-Store Orders")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {multiOrders.map((order: any) => {
                        const stops: PickupStop[] = order.pickup_stops || []
                        const activeStops = stops.filter((s: PickupStop) => s.status !== "rejected")
                        const confirmedCount = stops.filter((s: PickupStop) => s.status === "confirmed" || s.status === "picked_up").length
                        const pickedCount = stops.filter((s: PickupStop) => s.status === "picked_up").length
                        
                        return (
                          <div key={order.id} className="bg-white border border-purple-100 rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-purple-50 to-white border-b p-5 flex items-start justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                                  <Store className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-800">
                                    {t("طلب رقم", "Order #")} {order.id.slice(0, 8)}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {stops.length} {t("متاجر", "stores")} • {t("السائق:", "Driver:")} {order.driver_name || "-"}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-4 py-2 rounded-xl text-xs font-bold ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </span>
                            </div>

                            {/* Stops */}
                            <div className="p-5 space-y-3">
                              {stops.map((stop: PickupStop, idx: number) => (
                                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                                  stop.status === "confirmed" ? "bg-green-50 border-green-200" :
                                  stop.status === "picked_up" ? "bg-indigo-50 border-indigo-200" :
                                  stop.status === "rejected" ? "bg-red-50 border-red-200 opacity-60" :
                                  "bg-yellow-50 border-yellow-200"
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                      stop.status === "confirmed" ? "bg-green-500 text-white" :
                                      stop.status === "picked_up" ? "bg-indigo-500 text-white" :
                                      stop.status === "rejected" ? "bg-red-500 text-white" :
                                      "bg-yellow-500 text-white"
                                    }`}>
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{stop.store_name}</p>
                                      <p className="text-xs text-gray-500">
                                        {stop.items.length} {t("منتج", "items")} • {stop.subtotal.toLocaleString()} {t("جنيه", "EGP")}
                                      </p>
                                    </div>
                                  </div>
                                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                                    stop.status === "confirmed" ? "bg-green-100 text-green-700" :
                                    stop.status === "picked_up" ? "bg-indigo-100 text-indigo-700" :
                                    stop.status === "rejected" ? "bg-red-100 text-red-700" :
                                    "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    {stop.status === "pending" ? t("في الانتظار", "Pending") :
                                     stop.status === "confirmed" ? t("تم التأكيد", "Confirmed") :
                                     stop.status === "picked_up" ? t("تم الاستلام", "Picked Up") :
                                     t("مرفوض", "Rejected")}
                                  </span>
                                </div>
                              ))}

                              {/* Progress bar */}
                              {order.status !== "cancelled" && order.status !== "delivered" && (
                                <div className="mt-4">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{t("تقدم الاستلام", "Pickup Progress")}</span>
                                    <span>{pickedCount}/{activeStops.length}</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                                      style={{ width: `${activeStops.length > 0 ? (pickedCount / activeStops.length) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="px-5 pb-5 flex items-center justify-between border-t border-dashed pt-4">
                              <div>
                                <p className="text-xs text-gray-500">{t("الإجمالي", "Total")}</p>
                                <p className="text-xl font-extrabold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                                  {Number(order.total).toLocaleString()} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-5"
                                  onClick={() => {
                                    setSelectedOrder({
                                      id: order.id,
                                      created_at: order.created_at,
                                      total: order.total,
                                      status: order.status,
                                      delivery_address: order.delivery_address || "",
                                      timeline: order.timeline,
                                      order_items: (order.pickup_stops || []).flatMap((stop: PickupStop) => stop.items.map((item: any) => ({
                                        id: item.product_id,
                                        quantity: item.quantity,
                                        price: item.price,
                                        products: { id: item.product_id, name: item.name, image_url: item.image_url || "" },
                                      }))),
                                      stores: { id: "multi", name: stops.map((s: PickupStop) => s.store_name).join(" + ") },
                                    })
                                    setIsTrackingModalOpen(true)
                                  }}
                                >
                                  <Eye className="h-4 w-4 ms-2" />
                                  {t("تتبع الطلب", "Track Order")}
                                </Button>
                                <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="profile">
              {/* User Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{orders.length}</p>
                        <p className="text-xs text-blue-100">{t("إجمالي الطلبات", "Total Orders")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{orders.filter(o => o.status === 'delivered').length}</p>
                        <p className="text-xs text-green-100">{t("طلبات مكتملة", "Completed")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{orders.reduce((sum, o) => sum + Number(o.total || 0), 0).toFixed(0)}</p>
                        <p className="text-xs text-purple-100">{t("إجمالي الإنفاق", "Total Spent")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{orders.filter(o => o.status === 'pending' || o.status === 'processing').length}</p>
                        <p className="text-xs text-amber-100">{t("طلبات نشطة", "Active Orders")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Profile Info Card */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden mb-6">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">{user.name || t("مستخدم", "User")}</CardTitle>
                      <CardDescription className="text-blue-100">{user.role === "seller" ? t("تاجر", "Seller") : t("عميل", "Customer")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Email */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        <Mail className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("البريد الإلكتروني", "Email")}</p>
                        <p className="font-medium text-gray-800">{user.email}</p>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("رقم الهاتف", "Phone")}</p>
                        <p className="font-medium text-gray-800">{user.phone || t("غير محدد", "Not set")}</p>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="p-3 bg-purple-100 rounded-xl">
                        <MapPin className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("العنوان", "Address")}</p>
                        <p className="font-medium text-gray-800">
                          {user.street || user.city || user.country 
                            ? [user.street, user.city, user.country].filter(Boolean).join(", ")
                            : t("غير محدد", "Not set")}
                        </p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="p-3 bg-amber-100 rounded-xl">
                        <UserIcon className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("نوع الحساب", "Account Type")}</p>
                        <p className="font-medium text-gray-800">{user.role === "seller" ? t("تاجر", "Seller") : t("عميل", "Customer")}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Edit Profile Form */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <UserIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    {t("تعديل الملف الشخصي", "Edit Profile")}
                  </CardTitle>
                  <CardDescription>{t("تحديث معلوماتك الشخصية", "Update your personal information")}</CardDescription>
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
                        const res = await updateProfile(user.id, { full_name: name, phone }, user.id)
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
                        const res = await updateProfile(user.id, { street, city, country }, user.id)
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
