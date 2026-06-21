"use client"

// ADM-01: صفحة اعتماد المتاجر — مراجعة المتاجر الجديدة ومستنداتها واعتمادها/رفضها.
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
import { getAdminStores, setStoreApproval, type AdminStore } from "@/lib/actions/admin"
import { Store as StoreIcon, CheckCircle2, XCircle, Phone, MapPin, Clock, BadgeCheck, Loader2 } from "lucide-react"

type Filter = "pending" | "approved" | "all"

export default function AdminStoresPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [stores, setStores] = useState<AdminStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("pending")
  const [busyId, setBusyId] = useState<string | null>(null)

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
    setBusyId(s.id)
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
      setBusyId(null)
    }
  }

  const filtered = stores.filter((s) =>
    filter === "all" ? true : filter === "approved" ? s.is_approved : !s.is_approved,
  )
  const pendingCount = stores.filter((s) => !s.is_approved).length

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
          {filtered.map((s) => (
            <Card key={s.id} className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
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

                <div className="flex items-center gap-2 pt-1">
                  {!s.is_approved ? (
                    <>
                      <Button size="sm" disabled={busyId === s.id} onClick={() => handle(s, true)} className="rounded-xl gap-1">
                        {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === s.id}
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
                      disabled={busyId === s.id}
                      onClick={() => handle(s, false)}
                      className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} إلغاء الاعتماد
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
