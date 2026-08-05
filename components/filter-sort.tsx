"use client"

import { useState, useEffect, useRef } from "react"
import { SlidersHorizontal, Calendar, Banknote, MapPin } from "lucide-react"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet"
import { useLanguage } from "../lib/language-context"
import { useUserLocation } from "../lib/location/user-location"
import { NearbyControl } from "./nearby-control"

export interface FilterState {
  sortBy: string
  priceMin: number | null
  priceMax: number | null
  daysAgo: number | null
  /** نصف قطر بالكيلومتر من موقع المستخدم — null = بلا حدّ */
  maxKm: number | null
}

interface FilterSortProps {
  onFilterChange?: (filters: FilterState) => void
  initialSort?: string
}

const DATE_OPTIONS = [
  { value: 0, labelAr: "الكل", labelEn: "All" },
  { value: 1, labelAr: "يوم واحد", labelEn: "1 day" },
  { value: 3, labelAr: "3 أيام", labelEn: "3 days" },
  { value: 7, labelAr: "أسبوع", labelEn: "1 week" },
  { value: 14, labelAr: "أسبوعين", labelEn: "2 weeks" },
  { value: 30, labelAr: "شهر", labelEn: "1 month" },
  { value: 90, labelAr: "3 أشهر", labelEn: "3 months" },
]

// خطوات نصف قطر المسافة (كم) — 0 = بلا حدّ
const KM_OPTIONS = [0, 1, 2, 5, 10, 20, 50]

