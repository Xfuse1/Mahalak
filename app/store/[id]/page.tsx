"use client"
import React from "react"
import { Header } from "../../../components/header"
import { Footer } from "../../../components/footer"
import { ProductCard } from "../../../components/product-card"
import { BackButton } from "../../../components/back-button"
import { Star, MapPin, Phone, MessageCircle, FileText, Tag } from "lucide-react"
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
import { trackMetaEvent, formatAddress } from "../../../lib/utils"
import { getUserStoreReview, upsertStoreReview } from "../../../lib/actions/storeReviews"
import { getStoreOffers } from "../../../lib/actions/offers"

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

export default function StorePage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { t, language } = useLanguage()

  const unwrappedParams =
    typeof params === "object" && "then" in params
      ? React.use(params as unknown as Promise<{ id: string }>)
      : (params as { id: string })
  const { id } = unwrappedParams

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

        // Fetch offers
        const offersData = await getStoreOffers(id)
        const now = new Date()
        const activeOffers = offersData.filter((offer: any) => {
          const startDate = new Date(offer.start_date)
          const endDate = new Date(offer.end_date)
          return startDate <= now && endDate >= now
        })
        setOffers(activeOffers as Offer[])

        const productsData = await getProductsByStoreId(id)
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
        console.error("[v0] Error fetching store data:", error)
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
  }, [store])

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
          console.error("[v0] Error fetching user store review:", err)
        }
      })()

    return () => {
      mounted = false
    }
  }, [store, user])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
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
      alert(t("رقم الهاتف غير صالح لفتح واتساب. الرجاء تحديث رقم الواتساب في إعدادات المتجر.", "Phone number invalid for WhatsApp. Please update the store WhatsApp number in settings."))
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      {offers.length > 0 && (
        <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 text-white py-3 md:py-4 shadow-lg animate-in fade-in slide-in-from-top duration-500 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-center relative">
            <div className="flex flex-wrap items-center justify-center gap-2 font-bold text-base md:text-xl">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Tag className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <span>{offers[0].title}</span>
              <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-green-900 px-3 py-1 rounded-full text-xs md:text-sm font-bold shadow-md">
                {offers[0].discount_percentage}% {t("خصم", "OFF")}
              </span>
            </div>
            <p className="hidden md:block text-green-50/90 text-sm">
              {offers[0].description} • {t("يسري حتى", "Valid until")}: {new Date(offers[0].end_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 py-6 md:py-10">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          {/* Store Header Card */}
          <div className="bg-white rounded-3xl shadow-xl border-0 p-6 md:p-10 mb-8 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Store Image */}
              <div className="relative h-64 sm:h-80 lg:h-full rounded-2xl overflow-hidden bg-gray-100 shadow-lg group">
                <Image
                  src={store.image_url || "/placeholder.svg"}
                  alt={store.name}
                  fill
                  priority
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              {/* Store Info */}
              <div className="space-y-6 min-w-0">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
                    {store.name}
                  </h1>
                  <p className="text-gray-600 text-base md:text-lg leading-relaxed">{store.description}</p>
                </div>

                {/* Rating Section */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-50 to-amber-50 px-4 py-2 rounded-xl border border-yellow-200">
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-xl text-gray-800">{store.rating}</span>
                    <span className="text-gray-500 text-sm">{t("تقييم", "rating")}</span>
                  </div>
                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 text-sm rounded-full font-medium shadow-md">
                    {store.category}
                  </span>
                </div>

                {/* User Rating */}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-sm text-gray-600 mb-2">{t("قيم المتجر", "Rate this store")}</p>
                  <div className="flex items-center gap-1">
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
                                alert(t(`فشل التقييم: ${res.error}`, `Rating failed: ${res.error}`))
                              }
                            } catch (err: any) {
                              console.error("[v0] Error submitting store review:", err)
                              alert(t("حدث خطأ أثناء إرسال التقييم", "An error occurred while submitting your rating"))
                            } finally {
                              setSubmittingReview(false)
                            }
                          }}
                          className={`p-1 transition-all duration-200 hover:scale-125 ${filled ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          <Star className={`h-7 w-7 ${filled ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Address Card */}
                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 mb-1">{t("العنوان", "Address")}</p>
                    <p className="text-gray-600">{formatAddress(store.address)}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleWhatsApp}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl h-12 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                  >
                    <MessageCircle className="me-2 h-5 w-5" />
                    {t("تواصل واتساب", "WhatsApp")}
                  </Button>
                  <Button
                    onClick={handleCall}
                    variant="outline"
                    className="flex-1 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl h-12 transition-all"
                  >
                    <Phone className="me-2 h-5 w-5" />
                    {t("اتصال", "Call")}
                  </Button>
                </div>

                {/* Store Policies */}
                <Sheet open={isPolicySheetOpen} onOpenChange={setIsPolicySheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full border-2 border-gray-200 hover:border-violet-500 hover:bg-violet-50 rounded-xl h-12 transition-all">
                      <FileText className="me-2 h-5 w-5" />
                      {t("سياسات المتجر", "Store Policies")}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="rounded-s-3xl">
                    <SheetHeader className="pe-10">
                      <SheetTitle className="text-right text-xl">{t("سياسات متجر", "Store Policies")} {store.name}</SheetTitle>
                    </SheetHeader>
                    <div className="py-6 px-4 overflow-y-auto h-full">
                      {store.return_policy ? (
                        <div className="bg-gray-50 rounded-xl p-4 border-s-4 border-blue-500">
                          <p className="whitespace-pre-wrap break-words text-gray-600 leading-relaxed">{store.return_policy}</p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-gray-500">{t("لم يتم تحديد سياسة الإرجاع بعد.", "Return policy not set yet.")}</p>
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {t("منتجات المتجر", "Store Products")}
              </h2>
              {products.length > 0 && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {products.length} {t("منتج", "products")}
                </span>
              )}
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl shadow-md border-0">
                <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Tag className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-500 text-lg">
                  {t("لا توجد منتجات في هذا المتجر حالياً", "No products available in this store currently")}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
