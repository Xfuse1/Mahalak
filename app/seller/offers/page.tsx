"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, Tag } from "lucide-react"

interface Offer {
  id: string
  title: string
  description: string
  discount: number
  startDate: string
  endDate: string
}

export default function OffersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [offers, setOffers] = useState<Offer[]>([
    {
      id: "1",
      title: "خصم 20% على جميع المنتجات",
      description: "عرض خاص لفترة محدودة",
      discount: 20,
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    },
  ])
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newOffer: Offer = {
      id: editingId || Date.now().toString(),
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      discount: Number(formData.get("discount")),
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
    }

    if (editingId) {
      setOffers(offers.map((o) => (o.id === editingId ? newOffer : o)))
      setEditingId(null)
    } else {
      setOffers([...offers, newOffer])
    }
    setIsAdding(false)
    e.currentTarget.reset()
  }

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا العرض؟")) {
      setOffers(offers.filter((o) => o.id !== id))
    }
  }

  const handleEdit = (offer: Offer) => {
    setEditingId(offer.id)
    setIsAdding(true)
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
            <Button onClick={() => setIsAdding(!isAdding)} className="bg-[#1F478B] hover:bg-[#1a3a70]">
              <Plus className="ml-2 h-4 w-4" />
              إضافة عرض جديد
            </Button>
          </div>

          {isAdding && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{editingId ? "تعديل العرض" : "إضافة عرض جديد"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">عنوان العرض</Label>
                    <Input id="title" name="title" required placeholder="خصم 20% على جميع المنتجات" />
                  </div>
                  <div>
                    <Label htmlFor="description">الوصف</Label>
                    <Textarea id="description" name="description" required placeholder="عرض خاص لفترة محدودة" />
                  </div>
                  <div>
                    <Label htmlFor="discount">نسبة الخصم (%)</Label>
                    <Input id="discount" name="discount" type="number" min="0" max="100" required placeholder="20" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">تاريخ البداية</Label>
                      <Input id="startDate" name="startDate" type="date" required />
                    </div>
                    <div>
                      <Label htmlFor="endDate">تاريخ النهاية</Label>
                      <Input id="endDate" name="endDate" type="date" required />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]">
                      {editingId ? "حفظ التعديلات" : "إضافة العرض"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setEditingId(null)
                      }}
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
                      <CardTitle className="text-lg">{offer.title}</CardTitle>
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
                      <span className="text-2xl font-bold text-[#1F478B]">{offer.discount}%</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>من: {offer.startDate}</p>
                      <p>إلى: {offer.endDate}</p>
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
