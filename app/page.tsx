import { Header } from "../components/header"
import { Footer } from "../components/footer"
import { getProducts } from "../lib/actions/products"
import { getStores } from "../lib/actions/stores"
import {
  HeroBanner,
  SearchSection,
  CategoriesSection,
  FeaturedStores,
  FeaturedProducts,
  CTASection,
} from "../components/home/home-client-sections"

export default async function Home() {
  // Fetch data on the server — no loading spinner needed
  const [allProducts, allStores] = await Promise.all([
    getProducts(),
    getStores(),
  ])
  const featuredProducts = allProducts.slice(0, 6)
  const featuredStores = allStores.slice(0, 4)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <HeroBanner />
        <SearchSection />
        <CategoriesSection />
        <FeaturedStores stores={featuredStores} />
        <FeaturedProducts products={featuredProducts} />
        <CTASection />
      </main>

      <Footer />
    </div>
  )
}
