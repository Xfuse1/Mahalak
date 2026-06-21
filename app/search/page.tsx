"use client"

import { useState, Suspense, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { ProductCard } from "../../components/product-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Card, CardContent } from "../../components/ui/card"
import Link from "next/link"
import { Star, Package, Store as StoreIcon } from "lucide-react"
import { SearchBar } from "../../components/search-bar"
import { SkeletonGrid } from "../../components/ui/skeleton-grid"
import { EmptyState } from "../../components/ui/empty-state"
import { ErrorState } from "../../components/ui/error-state"
import { Spinner } from "../../components/ui/spinner"
import { logError } from "../../lib/logger"
import { FilterSort, type FilterState } from "../../components/filter-sort"
import { BackButton } from "../../components/back-button"
import { useLanguage } from "../../lib/language-context"
import Image from "next/image"
import { searchProducts, getProducts } from "../../lib/actions/products"
import { searchStores, getStores } from "../../lib/actions/stores"
import type { ProductListItem } from "../../lib/types/product"
import type { StoreListItem } from "../../lib/types/store"

// تطبيق الفلاتر/الترتيب — دالة نقية تُعاد استخدامها عند تغيير الاستعلام أو الفلاتر
function applyFilters(list: ProductListItem[], filters: FilterState, isRTL: boolean): ProductListItem[] {
  let filtered = [...list]

  if (filters.priceMin !== null) {
    filtered = filtered.filter((p) => p.price >= filters.priceMin!)
  }
  if (filters.priceMax !== null) {
    filtered = filtered.filter((p) => p.price <= filters.priceMax!)
  }

  if (filters.daysAgo !== null && filters.daysAgo > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filters.daysAgo)
    filtered = filtered.filter((p) => {
      const date = new Date(p.updatedAt || p.createdAt || 0)
      return date >= cutoff
    })
  }

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

  return filtered
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [activeTab, setActiveTab] = useState("products")
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [sortedProducts, setSortedProducts] = useState<ProductListItem[]>([])
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { language, t } = useLanguage()

  const isRTL = language === "ar"

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
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
      setStores(storesData)
    } catch (err) {
      logError("[search] fetchData", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // اشتقاق النتائج المعروضة من المنتجات + الفلاتر الحالية — يُعيد تطبيق الفلاتر تلقائيًا
  // عند تغيّر الاستعلام (كانت الفلاتر تُفقد سابقًا عند كل بحث جديد).
  useEffect(() => {
    setSortedProducts(currentFilters ? applyFilters(products, currentFilters, isRTL) : products)
  }, [products, currentFilters, isRTL])

  const handleFilterChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters)
  }, [])

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
      <EmptyState icon={Package} title={t("لم يتم العثور على منتجات", "No products found")} />
    )

  return (
    <div className="min-h-screen flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Header />

      <main className="flex-1 py-8 bg-secondary/20">
        <div className="container mx-auto px-4">
          <BackButton />

          <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
              {query
                ? `${t("نتائج البحث عن:", "Search results for:")} `
                : t("جميع المنتجات", "All Products")}
              {query && <span className="text-primary">{query}</span>}
            </h1>
            {query && (
              <p className="text-muted-foreground mt-2">
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
            <SkeletonGrid variant="product" />
          ) : error ? (
            <ErrorState
              description={t("تعذّر تحميل النتائج. حاول مرة أخرى.", "Failed to load results. Please try again.")}
              onRetry={fetchData}
            />
          ) : query ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`mb-8 w-auto ${isRTL ? "ml-auto" : "mr-auto"} flex gap-2 bg-white shadow-lg rounded-2xl p-2 border-0`}>
                <TabsTrigger
                  value="products"
                  className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg px-6 py-3 transition-all"
                >
                  {t("المنتجات", "Products")} ({sortedProducts.length})
                </TabsTrigger>
                <TabsTrigger
                  value="stores"
                  className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg px-6 py-3 transition-all"
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
                        <Card className="hover:shadow-lg transition-all duration-300 h-full overflow-hidden border border-border bg-card shadow-sm rounded-2xl hover:-translate-y-1 group">
                          <div className="relative h-48 bg-muted overflow-hidden">
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
                            <h3 className="text-xl font-bold mb-2 text-foreground">{store.name}</h3>
                            <p className="text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{store.description}</p>
                            <div
                              className={`flex items-center gap-2 mb-4 ${isRTL ? "flex-row-reverse justify-end" : "justify-start"}`}
                            >
                              <div className={`flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl ${isRTL ? "flex-row-reverse" : ""}`}>
                                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                <span className="font-bold text-amber-700">{store.rating || 0}</span>
                              </div>
                            </div>
                            <div className={isRTL ? "text-right" : "text-left"}>
                              <span className="inline-block bg-primary/10 px-4 py-1.5 rounded-xl text-sm font-medium text-primary border border-primary/20">
                                {store.category}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={StoreIcon} title={t("لم يتم العثور على متاجر", "No stores found")} />
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
          <Spinner size="lg" label="جاري التحميل…" className="flex-col" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
