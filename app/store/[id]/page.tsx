"use client"
import React from "react"
import { Header } from "../../../components/header"
import { Footer } from "../../../components/footer"
import { ProductCard } from "../../../components/product-card"
import { BackButton } from "../../../components/back-button"
import { ShareButton } from "../../../components/share-button"
import { Star, MapPin, Phone, MessageCircle, FileText, Tag, Package, SearchX, Flame, Sparkles, Clock, LayoutGrid } from "lucide-react"
import { notFound, useRouter } from "next/navigation"
import { SearchBar } from "../../../components/search-bar"
import { searchTokens } from "../../../lib/utils/arabic"
import { normalizeArabic } from "../../../lib/utils/arabic"
import { Button } from "../../../components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../../components/ui/sheet"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { getStore } from "../../../lib/actions/stores"
import { getProductsByStoreId, getStoreTopSellers } from "../../../lib/actions/products"
import { trackMetaEvent } from "../../../lib/utils"
import { getUserStoreReview, upsertStoreReview } from "../../../lib/actions/storeReviews"
import { getStoreOffers } from "../../../lib/actions/offers"
import { imgSrc } from "../../../lib/storage/public-url"
import { EmptyState } from "../../../components/ui/empty-state"
import { Spinner } from "../../../components/ui/spinner"
import { useToast } from "@/components/ui/toast"

type Store = {
  id: string
  name: string
  description: string
  rating: number
  category: string
  phone: string
  address: string
  image_url?: string
  return_policy?: string
}

type Product = {
  id: string
  name: string
  description: string
  price: number
  category: string
  stock: number
  image: string
  image_url?: string | null
  store_id: string
  rating: number
  rating_count?: number
  discount_percentage?: number
  created_at?: string
  storeName: string
  storeId: string
  reviewCount: number
}

// أقصى عدد بطاقات في القسم الواحد — الأقسام نافذة سريعة لا شبكة كاملة
const SECTION_SIZE = 8
// دفعة العرض في الشبكة الكاملة: متاجر الاستيراد تتجاوز 1500 صنف، ورسمها دفعة واحدة يُجمّد الهاتف
const PAGE_SIZE = 24

type Offer = {
  id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
}

