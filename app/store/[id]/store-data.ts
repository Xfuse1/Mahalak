// أنواع ودوال تحويل صفحة المتجر — ملف محايد (بلا "use client") لأن مكوّن السيرفر (page.tsx)
// ومكوّن العميل (store-client.tsx) يستعملانه معًا. دالة مُصدَّرة من ملف "use client" تصير «مرجع
// عميل» لا يُستدعى من السيرفر، وهو خطأ لا تمسكه tsc ولا الاختبارات بل البناء أو التشغيل فقط.
import { isOfferActiveNow, isOfferSoldOut } from "../../../lib/utils/offer-active"

export type Store = {
  id: string
  name: string
  description: string
  rating: number
  category: string
  phone: string
  address: string
  image_url?: string
  return_policy?: string
}

export type Product = {
  id: string
  name: string
  description: string
  price: number
  category: string
  stock: number
  image: string
  image_url?: string | null
  store_id: string
  rating: number
  rating_count?: number
  discount_percentage?: number
  created_at?: string
  storeName: string
  storeId: string
  reviewCount: number
  // حقول يُرجعها getProductsByStoreId أصلًا ضمن المستند ولم تكن مقروءة هنا. فهرستها تغيير عميل
  // بحت: صفر تعديل خادم، صفر زيادة في الحمولة، صفر قراءة إضافية من Firestore.
  active_ingredient?: string | null
  barcode?: string | null
  manufacturer?: string | null
}

export type Offer = {
  id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
  // هدف الحملة: منتج بعينه، أو فئة، أو المتجر كله (الاثنان غائبان)
  product_id?: string
  category?: string
  // عرض محدود الكمية / عرض فلاش بالساعات من منتصف الليل
  quantity?: number
  used_quantity?: number
  duration_hours?: number
}

/** بيانات الصفحة كما يقرؤها السيرفر (page.tsx) أو المتصفح احتياطًا. */
export type StoreInitialData = {
  store: Store
  products: Product[]
  offers: Offer[]
  topSellerIds: string[]
}

// الفعالية بنفس قاعدة الخادم التي تحسب السعر (توقيت القاهرة + نافذة الفلاش + نفاد الكمية).
// الفلترة القديمة هنا كانت بيوم UTC بلا فلاش ولا كمية، فكان يظهر عرض منتهٍ فعليًّا بينما
// المنتجات معروضة بسعرها الكامل — وعد لا يفي به الحساب.
export function activeStoreOffers(offersData: unknown[]): Offer[] {
  return (offersData as Offer[]).filter((offer) => isOfferActiveNow(offer) && !isOfferSoldOut(offer))
}

export function toStoreProducts(productsData: unknown[], storeData: Store): Product[] {
  return productsData.map((product: any) => ({
    ...product,
    image: typeof product.image_url === "string" && product.image_url ? product.image_url : "/placeholder.svg",
    storeName: storeData.name,
    storeId: storeData.id,
    reviewCount: product.reviewCount || 0,
  }))
}
