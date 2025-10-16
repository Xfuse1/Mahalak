"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/back-button"
import { mockProducts } from "@/lib/mock-data"
import { Star, ShoppingCart, Minus, Plus, MessageCircle, Phone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"

export default function ProductPage({ params }: { params: { id: string } }) {
  const { id } = params
  const product = mockProducts.find((p) => p.id === id)
  const [quantity, setQuantity] = useState(1)
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  if (!product) {
    notFound()
  }

  const relatedProducts = mockProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4)

  const handleAddToCart = () => {
    alert(t(`تمت إضافة ${quantity} من ${product.name} إلى السلة`, `Added ${quantity} of ${product.name} to cart`))
  }

  const handleWhatsApp = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    window.open(
      `https://wa.me/201055161600?text=${t(`مرحباً، أريد الاستفسار عن ${product.name}`, `Hello, I want to inquire about ${product.name}`)}`,
      "_blank",
    )
  }

  const handleCall = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    window.location.href = "tel:01055161600"
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          {/* Product Details - Above the Fold */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Product Image */}
            <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
              <Image src={product.image || "/placeholder.svg"} alt={product.name} fill className="object-cover" />
            </div>

            {/* Product Info */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-balance">{product.name}</h1>

              <Link href={`/store/${product.storeId}`} className="text-[#1F478B] hover:underline block">
                {product.storeName}
              </Link>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-lg">{product.rating}</span>
                </div>
                <span className="text-gray-500">
                  ({product.reviewCount} {t("تقييم", "reviews")})
                </span>
              </div>

              <p className="text-4xl font-bold text-[#1F478B]">
                {product.price} {t("جنيه", "EGP")}
              </p>

              <p className="text-gray-700 leading-relaxed">{product.description}</p>

              <div>
                <p className="text-sm text-gray-600 mb-3">
                  {t("الكمية المتاحة:", "Available quantity:")} {product.stock}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="px-6 font-medium">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="lg"
                    className="flex-1 bg-[#1F478B] hover:bg-[#1a3a70]"
                    onClick={handleAddToCart}
                    disabled={product.stock === 0}
                  >
                    <ShoppingCart className="ml-2 h-5 w-5" />
                    {product.stock > 0 ? t("أضف إلى السلة", "Add to Cart") : t("غير متوفر", "Out of Stock")}
                  </Button>
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

              <div className="bg-secondary p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{t("الفئة:", "Category:")}</span> {product.category}
                </p>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">{t("منتجات مشابهة", "Similar Products")}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((relatedProduct) => (
                  <div key={relatedProduct.id}>
                    <Link href={`/product/${relatedProduct.id}`}>
                      <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden mb-3">
                        <Image
                          src={relatedProduct.image || "/placeholder.svg"}
                          alt={relatedProduct.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <h3 className="font-semibold mb-1 line-clamp-2 text-balance">{relatedProduct.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{relatedProduct.storeName}</p>
                      <p className="font-bold text-[#1F478B]">
                        {relatedProduct.price} {t("جنيه", "EGP")}
                      </p>
                    </Link>
                  </div>
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
