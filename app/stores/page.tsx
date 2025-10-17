"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { mockStores } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import { Star } from "lucide-react"
import Link from "next/link"
import { SearchBar } from "@/components/search-bar"
import { BackButton } from "@/components/back-button"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"

export default function StoresPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { t } = useLanguage()

  const filteredStores = mockStores.filter(
    (store) =>
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.category.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <h1 className="text-3xl font-bold mb-6">{t("جميع المتاجر", "All Stores")}</h1>

          <div className="mb-8 max-w-2xl">
            <SearchBar placeholder={t("ابحث عن متجر...", "Search for a store...")} onSearch={handleSearch} />
          </div>

          {/* Stores Grid */}
          {filteredStores.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStores.map((store) => (
                <Link key={store.id} href={`/store/${store.id}`}>
                  <Card className="hover:shadow-lg transition-shadow h-full overflow-hidden">
                    <div className="relative h-48 bg-gray-100">
                      <Image src={store.logo || "/placeholder.svg"} alt={store.name} fill className="object-cover" />
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-2">{store.name}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2 leading-relaxed">{store.description}</p>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{store.rating}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          ({store.reviewCount} {t("تقييم", "reviews")})
                        </span>
                      </div>
                      <div>
                        <span className="inline-block bg-secondary px-3 py-1 rounded-full text-sm font-medium">
                          {store.category}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">{t("لم يتم العثور على متاجر", "No stores found")}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