export default function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth()
  const router = useRouter()
  const { t, language } = useLanguage()
  const toast = useToast()

  const { id } = React.use(params)
  const isRTL = language === "ar"

  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [topSellerIds, setTopSellerIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [userStoreReview, setUserStoreReview] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [isPolicySheetOpen, setIsPolicySheetOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const storeData = (await getStore(id)) as Store | null

        if (!storeData) {
          setLoading(false)
          return
        }

        setStore(storeData)

        // Fetch offers and products in parallel, handling individual failures
        const [offersData, productsData, topSellers] = await Promise.all([
          getStoreOffers(id).catch((err) => {
            console.error("[debug] Error fetching store offers:", err)
            return []
          }),
          getProductsByStoreId(id).catch((err) => {
            console.error("[debug] Error fetching store products:", err)
            return []
          }),
          // قسم «الأكثر مبيعًا» تحسين لا شرط عرض — فشله يُخفي القسم ولا يُسقط الصفحة
          getStoreTopSellers(id).catch(() => [] as string[]),
        ])

        setTopSellerIds(topSellers)

        const now = new Date()
        const activeOffers = offersData.filter((offer: any) => {
          // end_date شامل لليوم الأخير (نهاية اليوم) وبداية اليوم لـ start_date
          const startDate = new Date(offer.start_date + "T00:00:00.000Z")
          const endDate = new Date(offer.end_date + "T23:59:59.999Z")
          return startDate <= now && endDate >= now
        })
        setOffers(activeOffers as Offer[])

        const transformedProducts = productsData.map((product: any) => ({
          ...product,
          image: typeof product.image_url === "string" && product.image_url ? product.image_url : "/placeholder.svg",
          storeName: storeData.name,
          storeId: storeData.id,
          reviewCount: product.reviewCount || 0,
        }))
        setProducts(transformedProducts)
        setLoading(false)
      } catch (error) {
        setLoading(false)
        setStore(null)
      }
    }

    fetchData()
  }, [id])

  useEffect(() => {
    if (!store) return
    try {
      trackMetaEvent("PageView")
      trackMetaEvent("ViewContent", {
        content_type: "store",
        storeId: store.id,
        storeName: store.name,
      })
    } catch (e) {
      // ignore tracking errors
    }
    // نعتمد على معرّف المتجر الثابت بدل كائن store كاملًا — كان تغيّر مرجعه (مثلًا بعد تقييم)
    // يعيد إطلاق PageView/ViewContent فيضخّم عدّادات Meta Pixel.
  }, [store?.id])

  useEffect(() => {
    if (!store || !user) return
    let mounted = true

      ; (async () => {
        try {
          const existing = (await getUserStoreReview(store.id, user.id)) as { rating: number } | null
          if (!mounted) return
          if (existing && typeof existing.rating === "number") {
            setUserStoreReview(existing.rating)
          } else {
            setUserStoreReview(null)
          }
        } catch (err) {
          // Silently handle review fetch error
        }
      })()

    return () => {
      mounted = false
    }
  }, [store, user])

  // ═══ البحث والتقسيم داخل المتجر ═══
  // كل الخطّافات تُعلَن قبل أي return مبكّر (تحميل/notFound) وإلا اختلف عددها بين الرسمات.

  // فهرس بحث مُطبَّع يُحسب مرة لكل قائمة منتجات: متجر الصيدلية يحمل آلاف الأصناف، وتطبيع
  // النص داخل الفلتر كان سيعيد تطبيع كل اسم مع كل ضغطة مفتاح.
  const searchIndex = useMemo(
    () =>
      products.map((product) => ({
        product,
        blob: normalizeArabic(`${product.name} ${product.description || ""} ${product.category || ""}`),
      })),
    [products],
  )

  const tokens = useMemo(() => searchTokens(query), [query])

  // فئات المتجر (تقسيم داخلي) — تظهر فقط عند وجود فئتين فأكثر، وإلا فالشريط زينة بلا فائدة
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach((product) => {
      const name = (product.category || "").trim()
      if (!name) return
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [products])

  const visibleProducts = useMemo(() => {
    let list = searchIndex
    if (activeCategory !== "all") {
      list = list.filter(({ product }) => (product.category || "").trim() === activeCategory)
    }
    if (tokens.length) {
      list = list.filter(({ blob }) => tokens.every((token) => blob.includes(token)))
    }
    return list.map(({ product }) => product)
  }, [searchIndex, tokens, activeCategory])

  // ترقيم تدريجي للشبكة الكاملة. نُصفّره وقت الرسم عند تغيّر البحث/الفئة بدل setState داخل
  // effect (يمنع الرسمات المتتالية ويُبقي فحص الـlint نظيفًا).
  const filterKey = `${activeCategory}::${query}`
  const [pager, setPager] = useState({ key: filterKey, count: PAGE_SIZE })
  const visibleCount = pager.key === filterKey ? pager.count : PAGE_SIZE

  // أقسام العرض السريع — تُبنى من نفس القائمة المحمَّلة (بلا أي قراءة إضافية) عدا «الأكثر مبيعًا»
  const sections = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]))

    const topSelling = topSellerIds
      .map((productId) => byId.get(productId))
      .filter((product): product is Product => Boolean(product))
      .slice(0, SECTION_SIZE)

    const discounted = products
      .filter((product) => Number(product.discount_percentage || 0) > 0)
      .sort((a, b) => Number(b.discount_percentage || 0) - Number(a.discount_percentage || 0))
      .slice(0, SECTION_SIZE)

    // «الأعلى تقييمًا» مشروط بوجود تقييمات فعلية: كل منتج يُنشأ بـ rating_count = 0، فبدون
    // الشرط يعرض القسم شريحة عشوائية من منتجات بلا تقييم ويبدو معطوبًا.
    const topRated = products
      .filter((product) => Number(product.rating_count || 0) > 0 && Number(product.rating || 0) > 0)
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.rating_count || 0) - Number(a.rating_count || 0))
      .slice(0, SECTION_SIZE)

    // «وصل حديثًا» بلا معنى لكتالوج مستورَد دفعة واحدة (كل الأصناف بنفس created_at) — نُخفيه حينها
    const dated = products.filter((product) => Boolean(product.created_at))
    const newest = [...dated]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, SECTION_SIZE)
    const newestIsMeaningful =
      newest.length > 1 && new Set(dated.map((product) => String(product.created_at))).size > 1

    // العناوين تُترجَم وقت الرسم لا هنا: مرجع t يتغيّر مع كل رسمة للسياق فكان يُبطل الذاكرة
    // ويعيد فرز آلاف الأصناف بلا داعٍ.
    return [
      { key: "top", icon: Flame, items: topSelling },
      { key: "offers", icon: Tag, items: discounted },
      { key: "rated", icon: Sparkles, items: topRated },
      { key: "new", icon: Clock, items: newestIsMeaningful ? newest : [] },
    ].filter((section) => section.items.length > 0)
  }, [products, topSellerIds])

  const sectionTitles: Record<string, string> = {
    top: t("الأكثر مبيعًا", "Best sellers"),
    offers: t("عروض وخصومات", "Deals & discounts"),
    rated: t("الأعلى تقييمًا", "Top rated"),
    new: t("وصل حديثًا", "New arrivals"),
  }

  // الأقسام نافذة تصفّح سريعة: تُخفى فور بدء البحث أو اختيار فئة كي لا تُشوّش على النتائج
  const isBrowsingAll = activeCategory === "all" && tokens.length === 0

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" label={t("جاري التحميل...", "Loading...")} className="flex-col" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!store) {
    notFound()
  }

  const handleWhatsApp = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    const message = t(`مرحباً، أريد الاستفسار عن ${store.name}`, `Hello, I want to inquire about ${store.name}`)
    const formatPhoneForWhatsApp = (raw: string) => {
      if (!raw) return ""
      let digits = raw.replace(/\D/g, "")

      // remove international 00 prefix
      if (digits.startsWith("00")) digits = digits.slice(2)

      // If number starts with leading 0 (local format) assume Egypt (+20) as a sensible default
      // and convert: 01012345678 -> 201012345678
      if (digits.startsWith("0")) {
        digits = `20${digits.slice(1)}`
      }

      // If number already starts with country code like 20, 966, etc, keep as-is
      return digits
    }

    const phoneNumber = formatPhoneForWhatsApp(store.phone)
    try {
      trackMetaEvent("Contact", { method: "whatsapp", storeId: store?.id, storeName: store?.name })
    } catch (e) {
      // ignore tracking errors
    }
    if (!phoneNumber || phoneNumber.length < 8) {
      // show a simple alert when phone number looks invalid for wa.me
      // you can replace with a nicer UI notification if desired
      toast.error(t("رقم الهاتف غير صالح لفتح واتساب. الرجاء تحديث رقم الواتساب في إعدادات المتجر.", "Phone number invalid for WhatsApp. Please update the store WhatsApp number in settings."))
      return
    }

    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleCall = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    try {
      trackMetaEvent("Contact", { method: "call", storeId: store?.id, storeName: store?.name })
    } catch (e) {
      // ignore tracking errors
    }
    window.location.href = `tel:${store.phone}`
  }

  // أبرز عرض نشط (أعلى نسبة خصم) للشريط العلوي — نرفع فقط العروض على مستوى المتجر (بلا
  // product_id ولا category) حتى لا يظهر خصم منتج/فئة واحدة كخصم لكل المتجر (مضلِّل للعميل).
  const storeWideOffers = offers.filter((o: any) => !o.product_id && !o.category)
  const topOffer = storeWideOffers.length
    ? storeWideOffers.reduce((best, o) => (o.discount_percentage > best.discount_percentage ? o : best), storeWideOffers[0])
    : null

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {topOffer && (
        <div className="bg-green-600 text-white py-2 md:py-3 shadow-md animate-in fade-in slide-in-from-top duration-500 overflow-hidden relative">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 font-bold text-base md:text-xl">
              <Tag className="h-5 w-5 md:h-6 md:w-6 animate-bounce" />
              <span>{topOffer.title}</span>
              <span className="bg-yellow-400 text-green-800 px-2 py-0.5 rounded-full text-xs md:text-sm">
                {topOffer.discount_percentage}% {t("خصم", "OFF")}
              </span>
            </div>
            <p className="hidden md:block text-green-50/90 text-sm">
              {topOffer.description} • {t("يسري حتى", "Valid until")}: {new Date(topOffer.end_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 py-4 md:py-8">
        <div className="container mx-auto px-2 md:px-4">
          <div className="mb-4 md:mb-6">
            <BackButton />
          </div>


          <div className="bg-white rounded-lg shadow-sm p-3 md:p-8 mb-6 md:mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-6">
              <div className="relative h-48 sm:h-64 lg:h-full rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={imgSrc(store.image_url)}
                  alt={store.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>

              <div className="space-y-4 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl md:text-4xl font-bold break-words">{store.name}</h1>
                  <ShareButton title={store.name} text={t(`شوف متجر ${store.name} على محلك`, `Check out ${store.name} on Mahalak`)} className="shrink-0" />
                </div>
                <p className="text-gray-600 text-base md:text-lg leading-relaxed break-words">{store.description}</p>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{store.rating}</span>
                    <span className="text-gray-500">{t("تقييم", "rating")}</span>
                  </div>
                  <div className="ml-0 md:ml-4 w-full md:w-auto">
                    <p className="text-sm text-gray-600">{t("قيم المتجر", "Rate this store")}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const filled = (hoverRating ?? userStoreReview ?? 0) >= n
                        return (
                          <button
                            key={n}
                            aria-label={`${n} star`}
                            type="button"
                            disabled={submittingReview}
                            onMouseEnter={() => setHoverRating(n)}
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={async () => {
                              if (!user) {
                                router.push("/auth")
                                return
                              }

                              try {
                                setSubmittingReview(true)
                                const res = await upsertStoreReview(store.id, user.id, n) as { success?: boolean, average?: number, error?: string }
                                if (res && res.success && typeof res.average === "number") {
                                  const newAvg = res.average
                                  setStore((s) => (s ? { ...s, rating: newAvg } : s))
                                  setUserStoreReview(n)
                                } else if (res && res.error) {
                                  // رسالة الخادم عربية جاهزة للعرض — لا نسبقها بـ«فشل التقييم» كي لا
                                  // تُقرأ كعطل بينما هي شرط مفهوم (لم يكتمل تسليم طلب من هذا المتجر)
                                  toast.error(res.error)
                                }
                              } catch (err: any) {
                                toast.error(t("حدث خطأ أثناء إرسال التقييم", "An error occurred while submitting your rating"))
                              } finally {
                                setSubmittingReview(false)
                              }
                            }}
                            className={`p-1 ${filled ? "text-yellow-400" : "text-gray-400"}`}
                          >
                            <Star className={`h-5 w-5 ${filled ? "fill-yellow-400 text-yellow-400" : ""}`} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <span className="bg-secondary px-3 py-1 text-sm md:px-4 md:py-2 md:text-base rounded-full font-medium">{store.category}</span>
                </div>

                <div className="flex items-start gap-3 p-3 md:p-4 bg-secondary rounded-lg">
                  <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">{t("العنوان", "Address")}</p>
                    <p className="text-gray-600">{store.address}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={handleWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700 w-full">
                    <MessageCircle className="ms-2 h-5 w-5" />
                    {t("تواصل واتساب", "WhatsApp")}
                  </Button>
                  <Button onClick={handleCall} variant="outline" className="flex-1 bg-transparent w-full">
                    <Phone className="ms-2 h-5 w-5" />
                    {t("اتصال", "Call")}
                  </Button>
                </div>
                <Sheet open={isPolicySheetOpen} onOpenChange={setIsPolicySheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="flex-1 bg-transparent w-full">
                      <FileText className="ms-2 h-5 w-5" />
                      {t("سياسات المتجر", "Store Policies")}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader className="pe-10">
                      <SheetTitle className={isRTL ? "text-right" : "text-left"}>{t("سياسات متجر", "Store Policies")} {store.name}</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 px-4 overflow-y-auto h-full">
                      {store.return_policy ? (
                        <p className="whitespace-pre-wrap break-words">{store.return_policy}</p>
                      ) : (
                        <p>{t("لم يتم تحديد سياسة الإرجاع بعد.", "Return policy not set yet.")}</p>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>


          <div>
            <h2 className="text-2xl font-bold mb-4">{t("منتجات المتجر", "Store Products")}</h2>

            {products.length > 0 && (
              <>
                {/* بحث داخل هذا المتجر وحده — غير البحث العام في أعلى الموقع */}
                <div className="mb-4">
                  <SearchBar
                    placeholder={t(`ابحث داخل ${store.name}...`, `Search inside ${store.name}...`)}
                    onSearch={setQuery}
                  />
                </div>

                {/* تقسيم داخلي بالفئات */}
                {categories.length > 1 && (
                  <div className="mb-6 -mx-2 px-2 overflow-x-auto">
                    <div className="flex gap-2 min-w-max pb-1">
                      <button
                        type="button"
                        onClick={() => setActiveCategory("all")}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeCategory === "all"
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-card border border-border text-foreground hover:bg-secondary"
                          }`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        {t("الكل", "All")} ({products.length})
                      </button>
                      {categories.map((category) => (
                        <button
                          key={category.name}
                          type="button"
                          onClick={() => setActiveCategory(category.name)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeCategory === category.name
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-card border border-border text-foreground hover:bg-secondary"
                            }`}
                        >
                          {category.name} ({category.count})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* أقسام سريعة (الأكثر مبيعًا / عروض / الأعلى تقييمًا / وصل حديثًا) */}
            {isBrowsingAll &&
              sections.map((section) => (
                <section key={section.key} className="mb-8">
                  <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                    <section.icon className="h-5 w-5 text-primary" />
                    {sectionTitles[section.key]}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {section.items.map((product) => (
                      <ProductCard key={`${section.key}-${product.id}`} product={product} showActions storePhone={store.phone} />
                    ))}
                  </div>
                </section>
              ))}

            {products.length > 0 && (
              <h3 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {tokens.length > 0 || activeCategory !== "all"
                  ? t(`النتائج (${visibleProducts.length})`, `Results (${visibleProducts.length})`)
                  : t(`كل المنتجات (${visibleProducts.length})`, `All products (${visibleProducts.length})`)}
              </h3>
            )}

            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={t("لا توجد منتجات في هذا المتجر حالياً", "No products available in this store currently")}
              />
            ) : visibleProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {visibleProducts.slice(0, visibleCount).map((product) => (
                    <ProductCard key={product.id} product={product} showActions storePhone={store.phone} />
                  ))}
                </div>
                {visibleProducts.length > visibleCount && (
                  <div className="flex justify-center mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setPager({ key: filterKey, count: visibleCount + PAGE_SIZE })}
                      className="border-2 border-primary text-primary hover:bg-primary/10 rounded-xl px-8 h-12 font-bold"
                    >
                      {t(
                        `عرض المزيد (${visibleProducts.length - visibleCount} متبقٍ)`,
                        `Show more (${visibleProducts.length - visibleCount} left)`,
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={SearchX}
                title={t("لا توجد نتائج مطابقة", "No matching results")}
                description={t("جرّب كلمات أخرى أو اختر فئة مختلفة", "Try different words or pick another category")}
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
