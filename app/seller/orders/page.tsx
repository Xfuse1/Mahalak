"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Button } from "../../../components/ui/button"
import { Filter, Eye, User, MapPin, Package, Phone as PhoneIcon, Mail, ShoppingCart } from "lucide-react"
import { OrderStatusSelector } from "../../../components/order-status-selector"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { getStoreOrders } from "../../../lib/actions/orders"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import Image from "next/image"
import { formatAddress } from "../../../lib/utils"

type OrderItem = {
  id: string
  quantity: number
  price: number
  products: {
    id: string
    name: string
    image_url: string | null
  }
}

type Order = {
  id: string
  customer_id: string
  store_id: string
  total: number
  status: string
  delivery_address: string
  created_at: string
  updated_at: string
  user: {
    id: string
    full_name: string | null
    email: string
    phone: string | null
  } | null
  order_items: OrderItem[]
}

export default function SellerOrdersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [filter, setFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  const loadOrders = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoadingOrders(true)
      const store = await getStoreByUserId(user.id)
      if (store) {
        const data = (await getStoreOrders(store.id)) as Order[]
        setOrders(data)

        // Update selectedOrder if it's currently open to show latest status/details
        setSelectedOrder(prev => {
          if (!prev) return null
          return data.find(o => o.id === prev.id) || prev
        })
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      setOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id && user?.role === "seller") {
      loadOrders()
    }
  }, [loadOrders, user?.id, user?.role])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t("قيد المراجعة", "Under Review"),
      reviewing: t("قيد المراجعة", "Under Review"),
      confirmed: t("تم التاكيد", "Confirmed"),
      on_the_way: t("في الطريق", "On the Way"),
      delivered: t("تم التوصيل", "Delivered"),
      cancelled: t("ملغي", "Cancelled"),
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      reviewing: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      on_the_way: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colorMap[status] || "bg-gray-100 text-gray-800"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(t("ar-EG", "en-US"), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  if (loadingOrders) {
    return (
      <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("إدارة الطلبات", "Order Management")}</h1>
            <p className="text-gray-500 mt-1">{t("إدارة ومتابعة طلبات العملاء", "Manage and track customer orders")}</p>
          </div>

          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Filter className="h-5 w-5 text-blue-600" />
                </div>
                {t("جميع الطلبات", "All Orders")}
              </CardTitle>
              <CardDescription>{t("إدارة ومتابعة طلبات العملاء", "Manage and track customer orders")}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg">
                    <Filter className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t("إجمالي الطلبات", "Total Orders")}</p>
                    <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{orders.length}</p>
                  </div>
                </div>

                <div className="w-full md:w-64">
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder={t("تصفية حسب الحالة", "Filter by status")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">{t("جميع الطلبات", "All Orders")}</SelectItem>
                      <SelectItem value="reviewing">{t("قيد المراجعة", "Under Review")}</SelectItem>
                      <SelectItem value="confirmed">{t("تم التاكيد", "Confirmed")}</SelectItem>
                      <SelectItem value="on_the_way">{t("في الطريق", "On the Way")}</SelectItem>
                      <SelectItem value="delivered">{t("تم التوصيل", "Delivered")}</SelectItem>
                      <SelectItem value="cancelled">{t("ملغي", "Cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                    <Filter className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg">{t("لا توجد طلبات حتى الآن", "No orders yet")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders
                    .filter(order => filter === "all" || order.status === filter)
                    .map((order) => (
                      <div key={order.id} className="border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-300 bg-white">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                              <span className="text-blue-600 font-bold">#{order.id.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-bold text-lg text-gray-800">#{order.id.slice(0, 8)}</p>
                              <p className="text-sm text-gray-500">
                                {order.user?.full_name || order.user?.email || t("عميل غير معروف", "Unknown Customer")} •{" "}
                                {order.order_items.length} {t("منتج", "product")}
                              </p>
                            </div>
                          </div>
                          <span className={`px-4 py-2 rounded-xl text-sm font-bold ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[#1F478B] border-[#1F478B] hover:bg-[#1F478B] hover:text-white"
                              onClick={() => {
                                setSelectedOrder(order)
                                setIsDetailsOpen(true)
                              }}
                            >
                              <Eye className="w-4 h-4 ml-2" />
                              {t("عرض التفاصيل", "View Details")}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-dashed mt-4">
                          <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                          <div className="flex items-center gap-4">
                            <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{Number(order.total).toLocaleString()} <span className="text-sm text-gray-500">{t("جنيه", "EGP")}</span></p>
                            <OrderStatusSelector orderId={order.id} currentStatus={order.status} onUpdated={loadOrders} />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Details Modal */}
          <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={t("rtl", "ltr")}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <Package className="w-6 h-6 text-[#1F478B]" />
                  {t("تفاصيل الطلب", "Order Details")} #{selectedOrder?.id.slice(0, 8)}
                </DialogTitle>
                <DialogDescription>
                  {selectedOrder && formatDate(selectedOrder.created_at)}
                </DialogDescription>
              </DialogHeader>

              {selectedOrder && (
                <div className="space-y-6 mt-4">
                  {/* Customer Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <h3 className="font-bold border-b pb-2 flex items-center gap-2">
                        <User className="w-4 h-4 text-[#1F478B]" />
                        {t("بيانات العميل", "Customer Info")}
                      </h3>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-base">{selectedOrder.user?.full_name || t("عميل غير معروف", "Unknown Customer")}</p>
                        <p className="flex items-center gap-2 text-gray-600">
                          <PhoneIcon className="w-3 h-3" />
                          {selectedOrder.user?.phone || t("لا يوجد رقم", "No Phone")}
                        </p>
                        <p className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-3 h-3" />
                          {selectedOrder.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <h3 className="font-bold border-b pb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#1F478B]" />
                        {t("عنوان التوصيل", "Delivery Address")}
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {formatAddress(selectedOrder.delivery_address) || t("لم يتم تحديد عنوان", "No address provided")}
                      </p>
                    </div>
                  </div>

                  {/* Products List */}
                  <div className="space-y-3">
                    <h3 className="font-bold flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[#1F478B]" />
                      {t("المنتجات", "Products")} ({selectedOrder.order_items.length})
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 grid grid-cols-4 p-3 text-xs font-bold text-gray-500 border-b">
                        <div className="col-span-2">{t("المنتج", "Product")}</div>
                        <div className="text-center">{t("الكمية", "Qty")}</div>
                        <div className="text-left">{t("الإجمالي", "Total")}</div>
                      </div>
                      <div className="divide-y">
                        {selectedOrder.order_items.map((item) => (
                          <div key={item.id} className="grid grid-cols-4 p-3 items-center text-sm">
                            <div className="col-span-2 flex items-center gap-3">
                              <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                                <Image
                                  src={item.products.image_url || "/placeholder.svg"}
                                  alt={item.products.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <p className="font-medium line-clamp-1">{item.products.name}</p>
                            </div>
                            <div className="text-center">x{item.quantity}</div>
                            <div className="text-left font-bold text-[#1F478B]">
                              {(item.price * item.quantity).toLocaleString()} {t("جنيه", "EGP")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-[#1F478B]/5 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">{t("حالة الطلب الحالية:", "Current Status:")}</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedOrder.status)}`}>
                        {getStatusText(selectedOrder.status)}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-600">{t("الإجمالي الكلي", "Grand Total")}</p>
                      <p className="text-2xl font-black text-[#1F478B]">
                        {Number(selectedOrder.total).toLocaleString()} {t("جنيه", "EGP")}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <OrderStatusSelector
                      orderId={selectedOrder.id}
                      currentStatus={selectedOrder.status}
                      onUpdated={loadOrders}
                    />
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
