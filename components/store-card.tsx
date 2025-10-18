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
  const { t, language } = useLanguage()
  const isRTL = language === "ar"

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
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
          <CardContent className={`p-4 space-y-3 ${isRTL ? "text-right" : "text-left"}`}>
            {/* الاسم والفئة */}
            <div className={`flex items-start gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"} justify-between`}>
              <h3 className="font-bold text-lg line-clamp-1 flex-1">{store.name}</h3>
              <Badge variant="secondary" className="flex-shrink-0">
                {store.category}
              </Badge>
            </div>

            <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="line-clamp-1">{t("القاهرة، مصر", "Cairo, Egypt")}</span>
            </div>

            {/* الوصف */}
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{store.description}</p>

            {/* التقييم */}
            <div className={`flex items-center pt-2 ${isRTL ? "justify-start" : "justify-start"}`}>
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{store.rating}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
