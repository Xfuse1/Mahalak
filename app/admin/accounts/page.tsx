"use client"

// ADM-04: صفحة إدارة الحسابات — عرض العملاء/البائعين/السائقين وتفعيل/تعطيل (حظر) الحساب.
// التعطيل مُنفَّذ إجباريًا سيرفر-سايد (Firebase Auth disabled للعميل/البائع + علم Firestore يفحصه
// getCurrentUid/getCurrentUser/getCurrentDriverId) — ليس تجميليًا.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { logError } from "@/lib/logger"
import { getAdminAccounts, setAccountDisabled, type AdminAccount } from "@/lib/actions/admin"
import {
  Users,
  User,
  Store as StoreIcon,
  Bike,
  Phone,
  Mail,
  Ban,
  CheckCircle2,
  ShieldOff,
  BadgeCheck,
  Loader2,
  Search,
} from "lucide-react"

type Filter = "customer" | "seller" | "driver" | "all"

const ROLE_LABEL: Record<AdminAccount["role"], string> = {
  customer: "عميل",
  seller: "بائع",
  driver: "سائق",
}

const ROLE_ICON: Record<AdminAccount["role"], typeof User> = {
  customer: User,
  seller: StoreIcon,
  driver: Bike,
}

export default function AdminAccountsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminAccounts("all")
      if (res.success && res.accounts) {
        setAccounts(res.accounts)
        setTruncated(res.truncated === true)
      } else setError(true)
    } catch (e) {
      logError("[admin/accounts] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleToggle = async (a: AdminAccount) => {
    const next = !a.disabled
    if (next) {
      const ok = await confirm({
        title: "تعطيل الحساب",
        message: `تعطيل حساب "${a.name || "بدون اسم"}" (${ROLE_LABEL[a.role]})؟ سيُمنع من تسجيل الدخول والوصول فورًا.`,
        confirmText: "تعطيل",
        cancelText: "تراجع",
        variant: "danger",
      })
      if (!ok) return
    }
    setBusyId(a.uid)
    try {
      const res = await setAccountDisabled(a.uid, next)
      if (res.success) {
        toast.success(next ? "تم تعطيل الحساب" : "تم تفعيل الحساب")
        setAccounts((prev) => prev.map((x) => (x.uid === a.uid ? { ...x, disabled: next } : x)))
      } else {
        toast.error(res.error || "تعذّر التحديث")
      }
    } catch (e) {
      logError("[admin/accounts] setDisabled", e)
      toast.error("تعذّر التحديث")
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (filter !== "all" && a.role !== filter) return false
      if (!q) return true
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.phone || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q)
      )
    })
  }, [accounts, filter, search])

  const counts = useMemo(
    () => ({
      all: accounts.length,
      customer: accounts.filter((a) => a.role === "customer").length,
      seller: accounts.filter((a) => a.role === "seller").length,
      driver: accounts.filter((a) => a.role === "driver").length,
      disabled: accounts.filter((a) => a.disabled).length,
    }),
    [accounts],
  )

  const TABS: [Filter, string][] = [
    ["all", `الكل (${counts.all})`],
    ["customer", `العملاء (${counts.customer})`],
    ["seller", `البائعون (${counts.seller})`],
    ["driver", `السائقون (${counts.driver})`],
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">إدارة الحسابات</h1>
          <p className="text-sm text-muted-foreground">
            راجع العملاء والبائعين والسائقين، وفعّل أو عطّل (احظر) الحساب. التعطيل يُنفَّذ فورًا.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 flex-wrap">
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

      {/* شريط البحث */}
      <div className="relative mb-5">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف أو البريد..."
          className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
        />
      </div>

      {counts.disabled > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          <span className="inline-flex items-center gap-1 font-bold text-destructive">
            <ShieldOff className="h-3 w-3" /> {counts.disabled} حساب معطّل
          </span>
        </p>
      )}

      {truncated && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
          القائمة تعرض جزءًا من الحسابات فقط (بلغنا الحد الأقصى). استخدم البحث للوصول لحساب محدّد؛ بعض
          الحسابات القديمة قد لا تظهر هنا حتى تُضاف الصفحات/البحث السيرفر-سايد.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل الحسابات. حاول مرة أخرى." onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={search ? "لا توجد نتائج مطابقة" : "لا توجد حسابات"} />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const RoleIcon = ROLE_ICON[a.role]
            const busy = busyId === a.uid
            return (
              <Card
                key={`${a.role}:${a.uid}`}
                className={`border transition-colors ${a.disabled ? "border-destructive/40 bg-destructive/5" : "border-border"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <RoleIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{a.name || "بدون اسم"}</h3>
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                          <RoleIcon className="h-3 w-3" /> {ROLE_LABEL[a.role]}
                        </span>
                        {a.disabled && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                            <ShieldOff className="h-3 w-3" /> معطّل
                          </span>
                        )}
                        {a.is_approved && a.role !== "customer" && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <BadgeCheck className="h-3 w-3" /> معتمد
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {a.phone && (
                          <p className="flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" /> {a.phone}
                          </p>
                        )}
                        {a.email && (
                          <p className="flex items-center gap-1" dir="ltr">
                            <Mail className="h-3 w-3" /> {a.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center flex-shrink-0">
                      {a.disabled ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleToggle(a)}
                          className="rounded-xl gap-1"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} تفعيل
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleToggle(a)}
                          className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} تعطيل
                        </Button>
                      )}
                    </div>
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
