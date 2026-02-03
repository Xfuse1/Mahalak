"use client"

import { useState, useEffect } from "react"
import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { Card, CardContent } from "../../components/ui/card"
import { Star, Store as StoreIcon } from "lucide-react"
import Link from "next/link"
import { SearchBar } from "../../components/search-bar"
import { BackButton } from "../../components/back-button"
import { useLanguage } from "../../lib/language-context"
import Image from "next/image"
import { getStores, searchStores } from "../../lib/actions/stores"

type Store = {
  id: string
  name: string
  description: string
  rating: number
  category: string
  image_url: string | null
  phone: string
  address: string
}

export default function StoresPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    const fetchStores = async () => {
      setLoading(true)
      const data = await getStores()
      setStores(data as Store[])
      setLoading(false)
    }
    fetchStores()
  }, [])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      setLoading(true)
      const data = await searchStores(query)
      setStores(data as Store[])
      setLoading(false)
    } else {
      // If search is cleared, fetch all stores again
      setLoading(true)
      const data = await getStores()
      setStores(data as Store[])
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <div className="flex items-center gap-3 mb-6 mt-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg">
              <StoreIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("جميع المتاجر", "All Stores")}</h1>
              <p className="text-gray-500 text-sm">{t("اكتشف أفضل المتاجر", "Discover the best stores")}</p>
            </div>
          </div>

          <div className="mb-10 max-w-2xl">
            <SearchBar placeholder={t("ابحث عن متجر...", "Search for a store...")} onSearch={handleSearch} />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gradient-to-br from-gray-200 to-gray-300 h-48 rounded-2xl mb-4"></div>
                  <div className="bg-gray-200 h-5 rounded-xl w-3/4 mb-3"></div>
                  <div className="bg-gray-200 h-4 rounded-xl w-full mb-2"></div>
                  <div className="bg-gray-200 h-4 rounded-xl w-1/2"></div>
                </div>
              ))}
            </div>
          ) : stores.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.map((store, index) => (
                <Link key={store.id} href={`/store/${store.id}`}>
                  <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 h-full overflow-hidden rounded-2xl group hover:-translate-y-2 bg-white" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                      <Image
                        src={store.image_url || "/placeholder.svg"}
                        alt={store.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      {/* Rating Badge */}
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-bold text-sm text-gray-700">{(store.rating || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{store.name}</h3>
                        <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 flex-shrink-0">
                          {store.category}
                        </span>
                      </div>
                      <p className="text-gray-500 mb-4 line-clamp-2 leading-relaxed text-sm">{store.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                <StoreIcon className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-500 text-xl font-medium">{t("لم يتم العثور على متاجر", "No stores found")}</p>
              <p className="text-gray-400 mt-2">{t("جرب البحث بكلمات مختلفة", "Try searching with different keywords")}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
