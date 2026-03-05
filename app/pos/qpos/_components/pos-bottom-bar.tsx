"use client"

import { ShoppingCart, Grid3X3, Wrench, Menu } from "lucide-react"

interface POSBottomBarProps {
  cartCount: number
  cartTotal: number
  currencyLabel: string
  onCartToggle: () => void
  onToolsToggle: () => void
  t: (ar: string, en: string) => string
  isCartOpen: boolean
}

export default function POSBottomBar({
  cartCount,
  cartTotal,
  currencyLabel,
  onCartToggle,
  onToolsToggle,
  t,
  isCartOpen,
}: POSBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pos-safe-bottom">
      <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {/* Cart summary strip - shown when cart has items */}
        {cartCount > 0 && !isCartOpen && (
          <button
            onClick={onCartToggle}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4.5 w-4.5" />
              <span className="text-sm font-bold">
                {cartCount} {t("منتج", "item")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {cartTotal.toFixed(2)} {currencyLabel}
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {t("عرض السلة", "View Cart")}
              </span>
            </div>
          </button>
        )}

        {/* Bottom navigation */}
        <div className="flex items-center justify-around py-1.5 px-2">
          <button
            onClick={() => {
              if (isCartOpen) onCartToggle()
            }}
            className="flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors text-gray-600"
          >
            <Grid3X3 className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t("المنتجات", "Products")}</span>
          </button>

          <button
            onClick={onCartToggle}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors relative ${
              isCartOpen ? "text-emerald-600" : "text-gray-600"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{t("السلة", "Cart")}</span>
          </button>

          <button
            onClick={onToolsToggle}
            className="flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-colors text-gray-600"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t("أدوات", "Tools")}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
