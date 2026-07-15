"use client"

// إدارة المسؤولين (superAdmin فقط): عرض المسؤولين/المديرين العامّين، البحث عن مستخدم لترقيته إلى
// admin، وسحب صلاحية admin. كل الأفعال محميّة سيرفر-سايد بـ ensureSuperAdmin() — هذه الواجهة
// للراحة فقط، والحارس الحقيقي في lib/actions/admin.ts. النمط مطابق لصفحة إدارة الحسابات.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { logError } from "@/lib/logger"
import {
  getManagedAdmins,
  lookupUserForAdmin,
  promoteToAdmin,
  demoteFromAdmin,
  type ManagedAdmin,
  type AdminLookupResult,
} from "@/lib/actions/admin"
import {
  ShieldCheck,
  Crown,
  Mail,
  UserPlus,
  UserMinus,
  Search,
  Loader2,
  ShieldAlert,
  Lock,
} from "lucide-react"

export function ManageAdminsClient() {
  const toast = useToast()
  const confirm = useConfirm()
  const [admins, setAdmins] = useState<ManagedAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // البحث عن مستخدم لترقيته
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [candidate, setCandidate] = useState<AdminLookupResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getManagedAdmins()
      if (res.success && res.admins) setAdmins(res.admins)
      else setError(true)
    } catch (e) {
      logError("[admin/manage-admins] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchError(null)
    setCandidate(null)
    try {
      const res = await lookupUserForAdmin(q)
      if (res.success && res.user) setCandidate(res.user)
      else setSearchError(res.error || "لم يُعثر على المستخدم")
    } catch (err) {
      logError("[admin/manage-admins] lookup", err)
      setSearchError("تعذّر البحث عن المستخدم")
    } finally {
      setSearching(false)
    }
  }

  const handlePromote = async (c: AdminLookupResult) => {
    const ok = await confirm({
      title: "ترقية إلى مسؤول",
      message: `منح "${c.name || c.email || c.uid}" صلاحية مسؤول (admin)؟ سيتمكّن من الوصول للوحة الإدارة وكل أدواتها.`,
      confirmText: "ترقية",
      cancelText: "تراجع",
      variant: "default",
    })
    if (!ok) return
    setBusyId(c.uid)
    try {
      const res = await promoteToAdmin(c.uid)
      if (res.success) {
        toast.success("تمت الترقية إلى مسؤول")
        setCandidate(null)
        setQuery("")
        await load()
      } else {
        toast.error(res.error || "تعذّرت الترقية")
      }
    } catch (e) {
      logError("[admin/manage-admins] promote", e)
      toast.error("تعذّرت الترقية")
    } finally {
      setBusyId(null)
    }
  }

  const handleDemote = async (a: ManagedAdmin) => {
    const ok = await confirm({
      title: "سحب صلاحية المسؤول",
      message: `سحب صلاحية المسؤول من "${a.name || a.email || a.uid}"؟ سيُعاد حسابه إلى دوره السابق ويُفقَد وصوله للوحة فورًا (قد يستمر الوصول المباشر للبيانات حتى انتهاء جلسته).`,
      confirmText: "سحب الصلاحية",
      cancelText: "تراجع",
      variant: "danger",
    })
    if (!ok) return
    setBusyId(a.uid)
    try {
      const res = await demoteFromAdmin(a.uid)
      if (res.success) {
        toast.success("تم سحب صلاحية المسؤول")
        setAdmins((prev) => prev.filter((x) => x.uid !== a.uid))
      } else {
        toast.error(res.error || "تعذّر سحب الصلاحية")
      }
    } catch (e) {
      logError("[admin/manage-admins] demote", e)
      toast.error("تعذّر سحب الصلاحية")
    } finally {
      setBusyId(null)
    }
  }

  const counts = useMemo(
    () => ({
      total: admins.length,
      superAdmins: admins.filter((a) => a.isSuperAdmin).length,
      admins: admins.filter((a) => !a.isSuperAdmin).length,
    }),
    [admins],
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">إدارة المسؤولين</h1>
        <p className="text-sm text-muted-foreground">
          رقِّ مستخدمًا إلى مسؤول (admin) أو اسحب صلاحيته. المدير العام (superAdmin) يُدار خارج
          اللوحة ولا يُنشأ/يُسحب من هنا.
        </p>
      </div>

      {/* بحث + ترقية */}
      <Card className="border-border mb-6">
        <CardContent className="p-4">
          <h2 className="font-bold text-foreground mb-1 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> ترقية مستخدم إلى مسؤول
          </h2>
          <p className="text-xs text-muted-foreground mb-3">ابحث عن المستخدم بالبريد الإلكتروني أو معرّف الحساب (UID).</p>
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="البريد الإلكتروني أو UID..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()} className="rounded-xl gap-1">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} بحث
            </Button>
          </form>

          {searchError && (
            <p className="mt-3 text-sm text-destructive flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" /> {searchError}
            </p>
          )}

          {candidate && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3 flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">{candidate.name || "بدون اسم"}</p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {candidate.email && (
                    <p className="flex items-center gap-1" dir="ltr">
                      <Mail className="h-3 w-3" /> {candidate.email}
                    </p>
                  )}
                  <p className="font-mono opacity-70" dir="ltr">
                    {candidate.uid}
                  </p>
                </div>
              </div>
              {candidate.isPrivileged ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> {candidate.isSuperAdmin ? "مدير عام بالفعل" : "مسؤول بالفعل"}
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={busyId === candidate.uid}
                  onClick={() => handlePromote(candidate)}
                  className="rounded-xl gap-1"
                >
                  {busyId === candidate.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} ترقية إلى مسؤول
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* قائمة المسؤولين */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-bold text-foreground">
          المسؤولون الحاليون {!loading && !error && `(${counts.total})`}
        </h2>
        {!loading && !error && (
          <p className="text-xs text-muted-foreground">
            {counts.superAdmins} مدير عام · {counts.admins} مسؤول
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل المسؤولين. حاول مرة أخرى." onRetry={load} />
      ) : admins.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="لا يوجد مسؤولون" />
      ) : (
        <div className="space-y-3">
          {admins.map((a) => {
            const busy = busyId === a.uid
            return (
              <Card
                key={a.uid}
                className={`border transition-colors ${a.isSuperAdmin ? "border-accent/40 bg-accent/5" : "border-border"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        a.isSuperAdmin ? "bg-accent/15" : "bg-primary/10"
                      }`}
                    >
                      {a.isSuperAdmin ? (
                        <Crown className="h-5 w-5 text-accent-foreground" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{a.name || "بدون اسم"}</h3>
                        {a.isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">
                            <Crown className="h-3 w-3" /> مدير عام
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <ShieldCheck className="h-3 w-3" /> مسؤول
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {a.email && (
                          <p className="flex items-center gap-1" dir="ltr">
                            <Mail className="h-3 w-3" /> {a.email}
                          </p>
                        )}
                        <p className="font-mono opacity-70" dir="ltr">
                          {a.uid}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center flex-shrink-0">
                      {a.isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" /> يُدار خارج اللوحة
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleDemote(a)}
                          className="rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />} سحب الصلاحية
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
