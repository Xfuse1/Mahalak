"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { BackButton } from "@/components/back-button"
import { mockProducts } from "@/lib/mock-data"
import { useLanguage } from "@/lib/language-context"

export default function CategoryPage({ params }: { params: { name: string } }) {
  const { name } = params
  const decodedCategory = decodeURIComponent(name)
  const { t } = useLanguage()

  const categoryProducts = mockProducts.filter((p) => p.category === decodedCategory)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8">
            {t("فئة:", "Category:")} <span className="text-[#1F478B]">{decodedCategory}</span>
          </h1>

          {categoryProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500 mb-4">
                {t("لا توجد منتجات في هذه الفئة حالياً", "No products in this category currently")}
              </p>
              <p className="text-gray-400">
                {t("جرب تصفح فئات أخرى أو استخدم البحث", "Try browsing other categories or use search")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
