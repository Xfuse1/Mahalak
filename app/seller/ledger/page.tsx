"use client"

// UX-01: دفتر ديون البائع — رقمنة "البيع بالأجل" التقليدي.
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { Card, CardContent } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import { Spinner } from "../../../components/ui/spinner"
import { EmptyState } from "../../../components/ui/empty-state"
import { ErrorState } from "../../../components/ui/error-state"
import { useToast } from "../../../components/ui/toast"
import { useConfirm } from "../../../components/ui/confirm-dialog"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { logError } from "../../../lib/logger"
import {
  getStoreDebts,
  getDebtTransactions,
  createDebt,
  addDebtTransaction,
  deleteDebt,
  type DebtAccount,
  type DebtTransaction,
} from "../../../lib/actions/debts"
import { BookText, Plus, Trash2, Phone, User, ArrowDownLeft, ArrowUpRight, Users, Wallet, Loader2 } from "lucide-react"

const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-US")
const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""

export default function LedgerPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const toast = useToast()
  const confirm = useConfirm()

  const [debts, setDebts] = useState<DebtAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // إضافة عميل
  const [addOpen, setAddOpen] = useState(false)
  const [savingAdd, setSavingAdd] = useState(false)

  // حركات حساب
  const [txAccount, setTxAccount] = useState<DebtAccount | null>(null)
  const [txs, setTxs] = useState<DebtTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txAmount, setTxAmount] = useState("")
  const [txNote, setTxNote] = useState("")
  const [savingTx, setSavingTx] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/auth?role=seller")
      return
    }
    if (user.role !== "seller") router.push("/")
  }, [user, isLoading, router])

  const loadDebts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(false)
    try {
      const data = await getStoreDebts()
      setDebts(data)
    } catch (e) {
      logError("[ledger] loadDebts", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadDebts()
  }, [loadDebts])

  const openTx = useCallback(async (account: DebtAccount) => {
    setTxAccount(account)
    setTxAmount("")
    setTxNote("")
    setTxLoading(true)
    try {
      const data = await getDebtTransactions(account.id)
      setTxs(data)
    } catch (e) {
      logError("[ledger] loadTx", e)
      toast.error(t("تعذّر تحميل سجل الحركات", "Failed to load transactions"))
    } finally {
      setTxLoading(false)
    }
  }, [t, toast])

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSavingAdd(true)
    try {
      const res = await createDebt({
        customer_name: String(form.get("name") || ""),
        customer_phone: String(form.get("phone") || "") || undefined,
        initial_amount: Number(form.get("amount")) || 0,
        note: String(form.get("note") || "") || undefined,
      })
      if (res.success) {
        toast.success(t("تمت إضافة العميل", "Customer added"))
        setAddOpen(false)
        loadDebts()
      } else {
        toast.error(res.error || t("تعذّر الحفظ", "Failed to save"))
      }
    } catch (e) {
      logError("[ledger] createDebt", e)
      toast.error(t("تعذّر الحفظ", "Failed to save"))
    } finally {
      setSavingAdd(false)
    }
  }

  const handleTx = async (type: "debt" | "payment") => {
    if (!txAccount) return
    const amount = Number(txAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("أدخل مبلغًا صحيحًا", "Enter a valid amount"))
      return
    }
    setSavingTx(true)
    try {
      const res = await addDebtTransaction(txAccount.id, { type, amount, note: txNote || undefined })
      if (res.success) {
        toast.success(type === "payment" ? t("تم تسجيل الدفعة", "Payment recorded") : t("تم تسجيل الدين", "Debt recorded"))
        const newBalance = res.data?.newBalance ?? txAccount.balance
        setTxAccount({ ...txAccount, balance: newBalance })
        setTxAmount("")
        setTxNote("")
        const data = await getDebtTransactions(txAccount.id)
        setTxs(data)
        loadDebts()
      } else {
        toast.error(res.error || t("تعذّر التسجيل", "Failed"))
      }
    } catch (e) {
      logError("[ledger] addTx", e)
      toast.error(t("تعذّر التسجيل", "Failed"))
    } finally {
      setSavingTx(false)
    }
  }

  const handleDelete = async (account: DebtAccount) => {
    const ok = await confirm({
      title: t("حذف العميل", "Delete Customer"),
      message: t(`حذف "${account.customer_name}" وكل سجل ديونه؟`, `Delete "${account.customer_name}" and all their debt history?`),
      confirmText: t("حذف", "Delete"),
      cancelText: t("إلغاء", "Cancel"),
      variant: "danger",
    })
    if (!ok) return
    const res = await deleteDebt(account.id)
    if (res.success) {
      toast.success(t("تم الحذف", "Deleted"))
      loadDebts()
    } else {
      toast.error(res.error || t("تعذّر الحذف", "Failed to delete"))
    }
  }

  if (isLoading || !user || user.role !== "seller") return null

  const totalOwed = debts.reduce((s, d) => s + (d.balance || 0), 0)
  const owingCount = debts.filter((d) => (d.balance || 0) > 0).length

  return (
    <div className="flex min-h-screen bg-background">
      <SellerHeader />
      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* الترويسة */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-2xl text-primary-foreground shadow-lg">
                <BookText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("دفتر الديون", "Debt Ledger")}</h1>
                <p className="text-sm text-muted-foreground">{t("تابع البيع بالأجل وتحصيل ديون عملائك", "Track credit sales and collect customer debts")}</p>
              </div>
            </div>
            <Button onClick={() => setAddOpen(true)} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("إضافة عميل", "Add Customer")}</span>
            </Button>
          </div>

          {/* بطاقات الملخّص */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/15 text-accent-foreground">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("إجمالي المستحقّ", "Total Owed")}</p>
                  <p className="text-xl font-extrabold text-foreground">{fmt(totalOwed)} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span></p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("عملاء عليهم دين", "Customers Owing")}</p>
                  <p className="text-xl font-extrabold text-foreground">{owingCount} <span className="text-sm font-medium text-muted-foreground">/ {debts.length}</span></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* المحتوى */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" label={t("جاري التحميل...", "Loading...")} className="flex-col" />
            </div>
          ) : error ? (
            <ErrorState description={t("تعذّر تحميل الدفتر. حاول مرة أخرى.", "Failed to load the ledger. Please try again.")} onRetry={loadDebts} />
          ) : debts.length === 0 ? (
            <EmptyState
              icon={BookText}
              title={t("الدفتر فارغ", "Ledger is Empty")}
              description={t("أضف أول عميل لتبدأ تسجيل البيع بالأجل والتحصيل", "Add your first customer to start tracking credit sales")}
              action={{ label: t("إضافة عميل", "Add Customer"), onClick: () => setAddOpen(true) }}
            />
          ) : (
            <div className="space-y-3">
              {debts.map((d) => (
                <Card key={d.id} className="border border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3 flex-wrap">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{d.customer_name}</p>
                      {d.customer_phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                          <Phone className="h-3 w-3" /> {d.customer_phone}
                        </p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="text-[11px] text-muted-foreground">{t("الرصيد", "Balance")}</p>
                      <p className={`text-lg font-extrabold ${(d.balance || 0) > 0 ? "text-destructive" : "text-primary"}`}>
                        {fmt(d.balance)} <span className="text-xs font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => openTx(d)}>
                        <BookText className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("الحركات", "Activity")}</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:bg-destructive/10" onClick={() => handleDelete(d)} aria-label={t("حذف", "Delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* نافذة إضافة عميل */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("إضافة عميل جديد", "Add New Customer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">{t("اسم العميل", "Customer Name")} *</Label>
              <Input id="d-name" name="name" required placeholder={t("مثال: عم أحمد", "e.g. Ahmed")} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-phone">{t("الهاتف (اختياري)", "Phone (optional)")}</Label>
              <Input id="d-phone" name="phone" type="tel" dir="ltr" placeholder="01xxxxxxxxx" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-amount">{t("الدين الافتتاحي (اختياري)", "Opening Debt (optional)")}</Label>
              <Input id="d-amount" name="amount" type="number" min={0} step="any" placeholder="0" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-note">{t("ملاحظة (اختياري)", "Note (optional)")}</Label>
              <Input id="d-note" name="note" className="h-11 rounded-xl" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setAddOpen(false)}>
                {t("إلغاء", "Cancel")}
              </Button>
              <Button type="submit" disabled={savingAdd} className="flex-1 rounded-xl gap-2">
                {savingAdd && <Loader2 className="size-4 animate-spin" />}
                {t("حفظ", "Save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* نافذة الحركات */}
      <Dialog open={!!txAccount} onOpenChange={(o) => !o && setTxAccount(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{txAccount?.customer_name}</DialogTitle>
          </DialogHeader>
          {txAccount && (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary/40 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("الرصيد الحالي", "Current Balance")}</p>
                <p className={`text-2xl font-extrabold ${(txAccount.balance || 0) > 0 ? "text-destructive" : "text-primary"}`}>
                  {fmt(txAccount.balance)} <span className="text-sm font-medium text-muted-foreground">{t("جنيه", "EGP")}</span>
                </p>
              </div>

              {/* نموذج حركة */}
              <div className="space-y-2 rounded-xl border border-border p-3">
                <Input
                  type="number" min={0} step="any" inputMode="decimal"
                  value={txAmount} onChange={(e) => setTxAmount(e.target.value)}
                  placeholder={t("المبلغ", "Amount")} className="h-11 rounded-xl"
                />
                <Input value={txNote} onChange={(e) => setTxNote(e.target.value)} placeholder={t("ملاحظة (اختياري)", "Note (optional)")} className="h-10 rounded-xl" />
                <div className="flex gap-2">
                  <Button type="button" disabled={savingTx} onClick={() => handleTx("payment")} className="flex-1 rounded-xl gap-1 bg-primary hover:bg-primary/90">
                    <ArrowDownLeft className="h-4 w-4" /> {t("تسجيل دفعة", "Payment")}
                  </Button>
                  <Button type="button" disabled={savingTx} variant="outline" onClick={() => handleTx("debt")} className="flex-1 rounded-xl gap-1 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <ArrowUpRight className="h-4 w-4" /> {t("إضافة دين", "Add Debt")}
                  </Button>
                </div>
              </div>

              {/* سجل الحركات */}
              <div>
                <p className="text-sm font-bold text-foreground mb-2">{t("سجل الحركات", "History")}</p>
                {txLoading ? (
                  <div className="flex justify-center py-6"><Spinner size="md" /></div>
                ) : txs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("لا توجد حركات بعد", "No transactions yet")}</p>
                ) : (
                  <div className="space-y-2">
                    {txs.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                        <div className={`p-1.5 rounded-lg ${tx.type === "payment" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {tx.type === "payment" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">
                            {tx.type === "payment" ? t("دفعة", "Payment") : t("دين", "Debt")}: {fmt(tx.amount)} {t("جنيه", "EGP")}
                          </p>
                          {tx.note && <p className="text-xs text-muted-foreground truncate">{tx.note}</p>}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(tx.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
