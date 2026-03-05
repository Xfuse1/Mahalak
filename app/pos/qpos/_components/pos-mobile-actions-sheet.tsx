"use client"

import { useEffect } from "react"
import {
  X,
  RotateCcw,
  LogIn,
  LogOut,
  Receipt,
  BarChart3,
  Bookmark,
  Plus,
  CalendarClock,
  FileText,
  Shield,
  User,
  Package,
  Pill,
  FlaskConical,
  Ruler,
  Crown,
  CircleDollarSign,
  Snowflake,
  Truck,
  Gift,
  BookmarkCheck,
  PercentCircle,
  Stethoscope,
  ShoppingBag,
  MapPin,
  Smartphone,
  Bell,
  Undo2,
  TrendingUp,
  Globe,
} from "lucide-react"

interface ToolAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
  badge?: string | number
}

interface POSMobileActionsSheetProps {
  open: boolean
  onClose: () => void
  t: (ar: string, en: string) => string
  isPharmacy: boolean
  isClothing: boolean
  currentShift: any
  heldCartsCount: number
  // Action handlers
  onShift: () => void
  onReturn: () => void
  onHistory: () => void
  onSummary: () => void
  onHeldCarts: () => void
  onQuickAdd: () => void
  // Pharmacy actions
  onExpiryAlerts?: () => void
  onPrescription?: () => void
  onPrescriptionHistory?: () => void
  onInsurance?: () => void
  onPatient?: () => void
  onBatchInventory?: () => void
  onFEFO?: () => void
  // Clothing actions
  onLoyalty?: () => void
  onInstallment?: () => void
  onSeason?: () => void
  onSupplier?: () => void
  onGiftCard?: () => void
  onReservation?: () => void
  onInvoiceDiscount?: () => void
  // Online actions
  isOnline?: boolean
  onOnlineOrders?: () => void
  onShippingZones?: () => void
  onPaymentConfig?: () => void
  onLowStock?: () => void
  onOnlineReturns?: () => void
  onOnlineReports?: () => void
  onlineOrdersBadge?: number
  lowStockBadge?: number
  onlineReturnsBadge?: number
}

