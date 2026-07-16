"use client"
import React from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/back-button"
import { ShareButton } from "@/components/share-button"
import { Star, MessageCircle, Phone, ShoppingCart, Zap } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { useEffect, useState } from "react"
import { getProduct, getRelatedProducts, getProductsFromSameStore, getProductsFromOtherStores, updateProduct } from "@/lib/actions/products"
import { getUserReview, upsertReview } from "@/lib/actions/reviews"
import { trackMetaEvent } from "@/lib/utils"
import { createContactInquiry } from "@/lib/actions/orders"
import { useCartStore } from "@/lib/stores/cart-store"
import { imgSrc } from "@/lib/storage/public-url"
import { Tag } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { Spinner } from "@/components/ui/spinner"

type Product = {
  id: string
  name: string
  description: string
  price: number
  category: string
  stock: number
  image_url: string | null
  store_id: string
  rating: number
  discount_percentage?: number
  offer_title?: string
  stores?: {
    id: string
    name: string
    phone?: string
  }
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15+: params is a Promise, unwrap with React.use()
  const { id } = React.use(params);
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const { addItem } = useCartStore()
  const toast = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [userReview, setUserReview] = useState<number | null>(null)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [sameStoreProducts, setSameStoreProducts] = useState<Product[]>([])
  const [otherStoresProducts, setOtherStoresProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const productData = await getProduct(id) as Product | null

        if (!productData) {
          setProduct(null)
          setLoading(false)
          return
        }

        setProduct(productData)

        // Fetch all related data in parallel instead of sequentially
        const [sameStore, otherStores, related] = await Promise.all([
          getProductsFromSameStore(id, productData.store_id, 4),
          getProductsFromOtherStores(id, productData.store_id, 4),
          getRelatedProducts(id, productData.category, 4),
        ])

        setSameStoreProducts(sameStore as Product[])
        setOtherStoresProducts(otherStores as Product[])
        setRelatedProducts(related as Product[])

        setLoading(false)
      } catch (_error) {
        setProduct(null)
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  // When product loads and user is present, fetch existing review (one per user per product)
  useEffect(() => {
    if (!product || !user) return

    let mounted = true
    ;(async () => {
      try {
        const existing = await getUserReview(product.id, user.id) as { rating?: number } | null
        if (!mounted) return
        if (existing && typeof existing.rating === 'number') {
          setUserReview(existing.rating)
        } else {
          setUserReview(null)
        }
      } catch (_err) {
        // silently fail — review fetch is non-critical
      }
    })()

    return () => {
      mounted = false
    }
  }, [product, user])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" label={t("جاري التحميل...", "Loading...")} className="flex-col" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-background">
          <div className="container mx-auto px-4">
            <div className="mb-6">
              <BackButton />
            </div>
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-12 w-12 text-gray-400" />
              </div>
              <h1 className="text-2xl font-bold mb-4 text-gray-800">{t("المنتج غير موجود", "Product Not Found")}</h1>
              <p className="text-gray-500 mb-6">
                {t("عذراً، لم نتمكن من العثور على هذا المنتج", "Sorry, we couldn't find this product")}
              </p>
              <Button onClick={() => router.push("/")} className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg px-6">{t("العودة للرئيسية", "Back to Home")}</Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const handleWhatsApp = async () => {
    if (!user) {
      router.push("/auth")
      return
    }

    // Track contact event via Meta Pixel
    try {
      trackMetaEvent("Contact", {
        method: "whatsapp",
        productId: product.id,
        productName: product.name,
        storeId: product.store_id,
        storeName: product.stores?.name,
      })
    } catch (e) {
      // ignore
    }

    // Save contact inquiry to database
    try {
      await createContactInquiry({
        customer_id: user.id,
        product_id: product.id,
        store_id: product.store_id,
        price: product.price,
        contact_method: "whatsapp",
      })
    } catch (_error) {
      // silently fail — analytics tracking is non-critical
    }

    const arMessage = `مرحباً، أريد الاستفسار عن ${product.name}`
    const enMessage = `Hello, I want to inquire about ${product.name}`
    const message = t(arMessage, enMessage)

    const formatPhoneForWhatsApp = (raw?: string) => {
      if (!raw) return ""
      let digits = raw.replace(/\D/g, "")

      if (digits.startsWith("00")) digits = digits.slice(2)

      if (digits.startsWith("0")) {
        // default to Egypt country code if local format provided
        digits = `20${digits.slice(1)}`
      }

      return digits
    }

    const phone = formatPhoneForWhatsApp(product.stores?.phone) || ""

    if (!phone || phone.length < 8) {
      toast.error(t("رقم الهاتف غير صالح لفتح واتساب. الرجاء تحديث رقم الواتساب في إعدادات المتجر.", "Phone number invalid for WhatsApp. Please update the store WhatsApp number in settings."))
      return
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleCall = async () => {
    if (!user) {
      router.push("/auth")
      return
    }

    // Track contact event via Meta Pixel
    try {
      trackMetaEvent("Contact", {
        method: "call",
        productId: product.id,
        productName: product.name,
        storeId: product.store_id,
        storeName: product.stores?.name,
      })
    } catch (e) {
      // ignore
    }

    // Save contact inquiry to database
    try {
      await createContactInquiry({
        customer_id: user.id,
        product_id: product.id,
        store_id: product.store_id,
        price: product.price,
        contact_method: "call",
      })
    } catch (_error) {
      // silently fail — analytics tracking is non-critical
    }

    const phone = product.stores?.phone
    if (!phone) {
      toast.error(t("رقم الهاتف غير متوفر لهذا المتجر", "Phone number not available for this store"))
      return
    }
    window.location.href = `tel:${phone}`
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          {/* Product Details - Above the Fold */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Product Image */}
            <div className="aspect-square relative bg-gray-100 rounded-3xl overflow-hidden shadow-xl group">
              <Image src={imgSrc(product.image_url)} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Product Info */}
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-4xl font-extrabold text-gray-800 text-balance">{product.name}</h1>
                <ShareButton title={product.name} text={t(`شوف ${product.name} على محلك`, `Check out ${product.name} on Mahalak`)} className="shrink-0" />
              </div>

              <Link href={`/store/${product.store_id}`} className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium transition-colors">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                {product.stores?.name || t("المتجر", "Store")}
              </Link>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-lg text-amber-700">{product.rating}</span>
                </div>
                  {/* User review (one per user per product) - interactive stars */}
                <div className="flex items-center gap-1 me-3">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const filled = userReview ? n <= userReview : n <= Math.round(product.rating)
                    return (
                      <button
                        key={n}
                        aria-label={`Rate ${n} stars`}
                        disabled={submittingReview}
                        onClick={async (e) => {
                          e.preventDefault()
                          if (!user) {
                            router.push('/auth')
                            return
                          }

                          try {
                            setSubmittingReview(true)
                            const res = await upsertReview(product.id, user.id, n)
                            if (res && res.average) {
                              setProduct((p) => (p ? { ...p, rating: res.average } : p))
                            }
                            setUserReview(n)
                          } catch (_err) {
                            // handled by UI state
                          } finally {
                            setSubmittingReview(false)
                          }
                        }}
                        className={`p-1.5 rounded-lg ${filled ? 'text-amber-400' : 'text-gray-300'} hover:scale-125 transition-all`}
                      >
                        <Star className="h-5 w-5" fill={filled ? "currentColor" : "none"} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Price with Discount */}
              {product.discount_percentage && product.discount_percentage > 0 ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full px-4 py-2 font-bold shadow-lg">
                    <Tag className="h-5 w-5" />
                    <span>{t(`خصم ${product.discount_percentage}%`, `${product.discount_percentage}% OFF`)}</span>
                  </div>
                  <p className="text-2xl text-gray-400 line-through">
                    {product.price.toLocaleString()} {t("جنيه", "EGP")}
                  </p>
                  <p className="text-5xl font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    {(product.price - (product.price * product.discount_percentage / 100)).toLocaleString()} <span className="text-2xl text-gray-500">{t("جنيه", "EGP")}</span>
                  </p>
                </div>
              ) : (
                <p className="text-5xl font-extrabold text-primary">
                  {product.price} <span className="text-2xl text-gray-500">{t("جنيه", "EGP")}</span>
                </p>
              )}

              <p className="text-gray-600 leading-relaxed text-lg">{product.description}</p>

              <div>
                <div className="mb-5">
                  <span
                    className={`inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm ${
                      product.stock > 0 ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200" : "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {product.stock > 0 
                      ? t(`🟢 متوفر (${product.stock} قطعة)`, `🟢 Available (${product.stock} in stock)`) 
                      : t("🔴 غير متوفر", "🔴 Out of Stock")}
                  </span>
                </div>

                <div className="text-center mb-5 bg-gradient-to-r from-gray-50 to-gray-100 py-3 px-4 rounded-xl">
                  <p className="text-sm text-gray-600 font-medium">
                    {t("لطلب المنتج، تواصل مع البائع", "To order, contact the seller")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleWhatsApp}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] h-14 text-lg"
                  disabled={product.stock === 0}
                >
                  <MessageCircle className="ms-2 h-6 w-6" />
                  {t("تواصل واتساب", "WhatsApp")}
                </Button>
                <Button
                  onClick={handleCall}
                  variant="outline"
                  className="flex-1 rounded-xl border-2 hover:bg-gray-50 h-14 text-lg"
                  disabled={product.stock === 0}
                >
                  <Phone className="ms-2 h-6 w-6" />
                  {t("اتصال", "Call")}
                </Button>
              </div>

              {/* Add to Cart and Buy Now Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (!user) {
                      router.push("/auth")
                      return
                    }
                    // Save single product for "Buy Now" - separate from cart
                    const buyNowItem = {
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      category: product.category,
                      image_url: product.image_url,
                      store_id: product.store_id,
                      store_name: product.stores?.name,
                      description: product.description,
                      quantity: 1,
                      stock: product.stock,
                      discount_percentage: product.discount_percentage || 0,
                    }
                    sessionStorage.setItem("buyNowItem", JSON.stringify(buyNowItem))
                    router.push("/checkout?mode=buynow")
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] h-14 text-lg"
                  disabled={product.stock === 0}
                >
                  <Zap className="ms-2 h-6 w-6" />
                  {t("اشتري الآن", "Buy Now")}
                </Button>
                <Button
                  onClick={() => {
                    addItem({
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      category: product.category,
                      image_url: product.image_url,
                      store_id: product.store_id,
                      store_name: product.stores?.name,
                      description: product.description,
                      discount_percentage: product.discount_percentage || 0,
                      stock: product.stock,
                    })
                  }}
                  variant="outline"
                  className="flex-1 border-2 border-primary text-primary hover:bg-primary/10 rounded-xl h-14 text-lg transition-all hover:scale-[1.02]"
                  disabled={product.stock === 0}
                >
                  <ShoppingCart className="ms-2 h-6 w-6" />
                  {t("أضف للسلة", "Add to Cart")}
                </Button>
              </div>

              <div className="bg-primary/10 p-5 rounded-2xl border border-primary/20">
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-primary">{t("الفئة:", "Category:")}</span> {product.category}
                </p>
              </div>
            </div>
          </div>

          {/* Products from Same Store */}
          {sameStoreProducts.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{t("منتجات أخرى من نفس المتجر", "More from this Store")}</h2>
                <Link 
                  href={`/store/${product.store_id}`}
                  className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                >
                  {t("عرض الكل", "View All")} →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {sameStoreProducts.map((storeProduct) => (
                  <Link key={storeProduct.id} href={`/product/${storeProduct.id}`} className="group">
                    <div className="bg-white rounded-2xl shadow-lg border-0 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-2">
                      <div className="aspect-square relative bg-gray-100 overflow-hidden">
                        <Image
                          src={imgSrc(storeProduct.image_url)}
                          alt={storeProduct.name}
                          fill
                          loading="lazy"
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-sm mb-2 line-clamp-2 text-gray-800">{storeProduct.name}</h3>
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-gray-600 font-medium">{storeProduct.rating || 0}</span>
                        </div>
                        {(storeProduct as any).discount_percentage > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 line-through">{storeProduct.price} {t("جنيه", "EGP")}</p>
                            <p className="font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                              {(storeProduct.price - (storeProduct.price * (storeProduct as any).discount_percentage / 100)).toLocaleString()} <span className="text-xs text-gray-500">{t("جنيه", "EGP")}</span>
                            </p>
                          </div>
                        ) : (
                          <p className="font-extrabold text-primary">
                            {storeProduct.price} <span className="text-xs text-gray-500">{t("جنيه", "EGP")}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products from Other Stores */}
          {otherStoresProducts.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">{t("منتجات من متاجر أخرى", "Products from Other Stores")}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {otherStoresProducts.map((otherProduct) => (
                  <Link key={otherProduct.id} href={`/product/${otherProduct.id}`} className="group">
                    <div className="bg-white rounded-2xl shadow-lg border-0 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-2">
                      <div className="aspect-square relative bg-gray-100 overflow-hidden">
                        <Image
                          src={imgSrc(otherProduct.image_url)}
                          alt={otherProduct.name}
                          fill
                          loading="lazy"
                          sizes="(max-width: 640px) 50vw, 25vw"
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-sm mb-1 line-clamp-2 text-gray-800">{otherProduct.name}</h3>
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                          {otherProduct.stores?.name || t("المتجر", "Store")}
                        </p>
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-gray-600 font-medium">{otherProduct.rating || 0}</span>
                        </div>
                        {(otherProduct as any).discount_percentage > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 line-through">{otherProduct.price} {t("جنيه", "EGP")}</p>
                            <p className="font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                              {(otherProduct.price - (otherProduct.price * (otherProduct as any).discount_percentage / 100)).toLocaleString()} <span className="text-xs text-gray-500">{t("جنيه", "EGP")}</span>
                            </p>
                          </div>
                        ) : (
                          <p className="font-extrabold text-primary">
                            {otherProduct.price} <span className="text-xs text-gray-500">{t("جنيه", "EGP")}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
