"use client"

import { Package, Settings, Send, Truck, CheckCircle, Clock } from "lucide-react"
import { useLanguage } from "../lib/language-context"

export type TimelineEntry = {
    status: string
    timestamp: string
    note?: string
}

export type TrackingStatus = "ordered" | "processing" | "shipped" | "on_the_way" | "delivered" | "cancelled"

type TrackingStep = {
    id: TrackingStatus
    labelAr: string
    labelEn: string
    icon: React.ReactNode
}

const trackingSteps: TrackingStep[] = [
    { id: "ordered", labelAr: "تم الطلب", labelEn: "Ordered", icon: <Package className="h-5 w-5" /> },
    { id: "processing", labelAr: "قيد التجهيز", labelEn: "Processing", icon: <Settings className="h-5 w-5" /> },
    { id: "shipped", labelAr: "تم الشحن", labelEn: "Shipped", icon: <Send className="h-5 w-5" /> },
    { id: "on_the_way", labelAr: "في الطريق", labelEn: "On The Way", icon: <Truck className="h-5 w-5" /> },
    { id: "delivered", labelAr: "تم التوصيل", labelEn: "Delivered", icon: <CheckCircle className="h-5 w-5" /> },
]

// Map old status to new tracking status
const statusMap: Record<string, TrackingStatus> = {
    pending: "ordered",
    processing: "processing",
    shipped: "shipped",
    on_the_way: "on_the_way",
    delivered: "delivered",
    cancelled: "cancelled",
}

function getStatusIndex(status: string): number {
    const mappedStatus = statusMap[status] || status
    return trackingSteps.findIndex(step => step.id === mappedStatus)
}

function formatDateTime(dateString: string, locale: string) {
    const date = new Date(dateString)
    return {
        date: date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }),
        time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    }
}

interface OrderTrackingTimelineProps {
    currentStatus: string
    timeline?: TimelineEntry[]
    createdAt?: string
}

export function OrderTrackingTimeline({ currentStatus, timeline, createdAt }: OrderTrackingTimelineProps) {
    const { t } = useLanguage()
    const locale = t("ar-EG", "en-US")

    const currentIndex = getStatusIndex(currentStatus)
    const isCancelled = currentStatus === "cancelled"

    // Build timeline map for quick lookup
    const timelineMap = new Map<string, TimelineEntry>()
    timeline?.forEach(entry => {
        const mappedStatus = statusMap[entry.status] || entry.status
        timelineMap.set(mappedStatus, entry)
    })

    // If no timeline, create one from createdAt
    if (!timeline?.length && createdAt) {
        timelineMap.set("ordered", { status: "ordered", timestamp: createdAt })
    }

    return (
        <div className="relative">
            {/* Cancelled Banner */}
            {isCancelled && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                    <span className="text-red-600 font-medium">{t("تم إلغاء الطلب", "Order Cancelled")}</span>
                </div>
            )}

            <div className="space-y-0">
                {trackingSteps.map((step, index) => {
                    const isCompleted = index <= currentIndex && !isCancelled
                    const isCurrent = index === currentIndex && !isCancelled
                    const isLast = index === trackingSteps.length - 1
                    const entry = timelineMap.get(step.id)
                    const dateTime = entry ? formatDateTime(entry.timestamp, locale) : null

                    return (
                        <div key={step.id} className="flex gap-4">
                            {/* Timeline indicator */}
                            <div className="flex flex-col items-center">
                                {/* Circle */}
                                <div
                                    className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${isCompleted
                                            ? "bg-[#1F478B] border-[#1F478B] text-white"
                                            : "bg-gray-100 border-gray-300 text-gray-400"
                                        }
                    ${isCurrent ? "ring-4 ring-[#1F478B]/20" : ""}
                  `}
                                >
                                    {step.icon}
                                </div>
                                {/* Line */}
                                {!isLast && (
                                    <div
                                        className={`w-0.5 h-16 ${index < currentIndex && !isCancelled
                                            ? "bg-[#1F478B]"
                                            : "bg-gray-200"
                                            }`}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pb-8 ${isLast ? "pb-0" : ""}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4
                                            className={`font-semibold ${isCompleted ? "text-gray-900" : "text-gray-400"
                                                }`}
                                        >
                                            {t(step.labelAr, step.labelEn)}
                                        </h4>
                                        {dateTime && (
                                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                                <Clock className="h-3 w-3" />
                                                <span>{dateTime.date}</span>
                                                <span>•</span>
                                                <span>{dateTime.time}</span>
                                            </div>
                                        )}
                                        {entry?.note && (
                                            <p className="mt-1 text-sm text-gray-600 italic">{entry.note}</p>
                                        )}
                                    </div>
                                    {isCurrent && (
                                        <span className="px-2 py-1 text-xs font-medium bg-[#1F478B]/10 text-[#1F478B] rounded-full">
                                            {t("الحالة الحالية", "Current")}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
