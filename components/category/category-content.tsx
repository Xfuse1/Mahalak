"use client"

import { ProductCard } from "@/components/product-card"
import { StoreCard } from "@/components/store-card"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProductListItem } from "@/lib/types/product"
import type { StoreListItem } from "@/lib/types/store"

interface CategoryContentProps {
  category: string
  products: ProductListItem[]
  stores: StoreListItem[]
}

export function CategoryContent({ category, products, stores }: CategoryContentProps) {
  const { t, language } = useLanguage()
  const isRTL = language === "ar"

  return (
    <main className="flex-1 py-8" dir={isRTL ? "rtl" : "ltr"}>
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <BackButton />
        </div>

        <h1 className={`text-3xl font-bold mb-8 ${isRTL ? "text-right" : "text-left"}`}>
          {t("فئة:", "Category:")} <span className="text-primary">{category}</span>
        </h1>

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
                <p className="text-xl text-muted-foreground mb-4">
                  {t("لا توجد متاجر في هذه الفئة حالياً", "No stores in this category currently")}
                </p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="products">
            {products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} showActions />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-xl text-muted-foreground mb-4">
                  {t("لا توجد منتجات في هذه الفئة حالياً", "No products in this category currently")}
                </p>
                <p className="text-muted-foreground">
                  {t("جرب تصفح فئات أخرى أو استخدم البحث", "Try browsing other categories or use search")}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
