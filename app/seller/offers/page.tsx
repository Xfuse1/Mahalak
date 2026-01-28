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
      <div className="flex min-h-screen bg-secondary">
        <SellerHeader />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-gray-500">جاري التحميل...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">العروض الترويجية</h1>
              <p className="text-gray-600 mt-1">إدارة العروض والخصومات</p>
            </div>
            <Button
              onClick={() => {
                setEditingOffer(null)
                setIsAdding(!isAdding)
              }}
              className="bg-[#1F478B] hover:bg-[#1a3a70]"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة عرض جديد
            </Button>
          </div>

          {isAdding && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{editingOffer ? "تعديل العرض" : "إضافة عرض جديد"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">عنوان العرض</Label>
                    <Input
                      id="title"
                      name="title"
                      required
                      placeholder="خصم 20% على جميع المنتجات"
                      defaultValue={editingOffer?.title}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea
                      id="description"
                      name="description"
                      required
                      placeholder="عرض خاص لفترة محدودة"
                      defaultValue={editingOffer?.description}
                    />
                  </div>
                  <div>
                    <Label htmlFor="discount">نسبة الخصم (%)</Label>
                    <Input
                      id="discount"
                      name="discount"
                      type="number"
                      min="0"
                      max="100"
                      required
                      placeholder="20"
                      defaultValue={editingOffer?.discount_percentage}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">تاريخ البداية</Label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        required
                        defaultValue={editingOffer ? formatDateForInput(editingOffer.start_date) : ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate">تاريخ النهاية</Label>
                      <Input
                        id="endDate"
                        name="endDate"
                        type="date"
                        required
                        defaultValue={editingOffer ? formatDateForInput(editingOffer.end_date) : ""}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]" disabled={submitting}>
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
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => (
              <Card key={offer.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-[#1F478B]" />
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-lg">{offer.title}</CardTitle>
                        <Badge variant="outline" className={cn("w-fit", getOfferStatus(offer.start_date, offer.end_date).className)}>
                          {getOfferStatus(offer.start_date, offer.end_date).label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(offer)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(offer.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{offer.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">الخصم:</span>
                      <span className="text-2xl font-bold text-[#1F478B]">{offer.discount_percentage}%</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>من: {formatDateForInput(offer.start_date)}</p>
                      <p>إلى: {formatDateForInput(offer.end_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {offers.length === 0 && !isAdding && (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-4">لا توجد عروض حالياً</p>
                <Button onClick={() => setIsAdding(true)} className="bg-[#1F478B] hover:bg-[#1a3a70]">
                  <Plus className="ml-2 h-4 w-4" />
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
