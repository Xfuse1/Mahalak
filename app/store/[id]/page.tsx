"use client"
import React from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { BackButton } from "@/components/back-button"
import { Star, MapPin, Phone, MessageCircle, FileText } from "lucide-react"
import { notFound, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"
import { useEffect, useState } from "react"
import { getStore } from "@/lib/actions/stores"
import { getProductsByStoreId } from "@/lib/actions/products"
import { trackMetaEvent } from "@/lib/utils"
import { getUserStoreReview, upsertStoreReview } from "@/lib/actions/storeReviews"

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

export default function StorePage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const unwrappedParams =
    typeof params === "object" && "then" in params
      ? React.use(params as unknown as Promise<{ id: string }>)
      : (params as { id: string })
  const { id } = unwrappedParams

  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [userStoreReview, setUserStoreReview] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [isPolicySheetOpen, setIsPolicySheetOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const storeData = await getStore(id)

        if (!storeData) {
          setLoading(false)
          return
        }

        setStore(storeData)
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
          const existing = await getUserStoreReview(store.id, user.id)
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
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
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
              <div className="relative h-64 lg:h-full rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={store.image_url || "/placeholder.svg"}
                  alt={store.name}
                  fill
                  priority
                  className="object-cover"
                />
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-bold">{store.name}</h1>
                <p className="text-gray-600 text-lg leading-relaxed">{store.description}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{store.rating}</span>
                    <span className="text-gray-500">{t("تقييم", "rating")}</span>
                  </div>
                  <div className="ml-4">
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
                                const res = await upsertStoreReview(store.id, user.id, n)
                                if (res && res.average !== undefined && res.average !== null) {
                                  setStore((s) => (s ? { ...s, rating: res.average } : s))
                                  setUserStoreReview(n)
                                }
                              } catch (err) {
                                console.error("[v0] Error submitting store review:", err)
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
                  <span className="bg-secondary px-4 py-2 rounded-full font-medium">{store.category}</span>
                </div>

                <div className="flex items-start gap-3 p-4 bg-secondary rounded-lg">
                  <MapPin className="h-5 w-5 text-[#1F478B] mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">{t("العنوان", "Address")}</p>
                    <p className="text-gray-600">{store.address}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700">
                    <MessageCircle className="ml-2 h-5 w-5" />
                    {t("تواصل واتساب", "WhatsApp")}
                  </Button>
                  <Button onClick={handleCall} variant="outline" className="flex-1 bg-transparent">
                    <Phone className="ml-2 h-5 w-5" />
                    {t("اتصال", "Call")}
                  </Button>
                </div>
                <Sheet open={isPolicySheetOpen} onOpenChange={setIsPolicySheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="flex-1 bg-transparent w-full">
                      <FileText className="ml-2 h-5 w-5" />
                      {t("سياسات المتجر", "Store Policies")}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>{t("سياسات متجر", "Store Policies")} {store.name}</SheetTitle>
                    </SheetHeader>
                    <div className="py-4">
                      {store.return_policy ? (
                        <p className="whitespace-pre-wrap">{store.return_policy}</p>
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
              <div className="text-center py-12 bg-secondary rounded-lg">
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