export default function POSMobileActionsSheet({
  open,
  onClose,
  t,
  isPharmacy,
  isClothing,
  currentShift,
  heldCartsCount,
  onShift,
  onReturn,
  onHistory,
  onSummary,
  onHeldCarts,
  onQuickAdd,
  onExpiryAlerts,
  onPrescription,
  onPrescriptionHistory,
  onInsurance,
  onPatient,
  onBatchInventory,
  onFEFO,
  onLoyalty,
  onInstallment,
  onSeason,
  onSupplier,
  onGiftCard,
  onReservation,
  onInvoiceDiscount,
  isOnline,
  onOnlineOrders,
  onShippingZones,
  onPaymentConfig,
  onLowStock,
  onOnlineReturns,
  onOnlineReports,
  onlineOrdersBadge,
  lowStockBadge,
  onlineReturnsBadge,
}: POSMobileActionsSheetProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.classList.add("pos-modal-open")
    } else {
      document.body.classList.remove("pos-modal-open")
    }
    return () => document.body.classList.remove("pos-modal-open")
  }, [open])

  if (!open) return null

  const coreActions: ToolAction[] = [
    {
      icon: currentShift ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />,
      label: currentShift ? t("إغلاق وردية", "Close Shift") : t("فتح وردية", "Open Shift"),
      onClick: () => { onShift(); onClose() },
      color: currentShift ? "bg-red-50 text-red-600 border-red-200" : "bg-teal-50 text-teal-600 border-teal-200",
    },
    {
      icon: <RotateCcw className="h-5 w-5" />,
      label: t("مرتجعات", "Returns"),
      onClick: () => { onReturn(); onClose() },
      color: "bg-orange-50 text-orange-600 border-orange-200",
    },
    {
      icon: <Receipt className="h-5 w-5" />,
      label: t("سجل المبيعات", "Sales History"),
      onClick: () => { onHistory(); onClose() },
      color: "bg-rose-50 text-rose-600 border-rose-200",
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: t("ملخص اليوم", "Summary"),
      onClick: () => { onSummary(); onClose() },
      color: "bg-violet-50 text-violet-600 border-violet-200",
    },
    {
      icon: <Bookmark className="h-5 w-5" />,
      label: t("سلات معلقة", "Held Carts"),
      onClick: () => { onHeldCarts(); onClose() },
      color: "bg-blue-50 text-blue-600 border-blue-200",
      badge: heldCartsCount > 0 ? heldCartsCount : undefined,
    },
    {
      icon: <Plus className="h-5 w-5" />,
      label: t("إضافة منتج", "Add Product"),
      onClick: () => { onQuickAdd(); onClose() },
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
  ]

  const pharmacyActions: ToolAction[] = isPharmacy ? [
    {
      icon: <CalendarClock className="h-5 w-5" />,
      label: t("تنبيهات الصلاحية", "Expiry Alerts"),
      onClick: () => { onExpiryAlerts?.(); onClose() },
      color: "bg-red-50 text-red-600 border-red-200",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: t("روشتة جديدة", "New Rx"),
      onClick: () => { onPrescription?.(); onClose() },
      color: "bg-teal-50 text-teal-600 border-teal-200",
    },
    {
      icon: <Stethoscope className="h-5 w-5" />,
      label: t("سجل الروشتات", "Rx History"),
      onClick: () => { onPrescriptionHistory?.(); onClose() },
      color: "bg-teal-50 text-teal-600 border-teal-200",
    },
    {
      icon: <Shield className="h-5 w-5" />,
      label: t("التأمين", "Insurance"),
      onClick: () => { onInsurance?.(); onClose() },
      color: "bg-blue-50 text-blue-600 border-blue-200",
    },
    {
      icon: <User className="h-5 w-5" />,
      label: t("ملف المريض", "Patient"),
      onClick: () => { onPatient?.(); onClose() },
      color: "bg-purple-50 text-purple-600 border-purple-200",
    },
    {
      icon: <Package className="h-5 w-5" />,
      label: t("جرد الباتش", "Batch Inv."),
      onClick: () => { onBatchInventory?.(); onClose() },
      color: "bg-orange-50 text-orange-600 border-orange-200",
    },
    {
      icon: <CalendarClock className="h-5 w-5" />,
      label: t("FEFO", "FEFO"),
      onClick: () => { onFEFO?.(); onClose() },
      color: "bg-amber-50 text-amber-600 border-amber-200",
    },
  ] : []

  const clothingActions: ToolAction[] = isClothing ? [
    {
      icon: <Crown className="h-5 w-5" />,
      label: t("الولاء", "Loyalty"),
      onClick: () => { onLoyalty?.(); onClose() },
      color: "bg-amber-50 text-amber-600 border-amber-200",
    },
    {
      icon: <CircleDollarSign className="h-5 w-5" />,
      label: t("التقسيط", "Installments"),
      onClick: () => { onInstallment?.(); onClose() },
      color: "bg-pink-50 text-pink-600 border-pink-200",
    },
    {
      icon: <Snowflake className="h-5 w-5" />,
      label: t("المواسم", "Seasons"),
      onClick: () => { onSeason?.(); onClose() },
      color: "bg-cyan-50 text-cyan-600 border-cyan-200",
    },
    {
      icon: <Truck className="h-5 w-5" />,
      label: t("الموردين", "Suppliers"),
      onClick: () => { onSupplier?.(); onClose() },
      color: "bg-slate-50 text-slate-600 border-slate-200",
    },
    {
      icon: <Gift className="h-5 w-5" />,
      label: t("بطاقات هدايا", "Gift Cards"),
      onClick: () => { onGiftCard?.(); onClose() },
      color: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200",
    },
    {
      icon: <BookmarkCheck className="h-5 w-5" />,
      label: t("الحجوزات", "Reservations"),
      onClick: () => { onReservation?.(); onClose() },
      color: "bg-lime-50 text-lime-600 border-lime-200",
    },
    {
      icon: <PercentCircle className="h-5 w-5" />,
      label: t("خصم الفاتورة", "Inv. Discount"),
      onClick: () => { onInvoiceDiscount?.(); onClose() },
      color: "bg-yellow-50 text-yellow-600 border-yellow-200",
    },
  ] : []

  const onlineActions: ToolAction[] = isOnline ? [
    {
      icon: <ShoppingBag className="h-5 w-5" />,
      label: t("الطلبات الواردة", "Incoming Orders"),
      onClick: () => { onOnlineOrders?.(); onClose() },
      color: "bg-blue-50 text-blue-600 border-blue-200",
      badge: onlineOrdersBadge,
    },
    {
      icon: <MapPin className="h-5 w-5" />,
      label: t("مناطق الشحن", "Shipping Zones"),
      onClick: () => { onShippingZones?.(); onClose() },
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      label: t("طرق الدفع", "Payment"),
      onClick: () => { onPaymentConfig?.(); onClose() },
      color: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    {
      icon: <Bell className="h-5 w-5" />,
      label: t("تنبيه المخزون", "Low Stock"),
      onClick: () => { onLowStock?.(); onClose() },
      color: "bg-orange-50 text-orange-600 border-orange-200",
      badge: lowStockBadge,
    },
    {
      icon: <Undo2 className="h-5 w-5" />,
      label: t("مرتجعات أونلاين", "Online Returns"),
      onClick: () => { onOnlineReturns?.(); onClose() },
      color: "bg-red-50 text-red-600 border-red-200",
      badge: onlineReturnsBadge,
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: t("تقارير", "Reports"),
      onClick: () => { onOnlineReports?.(); onClose() },
      color: "bg-teal-50 text-teal-600 border-teal-200",
    },
  ] : []

  const renderActionGrid = (actions: ToolAction[]) => (
    <div className="grid grid-cols-3 gap-2.5">
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={action.onClick}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 relative ${action.color}`}
        >
          {action.badge && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
              {action.badge}
            </span>
          )}
          {action.icon}
          <span className="text-[11px] font-medium text-center leading-tight">{action.label}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 pos-fade-in" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pos-slide-up pos-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-gray-800 font-bold text-base">
            {t("الأدوات", "Tools")}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-4 max-h-[70vh] overflow-y-auto pos-scroll space-y-4">
          {/* Core actions */}
          {renderActionGrid(coreActions)}

          {/* Pharmacy actions */}
          {isPharmacy && pharmacyActions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-4 w-4 text-green-600" />
                <span className="text-sm font-bold text-gray-700">{t("أدوات الصيدلية", "Pharmacy Tools")}</span>
              </div>
              {renderActionGrid(pharmacyActions)}
            </div>
          )}

          {/* Clothing actions */}
          {isClothing && clothingActions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-bold text-gray-700">{t("أدوات الملابس", "Clothing Tools")}</span>
              </div>
              {renderActionGrid(clothingActions)}
            </div>
          )}

          {/* Online actions */}
          {isOnline && onlineActions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-700">{t("أدوات المتجر الأونلاين", "Online Store Tools")}</span>
              </div>
              {renderActionGrid(onlineActions)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
