"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { StoreCard } from "@/components/store-card"
import { BannerCarousel } from "@/components/banner-carousel"
import { SearchBar } from "@/components/search-bar"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"
import { Package, Store } from "lucide-react"
import { useEffect, useState } from "react"
import { getProducts } from "@/lib/actions/products"
import { getStores } from "@/lib/actions/stores"

export default function Home() {
  const { t } = useLanguage()
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [featuredStores, setFeaturedStores] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const allProducts = await getProducts()
      const allStores = await getStores()
      setFeaturedProducts(allProducts.slice(0, 6))
      setFeaturedStores(allStores.slice(0, 4))
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
              <SearchBar placeholder={t("searchPlaceholder")} className="mb-4" />
            </div>
          </div>
        </section>

        {/* Categories Section - Centered */}
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8 text-center">{t("browseByCategory")}</h2>

            <div className="overflow-x-auto pb-4 mb-8">
              <div className="flex gap-4 justify-center min-w-max px-2">
                <Link
                  href="/category/بقالة"
                  className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("grocery")}</p>
                </Link>
                <Link
                  href="/category/صحة"
                  className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("health")}</p>
                </Link>
                <Link
                  href="/category/ملابس"
                  className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("clothing")}</p>
                </Link>
                <Link
                  href="/category/إلكترونيات"
                  className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("electronics")}</p>
                </Link>
                <Link
                  href="/category/أغذية"
                  className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("food")}</p>
                </Link>
                <Link
                  href="/category/أثاث"
                  className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("furniture")}</p>
                </Link>
                <Link
                  href="/category/خدمات أخرى"
                  className="bg-gradient-to-br from-gray-600 to-gray-700 text-white p-6 rounded-lg text-center hover:shadow-lg transition-all transform hover:scale-105 min-w-[140px]"
                >
                  <p className="font-bold text-lg whitespace-nowrap">{t("otherServices")}</p>
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
                    <h3 className="text-2xl font-bold mb-1">{t("allProducts")}</h3>
                    <p className="text-white/90">{t("browseAllProducts")}</p>
                  </div>
                </div>
              </Link>
              <Link
                href="/stores"
                className="bg-gradient-to-br from-[#2d5ba8] to-[#3a6bc5] text-white p-8 rounded-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <Store className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{t("allStores")}</h3>
                    <p className="text-white/90">{t("discoverLocalStores")}</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">{t("featuredStores")}</h2>
              <Button variant="outline" asChild>
                <Link href="/stores">{t("viewAll")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredStores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-12 bg-secondary">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">{t("featuredProducts")}</h2>
              <Button variant="outline" asChild>
                <Link href="/search">{t("viewAll")}</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-[#1F478B] text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">{t("areYouStoreOwner")}</h2>
            <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">{t("joinPlatform")}</p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/auth?role=seller">{t("startSellingNow")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
