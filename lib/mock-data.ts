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

export const categories = ["بقالة", "صحة", "ملابس", "إلكترونيات", "أغذية", "أثاث", "خدمات أخرى"]

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
