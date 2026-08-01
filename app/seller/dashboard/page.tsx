"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { BarChart3, DollarSign, Package, ShoppingBag, TrendingUp, AlertTriangle, Star, Plus, Monitor, ShoppingCart, MapPin, Clock, CheckCircle, Calendar, XCircle, Wallet } from "lucide-react"
import Link from "next/link"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { getDashboardAnalytics, getRecentOrders, getSellerDailyStats, getStockAlerts, type RecentDashboardOrder, type SellerDailyStats, type StockAlerts } from "../../../lib/actions/dashboard"
import { logError } from "../../../lib/logger"

export default function SellerDashboard() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    topProduct: "",
    topProductSales: 0,
    lowStockProducts: 0,
    averageRating: 0,
    totalReviews: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentDashboardOrder[]>([])
  const [daily, setDaily] = useState<SellerDailyStats | null>(null)
  const [stockAlerts, setStockAlerts] = useState<StockAlerts | null>(null)
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<any>(null)
  const [storeApproved, setStoreApproved] = useState<boolean | null>(null)

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
          setStore(store)
          // Check if store is approved
          setStoreApproved(store.is_approved === true)
          
          const analyticsData = await getDashboardAnalytics(store.id, user.id)
          const ordersData = await getRecentOrders(store.id, 3, user.id)

          setAnalytics(analyticsData)
          setRecentOrders(ordersData)

          // إحصائيات «اليوم» + تنبيهات المخزون (قراءة فقط) — أفضل-جهد، لا تكسر بقية اللوحة لو فشلت.
          try {
            const [dailyData, alertsData] = await Promise.all([getSellerDailyStats(user.id), getStockAlerts(5, user.id)])
            setDaily(dailyData)
            setStockAlerts(alertsData)
          } catch (e) {
            logError("[dashboard] daily/stock", e)
          }
        }
      } catch (error) {
        logError("[v0] Error fetching dashboard data:", error)
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
      reviewing: { ar: "قيد المراجعة", en: "Reviewing" },
      processing: { ar: "قيد المعالجة", en: "Processing" },
      confirmed: { ar: "تم التأكيد", en: "Confirmed" },
      shipped: { ar: "تم الشحن", en: "Shipped" },
      on_the_way: { ar: "في الطريق", en: "On The Way" },
      picking_up: { ar: "قيد الاستلام", en: "Picking Up" },
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
      confirmed: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      on_the_way: "bg-purple-100 text-purple-800",
      picking_up: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      driver_rejected: "bg-red-100 text-red-800",
      driver_changed: "bg-indigo-100 text-indigo-800",
    }
    return colorMap[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("لوحة التحكم", "Dashboard")}</h1>
              <p className="text-gray-500 mt-1">{t("مرحباً بك في لوحة التحكم", "Welcome to your dashboard")}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button asChild variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 px-6">
                <Link href="/seller/my-orders">
                  <ShoppingCart className="ms-2 h-4 w-4" />
                  {t("طلباتي كمشتري", "My Orders")}
                </Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
                <Link href="/pos/qpos">
                  <Monitor className="ms-2 h-4 w-4" />
                  {t("نظام QPOS", "QPOS System")}
                </Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
                <Link href="/seller/products/new">
                  <Plus className="ms-2 h-4 w-4" />
                  {t("إضافة منتج", "Add Product")}
                </Link>
              </Button>
            </div>
          </div>

          {/* Location Warning Banner */}
          {store && !store.latitude && !store.longitude && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-md">
              <div className="bg-amber-100 p-3 rounded-xl">
                <MapPin className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 text-lg">
                  {t("الموقع الجغرافي للمتجر غير محدد", "Store location not set")}
                </h3>
                <p className="text-amber-700 text-sm mt-1">
                  {t(
                    "يجب تحديد الموقع الجغرافي للمتجر حتى يتمكن الأدمن من الموافقة على متجرك. يرجى الذهاب للإعدادات وتحديد موقع المتجر.",
                    "You must set your store's geographic location for admin approval. Please go to settings and set your store location."
                  )}
                </p>
                <Button asChild size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700">
                  <Link href="/seller/settings">
                    <MapPin className="ms-2 h-4 w-4" />
                    {t("تحديد الموقع الآن", "Set Location Now")}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Store Approval Status Banner */}
          {store && storeApproved === false && (
            <div className="mb-6 bg-info/10 border border-info/20 rounded-2xl p-4 flex items-start gap-4 shadow-md">
              <div className="bg-info/10 p-3 rounded-xl">
                <Clock className="h-6 w-6 text-info" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-info text-lg">
                  {t("متجرك قيد المراجعة", "Your store is under review")}
                </h3>
                <p className="text-info text-sm mt-1">
                  {t(
                    "متجرك في انتظار موافقة المسؤول. يمكنك إضافة المنتجات والإعدادات، لكن متجرك لن يظهر للعملاء حتى تتم الموافقة عليه.",
                    "Your store is pending admin approval. You can add products and settings, but your store won't be visible to customers until approved."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Store Approved Banner */}
          {store && storeApproved === true && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-4 shadow-md">
              <div className="bg-green-100 p-3 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-800 text-lg">
                  {t("متجرك موافق عليه", "Your store is approved")}
                </h3>
                <p className="text-green-700 text-sm mt-1">
                  {t(
                    "متجرك ظاهر للعملاء ويمكنهم الشراء منه.",
                    "Your store is visible to customers and they can purchase from it."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ═══ اليوم ═══ */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> {t("اليوم", "Today")}
              </h2>
              <span className="text-xs text-gray-400">{t("بتوقيت القاهرة · كاشير + توصيل", "Cairo time · POS + delivery")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-emerald-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("مبيعات اليوم", "Today's Sales")}</p>
                      <p className="text-2xl font-extrabold text-emerald-600">{(daily?.revenue ?? 0).toLocaleString()} <span className="text-base text-gray-500">{t("جنيه", "EGP")}</span></p>
                      <p className="text-xs text-gray-400 mt-1">{daily?.salesCount ?? 0} {t("عملية بيع", "sales")}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-primary/5">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("ربح اليوم", "Today's Profit")}</p>
                      <p className="text-2xl font-extrabold text-primary">{(daily?.profit ?? 0).toLocaleString()} <span className="text-base text-gray-500">{t("جنيه", "EGP")}</span></p>
                      <p className="text-xs text-gray-400 mt-1">{daily?.codProfitApprox ? t("الكاشير دقيق · التوصيل تقديري", "POS exact · delivery est.") : t("من الكاشير", "from POS")}</p>
                    </div>
                    <div className="bg-primary p-4 rounded-2xl shadow-lg"><TrendingUp className="h-6 w-6 text-white" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-white to-amber-50">
                <CardContent className="pt-6 pb-5">
                  <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5"><Wallet className="h-4 w-4" /> {t("التقسيم", "Breakdown")}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-600">{t("الكاشير", "POS")}</span><span className="font-bold text-gray-800">{(daily?.pos.revenue ?? 0).toLocaleString()} <span className="text-xs text-gray-400">({daily?.pos.count ?? 0})</span></span></div>
                    <div className="flex justify-between"><span className="text-gray-600">{t("التوصيل", "Delivery")}</span><span className="font-bold text-gray-800">{(daily?.cod.revenue ?? 0).toLocaleString()} <span className="text-xs text-gray-400">({daily?.cod.count ?? 0})</span></span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ═══ تنبيهات المخزون + الأكثر مبيعًا اليوم ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-xl"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                    {t("تنبيهات المخزون", "Stock Alerts")}
                  </CardTitle>
                  <Button variant="outline" size="sm" asChild className="rounded-xl"><Link href="/seller/products">{t("المنتجات", "Products")}</Link></Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-red-50 p-3 text-center"><div className="text-2xl font-extrabold text-red-600">{stockAlerts?.outCount ?? 0}</div><div className="text-xs text-gray-500">{t("نفد", "Out of stock")}</div></div>
                  <div className="flex-1 rounded-xl bg-amber-50 p-3 text-center"><div className="text-2xl font-extrabold text-amber-600">{stockAlerts?.lowCount ?? 0}</div><div className="text-xs text-gray-500">{t("قرب يخلص", "Low stock")} (≤{stockAlerts?.threshold ?? 5})</div></div>
                </div>
                {(stockAlerts?.outOfStock.length ?? 0) > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-600 mb-1 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> {t("نفد", "Out")}</div>
                    <div className="space-y-1">{stockAlerts!.outOfStock.slice(0, 6).map((p) => (<div key={p.id} className="text-sm text-gray-700 truncate">{p.name}</div>))}{stockAlerts!.outCount > 6 && <div className="text-xs text-gray-400">+{stockAlerts!.outCount - 6} {t("غيرها", "more")}</div>}</div>
                  </div>
                )}
                {(stockAlerts?.lowStock.length ?? 0) > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-600 mb-1">{t("قرب يخلص", "Low stock")}</div>
                    <div className="space-y-1">{stockAlerts!.lowStock.slice(0, 6).map((p) => (<div key={p.id} className="text-sm text-gray-700 truncate flex justify-between"><span className="truncate">{p.name}</span><span className="text-amber-600 font-semibold shrink-0 ms-2">{p.stock}</span></div>))}{stockAlerts!.lowCount > 6 && <div className="text-xs text-gray-400">+{stockAlerts!.lowCount - 6} {t("غيرها", "more")}</div>}</div>
                  </div>
                )}
                {(stockAlerts?.outCount ?? 0) === 0 && (stockAlerts?.lowCount ?? 0) === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">{t("كل المنتجات مخزونها كويس 👍", "All products well-stocked 👍")}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl"><BarChart3 className="h-5 w-5 text-primary" /></div>
                  {t("الأكثر مبيعًا اليوم", "Top Sellers Today")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {(daily?.topItems.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">{t("لسه مفيش مبيعات النهاردة", "No sales yet today")}</p>
                ) : (
                  <div className="space-y-3">
                    {daily!.topItems.map((it, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-700 truncate">{it.name}</span>
                        <span className="text-sm font-bold text-gray-800">{it.quantity} {t("قطعة", "pcs")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Performance (all-time) */}
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-5 text-gray-800">{t("الإجمالي (كل الوقت)", "All-Time")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-primary/5">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("إجمالي الإيرادات", "Total Revenue")}</p>
                      <p className="text-2xl font-extrabold text-primary">
                        {analytics.totalRevenue.toLocaleString()} <span className="text-base text-gray-500">{t("جنيه", "EGP")}</span>
                      </p>
                    </div>
                    <div className="bg-primary p-4 rounded-2xl shadow-lg">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-emerald-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("الطلبات المؤكدة", "Confirmed Orders")}</p>
                      <p className="text-2xl font-extrabold text-emerald-600">{analytics.totalOrders}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
                      <ShoppingBag className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-primary/5">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("عدد المنتجات", "Total Products")}</p>
                      <p className="text-2xl font-extrabold text-primary">{analytics.totalProducts}</p>
                    </div>
                    <div className="bg-primary p-4 rounded-2xl shadow-lg">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-amber-50">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">{t("عدد التقييمات", "Number of Reviews")}</p>
                      <p className="text-2xl font-extrabold text-amber-600">{analytics.totalReviews}</p>
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
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <BarChart3 className="h-5 w-5 text-primary" />
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
                  <p className="text-sm text-gray-500 mb-2">{t("عدد التقييمات", "Number of Reviews")}</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-primary">{analytics.totalReviews}</p>
                  <p className="text-xs text-gray-400 mt-1">{t("تقييمات من العملاء", "Reviews from customers")}</p>
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
                <Button variant="outline" size="sm" asChild className="rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/50">
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
                    <div key={order.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all bg-white">
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
                          {order.customer || t("عميل", "Customer")} • {order.date}
                        </p>
                      </div>
                      <p className="text-xl font-extrabold text-primary">
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
