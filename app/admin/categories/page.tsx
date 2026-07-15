"use client"

// إدارة الفئات (الأقسام) والأقسام الفرعية — دمج شاشة الفئات من لوحة Flutter داخل /admin.
// حرِج: الموقع العام يقرأ حقل name فقط من مستند الفئة ومن مستندات الأقسام الفرعية — لا نغيّر هذا الشكل.
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
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
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  type AdminCategory,
  type AdminSubcategory,
} from "@/lib/actions/admin"
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Layers,
  Loader2,
  Save,
} from "lucide-react"

export default function AdminCategoriesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── حوار الفئة (إضافة/تعديل) ──
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<AdminCategory | null>(null)
  const [catName, setCatName] = useState("")
  const [catIcon, setCatIcon] = useState("")
  const [catOrder, setCatOrder] = useState("")
  const [catSaving, setCatSaving] = useState(false)

  // ── حوار القسم الفرعي (إضافة/تعديل) ──
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [subCatId, setSubCatId] = useState("")
  const [editingSub, setEditingSub] = useState<AdminSubcategory | null>(null)
  const [subName, setSubName] = useState("")
  const [subSaving, setSubSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminCategories()
      if (res.success && res.categories) setCategories(res.categories)
      else setError(true)
    } catch (e) {
      logError("[admin/categories] load", e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── أكشن الفئة ──
  const openCreateCategory = () => {
    setEditingCat(null)
    setCatName("")
    setCatIcon("")
    setCatOrder("")
    setCatDialogOpen(true)
  }

  const openEditCategory = (cat: AdminCategory) => {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatIcon(cat.icon || "")
    setCatOrder(cat.order != null ? String(cat.order) : "")
    setCatDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    const name = catName.trim()
    if (!name) {
      toast.error("اسم الفئة مطلوب")
      return
    }
    const orderTrimmed = catOrder.trim()
    const orderNum = orderTrimmed === "" ? null : Number(orderTrimmed)
    if (orderNum !== null && !Number.isFinite(orderNum)) {
      toast.error("ترتيب غير صالح (رقم أو اتركه فارغًا)")
      return
    }
    setCatSaving(true)
    try {
      const res = editingCat
        ? await updateCategory(editingCat.id, { name, icon: catIcon.trim(), order: orderNum })
        : await createCategory({ name, icon: catIcon.trim() || undefined, order: orderNum })
      if (res.success) {
        toast.success(editingCat ? "تم تحديث الفئة" : "تمت إضافة الفئة")
        setCatDialogOpen(false)
        await load()
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[admin/categories] saveCategory", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setCatSaving(false)
    }
  }

  const handleDeleteCategory = async (cat: AdminCategory) => {
    const ok = await confirm({
      title: "حذف الفئة",
      message:
        `حذف الفئة "${cat.name}"` +
        (cat.subcategories.length > 0 ? ` و${cat.subcategories.length} قسم فرعي تابع لها؟` : "؟"),
      confirmText: "حذف",
      cancelText: "تراجع",
      variant: "danger",
    })
    if (!ok) return
    setBusyId(cat.id)
    try {
      const res = await deleteCategory(cat.id)
      if (res.success) {
        toast.success("تم حذف الفئة")
        setCategories((prev) => prev.filter((c) => c.id !== cat.id))
      } else {
        toast.error(res.error || "تعذّر الحذف")
      }
    } catch (e) {
      logError("[admin/categories] deleteCategory", e)
      toast.error("تعذّر الحذف")
    } finally {
      setBusyId(null)
    }
  }

  // ── أكشن القسم الفرعي ──
  const openCreateSub = (catId: string) => {
    setSubCatId(catId)
    setEditingSub(null)
    setSubName("")
    setSubDialogOpen(true)
  }

  const openEditSub = (catId: string, sub: AdminSubcategory) => {
    setSubCatId(catId)
    setEditingSub(sub)
    setSubName(sub.name)
    setSubDialogOpen(true)
  }

  const handleSaveSub = async () => {
    const name = subName.trim()
    if (!name) {
      toast.error("اسم القسم الفرعي مطلوب")
      return
    }
    setSubSaving(true)
    try {
      const res = editingSub
        ? await updateSubcategory(subCatId, editingSub.id, { name })
        : await createSubcategory(subCatId, { name })
      if (res.success) {
        toast.success(editingSub ? "تم تحديث القسم الفرعي" : "تمت إضافة القسم الفرعي")
        setSubDialogOpen(false)
        await load()
        setExpanded((prev) => new Set(prev).add(subCatId))
      } else {
        toast.error(res.error || "تعذّر الحفظ")
      }
    } catch (e) {
      logError("[admin/categories] saveSub", e)
      toast.error("تعذّر الحفظ")
    } finally {
      setSubSaving(false)
    }
  }

  const handleDeleteSub = async (catId: string, sub: AdminSubcategory) => {
    const ok = await confirm({
      title: "حذف القسم الفرعي",
      message: `حذف القسم الفرعي "${sub.name}"؟`,
      confirmText: "حذف",
      cancelText: "تراجع",
      variant: "danger",
    })
    if (!ok) return
    setBusyId(sub.id)
    try {
      const res = await deleteSubcategory(catId, sub.id)
      if (res.success) {
        toast.success("تم حذف القسم الفرعي")
        setCategories((prev) =>
          prev.map((c) =>
            c.id === catId ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== sub.id) } : c,
          ),
        )
      } else {
        toast.error(res.error || "تعذّر الحذف")
      }
    } catch (e) {
      logError("[admin/categories] deleteSub", e)
      toast.error("تعذّر الحذف")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">إدارة الفئات</h1>
          <p className="text-sm text-muted-foreground">
            أضِف وعدّل الفئات (الأقسام) وأقسامها الفرعية التي تظهر عند تسجيل المتاجر واختيار أقسام المنتجات.
          </p>
        </div>
        <Button onClick={openCreateCategory} className="rounded-xl gap-1">
          <Plus className="h-4 w-4" /> فئة جديدة
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" label="جاري التحميل..." className="flex-col" />
        </div>
      ) : error ? (
        <ErrorState description="تعذّر تحميل الفئات. حاول مرة أخرى." onRetry={load} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="لا توجد فئات بعد"
          description="ابدأ بإضافة أول فئة لتظهر للمتاجر والمنتجات."
          action={{ label: "إضافة فئة", onClick: openCreateCategory }}
        />
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const isOpen = expanded.has(cat.id)
            return (
              <Card key={cat.id} className="border border-border overflow-hidden">
                <CardContent className="p-0">
                  {/* رأس الفئة */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-right"
                      aria-expanded={isOpen}
                    >
                      <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-lg">
                        {cat.icon ? <span aria-hidden>{cat.icon}</span> : <FolderTree className="h-5 w-5 text-muted-foreground" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground truncate">{cat.name || "بدون اسم"}</span>
                          {cat.order != null && (
                            <span className="text-[11px] font-medium bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
                              ترتيب {cat.order}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Layers className="h-3 w-3" /> {cat.subcategories.length} قسم فرعي
                        </span>
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => openEditCategory(cat)}
                        aria-label="تعديل الفئة"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                        disabled={busyId === cat.id}
                        onClick={() => handleDeleteCategory(cat)}
                        aria-label="حذف الفئة"
                      >
                        {busyId === cat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* الأقسام الفرعية */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                      {cat.subcategories.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">لا توجد أقسام فرعية بعد.</p>
                      ) : (
                        cat.subcategories.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2"
                          >
                            <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{sub.name}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg"
                              onClick={() => openEditSub(cat.id, sub)}
                              aria-label="تعديل القسم الفرعي"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                              disabled={busyId === sub.id}
                              onClick={() => handleDeleteSub(cat.id, sub)}
                              aria-label="حذف القسم الفرعي"
                            >
                              {busyId === sub.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        ))
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 mt-1"
                        onClick={() => openCreateSub(cat.id)}
                      >
                        <Plus className="h-3.5 w-3.5" /> قسم فرعي
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* حوار الفئة */}
      <Dialog open={catDialogOpen} onOpenChange={(v) => !catSaving && setCatDialogOpen(v)}>
        <DialogContent className="sm:max-w-[440px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCat ? "تعديل الفئة" : "فئة جديدة"}</DialogTitle>
            <DialogDescription>
              الاسم هو ما يظهر للمتاجر والمنتجات (حقل إلزامي). الأيقونة والترتيب اختياريان.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="cat-name">اسم الفئة *</Label>
              <Input
                id="cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="h-11 rounded-xl"
                placeholder="مثال: بقالة"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cat-icon">أيقونة (اختياري)</Label>
                <Input
                  id="cat-icon"
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  className="h-11 rounded-xl text-center"
                  placeholder="🛒"
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-order">الترتيب (اختياري)</Label>
                <Input
                  id="cat-order"
                  type="number"
                  inputMode="numeric"
                  value={catOrder}
                  onChange={(e) => setCatOrder(e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)} disabled={catSaving}>
              إلغاء
            </Button>
            <Button onClick={handleSaveCategory} disabled={catSaving} className="gap-1">
              {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار القسم الفرعي */}
      <Dialog open={subDialogOpen} onOpenChange={(v) => !subSaving && setSubDialogOpen(v)}>
        <DialogContent className="sm:max-w-[440px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingSub ? "تعديل القسم الفرعي" : "قسم فرعي جديد"}</DialogTitle>
            <DialogDescription>الاسم هو ما يظهر ضمن أقسام المنتجات في هذه الفئة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="sub-name">اسم القسم الفرعي *</Label>
            <Input
              id="sub-name"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="مثال: المخبز"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSubDialogOpen(false)} disabled={subSaving}>
              إلغاء
            </Button>
            <Button onClick={handleSaveSub} disabled={subSaving} className="gap-1">
              {subSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
