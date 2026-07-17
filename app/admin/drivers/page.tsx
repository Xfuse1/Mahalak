"use client"

// ADM-03: صفحة إدارة السائقين — مراجعة السائقين الجدد واعتمادهم/رفضهم + التحكم بالتوفّر.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { logError } from "@/lib/logger"
import {
  getAdminDrivers,
  setDriverApproval,
  setDriverAvailability,
  getDriverStats,
  createDriver,
  type AdminDriver,
  type AdminDriverStats,
} from "@/lib/actions/admin"
import { Bike, Star, Package, MapPin, Phone, CheckCircle2, XCircle, Clock, BadgeCheck, Loader2, Power, BarChart3, ShoppingBag, UserPlus } from "lucide-react"

type Filter = "pending" | "approved" | "all"

export default function AdminDriversPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [drivers, setDrivers] = useState<AdminDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("pending")
  const [busyId, setBusyId] = useState<string | null>(null)
  // إحصاءات لكل سائق (توسّع تحت البطاقة) — نُخزّن النجاح فقط (لا نُخزّن الفشل حتى تُعيد فتحةٌ لاحقة الجلب)
  const [statsFor, setStatsFor] = useState<string | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, AdminDriverStats>>({})
  const [statsLoading, setStatsLoading] = useState<string | null>(null)
  // إضافة سائق جديد (تسجيل من الأدمن — الدخول لاحقًا بالهاتف + OTP)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", price: "", vehicle_type: "", areas: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminDrivers()
      if (res.success && res.drivers) setDrivers(res.drivers)
      else setError(true)
    } catch (e) {
      logError("[admin/drivers] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleApproval = async (d: AdminDriver, approved: boolean) => {
    if (!approved) {
      const ok = await confirm({
        title: d.is_approved ? "إلغاء اعتماد السائق" : "رفض السائق",
        message: `${d.is_approved ? "إلغاء اعتماد" : "رفض"} السائق "${d.name || "بدون اسم"}"؟`,
        confirmText: d.is_approved ? "إلغاء الاعتماد" : "رفض",
        cancelText: "تراجع",
        variant: "danger",
      })
      if (!ok) return
    }
    setBusyId(d.id)
    try {
      const res = await setDriverApproval(d.id, approved)
      if (res.success) {
        toast.success(approved ? "تم اعتماد السائق" : "تم تحديث الحالة")
        setDrivers((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_approved: approved } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/drivers] setApproval", e)
      toast.error("تعذّر التحديث")
    } finally {
      setBusyId(null)
    }
  }

  const handleAvailability = async (d: AdminDriver) => {
    const next = !d.is_available
    setBusyId(d.id)
    try {
      const res = await setDriverAvailability(d.id, next)
      if (res.success) {
        toast.success(next ? "السائق متاح الآن" : "تم إيقاف توفّر السائق")
        setDrivers((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_available: next } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/drivers] setAvailability", e)
      toast.error("تعذّر التحديث")
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("الاسم والهاتف مطلوبان")
      return
    }
    setAdding(true)
    try {
      const res = await createDriver({
        name: form.name.trim(),
        phone: form.phone.trim(),
        price: form.price ? Number(form.price) : undefined,
        vehicle_type: form.vehicle_type.trim() || undefined,
        areas: form.areas ? form.areas.split(/[,،]/).map((a) => a.trim()).filter(Boolean) : undefined,
      })
      if (res.success) {
        toast.success("تم تسجيل السائق — يقدر يدخل بالهاتف + كود OTP")
        setForm({ name: "", phone: "", price: "", vehicle_type: "", areas: "" })
        setShowAdd(false)
        setFilter("all")
        await load()
      } else {
        toast.error(res.error || "تعذّر إنشاء السائق")
      }
    } catch (e) {
      logError("[admin/drivers] create", e)
      toast.error("تعذّر إنشاء السائق")
    } finally {
      setAdding(false)
    }
  }

  const toggleStats = async (d: AdminDriver) => {
    if (statsFor === d.id) {
      setStatsFor(null)
      return
    }
    setStatsFor(d.id)
    if (statsMap[d.id] !== undefined) return // نجاح مخزّن مسبقًا (لا نُخزّن الفشل)
    setStatsLoading(d.id)
    try {
      const res = await getDriverStats(d.id)
      if (res.success && res.stats) {
        const stats = res.stats
        setStatsMap((prev) => ({ ...prev, [d.id]: stats }))
      } else {
        // لا نُخزّن الفشل: نحذف المفتاح حتى تُعيد فتحةٌ لاحقة الجلب بدل التعليق على خطأ دائم
        setStatsMap((prev) => {
          const n = { ...prev }
          delete n[d.id]
          return n
        })
        toast.error(res.error || "تعذّر تحميل الإحصاءات")
      }
    } catch (e) {
      logError("[admin/drivers] getDriverStats", e)
      setStatsMap((prev) => {
        const n = { ...prev }
        delete n[d.id]
        return n
      })
      toast.error("تعذّر تحميل الإحصاءات")
    } finally {
      // نُصفّر علم التحميل فقط إن كان ما زال يخصّ هذا الطلب (فتحتان متزامنتان لا تُطفئ إحداهما الأخرى)
      setStatsLoading((cur) => (cur === d.id ? null : cur))
    }
  }

  const filtered = drivers.filter((d) =>
    filter === "all" ? true : filter === "approved" ? d.is_approved : !d.is_approved,
  )
  const pendingCount = drivers.filter((d) => !d.is_approved).length

  const TABS: [Filter, string][] = [
    ["pending", `قيد المراجعة (${pendingCount})`],
    ["approved", "المعتمدون"],
    ["all", "الكل"],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">إدارة السائقين</h1>
          <p className="text-sm text-muted-foreground">راجع السائقين الجدد واعتمدهم أو ارفضهم، وتحكّم بتوفّرهم.</p>
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

      {/* إضافة سائق جديد (تسجيل من الأدمن) */}
      <div className="mb-6">
        <Button
          onClick={() => setShowAdd((s) => !s)}
          variant={showAdd ? "outline" : "default"}
          className="rounded-xl gap-1"
        >
          <UserPlus className="h-4 w-4" /> {showAdd ? "إغلاق" : "إضافة سائق"}
        </Button>
        {showAdd && (
          <Card className="mt-3 border border-border">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">الاسم *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم السائق" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">الهاتف *</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" dir="ltr" inputMode="tel" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">سعر التوصيل (اختياري)</label>
                  <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" inputMode="numeric" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">نوع المركبة (اختياري)</label>
                  <Input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="موتوسيكل / سيارة" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">المناطق (اختياري، افصل بفاصلة)</label>
                  <Input value={form.areas} onChange={(e) => setForm({ ...form, areas: e.target.value })} placeholder="جرجا، سوهاج" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleCreate} disabled={adding || !form.name.trim() || !form.phone.trim()} className="rounded-xl gap-1">
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حفظ السائق
                </Button>
                <Button variant="ghost" onClick={() => setShowAdd(false)} className="rounded-xl">إلغاء</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                السائق يدخل التطبيق بهذا الهاتف + كود OTP يُرسَل له. الهاتف لازم يكون فريدًا.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل السائقين. حاول مرة أخرى." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bike}
          title={filter === "pending" ? "لا يوجد سائقون بانتظار المراجعة" : "لا يوجد سائقون"}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((d) => (
            <Card key={d.id} className="border border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Bike className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground">{d.name || "سائق بدون اسم"}</h3>
                      {d.is_approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <BadgeCheck className="h-3 w-3" /> معتمد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" /> قيد المراجعة
                        </span>
                      )}
                      {d.is_approved && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                            d.is_available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${d.is_available ? "bg-primary" : "bg-muted-foreground"}`} />
                          {d.is_available ? "متاح" : "غير متاح"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {d.phone && (
                        <p className="flex items-center gap-1" dir="ltr">
                          <Phone className="h-3 w-3" /> {d.phone}
                        </p>
                      )}
                      <p className="flex items-center gap-3 flex-wrap">
                        {d.vehicle_type && (
                          <span className="flex items-center gap-1">
                            <Bike className="h-3 w-3" /> {d.vehicle_type}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" /> {(d.rating || 0).toFixed(1)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {d.total_deliveries} توصيلة
                        </span>
                        {d.price > 0 && <span>{d.price} ج.م</span>}
                      </p>
                      {d.areas && d.areas.length > 0 && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" /> {d.areas.join("، ")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {!d.is_approved ? (
                    <>
                      <Button size="sm" disabled={busyId === d.id} onClick={() => handleApproval(d, true)} className="rounded-xl gap-1">
                        {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === d.id}
                        onClick={() => handleApproval(d, false)}
                        className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4" /> رفض
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === d.id}
                        onClick={() => handleAvailability(d)}
                        className="rounded-xl gap-1"
                      >
                        {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                        {d.is_available ? "إيقاف التوفّر" : "تفعيل التوفّر"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === d.id}
                        onClick={() => handleApproval(d, false)}
                        className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4" /> إلغاء الاعتماد
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleStats(d)}
                    className="rounded-xl gap-1"
                  >
                    <BarChart3 className="h-4 w-4" /> إحصاءات
                  </Button>
                </div>

                {/* توسّع الإحصاءات */}
                {statsFor === d.id && (
                  <div className="rounded-xl bg-secondary/40 p-3">
                    {statsLoading === d.id ? (
                      <div className="flex items-center justify-center py-3">
                        <Spinner size="sm" label="جاري حساب الإحصاءات..." />
                      </div>
                    ) : statsMap[d.id] ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-background p-2">
                          <ShoppingBag className="h-4 w-4 mx-auto text-muted-foreground" />
                          <div className="text-lg font-extrabold text-foreground">{statsMap[d.id]!.assignedOrders}</div>
                          <div className="text-[11px] text-muted-foreground">طلبات مُسندة</div>
                        </div>
                        <div className="rounded-lg bg-background p-2">
                          <Package className="h-4 w-4 mx-auto text-muted-foreground" />
                          <div className="text-lg font-extrabold text-foreground">{statsMap[d.id]!.completedDeliveries}</div>
                          <div className="text-[11px] text-muted-foreground">توصيلات مكتملة</div>
                        </div>
                        <div className="rounded-lg bg-background p-2">
                          <Star className="h-4 w-4 mx-auto text-muted-foreground" />
                          <div className="text-lg font-extrabold text-foreground">{statsMap[d.id]!.ratingCount}</div>
                          <div className="text-[11px] text-muted-foreground">عدد التقييمات</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground py-2">تعذّر تحميل الإحصاءات</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
