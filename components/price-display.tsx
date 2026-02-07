"use client"

import { useLanguage } from "@/lib/language-context"
import { Tag } from "lucide-react"

interface PriceDisplayProps {
  price: number
  discountPercentage?: number
  size?: "sm" | "md" | "lg" | "xl"
  showBadge?: boolean
  className?: string
}

export function PriceDisplay({ 
  price, 
  discountPercentage, 
  size = "md", 
  showBadge = true,
  className = ""
}: PriceDisplayProps) {
  const { t } = useLanguage()
  
  const hasDiscount = discountPercentage && discountPercentage > 0
  const discountedPrice = hasDiscount 
    ? price - (price * discountPercentage / 100) 
    : price

  const sizeClasses = {
    sm: {
      price: "text-sm",
      original: "text-xs",
      badge: "text-[10px] px-1.5 py-0.5",
      currency: "text-xs"
    },
    md: {
      price: "text-xl",
      original: "text-sm",
      badge: "text-xs px-2 py-1",
      currency: "text-sm"
    },
    lg: {
      price: "text-3xl",
      original: "text-lg",
      badge: "text-sm px-2.5 py-1",
      currency: "text-lg"
    },
    xl: {
      price: "text-5xl",
      original: "text-xl",
      badge: "text-base px-3 py-1.5",
      currency: "text-2xl"
    }
  }

  const classes = sizeClasses[size]

  if (!hasDiscount) {
    return (
      <p className={`font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent ${classes.price} ${className}`}>
        {price.toLocaleString()} <span className={`font-medium text-gray-500 ${classes.currency}`}>{t("جنيه", "EGP")}</span>
      </p>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Discount Badge */}
      {showBadge && (
        <div className={`inline-flex items-center gap-1 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full font-bold shadow-sm w-fit ${classes.badge}`}>
          <Tag className="h-3 w-3" />
          <span>{t(`خصم ${discountPercentage}%`, `${discountPercentage}% OFF`)}</span>
        </div>
      )}
      
      {/* Original Price (strikethrough) */}
      <p className={`text-gray-400 line-through font-medium ${classes.original}`}>
        {price.toLocaleString()} {t("جنيه", "EGP")}
      </p>
      
      {/* Discounted Price */}
      <p className={`font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent ${classes.price}`}>
        {discountedPrice.toLocaleString()} <span className={`font-medium text-gray-500 ${classes.currency}`}>{t("جنيه", "EGP")}</span>
      </p>
    </div>
  )
}

// Inline version for compact displays
export function PriceDisplayInline({ 
  price, 
  discountPercentage,
  className = ""
}: {
  price: number
  discountPercentage?: number
  className?: string
}) {
  const { t } = useLanguage()
  
  const hasDiscount = discountPercentage && discountPercentage > 0
  const discountedPrice = hasDiscount 
    ? price - (price * discountPercentage / 100) 
    : price

  if (!hasDiscount) {
    return (
      <span className={`font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent ${className}`}>
        {price.toLocaleString()} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-gray-400 line-through text-sm">
        {price.toLocaleString()}
      </span>
      <span className="font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
        {discountedPrice.toLocaleString()} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
      </span>
      <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
        -{discountPercentage}%
      </span>
    </span>
  )
}

// Calculate discounted price utility
export function calculateDiscountedPrice(price: number, discountPercentage?: number): number {
  if (!discountPercentage || discountPercentage <= 0) return price
  return price - (price * discountPercentage / 100)
}
