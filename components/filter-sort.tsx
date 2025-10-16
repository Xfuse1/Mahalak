"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useLanguage } from "@/lib/language-context"

interface FilterSortProps {
  onFilterChange?: (filters: { distance: number; sortBy: string }) => void
}

export function FilterSort({ onFilterChange }: FilterSortProps) {
  const [distance, setDistance] = useState([10])
  const [sortBy, setSortBy] = useState("relevance")
  const { t } = useLanguage()

  const handleApply = () => {
    onFilterChange?.({ distance: distance[0], sortBy })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 bg-transparent">
          <SlidersHorizontal className="h-4 w-4" />
          {t("فلترة وترتيب", "Filter & Sort")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader className="mb-6">
          <SheetTitle>{t("فلترة وترتيب النتائج", "Filter & Sort Results")}</SheetTitle>
          <SheetDescription>{t("اختر المعايير المناسبة لك", "Choose your preferences")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-8">
          <div className="space-y-4">
            <Label htmlFor="distance-slider" className="text-base font-semibold">
              {t("المسافة (كم)", "Distance (km)")}
            </Label>
            <Slider
              id="distance-slider"
              value={distance}
              onValueChange={setDistance}
              max={50}
              step={1}
              className="my-4"
              aria-label={t("المسافة (كم)", "Distance (km)")}
            />
            <p className="text-sm text-gray-600">
              {t("حتى", "Up to")} {distance[0]} {t("كم", "km")}
            </p>
          </div>

          <div className="space-y-4">
            <Label htmlFor="sort-select" className="text-base font-semibold">
              {t("ترتيب حسب", "Sort by")}
            </Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger id="sort-select" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">{t("الأكثر صلة", "Most Relevant")}</SelectItem>
                <SelectItem value="price-asc">{t("السعر: من الأقل للأعلى", "Price: Low to High")}</SelectItem>
                <SelectItem value="price-desc">{t("السعر: من الأعلى للأقل", "Price: High to Low")}</SelectItem>
                <SelectItem value="rating">{t("التقييم", "Rating")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleApply} className="w-full h-11 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold">
            {t("تطبيق", "Apply")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
