"use client"

import { Store as StoreIcon } from "lucide-react"
import { useLanguage } from "../../lib/language-context"

export function StorePageHeader() {
  const { t } = useLanguage()
  return (
    <div className="flex items-center gap-3 mb-6 mt-4">
      <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg">
        <StoreIcon className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          {t("جميع المتاجر", "All Stores")}
        </h1>
        <p className="text-gray-500 text-sm">
          {t("اكتشف أفضل المتاجر", "Discover the best stores")}
        </p>
      </div>
    </div>
  )
}
