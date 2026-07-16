"use client"
import React from "react"
import { Header } from "../../../components/header"
import { Footer } from "../../../components/footer"
import { ProductCard } from "../../../components/product-card"
import { BackButton } from "../../../components/back-button"
import { ShareButton } from "../../../components/share-button"
import { Star, MapPin, Phone, MessageCircle, FileText, Tag, Package } from "lucide-react"
import { notFound, useRouter } from "next/navigation"
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
import { useEffect, useState } from "react"
import { getStore } from "../../../lib/actions/stores"
import { getProductsByStoreId } from "../../../lib/actions/products"
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
  store_id: string
  rating: number
  storeName: string
  storeId: string
  reviewCount: number
}

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
        const [offersData, productsData] = await Promise.all([
          getStoreOffers(id).catch((err) => {
            console.error("[debug] Error fetching store offers:", err)
            return []
          }),
          getProductsByStoreId(id).catch((err) => {
            console.error("[debug] Error fetching store products:", err)
            return []
          }),
        ])

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
                                  toast.error(t(`فشل التقييم: ${res.error}`, `Rating failed: ${res.error}`))
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
            <h2 className="text-2xl font-bold mb-6">{t("منتجات المتجر", "Store Products")}</h2>
            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title={t("لا توجد منتجات في هذا المتجر حالياً", "No products available in this store currently")}
              />
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
