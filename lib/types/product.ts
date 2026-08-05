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
  stock?: number
  discount_percentage?: number
  // هاتف المتجر للأزرار السريعة (واتساب/اتصال) وإحداثياته لفلتر المسافة — حقول عامة أصلًا
  stores?: { name: string; phone?: string | null; latitude?: number | null; longitude?: number | null } | null
}
