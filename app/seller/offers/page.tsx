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
import { Plus, Edit, Trash2, Tag, Calendar } from "lucide-react"
import { getStoreOffers, createOffer, updateOffer, deleteOffer } from "../../../lib/actions/offers"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { Badge } from "../../../components/ui/badge"
import { cn } from "../../../lib/utils"

interface Offer {
  id: string
  title: string
  description: string
  discount_percentage: number
  start_date: string
  end_date: string
  store_id: string
  created_at: string
}

export default function OffersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

        // Get offers for this store
        const storeOffers = await getStoreOffers(store.id)
        setOffers(storeOffers)
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

    setSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const offerData = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      discount_percentage: Number(formData.get("discount")),
      start_date: formData.get("startDate") as string,
      end_date: formData.get("endDate") as string,
    }

    try {
      if (editingOffer) {
        // Update existing offer
        const result = await updateOffer(editingOffer.id, offerData)
        if (result.success) {
          // Refresh offers list
          const updatedOffers = await getStoreOffers(storeId)
          setOffers(updatedOffers)
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
          setOffers(updatedOffers)
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
        setOffers(updatedOffers)
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
    setIsAdding(true)
  }

  const getOfferStatus = (startDate: string, endDate: string) => {
    const now = new Date()
    // Reset hours to compare only dates
    now.setHours(0, 0, 0, 0)
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    if (now < start) {
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
        <main className="flex-1 py-8">
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

      <main className="flex-1 py-8">
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
                  <div>
                    <Label htmlFor="discount" className="text-gray-700 font-medium">نسبة الخصم (%)</Label>
                    <Input
                      id="discount"
                      name="discount"
                      type="number"
                      min="0"
                      max="100"
                      required
                      placeholder="20"
                      defaultValue={editingOffer?.discount_percentage}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
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
                      />
                    </div>
                  </div>
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
              const status = getOfferStatus(offer.start_date, offer.end_date)
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
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>من: {formatDateForInput(offer.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>إلى: {formatDateForInput(offer.end_date)}</span>
                      </div>
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
