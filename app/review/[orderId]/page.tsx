"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState, use } from "react"
import Image from "next/image"
import { Star, Truck, Package, CheckCircle, Loader2 } from "lucide-react"
import { getOrderById } from "@/lib/actions/orders"
import { createOrderReview, hasOrderBeenReviewed } from "@/lib/actions/reviews"
import { markNotificationAsRead } from "@/lib/actions/notifications"
import { useToast } from "@/components/ui/toast"

type OrderItem = {
  id?: string
  product_id: string
  name?: string
  image_url?: string
  quantity: number
  price: number
}

type Order = {
  id: string
  order_id: string
  customer_id: string
  driver_id?: string
  driver_name?: string
  status: string
  items: OrderItem[]
  total: number
}

// Star Rating Component
function StarRating({
  rating,
  onRate,
  size = "md",
}: {
  rating: number
  onRate: (rating: number) => void
  size?: "sm" | "md" | "lg"
}) {
  const [hoverRating, setHoverRating] = useState(0)
  const sizeClass = size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-6 w-6"

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none transition-transform hover:scale-110"
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onRate(star)}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hoverRating || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params)
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Ratings state
  const [driverRating, setDriverRating] = useState(0)
  const [driverComment, setDriverComment] = useState("")
  const [productRatings, setProductRatings] = useState<Record<string, { rating: number; comment: string }>>({})

  useEffect(() => {
    const fetchOrder = async () => {
      if (!user?.id) return

      setLoading(true)
      try {
        const fetchedOrder = await getOrderById(resolvedParams.orderId, user.id)
        if (fetchedOrder) {
          // التحقق من أن الطلب يخص المستخدم الحالي (enforced server-side too)
          if ((fetchedOrder as { customer_id?: string }).customer_id !== user.id) {
            setOrder(null)
            setLoading(false)
            return
          }

          setOrder(fetchedOrder as unknown as Order)

          // Check if already reviewed
          const reviewed = await hasOrderBeenReviewed(resolvedParams.orderId, user.id)
          setAlreadyReviewed(reviewed)

          // Initialize product ratings
          const initialRatings: Record<string, { rating: number; comment: string }> = {}
          fetchedOrder.items?.forEach((item: any) => {
            const productId = item.product_id || item.id
            if (productId) {
              initialRatings[productId] = { rating: 0, comment: "" }
            }
          })
          setProductRatings(initialRatings)
        }
      } catch (_error) {
        // handled by loading state
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchOrder()
    }
  }, [resolvedParams.orderId, user, authLoading])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  const handleProductRating = (productId: string, rating: number) => {
    setProductRatings((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], rating },
    }))
  }

  const handleProductComment = (productId: string, comment: string) => {
    setProductRatings((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], comment },
    }))
  }

  const handleSubmit = async () => {
    if (!user || !order) return

    // Validate at least one rating
    const hasDriverRating = driverRating > 0
    const hasProductRating = Object.values(productRatings).some((r) => r.rating > 0)

    if (!hasDriverRating && !hasProductRating) {
      toast.error(t("يرجى إضافة تقييم واحد على الأقل", "Please add at least one rating"))
      return
    }

    setSubmitting(true)

    try {
      const productsRatingsArray = Object.entries(productRatings)
        .filter(([_, r]) => r.rating > 0)
        .map(([productId, r]) => ({
          product_id: productId,
          rating: r.rating,
          comment: r.comment || undefined,
        }))

      const result = await createOrderReview({
        order_id: resolvedParams.orderId,
        customer_id: user.id,
        driver_id: order.driver_id,
        driver_rating: driverRating > 0 ? driverRating : undefined,
        driver_comment: driverComment || undefined,
        products_ratings: productsRatingsArray.length > 0 ? productsRatingsArray : undefined,
      })

      if (result.success) {
        setSubmitted(true)
      } else {
        toast.error(result.error || t("حدث خطأ", "An error occurred"))
      }
    } catch (_error) {
      toast.error(t("حدث خطأ أثناء إرسال التقييم", "Error submitting review"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <Star className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 text-center py-12">
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">{t("الطلب غير موجود", "Order not found")}</h2>
            <Button 
              onClick={() => router.push("/account")} 
              className="mt-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl"
            >
              {t("العودة للحساب", "Back to Account")}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (alreadyReviewed || submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-xl text-center py-12">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {submitted
                ? t("شكراً لتقييمك! 🎉", "Thank you for your review! 🎉")
                : t("تم تقييم هذا الطلب مسبقاً", "This order has already been reviewed")}
            </h2>
            <p className="text-gray-600 mb-8">
              {t("تقييمك يساعدنا في تحسين خدماتنا", "Your feedback helps us improve our services")}
            </p>
            <Button 
              onClick={() => router.push("/account")} 
              className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              {t("العودة للحساب", "Back to Account")}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 mb-4 shadow-lg shadow-yellow-500/30">
              <Star className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {t("قيّم تجربتك", "Rate Your Experience")}
            </h1>
            <p className="text-gray-600 mt-2">
              {t("ساعدنا في تحسين خدماتنا من خلال تقييمك", "Help us improve by sharing your feedback")}
            </p>
          </div>

          {/* Driver Rating Section */}
          {order.driver_id && (
            <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                    <Truck className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800">{t("تقييم السائق", "Rate the Driver")}</h3>
                    <p className="text-sm text-gray-600">{order.driver_name || t("السائق", "Driver")}</p>
                  </div>
                </div>

                <div className="mb-4 bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-3">{t("كيف كانت خدمة التوصيل؟", "How was the delivery service?")}</p>
                  <StarRating rating={driverRating} onRate={setDriverRating} size="lg" />
                </div>

                <Textarea
                  placeholder={t("أضف تعليقاً (اختياري)...", "Add a comment (optional)...")}
                  value={driverComment}
                  onChange={(e) => setDriverComment(e.target.value)}
                  className="resize-none rounded-xl border-gray-200 focus:border-blue-500"
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {/* Products Rating Section */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-3 text-gray-800">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
                {t("تقييم المنتجات", "Rate the Products")}
              </h3>

              <div className="space-y-6">
                {order.items?.map((item, index) => {
                  const productId = item.product_id || item.id || `product-${index}`
                  return (
                  <div key={productId} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-md">
                        <Image
                          src={item.image_url || "/placeholder.svg"}
                          alt={item.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{item.name || t("منتج", "Product")}</h4>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x {item.price} {t("جنيه", "EGP")}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <StarRating
                        rating={productRatings[productId]?.rating || 0}
                        onRate={(rating) => handleProductRating(productId, rating)}
                      />
                    </div>

                    <Textarea
                      placeholder={t("تعليق على المنتج (اختياري)...", "Comment on product (optional)...")}
                      value={productRatings[productId]?.comment || ""}
                      onChange={(e) => handleProductComment(productId, e.target.value)}
                      className="resize-none text-sm rounded-xl border-gray-200 focus:border-blue-500 bg-white"
                      rows={2}
                    />
                  </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-14 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin me-2" />
                {t("جاري الإرسال...", "Submitting...")}
              </>
            ) : (
              t("إرسال التقييم", "Submit Review")
            )}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
