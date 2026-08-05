"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Star, ShoppingBag, Tag, ShoppingCart, Truck, MessageCircle, Phone } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { useLanguage } from "../lib/language-context"
import { useAuth } from "../lib/auth-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useToast } from "@/components/ui/toast"
import { imgSrc } from "@/lib/storage/public-url"
import { toWhatsAppDigits } from "@/lib/utils/phone"
import { trackMetaEvent } from "@/lib/utils"
import { createContactInquiry } from "@/lib/actions/orders"
import { memo } from "react"

// تسجيل الاستفسار مرة واحدة لكل (منتج × وسيلة) في الجلسة: التاجر يحتاج أن يرى استفسارات
// البطاقات في تقاريره (وإلا بدت الأزرار الجديدة كأنها لا تُنتج عملاء)، لكن الزرّ صار في كل
// شبكة منتجات، ونقرة متكررة كانت ستكتب مستندًا في مجموعة orders في كل مرة على قاعدة مجانية.
// `logged` تُملأ بعد *نجاح* الكتابة فقط — createContactInquiry تُرجع {success:false} ولا ترمي،
// فالتعليم قبل التأكّد كان يُسقط السجل نهائيًّا عند جلسة منتهية أو انقطاع شبكة لحظي.
// `inflight` تمنع الكتابة المزدوجة من نقرتين سريعتين قبل عودة الأولى.
const loggedInquiries = new Set<string>()
const inflightInquiries = new Set<string>()

interface ProductCardProduct {
  id: string
  name: string
  price: number
  rating: number
  image?: string | null
  image_url?: string | null
  category?: string
  description?: string
  storeName?: string
  store_id?: string
  stock?: number
  stores?: { name?: string; phone?: string | null } | null
  discount_percentage?: number
}

interface ProductCardProps {
  product: ProductCardProduct
  /** أزرار سريعة (سلة/توصيل/واتساب/اتصال) أسفل البطاقة — اختيارية حتى لا تتغيّر الشبكات القائمة فجأة. */
  showActions?: boolean
  /** هاتف المتجر عند معرفته من سياق الصفحة (صفحة المتجر) — يسبق hatf المضمَّن في المنتج. */
  storePhone?: string | null
}

