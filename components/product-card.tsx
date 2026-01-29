"use client"

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
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
    <div dir={isRTL ? "rtl" : "ltr"} className="min-w-0">
      <Link href={`/product/${product.id}`}>
        <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full text-right">
          <div className="aspect-square relative bg-gray-100">
            <Image
              src={(product as any).image_url || product.image || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover"
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          </div>
          <CardContent className="p-4 space-y-2 text-right">
            <h3 className="font-semibold text-base mb-1 line-clamp-2 text-balance leading-snug break-all">{product.name}</h3>
            <p className="text-sm text-gray-600">{product.storeName}</p>
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-medium">{product.rating}</span>
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xl font-bold text-[#1F478B] pt-1">
              {product.price} {t("جنيه", "EGP")}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

// Export memoized version to prevent unnecessary re-renders
export const ProductCard = memo(ProductCardComponent)
