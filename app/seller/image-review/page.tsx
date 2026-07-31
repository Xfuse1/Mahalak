"use client"

// مراجعة صور الاستيراد: الصور المرشَّحة من البحث بالاسم (image_status="review") مخفيّة عن
// العملاء (image_url فارغ) حتى يوافق التاجر هنا — موافقة فردية/جماعية أو رفض.
// كل القراءة/الكتابة عبر server actions في lib/actions/import (لا جلب Firestore مباشر).
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { SellerHeader } from "../../../components/seller-header"
import { Card, CardContent } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Spinner } from "../../../components/ui/spinner"
import { useToast } from "../../../components/ui/toast"
import { useAuth } from "../../../lib/auth-context"
import { imgSrc } from "../../../lib/storage/public-url"
import {
  approveAllReviewImages,
  approveProductImage,
  getReviewImages,
  getReviewImagesCount,
  rejectProductImage,
} from "../../../lib/actions/import"
import { Check, ImageOff, Images, Loader2, X } from "lucide-react"

type ReviewItem = { id: string; name: string; price: number; image_candidate: string }

export default function ImageReviewPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const toast = useToast()

  const [count, setCount] = useState<number | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [approvingAll, setApprovingAll] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) router.push("/auth")
  }, [user, isLoading, router])

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })

  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const [c, page] = await Promise.all([getReviewImagesCount(), getReviewImages()])
      if (c.ok) setCount(c.count)
      if (page.ok) {
        setItems(page.items)
        setNextCursor(page.nextCursor)
      } else {
        toast.error("تعذّر تحميل الصور — أعد المحاولة")
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isLoading || !user) return
    loadFirst()
  }, [isLoading, user, loadFirst])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getReviewImages(nextCursor)
      if (page.ok) {
        // استبعاد المكرّر بالمعرّف احتياطًا — بطاقة قد تكون وافق عليها التاجر للتو بين صفحتين.
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          return [...prev, ...page.items.filter((it) => !seen.has(it.id))]
        })
        setNextCursor(page.nextCursor)
      } else {
        toast.error("تعذّر تحميل المزيد — أعد المحاولة")
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setLoadingMore(false)
    }
  }

  const decide = async (item: ReviewItem, approve: boolean) => {
    if (busyIds.has(item.id)) return
    setBusy(item.id, true)
    try {
      const r = approve ? await approveProductImage(item.id) : await rejectProductImage(item.id)
      if (r.ok) {
        setItems((prev) => prev.filter((p) => p.id !== item.id))
        setCount((c) => (c == null ? c : Math.max(0, c - 1)))
        toast.success(approve ? "تمّت الموافقة — الصورة ظاهرة دلوقتي للعملاء" : "اترفضت الصورة")
      } else {
        toast.error(r.error === "no_candidate" ? "الصورة المرشَّحة اتغيّرت — حدّث الصفحة" : "تعذّر تنفيذ العملية — أعد المحاولة")
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setBusy(item.id, false)
    }
  }

  const approveAll = async () => {
    const total = count ?? items.length
    if (approvingAll || total === 0) return
    if (!window.confirm(`هتوافق على ${total} صورة وتخليها ظاهرة للعملاء. متأكد؟`)) return
    setApprovingAll(true)
    try {
      const r = await approveAllReviewImages()
      if (r.ok) {
        setItems([])
        setNextCursor(null)
        setCount(0)
        toast.success(`تمّت الموافقة على ${r.approved} صورة`)
      } else {
        toast.error(r.error === "rate_limited" ? "محاولات كتير — استنى شوية وأعد المحاولة" : "تعذّرت الموافقة الجماعية — أعد المحاولة")
      }
    } catch {
      toast.error("تعذّر الاتصال بالخادم")
    } finally {
      setApprovingAll(false)
    }
  }

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SellerHeader />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Images className="h-6 w-6 text-primary" /> مراجعة صور الاستيراد
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              الصور دي اترشّحت بالبحث بالاسم ومش ظاهرة للعملاء لسه — وافق عليها أو ارفضها.
              {count != null && <> بانتظار المراجعة: <span className="font-bold text-gray-800">{count}</span></>}
            </p>
          </div>
          {(count ?? 0) > 0 && (
            <Button onClick={approveAll} disabled={approvingAll} className="h-11">
              {approvingAll
                ? <><Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ…</>
                : <><Check className="h-4 w-4 me-2" /> وافق على الكل ({count})</>}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : items.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
              <ImageOff className="h-14 w-14 text-gray-300" />
              <p className="font-bold text-gray-700">مفيش صور بانتظار المراجعة</p>
              <p className="text-sm text-gray-400">أي صور جديدة من البحث بالاسم هتظهر هنا تستنى مراجعتك قبل ما تظهر للعملاء.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => {
                const busy = busyIds.has(item.id)
                return (
                  <Card key={item.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                    <div className="aspect-square relative bg-gray-100">
                      <Image
                        src={imgSrc(item.image_candidate)}
                        alt={item.name}
                        fill
                        loading="lazy"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover"
                      />
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{item.name}</p>
                      <p className="text-primary font-bold text-sm">
                        {item.price} <span className="text-xs font-medium text-gray-500">جنيه</span>
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" disabled={busy} onClick={() => decide(item, true)}>
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 me-1" /> موافقة</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          disabled={busy}
                          onClick={() => decide(item, false)}
                        >
                          <X className="h-4 w-4 me-1" /> رفض
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {nextCursor && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="h-11 px-8">
                  {loadingMore ? <><Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ…</> : "تحميل المزيد"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
