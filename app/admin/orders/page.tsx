"use client"

// إدارة الطلبات (أدمن): قائمة + تفاصيل + إلغاء مع استعادة المخزون.
// النطاق الحالي: عرض/تفاصيل/إلغاء فقط (لا تعديل حالة ولا تعيين سائق — زيادة مستقبلية).
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { logError } from "@/lib/logger"
import {
  getAdminOrders,
  getAdminOrderDetail,
  adminCancelOrder,
  type AdminOrderSummary,
  type AdminOrderDetail,
} from "@/lib/actions/admin"
import {
  ClipboardList,
  Search,
  User,
  Store as StoreIcon,
  Bike,
  Phone,
  MapPin,
  Package,
  Calendar,
  Loader2,
  XCircle,
  Layers,
} from "lucide-react"

type Filter = "all" | "pending" | "confirmed" | "on_the_way" | "delivered" | "cancelled"

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  reviewing: "قيد المراجعة",
  processing: "قيد التجهيز",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  on_the_way: "في الطريق",
  picking_up: "قيد الاستلام",
  picked_up: "تم الاستلام",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  driver_rejected: "رفض السائق",
  driver_changed: "تم تغيير السائق",
}
const statusLabel = (s: string) => STATUS_LABEL[s] || s

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  reviewing: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  on_the_way: "bg-purple-100 text-purple-800",
  picking_up: "bg-purple-100 text-purple-800",
  picked_up: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  driver_rejected: "bg-red-100 text-red-800",
  driver_changed: "bg-orange-100 text-orange-800",
}
const statusColor = (s: string) => STATUS_COLOR[s] || "bg-gray-100 text-gray-800"

const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : ""
const money = (n: number) => `${Number(n || 0).toLocaleString("ar-EG")} ج.م`

// حالة نهائية لا تُلغى
const isCancellable = (status: string) => status !== "cancelled" && status !== "delivered"

