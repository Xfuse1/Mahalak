export interface ProductListItem {
  id: string
  name: string
  price: number
  rating: number
  image: string | null
  image_url?: string | null
  storeName?: string
  createdAt?: string
  updatedAt?: string
  category?: string
  description?: string
  store_id?: string
  stores?: { name: string } | null
}
