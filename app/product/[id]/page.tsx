"use client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/back-button"
import { Star, MessageCircle, Phone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { useEffect, useState } from "react"
import { getProduct, getRelatedProducts } from "@/lib/actions/products"
import { createContactInquiry } from "@/lib/actions/orders"

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
  stores?: {
    id: string
    name: string
    phone?: string
  }
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const [product, setProduct] = useState<Product | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const productData = await getProduct(id)
        if (!productData) {
          notFound()
          return
        }

        setProduct(productData as Product)

        const related = await getRelatedProducts(id, productData.category, 4)
        setRelatedProducts(related as Product[])

        setLoading(false)
      } catch (error) {
        console.error("[v0] Error fetching product:", error)
        setProduct(null)
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <p className="text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    notFound()
  }

  const handleWhatsApp = async () => {
    if (!user) {
      router.push("/auth")
      return
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
    } catch (error) {
      console.error("[v0] Error saving WhatsApp inquiry:", error)
    }

    const arMessage = `مرحباً، أريد الاستفسار عن ${product.name}`
    const enMessage = `Hello, I want to inquire about ${product.name}`
    const message = t(arMessage, enMessage)
    const phone = product.stores?.phone || "201055161600"
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleCall = async () => {
    if (!user) {
      router.push("/auth")
      return
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
    } catch (error) {
      console.error("[v0] Error saving call inquiry:", error)
    }

    const phone = product.stores?.phone || "01055161600"
    window.location.href = `tel:${phone}`
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
              <Image src={product.image_url || "/placeholder.svg"} alt={product.name} fill className="object-cover" />
            </div>

            {/* Product Info */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-balance">{product.name}</h1>

              <Link href={`/store/${product.store_id}`} className="text-[#1F478B] hover:underline block">
                {product.stores?.name || t("المتجر", "Store")}
              </Link>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-lg">{product.rating}</span>
                </div>
              </div>

              <p className="text-4xl font-bold text-[#1F478B]">
                {product.price} {t("جنيه", "EGP")}
              </p>

              <p className="text-gray-700 leading-relaxed">{product.description}</p>

              <div>
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                      product.stock > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {product.stock > 0 ? t("🟢 متوفر", "🟢 Available") : t("🔴 غير متوفر", "🔴 Out of Stock")}
                  </span>
                </div>

                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 font-medium">
                    {t("لطلب المنتج، تواصل مع البائع", "To order, contact the seller")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleWhatsApp}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={product.stock === 0}
                >
                  <MessageCircle className="ml-2 h-5 w-5" />
                  {t("تواصل واتساب", "WhatsApp")}
                </Button>
                <Button
                  onClick={handleCall}
                  variant="outline"
                  className="flex-1 bg-transparent"
                  disabled={product.stock === 0}
                >
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
                          src={relatedProduct.image_url || "/placeholder.svg"}
                          alt={relatedProduct.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <h3 className="font-semibold mb-1 line-clamp-2 text-balance">{relatedProduct.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {relatedProduct.stores?.name || t("المتجر", "Store")}
                      </p>
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-sm">{relatedProduct.rating}</span>
                      </div>
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
