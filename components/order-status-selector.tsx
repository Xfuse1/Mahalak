"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { updateOrderStatus } from "../lib/actions/orders"
import { useRouter } from "next/navigation"
import { useLanguage } from "../lib/language-context"
import { useToast } from "./ui/toast"

type OrderStatusSelectorProps = {
  orderId: string
  currentStatus: string
  callerId: string
  callerRole: "seller" | "driver" | "admin"
  onUpdated?: () => void
}

export function OrderStatusSelector({ orderId, currentStatus, callerId, callerRole, onUpdated }: OrderStatusSelectorProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const toast = useToast()

  const handleStatusChange = async (newStatus: string) => {
    const result = await updateOrderStatus(orderId, newStatus, callerId, callerRole)
    if (result.success) {
      router.refresh()
      onUpdated?.()
    } else {
      toast.error(t("فشل تحديث حالة الطلب", "Failed to update order status"))
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { ar: string; en: string }> = {
      pending: { ar: "\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629", en: "Pending" },
      reviewing: { ar: "\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629", en: "Reviewing" },
      processing: { ar: "\u0642\u064a\u062f \u0627\u0644\u062a\u062c\u0647\u064a\u0632", en: "Processing" },
      confirmed: { ar: "\u062a\u0645 \u0627\u0644\u062a\u0623\u0643\u064a\u062f", en: "Confirmed" },
      shipped: { ar: "\u062a\u0645 \u0627\u0644\u0634\u062d\u0646", en: "Shipped" },
      on_the_way: { ar: "\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642", en: "On The Way" },
      picking_up: { ar: "\u0642\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645", en: "Picking Up" },
      picked_up: { ar: "\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645", en: "Picked Up" },
      delivered: { ar: "\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644", en: "Delivered" },
      cancelled: { ar: "\u0645\u0644\u063a\u064a", en: "Cancelled" },
      driver_rejected: { ar: "\u0631\u0641\u0636 \u0627\u0644\u0633\u0627\u0626\u0642", en: "Driver Rejected" },
      driver_changed: { ar: "\u062a\u0645 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0633\u0627\u0626\u0642", en: "Driver Changed" },
    }

    const label = statusMap[status]
    return label ? t(label.ar, label.en) : status
  }

  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return null
  }

  return (
    <Select value={currentStatus} onValueChange={handleStatusChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue>{getStatusText(currentStatus)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="reviewing">{t("\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629", "Reviewing")}</SelectItem>
        <SelectItem value="processing">{t("\u0642\u064a\u062f \u0627\u0644\u062a\u062c\u0647\u064a\u0632", "Processing")}</SelectItem>
        <SelectItem value="confirmed">{t("\u062a\u0645 \u0627\u0644\u062a\u0623\u0643\u064a\u062f", "Confirmed")}</SelectItem>
        <SelectItem value="shipped">{t("\u062a\u0645 \u0627\u0644\u0634\u062d\u0646", "Shipped")}</SelectItem>
        <SelectItem value="on_the_way">{t("\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642", "On The Way")}</SelectItem>
        <SelectItem value="picking_up">{t("\u0642\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645", "Picking Up")}</SelectItem>
        <SelectItem value="picked_up">{t("\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645", "Picked Up")}</SelectItem>
        <SelectItem value="driver_changed">{t("\u062a\u0645 \u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0633\u0627\u0626\u0642", "Driver Changed")}</SelectItem>
        <SelectItem value="delivered">{t("\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644", "Delivered")}</SelectItem>
        <SelectItem value="cancelled">{t("\u0645\u0644\u063a\u064a", "Cancelled")}</SelectItem>
      </SelectContent>
    </Select>
  )
}
