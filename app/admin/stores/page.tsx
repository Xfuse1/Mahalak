"use client"

// ADM-01: صفحة اعتماد المتاجر — مراجعة المتاجر الجديدة ومستنداتها واعتمادها/رفضها.
// موسَّعة (دمج لوحة Flutter): توثيق + تمييز لكل متجر، تحديد متعدد + شريط اعتماد/رفض جماعي، وإحصاءات لكل متجر.
import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { logError } from "@/lib/logger"
import {
  getAdminStores,
  setStoreApproval,
  setStoreVerified,
  setStoreFeatured,
  bulkSetStoreApproval,
  getStoreStats,
  type AdminStore,
  type AdminStoreStats,
} from "@/lib/actions/admin"
import {
  Store as StoreIcon,
  CheckCircle2,
  XCircle,
  Phone,
  MapPin,
  Clock,
  BadgeCheck,
  Loader2,
  ShieldCheck,
  Star,
  BarChart3,
  CheckSquare,
  Square,
  Package,
  ShoppingBag,
} from "lucide-react"

type Filter = "pending" | "approved" | "all"
type BusyAction = "approval" | "verify" | "feature"

export default function AdminStoresPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [stores, setStores] = useState<AdminStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("pending")
  // أفعال قيد التنفيذ مفهرسة بـ`id:action` — يسمح بعدة أفعال متزامنة على صفوف/أزرار مختلفة دون تداخل
  const [busy, setBusy] = useState<Set<string>>(new Set())
  // تحديد متعدد للعمليات الجماعية
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  // إحصاءات لكل متجر (توسّع تحت البطاقة) — تخزين مؤقّت للنجاح فقط (لا نُخزّن الفشل حتى تُعيد فتحةٌ الجلب)
  const [statsFor, setStatsFor] = useState<string | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, AdminStoreStats>>({})
  const [statsLoading, setStatsLoading] = useState<string | null>(null)

  const busyKey = (id: string, action: BusyAction) => `${id}:${action}`
  const isBusy = (id: string, action: BusyAction) => busy.has(busyKey(id, action))
  const startBusy = (id: string, action: BusyAction) =>
    setBusy((p) => new Set(p).add(busyKey(id, action)))
  const endBusy = (id: string, action: BusyAction) =>
    setBusy((p) => {
      const n = new Set(p)
      n.delete(busyKey(id, action))
      return n
    })

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminStores()
      if (res.success && res.stores) setStores(res.stores)
      else setError(true)
    } catch (e) {
      logError("[admin/stores] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handle = async (s: AdminStore, approved: boolean) => {
    if (!approved) {
      const ok = await confirm({
        title: s.is_approved ? "إلغاء اعتماد المتجر" : "رفض المتجر",
        message: `${s.is_approved ? "إلغاء اعتماد" : "رفض"} متجر "${s.name}"؟ سيُخطَر البائع.`,
        confirmText: s.is_approved ? "إلغاء الاعتماد" : "رفض",
        cancelText: "تراجع",
        variant: "danger",
      })
      if (!ok) return
    }
    startBusy(s.id, "approval")
    try {
      const res = await setStoreApproval(s.id, approved)
      if (res.success) {
        toast.success(approved ? "تم اعتماد المتجر" : "تم تحديث الحالة")
        setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_approved: approved } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/stores] setApproval", e)
      toast.error("تعذّر التحديث")
    } finally {
      endBusy(s.id, "approval")
    }
  }

  const toggleVerified = async (s: AdminStore) => {
    const next = !s.is_verified
    startBusy(s.id, "verify")
    try {
      const res = await setStoreVerified(s.id, next)
      if (res.success) {
        toast.success(next ? "تم توثيق المتجر" : "تم إلغاء التوثيق")
        setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_verified: next } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/stores] setVerified", e)
      toast.error("تعذّر التحديث")
    } finally {
      endBusy(s.id, "verify")
    }
  }

  const toggleFeatured = async (s: AdminStore) => {
    const next = !s.is_featured
    startBusy(s.id, "feature")
    try {
      const res = await setStoreFeatured(s.id, next)
      if (res.success) {
        toast.success(next ? "تم تمييز المتجر" : "تم إلغاء التمييز")
        setStores((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_featured: next } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/stores] setFeatured", e)
      toast.error("تعذّر التحديث")
    } finally {
      endBusy(s.id, "feature")
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleStats = async (s: AdminStore) => {
    if (statsFor === s.id) {
      setStatsFor(null)
      return
    }
    setStatsFor(s.id)
    if (statsMap[s.id] !== undefined) return // نجاح مخزّن مسبقًا (لا نُخزّن الفشل)
    setStatsLoading(s.id)
    try {
      const res = await getStoreStats(s.id)
      if (res.success && res.stats) {
        const stats = res.stats
        setStatsMap((prev) => ({ ...prev, [s.id]: stats }))
      } else {
        // لا نُخزّن الفشل: نحذف المفتاح حتى تُعيد فتحةٌ لاحقة الجلب بدل التعليق على رسالة خطأ دائمة
        setStatsMap((prev) => {
          const n = { ...prev }
          delete n[s.id]
          return n
        })
        toast.error(res.error || "تعذّر تحميل الإحصاءات")
      }
    } catch (e) {
      logError("[admin/stores] getStoreStats", e)
      setStatsMap((prev) => {
        const n = { ...prev }
        delete n[s.id]
        return n
      })
      toast.error("تعذّر تحميل الإحصاءات")
    } finally {
      // نُصفّر علم التحميل فقط إن كان ما زال يخصّ هذا الطلب (فتحتان متزامنتان لا تُطفئ إحداهما الأخرى)
      setStatsLoading((cur) => (cur === s.id ? null : cur))
    }
  }

  const filtered = stores.filter((s) =>
    filter === "all" ? true : filter === "approved" ? s.is_approved : !s.is_approved,
  )
  const pendingCount = stores.filter((s) => !s.is_approved).length

  // التحديد المرئي (ضمن اللسان الحالي فقط) — نتجاهل المحدَّد الذي خرج من الفلتر
  const filteredIds = filtered.map((s) => s.id)
  const selectedVisible = filteredIds.filter((id) => selected.has(id))
  const allVisibleSelected = filteredIds.length > 0 && selectedVisible.length === filteredIds.length

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const runBulk = async (approved: boolean) => {
    const ids = selectedVisible
    if (ids.length === 0) return
    const ok = await confirm({
      title: approved ? "اعتماد جماعي" : "رفض جماعي",
      message: `${approved ? "اعتماد" : "رفض"} ${ids.length} متجر؟ سيُخطَر كل بائع.`,
      confirmText: approved ? "اعتماد الكل" : "رفض الكل",
      cancelText: "تراجع",
      variant: approved ? "default" : "danger",
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      const res = await bulkSetStoreApproval(ids, approved)
      const updated = res.updated ?? 0
      if (res.success) {
        if (updated === ids.length) {
          // الكل نجح — تحديث متفائل مباشر
          const idSet = new Set(ids)
          setStores((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, is_approved: approved } : x)))
          toast.success(`تم تحديث ${updated} متجر`)
        } else {
          // نجاح جزئي (بعض المتاجر حُذفت/تغيّر دورها) — نعيد التحميل لمزامنة الحالة الحقيقية
          toast.success(`تم تحديث ${updated} من ${ids.length} متجر`)
          await load()
        }
        clearSelection()
      } else {
        toast.error(res.error || "تعذّر تنفيذ العملية")
        if (updated > 0) await load() // لو تغيّر شيء رغم الخطأ، أعد المزامنة
      }
    } catch (e) {
      logError("[admin/stores] bulk", e)
      toast.error("تعذّر تنفيذ العملية")
    } finally {
      setBulkBusy(false)
    }
  }

  const docsOf = (s: AdminStore) =>
    [
      { label: "البطاقة (أمام)", url: s.id_card_image_url },
      { label: "البطاقة (خلف)", url: s.id_card_image_back_url },
      { label: "السجل التجاري", url: s.commercial_register_image_url },
      { label: "البطاقة الضريبية", url: s.tax_card_image_url },
      { label: "الضريبية (خلف)", url: s.tax_card_image_back_url },
    ].filter((d): d is { label: string; url: string } => !!d.url)

  const TABS: [Filter, string][] = [
    ["pending", `قيد المراجعة (${pendingCount})`],
    ["approved", "المعتمدة"],
    ["all", "الكل"],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">اعتماد المتاجر</h1>
          <p className="text-sm text-muted-foreground">راجع المتاجر الجديدة ومستنداتها، ثم اعتمدها أو ارفضها.</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل المتاجر. حاول مرة أخرى." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title={filter === "pending" ? "لا توجد متاجر بانتظار المراجعة" : "لا توجد متاجر"}
        />
      ) : (
        <div className="space-y-4">
          {/* شريط التحديد + العمليات الجماعية */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-secondary/40 rounded-xl px-3 py-2">
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
              {allVisibleSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </button>
            {selectedVisible.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground">محدَّد: {selectedVisible.length}</span>
                <Button size="sm" disabled={bulkBusy} onClick={() => runBulk(true)} className="rounded-xl gap-1">
                  {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد المحدَّد
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bulkBusy}
                  onClick={() => runBulk(false)}
                  className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4" /> رفض المحدَّد
                </Button>
                <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={clearSelection} className="rounded-xl">
                  إلغاء التحديد
                </Button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">حدّد متاجر لاعتمادها/رفضها دفعةً واحدة</span>
            )}
          </div>

          {filtered.map((s) => {
            const isSelected = selected.has(s.id)
            const busyApproval = isBusy(s.id, "approval")
            const busyVerify = isBusy(s.id, "verify")
            const busyFeature = isBusy(s.id, "feature")
            const statsOpen = statsFor === s.id
            return (
              <Card key={s.id} className={`border transition-colors ${isSelected ? "border-primary" : "border-border"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <button
                      onClick={() => toggleSelect(s.id)}
                      title={isSelected ? "إلغاء التحديد" : "تحديد"}
                      className="mt-1 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
                    </button>
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      {s.image_url ? (
                        <Image src={s.image_url} alt={s.name} fill className="object-cover" sizes="56px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <StoreIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{s.name}</h3>
                        {s.is_approved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <BadgeCheck className="h-3 w-3" /> معتمد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" /> قيد المراجعة
                          </span>
                        )}
                        {s.is_verified && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-info/10 text-info px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> موثّق
                          </span>
                        )}
                        {s.is_featured && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                            <Star className="h-3 w-3" /> مميّز
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {s.category && <p>{s.category}</p>}
                        {s.phone && (
                          <p className="flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" /> {s.phone}
                          </p>
                        )}
                        {s.address && (
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" /> {s.address}
                          </p>
                        )}
                        {s.owner_id_number && <p>الرقم القومي: {s.owner_id_number}</p>}
                      </div>
                    </div>
                  </div>

                  {docsOf(s).length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {docsOf(s).map((d) => (
                        <a
                          key={d.label}
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={d.label}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                        >
                          <Image src={d.url} alt={d.label} fill className="object-cover" sizes="64px" />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] text-center py-0.5">{d.label}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* توثيق + تمييز + إحصاءات */}
                  <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/60 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyVerify}
                      onClick={() => toggleVerified(s)}
                      className={`rounded-xl gap-1 ${s.is_verified ? "border-info/40 text-info hover:bg-info/10" : ""}`}
                    >
                      {busyVerify ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {s.is_verified ? "إلغاء التوثيق" : "توثيق"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyFeature}
                      onClick={() => toggleFeatured(s)}
                      className={`rounded-xl gap-1 ${s.is_featured ? "border-accent/50 text-accent-foreground hover:bg-accent/10" : ""}`}
                    >
                      {busyFeature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                      {s.is_featured ? "إلغاء التمييز" : "تمييز"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleStats(s)}
                      className="rounded-xl gap-1"
                    >
                      <BarChart3 className="h-4 w-4" /> إحصاءات
                    </Button>
                  </div>

                  {/* توسّع الإحصاءات */}
                  {statsOpen && (
                    <div className="rounded-xl bg-secondary/40 p-3">
                      {statsLoading === s.id ? (
                        <div className="flex items-center justify-center py-3">
                          <Spinner size="sm" label="جاري حساب الإحصاءات..." />
                        </div>
                      ) : statsMap[s.id] ? (
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg bg-background p-2">
                            <Package className="h-4 w-4 mx-auto text-muted-foreground" />
                            <div className="text-lg font-extrabold text-foreground">{statsMap[s.id]!.productCount}</div>
                            <div className="text-[11px] text-muted-foreground">منتجات</div>
                          </div>
                          <div className="rounded-lg bg-background p-2">
                            <ShoppingBag className="h-4 w-4 mx-auto text-muted-foreground" />
                            <div className="text-lg font-extrabold text-foreground">{statsMap[s.id]!.orderCount}</div>
                            <div className="text-[11px] text-muted-foreground">طلبات</div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-center text-xs text-muted-foreground py-2">تعذّر تحميل الإحصاءات</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {!s.is_approved ? (
                      <>
                        <Button size="sm" disabled={busyApproval} onClick={() => handle(s, true)} className="rounded-xl gap-1">
                          {busyApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyApproval}
                          onClick={() => handle(s, false)}
                          className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="h-4 w-4" /> رفض
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyApproval}
                        onClick={() => handle(s, false)}
                        className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        {busyApproval ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} إلغاء الاعتماد
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
