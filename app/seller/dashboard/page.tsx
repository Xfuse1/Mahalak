"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { BarChart3, DollarSign, Package, ShoppingBag, TrendingUp, AlertTriangle, Star, Plus, Monitor } from "lucide-react"
import Link from "next/link"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { getDashboardAnalytics, getRecentOrders } from "../../../lib/actions/dashboard"

export default function SellerDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalMessages: 0,
    topProduct: "",
    topProductSales: 0,
    lowStockProducts: 0,
    averageRating: 0,
    totalReviews: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/auth?role=seller")
      return
    }

    async function verifySellerAccess() {
      if (user?.role === "seller") return

      // Fallback: Check if they have a store
      const store = await getStoreByUserId(user!.id)
      if (!store) {
        router.push("/")
      }
    }

    verifySellerAccess()
  }, [user, isLoading, router])

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) return

      try {
        setLoading(true)
        const store = await getStoreByUserId(user.id)

        if (store) {
          const analyticsData = await getDashboardAnalytics(store.id)
          const ordersData = await getRecentOrders(store.id, 3)

          setAnalytics(analyticsData)
          setRecentOrders(ordersData)
        }
      } catch (error) {
        console.error("[v0] Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user?.id && user?.role === "seller") {
      fetchDashboardData()
    }
  }, [user?.id, user?.role])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-secondary">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
      </div>
    )
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

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("لوحة التحكم", "Dashboard")}</h1>
              <p className="text-gray-500 mt-1">{t("مرحباً بك في لوحة التحكم", "Welcome to your dashboard")}</p>
            </div>
            <div className="flex gap-3">
              <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
                <Link href="/pos/qpos">
                  <Monitor className="ml-2 h-4 w-4" />
                  {t("نظام QPOS", "QPOS System")}
                </Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
                <Link href="/seller/products/new">
                  <Plus className="ml-2 h-4 w-4" />
                  {t("إضافة منتج", "Add Product")}
                </Link>
              </Button>
            </div>
          </div>

          {/* Financial Performance */}
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-5 text-gray-800">{t("الأداء المالي", "Financial Performance")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("إجمالي الإيرادات", "Total Revenue")}</p>
                      <p className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        {analytics.totalRevenue.toLocaleString()} <span className="text-base text-gray-500">{t("جنيه", "EGP")}</span>
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-emerald-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("الطلبات التي تم توصيلها", "Delivered Orders")}</p>
                      <p className="text-2xl font-extrabold text-emerald-600">{analytics.totalOrders}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
                      <ShoppingBag className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-violet-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("عدد المنتجات", "Total Products")}</p>
                      <p className="text-2xl font-extrabold text-violet-600">{analytics.totalProducts}</p>
                    </div>
                    <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-4 rounded-2xl shadow-lg">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-amber-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("عدد الرسائل", "Number of Messages")}</p>
                      <p className="text-2xl font-extrabold text-amber-600">{analytics.totalMessages}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-4 rounded-2xl shadow-lg">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Product Performance */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  {t("أداء المنتجات", "Product Performance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="border-b border-dashed pb-4">
                  <p className="text-sm text-gray-500 mb-2">{t("المنتج الأكثر مبيعاً", "Top Selling Product")}</p>
                  <p className="font-bold text-lg text-gray-800 mb-1">{analytics.topProduct || t("لا يوجد", "None")}</p>
                  <p className="text-sm text-gray-500">
                    {analytics.topProductSales} {t("مبيعة", "sales")}
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900">{t("تنبيه المخزون", "Stock Alert")}</p>
                    <p className="text-sm text-amber-700">
                      {analytics.lowStockProducts} {t("منتجات منخفضة المخزون", "low stock products")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Store Performance */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle>{t("أداء المتجر", "Store Performance")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="border-b border-dashed pb-4">
                  <p className="text-sm text-gray-500 mb-2">{t("عدد الرسائل", "Number of Messages")}</p>
                  <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{analytics.totalMessages}</p>
                  <p className="text-xs text-gray-400 mt-1">{t("رسائل من العملاء", "Messages from customers")}</p>
                </div>
                <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{t("متوسط التقييم", "Average Rating")}</p>
                    <div className="flex items-center gap-2">
                      <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                      <span className="text-2xl font-extrabold text-gray-800">{analytics.averageRating}</span>
                      <span className="text-sm text-gray-500">
                        ({analytics.totalReviews} {t("تقييم", "reviews")})
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{t("الطلبات الأخيرة", "Recent Orders")}</CardTitle>
                <Button variant="outline" size="sm" asChild className="rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300">
                  <Link href="/seller/orders">{t("عرض الكل", "View All")}</Link>
                </Button>
              </div>
              <CardDescription>{t("آخر الطلبات على متجرك", "Latest orders on your store")}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {recentOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">{t("لا توجد طلبات حتى الآن", "No orders yet")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all bg-white">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-bold text-gray-800">{order.id}</p>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {order.customer} • {order.date}
                        </p>
                      </div>
                      <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        {order.total.toLocaleString()} <span className="text-sm text-gray-500">{t("جنيه", "EGP")}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
