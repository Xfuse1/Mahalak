"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, ShoppingBag, Tag } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { useLanguage } from "../lib/language-context"
import { memo } from "react"

interface ProductCardProduct {
  id: string
  name: string
  price: number
  rating: number
  image?: string | null
  image_url?: string | null
  category?: string
  storeName?: string
  stores?: { name: string } | null
  discount_percentage?: number
}

interface ProductCardProps {
  product: ProductCardProduct
}

function ProductCardComponent({ product }: ProductCardProps) {
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  
  const hasDiscount = product.discount_percentage && product.discount_percentage > 0
  const discountedPrice = hasDiscount 
    ? product.price - (product.price * product.discount_percentage! / 100) 
    : product.price

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-w-0 group">
      <Link href={`/product/${product.id}`}>
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full border border-border bg-card shadow-sm group-hover:shadow-primary/10">
          <div className="aspect-square relative bg-muted overflow-hidden">
            <Image
              src={product.image_url || product.image || "/placeholder.svg"}
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
            {/* Discount Badge */}
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full px-2.5 py-1 flex items-center gap-1 shadow-lg z-10">
                <Tag className="h-3 w-3" />
                <span className="text-xs font-bold">{product.discount_percentage}%</span>
              </div>
            )}
            {/* Rating Badge */}
            {product.rating > 0 && (
              <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-md">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-foreground">{product.rating}</span>
              </div>
            )}
          </div>
          <CardContent className="p-4 space-y-2.5">
            <h3 className="font-bold text-base line-clamp-2 leading-snug text-foreground group-hover:text-primary transition-colors">{product.name}</h3>
            {product.category && (
              <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full w-fit">
                {product.category}
              </span>
            )}
            {product.storeName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                {product.storeName}
              </p>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {hasDiscount ? (
                <div className="flex flex-col">
                  <p className="text-sm text-muted-foreground line-through">
                    {Number(product.price ?? 0).toLocaleString()} {t("جنيه", "EGP")}
                  </p>
                  <p className="text-xl font-extrabold text-primary">
                    {(Number(discountedPrice) || 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xl font-extrabold text-primary">
                  {Number(product.price ?? 0).toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const ProductCard = memo(ProductCardComponent)
