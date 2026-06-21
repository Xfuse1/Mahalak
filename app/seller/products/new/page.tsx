"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
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
import { Upload, AlertTriangle, Pill, Shirt, ShoppingBasket, Package, Thermometer, Calendar, FlaskConical, Layers, Box, Tag } from "lucide-react"
import Image from "next/image"
import { createProduct, uploadProductImage } from "../../../../lib/actions/products"
import { getStoreByUserId } from "../../../../lib/actions/stores"
import { savePharmacyProductFields, saveClothingProductVariants, saveExtraProductFields, getCategoryNameForForm } from "../../../../lib/actions/product-form-actions"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "../../../../lib/language-context"

type StoreType = "pharmacy" | "clothing" | "grocery" | "electronics" | "general"

function detectStoreType(categoryName: string, storeName: string): StoreType {
  const detectStr = `${categoryName} ${storeName}`.toLowerCase()
  if (detectStr.includes("صحة") || detectStr.includes("صيدل") || detectStr.includes("صيدال") || detectStr.includes("pharmacy") || detectStr.includes("health")) return "pharmacy"
  if (detectStr.includes("ملابس") || detectStr.includes("أزياء") || detectStr.includes("fashion") || detectStr.includes("clothing")) return "clothing"
  if (detectStr.includes("بقالة") || detectStr.includes("سوبرماركت") || detectStr.includes("grocery") || detectStr.includes("supermarket") || detectStr.includes("ميني ماركت")) return "grocery"
  if (detectStr.includes("إلكترون") || detectStr.includes("الكترون") || detectStr.includes("تقنية") || detectStr.includes("electronics") || detectStr.includes("mobile") || detectStr.includes("موبايل") || detectStr.includes("هواتف")) return "electronics"
  return "general"
}

const STORE_TYPE_THEME: Record<StoreType, { gradient: string; icon: React.ReactNode; label: { ar: string; en: string }; color: string }> = {
  pharmacy: { gradient: "from-emerald-600 to-teal-700", icon: <Pill className="h-5 w-5" />, label: { ar: "منتج صيدلية", en: "Pharmacy Product" }, color: "emerald" },
  clothing: { gradient: "from-purple-600 to-pink-700", icon: <Shirt className="h-5 w-5" />, label: { ar: "منتج ملابس", en: "Clothing Product" }, color: "purple" },
  grocery: { gradient: "from-orange-600 to-amber-700", icon: <ShoppingBasket className="h-5 w-5" />, label: { ar: "منتج بقالة", en: "Grocery Product" }, color: "orange" },
  electronics: { gradient: "from-primary to-primary/80", icon: <Package className="h-5 w-5" />, label: { ar: "منتج إلكتروني", en: "Electronics Product" }, color: "blue" },
  general: { gradient: "from-primary to-primary/80", icon: <Upload className="h-5 w-5" />, label: { ar: "معلومات المنتج", en: "Product Information" }, color: "blue" },
}

