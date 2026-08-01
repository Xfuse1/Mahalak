"use client"

import React from "react"
import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../../../components/seller-header"
import { useAuth } from "../../../../../lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { Button } from "../../../../../components/ui/button"
import { Input } from "../../../../../components/ui/input"
import { Label } from "../../../../../components/ui/label"
import { Textarea } from "../../../../../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../../components/ui/select"
import { Upload, Pill, Shirt, ShoppingBasket, Package, ScanLine, CalendarClock } from "lucide-react"
import nextDynamic from "next/dynamic"
import { getOwnedProduct, updateProduct, uploadProductImage } from "../../../../../lib/actions/products"
import { getStoreByUserId } from "../../../../../lib/actions/stores"
import { getCategoryNameForForm } from "../../../../../lib/actions/product-form-actions"
import Image from "next/image"
import { fetchStoreSubcategories, type SubcategoryItem } from "../../../../../lib/firebase/categories"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "../../../../../lib/language-context"
import { imgSrc } from "@/lib/storage/public-url"

// ماسح الباركود بالكاميرا (نفس مكوّن الكاشير) — تحميل كسول client-side فقط.
const BarcodeScanner = nextDynamic(
  () => import("../../../../../components/barcode-scanner").then((m) => ({ default: m.BarcodeScanner })),
  { ssr: false },
)

type StoreType = "pharmacy" | "clothing" | "grocery" | "electronics" | "general"

function detectStoreType(categoryName: string, storeName: string): StoreType {
  const detectStr = `${categoryName} ${storeName}`.toLowerCase()
  if (detectStr.includes("صحة") || detectStr.includes("صيدل") || detectStr.includes("صيدال") || detectStr.includes("pharmacy") || detectStr.includes("health")) return "pharmacy"
  if (detectStr.includes("ملابس") || detectStr.includes("أزياء") || detectStr.includes("fashion") || detectStr.includes("clothing")) return "clothing"
  if (detectStr.includes("بقالة") || detectStr.includes("سوبرماركت") || detectStr.includes("grocery") || detectStr.includes("supermarket") || detectStr.includes("ميني ماركت")) return "grocery"
  if (detectStr.includes("إلكترون") || detectStr.includes("الكترون") || detectStr.includes("تقنية") || detectStr.includes("electronics") || detectStr.includes("mobile") || detectStr.includes("موبايل") || detectStr.includes("هواتف")) return "electronics"
  return "general"
}

const STORE_THEME: Record<StoreType, { gradient: string; icon: React.ReactNode }> = {
  pharmacy: { gradient: "from-emerald-600 to-teal-700", icon: <Pill className="h-5 w-5" /> },
  clothing: { gradient: "from-purple-600 to-pink-700", icon: <Shirt className="h-5 w-5" /> },
  grocery: { gradient: "from-orange-600 to-amber-700", icon: <ShoppingBasket className="h-5 w-5" /> },
  electronics: { gradient: "from-primary to-primary/90", icon: <Package className="h-5 w-5" /> },
  general: { gradient: "from-primary to-primary", icon: <Upload className="h-5 w-5" /> },
}