export default function AdminOrdersPage() {
  const toast = useToast()
  const [orders, setOrders] = useState<AdminOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  // تفاصيل الطلب (Modal)
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  // إلغاء الطلب (Modal بسبب)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelBusy, setCancelBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminOrders()
      if (res.success && res.orders) setOrders(res.orders)
      else setError(true)
    } catch (e) {
      logError("[admin/orders] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id: string) => {
    setDetail(null)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await getAdminOrderDetail(id)
      if (res.success && res.order) setDetail(res.order)
      else toast.error(res.error || "تعذّر تحميل التفاصيل")
    } catch (e) {
      logError("[admin/orders] detail", e)
      toast.error("تعذّر تحميل التفاصيل")
    } finally {
      setDetailLoading(false)
    }
  }

  const openCancel = (id: string) => {
    setCancelId(id)
    setCancelReason("")
    setCancelOpen(true)
  }

  const doCancel = async () => {
    if (!cancelId) return
    const reason = cancelReason.trim()
    if (!reason) {
      toast.error("يرجى إدخال سبب الإلغاء")
      return
    }
    setCancelBusy(true)
    try {
      const res = await adminCancelOrder(cancelId, reason)
      if (res.success) {
        toast.success("تم إلغاء الطلب واستعادة المخزون")
        setOrders((prev) => prev.map((o) => (o.id === cancelId ? { ...o, status: "cancelled" } : o)))
        setDetail((d) => (d && d.id === cancelId ? { ...d, status: "cancelled", cancel_reason: reason } : d))
        setCancelOpen(false)
        setCancelId(null)
      } else {
        toast.error(res.error || "تعذّر إلغاء الطلب")
      }
    } catch (e) {
      logError("[admin/orders] cancel", e)
      toast.error("تعذّر إلغاء الطلب")
    } finally {
      setCancelBusy(false)
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1
    return c
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false
      if (!q) return true
      return o.id.toLowerCase().includes(q) || (o.customer_phone || "").toLowerCase().includes(q)
    })
  }, [orders, filter, search])

  const TABS: [Filter, string][] = [
    ["all", `الكل (${counts.all || 0})`],
    ["pending", `قيد المراجعة (${counts.pending || 0})`],
    ["confirmed", `مؤكدة (${counts.confirmed || 0})`],
    ["on_the_way", `في الطريق (${counts.on_the_way || 0})`],
    ["delivered", `مُسلَّمة (${counts.delivered || 0})`],
    ["cancelled", `ملغاة (${counts.cancelled || 0})`],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">إدارة الطلبات</h1>
          <p className="text-sm text-muted-foreground">راجع الطلبات، اطّلع على تفاصيلها، وألغِ الطلب مع استعادة المخزون.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto flex-wrap">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative md:ms-auto md:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الهاتف أو رقم الطلب"
            className="h-10 rounded-xl pr-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل الطلبات. حاول مرة أخرى." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد طلبات مطابقة" />
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => (
            <Card key={o.id} className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    {o.order_type === "multi_store" ? (
                      <Layers className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground">#{o.id.slice(0, 8)}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>
                        {statusLabel(o.status)}
                      </span>
                      {o.order_type === "multi_store" && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                          <Layers className="h-3 w-3" /> متعدد المتاجر
                        </span>
                      )}
                      <span className="text-sm font-extrabold text-primary ms-auto">{money(o.total)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {o.customer_name || "بدون اسم"}
                        </span>
                        {o.customer_phone && (
                          <span dir="ltr" className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {o.customer_phone}
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <StoreIcon className="h-3 w-3" /> {o.store_name || "—"}
                        </span>
                        {o.driver_name && (
                          <span className="flex items-center gap-1">
                            <Bike className="h-3 w-3" /> {o.driver_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {o.items_count} منتج
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {fmtDate(o.created_at)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => openDetail(o.id)} className="rounded-xl gap-1">
                    <ClipboardList className="h-4 w-4" /> التفاصيل
                  </Button>
                  {isCancellable(o.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCancel(o.id)}
                      className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="h-4 w-4" /> إلغاء
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: تفاصيل الطلب */}
      <Dialog open={detailOpen} onOpenChange={(v) => !v && setDetailOpen(false)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب {detail ? `#${detail.id.slice(0, 8)}` : ""}</DialogTitle>
            <DialogDescription>عرض للقراءة فقط — لا يُعرض كود تأكيد التسليم.</DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(detail.status)}`}>
                  {statusLabel(detail.status)}
                </span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {detail.order_type === "multi_store" ? "متعدد المتاجر" : "متجر واحد"}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {fmtDate(detail.created_at)}
                </span>
              </div>

              {detail.cancel_reason && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2 text-destructive">
                  <span className="font-bold">سبب الإلغاء: </span>
                  {detail.cancel_reason}
                </div>
              )}

              {/* العميل */}
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1">
                  <User className="h-4 w-4" /> العميل
                </p>
                <p className="text-muted-foreground">{detail.customer_name || "بدون اسم"}</p>
                {detail.customer_phone && (
                  <p className="text-muted-foreground flex items-center gap-1" dir="ltr">
                    <Phone className="h-3 w-3" /> {detail.customer_phone}
                  </p>
                )}
                {detail.customer_email && <p className="text-muted-foreground">{detail.customer_email}</p>}
              </div>

              {/* المتجر / السائق */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <StoreIcon className="h-4 w-4" /> المتجر
                  </p>
                  <p className="text-muted-foreground">{detail.store_name || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Bike className="h-4 w-4" /> السائق
                  </p>
                  <p className="text-muted-foreground">{detail.driver_name || "لم يُعيَّن"}</p>
                  {detail.driver_phone && (
                    <p className="text-muted-foreground flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3" /> {detail.driver_phone}
                    </p>
                  )}
                </div>
              </div>

              {/* عنوان التوصيل */}
              {(detail.delivery_address || detail.delivery_city || detail.landmark || detail.delivery_notes) && (
                <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> عنوان التوصيل
                  </p>
                  {detail.delivery_address && <p className="text-muted-foreground">{detail.delivery_address}</p>}
                  {(detail.delivery_city || detail.delivery_state) && (
                    <p className="text-muted-foreground">
                      {[detail.delivery_city, detail.delivery_state].filter(Boolean).join("، ")}
                    </p>
                  )}
                  {detail.landmark && <p className="text-muted-foreground">علامة مميزة: {detail.landmark}</p>}
                  {detail.delivery_notes && <p className="text-muted-foreground">ملاحظات: {detail.delivery_notes}</p>}
                </div>
              )}

              {/* العناصر */}
              <div className="rounded-lg border border-border divide-y divide-border">
                <div className="p-2 font-bold text-foreground flex items-center gap-1">
                  <Package className="h-4 w-4" /> العناصر ({detail.items.length})
                </div>
                {detail.items.length === 0 ? (
                  <p className="p-3 text-muted-foreground">لا توجد عناصر</p>
                ) : (
                  detail.items.map((it) => (
                    <div key={it.id} className="p-2 flex items-center justify-between gap-2">
                      <span className="text-foreground truncate">{it.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {it.quantity} × {money(it.price)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* محطات الاستلام (متعدد المتاجر) */}
              {detail.order_type === "multi_store" && detail.pickup_stops && detail.pickup_stops.length > 0 && (
                <div className="space-y-2">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Layers className="h-4 w-4" /> محطات الاستلام
                  </p>
                  {detail.pickup_stops.map((stop, i) => (
                    <div key={i} className="rounded-lg border border-border p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{stop.store_name}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(stop.status)}`}>
                          {statusLabel(stop.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stop.items.length} منتج — {money(stop.subtotal)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* الإجماليات */}
              <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                {detail.subtotal != null && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>المجموع الفرعي</span>
                    <span>{money(detail.subtotal)}</span>
                  </div>
                )}
                {detail.delivery_price != null && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>رسوم التوصيل</span>
                    <span>{money(detail.delivery_price)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-bold text-foreground pt-1">
                  <span>الإجمالي</span>
                  <span className="text-primary">{money(detail.total)}</span>
                </div>
              </div>

              {isCancellable(detail.status) && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => openCancel(detail.id)}
                    className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4" /> إلغاء الطلب
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: إلغاء الطلب بسبب */}
      <Dialog open={cancelOpen} onOpenChange={(v) => !v && !cancelBusy && setCancelOpen(false)}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إلغاء الطلب</DialogTitle>
            <DialogDescription>سيُعاد المخزون تلقائيًا ويُخطَر العميل. اكتب سبب الإلغاء.</DialogDescription>
          </DialogHeader>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="سبب الإلغاء"
            className="h-10 rounded-xl"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelBusy}>
              تراجع
            </Button>
            <Button variant="destructive" onClick={doCancel} disabled={cancelBusy || !cancelReason.trim()}>
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
