"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { MapPin, Phone, Store, Calendar, Hash, Loader2, Truck, Navigation } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import { OrderTrackingTimeline, type TimelineEntry } from "./order-tracking-timeline"
import { useLanguage } from "../lib/language-context"
import { imgSrc } from "../lib/storage/public-url"
import { Button } from "./ui/button"
import { getOrderTracking, type OrderTracking } from "../lib/actions/tracking"

// خريطة التتبّع تُحمَّل ديناميكيًّا بلا SSR (Leaflet يحتاج window).
const DriverTrackingMap = dynamic(
    () => import("./driver-tracking-map").then((m) => m.DriverTrackingMap),
    { ssr: false, loading: () => <div className="w-full h-[260px] rounded-xl bg-gray-100 animate-pulse" /> },
)

// الحالات الحيّة التي نستطلع فيها الخادم: offering (تصل عروض الأسعار + قد يُسنَد سائق) و
// accepted/on_the_way (يتحرّك السائق). خارجها لا استطلاع.
const POLL_STATUSES = new Set(["offering", "accepted", "on_the_way"])

type OrderItem = {
    id: string
    quantity: number
    price: number
    products: {
        id: string
        name: string
        image_url: string
    }
}

type OrderBid = {
    driver_id: string
    driver_name?: string
    price: number
    reason?: string
    status?: string
    created_at?: string
}

type Order = {
    id: string
    created_at: string
    total: number
    status: string
    delivery_address: string
    delivery_price?: number
    timeline?: TimelineEntry[]
    order_items: OrderItem[]
    bids?: OrderBid[]
    stores: {
        id: string
        name: string
    }
}

interface OrderTrackingModalProps {
    order: Order
    isOpen: boolean
    onClose: () => void
}

