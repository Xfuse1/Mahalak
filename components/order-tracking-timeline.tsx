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
        <div className="relative pl-2 pr-2">
            {/* Cancelled Banner */}
            {isCancelled && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center gap-2 text-red-600 animate-in fade-in zoom-in duration-300">
                    <span className="font-bold text-lg">{t("تم إلغاء الطلب", "Order Cancelled")}</span>
                </div>
            )}

            <div className="space-y-0 relative">
                {/* Vertical line background for continuity, obscured by items but helpful for alignment if needed, 
                     though we draw lines individually per step for logic control. 
                     Here we just stick to the individual lines approach. 
                 */}

                {trackingSteps.map((step, index) => {
                    const isCompleted = index <= currentIndex && !isCancelled
                    const isCurrent = index === currentIndex && !isCancelled
                    const isLast = index === trackingSteps.length - 1
                    const entry = timelineMap.get(step.id)
                    const dateTime = entry ? formatDateTime(entry.timestamp, locale) : null

                    return (
                        <div key={step.id} className="flex gap-4 relative group">
                            {/* Timeline indicator */}
                            <div className="flex flex-col items-center">
                                {/* Circle */}
                                <div
                                    className={`
                                        z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500
                                        ${isCompleted
                                            ? "bg-[#1F478B] border-[#1F478B] text-white shadow-md shadow-[#1F478B]/20"
                                            : "bg-white border-gray-200 text-gray-300"
                                        }
                                        ${isCurrent ? "ring-4 ring-[#1F478B]/20 scale-110" : ""}
                                    `}
                                >
                                    {isCurrent && !isCancelled ? (
                                        <div className="animate-pulse">{step.icon}</div>
                                    ) : (
                                        step.icon
                                    )}
                                </div>
                                {/* Line */}
                                {!isLast && (
                                    <div
                                        className={`w-0.5 h-20 transition-colors duration-500 ease-in-out ${index < currentIndex && !isCancelled
                                            ? "bg-[#1F478B]"
                                            : "bg-gray-100"
                                            }`}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pb-10 ${isLast ? "pb-0" : ""} pt-1`}>
                                <div className={`
                                    flex items-start justify-between p-3 rounded-lg transition-colors
                                    ${isCurrent ? "bg-[#1F478B]/5 border border-[#1F478B]/10" : "hover:bg-gray-50"}
                                `}>
                                    <div>
                                        <h4
                                            className={`font-bold text-base ${isCompleted ? "text-gray-900" : "text-gray-400"
                                                }`}
                                        >
                                            {t(step.labelAr, step.labelEn)}
                                        </h4>
                                        {dateTime && (
                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                                                <Clock className="h-3.5 w-3.5 opacity-70" />
                                                <span dir="ltr">{dateTime.date}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <span dir="ltr">{dateTime.time}</span>
                                            </div>
                                        )}
                                        {entry?.note && (
                                            <p className="mt-2 text-sm text-gray-600 italic bg-white/50 p-2 rounded border border-gray-100">
                                                "{entry.note}"
                                            </p>
                                        )}
                                    </div>
                                    {isCurrent && (
                                        <span className="px-3 py-1 text-xs font-bold bg-[#1F478B] text-white rounded-full shadow-sm animate-in fade-in slide-in-from-end-4">
                                            {t("الآن", "Now")}
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
