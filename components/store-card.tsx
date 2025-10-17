"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Store } from "@/lib/mock-data"
import { useLanguage } from "@/lib/language-context"

interface StoreCardProps {
  store: Store
}

export function StoreCard({ store }: StoreCardProps) {
  const { t } = useLanguage()

  return (
    <Link href={`/store/${store.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] h-full">
        <div className="aspect-video relative bg-gray-100">
          <Image
            src={store.logo || "/placeholder.svg?height=200&width=300"}
            alt={store.name}
            fill
            className="object-cover"
          />
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-lg line-clamp-1">{store.name}</h3>
            <Badge variant="secondary" className="shrink-0">
              {store.category}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{store.description}</p>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{store.rating}</span>
              <span className="text-sm text-gray-500">({store.reviewCount})</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{t("قريب منك", "Nearby")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
