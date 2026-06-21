"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Package, MapPin, Eye, Store, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getCustomerOrders } from "../../../lib/actions/orders"
import dynamic from "next/dynamic"
import type { TimelineEntry } from "../../../components/order-tracking-timeline"
import { logError } from "../../../lib/logger"

// Lazy load tracking modal (only opens on user action)
const OrderTrackingModal = dynamic(
  () => import("../../../components/order-tracking-modal").then(m => ({ default: m.OrderTrackingModal })),
  { ssr: false }
)

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

export default function SellerMyOrdersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/auth?role=seller")
      return
    }

    if (user.role !== "seller") {
      router.push("/account")
      return
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function fetchOrders() {
      if (!user?.id) return

      try {
        setOrdersLoading(true)
        setOrdersError(null)
        const data = await getCustomerOrders(user.id)
        setOrders(data as Order[])
      } catch (error) {
        logError("[v0] Error fetching orders:", error)
        setOrdersError(t("حدث خطأ في تحميل الطلبات", "Error loading orders"))
      } finally {
        setOrdersLoading(false)
      }
    }

    if (user?.id) {
      fetchOrders()
    }
  }, [user?.id, t])

  if (isLoading || !user || user.role !== "seller") {
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
    <div className="flex min-h-screen bg-background">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Link href="/seller/dashboard" className="hover:text-primary transition-colors">
                  {t("لوحة التحكم", "Dashboard")}
                </Link>
                <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" />
                <span className="text-gray-800">{t("طلباتي كمشتري", "My Orders")}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
                {t("طلباتي كمشتري", "My Orders as Customer")}
              </h1>
              <p className="text-gray-500 mt-1">
                {t("تتبع الطلبات التي قمت بطلبها من متاجر أخرى", "Track orders you placed from other stores")}
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/seller/dashboard">
                {t("العودة للوحة التحكم", "Back to Dashboard")}
              </Link>
            </Button>
          </div>

          {/* Orders Card */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                {t("طلباتي", "My Orders")}
              </CardTitle>
              <CardDescription>
                {t("الطلبات التي قمت بإرسالها كعميل لمتاجر أخرى", "Orders you placed as a customer to other stores")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
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
                    <div key={order.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-orange-200 hover:shadow-lg transition-all duration-300 group">
                      {/* Card Header */}
                      <div className="bg-gradient-to-r from-gray-50 to-white border-b p-5 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 border shadow-sm flex items-center justify-center flex-shrink-0">
                            <Store className="h-6 w-6 text-orange-600 group-hover:scale-110 transition-transform" />
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
                          <p className="text-xl font-extrabold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                            {Number(order.total).toFixed(2)} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
                          </p>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-5"
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
                  <p className="text-gray-500 text-lg mb-4">{t("لم تقم بطلب أي منتجات بعد", "You haven't ordered any products yet")}</p>
                  <Button asChild className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl">
                    <Link href="/">
                      {t("تصفح المتاجر", "Browse Stores")}
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Order Tracking Modal */}
      {selectedOrder && (
        <OrderTrackingModal
          isOpen={isTrackingModalOpen}
          onClose={() => {
            setIsTrackingModalOpen(false)
            setSelectedOrder(null)
          }}
          order={selectedOrder}
        />
      )}
    </div>
  )
}
