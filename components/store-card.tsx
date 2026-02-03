"use client"

import { memo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, Tag, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import type { Store } from "../lib/mock-data"
import { useLanguage } from "../lib/language-context"

interface StoreCardProps {
  store: Store
}

const StoreCardComponent = ({ store }: StoreCardProps) => {
  const { t, language } = useLanguage()
  const isRTL = language === "ar"

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="group">
      <Link href={`/store/${store.id}`}>
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full border-0 bg-white shadow-md group-hover:shadow-blue-500/10">
          <div className="aspect-video relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
            {(store as any).activeOffer && (
              <div className="absolute top-3 left-3 z-10">
                <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-none px-3 py-1.5 flex items-center gap-1.5 shadow-lg animate-pulse">
                  <Tag className="h-3.5 w-3.5" />
                  {t("عرض خاص", "Special Offer")} {(store as any).activeOffer.discount_percentage}%
                </Badge>
              </div>
            )}
            <Image
              src={(store as any).image_url || store.logo || "/placeholder.svg"}
              alt={store.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center justify-center gap-2 bg-white/95 backdrop-blur-sm text-gray-900 py-2.5 px-4 rounded-xl text-sm font-medium shadow-lg">
                  <ArrowUpRight className="h-4 w-4" />
                  {t("زيارة المتجر", "Visit Store")}
                </div>
              </div>
            </div>
          </div>
          <CardContent className={`p-5 space-y-3 ${isRTL ? "text-right" : "text-left"}`}>
            {/* الاسم والفئة */}
            <div className={`flex items-start gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"} justify-between`}>
              <h3 className="font-bold text-lg line-clamp-1 flex-1 group-hover:text-blue-600 transition-colors">{store.name}</h3>
              <Badge variant="secondary" className="flex-shrink-0 bg-blue-50 text-blue-700 border-blue-200">
                {store.category}
              </Badge>
            </div>

            {/* العنوان */}
            <div className={`flex items-center gap-2 text-gray-500 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
              <div className="p-1 bg-gray-100 rounded-md">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="line-clamp-1 text-sm">
                {typeof (store as any).address === 'object' && (store as any).address
                  ? `${(store as any).address.city || ''}${(store as any).address.state ? ', ' + (store as any).address.state : ''}${(store as any).address.country ? ', ' + (store as any).address.country : ''}`
                  : (store as any).address || ''}
              </span>
            </div>

            {/* الوصف */}
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{store.description}</p>

            {/* التقييم */}
            <div className={`flex items-center pt-3 border-t border-gray-100 ${isRTL ? "justify-start" : "justify-start"}`}>
              <div className={`flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold text-amber-700">{store.rating}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}

export const StoreCard = memo(StoreCardComponent)