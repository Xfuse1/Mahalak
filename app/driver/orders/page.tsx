"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Truck,
  Package,
  Store,
  CheckCircle,
  MapPin,
  Loader2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Navigation,
  Wallet,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { getMultiStoreOrdersForDriver, markStorePickedUp, markOrderDeliveredByDriver } from "@/lib/actions/orders"
import type { PickupStop } from "@/lib/actions/orders"
import { getDriverById, verifyDriverLogin } from "@/lib/actions/delivery"
import type { Driver } from "@/lib/actions/delivery"
import { useToast } from "@/components/ui/toast"

type MultiOrder = {
  id: string
  customer_name: string
  customer_id: string
  delivery_address: string
  total: number
  status: string
  pickup_stops: PickupStop[]
  created_at: string
  driver_id: string
  driver_name: string
  timeline?: any[]
}

export default function DriverOrdersPage() {
  const searchParams = useSearchParams()
  const driverIdParam = searchParams.get("driverId") || ""
  const { t } = useLanguage()
  const toast = useToast()

  const [driverId, setDriverId] = useState(driverIdParam)
  const [driverIdInput, setDriverIdInput] = useState(driverIdParam)
  const [driverPin, setDriverPin] = useState("")
  const [driver, setDriver] = useState<Driver | null>(null)
  const [orders, setOrders] = useState<MultiOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({})

  const loadDriverData = async (id: string) => {
    if (!id) return
    setLoading(true)
    setError("")
    try {
      const [driverData, ordersResult] = await Promise.all([
        getDriverById(id),
        getMultiStoreOrdersForDriver(id),
      ])
      if (!driverData) {
        setError(t("السائق غير موجود", "Driver not found"))
        setDriver(null)
        setOrders([])
      } else {
        setDriver(driverData)
        setOrders((ordersResult.orders || []) as MultiOrder[])
        setDriverId(id)
      }
    } catch (err) {
      setError(t("حدث خطأ", "Something went wrong"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (driverIdParam && driverPin) {
      handleLogin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverIdParam])

  const handleLogin = async () => {
    if (!driverIdInput.trim() || !driverPin.trim()) return
    setLoading(true)
    setError("")
    try {
      const result = await verifyDriverLogin(driverIdInput.trim(), driverPin.trim())
      if (result.success) {
        loadDriverData(driverIdInput.trim())
      } else {
        setError(t("رقم السائق أو PIN غير صحيح", "Invalid driver ID or PIN"))
        setLoading(false)
      }
    } catch {
      setError(t("حدث خطأ", "Something went wrong"))
      setLoading(false)
    }
  }

  const handlePickup = async (orderId: string, storeId: string) => {
    if (!driverId) return
    setActionLoading(`${orderId}-${storeId}`)
    try {
      const result = await markStorePickedUp(orderId, driverId, storeId)
      if (result.success) {
        await loadDriverData(driverId)
      } else {
        toast.error(result.error || t("حدث خطأ", "Something went wrong"))
      }
    } catch {
      toast.error(t("حدث خطأ", "Something went wrong"))
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      case "picked_up":
        return "bg-primary/10 text-primary"
      case "rejected":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      case "pending":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  const handleDeliver = async (orderId: string) => {
    const code = (deliveryCodes[orderId] || "").trim()
    if (code.length < 4) return
    setActionLoading(`deliver-${orderId}`)
    try {
      const res = await markOrderDeliveredByDriver(orderId, code)
      if (res.success) {
        toast.success(t("تم تسليم الطلب بنجاح 🎉", "Order delivered successfully 🎉"))
        setDeliveryCodes((p) => {
          const n = { ...p }
          delete n[orderId]
          return n
        })
        loadDriverData(driverId)
      } else {
        toast.error(res.error || t("تعذّر إتمام التسليم", "Failed to complete delivery"))
      }
    } catch {
      toast.error(t("تعذّر إتمام التسليم", "Failed to complete delivery"))
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return t("في انتظار تأكيد المتجر", "Waiting for store confirmation")
      case "confirmed":
        return t("مؤكد - جاهز للاستلام", "Confirmed - Ready for pickup")
      case "picked_up":
        return t("تم الاستلام ✓", "Picked up ✓")
      case "rejected":
        return t("مرفوض", "Rejected")
      default:
        return status
    }
  }

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return t("في الانتظار", "Pending")
      case "confirmed":
        return t("مؤكد", "Confirmed")
      case "picking_up":
        return t("جاري الاستلام", "Picking up")
      case "on_the_way":
        return t("في الطريق", "On the way")
      case "delivered":
        return t("تم التوصيل", "Delivered")
      case "cancelled":
        return t("ملغي", "Cancelled")
      default:
        return status
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600"
      case "confirmed":
        return "text-primary"
      case "picking_up":
        return "text-orange-600"
      case "on_the_way":
        return "text-indigo-600"
      case "delivered":
        return "text-green-600"
      case "cancelled":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  // If no driver ID, show login
  if (!driverId || !driver) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-md">
          <BackButton />
          <Card className="mt-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>{t("لوحة تحكم السائق", "Driver Dashboard")}</CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                {t("أدخل رقم السائق الخاص بك للوصول للطلبات", "Enter your driver ID to access orders")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="driverId">{t("رقم السائق", "Driver ID")}</Label>
                <Input
                  id="driverId"
                  value={driverIdInput}
                  onChange={(e) => setDriverIdInput(e.target.value)}
                  placeholder={t("أدخل رقم السائق", "Enter driver ID")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="driverPin">{t("رمز PIN", "PIN Code")}</Label>
                <Input
                  id="driverPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={driverPin}
                  onChange={(e) => setDriverPin(e.target.value)}
                  placeholder={t("أدخل رمز PIN", "Enter PIN code")}
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={!driverIdInput.trim() || !driverPin.trim() || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin ms-2" />
                ) : (
                  <Truck className="w-4 h-4 ms-2" />
                )}
                {t("دخول", "Login")}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // Active orders (not delivered/cancelled)
  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status))
  const completedOrders = orders.filter((o) => ["delivered", "cancelled"].includes(o.status))
  // UX-05: ملخّص المحفظة من الطلبات المسلَّمة
  const deliveredOrders = orders.filter((o) => o.status === "delivered")
  const deliveredCount = deliveredOrders.length
  const cashCollected = deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <BackButton />

        {/* Driver Info Header */}
        <Card className="mt-4 mb-6 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-lg">{driver.name}</h2>
                <p className="text-sm text-gray-500">
                  {driver.vehicle_type && `${driver.vehicle_type} • `}
                  {t("التقييم:", "Rating:")} {driver.rating || 0} ⭐
                  {" • "}
                  {t("التوصيلات:", "Deliveries:")} {driver.total_deliveries || 0}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDriverId("")
                  setDriver(null)
                  setOrders([])
                  setDriverIdInput("")
                }}
              >
                {t("خروج", "Logout")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{activeOrders.length}</p>
              <p className="text-xs text-gray-500">{t("طلبات نشطة", "Active")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
              <p className="text-xs text-gray-500">{t("مكتملة", "Completed")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{orders.length}</p>
              <p className="text-xs text-gray-500">{t("الإجمالي", "Total")}</p>
            </CardContent>
          </Card>
        </div>

        {/* UX-05: محفظة السائق — النقدية المحصّلة (COD) من الطلبات المسلَّمة */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/15 rounded-xl">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t("النقدية المحصّلة (دفع عند الاستلام)", "Cash collected (COD)")}</p>
                <p className="text-xl font-extrabold text-primary">
                  {cashCollected.toFixed(2)} <span className="text-sm font-normal text-gray-500">{t("جنيه", "EGP")}</span>
                </p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
              <p className="text-xs text-gray-500">{t("تسليمات", "Deliveries")}</p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">{t("لا توجد طلبات متعددة المتاجر حالياً", "No multi-store orders yet")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-orange-600" />
                  {t("الطلبات النشطة", "Active Orders")}
                </h3>
                {activeOrders.map((order) => {
                  const stops = order.pickup_stops || []
                  const confirmedStops = stops.filter((s) => s.status === "confirmed")
                  const pickedStops = stops.filter((s) => s.status === "picked_up")
                  const rejectedStops = stops.filter((s) => s.status === "rejected")
                  const activeStops = stops.filter((s) => s.status !== "rejected")
                  const isExpanded = expandedOrder === order.id

                  return (
                    <Card
                      key={order.id}
                      className="border-primary/20 overflow-hidden"
                    >
                      {/* Order Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            <span className="font-bold text-sm">#{order.id.slice(-6)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                              {getOrderStatusText(order.status)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{t("العميل:", "Customer:")} {order.customer_name}</span>
                          <span>{order.total.toFixed(2)} {t("جنيه", "EGP")}</span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>
                              {t("تقدم الاستلام", "Pickup progress")}
                            </span>
                            <span>{pickedStops.length}/{activeStops.length}</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-500"
                              style={{
                                width: activeStops.length > 0
                                  ? `${(pickedStops.length / activeStops.length) * 100}%`
                                  : "0%",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* UX-05: إتمام التسليم بكود التأكيد عندما يكون الطلب في الطريق */}
                      {order.status === "on_the_way" && (
                        <div className="p-4 border-t bg-primary/5" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            {t("أدخل كود التأكيد من العميل لإتمام التسليم", "Enter the customer's confirmation code to complete delivery")}
                          </p>
                          <div className="flex gap-2">
                            <Input
                              value={deliveryCodes[order.id] || ""}
                              onChange={(e) =>
                                setDeliveryCodes((p) => ({ ...p, [order.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                              }
                              placeholder={t("كود من 4 أرقام", "4-digit code")}
                              inputMode="numeric"
                              className="h-10"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleDeliver(order.id)}
                              disabled={actionLoading === `deliver-${order.id}` || (deliveryCodes[order.id] || "").length < 4}
                              className="bg-primary hover:bg-primary/90 text-white whitespace-nowrap"
                            >
                              {actionLoading === `deliver-${order.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin ms-1" />
                              ) : (
                                <CheckCircle className="w-4 h-4 ms-1" />
                              )}
                              {t("تم التوصيل", "Delivered")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Expanded: Pickup Stops */}
                      {isExpanded && (
                        <div className="border-t dark:border-gray-700">
                          {/* Delivery Address */}
                          <div className="p-3 bg-info/10 border-b dark:border-gray-700">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-info mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-info">
                                  {t("عنوان التوصيل", "Delivery Address")}
                                </p>
                                <p className="text-sm">{order.delivery_address || t("غير محدد", "Not specified")}</p>
                              </div>
                            </div>
                          </div>

                          {/* Pickup Stops List */}
                          <div className="p-4 space-y-3">
                            <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                              <Store className="w-4 h-4 text-primary" />
                              {t("محطات الاستلام", "Pickup Stops")} ({stops.length})
                            </h4>

                            {stops.map((stop, idx) => (
                              <div
                                key={stop.store_id}
                                className={`rounded-lg border p-3 ${
                                  stop.status === "confirmed"
                                    ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10"
                                    : stop.status === "picked_up"
                                    ? "border-primary/20 bg-primary/5"
                                    : stop.status === "rejected"
                                    ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 opacity-60"
                                    : "border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                                      {idx + 1}
                                    </span>
                                    <span className="font-medium text-sm">{stop.store_name}</span>
                                  </div>
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(
                                      stop.status
                                    )}`}
                                  >
                                    {getStatusText(stop.status)}
                                  </span>
                                </div>

                                {/* Stop items */}
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 space-y-1">
                                  {stop.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                      <span>
                                        {item.name} × {item.quantity}
                                      </span>
                                      <span>{(item.price * item.quantity).toFixed(2)} {t("جنيه", "EGP")}</span>
                                    </div>
                                  ))}
                                  <div className="border-t dark:border-gray-600 pt-1 mt-1 font-medium flex justify-between">
                                    <span>{t("المجموع", "Subtotal")}</span>
                                    <span>{stop.subtotal.toFixed(2)} {t("جنيه", "EGP")}</span>
                                  </div>
                                </div>

                                {/* Action Button */}
                                {stop.status === "confirmed" && (
                                  <Button
                                    size="sm"
                                    className="w-full bg-primary hover:bg-primary/90 text-white"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handlePickup(order.id, stop.store_id)
                                    }}
                                    disabled={actionLoading === `${order.id}-${stop.store_id}`}
                                  >
                                    {actionLoading === `${order.id}-${stop.store_id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin ms-2" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4 ms-2" />
                                    )}
                                    {t("استلمت من هذا المتجر", "Picked up from this store")}
                                  </Button>
                                )}

                                {stop.status === "picked_up" && (
                                  <div className="flex items-center gap-1 text-primary text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    {t("تم الاستلام", "Picked up")}
                                    {stop.picked_up_at && (
                                      <span className="text-gray-400 mr-1">
                                        {new Date(stop.picked_up_at).toLocaleTimeString(t("ar-EG", "en-US"), {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {stop.status === "rejected" && (
                                  <div className="flex items-center gap-1 text-red-600 text-xs">
                                    <XCircle className="w-3 h-3" />
                                    {t("رفض المتجر", "Store rejected")}
                                    {stop.rejection_reason && (
                                      <span className="text-gray-400 mr-1">- {stop.rejection_reason}</span>
                                    )}
                                  </div>
                                )}

                                {stop.status === "pending" && (
                                  <div className="flex items-center gap-1 text-yellow-600 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {t("في انتظار تأكيد المتجر", "Waiting for store confirmation")}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </>
            )}

            {/* Completed Orders */}
            {completedOrders.length > 0 && (
              <>
                <h3 className="font-bold text-lg flex items-center gap-2 mt-6">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  {t("الطلبات المكتملة", "Completed Orders")}
                </h3>
                {completedOrders.map((order) => {
                  const stops = order.pickup_stops || []
                  const pickedStops = stops.filter((s) => s.status === "picked_up")

                  return (
                    <Card key={order.id} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="font-bold text-sm">#{order.id.slice(-6)}</span>
                          </div>
                          <span className={`text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                            {getOrderStatusText(order.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center justify-between">
                          <span>{order.customer_name}</span>
                          <span>
                            {stops.length} {t("متاجر", "stores")} • {order.total.toFixed(2)} {t("جنيه", "EGP")}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(order.created_at).toLocaleDateString("ar-EG")}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* Refresh button */}
        {driver && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => loadDriverData(driverId)}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin ms-2" />}
              {t("تحديث الطلبات", "Refresh Orders")}
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

