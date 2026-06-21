export interface StoreListItem {
  id: string
  name: string
  description: string
  rating: number
  category: string
  image_url: string | null
  phone?: string
  address?: string | { street?: string; city?: string; state?: string } | null
  logo?: string | null
  latitude?: number | null
  longitude?: number | null
  activeOffer?: { discount_percentage: number } | null
}
