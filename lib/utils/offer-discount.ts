// منطق احتساب الخصم من العروض — وحدة مشتركة (سيرفر-سايد) يستخدمها كلٌّ من
// عرض المنتجات وإنشاء الطلبات، حتى يُحاسَب العميل بالسعر المخفّض نفسه الذي رآه.
// ملاحظة: تستورد firebase-admin لذا تُستخدم في سياق السيرفر فقط (لا في مكوّنات العميل).
import { getAdminDb } from "@/lib/firebase/admin"
// قواعد الفعالية (توقيت القاهرة + نافذة الفلاش) تعيش في وحدة نقية يشاركها العميل — نسخة ثانية
// منها هنا كانت ستفترق عمّا تعرضه صفحة المتجر فيرى العميل حملة بسعر لا يطابقها.
import { cairoNow, isOfferActiveNow } from "@/lib/utils/offer-active"

export type OfferRecord = {
  id?: string
  product_id?: string
  category?: string
  store_id?: string
  title?: string | null
  discount_percentage?: number
  start_date?: string
  end_date?: string
  quantity?: number
  duration_hours?: number
  used_quantity?: number
  [key: string]: unknown
}

/**
 * يختار أعلى خصم فعّال مُطبَّق على المنتج بين العروض المطابقة (المنتج/الفئة/المتجر) — الأكبر
 * نسبةً يفوز. الفعالية تُحسب بتوقيت القاهرة مع عروض الفلاش بالساعات، ويُتخطّى العرض المنتهية كميته.
 * (المعامل today متروك للتوافق مع المستدعين لكنه لم يعد يُستخدم — الوقت يُحسب داخليًا.)
 */
export function findBestDiscount(
  product: { id: string; category?: string; store_id?: string },
  activeOffers: OfferRecord[],
  _today?: string,
): { discount_percentage: number; offer_title: string | null; offer_id: string | null } {
  const { date: cairoToday, hourFraction } = cairoNow()
  let bestDiscount = 0
  let offerTitle: string | null = null
  let offerId: string | null = null

  for (const offer of activeOffers) {
    if (!isOfferActiveNow(offer, cairoToday, hourFraction)) continue
    // حد الكمية المتاحة للعرض (إن وُجد) — لا يُطبَّق الخصم بعد نفادها
    const cap = Number(offer.quantity)
    if (Number.isFinite(cap) && cap > 0 && Number(offer.used_quantity || 0) >= cap) continue

    const d = Number(offer.discount_percentage ?? 0)
    if (d <= bestDiscount) continue

    const matches =
      (offer.product_id === product.id && offer.store_id === product.store_id) ||
      (!offer.product_id && offer.category === product.category && offer.store_id === product.store_id) ||
      (!offer.product_id && !offer.category && offer.store_id === product.store_id)
    if (matches) {
      bestDiscount = d
      offerTitle = offer.title || null
      offerId = (offer.id as string | undefined) || null
    }
  }

  return { discount_percentage: bestDiscount, offer_title: offerTitle, offer_id: offerId }
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
    // تقريب لأقرب قرش — يمنع تسرّب كسور المليم في مبلغ الطلب (COD) واختلافه عن product-pricing.
    const discounted = product.price - (product.price * discount_percentage) / 100
    return Math.max(0, Math.round(discounted * 100) / 100)
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
    // نرفق معرّف المستند — بدونه offer.id يبقى undefined فينهار تتبّع حد الكمية (used_quantity)
    snap.docs.forEach((d) => offers.push({ id: d.id, ...(d.data() as OfferRecord) }))
  }
  return offers
}
