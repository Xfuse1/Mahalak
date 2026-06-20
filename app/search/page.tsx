"use client"

import { useState, Suspense, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { ProductCard } from "../../components/product-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Card, CardContent } from "../../components/ui/card"
import Link from "next/link"
import { Star } from "lucide-react"
import { SearchBar } from "../../components/search-bar"
import { FilterSort, type FilterState } from "../../components/filter-sort"
import { BackButton } from "../../components/back-button"
import { useLanguage } from "../../lib/language-context"
import Image from "next/image"
import { searchProducts, getProducts } from "../../lib/actions/products"
import { searchStores, getStores } from "../../lib/actions/stores"
import type { ProductListItem } from "../../lib/types/product"
import type { StoreListItem } from "../../lib/types/store"

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [activeTab, setActiveTab] = useState("products")
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [sortedProducts, setSortedProducts] = useState<ProductListItem[]>([])
  const [loading, setLoading] = useState(true)
  const { language, t } = useLanguage()

  const isRTL = language === "ar"

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let productsData: any[] = [], storesData: any[] = []

        if (!query) {
          // No query - fetch all products only
          productsData = await getProducts()
          storesData = []
        } else {
          // Query exists - search for matching products and stores
          ;[productsData, storesData] = await Promise.all([searchProducts(query), searchStores(query)])
        }

        // Transform products to match the expected format
        const transformedProducts = productsData.map((product: any) => ({
          ...product,
          image: product.image_url, // Map image_url to image for ProductCard component
          storeName: product.stores?.name || "",
          createdAt: product.created_at,
          updatedAt: product.updated_at || product.created_at,
        }))

        setProducts(transformedProducts)
        setSortedProducts(transformedProducts)
        setStores(storesData)
      } catch (error) {
        // Error handled silently - page shows empty results
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [query])

  const handleFilterChange = useCallback(
    (filters: FilterState) => {
      let filtered = [...products]

      // فلترة حسب السعر
      if (filters.priceMin !== null) {
        filtered = filtered.filter((p) => p.price >= filters.priceMin!)
      }
      if (filters.priceMax !== null) {
        filtered = filtered.filter((p) => p.price <= filters.priceMax!)
      }

      // فلترة حسب تاريخ التحديث
      if (filters.daysAgo !== null && filters.daysAgo > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - filters.daysAgo)
        filtered = filtered.filter((p) => {
          const date = new Date(p.updatedAt || p.createdAt || 0)
          return date >= cutoff
        })
      }

      // ترتيب النتائج
      switch (filters.sortBy) {
        case "price-asc":
          filtered.sort((a, b) => a.price - b.price)
          break
        case "price-desc":
          filtered.sort((a, b) => b.price - a.price)
          break
        case "rating":
          filtered.sort((a, b) => b.rating - a.rating)
          break
        case "newest":
          filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
          break
        case "name-asc":
          filtered.sort((a, b) => a.name.localeCompare(b.name, isRTL ? "ar" : "en"))
          break
        case "name-desc":
          filtered.sort((a, b) => b.name.localeCompare(a.name, isRTL ? "ar" : "en"))
          break
        default:
          break
      }

      setSortedProducts(filtered)
    },
    [products, isRTL],
  )

  const renderProductsGrid = () =>
    sortedProducts.length > 0 ? (
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 ${isRTL ? "text-right" : "text-left"}`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    ) : (
      <div className={`text-center py-12 ${isRTL ? "text-right" : "text-left"}`}>
        <p className="text-gray-500 text-lg">{t("لم يتم العثور على منتجات", "No products found")}</p>
      </div>
    )

  return (
    <div className="min-h-screen flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Header />

      <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <BackButton />

          <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {query
                ? `${t("نتائج البحث عن:", "Search results for:")} `
                : t("جميع المنتجات", "All Products")}
              {query && <span className="text-blue-600">{query}</span>}
            </h1>
            {query && (
              <p className="text-gray-500 mt-2">
                {t(`تم العثور على ${sortedProducts.length} منتج و ${stores.length} متجر`, `Found ${sortedProducts.length} products and ${stores.length} stores`)}
              </p>
            )}
          </div>

          <div className={`mb-8 flex gap-4 ${isRTL ? "justify-start" : "justify-start"} w-full`}>
            <div className={`flex ${isRTL ? "flex-col-reverse" : "flex-col"} md:flex-row gap-4 w-full md:w-4/5 lg:w-3/5 ${isRTL ? "ml-auto" : "mr-auto"}`}>
              {isRTL && <div className="w-full md:w-auto"><FilterSort onFilterChange={handleFilterChange} /></div>}

              <div className="flex-1 w-full">
                <SearchBar placeholder={t("ابحث عن منتجات، متاجر...", "Search for products, stores...")} />
              </div>

              {!isRTL && <div className="w-full md:w-auto"><FilterSort onFilterChange={handleFilterChange} /></div>}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          ) : query ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`mb-8 w-auto ${isRTL ? "ml-auto" : "mr-auto"} flex gap-2 bg-white shadow-lg rounded-2xl p-2 border-0`}>
                <TabsTrigger
                  value="products"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all"
                >
                  {t("المنتجات", "Products")} ({sortedProducts.length})
                </TabsTrigger>
                <TabsTrigger
                  value="stores"
                  className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-lg px-6 py-3 transition-all"
                >
                  {t("المتاجر", "Stores")} ({stores.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products">{renderProductsGrid()}</TabsContent>

              <TabsContent value="stores">
                {stores.length > 0 ? (
                  <div
                    className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isRTL ? "text-right" : "text-left"}`}
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    {stores.map((store) => (
                      <Link key={store.id} href={`/store/${store.id}`}>
                        <Card className="hover:shadow-2xl transition-all duration-300 h-full overflow-hidden border-0 shadow-lg rounded-2xl hover:-translate-y-2 group">
                          <div className="relative h-48 bg-gray-100 overflow-hidden">
                            <Image
                              src={store.image_url || "/placeholder.svg"}
                              alt={store.name}
                              fill
                              loading="lazy"
                              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <CardContent className="p-6">
                            <h3 className="text-xl font-bold mb-2 text-gray-800">{store.name}</h3>
                            <p className="text-gray-500 mb-4 line-clamp-2 leading-relaxed">{store.description}</p>
                            <div
                              className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse justify-end" : "justify-start"}`}
                            >
                              <div className={`flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl ${isRTL ? "flex-row-reverse" : ""}`}>
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                <span className="font-bold text-amber-700">{store.rating || 0}</span>
                              </div>
                            </div>
                            <div className={isRTL ? "text-right" : "text-left"}>
                              <span className="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-1.5 rounded-xl text-sm font-medium text-blue-700 border border-blue-100">
                                {store.category}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-16 ${isRTL ? "text-right" : "text-left"}`}>
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <Star className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-lg">{t("لم يتم العثور على متاجر", "No stores found")}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            renderProductsGrid()
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
