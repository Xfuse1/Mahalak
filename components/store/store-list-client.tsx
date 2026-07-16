"use client"

import { useState, memo } from "react"
import { Card, CardContent } from "../ui/card"
import { Star, Store as StoreIcon, MapPin } from "lucide-react"
import Link from "next/link"
import { SearchBar } from "../search-bar"
import { useLanguage } from "../../lib/language-context"
import Image from "next/image"
import { searchStores } from "../../lib/actions/stores"
import { SkeletonGrid } from "../ui/skeleton-grid"
import { EmptyState } from "../ui/empty-state"
import { useToast } from "../ui/toast"
import { useUserLocation } from "../../lib/location/user-location"
import { storeDistanceKm, formatDistanceAr } from "../../lib/utils/geo"
import { NearbyControl } from "../nearby-control"
import { imgSrc } from "@/lib/storage/public-url"

type Store = {
  id: string
  name: string
  description: string
  rating: number
  category: string
  image_url: string | null
  phone: string
  address: string
  latitude?: number | null
  longitude?: number | null
}

function StoreCardItem({ store, index }: { store: Store; index: number }) {
  const { coords } = useUserLocation()
  const distance = storeDistanceKm(coords, store)
  return (
    <Link href={`/store/${store.id}`}>
      <Card
        className="border border-border shadow-sm hover:shadow-lg transition-all duration-300 h-full overflow-hidden rounded-2xl group hover:-translate-y-1 bg-card"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="relative h-52 bg-muted overflow-hidden">
          <Image
            src={imgSrc(store.image_url)}
            alt={store.name}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-bold text-sm text-foreground">
              {(store.rating || 0).toFixed(1)}
            </span>
          </div>
          {distance != null && (
            <div className="absolute top-3 left-3 z-10 bg-primary/90 text-primary-foreground rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
              <MapPin className="h-3.5 w-3.5" />
              <span className="font-bold text-xs">{formatDistanceAr(distance)}</span>
            </div>
          )}
        </div>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              {store.name}
            </h3>
            <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium border border-primary/20 flex-shrink-0">
              {store.category}
            </span>
          </div>
          <p className="text-muted-foreground mb-4 line-clamp-2 leading-relaxed text-sm">
            {store.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

const MemoizedStoreCardItem = memo(StoreCardItem)

export function StoreListClient({ initialStores }: { initialStores: Store[] }) {
  const [stores, setStores] = useState<Store[]>(initialStores)
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()
  const toast = useToast()
  const { coords } = useUserLocation()

  // IA-01: ترتيب «الأقرب إليك» — المتاجر بلا إحداثيات تنزل للأسفل (fallback آمن).
  const displayedStores = coords
    ? [...stores].sort((a, b) => {
        const da = storeDistanceKm(coords, a)
        const db = storeDistanceKm(coords, b)
        if (da == null && db == null) return 0
        if (da == null) return 1
        if (db == null) return -1
        return da - db
      })
    : stores

  const handleSearch = async (query: string) => {
    if (query.trim()) {
      setLoading(true)
      try {
        const data = await searchStores(query)
        setStores(data as Store[])
      } catch {
        toast.error(t("تعذّر إجراء البحث. حاول مجددًا", "Search failed. Please try again"))
      } finally {
        setLoading(false)
      }
    } else {
      setStores(initialStores)
    }
  }

  return (
    <>
      <div className="mb-6 max-w-2xl">
        <SearchBar
          placeholder={t("ابحث عن متجر...", "Search for a store...")}
          onSearch={handleSearch}
        />
      </div>

      <div className="mb-8">
        <NearbyControl />
      </div>

      {loading ? (
        <SkeletonGrid variant="store" count={6} />
      ) : displayedStores.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedStores.map((store, index) => (
            <MemoizedStoreCardItem key={store.id} store={store} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={StoreIcon}
          title={t("لم يتم العثور على متاجر", "No stores found")}
          description={t("جرب البحث بكلمات مختلفة", "Try searching with different keywords")}
        />
      )}
    </>
  )
}
