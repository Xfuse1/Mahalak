"use client"

import dynamic from "next/dynamic"
import { SearchBar } from "../search-bar"
import { ProductCard } from "../product-card"
import { StoreCard } from "../store-card"
import { NearbyControl } from "../nearby-control"
import { useUserLocation } from "../../lib/location/user-location"
import { storeDistanceKm } from "../../lib/utils/geo"
import { useLanguage } from "../../lib/language-context"
import Link from "next/link"
import { Button } from "../ui/button"
import { Skeleton } from "../ui/skeleton"
import { Package, Store, ShoppingBasket, HeartPulse, Shirt, Smartphone, UtensilsCrossed, Sofa, Wrench } from "lucide-react"
import { memo } from "react"
import type { ProductListItem } from "@/lib/types/product"
import type { StoreListItem } from "@/lib/types/store"

// Lazy load below-the-fold components
const BannerCarousel = dynamic(
  () => import("../banner-carousel").then(m => ({ default: m.BannerCarousel })),
  { ssr: false, loading: () => <Skeleton className="w-full h-48 rounded-2xl" /> }
)

const MemoizedProductCard = memo(ProductCard)
const MemoizedStoreCard = memo(StoreCard)

export function HeroBanner() {
  return <BannerCarousel />
}

export function SearchSection() {
  const { t } = useLanguage()
  return (
    <section className="py-10 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t("ابحث عن أي شيء", "Search for anything")}</h2>
            <p className="text-muted-foreground">{t("آلاف المنتجات والمتاجر في انتظارك", "Thousands of products and stores await you")}</p>
          </div>
          <SearchBar
            placeholder={t("ابحث عن منتجات أو متاجر...", "Search for products or stores...")}
            className="mb-4"
          />
        </div>
      </div>
    </section>
  )
}

