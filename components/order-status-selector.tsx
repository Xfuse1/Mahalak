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
      pending: "قيد الانتظار (تم الطلب)",
      ordered: "تم الطلب",
      processing: "قيد التجهيز",
      shipped: "تم الشحن",
      on_the_way: "في الطريق",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
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
        <SelectItem value="ordered">تم الطلب</SelectItem>
        <SelectItem value="processing">قيد التجهيز</SelectItem>
        <SelectItem value="shipped">تم الشحن</SelectItem>
        <SelectItem value="on_the_way">في الطريق</SelectItem>
        <SelectItem value="delivered">تم التوصيل</SelectItem>
        <SelectItem value="cancelled">ملغي</SelectItem>
      </SelectContent>
    </Select>
  )
}
