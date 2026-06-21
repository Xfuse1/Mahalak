// منطق احتساب الخصم من العروض — وحدة مشتركة (سيرفر-سايد) يستخدمها كلٌّ من
// عرض المنتجات وإنشاء الطلبات، حتى يُحاسَب العميل بالسعر المخفّض نفسه الذي رآه.
// ملاحظة: تستورد firebase-admin لذا تُستخدم في سياق السيرفر فقط (لا في مكوّنات العميل).
import { getAdminDb } from "@/lib/firebase/admin"

export type OfferRecord = {
  product_id?: string
  category?: string
  store_id?: string
  title?: string | null
  discount_percentage?: number
  start_date?: string
  end_date?: string
  [key: string]: unknown
}

/**
 * يختار أعلى خصم فعّال مُطبَّق على المنتج بين العروض المطابقة (المنتج/الفئة/المتجر) —
 * الأكبر نسبةً يفوز (وليست أولوية تخصّص صارمة). المقارنة بصيغة YYYY-MM-DD (date-only)
 * لتطابق طريقة تخزين تواريخ العروض.
 */
export function findBestDiscount(
  product: { id: string; category?: string; store_id?: string },
  activeOffers: OfferRecord[],
  today: string,
): { discount_percentage: number; offer_title: string | null } {
  let bestDiscount = 0
  let offerTitle: string | null = null

  for (const offer of activeOffers) {
    if ((offer.start_date && offer.start_date > today) || (offer.end_date && offer.end_date < today)) continue
    const d = Number(offer.discount_percentage ?? 0)
    if (d <= bestDiscount) continue

    if (offer.product_id === product.id && offer.store_id === product.store_id) {
      bestDiscount = d
      offerTitle = offer.title || null
    } else if (!offer.product_id && offer.category === product.category && offer.store_id === product.store_id) {
      if (d > bestDiscount) { bestDiscount = d; offerTitle = offer.title || null }
    } else if (!offer.product_id && !offer.category && offer.store_id === product.store_id) {
      if (d > bestDiscount) { bestDiscount = d; offerTitle = offer.title || null }
    }
  }

  return { discount_percentage: bestDiscount, offer_title: offerTitle }
}

/**
 * السعر بعد تطبيق أفضل خصم فعّال (أو السعر الكامل إن لا يوجد خصم).
 */
export function applyOfferDiscount(
  product: { id: string; category?: string; store_id?: string; price: number },
  activeOffers: OfferRecord[],
  today: string = new Date().toISOString().split("T")[0],
): number {
  const { discount_percentage } = findBestDiscount(product, activeOffers, today)
  if (discount_percentage > 0) {
    return Math.max(0, product.price - (product.price * discount_percentage) / 100)
  }
  return product.price
}

/**
 * يجلب عروض المتاجر المحدّدة دفعةً واحدة (تقسيم لكل 10 بسبب حد Firestore على in).
 */
export async function getActiveOffersForStores(storeIds: string[]): Promise<OfferRecord[]> {
  const ids = Array.from(new Set(storeIds.filter(Boolean)))
  if (!ids.length) return []
  const db = getAdminDb()
  const offers: OfferRecord[] = []
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    const snap = await db.collection("offers").where("store_id", "in", chunk).get()
    snap.docs.forEach((d) => offers.push(d.data() as OfferRecord))
  }
  return offers
}
