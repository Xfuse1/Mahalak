"use client"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { BackButton } from "@/components/back-button"
import { mockStores, mockProducts } from "@/lib/mock-data"
import { Star, MapPin, Phone, MessageCircle } from "lucide-react"
import { notFound, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"

export default function StorePage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const store = mockStores.find((s) => s.id === params.id)

  if (!store) {
    notFound()
  }

  const storeProducts = mockProducts.filter((p) => p.storeId === store.id)

  const handleWhatsApp = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    const message = t(`مرحباً، أريد الاستفسار عن ${store.name}`, `Hello, I want to inquire about ${store.name}`)
    window.open(`https://wa.me/201055161600?text=${encodeURIComponent(message)}`, "_blank")
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

          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
              <div className="relative h-64 lg:h-full rounded-lg overflow-hidden bg-gray-100">
                <Image src={store.logo || "/placeholder.svg"} alt={store.name} fill className="object-cover" />
              </div>

              {/* Store Info */}
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-bold">{store.name}</h1>
                <p className="text-gray-600 text-lg leading-relaxed">{store.description}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{store.rating}</span>
                    <span className="text-gray-500">
                      ({store.reviewCount} {t("تقييم", "reviews")})
                    </span>
                  </div>
                  <span className="bg-secondary px-4 py-2 rounded-full font-medium">{store.category}</span>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3 p-4 bg-secondary rounded-lg">
                  <MapPin className="h-5 w-5 text-[#1F478B] mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">{t("العنوان", "Address")}</p>
                    <p className="text-gray-600">{t("القاهرة، مصر - شارع التحرير", "Cairo, Egypt - Tahrir Street")}</p>
                  </div>
                </div>

                {/* Contact Buttons */}
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
              </div>
            </div>

            {/* Google Maps */}
            <div className="w-full h-64 rounded-lg overflow-hidden bg-gray-100 mt-6">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3453.1!2d31.2357!3d30.0444!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAyJzM5LjgiTiAzMcKwMTQnMDguNSJF!5e0!3m2!1sen!2seg!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {/* Store Products */}
          <div>
            <h2 className="text-2xl font-bold mb-6">{t("منتجات المتجر", "Store Products")}</h2>
            {storeProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {storeProducts.map((product) => (
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
