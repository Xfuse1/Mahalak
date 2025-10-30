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
import { createClient } from "@/lib/supabase/client"
import { createProduct } from "@/lib/actions/products"
import { getStoreByUserId } from "@/lib/actions/stores"

export default function NewProductPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const supabase = createClient()

      // Get seller's store
      const store = await getStoreByUserId(user.id)
      if (!store) {
        throw new Error("لم يتم العثور على متجرك. يرجى إنشاء متجر أولاً.")
      }

      let imageUrl = ""

      // Upload image to Supabase storage if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `products/${store.id}/${fileName}`

        console.log("[v0] Uploading image to storage:")

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          console.error("[v0] Error uploading image:", uploadError)
          throw new Error("فشل رفع الصورة: " + uploadError.message)
        }

        // Get public URL for the uploaded image
        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(uploadData.path)

        imageUrl = publicUrl
        console.log("[v0] Image uploaded successfully:")
      }

      // Create product in database
      const productData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price: Number.parseFloat(formData.get("price") as string),
        stock: Number.parseInt(formData.get("stock") as string),
        category: formData.get("category") as string,
        image_url: imageUrl,
        store_id: store.id,
      }

      console.log("[v0] Creating product with data:")

      const result = await createProduct(productData)

      if (!result.success) {
        throw new Error(result.error || "فشل إضافة المنتج")
      }

      console.log("[v0] Product created successfully:")

      alert("تم إضافة المنتج بنجاح!")
      router.push("/seller/products")
    } catch (err: any) {
      console.error("[v0] Error creating product:", err)
      setError(err.message || "حدث خطأ أثناء إضافة المنتج")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)

      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
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
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                    <p className="text-sm">{error}</p>
                  </div>
                )}

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
                    {imagePreview ? (
                      <div className="relative w-full h-48 border-2 border-gray-300 rounded-lg overflow-hidden">
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="معاينة الصورة"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreview(null)
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                        >
                          <span className="sr-only">حذف الصورة</span>×
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="image"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1F478B] transition-colors bg-gray-50"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            {imageFile ? imageFile.name : "انقر لرفع صورة المنتج"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG, JPEG (حتى 5MB)</p>
                        </div>
                        <input
                          id="image"
                          name="image"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageChange}
                          required
                        />
                      </label>
                    )}
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
