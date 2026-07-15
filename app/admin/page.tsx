"use client"

// الصفحة الرئيسية للإدارة (KPIs) — نظرة سريعة على المنصّة مع إبراز المراجعات المعلّقة (إجراء المالك اليومي).
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/error-state"
import { logError } from "@/lib/logger"
import { getAdminDashboardStats, type AdminDashboardStats } from "@/lib/actions/admin"
import {
  ClipboardList,
  Store as StoreIcon,
  Bike,
  Users,
  Percent,
  MessageSquareWarning,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Loader2,
  ShoppingBag,
  Package,
  User,
  Calendar,
} from "lucide-react"

// خرائط الحالة (مطابقة لصفحة الطلبات) — للقائمة المصغّرة لأحدث النشاط.
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
const num = (n: number) => Number(n || 0).toLocaleString("ar-EG")

// روابط سريعة لكل أقسام الإدارة.
const QUICK_LINKS: { href: string; label: string; icon: typeof ClipboardList }[] = [
  { href: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/admin/stores", label: "المتاجر", icon: StoreIcon },
  { href: "/admin/drivers", label: "السائقون", icon: Bike },
  { href: "/admin/commission-settings", label: "العمولات والتوصيل", icon: Percent },
  { href: "/admin/complaints", label: "الشكاوى", icon: MessageSquareWarning },
]

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminDashboardStats()
      if (res.success && res.stats) setStats(res.stats)
      else setError(true)
    } catch (e) {
      logError("[admin/home] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">نظرة سريعة على المنصّة والمراجعات التي تنتظر إجراءك.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} تحديث
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error || !stats ? (
        <ErrorState description="تعذّر تحميل الإحصاءات. حاول مرة أخرى." onRetry={load} />
      ) : (
        <div className="space-y-8">
          {/* إبراز المراجعات المعلّقة — إجراء المالك اليومي */}
          <section>
            <h2 className="text-sm font-bold text-muted-foreground mb-3">بانتظار مراجعتك</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PendingCard
                href="/admin/stores"
                icon={StoreIcon}
                count={stats.stores.pending}
                supported={stats.stores.pendingSupported}
                title="متاجر بانتظار الاعتماد"
                emptyText="لا توجد متاجر بانتظار المراجعة"
              />
              <PendingCard
                href="/admin/drivers"
                icon={Bike}
                count={stats.drivers.pending}
                supported
                title="سائقون بانتظار الاعتماد"
                emptyText="لا يوجد سائقون بانتظار المراجعة"
              />
            </div>
          </section>

          {/* الطلبات — الإجمالي + تفصيل الحالات */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted-foreground">الطلبات</h2>
              <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                عرض الكل <ArrowLeft className="h-3 w-3" />
              </Link>
            </div>
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-extrabold text-foreground leading-none">{num(stats.orders.total)}</p>
                    <p className="text-xs text-muted-foreground mt-1">إجمالي الطلبات (عدا الاستفسارات)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <MiniStat icon={Clock} label="قيد المراجعة" value={stats.orders.pending} tone="warning" />
                  <MiniStat icon={CheckCircle2} label="مؤكدة" value={stats.orders.confirmed} tone="info" />
                  <MiniStat icon={Truck} label="في الطريق" value={stats.orders.on_the_way} tone="accent" />
                  <MiniStat icon={CheckCircle2} label="مُسلَّمة" value={stats.orders.delivered} tone="success" />
                  <MiniStat icon={XCircle} label="ملغاة" value={stats.orders.cancelled} tone="danger" />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* الإجماليات — المتاجر / السائقون / العملاء */}
          <section>
            <h2 className="text-sm font-bold text-muted-foreground mb-3">المنصّة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TotalCard href="/admin/stores" icon={StoreIcon} value={stats.stores.total} label="متجر (بائع)" />
              <TotalCard href="/admin/drivers" icon={Bike} value={stats.drivers.total} label="سائق" />
              <TotalCard icon={Users} value={stats.customers.total} label="عميل" />
            </div>
          </section>

          {/* روابط سريعة */}
          <section>
            <h2 className="text-sm font-bold text-muted-foreground mb-3">روابط سريعة</h2>
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" /> {label}
                </Link>
              ))}
            </div>
          </section>

          {/* أحدث الطلبات */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-muted-foreground">أحدث الطلبات</h2>
              <Link href="/admin/orders" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                عرض الكل <ArrowLeft className="h-3 w-3" />
              </Link>
            </div>
            <Card className="border border-border">
              {stats.recentOrders.length === 0 ? (
                <CardContent className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات بعد</CardContent>
              ) : (
                <CardContent className="p-0 divide-y divide-border">
                  {stats.recentOrders.map((o) => (
                    <Link
                      key={o.id}
                      href="/admin/orders"
                      className="flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm">#{o.id.slice(0, 8)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>
                            {statusLabel(o.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {o.customer_name || "بدون اسم"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {fmtDate(o.created_at)}
                          </span>
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-primary whitespace-nowrap">{money(o.total)}</span>
                    </Link>
                  ))}
                </CardContent>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  )
}

// بطاقة مراجعة معلّقة — تُبرَز باللون الذهبي عند وجود عناصر، ومهدّأة عند صفر.
function PendingCard({
  href,
  icon: Icon,
  count,
  supported,
  title,
  emptyText,
}: {
  href: string
  icon: typeof StoreIcon
  count: number
  supported: boolean
  title: string
  emptyText: string
}) {
  const active = supported && count > 0
  return (
    <Link href={href} className="block">
      <Card
        className={`border transition-colors ${
          active ? "border-accent/40 bg-accent/10 hover:bg-accent/15" : "border-border hover:bg-secondary/40"
        }`}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              active ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            {!supported ? (
              <>
                <p className="text-lg font-bold text-foreground">غير متاح</p>
                <p className="text-xs text-muted-foreground">{title} — تعذّر الحساب (فهرس ناقص)</p>
              </>
            ) : active ? (
              <>
                <p className="text-3xl font-extrabold text-accent-foreground leading-none">{num(count)}</p>
                <p className="text-xs font-medium text-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {title}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> لا مراجعات
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{emptyText}</p>
              </>
            )}
          </div>
          <ArrowLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}

// بطاقة إجمالي بسيطة (اختياريًا قابلة للنقر).
function TotalCard({
  href,
  icon: Icon,
  value,
  label,
}: {
  href?: string
  icon: typeof StoreIcon
  value: number
  label: string
}) {
  const inner = (
    <Card className="border border-border h-full hover:bg-secondary/40 transition-colors">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-foreground leading-none">{num(value)}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  )
}

// إحصاء مصغّر لحالة طلب.
const TONE: Record<string, string> = {
  warning: "text-yellow-700",
  info: "text-blue-700",
  accent: "text-purple-700",
  success: "text-green-700",
  danger: "text-red-700",
}
function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock
  label: string
  value: number
  tone: keyof typeof TONE | string
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${TONE[tone] || "text-muted-foreground"}`} />
      <p className="text-xl font-extrabold text-foreground leading-none">{num(value)}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  )
}
