import { searchProducts } from "@/lib/actions/products"
import { searchStores } from "@/lib/actions/stores"
import SearchResults, { type SearchInitialData } from "./search-results"

export const metadata = { title: "البحث | محلك" }

// مكوّن سيرفر: نتائج الاستعلام تُقرأ هنا (searchProducts مخزَّنة 60 ثانية لكل استعلام) وتُرسم داخل
// HTML الأول — كانت الصفحة تُرجع «جاري التحميل…» فارغة ثم تنتظر JavaScript ثم طلبَي بحث (~4 ثوانٍ
// على 3G بطيء). صفحة «كل المنتجات» بلا استعلام تبقى تُجلب من المتصفح: حمولتها الكتالوج كله، ورسمه
// داخل HTML كان سيثقل أول تحميل لزيارة نادرة من الإعلانات.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams
  const raw = Array.isArray(params.q) ? params.q[0] : params.q
  const query = (raw || "").slice(0, 200)

  let initial: SearchInitialData | undefined
  if (query.trim()) {
    try {
      const [products, stores] = await Promise.all([searchProducts(query), searchStores(query)])
      initial = { products: products as unknown[] as SearchInitialData["products"], stores: stores as SearchInitialData["stores"] }
    } catch {
      // عطل عابر ⇒ المتصفح يعيد المحاولة كما كان سابقًا
      initial = undefined
    }
  }

  return <SearchResults key={query} query={query} initial={initial} />
}
