"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, ShoppingBag } from "lucide-react"
import { Card, CardContent } from "./ui/card"
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
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm text-gray-900 py-2.5 px-4 rounded-xl text-sm font-medium shadow-lg">
                  <ShoppingBag className="h-4 w-4" />
                  {t("عرض المنتج", "View Product")}
                </div>
              </div>
            </div>
            {/* Rating Badge */}
            {product.rating > 0 && (
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-md">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-gray-700">{product.rating}</span>
              </div>
            )}
          </div>
          <CardContent className="p-4 space-y-2.5">
            <h3 className="font-bold text-base line-clamp-2 leading-snug text-gray-800 group-hover:text-blue-600 transition-colors">{product.name}</h3>
            {product.storeName && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {product.storeName}
              </p>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                {product.price} <span className="text-sm font-medium text-gray-500">{t("جنيه", "EGP")}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const ProductCard = memo(ProductCardComponent)
