import { cache } from "react"
import type { Metadata } from "next"
import { getProduct } from "@/lib/actions/products"
import { imgSrc } from "@/lib/storage/public-url"
import ProductClient, { type Product } from "./product-client"

// مكوّن سيرفر: المنتج يُقرأ هنا (getProduct مخزَّنة 120 ثانية) ويُرسم داخل HTML الأول، فيرى زائر
// الـ 3G المنتج دون انتظار تحميل JavaScript ثم طلب منفصل. cache() يمنع قراءة ثانية لنفس الطلب بين
// generateMetadata والصفحة.
//
// undefined = تعذّرت القراءة (عطل عابر) ⇒ المكوّن يعيد المحاولة من المتصفح؛ null = غير موجود فعلًا.
const loadProduct = cache(async (id: string): Promise<Product | null | undefined> => {
  try {
    return ((await getProduct(id)) as Product | null) ?? null
  } catch {
    return undefined
  }
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const product = await loadProduct(id)
  if (!product) return { title: "محلك" }
  const storeName = product.stores?.name
  const title = storeName ? `${product.name} - ${storeName} | محلك` : `${product.name} | محلك`
  const description = (product.description || "").slice(0, 160) || `اطلب ${product.name} من محلك`
  const image = product.image_url ? imgSrc(product.image_url) : undefined
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

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await loadProduct(id)
  return <ProductClient id={id} initialProduct={product} />
}