export function FilterSort({ onFilterChange, initialSort = "relevance" }: FilterSortProps) {
  const [sortBy, setSortBy] = useState(initialSort)
  const [priceMin, setPriceMin] = useState("")
  const [priceMax, setPriceMax] = useState("")
  const [daysAgo, setDaysAgo] = useState(0)
  const [maxKm, setMaxKm] = useState(0)
  const [open, setOpen] = useState(false)
  const { t, language } = useLanguage()
  const { coords } = useUserLocation()

  const isRTL = language === "ar"

  // نصف القطر بلا موقع معروف يُفرغ النتائج بلا سبب مفهوم — نُعطّله اشتقاقًا (لا بـsetState داخل
  // effect) فيعود تلقائيًا لو أعاد المستخدم تحديد موقعه بلا أن يفقد اختياره.
  const effectiveMaxKm = coords && maxKm > 0 ? maxKm : 0

  const hasActiveFilters =
    sortBy !== "relevance" ||
    priceMin !== "" ||
    priceMax !== "" ||
    daysAgo > 0 ||
    effectiveMaxKm > 0

  // تطبيق التغييرات تلقائياً عند تغيير أي فلتر
  const isFirstMount = useRef(true)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (onFilterChange) {
      onFilterChange({
        sortBy,
        priceMin: priceMin ? Number(priceMin) : null,
        priceMax: priceMax ? Number(priceMax) : null,
        daysAgo: daysAgo > 0 ? daysAgo : null,
        maxKm: effectiveMaxKm > 0 ? effectiveMaxKm : null,
      })
    }
  }, [sortBy, priceMin, priceMax, daysAgo, effectiveMaxKm, onFilterChange])

  const handleSortChange = (value: string) => {
    setSortBy(value)
  }

  const handleApply = () => {
    if (onFilterChange) {
      onFilterChange({
        sortBy,
        priceMin: priceMin ? Number(priceMin) : null,
        priceMax: priceMax ? Number(priceMax) : null,
        daysAgo: daysAgo > 0 ? daysAgo : null,
        maxKm: effectiveMaxKm > 0 ? effectiveMaxKm : null,
      })
    }
    setOpen(false)
  }

  const handleReset = () => {
    setSortBy("relevance")
    setPriceMin("")
    setPriceMax("")
    setDaysAgo(0)
    setMaxKm(0)
    if (onFilterChange) {
      onFilterChange({ sortBy: "relevance", priceMin: null, priceMax: null, daysAgo: null, maxKm: null })
    }
    setOpen(false)
  }

  const getSortLabel = () => {
    switch (sortBy) {
      case "relevance":
        return t("الأقرب", "Nearest")
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
        return t("الأقرب", "Nearest")
    }
  }

  const getDateLabel = () => {
    const opt = DATE_OPTIONS.find((o) => o.value === daysAgo)
    if (!opt || opt.value === 0) return t("الكل", "All")
    return isRTL ? opt.labelAr : opt.labelEn
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-white border-3 border-primary text-primary hover:bg-primary hover:text-white transition-all duration-200 active:scale-95 shadow-sm font-semibold"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("فلترة وترتيب", "Filter & Sort")}
          {hasActiveFilters && <span className="h-2 w-2 bg-red-500 rounded-full ml-1"></span>}
        </Button>
      </SheetTrigger>

      <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:w-[380px] flex flex-col h-full">
        <SheetHeader className="mb-6 flex-shrink-0">
          <SheetTitle className={isRTL ? "text-right" : "text-left"}>
            {t("فلترة وترتيب المنتجات", "Filter & Sort Products")}
          </SheetTitle>
          <SheetDescription className={isRTL ? "text-right" : "text-left"}>
            {t("اختر طريقة ترتيب وفلترة المنتجات حسب تفضيلاتك", "Choose how to sort and filter products based on your preferences")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-6 p-1">
          {/* ───── قسم الترتيب ───── */}
          <div className="space-y-3">
            <Label
              htmlFor="sort-select"
              className={`text-base font-semibold block ${isRTL ? "text-right" : "text-left"}`}
            >
              {t("ترتيب حسب", "Sort by")}
            </Label>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger
                id="sort-select"
                className={`h-12 border-2 border-primary border-opacity-30 focus:border-primary focus:border-opacity-60 transition-colors duration-200 ${isRTL ? "text-right" : "text-left"}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={isRTL ? "text-right" : "text-left"}>
                <SelectItem value="relevance" className={isRTL ? "text-right" : "text-left"}>
                  {t("الأقرب", "Nearest")}
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

          {/* ───── قسم فلترة السعر ───── */}
          <div className="space-y-3">
            <Label className={`text-base font-semibold flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
              <Banknote className="h-4 w-4 text-primary" />
              {t("نطاق السعر", "Price Range")}
            </Label>

            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="flex-1 space-y-1">
                <span className={`text-xs text-gray-500 block ${isRTL ? "text-right" : "text-left"}`}>
                  {t("من", "From")}
                </span>
                <Input
                  type="number"
                  min={0}
                  placeholder={t("أقل سعر", "Min")}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className={`h-11 border-2 border-gray-200 focus:border-primary transition-colors ${isRTL ? "text-right" : "text-left"}`}
                />
              </div>

              <span className="text-gray-400 font-bold mt-5">→</span>

              <div className="flex-1 space-y-1">
                <span className={`text-xs text-gray-500 block ${isRTL ? "text-right" : "text-left"}`}>
                  {t("إلى", "To")}
                </span>
                <Input
                  type="number"
                  min={0}
                  placeholder={t("أعلى سعر", "Max")}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className={`h-11 border-2 border-gray-200 focus:border-primary transition-colors ${isRTL ? "text-right" : "text-left"}`}
                />
              </div>
            </div>

            {priceMin && priceMax && Number(priceMin) > Number(priceMax) && (
              <p className={`text-xs text-red-500 ${isRTL ? "text-right" : "text-left"}`}>
                {t("أقل سعر يجب أن يكون أقل من أعلى سعر", "Min price must be less than max price")}
              </p>
            )}
          </div>

          {/* ───── قسم فلترة المسافة ───── */}
          <div className="space-y-3">
            <Label className={`text-base font-semibold flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
              <MapPin className="h-4 w-4 text-primary" />
              {t("المسافة من موقعك", "Distance from you")}
            </Label>

            {!coords ? (
              // بلا إذن موقع لا معنى لنصف قطر — نعرض طلب الموقع بدل شريط ميت
              <div className={`p-3 bg-secondary rounded-lg space-y-2 ${isRTL ? "text-right" : "text-left"}`}>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "فعّل تحديد موقعك لعرض المنتجات القريبة منك فقط",
                    "Enable your location to show only nearby products",
                  )}
                </p>
                <NearbyControl />
              </div>
            ) : (
              <div className="space-y-2">
                <p className={`text-xs text-gray-500 ${isRTL ? "text-right" : "text-left"}`}>
                  {t("عرض المنتجات داخل نطاق محدد حول موقعك", "Show products within a set radius around you")}
                </p>
                <input
                  type="range"
                  min={0}
                  max={KM_OPTIONS.length - 1}
                  step={1}
                  value={KM_OPTIONS.indexOf(maxKm) === -1 ? 0 : KM_OPTIONS.indexOf(maxKm)}
                  onChange={(e) => setMaxKm(KM_OPTIONS[Number(e.target.value)])}
                  aria-label={t("نطاق المسافة بالكيلومتر", "Distance radius in kilometers")}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  style={{ direction: "ltr" }}
                />
                <div className="flex justify-between text-[10px] text-gray-400 px-0.5" dir="ltr">
                  {KM_OPTIONS.map((km) => (
                    <span key={km} className={`transition-colors ${maxKm === km ? "text-primary font-bold" : ""}`}>
                      {km === 0 ? t("الكل", "All") : `${km}`}
                    </span>
                  ))}
                </div>
                {maxKm > 0 && (
                  <div className={`p-3 bg-primary/10 rounded-lg border border-primary/20 ${isRTL ? "text-right" : "text-left"}`}>
                    <p className="text-sm text-primary font-medium">
                      {t(`ضمن ${maxKm} كم من موقعك`, `Within ${maxKm} km of you`)}
                    </p>
                    <p className="text-xs text-primary/80 mt-1">
                      {t(
                        "المتاجر التي لم تحدّد موقعها على الخريطة لن تظهر ضمن هذا النطاق",
                        "Stores without a map location won't appear inside this radius",
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ───── قسم فلترة التاريخ ───── */}
          <div className="space-y-3">
            <Label className={`text-base font-semibold flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
              <Calendar className="h-4 w-4 text-primary" />
              {t("تاريخ التحديث", "Last Updated")}
            </Label>
            <p className={`text-xs text-gray-500 ${isRTL ? "text-right" : "text-left"}`}>
              {t("عرض المنتجات التي تم تحديثها خلال الفترة المحددة", "Show products updated within the selected period")}
            </p>

            {/* شريط التاريخ */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={DATE_OPTIONS.length - 1}
                step={1}
                value={DATE_OPTIONS.findIndex((o) => o.value === daysAgo)}
                onChange={(e) => setDaysAgo(DATE_OPTIONS[Number(e.target.value)].value)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                style={{ direction: "ltr" }}
              />
              {/* تسميات الشريط */}
              <div className="flex justify-between text-[10px] text-gray-400 px-0.5" dir="ltr">
                {DATE_OPTIONS.map((opt) => (
                  <span
                    key={opt.value}
                    className={`transition-colors ${daysAgo === opt.value ? "text-primary font-bold" : ""}`}
                  >
                    {isRTL ? opt.labelAr : opt.labelEn}
                  </span>
                ))}
              </div>
            </div>

            {daysAgo > 0 && (
              <div className={`p-3 bg-primary/10 rounded-lg border border-primary/20 ${isRTL ? "text-right" : "text-left"}`}>
                <p className="text-sm text-primary font-medium">
                  {t(
                    `عرض المنتجات المحدثة خلال آخر ${daysAgo} ${daysAgo === 1 ? "يوم" : daysAgo <= 10 ? "أيام" : "يوم"}`,
                    `Showing products updated in the last ${daysAgo} day${daysAgo > 1 ? "s" : ""}`
                  )}
                </p>
              </div>
            )}
          </div>

          {/* ───── عرض الفلاتر المحددة ───── */}
          <div className="space-y-3">
            <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2 ${isRTL ? "text-right" : "text-left"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t("الترتيب:", "Sort:")}</span>
                <span className="text-sm text-primary font-semibold">{getSortLabel()}</span>
              </div>
              {(priceMin || priceMax) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{t("السعر:", "Price:")}</span>
                  <span className="text-sm text-primary font-semibold">
                    {priceMin || "0"} → {priceMax || "∞"}
                  </span>
                </div>
              )}
              {effectiveMaxKm > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{t("المسافة:", "Distance:")}</span>
                  <span className="text-sm text-primary font-semibold">
                    {t(`أقل من ${effectiveMaxKm} كم`, `Under ${effectiveMaxKm} km`)}
                  </span>
                </div>
              )}
              {daysAgo > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{t("التحديث:", "Updated:")}</span>
                  <span className="text-sm text-primary font-semibold">{getDateLabel()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className={`flex gap-3 pt-4 pb-2 border-t mt-auto flex-shrink-0 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1 h-12 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium bg-transparent"
          >
            {t("إعادة التعيين", "Reset")}
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 h-12 bg-primary hover:bg-primary/90 active:bg-primary text-white text-base font-semibold transition-all duration-200 border-2 border-primary hover:border-primary/90 shadow-md"
          >
            {t("تطبيق الفلترة", "Apply Filters")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
