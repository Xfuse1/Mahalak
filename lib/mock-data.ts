// Mock data for the Mahalak e-commerce platform

export interface User {
  id: string
  email: string
  name: string
  role: "customer" | "seller"
  phone?: string
  address?: string
}

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

export interface Order {
  id: string
  userId: string
  products: { productId: string; quantity: number; price: number }[]
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt: string
}

// Main store categories (displayed on homepage)
export const mainCategories = [
  { id: "grocery", name: "بقالة", icon: "🛒", color: "from-emerald-400 to-green-500" },
  { id: "health", name: "صحة", icon: "💊", color: "from-rose-400 to-pink-500" },
  { id: "clothing", name: "ملابس", icon: "👕", color: "from-violet-400 to-purple-500" },
  { id: "electronics", name: "إلكترونيات", icon: "📱", color: "from-blue-400 to-indigo-500" },
  { id: "food", name: "أغذية", icon: "🍔", color: "from-amber-400 to-orange-500" },
  { id: "furniture", name: "أثاث", icon: "🛋️", color: "from-amber-600 to-yellow-600" },
  { id: "other", name: "أخرى", icon: "🔥", color: "from-slate-500 to-gray-600" },
]

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

// Legacy categories (keeping for backward compatibility)
export const categories = [
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

export const categoryNames = categories.map(c => c.name)
export const mainCategoryNames = mainCategories.map(c => c.name)

export const mockStores: Store[] = [
  {
    id: "1",
    name: "متجر الإلكترونيات الحديثة",
    description: "أحدث الأجهزة الإلكترونية بأفضل الأسعار",
    logo: "/store-electronics.jpg",
    rating: 4.5,
    reviewCount: 120,
    sellerId: "seller1",
    category: "إلكترونيات",
  },
  {
    id: "2",
    name: "بقالة الأسرة",
    description: "جميع احتياجاتك اليومية في مكان واحد",
    logo: "/store-grocery.jpg",
    rating: 4.8,
    reviewCount: 250,
    sellerId: "seller2",
    category: "بقالة",
  },
  {
    id: "3",
    name: "متجر الأزياء العصرية",
    description: "أحدث صيحات الموضة",
    logo: "/store-fashion.jpg",
    rating: 4.3,
    reviewCount: 89,
    sellerId: "seller3",
    category: "ملابس",
  },
]

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "هاتف ذكي سامسونج جالاكسي",
    description: "هاتف ذكي بمواصفات عالية وكاميرا متطورة",
    price: 3500,
    image: "/samsung-galaxy-phone.jpg",
    storeId: "1",
    storeName: "متجر الإلكترونيات الحديثة",
    category: "إلكترونيات",
    stock: 15,
    rating: 4.6,
    reviewCount: 45,
  },
  {
    id: "2",
    name: "أرز بسمتي - 5 كيلو",
    description: "أرز بسمتي فاخر من الهند",
    price: 85,
    image: "/basmati-rice-bag.jpg",
    storeId: "2",
    storeName: "بقالة الأسرة",
    category: "بقالة",
    stock: 50,
    rating: 4.7,
    reviewCount: 120,
  },
  {
    id: "3",
    name: "قميص رجالي قطن",
    description: "قميص رجالي من القطن الخالص بألوان متعددة",
    price: 120,
    image: "/mens-cotton-shirt.jpg",
    storeId: "3",
    storeName: "متجر الأزياء العصرية",
    category: "ملابس",
    stock: 30,
    rating: 4.4,
    reviewCount: 67,
  },
  {
    id: "4",
    name: "لابتوب ديل انسبايرون",
    description: "لابتوب عالي الأداء للعمل والترفيه",
    price: 8500,
    image: "/dell-inspiron-laptop.jpg",
    storeId: "1",
    storeName: "متجر الإلكترونيات الحديثة",
    category: "إلكترونيات",
    stock: 8,
    rating: 4.5,
    reviewCount: 32,
  },
  {
    id: "5",
    name: "زيت زيتون بكر - 1 لتر",
    description: "زيت زيتون بكر ممتاز من إيطاليا",
    price: 150,
    image: "/olive-oil-bottle.jpg",
    storeId: "2",
    storeName: "بقالة الأسرة",
    category: "أغذية",
    stock: 40,
    rating: 4.9,
    reviewCount: 95,
  },
  {
    id: "6",
    name: "فستان نسائي أنيق",
    description: "فستان نسائي عصري لجميع المناسبات",
    price: 250,
    image: "/elegant-womens-dress.jpg",
    storeId: "3",
    storeName: "متجر الأزياء العصرية",
    category: "ملابس",
    stock: 20,
    rating: 4.6,
    reviewCount: 54,
  },
  {
    id: "7",
    name: "فيتامينات متعددة",
    description: "مكمل غذائي يحتوي على فيتامينات ومعادن أساسية",
    price: 120,
    image: "/multivitamin-bottle.jpg",
    storeId: "2",
    storeName: "بقالة الأسرة",
    category: "صحة",
    stock: 35,
    rating: 4.5,
    reviewCount: 78,
  },
  {
    id: "8",
    name: "جهاز قياس ضغط الدم",
    description: "جهاز رقمي دقيق لقياس ضغط الدم في المنزل",
    price: 350,
    image: "/blood-pressure-monitor.jpg",
    storeId: "1",
    storeName: "متجر الإلكترونيات الحديثة",
    category: "صحة",
    stock: 12,
    rating: 4.7,
    reviewCount: 43,
  },
  {
    id: "9",
    name: "كريم للعناية بالبشرة",
    description: "كريم مرطب طبيعي للبشرة الجافة",
    price: 85,
    image: "/skincare-cream.jpg",
    storeId: "2",
    storeName: "بقالة الأسرة",
    category: "صحة",
    stock: 45,
    rating: 4.6,
    reviewCount: 92,
  },
  {
    id: "10",
    name: "طقم أريكة مودرن",
    description: "طقم أريكة عصري مكون من 3 قطع بتصميم أنيق",
    price: 5500,
    image: "/modern-sofa-set.jpg",
    storeId: "3",
    storeName: "متجر الأزياء العصرية",
    category: "أثاث",
    stock: 5,
    rating: 4.8,
    reviewCount: 34,
  },
  {
    id: "11",
    name: "طاولة طعام خشبية",
    description: "طاولة طعام من الخشب الطبيعي تتسع لـ 6 أشخاص",
    price: 3200,
    image: "/wooden-dining-table.jpg",
    storeId: "3",
    storeName: "متجر الأزياء العصرية",
    category: "أثاث",
    stock: 8,
    rating: 4.7,
    reviewCount: 28,
  },
  {
    id: "12",
    name: "خدمة صيانة منزلية",
    description: "خدمة صيانة شاملة للمنازل والمكاتب",
    price: 200,
    image: "/home-maintenance-service.jpg",
    storeId: "2",
    storeName: "بقالة الأسرة",
    category: "خدمات أخرى",
    stock: 100,
    rating: 4.4,
    reviewCount: 56,
  },
]