export function CategoriesSection() {
  const { t } = useLanguage()
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 text-foreground">{t("تصفح حسب الفئة", "Browse by Category")}</h2>
          <p className="text-muted-foreground text-base md:text-lg">{t("اختر الفئة التي تناسبك", "Choose the category that suits you")}</p>
        </div>

        <div className="overflow-x-auto pb-4 mb-10 scrollbar-hide">
          <div className="flex gap-4 justify-center min-w-max px-2">
            {[
              { href: "/category/بقالة", color: "from-emerald-400 to-emerald-600", hoverShadow: "hover:shadow-emerald-500/30", icon: ShoppingBasket, ar: "بقالة", en: "Grocery" },
              { href: "/category/صحة", color: "from-rose-400 to-rose-600", hoverShadow: "hover:shadow-rose-500/30", icon: HeartPulse, ar: "صحة", en: "Health" },
              { href: "/category/ملابس", color: "from-violet-400 to-violet-600", hoverShadow: "hover:shadow-violet-500/30", icon: Shirt, ar: "ملابس", en: "Clothing" },
              { href: "/category/إلكترونيات", color: "from-blue-400 to-blue-600", hoverShadow: "hover:shadow-blue-500/30", icon: Smartphone, ar: "إلكترونيات", en: "Electronics" },
              { href: "/category/أغذية", color: "from-amber-400 to-orange-500", hoverShadow: "hover:shadow-orange-500/30", icon: UtensilsCrossed, ar: "أغذية", en: "Food" },
              { href: "/category/أثاث", color: "from-amber-600 to-amber-800", hoverShadow: "hover:shadow-amber-500/30", icon: Sofa, ar: "أثاث", en: "Furniture" },
              { href: "/category/خدمات أخرى", color: "from-slate-500 to-slate-700", hoverShadow: "hover:shadow-slate-500/30", icon: Wrench, ar: "أخرى", en: "Other Services" },
            ].map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className={`bg-gradient-to-br ${cat.color} text-white p-6 rounded-2xl text-center shadow-sm hover:shadow-lg ${cat.hoverShadow} transition-shadow min-w-[140px] group`}
              >
                <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <cat.icon className="h-6 w-6 text-white" strokeWidth={2} />
                </div>
                <p className="font-bold text-lg whitespace-nowrap">{t(cat.ar, cat.en)}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Large Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Link
            href="/search"
            className="relative bg-primary text-primary-foreground p-8 rounded-2xl hover:bg-primary/90 transition-colors overflow-hidden group"
          >
            <div className="relative flex items-center gap-4">
              <div className="bg-white/15 p-4 rounded-xl group-hover:scale-105 transition-transform">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1">{t("جميع المنتجات", "All Products")}</h3>
                <p className="text-white/80">{t("تصفح جميع المنتجات المتاحة", "Browse all available products")}</p>
              </div>
            </div>
          </Link>
          <Link
            href="/store"
            className="relative bg-accent text-accent-foreground p-8 rounded-2xl hover:bg-accent/90 transition-colors overflow-hidden group"
          >
            <div className="relative flex items-center gap-4">
              <div className="bg-black/10 p-4 rounded-xl group-hover:scale-105 transition-transform">
                <Store className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1">{t("جميع المتاجر", "All Stores")}</h3>
                <p className="text-white/80">{t("اكتشف المتاجر المحلية", "Discover local stores")}</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

export function FeaturedStores({ stores }: { stores: StoreListItem[] }) {
  const { t } = useLanguage()
  const { coords } = useUserLocation()

  // IA-01: عند توفّر الموقع، أبرِز الأقرب إليك أولًا (المتاجر بلا إحداثيات تنزل للأسفل).
  const displayed = coords
    ? [...stores].sort((a, b) => {
        const da = storeDistanceKm(coords, a)
        const db = storeDistanceKm(coords, b)
        if (da == null && db == null) return 0
        if (da == null) return 1
        if (db == null) return -1
        return da - db
      })
    : stores

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground">
              {coords ? t("متاجر مميزة بالقرب منك", "Featured Stores Near You") : t("متاجر مميزة", "Featured Stores")}
            </h2>
            <p className="text-muted-foreground mt-2">{t("اكتشف أفضل المتاجر بجوارك", "Discover the best stores near you")}</p>
          </div>
          <Button variant="outline" asChild className="rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
            <Link href="/store">{t("عرض الكل", "View All")}</Link>
          </Button>
        </div>
        <div className="mb-8">
          <NearbyControl />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayed.map((store) => (
            <MemoizedStoreCard key={store.id} store={store} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturedProducts({ products }: { products: ProductListItem[] }) {
  const { t } = useLanguage()
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground">{t("منتجات مميزة", "Featured Products")}</h2>
            <p className="text-muted-foreground mt-2">{t("أفضل المنتجات المتاحة", "Best available products")}</p>
          </div>
          <Button variant="outline" asChild className="rounded-xl hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
            <Link href="/search">{t("عرض الكل", "View All")}</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <MemoizedProductCard key={product.id} product={product} showActions />
          ))}
        </div>
      </div>
    </section>
  )
}

export function CTASection() {
  const { t } = useLanguage()
  return (
    <section className="py-20 relative overflow-hidden bg-[oklch(0.30_0.05_155)]">
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-white/90 text-sm mb-6">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
            {t("انضم إلينا الآن", "Join us now")}
          </div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold mb-6 text-white">{t("هل أنت صاحب متجر؟", "Are you a store owner?")}</h2>
          <p className="text-xl mb-10 text-white/80 max-w-2xl mx-auto leading-relaxed">
            {t(
              "انضم إلى منصتنا وابدأ في بيع منتجاتك لآلاف العملاء",
              "Join our platform and start selling your products to thousands of customers",
            )}
          </p>
          <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-10 py-7 text-lg rounded-xl transition-colors">
            <Link href="/auth?role=seller">{t("ابدأ البيع الآن", "Start Selling Now")}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
