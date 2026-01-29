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
import { FilterSort } from "../../components/filter-sort"
import { BackButton } from "../../components/back-button"
import { useLanguage } from "../../lib/language-context"
import Image from "next/image"
import { searchProducts, getProducts } from "../../lib/actions/products"
import { searchStores, getStores } from "../../lib/actions/stores"

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [activeTab, setActiveTab] = useState("products")
  const [products, setProducts] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [sortedProducts, setSortedProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { language, t } = useLanguage()

  const isRTL = language === "ar"

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let productsData, storesData

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
        }))

        setProducts(transformedProducts)
        setSortedProducts(transformedProducts)
        setStores(storesData)
      } catch (error) {
        console.error("[v0] Error fetching search results:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [query])

  const handleFilterChange = useCallback(
    (filters: { sortBy: string }) => {
      const sorted = [...products]

      switch (filters.sortBy) {
        case "price-asc":
          sorted.sort((a, b) => a.price - b.price)
          break
        case "price-desc":
          sorted.sort((a, b) => b.price - a.price)
          break
        case "rating":
          sorted.sort((a, b) => b.rating - a.rating)
          break
        case "newest":
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          break
        case "name-asc":
          sorted.sort((a, b) => a.name.localeCompare(b.name, isRTL ? "ar" : "en"))
          break
        case "name-desc":
          sorted.sort((a, b) => b.name.localeCompare(a.name, isRTL ? "ar" : "en"))
          break
        default:
          break
      }

      setSortedProducts(sorted)
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

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <h1 className={`text-3xl font-bold mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {query
              ? `${t("نتائج البحث عن:", "Search results for:")} `
              : t("جميع المنتجات", "All Products")}
            {query && <span className="text-[#1F478B]">{query}</span>}
          </h1>

          <div className={`mb-6 flex gap-4 ${isRTL ? "justify-start" : "justify-start"} w-full`}>
            <div className={`flex ${isRTL ? "flex-col-reverse" : "flex-col"} md:flex-row gap-4 w-full md:w-4/5 lg:w-3/5 ${isRTL ? "ml-auto" : "mr-auto"}`}>
              {isRTL && <div className="w-full md:w-auto"><FilterSort onFilterChange={handleFilterChange} /></div>}

              <div className="flex-1 w-full">
                <SearchBar placeholder={t("ابحث عن منتجات، متاجر...", "Search for products, stores...")} />
              </div>

              {!isRTL && <div className="w-full md:w-auto"><FilterSort onFilterChange={handleFilterChange} /></div>}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F478B] mx-auto"></div>
              <p className="mt-4 text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          ) : query ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`mb-6 w-auto ${isRTL ? "ml-auto" : "mr-auto"} flex gap-2`}>
                <TabsTrigger
                  value="products"
                  className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white border-2 border-gray-300 data-[state=active]:border-[#1F478B] transition-all rounded-lg px-4 py-2 text-sm h-auto"
                >
                  {t("المنتجات", "Products")} ({sortedProducts.length})
                </TabsTrigger>
                <TabsTrigger
                  value="stores"
                  className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white border-2 border-gray-300 data-[state=active]:border-[#1F478B] transition-all rounded-lg px-4 py-2 text-sm h-auto"
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
                        <Card className="hover:shadow-lg transition-shadow h-full overflow-hidden border-2 border-gray-200 hover:border-[#1F478B] hover:border-opacity-50">
                          <div className="relative h-48 bg-gray-100">
                            <Image
                              src={store.image_url || "/placeholder.svg"}
                              alt={store.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <CardContent className="p-6">
                            <h3 className="text-xl font-bold mb-2">{store.name}</h3>
                            <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">{store.description}</p>
                            <div
                              className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse justify-end" : "justify-start"}`}
                            >
                              <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{store.rating || 0}</span>
                              </div>
                            </div>
                            <div className={isRTL ? "text-right" : "text-left"}>
                              <span className="inline-block bg-secondary px-3 py-1 rounded-full text-sm font-medium border border-gray-300">
                                {store.category}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-12 ${isRTL ? "text-right" : "text-left"}`}>
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1F478B] mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
