"use client"

import { useState } from "react"
import { MapPin, Phone, Store, Calendar, Hash, Loader2, Truck } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog"
import { OrderTrackingTimeline, type TimelineEntry } from "./order-tracking-timeline"
import { useLanguage } from "../lib/language-context"
import { Button } from "./ui/button"

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

type Order = {
    id: string
    created_at: string
    total: number
    status: string
    delivery_address: string
    timeline?: TimelineEntry[]
    order_items: OrderItem[]
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
                <DialogHeader className="p-6 bg-[#1F478B] text-white">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Truck className="h-6 w-6" />
                        </div>
                        {t("تتبع الطلب", "Track Order")}
                    </DialogTitle>
                    <p className="text-[#1F478B]/80 text-sm mt-1 text-blue-100 font-medium">
                        {t("تتبع حالة طلبك خطوة بخطوة", "Track your order status step by step")}
                    </p>
                </DialogHeader>

                <div className="p-6 space-y-8 bg-white">
                    {/* Order Info Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-[#1F478B]/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-[#1F478B] transition-colors">
                                    <Hash className="h-4 w-4 text-[#1F478B] group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("رقم الطلب", "Order ID")}</span>
                            </div>
                            <p className="text-lg font-mono font-bold text-gray-900 ps-11">{order.id.slice(0, 8)}</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-[#1F478B]/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-[#1F478B] transition-colors">
                                    <Calendar className="h-4 w-4 text-[#1F478B] group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("تاريخ الطلب", "Date")}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 ps-11">{formatDate(order.created_at)}</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-[#1F478B]/20 transition-colors group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-[#1F478B] transition-colors">
                                    <Store className="h-4 w-4 text-[#1F478B] group-hover:text-white transition-colors" />
                                </div>
                                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("المتجر", "Store")}</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 ps-11">{order.stores?.name || t("غير معروف", "Unknown")}</p>
                        </div>

                        {order.delivery_address && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-[#1F478B]/20 transition-colors group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-[#1F478B] transition-colors">
                                        <MapPin className="h-4 w-4 text-[#1F478B] group-hover:text-white transition-colors" />
                                    </div>
                                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{t("العنوان", "Address")}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 ps-11 line-clamp-2">{order.delivery_address}</p>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-xl">
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2 text-gray-900">
                            <span className="w-1.5 h-6 bg-[#1F478B] rounded-full"></span>
                            {t("مسار الطلب", "Order Timeline")}
                        </h4>
                        <OrderTrackingTimeline
                            currentStatus={order.status}
                            timeline={order.timeline}
                            createdAt={order.created_at}
                        />
                    </div>

                    {/* Order Items */}
                    <div className="border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900">
                            <span className="w-1.5 h-6 bg-[#1F478B] rounded-full"></span>
                            {t("ملخص المنتجات", "Order Summary")}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {order.order_items?.length || 0} {t("عناصر", "Items")}
                            </span>
                        </h4>
                        <div className="space-y-3">
                            {order.order_items?.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:bg-blue-50/30 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Product Image Placeholder or actual image if implemented */}
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                                            {item.products?.image_url ? (
                                                <img
                                                    src={item.products.image_url}
                                                    alt={item.products.name}
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
                                        <p className="text-sm font-bold text-[#1F478B]">
                                            {Number(item.price * item.quantity).toFixed(2)} {t("ج.م", "EGP")}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between mt-6 p-4 bg-[#1F478B]/5 rounded-xl border border-[#1F478B]/10">
                            <span className="font-bold text-gray-700">{t("الإجمالي النهائي", "Grand Total")}</span>
                            <span className="text-xl font-extrabold text-[#1F478B]">
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
