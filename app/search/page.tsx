"use client"

import { useState, Suspense, useEffect, useCallback, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { ProductCard } from "../../components/product-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Card, CardContent } from "../../components/ui/card"
import Link from "next/link"
import { Star, Package, Store as StoreIcon, MapPin } from "lucide-react"
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
import { imgSrc } from "@/lib/storage/public-url"
import { useUserLocation } from "../../lib/location/user-location"
import { storeDistanceKm, formatDistanceAr, withinKm } from "../../lib/utils/geo"
import type { ProductListItem } from "../../lib/types/product"
import type { StoreListItem } from "../../lib/types/store"

type Coords = { lat: number; lng: number } | null

// إحداثيات متجر المنتج (تصل ضمن حمولة القائمة) — الأساس لفلتر المسافة وترتيب «الأقرب»
function productStoreCoords(product: ProductListItem) {
  return { latitude: product.stores?.latitude ?? null, longitude: product.stores?.longitude ?? null }
}

// الفلاتر الافتراضية: تُطبَّق قبل أن يلمس المستخدم لوحة الفلترة أصلًا، وإلا كانت اللوحة تعلن
// «الأقرب» كترتيب فعّال بينما القائمة غير مرتَّبة بالمسافة إطلاقًا حتى يغيّر المستخدم شيئًا.
//
// وباستعلام، الترتيب الافتراضي «الأكثر صلة» لا «الأقرب»: الخادم صار يرتّب النتائج بالصلة
// (lib/search/catalog-index.ts)، وإعادة ترتيبها بالمسافة على العميل كانت تمحو ذلك الترتيب كلَّه —
// فيهبط الصنف المقصود تحت أصناف لا تمتّ للاستعلام بصلة لمجرّد أن متجرها أقرب. «الأقرب» يبقى
// خيارًا صريحًا في اللوحة، وهو الافتراضي عند التصفّح بلا استعلام حيث لا صلة تُرتَّب بها أصلًا.
const DEFAULT_FILTERS: FilterState = { sortBy: "relevance", priceMin: null, priceMax: null, daysAgo: null, maxKm: null }
const DEFAULT_QUERY_FILTERS: FilterState = { ...DEFAULT_FILTERS, sortBy: "best-match" }

// تطبيق الفلاتر/الترتيب — دالة نقية تُعاد استخدامها عند تغيير الاستعلام أو الفلاتر.
// تُرجع القائمة وعدد ما أسقطه نصف القطر لغياب موقع المتجر (لعرضه للمستخدم بدل اختفاء صامت).
function applyFilters(
  list: ProductListItem[],
  filters: FilterState,
  isRTL: boolean,
  coords: Coords,
): { list: ProductListItem[]; droppedForDistance: number } {
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

  // نصف قطر المسافة: يستبعد المنتجات مجهولة الموقع عمدًا (انظر withinKm) — الواجهة تُعلن ذلك.
  // العدّ يتم بعد باقي الفلاتر لا قبلها، وإلا أعلنّا رقمًا أكبر من الواقع.
  let droppedForDistance = 0
  if (filters.maxKm !== null && filters.maxKm > 0) {
    droppedForDistance = filtered.filter((p) => storeDistanceKm(coords, productStoreCoords(p)) == null).length
    filtered = filtered.filter((p) => withinKm(coords, productStoreCoords(p), filters.maxKm))
  }

  switch (filters.sortBy) {
    case "best-match":
      // ترتيب الخادم بالصلة — يُترك كما وصل عمدًا. أي فرز هنا يهدمه.
      break
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
      // «الأقرب» كان تسمية بلا سلوك: نرتّب فعليًا بالمسافة عند معرفة الموقع، ومجهول
      // الموقع ينزل للأسفل (نفس قاعدة قائمة المتاجر) بدل أن يختفي.
      if (coords) {
        filtered.sort((a, b) => {
          const da = storeDistanceKm(coords, productStoreCoords(a))
          const db = storeDistanceKm(coords, productStoreCoords(b))
          if (da == null && db == null) return 0
          if (da == null) return 1
          if (db == null) return -1
          return da - db
        })
      }
      break
  }

  return { list: filtered, droppedForDistance }
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
  const { coords } = useUserLocation()

  const isRTL = language === "ar"
  // `trim` مقصود: رابط مثل `?q=%20` كان يدخل وضع البحث بعنوان فارغ ولوحة تعلن «الأكثر صلة» بينما
  // الاستعلام بلا كلمات ⇒ القائمة بترتيب Firestore الخام. المسافة البيضاء تصفّحٌ لا بحث.
  const hasQuery = query.trim().length > 0
  const defaultFilters = hasQuery ? DEFAULT_QUERY_FILTERS : DEFAULT_FILTERS

  const requestIdRef = useRef(0)

  const fetchData = useCallback(async () => {
    const requestId = ++requestIdRef.current
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

      // تجاهل نتائج بحث قديم إن بدأ بحث أحدث — منع ظهور نتائج استعلام سابق فوق الحالي (سباق)
      if (requestId !== requestIdRef.current) return

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
      if (requestId !== requestIdRef.current) return
      logError("[search] fetchData", err)
      setError(true)
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [query])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // اشتقاق النتائج المعروضة من المنتجات + الفلاتر الحالية — يُعيد تطبيق الفلاتر تلقائيًا
  // عند تغيّر الاستعلام (كانت الفلاتر تُفقد سابقًا عند كل بحث جديد).
  const [hiddenByDistance, setHiddenByDistance] = useState(0)

  // الانتقال بين التصفّح (بلا استعلام) والبحث يغيّر الترتيب الافتراضي، ولوحة الفلترة تحتفظ بحالتها
  // الداخلية من أول رسم — فنُسقط الفلاتر المطبَّقة عند الانتقال (واللوحة تُعاد تركيبها بمفتاحها
  // أدناه) كي لا تُعلن اللوحة ترتيبًا غير المطبَّق فعلًا على القائمة.
  useEffect(() => {
    setCurrentFilters(null)
  }, [hasQuery])

  useEffect(() => {
    const result = applyFilters(products, currentFilters ?? defaultFilters, isRTL, coords)
    setSortedProducts(result.list)
    setHiddenByDistance(result.droppedForDistance)
  }, [products, currentFilters, defaultFilters, isRTL, coords])

  const handleFilterChange = useCallback((filters: FilterState) => {
    setCurrentFilters(filters)
  }, [])

  // المتاجر (تبويب المتاجر) تخضع لنفس نصف القطر. الترتيب بالمسافة فقط مع الترتيب الافتراضي
  // «الأقرب»: فرضه دائمًا كان يبطل اختيار المستخدم (مثلًا «الأعلى تقييمًا») بلا أن يطلبه.
  const visibleStores = useMemo(() => {
    const maxKm = currentFilters?.maxKm ?? null
    const list = maxKm && maxKm > 0 ? stores.filter((store) => withinKm(coords, store, maxKm)) : stores
    // «الأكثر صلة» ترتيب منتجات لا متاجر: `searchStores` تُصفّي ولا ترتّب بالصلة، فلا شيء تُرتَّب به
    // القائمة هنا. تُعامَل كـ«الأقرب» لأن البديل حالتان افتراضيتان متناقضتان على نفس الشاشة —
    // قبل لمس اللوحة تُرتَّب المتاجر بالمسافة، وبعد «إعادة التعيين» تتوقّف بلا سبب ظاهر للمستخدم.
    const effectiveSort = currentFilters?.sortBy ?? defaultFilters.sortBy
    const sortByNearest = effectiveSort === "relevance" || effectiveSort === "best-match"
    if (!coords || !sortByNearest) return list
    return [...list].sort((a, b) => {
      const da = storeDistanceKm(coords, a)
      const db = storeDistanceKm(coords, b)
      if (da == null && db == null) return 0
      if (da == null) return 1
      if (db == null) return -1
      return da - db
    })
  }, [stores, currentFilters?.maxKm, currentFilters?.sortBy, defaultFilters.sortBy, coords])

  const renderProductsGrid = () =>
    sortedProducts.length > 0 ? (
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 ${isRTL ? "text-right" : "text-left"}`}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {sortedProducts.map((product) => (
          <ProductCard key={product.id} product={product} showActions />
        ))}
      </div>
    ) : (
      <EmptyState
        icon={Package}
        title={t("لم يتم العثور على منتجات", "No products found")}
        description={
          hiddenByDistance > 0
            ? t(
              `لا توجد منتجات داخل النطاق المحدد. ${hiddenByDistance} منتجًا لم يظهر لأن متجره لم يحدّد موقعه.`,
              `No products within the selected radius. ${hiddenByDistance} products are hidden because their store has no location.`,
            )
            : undefined
        }
      />
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
                {t(`تم العثور على ${sortedProducts.length} منتج و ${visibleStores.length} متجر`, `Found ${sortedProducts.length} products and ${visibleStores.length} stores`)}
              </p>
            )}
            {currentFilters?.maxKm && coords && (
              <p className="text-sm text-primary font-medium mt-1">
                {t(`ضمن ${currentFilters.maxKm} كم من موقعك`, `Within ${currentFilters.maxKm} km of you`)}
                {hiddenByDistance > 0 &&
                  t(
                    ` — ${hiddenByDistance} منتجًا مخفي لأن متجره لم يحدّد موقعه`,
                    ` — ${hiddenByDistance} products hidden (store has no location)`,
                  )}
              </p>
            )}
          </div>

          <div className={`mb-8 flex gap-4 ${isRTL ? "justify-start" : "justify-start"} w-full`}>
            <div className={`flex ${isRTL ? "flex-col-reverse" : "flex-col"} md:flex-row gap-4 w-full md:w-4/5 lg:w-3/5 ${isRTL ? "ml-auto" : "mr-auto"}`}>
              {isRTL && <div className="w-full md:w-auto"><FilterSort key={hasQuery ? "q" : "all"} initialSort={defaultFilters.sortBy} onFilterChange={handleFilterChange} /></div>}

              <div className="flex-1 w-full">
                <SearchBar placeholder={t("ابحث عن منتجات، متاجر...", "Search for products, stores...")} initialValue={query} />
              </div>

              {!isRTL && <div className="w-full md:w-auto"><FilterSort key={hasQuery ? "q" : "all"} initialSort={defaultFilters.sortBy} onFilterChange={handleFilterChange} /></div>}
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
                  {t("المتاجر", "Stores")} ({visibleStores.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products">{renderProductsGrid()}</TabsContent>

              <TabsContent value="stores">
                {visibleStores.length > 0 ? (
                  <div
                    className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isRTL ? "text-right" : "text-left"}`}
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    {visibleStores.map((store) => (
                      <Link key={store.id} href={`/store/${store.id}`}>
                        <Card className="hover:shadow-lg transition-all duration-300 h-full overflow-hidden border border-border bg-card shadow-sm rounded-2xl hover:-translate-y-1 group">
                          <div className="relative h-48 bg-muted overflow-hidden">
                            <Image
                              src={imgSrc(store.image_url)}
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
                              {storeDistanceKm(coords, store) != null && (
                                <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl">
                                  <MapPin className="h-4 w-4" />
                                  <span className="font-bold text-sm">{formatDistanceAr(storeDistanceKm(coords, store)!)}</span>
                                </div>
                              )}
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
