"use client"

import { useState, useEffect } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useLanguage } from "@/lib/language-context"

interface FilterSortProps {
  onFilterChange?: (filters: { sortBy: string }) => void
  initialSort?: string
}

export function FilterSort({ onFilterChange, initialSort = "relevance" }: FilterSortProps) {
  const [sortBy, setSortBy] = useState(initialSort)
  const [open, setOpen] = useState(false)
  const { t, language } = useLanguage()

  const isRTL = language === "ar"

  // تطبيق التغييرات تلقائياً عند تغيير الترتيب
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ sortBy })
    }
  }, [sortBy, onFilterChange])

  const handleSortChange = (value: string) => {
    setSortBy(value)
  }

  const handleApply = () => {
    if (onFilterChange) {
      onFilterChange({ sortBy })
    }
    setOpen(false)
  }

  const handleReset = () => {
    setSortBy("relevance")
    if (onFilterChange) {
      onFilterChange({ sortBy: "relevance" })
    }
    setOpen(false)
  }

  const getSortLabel = () => {
    switch (sortBy) {
      case "relevance":
        return t("الأكثر صلة", "Most Relevant")
      case "price-asc":
        return t("السعر: من الأقل للأعلى", "Price: Low to High")
      case "price-desc":
        return t("السعر: من الأعلى للأقل", "Price: High to Low")
      case "rating":
        return t("الأعلى تقييماً", "Highest Rated")
      case "newest":
        return t("الأحدث", "Newest")
      case "name-asc":
        return t("الاسم: أ-ي", "Name: A-Z")
      case "name-desc":
        return t("الاسم: ي-أ", "Name: Z-A")
      default:
        return t("الأكثر صلة", "Most Relevant")
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-white border-3 border-[#1F478B] text-[#1F478B] hover:bg-[#1F478B] hover:text-white transition-all duration-200 active:scale-95 shadow-sm font-semibold"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("فلترة وترتيب", "Filter & Sort")}
          {sortBy !== "relevance" && <span className="h-2 w-2 bg-red-500 rounded-full ml-1"></span>}
        </Button>
      </SheetTrigger>

      <SheetContent side={isRTL ? "left" : "right"} className="w-[320px] sm:w-[380px]">
        <SheetHeader className="mb-6">
          <SheetTitle className={isRTL ? "text-right" : "text-left"}>{t("ترتيب المنتجات", "Sort Products")}</SheetTitle>
          <SheetDescription className={isRTL ? "text-right" : "text-left"}>
            {t("اختر طريقة ترتيب المنتجات حسب تفضيلاتك", "Choose how to sort products based on your preferences")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8">
          {/* قسم الترتيب */}
          <div className="space-y-4">
            <Label
              htmlFor="sort-select"
              className={`text-base font-semibold block ${isRTL ? "text-right" : "text-left"}`}
            >
              {t("ترتيب حسب", "Sort by")}
            </Label>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger
                id="sort-select"
                className={`h-12 border-2 border-[#1F478B] border-opacity-30 focus:border-[#1F478B] focus:border-opacity-60 transition-colors duration-200 ${isRTL ? "text-right" : "text-left"
                  }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={isRTL ? "text-right" : "text-left"}>
                <SelectItem value="relevance" className={isRTL ? "text-right" : "text-left"}>
                  {t("الأكثر صلة", "Most Relevant")}
                </SelectItem>
                <SelectItem value="price-asc" className={isRTL ? "text-right" : "text-left"}>
                  {t("السعر: من الأقل للأعلى", "Price: Low to High")}
                </SelectItem>
                <SelectItem value="price-desc" className={isRTL ? "text-right" : "text-left"}>
                  {t("السعر: من الأعلى للأقل", "Price: High to Low")}
                </SelectItem>
                <SelectItem value="rating" className={isRTL ? "text-right" : "text-left"}>
                  {t("الأعلى تقييماً", "Highest Rated")}
                </SelectItem>
                <SelectItem value="newest" className={isRTL ? "text-right" : "text-left"}>
                  {t("الأحدث", "Newest")}
                </SelectItem>
                <SelectItem value="name-asc" className={isRTL ? "text-right" : "text-left"}>
                  {t("الاسم: أ-ي", "Name: A-Z")}
                </SelectItem>
                <SelectItem value="name-desc" className={isRTL ? "text-right" : "text-left"}>
                  {t("الاسم: ي-أ", "Name: Z-A")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* عرض الترتيب المحدد */}
          <div className="space-y-3">
            <div
              className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 ${isRTL ? "text-right" : "text-left"
                }`}
            >
              <span className="text-sm font-medium text-gray-700">{t("الترتيب المحدد:", "Selected Sort:")}</span>
              <span className="text-sm text-[#1F478B] font-semibold">{getSortLabel()}</span>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className={`flex gap-3 pt-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-12 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium bg-transparent"
            >
              {t("إعادة التعيين", "Reset")}
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 h-12 bg-[#1F478B] hover:bg-[#1a3a70] active:bg-[#153267] text-white text-base font-semibold transition-all duration-200 border-2 border-[#1F478B] hover:border-[#1a3a70] shadow-md"
            >
              {t("تطبيق الترتيب", "Apply Sort")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