function ProductCardComponent({ product, showActions = false, storePhone }: ProductCardProps) {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const toast = useToast()
  const isRTL = language === "ar"

  const hasDiscount = product.discount_percentage && product.discount_percentage > 0
  const discountedPrice = hasDiscount
    ? product.price - (product.price * product.discount_percentage! / 100)
    : product.price

  const storeName = product.stores?.name ?? product.storeName
  const phone = storePhone ?? product.stores?.phone ?? null
  const waNumber = toWhatsAppDigits(phone)
  // المخزون غير المعروف ≠ صفر: بعض القوائم لا تحمل الحقل، فنُخفي زرّي الشراء بدل تعطيلهما كذبًا
  // (البطاقة تبقى رابطًا لصفحة المنتج) — و addItem يعتمد على stock رقمًا وإلا نمت الكمية بلا حدّ.
  const stock = Number(product.stock)
  const stockKnown = Number.isFinite(stock)
  const canBuy = stockKnown && stock > 0

  // البطاقة كلها داخل <Link>: أي زر لا يوقف الحدث سيتنقّل لصفحة المنتج بدل تنفيذ فعله.
  const stop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const cartPayload = () => ({
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    image_url: product.image_url ?? product.image ?? null,
    store_id: product.store_id,
    store_name: storeName,
    description: product.description,
    discount_percentage: product.discount_percentage || 0,
    stock: stockKnown ? stock : 0,
  })

  const handleAddToCart = (e: React.MouseEvent) => {
    stop(e)
    if (!canBuy) {
      toast.warning(t("هذا المنتج غير متوفر حالياً", "This product is out of stock"))
      return
    }
    // addItem يتجاهل الإضافة بصمت عند بلوغ حدّ المخزون — نُعلم العميل بدل زرّ يبدو معطّلًا
    const before = useCartStore.getState().items.find((i) => i.id === product.id)?.quantity ?? 0
    addItem(cartPayload())
    const after = useCartStore.getState().items.find((i) => i.id === product.id)?.quantity ?? 0
    if (after > before) toast.success(t("أُضيف إلى السلة", "Added to cart"))
    else toast.warning(t("لا يمكن إضافة كمية أكبر من المتاح", "You reached the available stock"))
  }

  const handleOrderDelivery = (e: React.MouseEvent) => {
    stop(e)
    if (!canBuy) {
      toast.warning(t("هذا المنتج غير متوفر حالياً", "This product is out of stock"))
      return
    }
    if (!user) {
      router.push("/auth")
      return
    }
    // نفس مسار «اشتري الآن» في صفحة المنتج: صنف واحد منفصل عن السلة ثم الدفع مباشرة
    try {
      sessionStorage.setItem("buyNowItem", JSON.stringify({ ...cartPayload(), quantity: 1 }))
    } catch {
      toast.error(t("تعذّر بدء الطلب، حاول مرة أخرى", "Couldn't start the order, please try again"))
      return
    }
    router.push("/checkout?mode=buynow")
  }

  // تتبّع التواصل: بكسل Meta + سجلّ استفسار للتاجر. السجلّ للمسجَّلين فقط (يتطلّب هوية جلسة)
  // ولا يُفشل الفعل أبدًا — الزائر غير المسجَّل يتواصل عادي كما في صفحتَي المنتج والمتجر.
  const trackContact = (method: "whatsapp" | "call") => {
    try {
      trackMetaEvent("Contact", { method, productId: product.id, storeId: product.store_id })
    } catch {
      // تتبّع غير حرِج
    }
    const key = `${product.id}:${method}`
    if (!user || !product.store_id || loggedInquiries.has(key) || inflightInquiries.has(key)) return
    inflightInquiries.add(key)
    createContactInquiry({
      customer_id: user.id,
      product_id: product.id,
      store_id: product.store_id,
      price: product.price,
      contact_method: method,
    })
      .then((res) => {
        if (res?.success) loggedInquiries.add(key)
      })
      .catch(() => {
        // سجلّ تحليلي غير حرِج — لا يمنع التواصل، وتُعاد المحاولة عند النقرة التالية
      })
      .finally(() => {
        inflightInquiries.delete(key)
      })
  }

  // التواصل متاح للزائر بلا تسجيل دخول — نتبع سياسة صفحة المنتج (قرار مقصود سابق: أزرار
  // واتساب/اتصال تعمل بلا تسجيل). ملاحظة: صفحة المتجر لا تزال تحوّل الزائر إلى /auth في نفس
  // الفعل، وهو تعارض قائم بين السطحين لم يُحسم بعد — لم نغيّره هنا.
  const handleWhatsApp = (e: React.MouseEvent) => {
    stop(e)
    if (!waNumber) {
      toast.error(t("رقم واتساب المتجر غير متاح", "Store WhatsApp number is unavailable"))
      return
    }
    trackContact("whatsapp")
    const message = t(`مرحباً، أريد الاستفسار عن ${product.name}`, `Hello, I want to inquire about ${product.name}`)
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleCall = (e: React.MouseEvent) => {
    stop(e)
    if (!phone) {
      toast.error(t("رقم هاتف المتجر غير متاح", "Store phone number is unavailable"))
      return
    }
    trackContact("call")
    window.location.href = `tel:${phone}`
  }

  const actionBase =
    "flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold h-10 px-2 transition-colors active:scale-95"

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-w-0 group">
      <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full border border-border bg-card shadow-sm group-hover:shadow-primary/10 flex flex-col">
        <Link href={`/product/${product.id}`} className="flex-1 flex flex-col">
          <div className="aspect-square relative bg-muted overflow-hidden">
            <Image
              src={imgSrc(product.image_url || product.image)}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm text-gray-900 py-2.5 px-4 rounded-xl text-sm font-medium shadow-lg">
                  <ShoppingBag className="h-4 w-4" />
                  {t("عرض المنتج", "View Product")}
                </div>
              </div>
            </div>
            {/* Discount Badge */}
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full px-2.5 py-1 flex items-center gap-1 shadow-lg z-10">
                <Tag className="h-3 w-3" />
                <span className="text-xs font-bold">{product.discount_percentage}%</span>
              </div>
            )}
            {/* Rating Badge */}
            {product.rating > 0 && (
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-md">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-foreground">{product.rating}</span>
              </div>
            )}
          </div>
          <CardContent className="p-4 space-y-2.5 flex-1">
            <h3 className="font-bold text-base line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors">{product.name}</h3>
            {product.category && (
              <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full w-fit">
                {product.category}
              </span>
            )}
            {storeName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                {storeName}
              </p>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {hasDiscount ? (
                <div className="flex flex-col">
                  <p className="text-sm text-muted-foreground line-through">
                    {Number(product.price ?? 0).toLocaleString()} {t("جنيه", "EGP")}
                  </p>
                  <p className="text-xl font-extrabold text-primary">
                    {(Number(discountedPrice) || 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xl font-extrabold text-primary">
                  {Number(product.price ?? 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Link>

        {/* أزرار سريعة — خارج الرابط: زرّ داخل <a> ينتقل بدل أن ينفّذ، ورابط داخل رابط HTML غير صالح */}
        {showActions && (stockKnown || waNumber || phone) && (
          <div className="px-4 pb-4 pt-0 space-y-2">
            {stockKnown && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!canBuy}
                  aria-label={t("أضف إلى السلة", "Add to cart")}
                  className={`${actionBase} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("السلة", "Cart")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOrderDelivery}
                  disabled={!canBuy}
                  aria-label={t("اطلب توصيل", "Order delivery")}
                  className={`${actionBase} border-2 border-primary text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Truck className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t("توصيل", "Delivery")}</span>
                </button>
              </div>
            )}
            {(waNumber || phone) && (
              <div className="grid grid-cols-2 gap-2">
                {waNumber && (
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    aria-label={t("تواصل واتساب", "WhatsApp")}
                    className={`${actionBase} bg-primary/10 text-primary hover:bg-primary/20`}
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("واتساب", "WhatsApp")}</span>
                  </button>
                )}
                {phone && (
                  <button
                    type="button"
                    onClick={handleCall}
                    aria-label={t("اتصال بالمتجر", "Call store")}
                    className={`${actionBase} bg-secondary text-foreground hover:bg-secondary/70 ${waNumber ? "" : "col-span-2"}`}
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t("اتصال", "Call")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const ProductCard = memo(ProductCardComponent)
