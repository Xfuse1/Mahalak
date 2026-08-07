"use client"

// صفحة نتيجة البحث الذكي: سلة جاهزة من منتجات حقيقية بأسعار السيرفر.
//
// صفحة مستقلّة عن /search عمدًا: مخرج البحث الذكي سلّة مجمَّعة بمجموعات وإجماليات، لا شبكة بطاقات
// تُفلتَر وتُرتَّب. حشرهما معًا كان يعني لوحة فلترة وترتيبًا لا معنى لهما فوق مكوّنات وصفة.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { AlertTriangle, Check, Info, Package, Phone, ShoppingCart, Sparkles, Store as StoreIcon } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchBar } from "@/components/search-bar"
import { BackButton } from "@/components/back-button"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/components/ui/toast"
import { imgSrc } from "@/lib/storage/public-url"
import { logError } from "@/lib/logger"
import { useCartStore, type CartBulkInput } from "@/lib/stores/cart-store"
import { aiSearch, logAiSearchAddToCart, type AiBasket, type AiMatch, type AiSearchSuccess } from "@/lib/actions/ai-search"
import { AI_SEARCH_ERROR } from "@/lib/ai/search-errors"

const money = (value: number) => `${Number(value || 0).toFixed(2)} ج`

function MatchRow({ match, onAdd, scope }: { match: AiMatch; onAdd: (m: AiMatch) => void; scope: "multi" | "single" }) {
  const product = match.product
  if (!product) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{match.concept}</p>
          {/* الغياب في سلة متجر واحد يعني «ليس في هذا المتجر» — `buildBasket` فلتر المرشّحين على
              المتجر. نصٌّ مطلق («في أي متجر») يناقض التبويب المجاور الذي يعرض نفس الصنف بسعره. */}
          <p className="text-xs text-muted-foreground">
            {scope === "single" ? "مش موجود في المتجر ده" : "غير متوفر في أي متجر حاليًا"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={imgSrc(product.image_url)} alt={product.name} fill sizes="48px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/product/${product.id}`} className="truncate font-medium text-foreground hover:text-primary">
            {product.name}
          </Link>
          {match.is_alternative && (
            <span className="flex-shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold text-accent">بديل</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {match.concept} · {product.store_name}
        </p>
      </div>
      <div className="flex-shrink-0 text-end">
        <p className="font-bold text-foreground">{money(product.unit_price)}</p>
        {product.discount_percentage > 0 && (
          <p className="text-xs text-muted-foreground line-through">{money(product.price)}</p>
        )}
      </div>
      <Button type="button" variant="outline" size="icon" className="flex-shrink-0 rounded-xl" onClick={() => onAdd(match)} aria-label={`أضف ${product.name}`}>
        <ShoppingCart className="h-4 w-4" />
      </Button>
    </div>
  )
}

function BasketView({ basket, onAddAll, onAddOne }: { basket: AiBasket; onAddAll: (b: AiBasket) => void; onAddOne: (m: AiMatch) => void }) {
  return (
    <Card className="border border-border">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <StoreIcon className="h-4 w-4" />
            {basket.store_names.length === 1 ? basket.store_names[0] : `${basket.store_ids.length} متاجر`}
            <span>·</span>
            <span>
              {basket.matched} من {basket.total_concepts} مكوّن
            </span>
          </div>
          <div className="text-end">
            <p className="text-xs text-muted-foreground">إجمالي المنتجات</p>
            <p className="text-xl font-extrabold text-foreground">{money(basket.subtotal)}</p>
          </div>
        </div>

        {basket.groups.map((group) => (
          <div key={group.name} className="space-y-2">
            <h3 className="font-bold text-foreground">{group.name}</h3>
            {group.matches.map((match) => (
              <MatchRow key={`${group.name}-${match.concept}`} match={match} onAdd={onAddOne} scope={basket.kind} />
            ))}
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            رسوم التوصيل تُحسب عند الدفع حسب موقعك{basket.store_ids.length > 1 ? " — سائق واحد يمرّ على المتاجر" : ""}.
          </p>
          <Button type="button" onClick={() => onAddAll(basket)} disabled={basket.matched === 0} className="gap-2 rounded-xl">
            <ShoppingCart className="h-4 w-4" /> أضف السلة كلها
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AiResults() {
  const searchParams = useSearchParams()
  const query = (searchParams.get("q") || "").trim()
  const toast = useToast()
  const addItems = useCartStore((s) => s.addItems)

  const [result, setResult] = useState<AiSearchSuccess | null>(null)
  const [failure, setFailure] = useState<{ error: string; code: string } | null>(null)
  const [activeBasket, setActiveBasket] = useState(0)

  const [pending, setPending] = useState(false)
  // نفس نمط [app/search/page.tsx]: العمل غير المتزامن في `useCallback` يستدعيه التأثير، لا داخله.
  // ضبطُ الحالة متزامنًا داخل effect يُطلق رسمةً متتالية (وقاعدة react-hooks تمنعه)، والمعرّف
  // المتزايد يمنع نتيجة استعلام قديم من أن تعلو نتيجة أحدث حين يبدّل المستخدم طلبه بسرعة.
  const requestIdRef = useRef(0)

  const run = useCallback(async () => {
    if (!query) return
    const requestId = ++requestIdRef.current
    setPending(true)
    setFailure(null)
    // النتيجة السابقة تُمسح مع بداية استعلام جديد: نداء الموديل يستغرق ثوانٍ، وكان العنوان يبقى
    // «مكونات كشري» بينما السطر أسفله يقول «طلبك: منظف سيراميك».
    setResult(null)
    try {
      const res = await aiSearch({ query })
      if (requestId !== requestIdRef.current) return
      if (res.success) {
        setResult(res)
        setActiveBasket(0)
      } else {
        setResult(null)
        setFailure({ error: res.error, code: res.code })
      }
    } catch (e) {
      if (requestId !== requestIdRef.current) return
      logError("[search/ai] aiSearch", e)
      setFailure({ error: "حصل خطأ. جرّب تاني.", code: AI_SEARCH_ERROR.SERVER })
    } finally {
      if (requestId === requestIdRef.current) setPending(false)
    }
  }, [query])

  useEffect(() => {
    run()
  }, [run])

  const toCartInput = useCallback((match: AiMatch): CartBulkInput | null => {
    const p = match.product
    if (!p) return null
    // السعر المُرسَل للسلة هو سعر المستند، والخصم منفصل — نفس شكل ProductCard كي يحسب الـcheckout
    // بنفس الطريقة. والسيرفر يعيد اشتقاق كل مبلغ عند إنشاء الطلب على أي حال.
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      image_url: p.image_url,
      store_id: p.store_id,
      store_name: p.store_name,
      stock: p.stock,
      discount_percentage: p.discount_percentage,
      quantity: 1,
      source: "ai_search",
    }
  }, [])

  const report = useCallback(
    (added: number, out: { rejected: string[]; partial: string[] }) => {
      if (added === 0) {
        toast.error("تعذّر إضافة أي صنف — المخزون نفد")
        return
      }
      if (out.rejected.length) {
        toast.success(`أضفنا ${added} صنفًا — ${out.rejected.length} نفد مخزونه`)
        return
      }
      toast.success(added === 1 ? "أُضيف للسلة" : `أُضيفت ${added} أصناف للسلة`)
    },
    [toast],
  )

  // التسجيل لا يُنتظَر ولا يُفشِل الإضافة: قياسٌ يعطّل شراءً ليس قياسًا.
  const track = useCallback(
    (productIds: string[], wholeBasket: boolean, basketKind?: "multi" | "single") => {
      if (!productIds.length) return
      void logAiSearchAddToCart({ query, productIds, intent: result?.intent, basketKind, wholeBasket }).catch(() => {})
    },
    [query, result?.intent],
  )

  const handleAddOne = useCallback(
    (match: AiMatch) => {
      const item = toCartInput(match)
      if (!item) return
      const out = addItems([item])
      const added = out.rejected.length ? 0 : 1
      report(added, out)
      if (added) track([item.id], false)
    },
    [addItems, report, toCartInput, track],
  )

  const handleAddAll = useCallback(
    (basket: AiBasket) => {
      const items = basket.groups
        .flatMap((g) => g.matches)
        .map(toCartInput)
        .filter((i): i is CartBulkInput => i !== null)
      if (!items.length) return
      const out = addItems(items)
      report(items.length - out.rejected.length, out)
      track(items.filter((i) => !out.rejected.includes(i.id)).map((i) => i.id), true, basket.kind)
    },
    [addItems, report, toCartInput, track],
  )

  // «جارٍ التحميل» حالة مشتقّة لا مخزَّنة: وجود استعلام بلا نتيجة ولا خطأ.
  const loading = !!query && pending
  const baskets = result?.baskets ?? []
  const basket = baskets[Math.min(activeBasket, Math.max(0, baskets.length - 1))]

  const basketLabel = useMemo(
    () => (b: AiBasket) => (b.kind === "single" ? `من متجر واحد · ${money(b.subtotal)}` : `أفضل سعر من عدة متاجر · ${money(b.subtotal)}`),
    [],
  )

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <Header />
      <main className="flex-1 bg-secondary/20 py-8">
        <div className="container mx-auto px-4">
          <BackButton />

          <div className="mb-6 text-right">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-foreground md:text-3xl">
              <Sparkles className="h-6 w-6 text-accent" />
              {result?.title || "البحث الذكي"}
            </h1>
            {query && <p className="mt-1 text-muted-foreground">طلبك: {query}</p>}
          </div>

          <div className="mb-8 w-full md:w-4/5 lg:w-3/5">
            <SearchBar initialValue={query} initialMode="ai" placeholder="اكتب اللي محتاجه بالبلدي…" />
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Spinner size="lg" label="بنجهّز سلتك…" className="flex-col" />
              <p className="text-sm text-muted-foreground">بنفهم طلبك وندوّر على المكوّنات في المتاجر</p>
            </div>
          ) : failure ? (
            <Card className={`border ${failure.code === AI_SEARCH_ERROR.RED_FLAG ? "border-destructive" : "border-border"}`}>
              <CardContent className="space-y-4 p-6 text-right">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${failure.code === AI_SEARCH_ERROR.RED_FLAG ? "text-destructive" : "text-muted-foreground"}`} />
                  <p className="font-medium text-foreground">{failure.error}</p>
                </div>
                {failure.code !== AI_SEARCH_ERROR.RED_FLAG && query && (
                  <Link href={`/search?q=${encodeURIComponent(query)}`}>
                    <Button variant="outline" className="rounded-xl">جرّب البحث العادي</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : !query ? (
            <EmptyState icon={Sparkles} title="اكتب اللي محتاجه" description="مثال: «عايز أعمل كشري لخمس أفراد» أو «محتاج حاجة تنضف السيراميك»" />
          ) : !basket ? (
            <EmptyState icon={Package} title="مفيش نتائج" description="جرّب صياغة تانية أو استخدم البحث العادي." />
          ) : (
            <div className="space-y-4">
              {/* التنويه وزرّ الصيدلي **فوق** السلة لا تحتها: قرار المالك أن يظهر «اسأل صيدلي» فور
                  الترشيح، وتنويهٌ يقرؤه العميل بعد أن يضيف للعربة لم يعد تنويهًا. */}
              {result?.notice && (
                <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm text-foreground">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                  <span>{result.notice}</span>
                </div>
              )}

              {result?.pharmacies && result.pharmacies.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
                  <span className="text-sm font-bold text-foreground">مش متأكد؟ اسأل صيدلي:</span>
                  {result.pharmacies.map((pharmacy) =>
                    pharmacy.phone ? (
                      <a key={pharmacy.store_id} href={`tel:${pharmacy.phone}`}>
                        <Button type="button" variant="outline" className="gap-2 rounded-xl">
                          <Phone className="h-4 w-4" /> {pharmacy.name}
                        </Button>
                      </a>
                    ) : (
                      <Link key={pharmacy.store_id} href={`/store/${pharmacy.store_id}`}>
                        <Button type="button" variant="outline" className="gap-2 rounded-xl">
                          <StoreIcon className="h-4 w-4" /> {pharmacy.name}
                        </Button>
                      </Link>
                    ),
                  )}
                </div>
              )}

              {baskets.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {baskets.map((b, i) => (
                    <Button
                      key={b.kind}
                      type="button"
                      variant="outline"
                      onClick={() => setActiveBasket(i)}
                      className={`gap-2 rounded-xl ${i === activeBasket ? "border-accent text-accent" : "text-muted-foreground"}`}
                    >
                      {i === activeBasket && <Check className="h-4 w-4" />}
                      {basketLabel(b)}
                    </Button>
                  ))}
                </div>
              )}

              <BasketView basket={basket} onAddAll={handleAddAll} onAddOne={handleAddOne} />

              {result && result.unmatched.length > 0 && (
                <Card className="border border-dashed border-border">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    <p className="mb-1 font-bold text-foreground">مش متوفر عندنا دلوقتي</p>
                    <p>{result.unmatched.join("، ")}</p>
                    <p className="mt-2 text-xs">سجّلنا طلبك — بنستخدمه عشان نجيب الأصناف الناقصة من التجّار.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function AiSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" label="جاري التحميل…" className="flex-col" />
        </div>
      }
    >
      <AiResults />
    </Suspense>
  )
}
