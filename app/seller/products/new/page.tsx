"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../../components/seller-header"
import { useAuth } from "../../../../lib/auth-context"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Textarea } from "../../../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select"
import { categories } from "../../../../lib/mock-data"
import { Upload, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { createProduct, uploadProductImage } from "../../../../lib/actions/products"
import { getStoreByUserId } from "../../../../lib/actions/stores"
import { sections } from "../../../../lib/mock/supermarket-data"

export default function NewProductPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storeCategory, setStoreCategory] = useState<string>("")
  const [storeData, setStoreData] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [isStoreApproved, setIsStoreApproved] = useState<boolean>(true)

  // Check if either store or product category is grocery/food type
  const isGroceryType = (cat: string) => ['بقالة', 'أغذية', 'grocery', 'food', 'supermarket'].includes(cat.toLowerCase())
  const showSimulatorSection = isGroceryType(storeCategory) || isGroceryType(selectedCategory)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }

    // Fetch store data to check category
    async function fetchStore() {
      if (user?.id) {
        const store = await getStoreByUserId(user.id)
        if (store) {
          setStoreData(store)
          setStoreCategory((store as any).category || "")
          setIsStoreApproved((store as any).is_approved ?? false)
        }
      }
    }
    if (user?.id) {
      fetchStore()
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

      // التحقق من صحة السعر والكمية
      const price = Number.parseFloat(formData.get("price") as string)
      const stock = Number.parseInt(formData.get("stock") as string)
      
      if (!price || price <= 0) {
        throw new Error("السعر يجب أن يكون أكبر من صفر")
      }
      if (!stock || stock <= 0) {
        throw new Error("الكمية يجب أن تكون أكبر من صفر")
      }
      if (!selectedCategory) {
        throw new Error("يرجى اختيار فئة المنتج")
      }
      if (!imageFile) {
        throw new Error("يرجى رفع صورة المنتج")
      }

      // Get seller's store
      const store = await getStoreByUserId(user.id)
      if (!store) {
        throw new Error("لم يتم العثور على متجرك. يرجى إنشاء متجر أولاً.")
      }

      let imageUrl = ""

      // Upload image via server action if provided (bypasses RLS issues)
      if (imageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append("file", imageFile)
        uploadFormData.append("storeId", store.id)

        console.log("[v0] Uploading image via server action:")
        const uploadResult = await uploadProductImage(uploadFormData)

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "فشل رفع الصورة")
        }

        imageUrl = uploadResult.url!
        console.log("[v0] Image uploaded successfully via server:")
      }

      // Create product in database
      const productData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price: Number.parseFloat(formData.get("price") as string),
        stock: Number.parseInt(formData.get("stock") as string),
        category: selectedCategory,
        simulator_section: showSimulatorSection ? (formData.get("simulator_section") as string || "GROCERY") : null,
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
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            إضافة منتج جديد
          </h1>

          {/* تحذير المتجر غير المعتمد */}
          {!isStoreApproved && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-800 text-lg mb-2">متجرك غير معتمد بعد</h3>
                    <p className="text-amber-700">
                      لا يمكنك إضافة منتجات حتى يتم اعتماد متجرك من قبل الإدارة.
                      يرجى الانتظار حتى يتم مراجعة واعتماد حسابك.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                معلومات المنتج
              </CardTitle>
              <CardDescription className="text-blue-100">أدخل تفاصيل المنتج الذي تريد إضافته</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Disable form if store not approved */}
                <fieldset disabled={!isStoreApproved} className={!isStoreApproved ? "opacity-50 pointer-events-none" : ""}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="name" className="text-gray-700 font-medium">اسم المنتج *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="مثال: هاتف ذكي سامسونج"
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">الوصف *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    required
                    placeholder="وصف تفصيلي للمنتج..."
                    rows={4}
                    className="mt-1.5 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-700 font-medium">السعر (جنيه) *</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      required
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stock" className="text-gray-700 font-medium">الكمية المتاحة *</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      required
                      placeholder="1"
                      min="1"
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category" className="text-gray-700 font-medium">الفئة *</Label>
                  <Select
                    name="category"
                    required
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger id="category" className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {categories.map((category: string) => (
                        <SelectItem key={category} value={category} className="rounded-lg">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showSimulatorSection && (
                  <div>
                    <Label htmlFor="simulator_section" className="text-gray-700 font-medium">قسم العرض</Label>
                    <Select name="simulator_section" defaultValue="GROCERY">
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
                  <Label htmlFor="image" className="text-gray-700 font-medium">صورة المنتج *</Label>
                  <div className="mt-2">
                    {imagePreview ? (
                      <div className="relative w-full h-48 border-2 border-gray-200 rounded-2xl overflow-hidden shadow-md">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="معاينة الصورة"
                          width={400}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreview(null)
                          }}
                          className="absolute top-3 end-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 shadow-lg transition-all hover:scale-110"
                        >
                          <span className="sr-only">حذف الصورة</span>×
                        </button>
                      </div>
                    ) : (
                      <label
                        htmlFor="image"
                        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all bg-gray-50 group"
                      >
                        <div className="flex flex-col items-center justify-center py-6">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-white" />
                          </div>
                          <p className="text-sm text-gray-600 font-medium">
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
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-12 shadow-lg hover:shadow-xl transition-all"
                    disabled={isSubmitting || !isStoreApproved}
                  >
                    {isSubmitting ? "جاري الإضافة..." : "إضافة المنتج"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="rounded-xl h-12 border-2 hover:bg-gray-50"
                  >
                    إلغاء
                  </Button>
                </div>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
