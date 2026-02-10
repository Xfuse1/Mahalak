import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { BackButton } from "../../components/back-button"
import { Store as StoreIcon } from "lucide-react"
import { getStores } from "../../lib/actions/stores"
import { StoreListClient } from "../../components/store/store-list-client"

export default async function StoresPage() {
  const allStores = await getStores()

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
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">جميع المتاجر</h1>
              <p className="text-gray-500 text-sm">اكتشف أفضل المتاجر</p>
            </div>
          </div>

          <StoreListClient initialStores={allStores as any[]} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
