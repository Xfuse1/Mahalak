"use client"

import React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../../../components/seller-header"
import { useAuth } from "../../../../../lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { Button } from "../../../../../components/ui/button"
import { Input } from "../../../../../components/ui/input"
import { Label } from "../../../../../components/ui/label"
import { Textarea } from "../../../../../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select"
import { Upload } from "lucide-react"
import { getProduct, updateProduct, uploadProductImage } from "../../../../../lib/actions/products"
import { getStoreByUserId } from "../../../../../lib/actions/stores"
import Image from "next/image"
import { sections } from "../../../../../lib/mock/supermarket-data"

export default function EditProductPage({ params }: { params: { id: string } }) {
  // Next.js 14+: params may be a Promise, unwrap with React.use()
  const unwrappedParams = typeof params === "object" && "then" in params
    ? React.use(params as unknown as Promise<{ id: string }>)
    : (params as { id: string });
  const { id } = unwrappedParams;
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingProduct, setIsLoadingProduct] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [product, setProduct] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [storeCategory, setStoreCategory] = useState<string>("")

  // Check if store is grocery/food type
  const isGroceryStore = ["بقالة", "أغذية", "grocery", "food", "supermarket"].includes(storeCategory.toLowerCase())

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || !user?.id) return

      setIsLoadingProduct(true)
      const productData = await getProduct(id)

      if (!productData) {
        setError("المنتج غير موجود")
        setIsLoadingProduct(false)
        return
      }

      // Verify the product belongs to the seller's store
      const store = await getStoreByUserId(user.id)
      if (!store || store.id !== productData.store_id) {
        setError("ليس لديك صلاحية لتعديل هذا المنتج")
        setIsLoadingProduct(false)
        return
      }

      setProduct(productData)
      setImagePreview(productData.image_url)

      // Set store category from the store object we already fetched
      if (store) {
        setStoreCategory((store as any).category || "")
      }

      setIsLoadingProduct(false)
    }

    fetchProduct()
  }, [id, user?.id])

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      let imageUrl = product.image_url

      // Upload new image if selected
      if (imageFile) {
        const store = await getStoreByUserId(user!.id)

        if (!store) {
          throw new Error("لم يتم العثور على المتجر")
        }

        const uploadFormData = new FormData()
        uploadFormData.append("file", imageFile)
        uploadFormData.append("storeId", store.id)

        const uploadResult = await uploadProductImage(uploadFormData)

        if (!uploadResult.success) {
          throw new Error(`فشل رفع الصورة: ${uploadResult.error}`)
        }

        imageUrl = uploadResult.url!
      }

      // Update product in database
      const result = await updateProduct(id, {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        category: formData.get("category") as string,
        simulator_section: isGroceryStore ? (formData.get("simulator_section") as string) : null,
        image_url: imageUrl,
      })

      if (!result.success) {
        throw new Error(result.error || "فشل تحديث المنتج")
      }

      alert("تم تحديث المنتج بنجاح")
      router.push("/seller/products")
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحديث المنتج")
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  if (isLoadingProduct) {
    return (
      <div className="flex min-h-screen bg-secondary">
        <SellerHeader />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="text-center">جاري التحميل...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen bg-secondary">
        <SellerHeader />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="text-center text-red-500">{error || "المنتج غير موجود"}</p>
            <Button onClick={() => router.push("/seller/products")} className="mt-4 mx-auto block">
              العودة للمنتجات
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8">تعديل المنتج</h1>

          <Card>
            <CardHeader>
              <CardTitle>معلومات المنتج</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">اسم المنتج</Label>
                  <Input id="name" name="name" defaultValue={product.name} required />
                </div>

                <div>
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea id="description" name="description" defaultValue={product.description} rows={4} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">السعر (جنيه)</Label>
                    <Input id="price" name="price" type="number" step="0.01" defaultValue={product.price} required />
                  </div>
                  <div>
                    <Label htmlFor="stock">الكمية المتاحة</Label>
                    <Input id="stock" name="stock" type="number" defaultValue={product.stock} required />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">الفئة</Label>
                  <Select name="category" defaultValue={product.category}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="بقالة">بقالة</SelectItem>
                      <SelectItem value="صحة">صحة</SelectItem>
                      <SelectItem value="ملابس">ملابس</SelectItem>
                      <SelectItem value="إلكترونيات">إلكترونيات</SelectItem>
                      <SelectItem value="أغذية">أغذية</SelectItem>
                      <SelectItem value="أثاث">أثاث</SelectItem>
                      <SelectItem value="خدمات أخرى">خدمات أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isGroceryStore && (
                  <div>
                    <Label htmlFor="simulator_section">قسم العرض</Label>
                    <Select name="simulator_section" defaultValue={product.simulator_section || "GROCERY"}>
                      <SelectTrigger id="simulator_section">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.icon} {section.nameAR}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="image">صورة المنتج</Label>
                  {imagePreview && (
                    <div className="mt-2 mb-4">
                      <Image
                        src={imagePreview || "/placeholder.svg"}
                        alt="معاينة الصورة"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-2">
                    <label
                      htmlFor="image"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1F478B] transition-colors bg-gray-50"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">
                          {imageFile ? imageFile.name : "انقر لتغيير صورة المنتج"}
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
                      />
                    </label>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex gap-3">
                  <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]" disabled={isSaving}>
                    {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/seller/products")}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main >
    </div >
  )
}
