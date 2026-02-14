import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getProducts } from "@/lib/actions/products"
import { getStores } from "@/lib/actions/stores"
import { CategoryContent } from "@/components/category/category-content"

export default async function CategoryPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decodedCategory = decodeURIComponent(name)

  let products: any[] = []
  let stores: any[] = []
  try {
    const [productsData, storesData] = await Promise.all([
      getProducts(decodedCategory),
      getStores(decodedCategory),
    ])

    products = productsData.map((product: any) => ({
      ...product,
      image: product.image_url,
      storeName: product.stores?.name || "",
    }))
    stores = storesData
  } catch {
    // Page renders with empty data instead of crashing
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <CategoryContent
        category={decodedCategory}
        products={products}
        stores={stores}
      />
      <Footer />
    </div>
  )
}
