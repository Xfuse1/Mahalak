"use client"

// ADM-02: لوحة الأدمن — مراجعة الشكاوى وحلّها مع رد يصل المستخدم.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { logError } from "@/lib/logger"
import { getAdminComplaints, resolveComplaint, type Complaint } from "@/lib/actions/complaints"
import { takeDownProduct } from "@/lib/actions/admin"
import { MessageSquareWarning, CheckCircle2, Clock, User, Phone, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"

type Filter = "open" | "resolved" | "all"
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""
const typeLabel = (x: string) =>
  (({ order: "طلب", store: "متجر", driver: "سائق", product: "منتج", other: "أخرى" }) as Record<string, string>)[x] || x

// رابط العنصر المُبلَّغ عنه — يفتح ما يراه العميل بالضبط قبل قرار الإزالة
const targetHref = (c: Complaint) =>
  c.target_id ? (c.target_type === "product" ? `/product/${c.target_id}` : c.target_type === "store" ? `/store/${c.target_id}` : null) : null

export default function AdminComplaintsPage() {
  const toast = useToast()
  const [items, setItems] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("open")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminComplaints()
      if (res.success && res.complaints) setItems(res.complaints)
      else setError(true)
    } catch (e) {
      logError("[admin/complaints] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // إزالة المنتج المُبلَّغ عنه ثم إغلاق التذكرة بحالة "تمت الإزالة" — الفعلان مرتبطان:
  // إزالة بلا إغلاق تترك التذكرة معلّقة، وإغلاق بلا إزالة يترك المحتوى معروضًا.
  const takeDown = async (c: Complaint) => {
    if (!c.target_id) return
    if (!window.confirm(`إزالة «${c.target_name || "المنتج"}» نهائيًا من المتجر؟`)) return
    setBusyId(c.id)
    try {
      const res = await takeDownProduct(c.target_id, notes[c.id] || undefined)
      if (res.success) {
        await resolveComplaint(c.id, notes[c.id] || "تمت إزالة المنتج بعد المراجعة.", "action_taken")
        toast.success("تمت إزالة المنتج وإخطار التاجر")
        setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "action_taken" } : x)))
      } else {
        toast.error(res.error || "تعذّر إزالة المنتج")
      }
    } catch (e) {
      logError("[admin/complaints] takeDown", e)
      toast.error("تعذّر إزالة المنتج")
    } finally {
      setBusyId(null)
    }
  }

  const resolve = async (c: Complaint) => {
    setBusyId(c.id)
    try {
      const res = await resolveComplaint(c.id, notes[c.id] || undefined)
      if (res.success) {
        toast.success("تمت المعالجة وإخطار المستخدم")
        setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "resolved", admin_note: notes[c.id] || x.admin_note } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/complaints] resolve", e)
      toast.error("تعذّر التحديث")
    } finally {
      setBusyId(null)
    }
  }

  // «معالَجة» تشمل كل حالة منتهية (resolved/action_taken/rejected)، و«مفتوحة» هي open وحدها.
  // الشرط القديم كان "أي شيء غير resolved = مفتوحة"، فبعد توسيع الحالات كانت التذاكر المُزال
  // محتواها تظهر مفتوحة للأبد.
  const filtered = items.filter((c) =>
    filter === "all" ? true : filter === "resolved" ? c.status !== "open" : c.status === "open",
  )
  const openCount = items.filter((c) => c.status === "open").length
  const TABS: [Filter, string][] = [
    ["open", `مفتوحة (${openCount})`],
    ["resolved", "معالَجة"],
    ["all", "الكل"],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">الشكاوى والدعم</h1>
          <p className="text-sm text-muted-foreground">راجع شكاوى المستخدمين وحلّها مع رد يصلهم كإشعار.</p>
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
        <ErrorState description="تعذّر تحميل الشكاوى. حاول مرة أخرى." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={filter === "open" ? "لا توجد شكاوى مفتوحة" : "لا توجد شكاوى"} />
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <Card key={c.id} className="border border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-foreground">{c.subject}</p>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{typeLabel(c.target_type)}</span>
                  {c.status !== "open" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      {c.status === "action_taken" ? "تمت الإزالة" : c.status === "rejected" ? "مرفوض" : "معالَجة"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> مفتوحة
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {c.user_name || c.user_id.slice(0, 8)}
                  </span>
                  {c.user_phone && (
                    <span dir="ltr" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.user_phone}
                    </span>
                  )}
                  {c.order_id && <span>طلب #{c.order_id.slice(0, 8)}</span>}
                  {c.target_name &&
                    (targetHref(c) ? (
                      <Link href={targetHref(c)!} target="_blank" className="text-primary hover:underline font-medium">
                        {c.target_name}
                      </Link>
                    ) : (
                      <span className="font-medium">{c.target_name}</span>
                    ))}
                  <span>{fmtDate(c.created_at)}</span>
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.message}</p>
                {c.admin_note && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-sm">
                    <span className="font-bold text-primary">ردّك: </span>
                    {c.admin_note}
                  </div>
                )}
                {c.status === "open" && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Input
                      value={notes[c.id] || ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [c.id]: e.target.value }))}
                      placeholder="رد للمستخدم (اختياري)"
                      className="h-10 rounded-xl flex-1"
                    />
                    <Button size="sm" disabled={busyId === c.id} onClick={() => resolve(c)} className="rounded-xl gap-1">
                      {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حل وإرسال
                    </Button>
                    {/* إزالة المحتوى المُبلَّغ عنه — سياسة UGC تشترط قدرة فعلية على الإزالة لا مجرد استقبال بلاغات */}
                    {c.target_type === "product" && c.target_id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === c.id}
                        onClick={() => takeDown(c)}
                        className="rounded-xl gap-1"
                      >
                        <Trash2 className="h-4 w-4" /> إزالة المنتج
                      </Button>
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
