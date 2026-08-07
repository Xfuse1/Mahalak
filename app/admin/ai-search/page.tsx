"use client"

// تقرير البحث الذكي (أدمن) — محوره **الطلب غير الملبّى**.
//
// الترتيب هنا ليس تفضيلًا بصريًّا: «ما طلبه العملاء ولم يجدوه» أوّل ما يُرى، لأنه المخرج الوحيد
// القابل للتصرّف فيه — قائمة مشتريات تُعرَض على تاجر، لا رقمُ استخدامٍ يُتأمَّل. أرقام الاستخدام
// والتكلفة تحتها لأنها للمراقبة لا للقرار.

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/components/ui/toast"
import { logError } from "@/lib/logger"
import { getAiSearchInsights, type AiSearchInsights } from "@/lib/actions/admin"
import { AlertTriangle, Copy, Info, PackageSearch, RefreshCw, Search, ShoppingCart, Sparkles, Stethoscope } from "lucide-react"

const WINDOWS = [7, 30, 90] as const

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminAiSearchPage() {
  const toast = useToast()
  const [days, setDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<AiSearchInsights | null>(null)

  const load = useCallback(async (window: number) => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAiSearchInsights(window)
      if (res.success && res.insights) setData(res.insights)
      else setError(true)
    } catch (e) {
      logError("[admin/ai-search] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [load, days])

  const copyUnmet = async () => {
    if (!data?.unmet.length) return
    const text = data.unmet.map((row) => `${row.term} — ${row.count}`).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast.success("اتنسخت — ابعتها للتاجر")
    } catch {
      toast.error("تعذّر النسخ")
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-foreground md:text-3xl">
            <Sparkles className="h-6 w-6 text-accent" /> تقرير البحث الذكي
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ما بحث عنه العملاء ولم يجدوه — وهو ما تعرضه على التجّار ليضيفوه.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              type="button"
              variant="outline"
              onClick={() => setDays(w)}
              className={`rounded-xl ${days === w ? "border-accent text-accent" : "text-muted-foreground"}`}
            >
              {w} يوم
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => load(days)} className="gap-1 rounded-xl">
            <RefreshCw className="h-4 w-4" /> تحديث
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error || !data ? (
        <ErrorState description="تعذّر تحميل التقرير. حاول مرة أخرى." onRetry={() => load(days)} />
      ) : (
        <div className="space-y-6">
          {data.truncated && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
              <span>
                السجلّ أكبر من حدّ القراءة، فالأرقام تغطّي أحدث ٣٠٠٠ حدث فقط داخل النافذة لا النافذة كاملة.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`عمليات بحث (${data.days} يوم)`} value={String(data.searches)} />
            <Stat
              label="تحويل بحث ← سلة"
              value={`${data.conversionPct}%`}
              hint={`${data.addToCart} إضافة للسلة`}
            />
            <Stat
              label="بحث بلا أي نتيجة"
              value={String(data.emptySearches)}
              hint={data.searches ? `${Math.round((data.emptySearches / data.searches) * 100)}% من عمليات البحث` : undefined}
            />
            <Stat
              label="نداءات الذكاء اليوم"
              value={String(data.modelCallsToday)}
              hint={`${data.fromCache} من الكاش (بلا تكلفة)`}
            />
          </div>

          {/* الطلب غير الملبّى — صدر الصفحة */}
          <Card className="border border-border">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-bold text-foreground">
                  <PackageSearch className="h-5 w-5 text-primary" /> أصناف طلبها العملاء ولم يجدوها
                </h2>
                {data.unmet.length > 0 && (
                  <Button type="button" variant="outline" onClick={copyUnmet} className="gap-2 rounded-xl">
                    <Copy className="h-4 w-4" /> انسخ القائمة
                  </Button>
                )}
              </div>

              {data.unmet.length === 0 ? (
                <EmptyState icon={PackageSearch} title="لا يوجد طلب غير ملبّى" description="كل ما بحث عنه العملاء وُجد في المتاجر." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 text-start font-medium">الصنف المطلوب</th>
                        <th className="pb-2 text-end font-medium">عدد الطلبات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.unmet.map((row) => (
                        <tr key={row.term} className="border-b border-border/50 last:border-0">
                          <td className="py-2 font-medium text-foreground">{row.term}</td>
                          <td className="py-2 text-end font-bold text-primary">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border">
              <CardContent className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 font-bold text-foreground">
                  <Search className="h-5 w-5 text-primary" /> أكثر ما يبحث عنه العملاء
                </h2>
                {data.topQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.topQueries.map((row) => (
                      <li key={row.term} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-foreground">{row.term}</span>
                        <span className="flex-shrink-0 font-bold text-muted-foreground">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border">
              <CardContent className="space-y-3 p-5">
                <h2 className="flex items-center gap-2 font-bold text-foreground">
                  <Stethoscope className="h-5 w-5 text-accent" /> الاستعلامات الصحّية
                </h2>
                <p className="text-3xl font-extrabold text-foreground">{data.healthSearches}</p>
                <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    العدد فقط. نصّ الاستعلام الصحّي ومفاهيمه لا يُخزَّنان إطلاقًا — منصوص عليه في سياسة
                    الخصوصية، ولا يوجد ما يُعرَض هنا حتى لو أردنا.
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  {data.addToCart} إضافة للسلة من نتائج البحث الذكي
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
