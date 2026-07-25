"use client"

// تسويات التوصيل: الكاش الذي حصّله السائقون (COD) ولم يُسلَّم للمتجر بعد، مُجمّعًا حسب السائق.
// البائع يؤكّد استلام الكاش من السائق فتُعلَّم الطلبات مُسوّاة. (السائق يحتفظ بأجرة التوصيل؛
// المتجر يستحقّ قيمة منتجاته فقط.)
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { Card, CardContent } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Spinner } from "../../../components/ui/spinner"
import { EmptyState } from "../../../components/ui/empty-state"
import { ErrorState } from "../../../components/ui/error-state"
import { useToast } from "../../../components/ui/toast"
import { useConfirm } from "../../../components/ui/confirm-dialog"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { logError } from "../../../lib/logger"
import { getStoreCodHoldings, markCodSettled, type CodByDriver } from "../../../lib/actions/settlements"
import { Wallet, User, CheckCircle2, Loader2, Truck } from "lucide-react"

const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

export default function SettlementsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const toast = useToast()
  const confirm = useConfirm()

  const [drivers, setDrivers] = useState<CodByDriver[]>([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getStoreCodHoldings()
      if (res.ok) {
        setDrivers(res.drivers || [])
        setTotalOwed(res.total_owed || 0)
      } else {
        setError(true)
      }
    } catch (e) {
      logError("[settlements] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/auth")
      return
    }
    load()
  }, [user, isLoading, router, load])

  const settleOne = async (orderId: string) => {
    const ok = await confirm({
      title: t("تأكيد استلام الكاش؟", "Confirm cash received?"),
      message: t("هتأكّد إنك استلمت كاش هذا الطلب من السائق. لا يمكن التراجع.", "Confirm you received this order's cash from the driver. This can't be undone."),
      confirmText: t("تأكيد", "Confirm"),
      cancelText: t("إلغاء", "Cancel"),
    })
    if (!ok) return
    setBusy(orderId)
    try {
      const res = await markCodSettled(orderId)
      if (res.ok) {
        toast.success(t("تم تأكيد الاستلام", "Confirmed"))
        await load()
      } else {
        toast.error(t("تعذّر التأكيد، حدّث وحاول تاني", "Couldn't confirm, refresh and retry"))
      }
    } catch {
      toast.error(t("تعذّر الاتصال بالخادم", "Couldn't reach the server"))
    } finally {
      setBusy(null)
    }
  }

  const settleDriver = async (g: CodByDriver) => {
    const ok = await confirm({
      title: t(`تأكيد استلام كل كاش ${g.driver_name}؟`, `Confirm all cash from ${g.driver_name}?`),
      message: t(`${g.count} طلب — إجمالي ${fmt(g.owed)} ج. هتُعلَّم كلها مُسوّاة.`, `${g.count} orders — ${fmt(g.owed)} EGP total. All will be marked settled.`),
      confirmText: t("تأكيد الكل", "Confirm all"),
      cancelText: t("إلغاء", "Cancel"),
    })
    if (!ok) return
    setBusy(g.driver_id)
    try {
      // تسلسليًّا كي لا نضغط الخادم؛ كلٌّ إيدمبوتنت فإعادة المحاولة آمنة. نتتبّع الفشل كي لا نعرض
      // نجاحًا كاذبًا لو فشل بعضها.
      let failed = 0
      for (const o of g.orders) {
        const res = await markCodSettled(o.order_id)
        if (!res.ok) failed++
      }
      if (failed === 0) toast.success(t("تم تأكيد استلام كل الكاش", "All cash confirmed"))
      else if (failed < g.orders.length) toast.error(t(`تأكّد البعض — فشل ${failed} طلب`, `Some settled — ${failed} failed`))
      else toast.error(t("تعذّر تأكيد أي طلب", "Nothing could be settled"))
      await load()
    } catch {
      toast.error(t("حصل خطأ أثناء التأكيد", "An error occurred"))
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <SellerHeader />
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            {t("تسويات التوصيل", "Delivery settlements")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("الكاش اللي حصّله السائقون من التوصيل COD ولسه ما سلّموهوش لمتجرك.", "COD cash collected by drivers, not yet handed to your store.")}
          </p>
        </div>

        {/* إجمالي المستحَق */}
        {!loading && !error && (
          <Card className="mb-6 border-0 shadow-sm rounded-2xl bg-primary/5 ring-1 ring-primary/15">
            <CardContent className="p-5 flex items-center justify-between">
              <span className="font-semibold text-gray-700">{t("إجمالي الكاش عند السائقين", "Total cash held by drivers")}</span>
              <span className="text-2xl font-extrabold text-primary">
                {fmt(totalOwed)} <span className="text-sm font-normal">{t("جنيه", "EGP")}</span>
              </span>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : drivers.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("لا يوجد كاش مستحَق", "Nothing to settle")}
            description={t("كل كاش التوصيل اتسلّم لمتجرك.", "All delivery cash has been settled with your store.")}
          />
        ) : (
          <div className="space-y-4">
            {drivers.map((g) => (
              <Card key={g.driver_id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{g.driver_name}</p>
                        <p className="text-xs text-muted-foreground">{g.count} {t("طلب", "orders")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-extrabold text-primary">{fmt(g.owed)} {t("ج", "EGP")}</span>
                      <Button size="sm" disabled={busy === g.driver_id} onClick={() => settleDriver(g)}>
                        {busy === g.driver_id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("استلمت الكل", "Settle all")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {g.orders.map((o) => (
                      <div key={o.order_id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-gray-500">#{o.order_id.slice(-6)}</span>
                          {o.order_type === "multi_store" && (
                            <span className="ms-2 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{t("متعدد", "multi")}</span>
                          )}
                          <span className="ms-2 text-gray-400 text-xs">{fmtDate(o.delivered_at || o.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-gray-800">{fmt(o.owed)} {t("ج", "EGP")}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === o.order_id || busy === g.driver_id}
                            onClick={() => settleOne(o.order_id)}
                          >
                            {busy === o.order_id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("استلمت", "Settle")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
