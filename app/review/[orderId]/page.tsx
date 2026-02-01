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

export default function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params)
  const { t } = useLanguage()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

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
        const fetchedOrder = await getOrderById(resolvedParams.orderId)
        if (fetchedOrder) {
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
      } catch (error) {
        console.error("Error fetching order:", error)
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
      alert(t("يرجى إضافة تقييم واحد على الأقل", "Please add at least one rating"))
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
        alert(result.error || t("حدث خطأ", "An error occurred"))
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      alert(t("حدث خطأ أثناء إرسال التقييم", "Error submitting review"))
    } finally {
      setSubmitting(false)
    }
  }

  // Star Rating Component
  const StarRating = ({
    rating,
    onRate,
    size = "md",
  }: {
    rating: number
    onRate: (rating: number) => void
    size?: "sm" | "md" | "lg"
  }) => {
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1F478B]" />
              <p className="text-gray-600 mt-4">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 text-center py-12">
            <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{t("الطلب غير موجود", "Order not found")}</h2>
            <Button onClick={() => router.push("/account")} className="mt-4 bg-[#1F478B]">
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
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-xl text-center py-12">
            <CheckCircle className="h-20 w-20 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
              {submitted
                ? t("شكراً لتقييمك! 🎉", "Thank you for your review! 🎉")
                : t("تم تقييم هذا الطلب مسبقاً", "This order has already been reviewed")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t("تقييمك يساعدنا في تحسين خدماتنا", "Your feedback helps us improve our services")}
            </p>
            <Button onClick={() => router.push("/account")} className="bg-[#1F478B]">
              {t("العودة للحساب", "Back to Account")}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <h1 className="text-3xl font-bold mb-2 text-center">
            {t("قيّم تجربتك", "Rate Your Experience")}
          </h1>
          <p className="text-gray-600 text-center mb-8">
            {t("ساعدنا في تحسين خدماتنا من خلال تقييمك", "Help us improve by sharing your feedback")}
          </p>

          {/* Driver Rating Section */}
          {order.driver_id && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-full bg-[#1F478B] flex items-center justify-center text-white text-xl font-bold">
                    <Truck className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{t("تقييم السائق", "Rate the Driver")}</h3>
                    <p className="text-sm text-gray-600">{order.driver_name || t("السائق", "Driver")}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">{t("كيف كانت خدمة التوصيل؟", "How was the delivery service?")}</p>
                  <StarRating rating={driverRating} onRate={setDriverRating} size="lg" />
                </div>

                <Textarea
                  placeholder={t("أضف تعليقاً (اختياري)...", "Add a comment (optional)...")}
                  value={driverComment}
                  onChange={(e) => setDriverComment(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {/* Products Rating Section */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#1F478B]" />
                {t("تقييم المنتجات", "Rate the Products")}
              </h3>

              <div className="space-y-6">
                {order.items?.map((item, index) => {
                  const productId = item.product_id || item.id || `product-${index}`
                  return (
                  <div key={productId} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <Image
                          src={item.image_url || "/placeholder.svg"}
                          alt={item.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name || t("منتج", "Product")}</h4>
                        <p className="text-sm text-gray-500">
                          {item.quantity} x {item.price} {t("جنيه", "EGP")}
                        </p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <StarRating
                        rating={productRatings[productId]?.rating || 0}
                        onRate={(rating) => handleProductRating(productId, rating)}
                      />
                    </div>

                    <Textarea
                      placeholder={t("تعليق على المنتج (اختياري)...", "Comment on product (optional)...")}
                      value={productRatings[productId]?.comment || ""}
                      onChange={(e) => handleProductComment(productId, e.target.value)}
                      className="resize-none text-sm"
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
            className="w-full bg-[#1F478B] hover:bg-[#163a6e]"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
