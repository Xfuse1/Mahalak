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
import { Package, Store, Monitor, ShoppingCart } from "lucide-react"
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
        <section className="py-10 bg-gradient-to-b from-white to-gray-50 border-b">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("ابحث عن أي شيء", "Search for anything")}</h2>
                <p className="text-gray-500">{t("آلاف المنتجات والمتاجر في انتظارك", "Thousands of products and stores await you")}</p>
              </div>
              <SearchBar
                placeholder={t("ابحث عن منتجات أو متاجر...", "Search for products or stores...")}
                className="mb-4"
              />
            </div>
          </div>
        </section>

        {/* Categories Section - Centered */}
        <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("تصفح حسب الفئة", "Browse by Category")}</h2>
              <p className="text-gray-500 text-lg">{t("اختر الفئة التي تناسبك", "Choose the category that suits you")}</p>
            </div>

            <div className="overflow-x-auto pb-4 mb-10 scrollbar-hide">
              <div className="flex gap-4 justify-center min-w-max px-2">
                <Link
                  href="/category/بقالة"
                  className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-emerald-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    🛒
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("بقالة", "Grocery")}</p>
                </Link>
                <Link
                  href="/category/صحة"
                  className="bg-gradient-to-br from-rose-400 to-rose-600 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-rose-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    💊
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("صحة", "Health")}</p>
                </Link>
                <Link
                  href="/category/ملابس"
                  className="bg-gradient-to-br from-violet-400 to-violet-600 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-violet-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    👕
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("ملابس", "Clothing")}</p>
                </Link>
                <Link
                  href="/category/إلكترونيات"
                  className="bg-gradient-to-br from-blue-400 to-blue-600 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    📱
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("إلكترونيات", "Electronics")}</p>
                </Link>
                <Link
                  href="/category/أغذية"
                  className="bg-gradient-to-br from-amber-400 to-orange-500 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-orange-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    🍔
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("أغذية", "Food")}</p>
                </Link>
                <Link
                  href="/category/أثاث"
                  className="bg-gradient-to-br from-amber-600 to-amber-800 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-amber-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    🪑
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("أثاث", "Furniture")}</p>
                </Link>
                <Link
                  href="/category/خدمات أخرى"
                  className="bg-gradient-to-br from-slate-500 to-slate-700 text-white p-6 rounded-2xl text-center hover:shadow-2xl hover:shadow-slate-500/30 transition-all transform hover:scale-105 hover:-translate-y-1 min-w-[140px] group"
                >
                  <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    ⚡
                  </div>
                  <p className="font-bold text-lg whitespace-nowrap">{t("أخرى", "Other Services")}</p>
                </Link>
              </div>
            </div>

            {/* Large Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <Link
                href="/search"
                className="relative bg-gradient-to-br from-[#1e3a5f] via-[#2563eb] to-[#3b82f6] text-white p-8 rounded-2xl hover:shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:scale-[1.02] hover:-translate-y-1 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
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
                className="relative bg-gradient-to-br from-[#2563eb] via-[#3b82f6] to-[#60a5fa] text-white p-8 rounded-2xl hover:shadow-2xl hover:shadow-blue-500/30 transition-all transform hover:scale-[1.02] hover:-translate-y-1 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
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

        {/* Featured Stores */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("متاجر مميزة", "Featured Stores")}</h2>
                <p className="text-gray-500 mt-2">{t("اكتشف أفضل المتاجر", "Discover the best stores")}</p>
              </div>
              <Button variant="outline" asChild className="rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all">
                <Link href="/store">{t("عرض الكل", "View All")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-48 rounded-2xl mb-4"></div>
                    <div className="bg-gray-200 h-4 rounded-xl w-3/4 mb-2"></div>
                    <div className="bg-gray-200 h-4 rounded-xl w-1/2"></div>
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
        <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("منتجات مميزة", "Featured Products")}</h2>
                <p className="text-gray-500 mt-2">{t("أفضل المنتجات المتاحة", "Best available products")}</p>
              </div>
              <Button variant="outline" asChild className="rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all">
                <Link href="/search">{t("عرض الكل", "View All")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-48 rounded-2xl mb-4"></div>
                    <div className="bg-gray-200 h-4 rounded-xl w-3/4 mb-2"></div>
                    <div className="bg-gray-200 h-4 rounded-xl w-1/2"></div>
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
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#1e40af]"></div>
          <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-5"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"></div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 text-sm mb-6">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                {t("انضم إلينا الآن", "Join us now")}
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-white">{t("هل أنت صاحب متجر؟", "Are you a store owner?")}</h2>
              <p className="text-xl mb-10 text-white/80 max-w-2xl mx-auto leading-relaxed">
                {t(
                  "انضم إلى منصتنا وابدأ في بيع منتجاتك لآلاف العملاء",
                  "Join our platform and start selling your products to thousands of customers",
                )}
              </p>
              <Button size="lg" asChild className="bg-white text-blue-900 hover:bg-gray-100 font-bold px-10 py-7 text-lg rounded-2xl shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all">
                <Link href="/auth?role=seller">{t("ابدأ البيع الآن", "Start Selling Now")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
