// Mock data for the Mahalak e-commerce platform

export interface Store {
  id: string
  name: string
  description: string
  logo?: string
  rating: number
  reviewCount: number
  sellerId: string
  category: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  storeId: string
  storeName: string
  category: string
  stock: number
  rating: number
  reviewCount: number
  stores?: {
    id?: string
    name: string
    category?: string
    phone?: string
    address?: string
  }
  activeOffer?: {
    discount_percentage: number
    title: string
  }
}

// Subcategories for grocery and food stores
export const grocerySubcategories = [
  { id: "bakery", name: "المخبز", icon: "🥖" },
  { id: "produce", name: "الخضروات والفواكه", icon: "🥬" },
  { id: "dairy", name: "الألبان والأجبان", icon: "🥛" },
  { id: "meat", name: "اللحوم والأسماك", icon: "🥩" },
  { id: "beauty", name: "الصحة والجمال", icon: "💄" },
  { id: "grocery", name: "البقالة", icon: "🛒" },
  { id: "drinks", name: "المشروبات والوجبات الخفيفة", icon: "🥤" },
  { id: "cleaning", name: "المنظفات والورقيات", icon: "🧹" },
  { id: "other", name: "أخرى", icon: "📦" },
]

// Subcategories mapped to each store category
export const storeCategorySubcategories: Record<string, { id: string; name: string; icon: string }[]> = {
  // بقالة - Grocery
  "بقالة": [
    { id: "bakery", name: "المخبز", icon: "🥖" },
    { id: "produce", name: "الخضروات والفواكه", icon: "🥬" },
    { id: "dairy", name: "الألبان والأجبان", icon: "🥛" },
    { id: "meat", name: "اللحوم والأسماك", icon: "🥩" },
    { id: "grocery", name: "البقالة", icon: "🛒" },
    { id: "drinks", name: "المشروبات", icon: "🥤" },
    { id: "snacks", name: "الوجبات الخفيفة", icon: "🍿" },
    { id: "canned", name: "المعلبات والحبوب", icon: "🥫" },
    { id: "frozen", name: "المجمدات", icon: "🧊" },
    { id: "cleaning", name: "المنظفات والورقيات", icon: "🧹" },
    { id: "baby", name: "مستلزمات الأطفال", icon: "🍼" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // صحة - Health & Pharmacy
  "صحة": [
    { id: "medicine", name: "الأدوية", icon: "💊" },
    { id: "vitamins", name: "الفيتامينات والمكملات", icon: "💪" },
    { id: "skincare", name: "العناية بالبشرة", icon: "🧴" },
    { id: "haircare", name: "العناية بالشعر", icon: "💇" },
    { id: "personal_care", name: "العناية الشخصية", icon: "🧼" },
    { id: "medical_devices", name: "الأجهزة الطبية", icon: "🩺" },
    { id: "baby_care", name: "رعاية الأطفال", icon: "👶" },
    { id: "optical", name: "النظارات والعدسات", icon: "👓" },
    { id: "fitness", name: "اللياقة والرياضة", icon: "🏋️" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // ملابس - Clothing
  "ملابس": [
    { id: "tshirts", name: "تيشيرتات", icon: "👕" },
    { id: "pants", name: "بنطلونات", icon: "👖" },
    { id: "dresses", name: "فساتين", icon: "👗" },
    { id: "shirts", name: "قمصان", icon: "👔" },
    { id: "jackets", name: "جواكت وأكوات", icon: "🧥" },
    { id: "shoes", name: "أحذية", icon: "👟" },
    { id: "bags", name: "شنط", icon: "👜" },
    { id: "accessories", name: "إكسسوارات", icon: "⌚" },
    { id: "underwear", name: "ملابس داخلية", icon: "🩲" },
    { id: "kids_clothing", name: "ملابس أطفال", icon: "👶" },
    { id: "sportswear", name: "ملابس رياضية", icon: "🏃" },
    { id: "hijab", name: "حجاب وأوشحة", icon: "🧕" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // إلكترونيات - Electronics
  "إلكترونيات": [
    { id: "phones", name: "هواتف", icon: "📱" },
    { id: "laptops", name: "لابتوبات", icon: "💻" },
    { id: "tablets", name: "تابلت", icon: "📲" },
    { id: "accessories_elec", name: "إكسسوارات الموبايل", icon: "🎧" },
    { id: "tvs", name: "تلفزيونات وشاشات", icon: "📺" },
    { id: "cameras", name: "كاميرات", icon: "📷" },
    { id: "gaming", name: "ألعاب وأجهزة جيمنج", icon: "🎮" },
    { id: "home_appliances", name: "أجهزة منزلية", icon: "🏠" },
    { id: "cables", name: "كابلات وشواحن", icon: "🔌" },
    { id: "storage", name: "التخزين والميموري", icon: "💾" },
    { id: "printers", name: "طابعات وماسحات", icon: "🖨️" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // أغذية - Food & Restaurants
  "أغذية": [
    { id: "sandwiches", name: "سندوتشات", icon: "🥪" },
    { id: "pizza", name: "بيتزا", icon: "🍕" },
    { id: "burgers", name: "برجر", icon: "🍔" },
    { id: "grills", name: "مشويات", icon: "🥩" },
    { id: "chicken", name: "دجاج وفراخ", icon: "🍗" },
    { id: "seafood", name: "مأكولات بحرية", icon: "🦐" },
    { id: "oriental", name: "أكلات شرقية", icon: "🍛" },
    { id: "pastries", name: "معجنات وفطائر", icon: "🥐" },
    { id: "desserts", name: "حلويات", icon: "🍰" },
    { id: "juices", name: "عصائر ومشروبات", icon: "🧃" },
    { id: "breakfast", name: "فطور", icon: "🍳" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // أثاث - Furniture
  "أثاث": [
    { id: "living_room", name: "غرفة المعيشة", icon: "🛋️" },
    { id: "bedroom", name: "غرفة النوم", icon: "🛏️" },
    { id: "dining", name: "غرفة السفرة", icon: "🪑" },
    { id: "kitchen", name: "المطبخ", icon: "🍳" },
    { id: "bathroom", name: "الحمام", icon: "🚿" },
    { id: "office", name: "مكتبي", icon: "🪑" },
    { id: "kids_furniture", name: "أثاث أطفال", icon: "🧒" },
    { id: "outdoor", name: "أثاث خارجي", icon: "⛱️" },
    { id: "decor", name: "ديكورات", icon: "🖼️" },
    { id: "lighting", name: "إضاءة", icon: "💡" },
    { id: "carpets", name: "سجاد ومفروشات", icon: "🧶" },
    { id: "storage_org", name: "تخزين وتنظيم", icon: "📦" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
  // أخرى - Other
  "أخرى": [
    { id: "services", name: "خدمات", icon: "🔧" },
    { id: "gifts", name: "هدايا", icon: "🎁" },
    { id: "books", name: "كتب وقرطاسية", icon: "📚" },
    { id: "toys", name: "ألعاب", icon: "🧸" },
    { id: "pets", name: "مستلزمات حيوانات", icon: "🐾" },
    { id: "automotive", name: "مستلزمات سيارات", icon: "🚗" },
    { id: "garden", name: "حديقة ونباتات", icon: "🌱" },
    { id: "handmade", name: "منتجات يدوية", icon: "🎨" },
    { id: "other", name: "أخرى", icon: "📦" },
  ],
}

// Helper: get subcategories for a store based on its category
export function getSubcategoriesForStore(storeCategory: string) {
  return storeCategorySubcategories[storeCategory] || storeCategorySubcategories["أخرى"] || grocerySubcategories
}


