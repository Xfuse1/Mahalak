"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, Plus, Store, ShoppingBag } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import type { Product } from "../lib/mock-data"
import { useLanguage } from "../lib/language-context"
import { memo } from "react"

interface ProductCardProps {
  product: Product
}

function ProductCardComponent({ product }: ProductCardProps) {
  const { t, language } = useLanguage()
  const isRTL = language === "ar"

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-w-0 group">
      <Link href={`/product/${product.id}`}>
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full border-0 bg-white shadow-md group-hover:shadow-blue-500/10">
          <div className="aspect-square relative bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
            <Image
              src={(product as any).image_url || product.image || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            {/* Rating & Discount Badge */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              <Badge className="bg-white/90 backdrop-blur-md text-blue-600 border-0 shadow-sm font-bold">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                {product.rating || "0.0"}
              </Badge>
              {product.activeOffer && (
                <Badge className="bg-rose-500 text-white border-0 shadow-md font-bold animate-pulse">
                  {product.activeOffer.discount_percentage}% {t("خصم", "OFF")}
                </Badge>
              )}
            </div>

            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm text-gray-900 py-2.5 px-4 rounded-xl text-sm font-medium shadow-lg">
                  <ShoppingBag className="h-4 w-4" />
                  {t("عرض المنتج", "View Product")}
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-4 md:p-5 flex-grow flex flex-col">
            <div className="mb-2">
              <p className="text-[10px] md:text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 opacity-80">{product.category}</p>
              <h3 className="font-bold text-gray-800 text-sm md:text-base line-clamp-1 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
            </div>

            {product.stores?.name && (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <Store className="w-3 h-3 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium line-clamp-1">{product.stores.name}</span>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex flex-col">
                {product.activeOffer ? (
                  <>
                    <span className="text-[10px] text-gray-400 line-through">
                      {product.price.toFixed(2)} {t("جنيه", "EGP")}
                    </span>
                    <span className="text-base md:text-lg font-black text-rose-600">
                      {(product.price * (1 - product.activeOffer.discount_percentage / 100)).toFixed(2)}
                      <span className="text-[10px] md:text-xs ml-1 text-gray-500 font-normal">{t("جنيه", "EGP")}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-base md:text-lg font-black bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
                    {product.price.toFixed(2)}
                    <span className="text-[10px] md:text-xs ml-1 text-gray-500 font-normal">{t("جنيه", "EGP")}</span>
                  </span>
                )}
              </div>
              <Button size="icon" className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-110 active:scale-95">
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const ProductCard = memo(ProductCardComponent)
