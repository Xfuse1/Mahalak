// أحداث Meta Pixel القياسية لرحلة الزبون (بحث ← منتج ← سلة ← بدء طلب ← طلب ← حساب).
//
// الحمولة تُبنى هنا وحدها كي يتّفق الشكل بين كل نقاط الإطلاق (contents/value/currency)، وهو ما
// يحتاجه ميتا لتحسين الإعلانات على الطلبات. البناء دوالّ نقية مختبَرة؛ الإطلاق عبر trackMetaEvent
// التي تبتلع أي خطأ — القياس لا يكسر الواجهة أبدًا.
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/utils"

export const META_CURRENCY = "EGP"

export type MetaItem = {
  id: string
  price: number
  quantity?: number
  discount_percentage?: number
  /** سعر وحدة نهائي مقرَّب من السيرفر (سلة البحث الذكي) — يُفضَّل على price/discount إن وُجد. */
  unit_price?: number
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function quantityOf(item: MetaItem): number {
  const n = Math.floor(Number(item.quantity ?? 1))
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** سعر الوحدة بعد الخصم — نفس صيغة السلة وصفحة الدفع. */
export function metaUnitPrice(item: MetaItem): number {
  if (typeof item.unit_price === "number" && Number.isFinite(item.unit_price)) return money(item.unit_price)
  const price = Number(item.price) || 0
  const discount = Number(item.discount_percentage) || 0
  return money(discount > 0 ? price - (price * discount) / 100 : price)
}

export function buildContentsPayload(items: MetaItem[]) {
  const contents = items
    .filter((item) => item && typeof item.id === "string" && item.id)
    .map((item) => ({ id: item.id, quantity: quantityOf(item), item_price: metaUnitPrice(item) }))
  return {
    content_ids: contents.map((c) => c.id),
    contents,
    content_type: "product" as const,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    value: money(contents.reduce((sum, c) => sum + c.item_price * c.quantity, 0)),
    currency: META_CURRENCY,
  }
}

/**
 * بحث: كلمة البحث (search_string) + معرّفات أول النتائج. إرسال الكلمة قرار المالك (2026-11-02) بعد
 * التنبيه أن استعلامات الصيدليات (اسم دواء/عَرَض) بيانات صحية قد تُقيّد ميتا البكسل بسببها —
 * راقب «جودة مجموعة البيانات» في Events Manager. مسار أعراض البحث الذكي لا يمرّ من هنا.
 */
export function trackSearch(query: string, resultIds: string[]) {
  const ids = resultIds.filter((id) => typeof id === "string" && id).slice(0, 10)
  const searchString = (query || "").trim().slice(0, 100)
  trackMetaEvent("Search", {
    ...(searchString ? { search_string: searchString } : {}),
    content_ids: ids,
    content_type: "product",
  })
}

export function trackViewContent(product: MetaItem & { name?: string; category?: string }) {
  trackMetaEvent("ViewContent", {
    ...buildContentsPayload([{ ...product, quantity: 1 }]),
    content_name: product.name,
    content_category: product.category,
  })
}

/**
 * زيارة صفحة متجر — حدث مخصّص لا ViewContent: ViewContent مخصّص لصفحة المنتج، وخلطهما كان يعدّ
 * زيارات المتاجر ضمن مشاهدات المنتجات فتتلخبط أرقام القمع.
 */
export function trackViewStore(store: { id: string; name?: string }) {
  trackMetaCustomEvent("ViewStore", { store_id: store.id, store_name: store.name })
}

export function trackAddToCart(items: MetaItem[]) {
  const payload = buildContentsPayload(items)
  if (payload.content_ids.length === 0) return
  trackMetaEvent("AddToCart", payload)
}

export function trackInitiateCheckout(items: MetaItem[]) {
  const payload = buildContentsPayload(items)
  if (payload.content_ids.length === 0) return
  trackMetaEvent("InitiateCheckout", payload)
}

/**
 * طلب مؤكَّد. eventID = معرّف الطلب: يمنع ميتا من عدّ الطلب مرتين لو أُطلق الحدث مرة ثانية
 * (إعادة محاولة بعد انقطاع)، ويصلح لاحقًا لمطابقة نفس الحدث من Conversions API سيرفر-سايد.
 * القيمة = إجمالي السيرفر (شامل التوصيل) متى وصل، وإلا مجموع الأصناف + التوصيل المعروض.
 */
export function trackPurchase(orderId: string, items: MetaItem[], value: number) {
  const payload = buildContentsPayload(items)
  trackMetaEvent(
    "Purchase",
    { ...payload, value: money(Number.isFinite(value) && value > 0 ? value : payload.value), order_id: orderId },
    orderId ? { eventID: `order-${orderId}` } : undefined,
  )
}

export function trackCompleteRegistration(method: "email" | "google", role: string) {
  trackMetaEvent("CompleteRegistration", { content_name: role, status: true, registration_method: method })
}