type EditableProduct = {
  id: string
  store_id: string
  name: string
  description: string
  price: number
  cost_price?: number
  stock: number
  category?: string
  image_url?: string
  barcode?: string
  expiry_date?: string | null
  reservation_enabled?: boolean
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const toast = useToast()
  const { t } = useLanguage()
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingProduct, setIsLoadingProduct] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [product, setProduct] = useState<EditableProduct | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storeCategory, setStoreCategory] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [customCategory, setCustomCategory] = useState<string>("")
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([])
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false)
  const [storeType, setStoreType] = useState<StoreType>("general")
  const [isReservationEnabled, setIsReservationEnabled] = useState(false)
  const [barcode, setBarcode] = useState("")
  const [expiryDate, setExpiryDate] = useState("") // YYYY-MM-DD
  const [showScanner, setShowScanner] = useState(false)

  const productActionErrorMessages: Record<string, { ar: string; en: string }> = {
    PRODUCT_NOT_FOUND: {
      ar: "المنتج غير موجود",
      en: "Product not found",
    },
    UNAUTHORIZED_PRODUCT_ACCESS: {
      ar: "ليس لديك صلاحية لتعديل هذا المنتج",
      en: "You are not authorized to edit this product",
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
    UPDATE_PRODUCT_FAILED: {
      ar: "فشل تحديث المنتج",
      en: "Failed to update product",
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
    return t("فشل تحديث المنتج", "Failed to update product")
  }



  useEffect(() => {
    const fetchProduct = async () => {
      if (!id || !user?.id) return

      setIsLoadingProduct(true)
      const productData = (await getOwnedProduct(id)) as EditableProduct | null

      if (!productData) {
        setError(t("المنتج غير موجود", "Product not found"))
        setIsLoadingProduct(false)
        return
      }

      // Verify the product belongs to the seller's store
      const store = await getStoreByUserId(user.id)
      if (!store || store.id !== productData.store_id) {
        setError(t("ليس لديك صلاحية لتعديل هذا المنتج", "You are not allowed to edit this product"))
        setIsLoadingProduct(false)
        return
      }

      setProduct(productData)
      setImagePreview(productData.image_url ?? null)
      setIsReservationEnabled(productData.reservation_enabled ?? false)
      setBarcode(productData.barcode || "")
      setExpiryDate(String(productData.expiry_date || "").slice(0, 10)) // YYYY-MM-DD لحقل type=date
      
      // Set store category from the store object we already fetched
      const currentStoreCategory = store?.category || ""
      if (store) {
        setStoreCategory(currentStoreCategory)
        // Detect store type
        try {
          const catName = store.category_id ? (await getCategoryNameForForm(store.category_id)) || "" : currentStoreCategory
          setStoreType(detectStoreType(catName, store.name || ""))
        } catch {
          setStoreType(detectStoreType(currentStoreCategory, store.name || ""))
        }
      }

      // Fetch subcategories from Firestore
      setIsLoadingSubcategories(true)
      try {
        const subs = await fetchStoreSubcategories(currentStoreCategory)
        setSubcategories(subs)
        
        // Check if category is in the fetched subcategories
        const predefinedNames = subs.map(c => c.name)
        if (productData.category && predefinedNames.includes(productData.category)) {
          setSelectedCategory(productData.category)
        } else if (productData.category) {
          // Custom category - set to "أخرى" and fill custom input
          setSelectedCategory("أخرى")
          setCustomCategory(productData.category)
        }
      } catch (err) {
        console.error("Error fetching subcategories:", err)
        setSubcategories([{ id: "other", name: "أخرى" }])
        if (productData.category) {
          setSelectedCategory("أخرى")
          setCustomCategory(productData.category)
        }
      } finally {
        setIsLoadingSubcategories(false)
      }

      setIsLoadingProduct(false)
    }

    fetchProduct()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!product) {
        throw new Error(t("المنتج غير موجود", "Product not found"))
      }

      const formData = new FormData(e.currentTarget)
      let imageUrl = product.image_url || ""

      // التحقق من صحة السعر والكمية
      const price = Number(formData.get("price"))
      const costPrice = Number(formData.get("cost_price"))
      const stock = Number(formData.get("stock"))
      
      if (!price || price <= 0) {
        throw new Error(t("سعر البيع يجب أن يكون أكبر من صفر", "Selling price must be greater than zero"))
      }
      if (!costPrice || costPrice <= 0) {
        throw new Error(t("سعر الشراء يجب أن يكون أكبر من صفر", "Cost price must be greater than zero"))
      }
      if (price < costPrice) {
        throw new Error(t("سعر البيع لا يمكن أن يكون أقل من سعر الشراء", "Selling price cannot be lower than cost price"))
      }
      if (Number.isNaN(stock) || stock < 0) {
        throw new Error(t("الكمية لا يمكن أن تكون سالبة", "Quantity cannot be negative"))
      }
      // السماح بـ stock = 0 عند تفعيل الحجز المسبق
      if (stock === 0 && !isReservationEnabled) {
        throw new Error(t("الكمية يجب أن تكون أكبر من صفر أو فعّل الحجز المسبق", "Quantity must be greater than zero or enable pre-reservation"))
      }

      // Upload new image if selected
      if (imageFile) {
        const store = await getStoreByUserId(user!.id)

        if (!store) {
          throw new Error(t("لم يتم العثور على المتجر", "Store was not found"))
        }

        const uploadFormData = new FormData()
        uploadFormData.append("file", imageFile)
        uploadFormData.append("storeId", store.id)
        uploadFormData.append("callerId", user!.id)

        const uploadResult = await uploadProductImage(uploadFormData)

        if (!uploadResult.success) {
          const detail = (uploadResult as { detail?: string }).detail
          throw new Error(getProductActionErrorMessage(uploadResult.error) + (detail ? ` (${detail})` : ""))
        }

        imageUrl = uploadResult.url!
      }

      // Determine final category
      let finalCategory = selectedCategory
      if (selectedCategory === "أخرى" && customCategory.trim()) {
        finalCategory = customCategory.trim()
      }

      // Update product in database
      const result = await updateProduct(id, {
        name: formData.get("name") as string,
        description: formData.get("description") as string,
        price,
        cost_price: costPrice,
        stock,
        category: finalCategory,
        barcode: barcode.trim(),
        expiry_date: expiryDate || null,
        image_url: imageUrl,
        reservation_enabled: isReservationEnabled,
      }, user?.id)

      if (!result.success) {
        throw new Error(getProductActionErrorMessage(result.error))
      }

      toast.success(t("تم تحديث المنتج بنجاح", "Product updated successfully"))
      router.push("/seller/products")
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("حدث خطأ أثناء تحديث المنتج", "An error occurred while updating the product")
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      const compressImage = (sourceFile: File, maxDim: number, quality: number): Promise<File> => {
        return new Promise((resolve, reject) => {
          const img = document.createElement("img")
          const reader = new FileReader()
          reader.onerror = () => reject(new Error("Failed to read file"))
          reader.onload = (ev) => {
            img.onerror = () => reject(new Error("Failed to load image"))
            img.onload = () => {
              const canvas = document.createElement("canvas")
              let width = img.width
              let height = img.height

              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width)
                  width = maxDim
                } else {
                  width = Math.round((width * maxDim) / height)
                  height = maxDim
                }
              }

              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext("2d")!
              ctx.drawImage(img, 0, 0, width, height)

              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    resolve(new File([blob], sourceFile.name.replace(/\.\w+$/, ".jpg"), {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    }))
                  } else {
                    reject(new Error("Compression failed"))
                  }
                },
                "image/jpeg",
                quality
              )
            }
            img.src = ev.target?.result as string
          }
          reader.readAsDataURL(sourceFile)
        })
      }

      // Always compress to ensure consistent upload
      const doCompress = async () => {
        try {
          let compressed = await compressImage(file, 1200, 0.8)
          // If still > 4MB, compress more aggressively
          if (compressed.size > 4 * 1024 * 1024) {
            compressed = await compressImage(file, 800, 0.6)
          }
          setImageFile(compressed)
          setImagePreview(URL.createObjectURL(compressed))
        } catch {
          // Fallback: use original file
          setImageFile(file)
          const r = new FileReader()
          r.onloadend = () => setImagePreview(r.result as string)
          r.readAsDataURL(file)
        }
      }
      doCompress()
    }
  }

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  if (isLoadingProduct) {
    return (
      <div className="flex min-h-screen bg-background">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center mb-4 animate-pulse">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // بعد حارس isLoadingProduct أعلاه يصبح هذا مكافئًا لـ !product ويتيح لـ TS تضييق النوع
  if (!product) {
    return (
      <div className="flex min-h-screen bg-background">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <p className="text-red-500 text-lg mb-4">{error || t("المنتج غير موجود", "Product not found")}</p>
              <Button
                onClick={() => router.push("/seller/products")}
                className="bg-primary rounded-xl"
              >
                {t("العودة للمنتجات", "Back to products")}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">
            {t("تعديل المنتج", "Edit Product")}
          </h1>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className={`bg-gradient-to-r ${STORE_THEME[storeType].gradient} text-white`}>
              <CardTitle className="flex items-center gap-2">
                {STORE_THEME[storeType].icon}
                {t("معلومات المنتج", "Product Information")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-gray-700 font-medium">{t("اسم المنتج", "Product Name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={product.name}
                    required
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">{t("الوصف", "Description")}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={product.description}
                    rows={4}
                    required
                    className="mt-1.5 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-700 font-medium">{t("سعر البيع (جنيه)", "Selling Price (EGP)")}</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={product.price}
                      required
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost_price" className="text-gray-700 font-medium">{t("سعر الشراء (جنيه)", "Cost Price (EGP)")}</Label>
                    <Input
                      id="cost_price"
                      name="cost_price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={product.cost_price ?? product.price}
                      required
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock" className="text-gray-700 font-medium">{t("الكمية المتاحة", "Available Quantity")}</Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      min="0"
                      defaultValue={product.stock}
                      required
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                    {isReservationEnabled && (
                      <p className="text-xs text-green-600 mt-1">
                        {t("✓ الحجز المسبق مفعّل - يمكنك إضافة الكمية 0", "✓ Pre-reservation enabled - you can set quantity to 0")}
                      </p>
                    )}
                  </div>

                  {/* Pre-Reservation Toggle */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                    <div className="flex-1">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isReservationEnabled}
                          onChange={(e) => setIsReservationEnabled(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-primary cursor-pointer"
                        />
                        <span className="font-medium text-gray-700">
                          {t("متاح للحجز المسبق", "Available for Pre-Reservation")}
                        </span>
                      </label>
                      <p className="text-xs text-gray-600 mt-1 ms-8">
                        {t(
                          "فعّل هذا الخيار للسماح بالحجز حتى لو لم يكن لديك مخزون حالياً",
                          "Enable this option to allow reservations even if you don't have stock currently"
                        )}
                      </p>
                    </div>
                    {isReservationEnabled && (
                      <div className="text-primary text-2xl">✓</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="barcode" className="text-gray-700 font-medium">{t("الباركود (اختياري)", "Barcode (Optional)")}</Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        id="barcode"
                        name="barcode"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder={t("مثال: 6221507001016", "Example: 6221507001016")}
                        className="h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20 font-mono flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowScanner(true)}
                        className="h-12 px-4 rounded-xl border-2 shrink-0"
                        title={t("مسح بالكاميرا", "Scan with camera")}
                      >
                        <ScanLine className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t("اطبع الرقم أو امسحه بالكاميرا", "Type it or scan with the camera")}</p>
                  </div>

                  <div>
                    <Label htmlFor="expiry_date" className="text-gray-700 font-medium flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 text-amber-600" /> {t("تاريخ الصلاحية (اختياري)", "Expiry Date (Optional)")}
                    </Label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        id="expiry_date"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20 flex-1"
                      />
                      {expiryDate && (
                        <Button type="button" variant="outline" onClick={() => setExpiryDate("")} className="h-12 px-4 rounded-xl border-2 shrink-0">
                          {t("مسح", "Clear")}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t("ننبّهك قبل انتهائها في لوحة التحكم", "We alert you before it expires on the dashboard")}</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="category" className="text-gray-700 font-medium">{t("قسم المنتج", "Product Category")}</Label>
                  <Select
                    name="category"
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value)
                      if (value !== "أخرى") {
                        setCustomCategory("")
                      }
                    }}
                  >
                    <SelectTrigger id="category" className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20">
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
                    <Label htmlFor="customCategory" className="text-gray-700 font-medium">{t("اسم القسم", "Category Name")}</Label>
                    <Input
                      id="customCategory"
                      name="customCategory"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder={t("أدخل اسم القسم", "Enter category name")}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="image" className="text-gray-700 font-medium">{t("صورة المنتج", "Product Image")}</Label>
                  {imagePreview && (
                    <div className="mt-3 mb-4">
                      <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-lg border-2 border-gray-200">
                        <Image
                          src={imgSrc(imagePreview)}
                          alt={t("معاينة الصورة", "Image preview")}
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
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all bg-gray-50 group"
                    >
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-2 shadow-lg group-hover:scale-110 transition-transform">
                          <Upload className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">
                          {imageFile ? imageFile.name : t("انقر لتغيير صورة المنتج", "Click to change product image")}
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
                    className={`flex-1 bg-gradient-to-r ${STORE_THEME[storeType].gradient} hover:opacity-90 rounded-xl h-12 shadow-lg`}
                    disabled={isSaving}
                  >
                    {isSaving ? t("جاري الحفظ...", "Saving...") : t("حفظ التعديلات", "Save Changes")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/seller/products")}
                    className="rounded-xl h-12 border-2 hover:bg-gray-50"
                  >
                    {t("إلغاء", "Cancel")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main >

      {showScanner && (
        <BarcodeScanner
          onScan={(code) => { setBarcode(code); setShowScanner(false); toast.success(t("تم مسح الباركود", "Barcode scanned")) }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div >
  )
}
