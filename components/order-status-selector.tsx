"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { updateOrderStatus } from "../lib/actions/orders"
import { useRouter } from "next/navigation"

type OrderStatusSelectorProps = {
  orderId: string
  currentStatus: string
  onUpdated?: () => void
}

export function OrderStatusSelector({ orderId, currentStatus, onUpdated }: OrderStatusSelectorProps) {
  const router = useRouter()

  const handleStatusChange = async (newStatus: string) => {
    const result = await updateOrderStatus(orderId, newStatus)
    if (result.success) {
      router.refresh()
      onUpdated?.()
    } else {
      console.error("[v0] Failed to update order status:", result.error)
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "قيد المراجعة",
      reviewing: "قيد المراجعة",
      confirmed: "تم التاكيد",
      on_the_way: "في الطريق",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
      driver_rejected: "رفض السائق",
    }
    return statusMap[status] || status
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
        <SelectItem value="reviewing">قيد المراجعة</SelectItem>
        <SelectItem value="confirmed">تم التاكيد</SelectItem>
        <SelectItem value="on_the_way">في الطريق</SelectItem>
        <SelectItem value="delivered">تم التوصيل</SelectItem>
        <SelectItem value="cancelled">ملغي</SelectItem>
      </SelectContent>
    </Select>
  )
}
