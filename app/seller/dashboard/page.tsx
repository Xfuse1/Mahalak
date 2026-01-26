"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { BarChart3, DollarSign, Package, ShoppingBag, TrendingUp, AlertTriangle, Star, Plus } from "lucide-react"
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
        <main className="flex-1 py-8">
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
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">{t("لوحة التحكم", "Dashboard")}</h1>
            <Button asChild className="bg-[#1F478B] hover:bg-[#1a3a70]">
              <Link href="/seller/products/new">
                <Plus className="ml-2 h-4 w-4" />
                {t("إضافة منتج", "Add Product")}
              </Link>
            </Button>
          </div>

          {/* Financial Performance */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">{t("الأداء المالي", "Financial Performance")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t("إجمالي الإيرادات", "Total Revenue")}</p>
                      <p className="text-2xl font-bold text-[#1F478B]">
                        {analytics.totalRevenue.toLocaleString()} {t("جنيه", "EGP")}
                      </p>
                    </div>
                    <div className="bg-[#1F478B]/10 p-3 rounded-full">
                      <DollarSign className="h-6 w-6 text-[#1F478B]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t("إجمالي الطلبات", "Total Orders")}</p>
                      <p className="text-2xl font-bold">{analytics.totalOrders}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <ShoppingBag className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t("عدد المنتجات", "Total Products")}</p>
                      <p className="text-2xl font-bold">{analytics.totalProducts}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full">
                      <Package className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{t("عدد الرسائل", "Number of Messages")}</p>
                      <p className="text-2xl font-bold">{analytics.totalMessages}</p>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-full">
                      <TrendingUp className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Product Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t("أداء المنتجات", "Product Performance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b pb-4">
                  <p className="text-sm text-gray-600 mb-2">{t("المنتج الأكثر مبيعاً", "Top Selling Product")}</p>
                  <p className="font-semibold text-lg mb-1">{analytics.topProduct || t("لا يوجد", "None")}</p>
                  <p className="text-sm text-gray-600">
                    {analytics.topProductSales} {t("مبيعة", "sales")}
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 p-3 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-900">{t("تنبيه المخزون", "Stock Alert")}</p>
                    <p className="text-sm text-orange-700">
                      {analytics.lowStockProducts} {t("منتجات منخفضة المخزون", "low stock products")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Store Performance */}
            <Card>
              <CardHeader>
                <CardTitle>{t("أداء المتجر", "Store Performance")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b pb-4">
                  <p className="text-sm text-gray-600 mb-2">{t("عدد الرسائل", "Number of Messages")}</p>
                  <p className="text-3xl font-bold text-[#1F478B]">{analytics.totalMessages}</p>
                  <p className="text-xs text-gray-500 mt-1">{t("رسائل من العملاء", "Messages from customers")}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t("متوسط التقييم", "Average Rating")}</p>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xl font-bold">{analytics.averageRating}</span>
                      <span className="text-sm text-gray-600">
                        ({analytics.totalReviews} {t("تقييم", "reviews")})
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("الطلبات الأخيرة", "Recent Orders")}</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/seller/orders">{t("عرض الكل", "View All")}</Link>
                </Button>
              </div>
              <CardDescription>{t("آخر الطلبات على متجرك", "Latest orders on your store")}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{t("لا توجد طلبات حتى الآن", "No orders yet")}</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between border rounded-lg p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold">{order.id}</p>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                          >
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {order.customer} • {order.date}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-[#1F478B]">
                        {order.total.toLocaleString()} {t("جنيه", "EGP")}
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
