export type CheckoutItem = {
  id: string
  name: string
  price: number
  category?: string
  image_url?: string | null
  store_id?: string
  store_name?: string
  description?: string
  quantity: number
  stock?: number
  discount_percentage?: number
  /** من أين أُضيف الصنف («ai_search»). للقياس فقط — لا يمسّ سعرًا ولا كمية. */
  source?: string
}
