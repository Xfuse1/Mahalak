"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { CheckCircle } from "lucide-react"
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
  // UX-05: تسليم الطلب أحادي المتجر يتم عبر البائع — يطلب كود تأكيد يعرضه العميل قبل تعليمه "تم التوصيل"
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [deliveryCode, setDeliveryCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const applyStatus = async (newStatus: string, code?: string) => {
    const result = await updateOrderStatus(orderId, newStatus, callerId, callerRole, undefined, code)
    if (result.success) {
      router.refresh()
      onUpdated?.()
    } else {
      toast.error(result.error || t("فشل تحديث حالة الطلب", "Failed to update order status"))
    }
    return result.success
  }

  const handleStatusChange = async (newStatus: string) => {
    // عند اختيار "تم التوصيل" نفتح نافذة إدخال كود التأكيد بدل تطبيق الحالة مباشرة
    if (newStatus === "delivered") {
      setDeliveryCode("")
      setCodeDialogOpen(true)
      return
    }
    await applyStatus(newStatus)
  }

  const handleConfirmDelivery = async () => {
    setSubmitting(true)
    const ok = await applyStatus("delivered", deliveryCode.trim())
    setSubmitting(false)
    if (ok) {
      setCodeDialogOpen(false)
      setDeliveryCode("")
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { ar: string; en: string }> = {
      pending: { ar: "قيد المراجعة", en: "Pending" },
      reviewing: { ar: "قيد المراجعة", en: "Reviewing" },
      processing: { ar: "قيد التجهيز", en: "Processing" },
      confirmed: { ar: "تم التأكيد", en: "Confirmed" },
      shipped: { ar: "تم الشحن", en: "Shipped" },
      on_the_way: { ar: "في الطريق", en: "On The Way" },
      picking_up: { ar: "قيد الاستلام", en: "Picking Up" },
      picked_up: { ar: "تم الاستلام", en: "Picked Up" },
      delivered: { ar: "تم التوصيل", en: "Delivered" },
      cancelled: { ar: "ملغي", en: "Cancelled" },
      driver_rejected: { ar: "رفض السائق", en: "Driver Rejected" },
      driver_changed: { ar: "تم تغيير السائق", en: "Driver Changed" },
    }

    const label = statusMap[status]
    return label ? t(label.ar, label.en) : status
  }

  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return null
  }

  return (
    <>
      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue>{getStatusText(currentStatus)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="reviewing">{t("قيد المراجعة", "Reviewing")}</SelectItem>
          <SelectItem value="processing">{t("قيد التجهيز", "Processing")}</SelectItem>
          <SelectItem value="confirmed">{t("تم التأكيد", "Confirmed")}</SelectItem>
          <SelectItem value="shipped">{t("تم الشحن", "Shipped")}</SelectItem>
          <SelectItem value="on_the_way">{t("في الطريق", "On The Way")}</SelectItem>
          <SelectItem value="picking_up">{t("قيد الاستلام", "Picking Up")}</SelectItem>
          <SelectItem value="picked_up">{t("تم الاستلام", "Picked Up")}</SelectItem>
          <SelectItem value="driver_changed">{t("تم تغيير السائق", "Driver Changed")}</SelectItem>
          <SelectItem value="delivered">{t("تم التوصيل", "Delivered")}</SelectItem>
          <SelectItem value="cancelled">{t("ملغي", "Cancelled")}</SelectItem>
        </SelectContent>
      </Select>

      {/* UX-05: نافذة إدخال كود تأكيد التسليم */}
      <Dialog open={codeDialogOpen} onOpenChange={(open) => { if (!submitting) setCodeDialogOpen(open) }}>
        <DialogContent className="max-w-sm" dir={t("rtl", "ltr")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              {t("تأكيد التسليم", "Confirm Delivery")}
            </DialogTitle>
            <DialogDescription>
              {t("أدخل كود التأكيد المكوّن من 4 أرقام الذي يعرضه العميل لإتمام التسليم", "Enter the 4-digit confirmation code shown by the customer to complete delivery")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={t("كود من 4 أرقام", "4-digit code")}
              inputMode="numeric"
              autoFocus
              className="text-center text-lg tracking-[0.3em]"
              onKeyDown={(e) => { if (e.key === "Enter" && deliveryCode.trim().length >= 4 && !submitting) handleConfirmDelivery() }}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmDelivery}
                disabled={submitting || deliveryCode.trim().length < 4}
                className="flex-1"
              >
                {submitting ? t("جاري...", "Processing...") : t("تأكيد التسليم", "Confirm Delivery")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCodeDialogOpen(false)}
                disabled={submitting}
                className="flex-1"
              >
                {t("إلغاء", "Cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