export function OrderTrackingModal({ order, isOpen, onClose }: OrderTrackingModalProps) {
    const { t } = useLanguage()
    // عروض أسعار السائقين المعلّقة — يوافق العميل أو يرفض، والتغيير يتم سيرفر-سايد.
    const [bidBusy, setBidBusy] = useState<string | null>(null)
    const [bidError, setBidError] = useState<string | null>(null)
    const [handled, setHandled] = useState<string[]>([])
    // حارس in-flight متزامن: setBidBusy حالة React غير متزامنة، فضغط مزدوج سريع كان يُطلق respondToBid مرّتين.
    const inFlight = useRef<Set<string>>(new Set())

    // تتبّع حيّ: نستطلع الخادم كل 15ث أثناء فتح النافذة والطلب في حالة حيّة — يجلب عروض الأسعار
    // الطازجة وموقع السائق المباشر وحالة الطلب الحيّة.
    const [tracking, setTracking] = useState<OrderTracking | null>(null)
    useEffect(() => {
        if (!isOpen || !POLL_STATUSES.has(order.status)) {
            setTracking(null)
            return
        }
        let cancelled = false
        let iv: ReturnType<typeof setInterval> | undefined
        const poll = async () => {
            try {
                const res = await getOrderTracking(order.id)
                if (cancelled) return
                setTracking(res.found ? res : null)
                // بلوغ حالة نهائية/غير حيّة ⇒ لا داعي لاستطلاع دوري بعدها
                if (res.found && res.status && !POLL_STATUSES.has(res.status)) {
                    cancelled = true
                    if (iv) clearInterval(iv)
                }
            } catch {
                /* أفضل-جهد */
            }
        }
        poll()
        if (!cancelled) iv = setInterval(poll, 15000)
        return () => {
            cancelled = true
            if (iv) clearInterval(iv)
        }
    }, [isOpen, order.id, order.status])

    // الحالة الحيّة من الاستطلاع تسبق الحالة الثابتة القادمة كخاصية (تنعكس فورًا بعد قبول عرض مثلًا).
    const liveStatus = tracking?.status || order.status
    const driverLoc = tracking?.driver_location
    const liveDeliveryPrice = tracking?.delivery_price ?? order.delivery_price
    // توقيع العرض = السائق + وقت الإنشاء: نُخفي العرض الذي عالجه العميل تفاؤليًّا، لكن السائق قد يقدّم
    // عرضًا جديدًا بعد الرفض (يُعطى created_at جديدًا)، فالتوقيع الجديد يمرّ من الفلتر ويظهر خلال استطلاع.
    const bidSig = (b: { driver_id: string; created_at?: string }) => `${b.driver_id}:${b.created_at || ""}`
    // نُفضّل عروض الأسعار الطازجة من الاستطلاع على الثابتة القادمة كخاصية — فعرضٌ يصل والنافذة مفتوحة
    // يظهر خلال 15ث بدل ما يفضل مخفيًّا حتى إعادة تحميل الصفحة.
    const pendingBids = (
        tracking?.pending_bids ??
        (order.bids || []).filter((b) => b?.status === "pending")
    ).filter((b) => !handled.includes(bidSig(b)))

    const onBid = async (b: { driver_id: string; created_at?: string }, accept: boolean) => {
        const sig = bidSig(b)
        if (inFlight.current.has(sig)) return
        inFlight.current.add(sig)
        setBidBusy(b.driver_id)
        setBidError(null)
        try {
            const { respondToBid } = await import("../lib/actions/bids")
            const res = await respondToBid(order.id, b.driver_id, accept)
            if (res?.success) {
                setHandled((prev) => [...prev, bidSig(b)])
            } else {
                setBidError(t("تعذّر تنفيذ الطلب، حدّث الصفحة وحاول مجددًا", "Could not complete, refresh and try again"))
            }
        } catch {
            setBidError(t("تعذّر الاتصال بالخادم", "Could not reach the server"))
        } finally {
            inFlight.current.delete(sig)
            setBidBusy(null)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString(t("ar-EG", "en-US"), {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="p-6 bg-primary text-white">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Truck className="h-6 w-6" />
                        </div>
                        {t("تتبع الطلب", "Track Order")}
                    </DialogTitle>
                    <p className="text-white/80 text-sm mt-1 font-medium">
                        {t("تتبع حالة طلبك خطوة بخطوة", "Track your order status step by step")}
                    </p>
                </DialogHeader>

                <div className="p-4 md:p-6 space-y-6 md:space-y-8 bg-white">
                    {/* Order Info Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                    <Hash className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("رقم الطلب", "Order ID")}</span>
                            </div>
                            <p className="text-lg font-mono font-bold text-gray-900 ps-11">{order.id.slice(0, 8)}</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                    <Calendar className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("تاريخ الطلب", "Date")}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 ps-11">{formatDate(order.created_at)}</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                    <Store className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("المتجر", "Store")}</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 ps-11">{order.stores?.name || t("غير معروف", "Unknown")}</p>
                        </div>

                        {order.delivery_address && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                        <MapPin className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("العنوان", "Address")}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 ps-11 line-clamp-2">{order.delivery_address}</p>
                            </div>
                        )}
                    </div>

                    {/* عروض أسعار السائقين — تحتاج موافقة العميل */}
                    {pendingBids.length > 0 && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                            <h4 className="font-bold text-base mb-1 text-gray-900">
                                {t("عروض أسعار للتوصيل", "Delivery price offers")}
                            </h4>
                            <p className="text-xs text-gray-600 mb-3">
                                {t(
                                    `سعر التوصيل الحالي ${liveDeliveryPrice ?? "-"} ج. وافق على عرض ليُسنَد الطلب للسائق.`,
                                    `Current delivery fee ${liveDeliveryPrice ?? "-"} EGP. Approving assigns the order to that driver.`,
                                )}
                            </p>
                            <div className="space-y-2">
                                {pendingBids.map((b) => (
                                    <div
                                        key={b.driver_id}
                                        className="flex items-center justify-between gap-3 bg-white border border-amber-100 rounded-lg p-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 truncate">
                                                {b.driver_name || t("سائق", "Driver")} — {b.price} {t("ج", "EGP")}
                                            </p>
                                            {b.reason && <p className="text-xs text-gray-500 truncate">{b.reason}</p>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                disabled={bidBusy === b.driver_id}
                                                onClick={() => onBid(b, true)}
                                            >
                                                {bidBusy === b.driver_id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    t("موافقة", "Approve")
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={bidBusy === b.driver_id}
                                                onClick={() => onBid(b, false)}
                                            >
                                                {t("رفض", "Decline")}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {bidError && <p className="text-xs text-red-600 mt-2">{bidError}</p>}
                        </div>
                    )}

                    {/* خريطة التتبّع الحيّة — تظهر عند وجود موقع سائق مباشر */}
                    {driverLoc && (
                        <div className="bg-white rounded-xl">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-900">
                                <Navigation className="w-5 h-5 text-primary" />
                                {t("تتبّع السائق", "Track Driver")}
                                {tracking?.driver?.name && (
                                    <span className="text-sm font-normal text-gray-500">— {tracking.driver.name}</span>
                                )}
                            </h4>
                            <DriverTrackingMap
                                driver={{ lat: driverLoc.lat, lng: driverLoc.lng }}
                                dropoff={tracking?.dropoff ?? null}
                                driverName={tracking?.driver?.name}
                            />
                            {tracking?.driver?.phone && (
                                <a
                                    href={`tel:${tracking.driver.phone}`}
                                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"
                                >
                                    <Phone className="w-4 h-4" />
                                    {t("اتصل بالسائق", "Call driver")} ({tracking.driver.phone})
                                </a>
                            )}
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-white rounded-xl">
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-900">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            {t("مسار الطلب", "Order Timeline")}
                        </h4>
                        <OrderTrackingTimeline
                            currentStatus={liveStatus}
                            timeline={order.timeline}
                            createdAt={order.created_at}
                        />
                    </div>

                    {/* Order Items */}
                    <div className="border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900">
                            <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                            {t("ملخص المنتجات", "Order Summary")}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {order.order_items?.length || 0} {t("عناصر", "Items")}
                            </span>
                        </h4>
                        <div className="space-y-3">
                            {order.order_items?.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:bg-primary/5 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Product Image Placeholder or actual image if implemented */}
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                                            {item.products?.image_url ? (
                                                <Image
                                                    src={imgSrc(item.products.image_url)}
                                                    alt={item.products.name}
                                                    width={48}
                                                    height={48}
                                                    unoptimized
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <Store className="h-5 w-5" />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-sm font-bold text-gray-900">
                                                {item.products?.name || t("منتج غير معروف", "Unknown Product")}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-medium text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">
                                                    x{item.quantity}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-primary">
                                            {Number(item.price * item.quantity).toFixed(2)} {t("ج.م", "EGP")}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <span className="font-bold text-gray-700">{t("الإجمالي النهائي", "Grand Total")}</span>
                            <span className="text-xl font-extrabold text-primary">
                                {Number(order.total).toFixed(2)} <span className="text-sm font-normal">{t("جنيه", "EGP")}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="min-w-[100px] border-gray-300 hover:bg-gray-100 hover:text-gray-900"
                    >
                        {t("إغلاق", "Close")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
