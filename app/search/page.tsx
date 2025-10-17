"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mockProducts, mockStores } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Star } from "lucide-react"
import { SearchBar } from "@/components/search-bar"
import { FilterSort } from "@/components/filter-sort"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [activeTab, setActiveTab] = useState("products")
  const { t } = useLanguage()

  const filteredProducts = mockProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.description.toLowerCase().includes(query.toLowerCase()) ||
      product.storeName.toLowerCase().includes(query.toLowerCase()),
  )

  const filteredStores = mockStores.filter(
    (store) =>
      store.name.toLowerCase().includes(query.toLowerCase()) ||
      store.description.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <h1 className="text-3xl font-bold mb-6">
            {t("نتائج البحث عن:", "Search results for:")} <span className="text-[#1F478B]">{query}</span>
          </h1>

          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchBar placeholder={t("ابحث عن منتجات، متاجر...", "Search for products, stores...")} />
            </div>
            <FilterSort />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="products" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                {t("المنتجات", "Products")} ({filteredProducts.length})
              </TabsTrigger>
              <TabsTrigger value="stores" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                {t("المتاجر", "Stores")} ({filteredStores.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">{t("لم يتم العثور على منتجات", "No products found")}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stores">
              {filteredStores.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredStores.map((store) => (
                    <Link key={store.id} href={`/store/${store.id}`}>
                      <Card className="hover:shadow-lg transition-shadow h-full overflow-hidden">
                        <div className="relative h-48 bg-gray-100">
                          <Image
                            src={store.logo || "/placeholder.svg"}
                            alt={store.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <CardContent className="p-6">
                          <h3 className="text-xl font-bold mb-2">{store.name}</h3>
                          <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">{store.description}</p>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium">{store.rating}</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              ({store.reviewCount} {t("تقييم", "reviews")})
                            </span>
                          </div>
                          <div>
                            <span className="inline-block bg-secondary px-3 py-1 rounded-full text-sm font-medium">
                              {store.category}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">{t("لم يتم العثور على متاجر", "No stores found")}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>جاري التحميل...</div>}>
      <SearchResults />
    </Suspense>
  )
}
