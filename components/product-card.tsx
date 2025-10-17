"use client"

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Product } from "@/lib/mock-data"
import { useLanguage } from "@/lib/language-context"

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useLanguage()

  return (
    <Link href={`/product/${product.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="aspect-square relative bg-gray-100">
          <Image src={product.image || "/placeholder.svg"} alt={product.name} fill className="object-cover" />
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-base mb-1 line-clamp-2 text-balance leading-snug">{product.name}</h3>
          <p className="text-sm text-gray-600">{product.storeName}</p>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{product.rating}</span>
            <span className="text-sm text-gray-500">({product.reviewCount})</span>
          </div>
          <p className="text-xl font-bold text-[#1F478B] pt-1">
            {product.price} {t("جنيه", "EGP")}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
