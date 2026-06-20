import { Header } from "../../components/header"
import { Footer } from "../../components/footer"
import { BackButton } from "../../components/back-button"
import { getStores } from "../../lib/actions/stores"
import { StoreListClient } from "../../components/store/store-list-client"
import { StorePageHeader } from "../../components/store/store-page-header"

export default async function StoresPage() {
  let allStores: Awaited<ReturnType<typeof getStores>> = []

  try {
    allStores = await getStores()
  } catch {
    // Allow the page to render even when store data is unavailable during build/runtime.
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <StorePageHeader />

          {/* بيانات المتاجر من السيرفر تتطابق بنيويًا مع نوع StoreListClient المحلي */}
          <StoreListClient initialStores={allStores as any} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
