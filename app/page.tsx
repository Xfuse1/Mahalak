"use client"

import { Header } from "../components/header"
import { Footer } from "../components/footer"
import { ProductCard } from "../components/product-card"
import { StoreCard } from "../components/store-card"
import { BannerCarousel } from "../components/banner-carousel"
import { SearchBar } from "../components/search-bar"
import { Button } from "../components/ui/button"
import { useLanguage } from "../lib/language-context"
import Link from "next/link"
import { Package, Store } from "lucide-react"
import { useEffect, useState, memo } from "react"
import { getProducts } from "../lib/actions/products"
import { getStores } from "../lib/actions/stores"

// Memoize heavy components to prevent unnecessary re-renders
const MemoizedProductCard = memo(ProductCard)
const MemoizedStoreCard = memo(StoreCard)

export default function Home() {
  const { t } = useLanguage()
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [featuredStores, setFeaturedStores] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Parallel data fetching for better performance
        const [allProducts, allStores] = await Promise.all([
          getProducts(),
          getStores()
        ])
        setFeaturedProducts(allProducts.slice(0, 6))
        setFeaturedStores(allStores.slice(0, 4))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <BannerCarousel />

        {/* Search Bar Section */}
        <section className="py-8 bg-white border-b">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <SearchBar
                placeholder={t("ابحث عن منتجات أو متاجر...", "Search for products or stores...")}
                className="mb-4"
              />
            </div>
          </div>
        </section>

        {/* Categories Section - Centered */}
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8 text-center">{t("تصفح حسب الفئة", "Browse by Category")}</h2>

            <div className="overflow-x-auto pb-4 mb-8">
              <div className="flex gap-4 justify-center min-w-max px-2">
                <Link
                  href="/category/بقالة"
                  className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("بقالة", "Grocery")}</p>
                </Link>
                <Link
                  href="/category/صحة"
                  className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("صحة", "Health")}</p>
                </Link>
                <Link
                  href="/category/ملابس"
                  className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("ملابس", "Clothing")}</p>
                </Link>
                <Link
                  href="/category/إلكترونيات"
                  className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("إلكترونيات", "Electronics")}</p>
                </Link>
                <Link
                  href="/category/أغذية"
                  className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("أغذية", "Food")}</p>
                </Link>
                <Link
                  href="/category/أثاث"
                  className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("أثاث", "Furniture")}</p>
                </Link>
                <Link
                  href="/category/خدمات أخرى"
                  className="bg-gradient-to-br from-gray-600 to-gray-700 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("أخرى", "Other Services")}</p>
                </Link>
              </div>
            </div>

            {/* Large Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <Link
                href="/search"
                className="bg-gradient-to-br from-[#1F478B] to-[#2d5ba8] text-white p-8 rounded-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <Package className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{t("جميع المنتجات", "All Products")}</h3>
                    <p className="text-white/90">{t("تصفح جميع المنتجات المتاحة", "Browse all available products")}</p>
                  </div>
                </div>
              </Link>
              <Link
                href="/store"
                className="bg-gradient-to-br from-[#2d5ba8] to-[#3a6bc5] text-white p-8 rounded-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <Store className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{t("جميع المتاجر", "All Stores")}</h3>
                    <p className="text-white/90">{t("اكتشف المتاجر المحلية", "Discover local stores")}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">{t("متاجر مميزة", "Featured Stores")}</h2>
              <Button variant="outline" asChild>
                <Link href="/store">{t("عرض الكل", "View All")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
                    <div className="bg-gray-200 h-4 rounded w-3/4 mb-2"></div>
                    <div className="bg-gray-200 h-4 rounded w-1/2"></div>
                  </div>
                ))
              ) : (
                featuredStores.map((store) => (
                  <MemoizedStoreCard key={store.id} store={store} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">{t("منتجات مميزة", "Featured Products")}</h2>
              <Button variant="outline" asChild>
                <Link href="/search">{t("عرض الكل", "View All")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
                    <div className="bg-gray-200 h-4 rounded w-3/4 mb-2"></div>
                    <div className="bg-gray-200 h-4 rounded w-1/2"></div>
                  </div>
                ))
              ) : (
                featuredProducts.map((product) => (
                  <MemoizedProductCard key={product.id} product={product} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-[#1F478B] text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">{t("هل أنت صاحب متجر؟", "Are you a store owner?")}</h2>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
              {t(
                "انضم إلى منصتنا وابدأ في بيع منتجاتك لآلاف العملاء",
                "Join our platform and start selling your products to thousands of customers",
              )}
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/auth?role=seller">{t("ابدأ البيع الآن", "Start Selling Now")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
