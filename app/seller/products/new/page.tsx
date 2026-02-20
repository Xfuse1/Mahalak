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
import { fetchStoreSubcategories, type SubcategoryItem } from "../../../../lib/firebase/categories"
import { Upload, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { createProduct, uploadProductImage } from "../../../../lib/actions/products"
import { getStoreByUserId } from "../../../../lib/actions/stores"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "../../../../lib/language-context"
import { logError } from "../../../../lib/logger"


export default function NewProductPage() {
  const { user, isLoading } = useAuth()
  const { t } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storeCategory, setStoreCategory] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [customCategory, setCustomCategory] = useState<string>("")
  const [isStoreApproved, setIsStoreApproved] = useState<boolean>(true)
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([])
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false)

  const productActionErrorMessages: Record<string, { ar: string; en: string }> = {
    UNAUTHORIZED_STORE_PRODUCT_CREATE: {
      ar: "ليس لديك صلاحية لإضافة منتجات لهذا المتجر",
      en: "You are not authorized to add products for this store",
    },
    PRICE_MUST_BE_POSITIVE: {
      ar: "السعر يجب أن يكون أكبر من صفر",
      en: "Price must be greater than zero",
    },
    COST_PRICE_MUST_BE_POSITIVE: {
      ar: "سعر الشراء يجب أن يكون أكبر من صفر",
      en: "Cost price must be greater than zero",
    },
    SELLING_PRICE_BELOW_COST: {
      ar: "سعر البيع لا يمكن أن يكون أقل من سعر الشراء",
      en: "Selling price cannot be lower than cost price",
    },
    STOCK_MUST_BE_POSITIVE: {
      ar: "الكمية يجب أن تكون أكبر من صفر",
      en: "Stock must be greater than zero",
    },
    STORE_NOT_APPROVED: {
      ar: "متجرك غير معتمد بعد. لا يمكنك إضافة منتجات حتى يتم اعتماد متجرك من قبل الإدارة.",
      en: "Your store is not approved yet. You cannot add products until your store is approved by the administration.",
    },
    CREATE_PRODUCT_UNEXPECTED_ERROR: {
      ar: "حدث خطأ غير متوقع أثناء إنشاء المنتج",
      en: "An unexpected error occurred while creating the product",
    },
    MISSING_FILE_OR_STORE_ID: {
      ar: "بيانات رفع الصورة غير مكتملة",
      en: "Missing image upload data",
    },
    UNAUTHORIZED_IMAGE_UPLOAD: {
      ar: "ليس لديك صلاحية لرفع صورة لهذا المتجر",
      en: "You are not authorized to upload an image for this store",
    },
    UNSUPPORTED_IMAGE_TYPE: {
      ar: "نوع الصورة غير مدعوم",
      en: "Unsupported image type",
    },
    IMAGE_TOO_LARGE: {
      ar: "حجم الصورة كبير جدًا (الحد الأقصى 5MB)",
      en: "Image is too large (maximum 5MB)",
    },
    IMAGE_UPLOAD_FAILED: {
      ar: "فشل رفع الصورة",
      en: "Failed to upload image",
    },
    IMAGE_UPLOAD_INTERNAL_ERROR: {
      ar: "حدث خطأ غير متوقع أثناء رفع الصورة",
      en: "An unexpected error occurred while uploading the image",
    },
  }

  const getProductActionErrorMessage = (errorCode?: string) => {
    if (errorCode && productActionErrorMessages[errorCode]) {
      const msg = productActionErrorMessages[errorCode]
      return t(msg.ar, msg.en)
    }
    return t("فشل إضافة المنتج", "Failed to add product")
  }



  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }

    // Fetch store data to check category and load subcategories
    async function fetchStore() {
      if (user?.id) {
        const store = await getStoreByUserId(user.id)
        if (store) {
          const cat = store.category || ""
          setStoreCategory(cat)
          setIsStoreApproved(store.is_approved ?? false)
          // Fetch subcategories from Firestore
          setIsLoadingSubcategories(true)
          try {
            const subs = await fetchStoreSubcategories(cat)
            setSubcategories(subs)
          } catch (err) {
            console.error("Error fetching subcategories:", err)
            setSubcategories([{ id: "other", name: "أخرى" }])
          } finally {
            setIsLoadingSubcategories(false)
          }
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
      const costPrice = Number.parseFloat(formData.get("cost_price") as string)
      const stock = Number.parseInt(formData.get("stock") as string)
      
      if (!price || price <= 0) {
        throw new Error(t("سعر البيع يجب أن يكون أكبر من صفر", "Selling price must be greater than zero"))
      }
      if (!costPrice || costPrice <= 0) {
        throw new Error(t("سعر الشراء يجب أن يكون أكبر من صفر", "Cost price must be greater than zero"))
      }
      if (price < costPrice) {
        throw new Error(t("سعر البيع لا يمكن أن يكون أقل من سعر الشراء", "Selling price cannot be lower than cost price"))
      }
      if (!stock || stock <= 0) {
        throw new Error(t("الكمية يجب أن تكون أكبر من صفر", "Quantity must be greater than zero"))
      }
      
      // Determine final category
      let finalCategory = selectedCategory
      if (selectedCategory === "أخرى" && customCategory.trim()) {
        finalCategory = customCategory.trim()
      }
      
      if (!finalCategory) {
        throw new Error(t("يرجى اختيار قسم المنتج", "Please select a product category"))
      }

      // Get seller's store
      const store = await getStoreByUserId(user.id)
      if (!store) {
        throw new Error(t("لم يتم العثور على متجرك. يرجى إنشاء متجر أولاً.", "Store was not found. Please create your store first."))
      }

      let imageUrl = ""

      // Upload image via server action if provided (bypasses RLS issues)
      if (imageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append("file", imageFile)
        uploadFormData.append("storeId", store.id)
        uploadFormData.append("callerId", user!.id)

        const uploadResult = await uploadProductImage(uploadFormData)

        if (!uploadResult.success) {
          throw new Error(getProductActionErrorMessage(uploadResult.error))
        }

        imageUrl = uploadResult.url!
      }

      // Create product in database
      const productData = {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price,
        cost_price: costPrice,
        stock: Number.parseInt(formData.get("stock") as string),
        category: finalCategory,
        barcode: (formData.get("barcode") as string)?.trim() || "",
        image_url: imageUrl,
        store_id: store.id,
      }

      const result = await createProduct(productData, user.id)

      if (!result.success) {
        throw new Error(getProductActionErrorMessage(result.error))
      }

      toast.success(t("تم إضافة المنتج بنجاح!", "Product added successfully!"))
      router.push("/seller/products")
    } catch (err: unknown) {
      logError("[v0] Error creating product:", err)
      const errMessage = err instanceof Error ? err.message : t("حدث خطأ أثناء إضافة المنتج", "An error occurred while adding the product")
      setError(errMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Compress image if larger than 1MB
      if (file.size > 1 * 1024 * 1024) {
        const img = document.createElement("img")
        const reader = new FileReader()
        reader.onload = (ev) => {
          img.onload = () => {
            const canvas = document.createElement("canvas")
            let width = img.width
            let height = img.height

            // Resize if too large
            const MAX_SIZE = 1200
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = Math.round((height * MAX_SIZE) / width)
                width = MAX_SIZE
              } else {
                width = Math.round((width * MAX_SIZE) / height)
                height = MAX_SIZE
              }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext("2d")!
            ctx.drawImage(img, 0, 0, width, height)

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                  setImageFile(compressedFile)
                  setImagePreview(canvas.toDataURL("image/jpeg", 0.8))
                }
              },
              "image/jpeg",
              0.8
            )
          }
          img.src = ev.target?.result as string
        }
        reader.readAsDataURL(file)
      } else {
        setImageFile(file)
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            {t("إضافة منتج جديد", "Add New Product")}
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
                    <h3 className="font-bold text-amber-800 text-lg mb-2">{t("متجرك غير معتمد بعد", "Your store is not approved yet")}</h3>
                    <p className="text-amber-700">
                      {t(
                        "لا يمكنك إضافة منتجات حتى يتم اعتماد متجرك من قبل الإدارة. يرجى الانتظار حتى يتم مراجعة واعتماد حسابك.",
                        "You cannot add products until your store is approved by admin. Please wait until your account is reviewed and approved.",
                      )}
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
                {t("معلومات المنتج", "Product Information")}
              </CardTitle>
              <CardDescription className="text-blue-100">{t("أدخل تفاصيل المنتج الذي تريد إضافته", "Enter the details of the product you want to add")}</CardDescription>
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
                  <Label htmlFor="name" className="text-gray-700 font-medium">{t("اسم المنتج *", "Product Name *")}</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder={t("مثال: هاتف ذكي سامسونج", "Example: Samsung Smartphone")}
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">{t("الوصف *", "Description *")}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    required
                    placeholder={t("وصف تفصيلي للمنتج...", "Detailed product description...")}
                    rows={4}
                    className="mt-1.5 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-700 font-medium">{t("سعر البيع (جنيه) *", "Selling Price (EGP) *")}</Label>
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
                    <Label htmlFor="cost_price" className="text-gray-700 font-medium">{t("سعر الشراء (جنيه) *", "Cost Price (EGP) *")}</Label>
                    <Input
                      id="cost_price"
                      name="cost_price"
                      type="number"
                      required
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stock" className="text-gray-700 font-medium">{t("الكمية المتاحة *", "Available Quantity *")}</Label>
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
                  <Label htmlFor="barcode" className="text-gray-700 font-medium">{t("الباركود (اختياري)", "Barcode (Optional)")}</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder={t("مثال: 6221507001016 - الرقم المطبوع على العلبة", "Example: 6221507001016 - printed code on the package")}
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "أدخل رقم الباركود المطبوع على المنتج (إن وجد) لتسريع البحث في نظام الكاشير",
                      "Enter the barcode printed on the product (if available) to speed up POS search",
                    )}
                  </p>
                </div>

                <div>
                  <Label htmlFor="category" className="text-gray-700 font-medium">{t("قسم المنتج *", "Product Category *")}</Label>
                  <Select
                    name="category"
                    required
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value)
                      if (value !== "أخرى") {
                        setCustomCategory("")
                      }
                    }}
                  >
                    <SelectTrigger id="category" className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder={t("اختر القسم", "Select category")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {isLoadingSubcategories ? (
                        <SelectItem value="_loading" disabled className="rounded-lg">
                          {t("جاري التحميل...", "Loading...")}
                        </SelectItem>
                      ) : subcategories.length > 0 ? (
                        subcategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name} className="rounded-lg">
                            {cat.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_empty" disabled className="rounded-lg">
                          {t("لا توجد فئات", "No categories")}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">{t("اختر القسم المناسب لمنتجك", "Choose the best category for your product")}</p>
                </div>

                {/* Custom category input when "أخرى" is selected */}
                {selectedCategory === "أخرى" && (
                  <div>
                    <Label htmlFor="customCategory" className="text-gray-700 font-medium">{t("اسم القسم *", "Category Name *")}</Label>
                    <Input
                      id="customCategory"
                      name="customCategory"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder={t("أدخل اسم القسم", "Enter category name")}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="image" className="text-gray-700 font-medium">{t("صورة المنتج *", "Product Image *")}</Label>
                  <div className="mt-2">
                    {imagePreview ? (
                      <div className="relative w-full h-48 border-2 border-gray-200 rounded-2xl overflow-hidden shadow-md">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt={t("معاينة الصورة", "Image preview")}
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
                          <span className="sr-only">{t("حذف الصورة", "Remove image")}</span>×
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
                            {imageFile ? imageFile.name : t("انقر لرفع صورة المنتج", "Click to upload product image")}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{t("PNG, JPG, JPEG (حتى 5MB)", "PNG, JPG, JPEG (up to 5MB)")}</p>
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
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl h-12 shadow-lg hover:shadow-xl transition-all"
                    disabled={isSubmitting || !isStoreApproved}
                  >
                    {isSubmitting ? t("جاري الإضافة...", "Adding...") : t("إضافة المنتج", "Add Product")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="rounded-xl h-12 border-2 hover:bg-gray-50"
                  >
                    {t("إلغاء", "Cancel")}
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
