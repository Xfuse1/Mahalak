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
  const [selectedCategory, setSelectedCategory] = useState<string>("")

  // Check if either store or product category is grocery/food type
  const isGroceryType = (cat: string) => ["بقالة", "أغذية", "grocery", "food", "supermarket"].includes(cat.toLowerCase())
  const showSimulatorSection = isGroceryType(storeCategory) || isGroceryType(selectedCategory)

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
      setSelectedCategory(productData.category || "")

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
        category: selectedCategory,
        simulator_section: showSimulatorSection ? (formData.get("simulator_section") as string) : null,
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
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 animate-pulse">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-500">جاري التحميل...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <p className="text-red-500 text-lg mb-4">{error || "المنتج غير موجود"}</p>
              <Button
                onClick={() => router.push("/seller/products")}
                className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl"
              >
                العودة للمنتجات
              </Button>
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
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            تعديل المنتج
          </h1>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                معلومات المنتج
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-gray-700 font-medium">اسم المنتج</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={product.name}
                    required
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">الوصف</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={product.description}
                    rows={4}
                    required
                    className="mt-1.5 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-700 font-medium">السعر (جنيه)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      defaultValue={product.price}
                      required
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock" className="text-gray-700 font-medium">الكمية المتاحة</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      defaultValue={product.stock}
                      required
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category" className="text-gray-700 font-medium">الفئة</Label>
                  <Select
                    name="category"
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger id="category" className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="بقالة" className="rounded-lg">بقالة</SelectItem>
                      <SelectItem value="صحة" className="rounded-lg">صحة</SelectItem>
                      <SelectItem value="ملابس" className="rounded-lg">ملابس</SelectItem>
                      <SelectItem value="إلكترونيات" className="rounded-lg">إلكترونيات</SelectItem>
                      <SelectItem value="أغذية" className="rounded-lg">أغذية</SelectItem>
                      <SelectItem value="أثاث" className="rounded-lg">أثاث</SelectItem>
                      <SelectItem value="خدمات أخرى" className="rounded-lg">خدمات أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {showSimulatorSection && (
                  <div>
                    <Label htmlFor="simulator_section" className="text-gray-700 font-medium">قسم العرض</Label>
                    <Select name="simulator_section" defaultValue={product.simulator_section || "GROCERY"}>
                      <SelectTrigger id="simulator_section" className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id} className="rounded-lg">
                            {section.icon} {section.nameAR}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="image" className="text-gray-700 font-medium">صورة المنتج</Label>
                  {imagePreview && (
                    <div className="mt-3 mb-4">
                      <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="معاينة الصورة"
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    <label
                      htmlFor="image"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all bg-gray-50 group"
                    >
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                          <Upload className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">
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

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-12 shadow-lg"
                    disabled={isSaving}
                  >
                    {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/seller/products")}
                    className="rounded-xl h-12 border-2 hover:bg-gray-50"
                  >
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
