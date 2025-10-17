"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { categories } from "@/lib/mock-data"
import { Upload } from "lucide-react"

export default function NewProductPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Mock submission
    setTimeout(() => {
      alert("تم إضافة المنتج بنجاح!")
      router.push("/seller/products")
    }, 1000)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0])
    }
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">إضافة منتج جديد</h1>

          <Card>
            <CardHeader>
              <CardTitle>معلومات المنتج</CardTitle>
              <CardDescription>أدخل تفاصيل المنتج الذي تريد إضافته</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">اسم المنتج *</Label>
                  <Input id="name" name="name" required placeholder="مثال: هاتف ذكي سامسونج" />
                </div>

                <div>
                  <Label htmlFor="description">الوصف *</Label>
                  <Textarea id="description" name="description" required placeholder="وصف تفصيلي للمنتج..." rows={4} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">السعر (جنيه) *</Label>
                    <Input id="price" name="price" type="number" required placeholder="0.00" min="0" step="0.01" />
                  </div>

                  <div>
                    <Label htmlFor="stock">الكمية المتاحة *</Label>
                    <Input id="stock" name="stock" type="number" required placeholder="0" min="0" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">الفئة *</Label>
                  <Select name="category" required>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="image">صورة المنتج *</Label>
                  <div className="mt-2">
                    <label
                      htmlFor="image"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1F478B] transition-colors bg-gray-50"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">{imageFile ? imageFile.name : "انقر لرفع صورة المنتج"}</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, JPEG (حتى 5MB)</p>
                      </div>
                      <input
                        id="image"
                        name="image"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="flex-1 bg-[#1F478B] hover:bg-[#1a3a70]" disabled={isSubmitting}>
                    {isSubmitting ? "جاري الإضافة..." : "إضافة المنتج"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
