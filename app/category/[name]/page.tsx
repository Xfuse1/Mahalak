"use client"
import React from "react"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { StoreCard } from "@/components/store-card"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import { getProducts } from "@/lib/actions/products"
import { getStores } from "@/lib/actions/stores"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CategoryPage({ params }: { params: { name: string } }) {
  // Next.js 14+: params may be a Promise, unwrap with React.use()
  const unwrappedParams = typeof params === "object" && "then" in params
    ? React.use(params as unknown as Promise<{ name: string }>)
    : (params as { name: string });
  const { name } = unwrappedParams;
  const decodedCategory = decodeURIComponent(name);
  const { t } = useLanguage()

  const [products, setProducts] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [productsData, storesData] = await Promise.all([
        getProducts(decodedCategory),
        getStores(decodedCategory),
      ])

      // Transform products to map image_url to image for ProductCard
      const transformedProducts = productsData.map((product: any) => ({
        ...product,
        image: product.image_url,
        storeName: product.stores?.name || "",
      }))

      setProducts(transformedProducts)
      setStores(storesData)
      setLoading(false)
    }

    fetchData()
  }, [decodedCategory])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8" dir="rtl">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8 text-right">
            {t("فئة:", "Category:")} <span className="text-[#1F478B]">{decodedCategory}</span>
          </h1>

          {loading ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          ) : (
            <Tabs defaultValue="stores" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-sm mx-auto">
                <TabsTrigger value="stores">{t("المتاجر", "Stores")}</TabsTrigger>
                <TabsTrigger value="products">{t("المنتجات", "Products")}</TabsTrigger>
              </TabsList>
              <TabsContent value="stores">
                {stores.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                    {stores.map((store) => (
                      <StoreCard key={store.id} store={store} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-xl text-gray-500 mb-4">
                      {t("لا توجد متاجر في هذه الفئة حالياً", "No stores in this category currently")}
                    </p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="products">
                {products.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                    {products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-xl text-gray-500 mb-4">
                      {t("لا توجد منتجات في هذه الفئة حالياً", "No products in this category currently")}
                    </p>
                    <p className="text-gray-400">
                      {t("جرب تصفح فئات أخرى أو استخدم البحث", "Try browsing other categories or use search")}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
