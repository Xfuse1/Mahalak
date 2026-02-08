"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Textarea } from "../../../components/ui/textarea"
import { Plus, Edit, Trash2, Tag, Calendar, Package, Layers } from "lucide-react"
import { getStoreOffers, createOffer, updateOffer, deleteOffer } from "../../../lib/actions/offers"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { getProductsByStoreId } from "../../../lib/actions/products"
import { getSubcategoriesForStore } from "../../../lib/mock-data"
import { Badge } from "../../../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { cn } from "../../../lib/utils"

interface Product {
  id: string
  name: string
  price: number
  category?: string
  image_url?: string
}

interface Offer {
  id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
  store_id: string
  created_at: string
  product_id?: string
  category?: string
  quantity?: number
}

export default function OffersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [storeCategory, setStoreCategory] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [offerTarget, setOfferTarget] = useState<"all" | "product" | "category">("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [isSameDay, setIsSameDay] = useState(false)
  const [durationHours, setDurationHours] = useState<number>(1)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return

      try {
        setLoading(true)

        // Get seller's store
        const store = await getStoreByUserId(user.id)
        if (!store) {
          console.error("[v0] No store found for seller")
          setLoading(false)
          return
        }

        setStoreId(store.id)
        setStoreCategory((store as any).category || "")

        // Get products for this store
        const storeProducts = await getProductsByStoreId(store.id)
        setProducts(storeProducts as Product[])

        // Get offers for this store
        const storeOffers = await getStoreOffers(store.id)
        setOffers(storeOffers as Offer[])
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!storeId) return

    const formData = new FormData(e.currentTarget)

    const productId = formData.get("product") as string
    const quantity = formData.get("quantity") as string
    const discountPercentage = Number(formData.get("discount"))
    const startDate = formData.get("startDate") as string
    const endDate = formData.get("endDate") as string
    const hours = isSameDay ? durationHours : undefined
    
    // Validation
    if (discountPercentage <= 0 || discountPercentage > 100) {
      alert("نسبة الخصم يجب أن تكون بين 1 و 100")
      return
    }
    
    if (offerTarget === "product" && !selectedProduct && !productId) {
      alert("يجب اختيار منتج للعرض")
      return
    }
    
    if (offerTarget === "category" && !selectedCategory) {
      alert("يجب اختيار قسم للعرض")
      return
    }
    
    // Validate dates
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end < start) {
        alert("تاريخ النهاية يجب أن يكون بعد تاريخ البداية")
        return
      }
    }

    setSubmitting(true)
    
    const offerData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      discount_percentage: discountPercentage,
      start_date: startDate,
      end_date: endDate,
      product_id: offerTarget === "product" && (selectedProduct || productId) ? (selectedProduct || productId) : undefined,
      category: offerTarget === "category" && selectedCategory ? selectedCategory : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      duration_hours: hours,
    }

    try {
      if (editingOffer) {
        // Update existing offer
        const result = await updateOffer(editingOffer.id, offerData)
        if (result.success) {
          // Refresh offers list
          const updatedOffers = await getStoreOffers(storeId)
          setOffers(updatedOffers as Offer[])
          setEditingOffer(null)
          setIsAdding(false)
        } else {
          alert(`فشل تحديث العرض: ${result.error}`)
        }
      } else {
        // Create new offer
        const result = await createOffer({
          store_id: storeId,
          ...offerData,
        })
        if (result.success) {
          // Refresh offers list
          const updatedOffers = await getStoreOffers(storeId)
          setOffers(updatedOffers as Offer[])
          setIsAdding(false)
        } else {
          alert(`فشل إضافة العرض: ${result.error}`)
        }
      }
    } catch (error) {
      console.error("[v0] Error submitting offer:", error)
      alert("حدث خطأ أثناء حفظ العرض")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا العرض؟")) return
    if (!storeId) return

    try {
      const result = await deleteOffer(id)
      if (result.success) {
        // Refresh offers list
        const updatedOffers = await getStoreOffers(storeId)
        setOffers(updatedOffers as Offer[])
      } else {
        alert(`فشل حذف العرض: ${result.error}`)
      }
    } catch (error) {
      console.error("[v0] Error deleting offer:", error)
      alert("حدث خطأ أثناء حذف العرض")
    }
  }

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer)
    // Set the correct target type
    if (offer.product_id) {
      setOfferTarget("product")
      setSelectedProduct(offer.product_id)
    } else if (offer.category) {
      setOfferTarget("category")
      setSelectedCategory(offer.category)
    } else {
      setOfferTarget("all")
    }
    // Check same day & hours
    const startD = offer.start_date ? offer.start_date.split("T")[0] : ""
    const endD = offer.end_date ? offer.end_date.split("T")[0] : ""
    if (startD && endD && startD === endD) {
      setIsSameDay(true)
      setDurationHours((offer as any).duration_hours || 1)
    } else {
      setIsSameDay(false)
      setDurationHours(1)
    }
    setIsAdding(true)
  }

  const getOfferStatus = (startDate: string, endDate: string, durationH?: number) => {
    const now = new Date()
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)

    // For same-day offers with duration_hours, calculate exact end time
    const startDay = startDate.split("T")[0]
    const endDay = endDate.split("T")[0]
    if (startDay === endDay && durationH) {
      const offerEnd = new Date(start)
      offerEnd.setHours(durationH, 0, 0, 0)
      const todayDate = new Date()
      todayDate.setHours(0, 0, 0, 0)
      if (todayDate.getTime() < start.getTime()) {
        return { label: "قادم", className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" }
      }
      if (now > offerEnd) {
        return { label: "منتهي", className: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100" }
      }
      return { label: "نشط", className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" }
    }

    // Normal multi-day logic
    const nowDate = new Date()
    nowDate.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    if (nowDate < start) {
      return { label: "قادم", className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" }
    }
    if (now > end) {
      return { label: "منتهي", className: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100" }
    }
    return { label: "نشط", className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" }
  }

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString)
    return date.toISOString().split("T")[0]
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <Tag className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                العروض الترويجية
              </h1>
              <p className="text-gray-600 mt-1">إدارة العروض والخصومات</p>
            </div>
            <Button
              onClick={() => {
                setEditingOffer(null)
                setOfferTarget("all")
                setSelectedProduct("")
                setSelectedCategory("")
                setIsSameDay(false)
                setDurationHours(1)
                setIsAdding(!isAdding)
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Plus className="me-2 h-4 w-4" />
              إضافة عرض جديد
            </Button>
          </div>

          {/* Add/Edit Form */}
          {isAdding && (
            <Card className="mb-8 border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  {editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <Label htmlFor="title" className="text-gray-700 font-medium">عنوان العرض</Label>
                    <Input
                      id="title"
                      name="title"
                      required
                      placeholder="خصم 20% على جميع المنتجات"
                      defaultValue={editingOffer?.title}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-gray-700 font-medium">الوصف</Label>
                    <Textarea
                      id="description"
                      name="description"
                      required
                      placeholder="عرض خاص لفترة محدودة"
                      defaultValue={editingOffer?.description}
                      className="mt-1.5 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 font-medium">تطبيق العرض على</Label>
                      <div className="flex gap-2 mt-1.5">
                        <Button
                          type="button"
                          variant={offerTarget === "all" ? "default" : "outline"}
                          size="sm"
                          className={cn("flex-1 rounded-xl h-12", offerTarget === "all" && "bg-blue-600 hover:bg-blue-700")}
                          onClick={() => { setOfferTarget("all"); setSelectedProduct(""); setSelectedCategory("") }}
                        >
                          جميع المنتجات
                        </Button>
                        <Button
                          type="button"
                          variant={offerTarget === "product" ? "default" : "outline"}
                          size="sm"
                          className={cn("flex-1 rounded-xl h-12", offerTarget === "product" && "bg-blue-600 hover:bg-blue-700")}
                          onClick={() => { setOfferTarget("product"); setSelectedCategory("") }}
                        >
                          <Package className="h-4 w-4 me-1" />
                          منتج محدد
                        </Button>
                        <Button
                          type="button"
                          variant={offerTarget === "category" ? "default" : "outline"}
                          size="sm"
                          className={cn("flex-1 rounded-xl h-12", offerTarget === "category" && "bg-blue-600 hover:bg-blue-700")}
                          onClick={() => { setOfferTarget("category"); setSelectedProduct("") }}
                        >
                          <Layers className="h-4 w-4 me-1" />
                          قسم كامل
                        </Button>
                      </div>
                    </div>
                    <div>
                      {offerTarget === "product" && (
                        <>
                          <Label htmlFor="product" className="text-gray-700 font-medium">اختر المنتج</Label>
                          <Select
                            name="product"
                            defaultValue={editingOffer?.product_id || ""}
                            onValueChange={setSelectedProduct}
                          >
                            <SelectTrigger className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                              <SelectValue placeholder="اختر منتج" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-gray-400" />
                                    {product.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      {offerTarget === "category" && (
                        <>
                          <Label className="text-gray-700 font-medium">اختر القسم</Label>
                          <Select
                            value={selectedCategory}
                            onValueChange={setSelectedCategory}
                          >
                            <SelectTrigger className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                              <SelectValue placeholder="اختر قسم" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {/* Show categories that have products in this store */}
                              {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                                <SelectItem key={cat} value={cat!}>
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-gray-400" />
                                    {cat} ({products.filter((p) => p.category === cat).length} منتج)
                                  </div>
                                </SelectItem>
                              ))}
                              {/* Also show all categories based on store type */}
                              {getSubcategoriesForStore(storeCategory).filter(c => !products.some(p => p.category === c.name)).map((cat) => (
                                <SelectItem key={cat.id} value={cat.name}>
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-gray-400" />
                                    {cat.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedCategory && (
                            <p className="text-xs text-blue-600 mt-1">
                              سيتم تطبيق الخصم على {products.filter(p => p.category === selectedCategory).length} منتج في هذا القسم
                            </p>
                          )}
                        </>
                      )}
                      {offerTarget === "all" && (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3 mt-6 text-center w-full">
                            سيتم تطبيق الخصم على جميع منتجات متجرك
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="quantity" className="text-gray-700 font-medium">الكمية المتاحة للعرض (اختياري)</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      placeholder="مثال: 100"
                      defaultValue={editingOffer?.quantity || ""}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="discount" className="text-gray-700 font-medium">نسبة الخصم (%)</Label>
                    <Input
                      id="discount"
                      name="discount"
                      type="number"
                      min="1"
                      max="100"
                      required
                      placeholder="20"
                      defaultValue={editingOffer?.discount_percentage}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">يجب أن تكون نسبة الخصم بين 1% و 100%</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate" className="text-gray-700 font-medium">تاريخ البداية</Label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        required
                        defaultValue={editingOffer ? formatDateForInput(editingOffer.start_date) : ""}
                        className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        onChange={(e) => {
                          const endEl = document.getElementById("endDate") as HTMLInputElement
                          const endVal = endEl?.value
                          const startVal = e.target.value
                          setIsSameDay(!!startVal && !!endVal && startVal === endVal)
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate" className="text-gray-700 font-medium">تاريخ النهاية</Label>
                      <Input
                        id="endDate"
                        name="endDate"
                        type="date"
                        required
                        defaultValue={editingOffer ? formatDateForInput(editingOffer.end_date) : ""}
                        className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                        onChange={(e) => {
                          const startEl = document.getElementById("startDate") as HTMLInputElement
                          const startVal = startEl?.value
                          const endVal = e.target.value
                          setIsSameDay(!!startVal && !!endVal && startVal === endVal)
                        }}
                      />
                    </div>
                  </div>
                  {/* Same-day offer: hours input */}
                  {isSameDay && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <Label htmlFor="durationHours" className="text-amber-800 font-medium flex items-center gap-2">
                        ⏰ عدد ساعات العرض
                      </Label>
                      <p className="text-xs text-amber-600 mt-1 mb-2">العرض في نفس اليوم — حدد عدد الساعات (من 1 إلى 24 ساعة)</p>
                      <Input
                        id="durationHours"
                        name="durationHours"
                        type="number"
                        min="1"
                        max="24"
                        required
                        value={durationHours}
                        onChange={(e) => {
                          let v = Number(e.target.value)
                          if (v < 1) v = 1
                          if (v > 24) v = 24
                          setDurationHours(v)
                        }}
                        className="mt-1 h-12 rounded-xl border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-white w-full md:w-48"
                      />
                      <p className="text-xs text-amber-500 mt-1.5">العرض سيبدأ من الساعة 12:00 صباحاً ويستمر لمدة {durationHours} {durationHours === 1 ? "ساعة" : "ساعات"}</p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-12 px-8 shadow-lg" 
                      disabled={submitting}
                    >
                      {submitting ? "جاري الحفظ..." : editingOffer ? "حفظ التعديلات" : "إضافة العرض"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setEditingOffer(null)
                      }}
                      disabled={submitting}
                      className="rounded-xl h-12 px-8 border-2"
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Offers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => {
              const status = getOfferStatus(offer.start_date, offer.end_date, (offer as any).duration_hours)
              return (
                <Card key={offer.id} className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Tag className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <CardTitle className="text-lg">{offer.title}</CardTitle>
                          <Badge variant="outline" className={cn("w-fit text-xs px-2.5 py-0.5 rounded-full", status.className)}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(offer)}
                          className="hover:bg-blue-50 rounded-xl"
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(offer.id)}
                          className="hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="mt-2 text-gray-600">{offer.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                        <span className="text-sm text-gray-600">الخصم:</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                          {offer.discount_percentage}%
                        </span>
                      </div>
                      {offer.product_id && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                          <Package className="h-4 w-4" />
                          <span>المنتج: {products.find(p => p.id === offer.product_id)?.name || "منتج محدد"}</span>
                        </div>
                      )}
                      {(offer as any).category && !(offer as any).product_id && (
                        <div className="flex items-center gap-2 text-sm bg-purple-50 rounded-xl p-3">
                          <Layers className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-purple-700">القسم: {(offer as any).category}</span>
                          <span className="text-purple-500 text-xs">({products.filter(p => p.category === (offer as any).category).length} منتج)</span>
                        </div>
                      )}
                      {!offer.product_id && !(offer as any).category && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 rounded-xl p-3">
                          <Package className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-600 font-medium">جميع المنتجات</span>
                        </div>
                      )}
                      {offer.quantity && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-orange-50 rounded-xl p-3">
                          <span className="font-medium text-orange-600">الكمية المتاحة: {offer.quantity}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>من: {formatDateForInput(offer.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>إلى: {formatDateForInput(offer.end_date)}</span>
                      </div>
                      {(offer as any).duration_hours && formatDateForInput(offer.start_date) === formatDateForInput(offer.end_date) && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl p-2">
                          <span>⏰</span>
                          <span>مدة العرض: {(offer as any).duration_hours} {(offer as any).duration_hours === 1 ? "ساعة" : "ساعات"}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Empty State */}
          {offers.length === 0 && !isAdding && (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-6">
                  <Tag className="h-10 w-10 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-6">لا توجد عروض حالياً</p>
                <Button 
                  onClick={() => setIsAdding(true)} 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  <Plus className="me-2 h-4 w-4" />
                  إضافة عرض جديد
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