const DOSAGE_FORMS = [
  { value: "أقراص", en: "Tablets" }, { value: "كبسولات", en: "Capsules" }, { value: "شراب", en: "Syrup" },
  { value: "حقن", en: "Injection" }, { value: "كريم", en: "Cream" }, { value: "مرهم", en: "Ointment" },
  { value: "جل", en: "Gel" }, { value: "قطرة عين", en: "Eye Drops" }, { value: "قطرة أنف", en: "Nasal Drops" },
  { value: "بخاخ", en: "Spray" }, { value: "تحاميل", en: "Suppositories" }, { value: "نقط", en: "Drops" },
  { value: "بودرة", en: "Powder" }, { value: "لصقة", en: "Patch" }, { value: "غسول", en: "Lotion" },
  { value: "فوار", en: "Effervescent" }, { value: "أكياس", en: "Sachets" },
]

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"]
const CLOTHING_COLORS = [
  { name: "أسود", hex: "#000000" }, { name: "أبيض", hex: "#FFFFFF" }, { name: "أحمر", hex: "#EF4444" },
  { name: "أزرق", hex: "#3B82F6" }, { name: "أخضر", hex: "#22C55E" }, { name: "بني", hex: "#92400E" },
  { name: "رمادي", hex: "#6B7280" }, { name: "بيج", hex: "#D2B48C" }, { name: "وردي", hex: "#EC4899" },
  { name: "برتقالي", hex: "#F97316" }, { name: "أصفر", hex: "#EAB308" }, { name: "بنفسجي", hex: "#8B5CF6" },
  { name: "كحلي", hex: "#1E3A5F" }, { name: "ذهبي", hex: "#D4AF37" }, { name: "فضي", hex: "#C0C0C0" },
  { name: "زيتي", hex: "#556B2F" }, { name: "سماوي", hex: "#06B6D4" }, { name: "خمري", hex: "#722F37" },
]
const CLOTHING_GENDERS = [
  { value: "men", ar: "رجالي", en: "Men" },
  { value: "women", ar: "نسائي", en: "Women" },
  { value: "kids", ar: "أطفال", en: "Kids" },
  { value: "unisex", ar: "للجنسين", en: "Unisex" },
]
const CLOTHING_AGE_GROUPS = [
  { value: "newborn", ar: "مواليد (0-3 شهور)", en: "Newborn (0-3m)" },
  { value: "infant", ar: "رضع (3-12 شهر)", en: "Infant (3-12m)" },
  { value: "toddler", ar: "صغار (1-5 سنوات)", en: "Toddler (1-5y)" },
  { value: "kids", ar: "أطفال (5-13 سنة)", en: "Kids (5-13y)" },
  { value: "teen", ar: "مراهقين (13-18 سنة)", en: "Teen (13-18y)" },
  { value: "adult", ar: "بالغين", en: "Adult" },
]
const CLOTHING_FIT_TYPES = [
  { value: "slim", ar: "ضيق (Slim)", en: "Slim Fit" },
  { value: "regular", ar: "عادي (Regular)", en: "Regular Fit" },
  { value: "loose", ar: "واسع (Loose)", en: "Loose Fit" },
  { value: "oversize", ar: "أوفر سايز", en: "Oversize" },
]
const CLOTHING_PATTERNS = [
  { value: "solid", ar: "سادة", en: "Solid" },
  { value: "striped", ar: "مخطط", en: "Striped" },
  { value: "dotted", ar: "منقط", en: "Dotted" },
  { value: "printed", ar: "مطبوع", en: "Printed" },
  { value: "checkered", ar: "كاروهات", en: "Checkered" },
  { value: "floral", ar: "مشجّر / ورود", en: "Floral" },
  { value: "camouflage", ar: "عسكري", en: "Camouflage" },
  { value: "geometric", ar: "هندسي", en: "Geometric" },
]
const CLOTHING_SLEEVE_TYPES = [
  { value: "sleeveless", ar: "بدون أكمام", en: "Sleeveless" },
  { value: "short", ar: "كم قصير", en: "Short Sleeve" },
  { value: "3quarter", ar: "ثلاثة أرباع", en: "3/4 Sleeve" },
  { value: "long", ar: "كم طويل", en: "Long Sleeve" },
]
const CLOTHING_NECKLINES = [
  { value: "round", ar: "دائري", en: "Round Neck" },
  { value: "vneck", ar: "V شكل", en: "V-Neck" },
  { value: "collar", ar: "ياقة قميص", en: "Collar" },
  { value: "polo", ar: "بولو", en: "Polo" },
  { value: "turtle", ar: "ياقة سلحفاة", en: "Turtleneck" },
  { value: "hoodie", ar: "كابتشون", en: "Hoodie" },
  { value: "none", ar: "بدون ياقة", en: "No Collar" },
]
const CLOTHING_OCCASIONS = [
  { value: "casual", ar: "يومي / كاجوال", en: "Casual" },
  { value: "formal", ar: "رسمي", en: "Formal" },
  { value: "sport", ar: "رياضي", en: "Sport" },
  { value: "party", ar: "سهرة / حفلات", en: "Party" },
  { value: "work", ar: "عمل", en: "Work" },
  { value: "home", ar: "منزلي", en: "Home" },
  { value: "outdoor", ar: "خروج", en: "Outdoor" },
]
const CLOTHING_MATERIALS = [
  { value: "cotton", ar: "قطن 100%", en: "100% Cotton" },
  { value: "polyester", ar: "بوليستر", en: "Polyester" },
  { value: "cotton_poly", ar: "قطن/بوليستر", en: "Cotton/Polyester" },
  { value: "silk", ar: "حرير", en: "Silk" },
  { value: "wool", ar: "صوف", en: "Wool" },
  { value: "denim", ar: "جينز / دينم", en: "Denim" },
  { value: "linen", ar: "كتان", en: "Linen" },
  { value: "leather", ar: "جلد طبيعي", en: "Genuine Leather" },
  { value: "faux_leather", ar: "جلد صناعي", en: "Faux Leather" },
  { value: "nylon", ar: "نايلون", en: "Nylon" },
  { value: "chiffon", ar: "شيفون", en: "Chiffon" },
  { value: "velvet", ar: "مخمل", en: "Velvet" },
  { value: "satin", ar: "ساتان", en: "Satin" },
  { value: "fleece", ar: "فليس", en: "Fleece" },
  { value: "spandex", ar: "سباندكس / ليكرا", en: "Spandex/Lycra" },
  { value: "viscose", ar: "فسكوز", en: "Viscose" },
  { value: "tweed", ar: "تويد", en: "Tweed" },
  { value: "cashmere", ar: "كشمير", en: "Cashmere" },
]
const CLOTHING_CARE = [
  { value: "machine_wash", ar: "غسالة عادية", en: "Machine Wash", icon: "🫧" },
  { value: "hand_wash", ar: "غسيل يدوي فقط", en: "Hand Wash Only", icon: "🤲" },
  { value: "dry_clean", ar: "تنظيف جاف فقط", en: "Dry Clean Only", icon: "🧹" },
  { value: "no_bleach", ar: "لا تستخدم مبيض", en: "No Bleach", icon: "🚫" },
  { value: "iron_low", ar: "كي على حرارة منخفضة", en: "Iron Low Heat", icon: "🔥" },
  { value: "no_iron", ar: "لا يُكوى", en: "Do Not Iron", icon: "❌" },
  { value: "no_tumble_dry", ar: "لا تجفف بالمجفف", en: "No Tumble Dry", icon: "💨" },
  { value: "hang_dry", ar: "تجفيف بالتعليق", en: "Hang Dry", icon: "👕" },
]

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
  const [storeType, setStoreType] = useState<StoreType>("general")
  const [storeId, setStoreId] = useState<string>("")

  // === Pharmacy Fields ===
  const [pharmActiveIngredient, setPharmActiveIngredient] = useState("")
  const [pharmManufacturer, setPharmManufacturer] = useState("")
  const [pharmDosageForm, setPharmDosageForm] = useState("")
  const [pharmExpiry, setPharmExpiry] = useState("")
  const [pharmBatch, setPharmBatch] = useState("")
  const [pharmStorageConditions, setPharmStorageConditions] = useState("")
  const [pharmRequiresPrescription, setPharmRequiresPrescription] = useState(false)
  const [pharmPiecePerStrip, setPharmPiecePerStrip] = useState("")
  const [pharmStripPerBox, setPharmStripPerBox] = useState("")
  const [pharmBoxPerCarton, setPharmBoxPerCarton] = useState("")
  const [pharmPriceUnit, setPharmPriceUnit] = useState<"piece" | "strip" | "box">("box")
  const [pharmDefaultSellingUnit, setPharmDefaultSellingUnit] = useState<"piece" | "strip" | "box">("box")

  // === Clothing Fields ===
  const [clothingSizes, setClothingSizes] = useState<string[]>([])
  const [clothingColors, setClothingColors] = useState<string[]>([])
  const [clothingMaterial, setClothingMaterial] = useState("")
  const [clothingSeason, setClothingSeason] = useState("")
  const [clothingGender, setClothingGender] = useState("")
  const [clothingAgeGroup, setClothingAgeGroup] = useState("")
  const [clothingFitType, setClothingFitType] = useState("")
  const [clothingPattern, setClothingPattern] = useState("")
  const [clothingSleeveType, setClothingSleeveType] = useState("")
  const [clothingNeckline, setClothingNeckline] = useState("")
  const [clothingOccasion, setClothingOccasion] = useState("")
  const [clothingBrand, setClothingBrand] = useState("")
  const [clothingSkuPrefix, setClothingSkuPrefix] = useState("")
  const [clothingCare, setClothingCare] = useState<string[]>([])
  const [clothingWeight, setClothingWeight] = useState("")

  // === Grocery Fields ===
  const [groceryWeight, setGroceryWeight] = useState("")
  const [groceryWeightUnit, setGroceryWeightUnit] = useState("kg")
  const [groceryExpiry, setGroceryExpiry] = useState("")
  const [groceryOrigin, setGroceryOrigin] = useState("")

  // === Electronics Fields ===
  const [electronicsWarranty, setElectronicsWarranty] = useState("")
  const [electronicsBrand, setElectronicsBrand] = useState("")
  const [electronicsModel, setElectronicsModel] = useState("")

  // === Reservation Feature ===
  const [isReservationEnabled, setIsReservationEnabled] = useState(false)

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

    // Fetch store data to check category, detect store type and load subcategories
    async function fetchStore() {
      if (user?.id) {
        const store = await getStoreByUserId(user.id)
        if (store) {
          const cat = store.category || ""
          setStoreCategory(cat)
          setStoreId(store.id)
          setIsStoreApproved(store.is_approved ?? false)
          
          // Detect store type from category name and store name
          let categoryName = cat
          if ((store as any).category_id) {
            const freshName = await getCategoryNameForForm((store as any).category_id)
            if (freshName) categoryName = freshName
          }
          const detectedType = detectStoreType(categoryName, store.name || "")
          setStoreType(detectedType)
          
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
      if (stock < 0) {
        throw new Error(t("الكمية لا يمكن أن تكون سالبة", "Quantity cannot be negative"))
      }
      // السماح بـ stock = 0 عند تفعيل الحجز المسبق
      if (stock === 0 && !isReservationEnabled) {
        throw new Error(t("الكمية يجب أن تكون أكبر من صفر أو فعّل الحجز المسبق", "Quantity must be greater than zero or enable pre-reservation"))
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
          const detail = (uploadResult as { detail?: string }).detail
          throw new Error(getProductActionErrorMessage(uploadResult.error) + (detail ? ` (${detail})` : ""))
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
        reservation_enabled: isReservationEnabled,
      }

      const result = await createProduct(productData, user.id)

      if (!result.success) {
        throw new Error(getProductActionErrorMessage(result.error))
      }

      const newProductId = result.data?.id
      
      // === Save store-type-specific fields ===
      if (newProductId && storeId) {
        try {
          if (storeType === "pharmacy") {
            // Save pharmacy fields + units
            await savePharmacyProductFields(newProductId, storeId, {
              active_ingredient: pharmActiveIngredient || undefined,
              manufacturer: pharmManufacturer || undefined,
              dosage_form: pharmDosageForm || undefined,
              storage_conditions: pharmStorageConditions || undefined,
              requires_prescription: pharmRequiresPrescription,
              expiry_date: pharmExpiry || undefined,
              batch_number: pharmBatch || undefined,
            }, (pharmPiecePerStrip || pharmStripPerBox || pharmBoxPerCarton) ? {
              piece_per_strip: Number(pharmPiecePerStrip) || undefined,
              strip_per_box: Number(pharmStripPerBox) || undefined,
              box_per_carton: Number(pharmBoxPerCarton) || undefined,
              price_unit: pharmPriceUnit,
              default_selling_unit: pharmDefaultSellingUnit,
            } : undefined)
          } else if (storeType === "clothing") {
            // Save clothing variants + detailed attributes
            await saveClothingProductVariants(newProductId, storeId, {
              sizes: clothingSizes,
              colors: clothingColors,
              colorHexMap: CLOTHING_COLORS.reduce((acc, c) => { acc[c.name] = c.hex; return acc }, {} as Record<string, string>),
              material: clothingMaterial || undefined,
              season: clothingSeason || undefined,
              gender: clothingGender || undefined,
              ageGroup: clothingAgeGroup || undefined,
              fitType: clothingFitType || undefined,
              pattern: clothingPattern || undefined,
              sleeveType: clothingSleeveType || undefined,
              neckline: clothingNeckline || undefined,
              occasion: clothingOccasion || undefined,
              brand: clothingBrand || undefined,
              skuPrefix: clothingSkuPrefix || undefined,
              careInstructions: clothingCare.length > 0 ? clothingCare : undefined,
              weight: clothingWeight ? Number(clothingWeight) : undefined,
              totalStock: stock,
            })
          } else if (storeType === "grocery" || storeType === "electronics") {
            // Save extra fields
            const extraFields: Record<string, any> = {}
            if (storeType === "grocery") {
              if (groceryWeight) extraFields.weight = groceryWeight
              if (groceryWeightUnit) extraFields.weight_unit = groceryWeightUnit
              if (groceryExpiry) extraFields.expiry_date = groceryExpiry
              if (groceryOrigin) extraFields.origin_country = groceryOrigin
            }
            if (storeType === "electronics") {
              if (electronicsWarranty) extraFields.warranty_months = Number(electronicsWarranty) || 0
              if (electronicsBrand) extraFields.brand = electronicsBrand
              if (electronicsModel) extraFields.model = electronicsModel
            }
            if (Object.keys(extraFields).length > 0) {
              await saveExtraProductFields(newProductId, extraFields)
            }
          }
        } catch (extraErr) {
          console.error("[NewProduct] Error saving extra fields:", extraErr)
          // Don't fail the whole operation, product was created
        }
      }

      toast.success(t("تم إضافة المنتج بنجاح!", "Product added successfully!"))
      router.push("/seller/products")
    } catch (err: unknown) {
      console.error("[NewProduct] Error creating product:", err)
      const errMessage = err instanceof Error ? err.message : t("حدث خطأ أثناء إضافة المنتج", "An error occurred while adding the product")
      setError(errMessage)
    } finally {
      setIsSubmitting(false)
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

      const doCompress = async () => {
        try {
          let compressed = await compressImage(file, 1200, 0.8)
          if (compressed.size > 4 * 1024 * 1024) {
            compressed = await compressImage(file, 800, 0.6)
          }
          setImageFile(compressed)
          setImagePreview(URL.createObjectURL(compressed))
        } catch {
          setImageFile(file)
          const r = new FileReader()
          r.onloadend = () => setImagePreview(r.result as string)
          r.readAsDataURL(file)
        }
      }
      doCompress()
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">
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
            <CardHeader className={`bg-gradient-to-r ${STORE_TYPE_THEME[storeType].gradient} text-white`}>
              <CardTitle className="flex items-center gap-2">
                {STORE_TYPE_THEME[storeType].icon}
                {t(STORE_TYPE_THEME[storeType].label.ar, STORE_TYPE_THEME[storeType].label.en)}
              </CardTitle>
              <CardDescription className="text-white/80">{t("أدخل تفاصيل المنتج الذي تريد إضافته", "Enter the details of the product you want to add")}</CardDescription>
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

                {/* ===== Store Type Badge ===== */}
                {storeType !== "general" && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-${STORE_TYPE_THEME[storeType].color}-50 text-${STORE_TYPE_THEME[storeType].color}-700 border border-${STORE_TYPE_THEME[storeType].color}-200`}>
                    {STORE_TYPE_THEME[storeType].icon}
                    {storeType === "pharmacy" && t("صيدلية", "Pharmacy")}
                    {storeType === "clothing" && t("ملابس", "Clothing")}
                    {storeType === "grocery" && t("بقالة", "Grocery")}
                    {storeType === "electronics" && t("إلكترونيات", "Electronics")}
                  </div>
                )}

                {/* ===== Basic Fields (All Stores) ===== */}
                <div>
                  <Label htmlFor="name" className="text-gray-700 font-medium">
                    {storeType === "pharmacy" ? t("اسم الدواء / المنتج *", "Medicine / Product Name *") :
                     storeType === "clothing" ? t("اسم المنتج / الموديل *", "Product / Model Name *") :
                     t("اسم المنتج *", "Product Name *")}
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder={
                      storeType === "pharmacy" ? t("مثال: باندول اكسترا 500mg", "Example: Panadol Extra 500mg") :
                      storeType === "clothing" ? t("مثال: تيشيرت قطن رجالي", "Example: Men's Cotton T-Shirt") :
                      storeType === "grocery" ? t("مثال: أرز بسمتي 1 كيلو", "Example: Basmati Rice 1kg") :
                      storeType === "electronics" ? t("مثال: سماعة بلوتوث JBL", "Example: JBL Bluetooth Speaker") :
                      t("مثال: هاتف ذكي سامسونج", "Example: Samsung Smartphone")
                    }
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-700 font-medium">{t("الوصف *", "Description *")}</Label>
                  <Textarea
                    id="description"
                    name="description"
                    required
                    placeholder={
                      storeType === "pharmacy" ? t("المادة الفعالة، دواعي الاستعمال، الجرعة...", "Active ingredient, indications, dosage...") :
                      storeType === "clothing" ? t("الخامة، المقاس، اللون، الموسم...", "Material, size, color, season...") :
                      t("وصف تفصيلي للمنتج...", "Detailed product description...")
                    }
                    rows={3}
                    className="mt-1.5 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-700 font-medium">
                      {storeType === "pharmacy" && pharmPriceUnit !== "piece"
                        ? t(`سعر البيع (${pharmPriceUnit === "box" ? "العلبة" : "الشريط"}) *`, `Selling Price (${pharmPriceUnit}) *`)
                        : t("سعر البيع (جنيه) *", "Selling Price (EGP) *")}
                    </Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      required
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cost_price" className="text-gray-700 font-medium">
                      {storeType === "pharmacy" && pharmPriceUnit !== "piece"
                        ? t(`سعر الشراء (${pharmPriceUnit === "box" ? "العلبة" : "الشريط"}) *`, `Cost Price (${pharmPriceUnit}) *`)
                        : t("سعر الشراء (جنيه) *", "Cost Price (EGP) *")}
                    </Label>
                    <Input
                      id="cost_price"
                      name="cost_price"
                      type="number"
                      required
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="stock" className="text-gray-700 font-medium">
                      {storeType === "pharmacy" ? t("الكمية (بالقطعة) *", "Quantity (pieces) *") : t("الكمية المتاحة *", "Available Quantity *")}
                    </Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      required
                      placeholder="1"
                      min="0"
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
                          name="reservationEnabled"
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

                <div>
                  <Label htmlFor="barcode" className="text-gray-700 font-medium">{t("الباركود (اختياري)", "Barcode (Optional)")}</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder={t("مثال: 6221507001016 - الرقم المطبوع على العلبة", "Example: 6221507001016 - printed code on the package")}
                    className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20 font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      "أدخل رقم الباركود المطبوع على المنتج (إن وجد) لتسريع البحث في نظام الكاشير",
                      "Enter the barcode printed on the product (if available) to speed up POS search",
                    )}
                  </p>
                </div>

                {/* ===== PHARMACY-SPECIFIC FIELDS ===== */}
                {storeType === "pharmacy" && (
                  <div className="space-y-4 border-2 border-emerald-200 rounded-2xl p-5 bg-emerald-50/50">
                    <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      {t("بيانات صيدلانية", "Pharmaceutical Data")}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm">{t("المادة الفعالة", "Active Ingredient")}</Label>
                        <Input value={pharmActiveIngredient} onChange={(e) => setPharmActiveIngredient(e.target.value)}
                          placeholder={t("مثال: باراسيتامول", "Example: Paracetamol")}
                          className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الشركة المصنعة", "Manufacturer")}</Label>
                        <Input value={pharmManufacturer} onChange={(e) => setPharmManufacturer(e.target.value)}
                          placeholder={t("مثال: فاركو", "Example: Pharco")}
                          className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الشكل الدوائي", "Dosage Form")}</Label>
                        <Select value={pharmDosageForm} onValueChange={setPharmDosageForm}>
                          <SelectTrigger className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {DOSAGE_FORMS.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="rounded-lg">
                                {t(f.value, f.en)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("ظروف التخزين", "Storage Conditions")}</Label>
                        <Select value={pharmStorageConditions} onValueChange={setPharmStorageConditions}>
                          <SelectTrigger className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="room_temp" className="rounded-lg">{t("درجة حرارة الغرفة", "Room Temperature")}</SelectItem>
                            <SelectItem value="refrigerated" className="rounded-lg">{t("في الثلاجة (2-8°C)", "Refrigerated (2-8°C)")}</SelectItem>
                            <SelectItem value="cool_dry" className="rounded-lg">{t("مكان بارد وجاف", "Cool & Dry Place")}</SelectItem>
                            <SelectItem value="below_25" className="rounded-lg">{t("أقل من 25°C", "Below 25°C")}</SelectItem>
                            <SelectItem value="below_30" className="rounded-lg">{t("أقل من 30°C", "Below 30°C")}</SelectItem>
                            <SelectItem value="protect_light" className="rounded-lg">{t("بعيداً عن الضوء", "Protect from Light")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-red-500" />
                          {t("تاريخ الصلاحية *", "Expiry Date *")}
                        </Label>
                        <Input type="date" value={pharmExpiry} onChange={(e) => setPharmExpiry(e.target.value)}
                          required
                          className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("رقم التشغيلة", "Batch Number")}</Label>
                        <Input value={pharmBatch} onChange={(e) => setPharmBatch(e.target.value)}
                          placeholder={t("مثال: BN2024-001", "Example: BN2024-001")}
                          className="mt-1 h-10 rounded-xl border-emerald-200 focus:ring-emerald-500" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input type="checkbox" id="requires_prescription" checked={pharmRequiresPrescription}
                        onChange={(e) => setPharmRequiresPrescription(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
                      <Label htmlFor="requires_prescription" className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                        <span className="text-red-500">℞</span>
                        {t("يحتاج وصفة طبية", "Requires Prescription")}
                      </Label>
                    </div>

                    {/* Multi-Unit Section */}
                    <div className="bg-white border border-emerald-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {t("وحدات البيع المتعددة", "Multi-Unit Selling")}
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-gray-600 text-[11px]">{t("حبة / شريط", "Piece / Strip")}</Label>
                          <Input type="number" value={pharmPiecePerStrip} onChange={(e) => setPharmPiecePerStrip(e.target.value)}
                            placeholder="10" min="1"
                            className="mt-1 h-9 rounded-lg border-gray-200 text-sm" />
                        </div>
                        <div>
                          <Label className="text-gray-600 text-[11px]">{t("شريط / علبة", "Strip / Box")}</Label>
                          <Input type="number" value={pharmStripPerBox} onChange={(e) => setPharmStripPerBox(e.target.value)}
                            placeholder="3" min="1"
                            className="mt-1 h-9 rounded-lg border-gray-200 text-sm" />
                        </div>
                        <div>
                          <Label className="text-gray-600 text-[11px]">{t("علبة / كرتونة", "Box / Carton")}</Label>
                          <Input type="number" value={pharmBoxPerCarton} onChange={(e) => setPharmBoxPerCarton(e.target.value)}
                            placeholder="12" min="1"
                            className="mt-1 h-9 rounded-lg border-gray-200 text-sm" />
                        </div>
                      </div>
                      {(pharmPiecePerStrip || pharmStripPerBox) && (
                        <>
                          <p className="text-[11px] text-gray-500">
                            {t("مثال: 10 حبات/شريط × 3 شرائط/علبة = 30 حبة/علبة", "Example: 10 pcs/strip × 3 strips/box = 30 pcs/box")}
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-gray-600 text-[11px]">{t("السعر المدخل لـ", "Price entered for")}</Label>
                              <Select value={pharmPriceUnit} onValueChange={(v) => setPharmPriceUnit(v as "piece" | "strip" | "box")}>
                                <SelectTrigger className="mt-1 h-9 rounded-lg border-amber-300 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="piece" className="rounded-lg">{t("حبة", "Piece")}</SelectItem>
                                  <SelectItem value="strip" className="rounded-lg">{t("شريط", "Strip")}</SelectItem>
                                  <SelectItem value="box" className="rounded-lg">{t("علبة", "Box")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-gray-600 text-[11px]">{t("وحدة البيع الافتراضية", "Default Selling Unit")}</Label>
                              <Select value={pharmDefaultSellingUnit} onValueChange={(v) => setPharmDefaultSellingUnit(v as "piece" | "strip" | "box")}>
                                <SelectTrigger className="mt-1 h-9 rounded-lg border-cyan-300 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="piece" className="rounded-lg">{t("حبة", "Piece")}</SelectItem>
                                  <SelectItem value="strip" className="rounded-lg">{t("شريط", "Strip")}</SelectItem>
                                  <SelectItem value="box" className="rounded-lg">{t("علبة", "Box")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== CLOTHING-SPECIFIC FIELDS ===== */}
                {storeType === "clothing" && (
                  <div className="space-y-5 border-2 border-purple-200 rounded-2xl p-5 bg-purple-50/50">
                    <h3 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                      <Shirt className="h-4 w-4" />
                      {t("بيانات الملابس", "Clothing Details")}
                    </h3>

                    {/* Row 1: Gender + Age Group + Occasion */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("الجنس", "Gender")} <span className="text-red-400">*</span></Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {CLOTHING_GENDERS.map((g) => (
                            <button key={g.value} type="button"
                              onClick={() => setClothingGender(clothingGender === g.value ? "" : g.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                                clothingGender === g.value
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                              }`}>
                              {t(g.ar, g.en)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("الفئة العمرية", "Age Group")}</Label>
                        <Select value={clothingAgeGroup} onValueChange={setClothingAgeGroup}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر الفئة", "Select group")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {CLOTHING_AGE_GROUPS.map((ag) => (
                              <SelectItem key={ag.value} value={ag.value} className="rounded-lg">{t(ag.ar, ag.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("المناسبة", "Occasion")}</Label>
                        <Select value={clothingOccasion} onValueChange={setClothingOccasion}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {CLOTHING_OCCASIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="rounded-lg">{t(o.ar, o.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 2: Sizes */}
                    <div>
                      <Label className="text-gray-700 text-sm font-medium">{t("المقاسات المتاحة", "Available Sizes")} <span className="text-red-400">*</span></Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {CLOTHING_SIZES.map((size) => (
                          <button key={size} type="button"
                            onClick={() => setClothingSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                              clothingSizes.includes(size)
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-105'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            }`}>
                            {size}
                          </button>
                        ))}
                      </div>
                      {clothingSizes.length > 0 && (
                        <p className="text-[11px] text-purple-600 mt-1">{t("تم اختيار:", "Selected:")} {clothingSizes.join(", ")}</p>
                      )}
                    </div>

                    {/* Row 3: Colors with hex swatches */}
                    <div>
                      <Label className="text-gray-700 text-sm font-medium">{t("الألوان المتاحة", "Available Colors")} <span className="text-red-400">*</span></Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {CLOTHING_COLORS.map((color) => (
                          <button key={color.name} type="button"
                            onClick={() => setClothingColors(prev => prev.includes(color.name) ? prev.filter(c => c !== color.name) : [...prev, color.name])}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                              clothingColors.includes(color.name)
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-105'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            }`}>
                            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block flex-shrink-0" style={{ backgroundColor: color.hex }} />
                            {color.name}
                          </button>
                        ))}
                      </div>
                      {clothingColors.length > 0 && (
                        <p className="text-[11px] text-purple-600 mt-1">{t("تم اختيار:", "Selected:")} {clothingColors.join(", ")}</p>
                      )}
                    </div>

                    {/* Row 4: Fit Type + Pattern + Sleeve */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("القصة / الفِت", "Fit Type")}</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {CLOTHING_FIT_TYPES.map((f) => (
                            <button key={f.value} type="button"
                              onClick={() => setClothingFitType(clothingFitType === f.value ? "" : f.value)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border-2 transition-all ${
                                clothingFitType === f.value
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                              }`}>
                              {t(f.ar, f.en)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("النمط / النقشة", "Pattern")}</Label>
                        <Select value={clothingPattern} onValueChange={setClothingPattern}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {CLOTHING_PATTERNS.map((p) => (
                              <SelectItem key={p.value} value={p.value} className="rounded-lg">{t(p.ar, p.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("طول الكم", "Sleeve Type")}</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {CLOTHING_SLEEVE_TYPES.map((s) => (
                            <button key={s.value} type="button"
                              onClick={() => setClothingSleeveType(clothingSleeveType === s.value ? "" : s.value)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border-2 transition-all ${
                                clothingSleeveType === s.value
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                              }`}>
                              {t(s.ar, s.en)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Neckline + Material + Season */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("نوع الياقة", "Neckline")}</Label>
                        <Select value={clothingNeckline} onValueChange={setClothingNeckline}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {CLOTHING_NECKLINES.map((n) => (
                              <SelectItem key={n.value} value={n.value} className="rounded-lg">{t(n.ar, n.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("الخامة", "Material")}</Label>
                        <Select value={clothingMaterial} onValueChange={setClothingMaterial}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر الخامة", "Select material")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl max-h-60">
                            {CLOTHING_MATERIALS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="rounded-lg">{t(m.ar, m.en)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("الموسم", "Season")}</Label>
                        <Select value={clothingSeason} onValueChange={setClothingSeason}>
                          <SelectTrigger className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500">
                            <SelectValue placeholder={t("اختر", "Select")} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="summer" className="rounded-lg">{t("صيفي", "Summer")}</SelectItem>
                            <SelectItem value="winter" className="rounded-lg">{t("شتوي", "Winter")}</SelectItem>
                            <SelectItem value="spring" className="rounded-lg">{t("ربيعي", "Spring")}</SelectItem>
                            <SelectItem value="autumn" className="rounded-lg">{t("خريفي", "Autumn")}</SelectItem>
                            <SelectItem value="all" className="rounded-lg">{t("كل المواسم", "All Seasons")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 6: Brand + SKU Prefix + Weight */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("البراند / الماركة", "Brand")}</Label>
                        <Input value={clothingBrand} onChange={(e) => setClothingBrand(e.target.value)}
                          placeholder={t("مثال: Zara, Nike", "e.g. Zara, Nike")}
                          className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("بادئة الكود (SKU)", "SKU Prefix")}</Label>
                        <Input value={clothingSkuPrefix} onChange={(e) => setClothingSkuPrefix(e.target.value)}
                          placeholder={t("مثال: TSH", "e.g. TSH")}
                          className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500" />
                        <p className="text-[10px] text-gray-400 mt-0.5">{t("سيتم إنشاء كود تلقائي: TSH-L-أسود", "Auto SKU: TSH-L-Black")}</p>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm font-medium">{t("الوزن (جرام)", "Weight (grams)")}</Label>
                        <Input type="number" value={clothingWeight} onChange={(e) => setClothingWeight(e.target.value)}
                          placeholder={t("مثال: 250", "e.g. 250")}
                          className="mt-1.5 h-10 rounded-xl border-purple-200 focus:ring-purple-500" />
                      </div>
                    </div>

                    {/* Row 7: Care Instructions */}
                    <div>
                      <Label className="text-gray-700 text-sm font-medium">{t("تعليمات العناية", "Care Instructions")}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {CLOTHING_CARE.map((care) => (
                          <button key={care.value} type="button"
                            onClick={() => setClothingCare(prev => prev.includes(care.value) ? prev.filter(c => c !== care.value) : [...prev, care.value])}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border-2 transition-all ${
                              clothingCare.includes(care.value)
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                            }`}>
                            <span>{care.icon}</span> {t(care.ar, care.en)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Variant Summary */}
                    {clothingSizes.length > 0 && clothingColors.length > 0 && (
                      <div className="bg-white border border-purple-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-purple-700 font-bold">
                            {t("ملخص المتغيرات", "Variants Summary")}
                          </p>
                          <span className="bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            {clothingSizes.length * clothingColors.length} {t("متغير", "variants")}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {clothingSizes.length} {t("مقاس", "sizes")} × {clothingColors.length} {t("لون", "colors")} = {clothingSizes.length * clothingColors.length} {t("متغير", "variants")}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {t("الكمية لكل متغير:", "Stock per variant:")} ~{Math.floor((Number(document.querySelector<HTMLInputElement>('[name="stock"]')?.value) || 0) / (clothingSizes.length * clothingColors.length))} {t("قطعة", "pcs")}
                        </p>
                        {clothingSkuPrefix && (
                          <p className="text-[10px] text-purple-500 font-mono">
                            {t("مثال كود:", "Example SKU:")} {clothingSkuPrefix}-{clothingSizes[0]}-{clothingColors[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ===== GROCERY-SPECIFIC FIELDS ===== */}
                {storeType === "grocery" && (
                  <div className="space-y-4 border-2 border-orange-200 rounded-2xl p-5 bg-orange-50/50">
                    <h3 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                      <ShoppingBasket className="h-4 w-4" />
                      {t("بيانات المنتج الغذائي", "Grocery Product Details")}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الوزن / الحجم", "Weight / Volume")}</Label>
                        <Input value={groceryWeight} onChange={(e) => setGroceryWeight(e.target.value)}
                          placeholder={t("مثال: 500", "Example: 500")}
                          className="mt-1 h-10 rounded-xl border-orange-200 focus:ring-orange-500" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الوحدة", "Unit")}</Label>
                        <Select value={groceryWeightUnit} onValueChange={setGroceryWeightUnit}>
                          <SelectTrigger className="mt-1 h-10 rounded-xl border-orange-200 focus:ring-orange-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="g" className="rounded-lg">{t("جرام", "Gram")}</SelectItem>
                            <SelectItem value="kg" className="rounded-lg">{t("كيلو", "Kg")}</SelectItem>
                            <SelectItem value="ml" className="rounded-lg">{t("مل", "ml")}</SelectItem>
                            <SelectItem value="l" className="rounded-lg">{t("لتر", "Liter")}</SelectItem>
                            <SelectItem value="pcs" className="rounded-lg">{t("قطعة", "Piece")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("بلد المنشأ", "Country of Origin")}</Label>
                        <Input value={groceryOrigin} onChange={(e) => setGroceryOrigin(e.target.value)}
                          placeholder={t("مثال: مصر", "Example: Egypt")}
                          className="mt-1 h-10 rounded-xl border-orange-200 focus:ring-orange-500" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-gray-700 text-sm flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-red-500" />
                        {t("تاريخ الصلاحية", "Expiry Date")}
                      </Label>
                      <Input type="date" value={groceryExpiry} onChange={(e) => setGroceryExpiry(e.target.value)}
                        className="mt-1 h-10 rounded-xl border-orange-200 focus:ring-orange-500 max-w-xs" />
                    </div>
                  </div>
                )}

                {/* ===== ELECTRONICS-SPECIFIC FIELDS ===== */}
                {storeType === "electronics" && (
                  <div className="space-y-4 border-2 border-primary/20 rounded-2xl p-5 bg-primary/5">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Box className="h-4 w-4" />
                      {t("بيانات المنتج الإلكتروني", "Electronics Product Details")}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الماركة / البراند", "Brand")}</Label>
                        <Input value={electronicsBrand} onChange={(e) => setElectronicsBrand(e.target.value)}
                          placeholder={t("مثال: سامسونج", "Example: Samsung")}
                          className="mt-1 h-10 rounded-xl border-primary/20 focus:ring-primary/20" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("الموديل", "Model")}</Label>
                        <Input value={electronicsModel} onChange={(e) => setElectronicsModel(e.target.value)}
                          placeholder={t("مثال: Galaxy A54", "Example: Galaxy A54")}
                          className="mt-1 h-10 rounded-xl border-primary/20 focus:ring-primary/20" />
                      </div>
                      <div>
                        <Label className="text-gray-700 text-sm">{t("مدة الضمان (بالشهور)", "Warranty (months)")}</Label>
                        <Input type="number" value={electronicsWarranty} onChange={(e) => setElectronicsWarranty(e.target.value)}
                          placeholder="12" min="0"
                          className="mt-1 h-10 rounded-xl border-primary/20 focus:ring-primary/20" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== Category Selection ===== */}
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
                    <Label htmlFor="customCategory" className="text-gray-700 font-medium">{t("اسم القسم *", "Category Name *")}</Label>
                    <Input
                      id="customCategory"
                      name="customCategory"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder={t("أدخل اسم القسم", "Enter category name")}
                      className="mt-1.5 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                )}

                {/* ===== Image Upload ===== */}
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
                        className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all bg-gray-50 group"
                      >
                        <div className="flex flex-col items-center justify-center py-6">
                          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${STORE_TYPE_THEME[storeType].gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
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
                    className={`flex-1 bg-gradient-to-r ${STORE_TYPE_THEME[storeType].gradient} hover:opacity-90 rounded-xl h-12 shadow-lg hover:shadow-xl transition-all`}
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
