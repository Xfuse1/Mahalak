import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getStore } from "@/lib/actions/stores"
import { getProductsByStoreId, getStoreTopSellers } from "@/lib/actions/products"
import { getStoreOffers } from "@/lib/actions/offers"
import { imgSrc } from "@/lib/storage/public-url"
import StoreClient from "./store-client"
import { activeStoreOffers, toStoreProducts, type Store, type StoreInitialData } from "./store-data"

// مكوّن سيرفر: المتجر ومنتجاته يُقرؤون هنا بالتوازي ويُرسمون داخل HTML الأول. على السيرفر القراءة
// قريبة من Firestore، بدل أن ينتظر موبايل الزائر JavaScript ثم أربع رحلات شبكة متتالية.
// getStore مخزَّنة 120 ثانية، ومنتجات المتجر العامة 60 ثانية (lib/actions/products.ts).

// undefined = تعذّرت القراءة (عطل عابر) ⇒ المكوّن يجلب من المتصفح؛ null = المتجر غير موجود.
const loadStore = cache(async (id: string): Promise<Store | null | undefined> => {
  try {
    return ((await getStore(id)) as Store | null) ?? null
  } catch {
    return undefined
  }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const store = await loadStore(id)
  if (!store) return { title: "محلك" }
  const title = `${store.name} | محلك`
  const description = (store.description || "").slice(0, 160) || `تسوّق من ${store.name} على محلك`
  const image = store.image_url ? imgSrc(store.image_url) : undefined
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(image && image.startsWith("http") ? { images: [{ url: image }] } : {}),
    },
  }
}

export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = await loadStore(id)
  if (store === null) notFound()
  if (!store) return <StoreClient id={id} />

  // نفس سياسة الفشل في المتصفح: العروض والمنتجات تفشل إلى قائمة فارغة، و«الأكثر مبيعًا» تحسين لا شرط
  const [offersData, productsData, topSellerIds] = await Promise.all([
    getStoreOffers(id).catch(() => []),
    getProductsByStoreId(id).catch(() => []),
    getStoreTopSellers(id).catch(() => [] as string[]),
  ])

  const initial: StoreInitialData = {
    store,
    products: toStoreProducts(productsData as unknown[], store),
    offers: activeStoreOffers(offersData as unknown[]),
    topSellerIds,
  }
  return <StoreClient id={id} initial={initial} />
}
