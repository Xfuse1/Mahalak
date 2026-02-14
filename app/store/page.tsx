import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { BackButton } from "../../components/back-button"
import { getStores } from "../../lib/actions/stores"
import { StoreListClient } from "../../components/store/store-list-client"
import { StorePageHeader } from "../../components/store/store-page-header"

export default async function StoresPage() {
  const allStores = await getStores()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <StorePageHeader />

          <StoreListClient initialStores={allStores} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
