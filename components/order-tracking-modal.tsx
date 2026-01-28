"use client"

import { useState } from "react"
import { MapPin, Phone, Store, Calendar, Hash, Loader2 } from "lucide-react"
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
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {t("تتبع الطلب", "Track Order")}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Order Info Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Hash className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">{t("رقم الطلب:", "Order ID:")}</span>
                            <span className="font-mono font-medium">{order.id.slice(0, 8)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">{t("تاريخ الطلب:", "Order Date:")}</span>
                            <span className="font-medium">{formatDate(order.created_at)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <Store className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">{t("المتجر:", "Store:")}</span>
                            <span className="font-medium">{order.stores?.name || t("غير معروف", "Unknown")}</span>
                        </div>

                        {order.delivery_address && (
                            <div className="flex items-start gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                                <span className="text-gray-600">{t("العنوان:", "Address:")}</span>
                                <span className="font-medium flex-1">{order.delivery_address}</span>
                            </div>
                        )}
                    </div>

                    {/* Order Items */}
                    <div>
                        <h4 className="font-semibold mb-3 text-gray-900">
                            {t("المنتجات", "Products")} ({order.order_items?.length || 0})
                        </h4>
                        <div className="space-y-2">
                            {order.order_items?.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-[#1F478B]/10 rounded flex items-center justify-center text-[#1F478B] font-semibold text-sm">
                                            {item.quantity}x
                                        </div>
                                        <span className="text-sm font-medium">
                                            {item.products?.name || t("منتج غير معروف", "Unknown Product")}
                                        </span>
                                    </div>
                                    <span className="text-sm font-semibold text-[#1F478B]">
                                        {Number(item.price * item.quantity).toFixed(2)} {t("جنيه", "EGP")}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <span className="font-semibold">{t("الإجمالي", "Total")}</span>
                            <span className="text-lg font-bold text-[#1F478B]">
                                {Number(order.total).toFixed(2)} {t("جنيه", "EGP")}
                            </span>
                        </div>
                    </div>

                    {/* Tracking Timeline */}
                    <div>
                        <h4 className="font-semibold mb-4 text-gray-900">
                            {t("مسار الطلب", "Order Timeline")}
                        </h4>
                        <OrderTrackingTimeline
                            currentStatus={order.status}
                            timeline={order.timeline}
                            createdAt={order.created_at}
                        />
                    </div>
                </div>

                {/* Close Button */}
                <div className="pt-4 border-t">
                    <Button
                        onClick={onClose}
                        className="w-full bg-[#1F478B] hover:bg-[#1a3a70]"
                    >
                        {t("إغلاق", "Close")}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
