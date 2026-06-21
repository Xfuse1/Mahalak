"use client"

import { useEffect } from "react"
import {
  X,
  Edit,
  PackagePlus,
  Pill,
  FlaskConical,
  FileText,
  Package,
  Ruler,
  BookmarkCheck,
  QrCode,
  Tag,
} from "lucide-react"

interface ProductAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
  show: boolean
}

interface POSProductContextMenuProps {
  open: boolean
  onClose: () => void
  productName: string
  t: (ar: string, en: string) => string
  isPharmacy: boolean
  isClothing: boolean
  isOnline?: boolean
  onEdit: () => void
  onAddStock: () => void
  // Pharmacy
  onPharmacyEdit?: () => void
  onAlternatives?: () => void
  onDrugLabel?: () => void
  onUnitModal?: () => void
  // Clothing
  onVariantManager?: () => void
  onReservation?: () => void
  onPriceTag?: () => void
  // Online
  onTierPricing?: () => void
}

export default function POSProductContextMenu({
  open,
  onClose,
  productName,
  t,
  isPharmacy,
  isClothing,
  onEdit,
  onAddStock,
  onPharmacyEdit,
  onAlternatives,
  onDrugLabel,
  onUnitModal,
  onVariantManager,
  onReservation,
  onPriceTag,
  isOnline,
  onTierPricing,
}: POSProductContextMenuProps) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("pos-modal-open")
    } else {
      document.body.classList.remove("pos-modal-open")
    }
    return () => document.body.classList.remove("pos-modal-open")
  }, [open])

  if (!open) return null

  const actions: ProductAction[] = [
    {
      icon: <Edit className="h-4.5 w-4.5" />,
      label: t("تعديل المنتج", "Edit Product"),
      onClick: () => { onEdit(); onClose() },
      color: "text-primary",
      show: true,
    },
    {
      icon: <PackagePlus className="h-4.5 w-4.5" />,
      label: t("إضافة كمية", "Add Stock"),
      onClick: () => { onAddStock(); onClose() },
      color: "text-emerald-600",
      show: true,
    },
    {
      icon: <Pill className="h-4.5 w-4.5" />,
      label: t("بيانات دوائية", "Pharmacy Data"),
      onClick: () => { onPharmacyEdit?.(); onClose() },
      color: "text-purple-600",
      show: isPharmacy,
    },
    {
      icon: <FlaskConical className="h-4.5 w-4.5" />,
      label: t("بدائل الدواء", "Alternatives"),
      onClick: () => { onAlternatives?.(); onClose() },
      color: "text-amber-600",
      show: isPharmacy,
    },
    {
      icon: <FileText className="h-4.5 w-4.5" />,
      label: t("بطاقة الدواء", "Drug Label"),
      onClick: () => { onDrugLabel?.(); onClose() },
      color: "text-green-600",
      show: isPharmacy,
    },
    {
      icon: <Package className="h-4.5 w-4.5" />,
      label: t("وحدات البيع", "Selling Units"),
      onClick: () => { onUnitModal?.(); onClose() },
      color: "text-cyan-600",
      show: isPharmacy,
    },
    {
      icon: <Ruler className="h-4.5 w-4.5" />,
      label: t("مقاسات وألوان", "Sizes & Colors"),
      onClick: () => { onVariantManager?.(); onClose() },
      color: "text-primary",
      show: isClothing,
    },
    {
      icon: <BookmarkCheck className="h-4.5 w-4.5" />,
      label: t("حجز المنتج", "Reserve"),
      onClick: () => { onReservation?.(); onClose() },
      color: "text-lime-600",
      show: isClothing,
    },
    {
      icon: <QrCode className="h-4.5 w-4.5" />,
      label: t("بطاقة السعر", "Price Tag"),
      onClick: () => { onPriceTag?.(); onClose() },
      color: "text-yellow-600",
      show: isClothing,
    },
    {
      icon: <Tag className="h-4.5 w-4.5" />,
      label: t("تسعير بالكمية", "Tier Pricing"),
      onClick: () => { onTierPricing?.(); onClose() },
      color: "text-purple-600",
      show: !!isOnline,
    },
  ].filter(a => a.show)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 pos-fade-in" />

      {/* Menu */}
      <div
        className="relative bg-white w-full md:w-auto md:min-w-[280px] md:max-w-sm md:rounded-2xl md:shadow-2xl rounded-t-2xl pos-slide-up pos-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Product name */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800 truncate flex-1">{productName}</p>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="py-1.5">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <span className={action.color}>{action.icon}</span>
              <span className="text-sm font-medium text-gray-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
