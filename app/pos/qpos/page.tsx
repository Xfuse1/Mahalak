"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import type { ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/lib/auth-context"
import {
  getPOSProducts,
  createPOSSale,
  getPOSMonthlySalesHistory,
  getPOSDailySummary,
  getPOSPinStatus,
  setPOSAccessPin,
  verifyPOSAccessPin,
  createPOSQuickProduct,
  type POSSaleItem,
  type POSMonthlySalesHistoryMonth,
} from "@/lib/actions/pos"
import { uploadProductImage, updateProduct } from "@/lib/actions/products"
import { getStoreByUserId } from "@/lib/actions/stores"
import { fetchStoreSubcategories, type SubcategoryItem } from "@/lib/firebase/categories"
import { useLanguage } from "@/lib/language-context"
import { logError } from "@/lib/logger"
import { UploadDialog } from "@/components/auth/upload-dialog"
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Receipt, DollarSign,
  BarChart3, Printer, Package, ChevronLeft,
  CreditCard, Banknote, Wallet, AlertTriangle, CheckCircle2, Clock,
  User, StickyNote, Tag, Grid3X3, Store, MessageCircle, Camera, ScanLine, Download
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

// Lazy load camera/barcode scanner (heavy: html5-qrcode library)
function ScannerLoading() {
  const { t } = useLanguage()
  return <div className="flex items-center justify-center p-8">{t("جاري تحميل الماسح...", "Loading scanner...")}</div>
}

const BarcodeScanner = dynamic(
  () => import("@/components/barcode-scanner").then(m => ({ default: m.BarcodeScanner })),
  { ssr: false, loading: () => <ScannerLoading /> }
)

// ===================== Types =====================

type Product = {
  id: string
  name: string
  price: number
  cost_price?: number
  profit_per_unit?: number
  stock: number
  category: string
  image_url: string
  barcode: string
  description: string
}

type CartItem = Product & {
  quantity: number
  total: number
}

type Sale = {
  id: string
  sale_number: string
  items: POSSaleItem[]
  total: number
  subtotal: number
  discount: number
  amount_paid: number
  change: number
  payment_method: string
  customer_name?: string
  customer_phone?: string
  created_at: string
}

type DailySummary = {
  date: string
  totalSales: number
  totalRevenue: number
  totalItems: number
  cashSales: number
  cardSales: number
  averageOrderValue: number
  netProfit: number
  cashInTotal: number
}

type HistoryMonth = POSMonthlySalesHistoryMonth

type MonthlySalesHistory = {
  month: HistoryMonth
  startDate: string
  endDate: string
  totalSales: number
  totalRevenue: number
  netProfit: number
  sales: Sale[]
}

type StoreData = {
  id: string
  name: string
  address?: string
  phone?: string
  logo_url?: string
  is_approved?: boolean
  category?: string
}

type PosErrorMessage = { ar: string; en: string }

const posErrorMessages: Record<string, PosErrorMessage> = {
  POS_UNAUTHORIZED: { ar: "ليس لديك صلاحية", en: "You are not authorized to perform this action" },
  POS_DISCOUNT_NEGATIVE: { ar: "الخصم لا يمكن أن يكون سالباً", en: "Discount cannot be negative" },
  POS_DISCOUNT_PERCENT_EXCEEDED: { ar: "نسبة الخصم لا يمكن أن تتجاوز 100%", en: "Discount percentage cannot exceed 100%" },
  POS_PRODUCT_NOT_FOUND: { ar: "المنتج غير موجود", en: "Product not found" },
  POS_INSUFFICIENT_STOCK: { ar: "الكمية المطلوبة أكبر من المخزون المتاح", en: "Requested quantity exceeds available stock" },
  POS_PAYMENT_TOO_LOW: { ar: "المبلغ المدفوع أقل من الإجمالي", en: "Paid amount is less than total" },
  POS_CREATE_SALE_FAILED: { ar: "فشل في إنشاء عملية البيع", en: "Failed to create sale" },
  POS_QUICK_PRODUCT_NAME_REQUIRED: { ar: "اسم المنتج مطلوب", en: "Product name is required" },
  POS_QUICK_PRODUCT_PRICE_INVALID: { ar: "السعر يجب أن يكون أكبر من صفر", en: "Price must be greater than zero" },
  POS_QUICK_PRODUCT_COST_PRICE_INVALID: { ar: "سعر الشراء يجب أن يكون أكبر من صفر", en: "Cost price must be greater than zero" },
  POS_QUICK_PRODUCT_SELLING_PRICE_BELOW_COST: { ar: "سعر البيع لا يمكن أن يكون أقل من سعر الشراء", en: "Selling price cannot be lower than cost price" },
  POS_QUICK_PRODUCT_STOCK_INVALID: { ar: "الكمية يجب أن تكون أكبر من صفر", en: "Stock must be greater than zero" },
  POS_STORE_NOT_APPROVED: {
    ar: "متجرك غير معتمد بعد. لا يمكنك إضافة منتجات جديدة حتى يتم اعتماد متجرك من قبل الإدارة.",
    en: "Your store is not approved yet. You cannot add new products until your store is approved by the administration.",
  },
  POS_DUPLICATE_BARCODE: { ar: "يوجد منتج بنفس الباركود", en: "A product with this barcode already exists" },
  POS_CREATE_QUICK_PRODUCT_FAILED: { ar: "فشل في إضافة المنتج", en: "Failed to add product" },
  MISSING_FILE_OR_STORE_ID: { ar: "لم يتم تحديد الصورة أو المتجر", en: "Image file or store ID is missing" },
  UNAUTHORIZED_IMAGE_UPLOAD: { ar: "ليس لديك صلاحية لرفع الصورة", en: "You are not authorized to upload this image" },
  UNSUPPORTED_IMAGE_TYPE: { ar: "نوع الصورة غير مدعوم", en: "Unsupported image type" },
  IMAGE_TOO_LARGE: { ar: "حجم الصورة كبير جداً (الحد الأقصى 5MB)", en: "Image is too large (max 5MB)" },
  IMAGE_UPLOAD_FAILED: { ar: "فشل رفع الصورة", en: "Failed to upload image" },
  IMAGE_UPLOAD_INTERNAL_ERROR: { ar: "حدث خطأ أثناء رفع الصورة", en: "An error occurred while uploading image" },
  PRODUCT_NOT_FOUND: { ar: "المنتج غير موجود", en: "Product not found" },
  UNAUTHORIZED_PRODUCT_ACCESS: { ar: "ليس لديك صلاحية لتعديل هذا المنتج", en: "You are not authorized to edit this product" },
  PRICE_MUST_BE_POSITIVE: { ar: "سعر البيع يجب أن يكون أكبر من صفر", en: "Selling price must be greater than zero" },
  COST_PRICE_MUST_BE_POSITIVE: { ar: "سعر الشراء يجب أن يكون أكبر من صفر", en: "Cost price must be greater than zero" },
  SELLING_PRICE_BELOW_COST: { ar: "سعر البيع لا يمكن أن يكون أقل من سعر الشراء", en: "Selling price cannot be lower than cost price" },
  STOCK_MUST_BE_POSITIVE: { ar: "الكمية يجب أن تكون أكبر من صفر", en: "Stock must be greater than zero" },
  UPDATE_PRODUCT_FAILED: { ar: "فشل تحديث المنتج", en: "Failed to update product" },
  POS_LOAD_SALES_HISTORY_FAILED: { ar: "حدث خطأ أثناء تحميل سجل المبيعات", en: "Failed to load sales history" },
  POS_LOAD_MONTHLY_SALES_HISTORY_FAILED: { ar: "حدث خطأ أثناء تحميل سجل الشهر", en: "Failed to load monthly sales history" },
  POS_LOAD_DAILY_SUMMARY_FAILED: { ar: "حدث خطأ أثناء تحميل ملخص اليوم", en: "Failed to load daily summary" },
  POS_PIN_REQUIRED: { ar: "مطلوب إدخال الرقم السري", en: "PIN is required" },
  POS_PIN_INVALID_FORMAT: { ar: "الرقم السري يجب أن يكون من 4 إلى 8 أرقام", en: "PIN must be 4 to 8 digits" },
  POS_PIN_NOT_CONFIGURED: { ar: "لم يتم تعيين الرقم السري لنظام QPOS بعد", en: "QPOS PIN is not configured yet" },
  POS_PIN_INCORRECT: { ar: "الرقم السري غير صحيح", en: "Incorrect PIN" },
  POS_PIN_SETUP_FAILED: { ar: "فشل حفظ الرقم السري", en: "Failed to save PIN" },
  POS_PIN_STATUS_FAILED: { ar: "فشل التحقق من حالة الرقم السري", en: "Failed to load PIN status" },
  POS_PIN_VERIFY_FAILED: { ar: "فشل التحقق من الرقم السري", en: "Failed to verify PIN" },
}

const MAX_QUICK_ADD_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const QUICK_ADD_ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

// ===================== Main Component =====================

export default function QPOSPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { t, language } = useLanguage()
  const router = useRouter()
  const pageDir = language === "ar" ? "rtl" : "ltr"
  const locale = language === "ar" ? "ar-EG" : "en-US"
  const currencyLabel = t("جنيه", "EGP")

  const [store, setStore] = useState<StoreData | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [amountPaid, setAmountPaid] = useState("")
  const [discount, setDiscount] = useState("")
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "wallet">("cash")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [lastSale, setLastSale] = useState<Sale | null>(null)
  const [historyMonth, setHistoryMonth] = useState<HistoryMonth>("current")
  const [monthlyHistory, setMonthlyHistory] = useState<Record<HistoryMonth, MonthlySalesHistory | null>>({
    current: null,
    previous: null,
  })
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyMonthLoading, setHistoryMonthLoading] = useState<HistoryMonth | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [hasPOSPin, setHasPOSPin] = useState<boolean | null>(null)
  const [showPOSPinSetup, setShowPOSPinSetup] = useState(false)
  const [showPOSPinVerify, setShowPOSPinVerify] = useState(false)
  const [posPinInput, setPosPinInput] = useState("")
  const [posPinConfirmInput, setPosPinConfirmInput] = useState("")
  const [posVerifyPinInput, setPosVerifyPinInput] = useState("")
  const [pinLoading, setPinLoading] = useState(false)
  const [pendingProtectedAction, setPendingProtectedAction] = useState<"summary" | "history" | null>(null)
  const [historySessionPin, setHistorySessionPin] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showEditProduct, setShowEditProduct] = useState(false)
  const [showAddStock, setShowAddStock] = useState(false)
  const [quickAddBarcode, setQuickAddBarcode] = useState("")
  const [quickAddName, setQuickAddName] = useState("")
  const [quickAddPrice, setQuickAddPrice] = useState("")
  const [quickAddCostPrice, setQuickAddCostPrice] = useState("")
  const [quickAddStock, setQuickAddStock] = useState("1")
  const [quickAddCategory, setQuickAddCategory] = useState("")
  const [quickAddImageFile, setQuickAddImageFile] = useState<File | null>(null)
  const [quickAddImagePreview, setQuickAddImagePreview] = useState<string | null>(null)
  const [quickAddUploadDialogOpen, setQuickAddUploadDialogOpen] = useState(false)
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editCostPrice, setEditCostPrice] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editBarcode, setEditBarcode] = useState("")
  const [editProductLoading, setEditProductLoading] = useState(false)
  const [stockTargetProduct, setStockTargetProduct] = useState<Product | null>(null)
  const [stockToAdd, setStockToAdd] = useState("1")
  const [addStockLoading, setAddStockLoading] = useState(false)
  const [storeSubcategories, setStoreSubcategories] = useState<SubcategoryItem[]>([])
  const [showMobileCart, setShowMobileCart] = useState(false)
  const isStoreApproved = store?.is_approved === true
  const searchRef = useRef<HTMLInputElement>(null)
  const quickAddFileInputRef = useRef<HTMLInputElement>(null)
  const quickAddCameraInputRef = useRef<HTMLInputElement>(null)
  const translatePosError = useCallback(
    (errorCode?: string | null, fallback?: string) => {
      if (!errorCode) {
        return fallback || t("حدث خطأ غير متوقع", "An unexpected error occurred")
      }

      const mapped = posErrorMessages[errorCode]
      if (mapped) {
        return t(mapped.ar, mapped.en)
      }

      if (errorCode.startsWith("POS_")) {
        return fallback || t("حدث خطأ غير متوقع", "An unexpected error occurred")
      }

      return errorCode
    },
    [t],
  )
  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? translatePosError(error.message, fallback) : fallback
  const activeMonthlyHistory = monthlyHistory[historyMonth]
  const activeSalesHistory = activeMonthlyHistory?.sales ?? []
  const getSaleTimestamp = useCallback((createdAt?: string) => {
    const parsed = createdAt ? Date.parse(createdAt) : NaN
    return Number.isFinite(parsed) ? parsed : 0
  }, [])
  const sortedActiveSalesHistory = useMemo(
    () =>
      [...activeSalesHistory].sort(
        (a, b) => getSaleTimestamp(b.created_at) - getSaleTimestamp(a.created_at),
      ),
    [activeSalesHistory, getSaleTimestamp],
  )
  const isValidPinFormat = useCallback((value: string) => /^\d{4,8}$/.test(value.trim()), [])

  const downloadSelectedMonthSalesHistory = useCallback(() => {
    if (!activeMonthlyHistory) {
      setError(t("لا توجد بيانات شهرية للتنزيل", "No monthly data available to download"))
      return
    }

    if (sortedActiveSalesHistory.length === 0) {
      setError(t("لا توجد مبيعات للتنزيل في هذا الشهر", "No sales to download for this month"))
      return
    }

    const escapeCsv = (value: string | number) => {
      const text = String(value ?? "")
      const escaped = text.replace(/"/g, '""')
      return `"${escaped}"`
    }

    const monthLabel =
      historyMonth === "current"
        ? t("الشهر الحالي", "Current Month")
        : t("الشهر الماضي", "Previous Month")

    const header = [
      t("رقم العملية", "Sale Number"),
      t("التاريخ والوقت", "Date & Time"),
      t("الإجمالي", "Total"),
      t("طريقة الدفع", "Payment Method"),
      t("عدد المنتجات", "Items Count"),
      t("العميل", "Customer"),
    ].map(escapeCsv).join(",")

    const rows = sortedActiveSalesHistory.map((sale) => {
      const paymentLabel =
        sale.payment_method === "cash"
          ? t("نقدي", "Cash")
          : sale.payment_method === "card"
          ? t("بطاقة", "Card")
          : t("محفظة", "Wallet")

      return [
        sale.sale_number || sale.id,
        sale.created_at ? new Date(sale.created_at).toLocaleString(locale) : "",
        `${Number(sale.total || 0).toFixed(2)} ${currencyLabel}`,
        paymentLabel,
        sale.items?.length || 0,
        sale.customer_name || "",
      ]
        .map(escapeCsv)
        .join(",")
    })

    const metaRows = [
      [t("الفترة", "Period"), monthLabel],
      [
        t("المدى الزمني", "Date Range"),
        `${new Date(activeMonthlyHistory.startDate).toLocaleDateString(locale)} - ${new Date(activeMonthlyHistory.endDate).toLocaleDateString(locale)}`,
      ],
      [t("عدد العمليات", "Total Sales"), activeMonthlyHistory.totalSales],
      [
        t("إجمالي الإيرادات", "Total Revenue"),
        `${activeMonthlyHistory.totalRevenue.toFixed(2)} ${currencyLabel}`,
      ],
      [t("صافي الربح", "Net Profit"), `${activeMonthlyHistory.netProfit.toFixed(2)} ${currencyLabel}`],
    ]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n")

    const csv = `\uFEFF${metaRows}\n\n${header}\n${rows.join("\n")}`
    const fileMonthKey = historyMonth === "current" ? "current-month" : "previous-month"
    const today = new Date().toISOString().split("T")[0]
    const fileName = `qpos-sales-${fileMonthKey}-${today}.csv`

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setSuccess(t("تم تنزيل سجل المبيعات بنجاح", "Sales history downloaded successfully"))
    setTimeout(() => setSuccess(""), 2500)
  }, [activeMonthlyHistory, sortedActiveSalesHistory, historyMonth, locale, currencyLabel, t])

  const loadPOSPinStatus = useCallback(
    async (storeId: string, userId: string) => {
      const status = await getPOSPinStatus(storeId, userId)
      if (!status.success) {
        setError(
          translatePosError(
            status.error,
            t("حدث خطأ أثناء تحميل حالة الرقم السري", "Failed to load PIN status"),
          ),
        )
        setHasPOSPin(null)
        setShowPOSPinSetup(false)
        return null
      }

      setHasPOSPin(status.hasPin)
      setShowPOSPinSetup(!status.hasPin)
      return status.hasPin
    },
    [t, translatePosError],
  )

  useEffect(() => {
    setMonthlyHistory({ current: null, previous: null })
    setHistoryMonth("current")
  }, [store?.id])

  useEffect(() => {
    if (discount === "") return

    const parsedDiscount = Number(discount)
    if (!Number.isFinite(parsedDiscount)) return

    if (parsedDiscount < 0) {
      setDiscount("0")
      return
    }

    if (discountType === "percentage" && parsedDiscount > 100) {
      setDiscount("100")
    }
  }, [discountType, discount])

  // ===================== Load Data =====================

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth?role=seller")
      return
    }

    async function loadData() {
      try {
        const storeData = await getStoreByUserId(user!.id)
        if (!storeData) {
          router.push("/seller/dashboard")
          return
        }
        setStore(storeData)

        // Fetch subcategories for the store's category
        if (storeData.category) {
          fetchStoreSubcategories(storeData.category).then(setStoreSubcategories).catch(() => {})
        }

        const productsData = await getPOSProducts(storeData.id, user!.id)
        setProducts(productsData as Product[])
        await loadPOSPinStatus(storeData.id, user!.id)
      } catch (err) {
        logError("[POS] Error loading data:", err)
        setError(t("فشل في تحميل البيانات", "Failed to load data"))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, router, t, loadPOSPinStatus])

  // ===================== Categories =====================

  const categories = useMemo(() => {
    const cats = new Set<string>()
    products.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats)
  }, [products])

  // ===================== Filtered Products =====================

  const filteredProducts = useMemo(() => {
    let filtered = products

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }

    return filtered
  }, [products, selectedCategory, searchQuery])

  // ===================== Cart Calculations =====================

  const subtotal = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + item.total, 0)),
    [cart]
  )

  const normalizedDiscountValue = useMemo(() => {
    const parsedDiscount = Number(discount)
    if (!Number.isFinite(parsedDiscount) || parsedDiscount <= 0) {
      return 0
    }
    if (discountType === "percentage") {
      return Math.min(parsedDiscount, 100)
    }
    return parsedDiscount
  }, [discount, discountType])

  const discountAmount = useMemo(() => {
    if (normalizedDiscountValue <= 0) {
      return 0
    }
    if (discountType === "percentage") {
      return roundMoney((subtotal * normalizedDiscountValue) / 100)
    }
    return roundMoney(Math.min(normalizedDiscountValue, subtotal))
  }, [subtotal, normalizedDiscountValue, discountType])

  const total = useMemo(
    () => roundMoney(Math.max(0, subtotal - discountAmount)),
    [subtotal, discountAmount]
  )

  const change = useMemo(() => {
    const paid = Number(amountPaid) || 0
    return roundMoney(Math.max(0, paid - total))
  }, [amountPaid, total])

  const cartItemsCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  )

  // ===================== Cart Actions =====================

  const addToCart = useCallback(
    (product: Product) => {
      setError("")
      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id)
        if (existing) {
          if (existing.quantity >= product.stock) {
            setError(`${t("لا يوجد مخزون كافي من", 'Insufficient stock for')} "${product.name}"`)
            return prev
          }
          return prev.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  total: (item.quantity + 1) * item.price,
                }
              : item
          )
        }
        if (product.stock <= 0) {
          setError(`${t("المنتج", "Product")} "${product.name}" ${t("غير متوفر", "is unavailable")}`)
          return prev
        }
        return [
          ...prev,
          { ...product, quantity: 1, total: product.price },
        ]
      })
    },
    [t]
  )

  const updateQuantity = useCallback(
    (productId: string, newQty: number) => {
      if (newQty <= 0) {
        removeFromCart(productId)
        return
      }
      const product = products.find((p) => p.id === productId)
      if (product && newQty > product.stock) {
        setError(`${t("لا يوجد مخزون كافي من", "Insufficient stock for")} "${product.name}"`)
        return
      }
      setCart((prev) =>
        prev.map((item) =>
          item.id === productId
            ? { ...item, quantity: newQty, total: newQty * item.price }
            : item
        )
      )
    },
    [products, t]
  )

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setDiscount("")
    setCustomerName("")
    setCustomerPhone("")
    setNotes("")
    setAmountPaid("")
    setError("")
  }, [])

  // ===================== Process Sale =====================

  const processSale = async () => {
    if (cart.length === 0) return
    if (paymentMethod === "cash" && (Number(amountPaid) || 0) < total) {
      setError(t("المبلغ المدفوع أقل من الإجمالي", "Paid amount is less than total"))
      return
    }

    setProcessing(true)
    setError("")

    try {
      const saleItems: POSSaleItem[] = cart.map((item) => ({
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        image_url: item.image_url,
      }))

      const result = await createPOSSale({
        store_id: store.id,
        seller_id: user!.id,
        items: saleItems,
        subtotal,
        discount: normalizedDiscountValue,
        discount_type: discountType,
        tax: 0,
        total,
        amount_paid: paymentMethod === "cash" ? Number(amountPaid) || 0 : total,
        change: paymentMethod === "cash" ? change : 0,
        payment_method: paymentMethod,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        notes: notes || undefined,
      }, user!.id)

      if (result.success) {
        setLastSale(result.data)
        setShowPayment(false)
        setShowReceipt(true)
        setSuccess(t("تمت عملية البيع بنجاح!", "Sale completed successfully!"))

        // Update local product stock
        setProducts((prev) =>
          prev.map((p) => {
            const cartItem = cart.find((c) => c.id === p.id)
            if (cartItem) {
              return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) }
            }
            return p
          })
        )

        clearCart()
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(translatePosError(result.error, t("فشل في إتمام عملية البيع", "Failed to complete sale")))
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ غير متوقع", "An unexpected error occurred")))
    } finally {
      setProcessing(false)
    }
  }

  // ===================== Load History =====================

  const loadHistory = async (verifiedPin: string) => {
    if (!store || !user) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }

    setLoadingHistory(true)
    setError("")
    setHistoryMonth("current")
    try {
      const history = monthlyHistory.current
        ? monthlyHistory.current
        : ((await getPOSMonthlySalesHistory(store.id, "current", user.id, verifiedPin)) as MonthlySalesHistory)

      if (!monthlyHistory.current) {
        setMonthlyHistory((prev) => ({
          ...prev,
          current: {
            ...history,
            sales: history.sales || [],
          },
        }))
      }

      setShowHistory(true)
      if (history.totalSales === 0) {
        setSuccess(t("لا توجد مبيعات مسجلة هذا الشهر", "No sales recorded this month"))
      }
    } catch (err: unknown) {
      logError("[POS] Error loading history:", err)
      const errorMsg = getErrorMessage(
        err,
        t("حدث خطأ أثناء تحميل سجل الشهر", "An error occurred while loading monthly sales history"),
      )
      setError(errorMsg)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleHistoryMonthChange = async (month: HistoryMonth) => {
    if (historyMonth === month) {
      return
    }

    if (!historySessionPin) {
      setError(t("مطلوب إدخال الرقم السري", "PIN is required"))
      return
    }

    setHistoryMonth(month)
    if (!store || !user || monthlyHistory[month]) {
      return
    }

    setHistoryMonthLoading(month)
    setError("")
    try {
      const history = (await getPOSMonthlySalesHistory(store.id, month, user.id, historySessionPin)) as MonthlySalesHistory
      setMonthlyHistory((prev) => ({
        ...prev,
        [month]: {
          ...history,
          sales: history.sales || [],
        },
      }))

      if (history.totalSales === 0) {
        setSuccess(
          month === "current"
            ? t("لا توجد مبيعات مسجلة هذا الشهر", "No sales recorded this month")
            : t("لا توجد مبيعات مسجلة الشهر الماضي", "No sales recorded last month"),
        )
      }
    } catch (err: unknown) {
      logError(`[POS] Error loading ${month} sales history:`, err)
      const errorMsg = getErrorMessage(
        err,
        t("حدث خطأ أثناء تحميل سجل الشهر", "An error occurred while loading monthly sales history"),
      )
      setError(errorMsg)
    } finally {
      setHistoryMonthLoading((prev) => (prev === month ? null : prev))
    }
  }
  const loadDailySummary = async (verifiedPin: string) => {
    if (!store || !user) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }
    setLoadingSummary(true)
    setError("")
    try {
      const summary = await getPOSDailySummary(store.id, undefined, user.id, verifiedPin)
      setDailySummary(summary)
      setShowSummary(true)
      if (summary.totalSales === 0) {
        setSuccess(t("لا توجد مبيعات لهذا اليوم", "No sales for today"))
      }
    } catch (err: unknown) {
      logError("[POS] Error loading summary:", err)
      const errorMsg = getErrorMessage(
        err,
        t("حدث خطأ أثناء تحميل ملخص اليوم", "An error occurred while loading daily summary"),
      )
      setError(errorMsg)
    } finally {
      setLoadingSummary(false)
    }
  }

  const openProtectedPOSAction = async (action: "summary" | "history") => {
    if (!store || !user) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }

    let configured = hasPOSPin
    if (configured === null) {
      configured = await loadPOSPinStatus(store.id, user.id)
    }

    if (configured === null) {
      return
    }

    if (!configured) {
      setPendingProtectedAction(action)
      setShowPOSPinSetup(true)
      return
    }

    setPendingProtectedAction(action)
    setPosVerifyPinInput("")
    setShowPOSPinVerify(true)
  }

  const handleSetupPOSPin = async () => {
    if (!store || !user) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }

    const normalizedPin = posPinInput.trim()
    const normalizedConfirmPin = posPinConfirmInput.trim()

    if (!isValidPinFormat(normalizedPin)) {
      setError(translatePosError("POS_PIN_INVALID_FORMAT", t("الرقم السري غير صالح", "Invalid PIN format")))
      return
    }
    if (normalizedPin !== normalizedConfirmPin) {
      setError(t("الرقمان السريان غير متطابقين", "PIN values do not match"))
      return
    }

    setPinLoading(true)
    setError("")
    try {
      const result = await setPOSAccessPin(store.id, normalizedPin, user.id)
      if (!result.success) {
        setError(translatePosError(result.error, t("فشل حفظ الرقم السري", "Failed to save PIN")))
        return
      }

      setHasPOSPin(true)
      setShowPOSPinSetup(false)
      setPosPinInput("")
      setPosPinConfirmInput("")
      setSuccess(t("تم حفظ الرقم السري بنجاح", "PIN saved successfully"))
      setTimeout(() => setSuccess(""), 2500)

      if (pendingProtectedAction) {
        setPosVerifyPinInput("")
        setShowPOSPinVerify(true)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ أثناء حفظ الرقم السري", "An error occurred while saving PIN")))
    } finally {
      setPinLoading(false)
    }
  }

  const handleVerifyPOSPin = async () => {
    if (!store || !user || !pendingProtectedAction) {
      setError(t("تعذر تحديد الإجراء المطلوب", "Unable to identify protected action"))
      return
    }

    const normalizedPin = posVerifyPinInput.trim()
    if (!isValidPinFormat(normalizedPin)) {
      setError(translatePosError("POS_PIN_INVALID_FORMAT", t("الرقم السري غير صالح", "Invalid PIN format")))
      return
    }

    setPinLoading(true)
    setError("")
    try {
      const result = await verifyPOSAccessPin(store.id, normalizedPin, user.id)
      if (!result.success) {
        if (result.error === "POS_PIN_NOT_CONFIGURED") {
          setHasPOSPin(false)
          setShowPOSPinVerify(false)
          setShowPOSPinSetup(true)
        }
        setError(translatePosError(result.error, t("فشل التحقق من الرقم السري", "Failed to verify PIN")))
        return
      }

      setShowPOSPinVerify(false)
      setPosVerifyPinInput("")

      if (pendingProtectedAction === "history") {
        setHistorySessionPin(normalizedPin)
        await loadHistory(normalizedPin)
      } else {
        await loadDailySummary(normalizedPin)
      }

      setPendingProtectedAction(null)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ أثناء التحقق من الرقم السري", "An error occurred while verifying PIN")))
    } finally {
      setPinLoading(false)
    }
  }

  // ===================== Print Receipt =====================

  const printReceipt = () => {
    window.print()
  }

  // ===================== Send WhatsApp =====================

  const formatPhoneForWhatsApp = useCallback((raw?: string) => {
    if (!raw) return ""

    let digits = raw.replace(/\D/g, "")
    if (digits.startsWith("00")) digits = digits.slice(2)
    if (digits.startsWith("0")) {
      // Default local numbers to Egypt country code
      digits = `20${digits.slice(1)}`
    }

    return digits
  }, [])

  const lastSaleWhatsAppPhone = useMemo(
    () => formatPhoneForWhatsApp(lastSale?.customer_phone),
    [formatPhoneForWhatsApp, lastSale?.customer_phone],
  )

  const canSendReceiptViaWhatsApp = !!lastSaleWhatsAppPhone && lastSaleWhatsAppPhone.length >= 8

  const sendWhatsApp = () => {
    if (!lastSale) return
    if (!canSendReceiptViaWhatsApp) {
      setError(
        t(
          "لا يمكن إرسال الفاتورة عبر واتساب بدون رقم هاتف العميل. أدخل رقم الهاتف أثناء الدفع أولًا.",
          "Cannot send receipt via WhatsApp without customer phone number. Enter it during payment first.",
        ),
      )
      return
    }
    
    // Format receipt message
    let message = `🧾 *${store.name}*\n`
    if (store.address) message += `📍 ${store.address}\n`
    if (store.phone) message += `📞 ${store.phone}\n`
    message += `\n━━━━━━━━━━━━━━━━\n\n`
    message += `🕒 ${new Date(lastSale.created_at).toLocaleDateString(locale)}\n`
    message += `🔢 ${t("رقم الفاتورة", "Invoice No.")}: #${lastSale.sale_number}\n\n`
    message += `📦 *${t("المنتجات", "Products")}:*\n`
    
    lastSale.items.forEach((item: POSSaleItem) => {
      message += `• ${item.name} × ${item.quantity} = ${item.total.toFixed(2)} ${currencyLabel}\n`
    })
    
    message += `\n━━━━━━━━━━━━━━━━\n\n`
    message += `${t("المجموع", "Subtotal")}: ${lastSale.subtotal.toFixed(2)} ${currencyLabel}\n`
    
    if (lastSale.discount > 0) {
      message += `${t("الخصم", "Discount")}: -${lastSale.discount.toFixed(2)} ${currencyLabel}\n`
    }
    
    message += `\n💰 *${t("الإجمالي", "Total")}: ${lastSale.total.toFixed(2)} ${currencyLabel}*\n\n`
    
    if (lastSale.payment_method === "cash") {
      message += `${t("المدفوع", "Paid")}: ${lastSale.amount_paid.toFixed(2)} ${currencyLabel}\n`
      message += `${t("الباقي", "Change")}: ${lastSale.change.toFixed(2)} ${currencyLabel}\n\n`
    }
    
    message += `🙏 ${t("شكراً لتسوقكم معنا", "Thank you for shopping with us")}`
    
    // Open WhatsApp with message
    const whatsappUrl = `https://wa.me/${lastSaleWhatsAppPhone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
  }

  // ===================== Quick Add Helpers =====================

  const resetQuickAddForm = useCallback(() => {
    setQuickAddBarcode("")
    setQuickAddName("")
    setQuickAddPrice("")
    setQuickAddCostPrice("")
    setQuickAddStock("1")
    setQuickAddCategory("")
    setQuickAddImageFile(null)
    setQuickAddImagePreview(null)
    setQuickAddUploadDialogOpen(false)
  }, [])

  const validateQuickAddImageFile = useCallback((file: File): string | null => {
    if (!QUICK_ADD_ALLOWED_FILE_TYPES.includes(file.type)) {
      return t(
        "نوع الصورة غير مدعوم. الأنواع المسموحة: JPEG, PNG, WebP",
        "Unsupported image type. Allowed types: JPEG, PNG, WebP",
      )
    }
    if (file.size > MAX_QUICK_ADD_IMAGE_SIZE) {
      return t("حجم الصورة كبير جداً. الحد الأقصى 5MB", "Image is too large. Maximum size is 5MB")
    }
    return null
  }, [t])

  const openQuickAddUploadDialog = useCallback(() => {
    setQuickAddUploadDialogOpen(true)
  }, [])

  const handleQuickAddUploadedFile = useCallback((file: File) => {
    const validationError = validateQuickAddImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setQuickAddImageFile(file)
      setQuickAddImagePreview(typeof reader.result === "string" ? reader.result : null)
    }
    reader.readAsDataURL(file)
    setError("")
    setQuickAddUploadDialogOpen(false)
  }, [validateQuickAddImageFile])

  const handleQuickAddFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleQuickAddUploadedFile(file)
    }
    e.target.value = ""
  }, [handleQuickAddUploadedFile])

  const applyUpdatedProductLocally = useCallback((updatedProduct: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p)))
    setCart((prev) =>
      prev.map((item) =>
        item.id === updatedProduct.id
          ? {
              ...item,
              name: updatedProduct.name,
              price: updatedProduct.price,
              category: updatedProduct.category,
              barcode: updatedProduct.barcode,
              total: item.quantity * updatedProduct.price,
            }
          : item,
      ),
    )
  }, [])

  const resetEditProductForm = useCallback(() => {
    setEditingProduct(null)
    setEditName("")
    setEditPrice("")
    setEditCostPrice("")
    setEditCategory("")
    setEditBarcode("")
  }, [])

  const openEditProductModal = useCallback((product: Product) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditPrice(String(product.price))
    setEditCostPrice(String(product.cost_price ?? product.price))
    setEditCategory(product.category || "")
    setEditBarcode(product.barcode || "")
    setShowEditProduct(true)
    setError("")
  }, [])

  const handleSaveEditedProduct = async () => {
    if (!editingProduct || !user) {
      setError(t("لم يتم العثور على بيانات المنتج", "Product data was not found"))
      return
    }

    const normalizedName = editName.trim()
    const normalizedCategory = editCategory.trim()
    const sellingPrice = Number(editPrice)
    const costPrice = Number(editCostPrice)

    if (!normalizedName) {
      setError(t("يرجى إدخال اسم المنتج", "Please enter product name"))
      return
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setError(t("سعر البيع يجب أن يكون أكبر من صفر", "Selling price must be greater than zero"))
      return
    }
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setError(t("سعر الشراء يجب أن يكون أكبر من صفر", "Cost price must be greater than zero"))
      return
    }
    if (sellingPrice < costPrice) {
      setError(t("سعر البيع لا يمكن أن يكون أقل من سعر الشراء", "Selling price cannot be lower than cost price"))
      return
    }
    if (!normalizedCategory) {
      setError(t("يرجى اختيار الفئة", "Please select a category"))
      return
    }

    setEditProductLoading(true)
    setError("")
    try {
      const result = await updateProduct(
        editingProduct.id,
        {
          name: normalizedName,
          price: sellingPrice,
          cost_price: costPrice,
          category: normalizedCategory,
          barcode: editBarcode.trim() || "",
        },
        user.id,
      )

      if (!result.success || !result.data) {
        setError(translatePosError(result.error, t("فشل تحديث المنتج", "Failed to update product")))
        return
      }

      const updatedProduct = result.data as Product
      applyUpdatedProductLocally(updatedProduct)
      setShowEditProduct(false)
      resetEditProductForm()
      setSuccess(t("تم تحديث المنتج بنجاح", "Product updated successfully"))
      setTimeout(() => setSuccess(""), 2500)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ غير متوقع", "An unexpected error occurred")))
    } finally {
      setEditProductLoading(false)
    }
  }

  const resetAddStockForm = useCallback(() => {
    setStockTargetProduct(null)
    setStockToAdd("1")
  }, [])

  const openAddStockModal = useCallback((product: Product) => {
    setStockTargetProduct(product)
    setStockToAdd("1")
    setShowAddStock(true)
    setError("")
  }, [])

  const handleAddStockToProduct = async () => {
    if (!stockTargetProduct || !user) {
      setError(t("لم يتم العثور على بيانات المنتج", "Product data was not found"))
      return
    }

    const increment = Number(stockToAdd)
    if (!Number.isFinite(increment) || !Number.isInteger(increment) || increment <= 0) {
      setError(t("الكمية المضافة يجب أن تكون رقمًا صحيحًا أكبر من صفر", "Added quantity must be a positive integer"))
      return
    }

    const newStock = stockTargetProduct.stock + increment
    setAddStockLoading(true)
    setError("")

    try {
      const result = await updateProduct(
        stockTargetProduct.id,
        { stock: newStock },
        user.id,
      )

      if (!result.success || !result.data) {
        setError(translatePosError(result.error, t("فشل تحديث المخزون", "Failed to update stock")))
        return
      }

      const updatedProduct = result.data as Product
      applyUpdatedProductLocally(updatedProduct)
      setShowAddStock(false)
      resetAddStockForm()
      setSuccess(t("تمت إضافة الكمية بنجاح", "Quantity added successfully"))
      setTimeout(() => setSuccess(""), 2500)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ غير متوقع", "An unexpected error occurred")))
    } finally {
      setAddStockLoading(false)
    }
  }

  // ===================== Barcode Scanner =====================

  const handleBarcodeScan = (code: string) => {
    const product = products.find((p) => p.barcode === code)
    if (product) {
      addToCart(product)
      setSuccess(`${t("تم إضافة", "Added")} "${product.name}" ${t("للسلة", "to cart")}`)
      setTimeout(() => setSuccess(""), 2000)
    } else {
      setShowScanner(false)
      if (!isStoreApproved) {
        setError(t("متجرك غير معتمد بعد. لا يمكنك إضافة منتجات جديدة حتى يتم اعتماد متجرك من قبل الإدارة.", "Your store is not approved yet. You cannot add new products until your store is approved by the administration."))
        setTimeout(() => setError(""), 5000)
        return
      }
      resetQuickAddForm()
      setQuickAddBarcode(code)
      setShowQuickAdd(true)
      setError(`${t("لا يوجد منتج بالباركود", "No product found with barcode")}: ${code}`)
      setTimeout(() => setError(""), 3000)
    }
  }

  // ===================== Quick Add Product =====================

  const handleQuickAddProduct = async () => {
    if (!store || !user) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }

    const normalizedName = quickAddName.trim()
    const normalizedCategory = quickAddCategory.trim()
    const sellingPrice = Number(quickAddPrice)
    const costPrice = Number(quickAddCostPrice)
    const normalizedStock = Number(quickAddStock)

    if (!normalizedName) {
      setError(t("يرجى إدخال اسم المنتج", "Please enter product name"))
      return
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      setError(t("سعر البيع يجب أن يكون أكبر من صفر", "Selling price must be greater than zero"))
      return
    }
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setError(t("سعر الشراء يجب أن يكون أكبر من صفر", "Cost price must be greater than zero"))
      return
    }
    if (sellingPrice < costPrice) {
      setError(t("سعر البيع لا يمكن أن يكون أقل من سعر الشراء", "Selling price cannot be lower than cost price"))
      return
    }
    if (!Number.isFinite(normalizedStock) || normalizedStock <= 0) {
      setError(t("الكمية يجب أن تكون أكبر من صفر", "Quantity must be greater than zero"))
      return
    }
    if (!normalizedCategory) {
      setError(t("يرجى اختيار الفئة", "Please select a category"))
      return
    }

    setQuickAddLoading(true)
    setError("")

    try {
      let imageUrl = ""

      if (quickAddImageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append("file", quickAddImageFile)
        uploadFormData.append("storeId", store.id)
        uploadFormData.append("callerId", user.id)

        const uploadResult = await uploadProductImage(uploadFormData)
        if (!uploadResult.success) {
          setError(translatePosError(uploadResult.error, t("فشل رفع الصورة", "Failed to upload image")))
          return
        }

        imageUrl = uploadResult.url || ""
      }

      const result = await createPOSQuickProduct({
        name: normalizedName,
        price: sellingPrice,
        cost_price: costPrice,
        stock: normalizedStock,
        category: normalizedCategory,
        barcode: quickAddBarcode.trim() || undefined,
        image_url: imageUrl || undefined,
        store_id: store.id,
      }, user.id)

      if (result.success && result.data) {
        const newProduct = result.data as Product
        setProducts((prev) => [...prev, newProduct])
        addToCart(newProduct)
        setSuccess(`${t("تم إضافة", "Added")} "${newProduct.name}" ${t("وإضافته للسلة", "and added to cart")}`)
        setTimeout(() => setSuccess(""), 3000)
        setShowQuickAdd(false)
        resetQuickAddForm()
      } else {
        setError(translatePosError(result.error, t("فشل في إضافة المنتج", "Failed to add product")))
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("حدث خطأ غير متوقع", "An unexpected error occurred")))
    } finally {
      setQuickAddLoading(false)
    }
  }

  // ===================== Keyboard Shortcut =====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 = Focus search
      if (e.key === "F2") {
        e.preventDefault()
        searchRef.current?.focus()
      }
      // F9 = Process payment
      if (e.key === "F9" && cart.length > 0) {
        e.preventDefault()
        if (showPayment) processSale()
        else setShowPayment(true)
      }
      // Escape = Close modals
      if (e.key === "Escape") {
        setShowPayment(false)
        setShowReceipt(false)
        setShowHistory(false)
        setShowSummary(false)
        setShowPOSPinVerify(false)
        setShowScanner(false)
        setShowQuickAdd(false)
        setShowEditProduct(false)
        setShowAddStock(false)
        setHistorySessionPin("")
        setPendingProtectedAction(null)
        resetQuickAddForm()
        resetEditProductForm()
        resetAddStockForm()
      }
      // F4 = Clear cart
      if (e.key === "F4") {
        e.preventDefault()
        clearCart()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, showPayment, clearCart, resetQuickAddForm, resetEditProductForm, resetAddStockForm])

  // ===================== Loading / Auth States =====================

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">{t("جاري تحميل نظام الكاشير...", "Loading POS system...")}</p>
        </div>
      </div>
    )
  }

  if (!user || !store) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <p className="text-xl mb-4 text-gray-800 font-bold">{t("لا يمكن الوصول لنظام الكاشير", "Unable to access POS system")}</p>
          <button
            onClick={() => router.push("/seller/dashboard")}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all font-medium"
          >
            {t("العودة للوحة التحكم", "Back to Dashboard")}
          </button>
        </div>
      </div>
    )
  }

  // ===================== Render =====================

  return (
    <div className="h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col overflow-hidden print:bg-white" dir={pageDir}>
      {/* ===== Store Not Approved Banner ===== */}
      {!isStoreApproved && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200 px-4 py-3 flex items-center gap-3 print:hidden" dir={pageDir}>
          <div className="bg-amber-100 p-2 rounded-full">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-amber-800 font-bold text-sm">{t("متجرك في انتظار موافقة الإدارة", "Your store is awaiting admin approval")}</p>
            <p className="text-amber-600 text-xs">{t("يمكنك استخدام نظام الكاشير للمنتجات الموجودة، لكن لا يمكنك إضافة منتجات جديدة حتى يتم اعتماد متجرك.", "You can use POS for existing products, but you cannot add new products until your store is approved.")}</p>
          </div>
        </div>
      )}

      {/* ===== Top Bar ===== */}
      <header className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between print:hidden shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push("/seller/dashboard")}
            className="text-gray-500 hover:text-emerald-600 transition p-1.5 hover:bg-gray-100 rounded-lg"
            title={t("العودة للوحة التحكم", "Back to Dashboard")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover shadow-sm border border-gray-200"
              />
            ) : (
              <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 p-1.5 sm:p-2 rounded-lg shadow-sm">
                <Store className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-gray-800 font-bold text-sm sm:text-lg leading-tight truncate max-w-[120px] sm:max-w-none">{store.name}</h1>
              <span className="text-gray-500 text-[10px] sm:text-xs">{t("نظام الكاشير", "POS System")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile cart toggle */}
          <button
            onClick={() => setShowMobileCart(!showMobileCart)}
            className="lg:hidden relative flex items-center gap-1.5 text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-3 py-2 rounded-xl transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => openProtectedPOSAction("summary")}
            disabled={loadingSummary}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:shadow-xl hover:shadow-violet-500/30 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loadingSummary ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span className="hidden sm:inline">{t("جاري التحميل...", "Loading...")}</span>
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{t("ملخص اليوم", "Today's Summary")}</span>
              </>
            )}
          </button>
          <button
            onClick={() => openProtectedPOSAction("history")}
            disabled={loadingHistory}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:shadow-xl hover:shadow-rose-500/30 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loadingHistory ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span className="hidden sm:inline">{t("جاري التحميل...", "Loading...")}</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">{t("سجل المبيعات", "Sales History")}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ===== Notifications ===== */}
      {error && (
        <div className="bg-red-500/90 text-white px-4 py-2 text-center text-sm font-medium print:hidden">
          {error}
          <button onClick={() => setError("")} className="mr-3 underline">
            {t("إغلاق", "Close")}
          </button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/90 text-white px-4 py-2 text-center text-sm font-medium print:hidden">
          <CheckCircle2 className="inline-block h-4 w-4 ml-1" />
          {success}
        </div>
      )}

      {/* ===== Mobile Cart Overlay ===== */}
      {showMobileCart && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setShowMobileCart(false)} />
      )}

      {/* ===== Main Layout ===== */}
      <div className="flex-1 flex flex-col-reverse lg:flex-row overflow-hidden print:hidden relative">
        {/* ===== Left: Cart Panel ===== */}
        <div className={`
          fixed lg:relative inset-y-0 right-0 z-50 lg:z-auto
          w-[85vw] sm:w-[380px] bg-white flex flex-col border-l border-gray-200 shadow-lg
          transform transition-transform duration-300 ease-in-out
          ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          lg:transform-none
        `}>
          {/* Mobile cart close button */}
          <button
            onClick={() => setShowMobileCart(false)}
            className="lg:hidden absolute top-3 left-3 z-10 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg transition"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
          {/* Cart Header */}
          <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-1.5 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-800 font-bold">
                {t("السلة", "Cart")} ({cartItemsCount})
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("مسح الكل", "Clear All")}
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-gray-600 font-medium">{t("السلة فارغة", "Cart is empty")}</p>
                <p className="text-xs mt-1">{t("اضغط على المنتج لإضافته", "Tap a product to add it")}</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-2.5 flex items-center gap-2 shadow-sm hover:shadow-md transition"
                >
                  {/* Product image */}
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm font-semibold truncate">
                      {item.name}
                    </p>
                    <p className="text-emerald-600 text-xs font-medium">
                      {item.price.toFixed(2)} {currencyLabel}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.id, parseInt(e.target.value) || 0)
                      }
                      className="w-10 h-7 text-center bg-gray-50 text-gray-800 font-medium rounded-lg text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Item Total */}
                  <div className="text-end w-16 flex-shrink-0">
                    <p className="text-gray-800 text-sm font-bold">
                      {item.total.toFixed(2)}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Discount */}
          {cart.length > 0 && (
            <div className="p-3 border-t border-gray-200 space-y-2 bg-white">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-600" />
                <span className="text-gray-600 text-xs font-medium">{t("خصم:", "Discount:")}</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    if (nextValue === "") {
                      setDiscount("")
                      return
                    }

                    const parsedValue = Number(nextValue)
                    if (!Number.isFinite(parsedValue)) {
                      return
                    }

                    if (parsedValue < 0) {
                      setDiscount("0")
                      return
                    }

                    if (discountType === "percentage" && parsedValue > 100) {
                      setDiscount("100")
                      return
                    }

                    setDiscount(nextValue)
                  }}
                  placeholder="0"
                  min="0"
                  max={discountType === "percentage" ? "100" : undefined}
                  step="0.01"
                  className="flex-1 h-7 bg-gray-50 text-gray-800 rounded-lg text-sm px-2 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as "percentage" | "fixed")
                  }
                  className="h-7 bg-gray-50 text-gray-800 rounded-lg text-sm px-1 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="fixed">{currencyLabel}</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>
          )}

          {/* Cart Totals */}
          <div className="p-3 border-t border-gray-200 space-y-1.5 bg-white">
            <div className="flex justify-between text-gray-600 text-sm">
              <span>{t("المجموع الفرعي", "Subtotal")}</span>
              <span className="font-medium">{subtotal.toFixed(2)} {currencyLabel}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-yellow-600 text-sm">
                <span>{t("الخصم", "Discount")}</span>
                <span className="font-medium">-{discountAmount.toFixed(2)} {currencyLabel}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-800 text-lg font-bold pt-2 border-t border-gray-200">
              <span>{t("الإجمالي", "Total")}</span>
              <span className="text-emerald-600">{total.toFixed(2)} {currencyLabel}</span>
            </div>
          </div>

          {/* Pay Button */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <button
              onClick={() => {
                cart.length > 0 && setShowPayment(true)
                setShowMobileCart(false)
              }}
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white py-3 rounded-xl font-bold text-base sm:text-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <DollarSign className="h-5 w-5" />
              {t("دفع (F9)", "Pay (F9)")}
            </button>
          </div>
        </div>

        {/* ===== Right: Products Panel ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Filters */}
          <div className="p-2 sm:p-3 bg-white border-b border-gray-200 space-y-2 shadow-sm">
            <div className="flex gap-1.5 sm:gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("بحث بالاسم أو الباركود... (F2)", "Search by name or barcode... (F2)")}
                  className="w-full h-9 sm:h-11 bg-gray-50 text-gray-800 rounded-xl pr-9 sm:pr-11 pl-4 text-xs sm:text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="h-9 sm:h-11 px-2 sm:px-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all flex items-center gap-1.5"
                title={t("مسح الباركود بالكاميرا", "Scan barcode with camera")}
              >
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm font-medium hidden sm:inline">{t("مسح", "Scan")}</span>
              </button>
              <button
                onClick={() => {
                  if (!isStoreApproved) {
                    setError(t("متجرك غير معتمد بعد. لا يمكنك إضافة منتجات جديدة حتى يتم اعتماد متجرك من قبل الإدارة.", "Your store is not approved yet. You cannot add new products until your store is approved by the administration."))
                    setTimeout(() => setError(""), 5000)
                    return
                  }
                  resetQuickAddForm()
                  setShowQuickAdd(true)
                }}
                className={`h-9 sm:h-11 px-2 sm:px-3 rounded-xl transition-all flex items-center gap-1.5 ${
                  isStoreApproved
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:scale-105"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                title={isStoreApproved ? t("إضافة منتج سريع", "Quick add product") : t("متجرك غير معتمد بعد", "Your store is not approved yet")}
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm font-medium hidden sm:inline">{t("منتج", "Product")}</span>
              </button>
            </div>

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                  selectedCategory === "all"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Grid3X3 className="inline-block h-3.5 w-3.5 ml-1" />
                {t("الكل", "All")}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
            {filteredProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-20">
                <Package className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="text-lg text-gray-600 font-medium">{t("لا توجد منتجات", "No products found")}</p>
                {searchQuery && (
                  <p className="text-sm mt-1 text-gray-500">
                    {t("لم يتم العثور على نتائج لـ", "No results found for")} &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 sm:gap-2.5">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((item) => item.id === product.id)
                  const outOfStock = product.stock <= 0

                  return (
                    <div
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !outOfStock) {
                          e.preventDefault()
                          addToCart(product)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`relative bg-white rounded-xl p-2 text-right transition-all hover:shadow-lg group ${
                        outOfStock
                          ? "opacity-60 cursor-not-allowed"
                          : "cursor-pointer hover:scale-105"
                      } ${inCart ? "ring-2 ring-emerald-500 shadow-md" : "shadow-sm"}`}
                    >
                      {/* Image */}
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-700 mb-2">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-500" />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <p className="text-gray-800 text-sm font-semibold truncate">
                        {product.name}
                      </p>

                      {/* Price & Stock */}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-emerald-600 font-bold text-sm">
                          {product.price.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            product.stock <= 5
                              ? "text-red-500"
                              : "text-gray-500"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </div>

                      <div className="relative z-20 mt-2 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditProductModal(product)
                          }}
                          className="h-8 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                        >
                          {t("تعديل", "Edit")}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openAddStockModal(product)
                          }}
                          className="h-8 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                        >
                          {t("إضافة كمية", "Add Qty")}
                        </button>
                      </div>

                      {/* In Cart Badge */}
                      {inCart && (
                        <div className="absolute top-1 left-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          {inCart.quantity}
                        </div>
                      )}

                      {/* Out of Stock */}
                      {outOfStock && (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-gray-900/70 rounded-xl flex items-center justify-center">
                          <span className="text-red-500 text-xs font-bold bg-white px-2 py-1 rounded-lg shadow-lg">
                            {t("نفذ المخزون", "Out of stock")}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Payment Modal ===== */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-1.5 rounded-lg">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                {t("إتمام الدفع", "Complete Payment")}
              </h2>
              <button
                onClick={() => setShowPayment(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto bg-gray-50">
              {/* Amount Paid (Cash) */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <label className="text-gray-700 text-sm font-medium">{t("الدفع نقدي", "Cash Payment")}</label>
                </div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("المبلغ المدفوع", "Amount Paid")}</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full h-12 bg-white text-gray-800 text-lg font-semibold rounded-xl px-4 border-2 border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
                {/* Quick amount buttons */}
                <div className="flex gap-2 mt-2">
                  {[
                    Math.ceil(total),
                    Math.ceil(total / 10) * 10,
                    Math.ceil(total / 50) * 50,
                    Math.ceil(total / 100) * 100,
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setAmountPaid(String(amount))}
                        className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-1.5 rounded-lg text-sm transition hover:border-emerald-500"
                      >
                        {amount}
                      </button>
                    ))}
                </div>
              </div>

              {/* Customer Info (Optional) */}
              <div className="space-y-2">
                <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {t("بيانات العميل (اختياري)", "Customer Details (Optional)")}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t("اسم العميل", "Customer name")}
                  className="w-full h-9 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t("رقم الجوال", "Phone number")}
                  className="w-full h-9 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-gray-700 text-sm font-medium flex items-center gap-1 mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  {t("ملاحظات", "Notes")}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("ملاحظات إضافية...", "Additional notes...")}
                  rows={2}
                  className="w-full bg-white text-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 space-y-1.5 border border-gray-200">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>{t("المجموع", "Subtotal")}</span>
                  <span className="font-medium">{subtotal.toFixed(2)} {currencyLabel}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-yellow-600 text-sm">
                    <span>{t("الخصم", "Discount")}</span>
                    <span className="font-medium">-{discountAmount.toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-800 font-bold text-lg border-t border-gray-200 pt-1.5">
                  <span>{t("الإجمالي", "Total")}</span>
                  <span className="text-emerald-600">{total.toFixed(2)} {currencyLabel}</span>
                </div>
                {Number(amountPaid) > 0 && (
                  <div className="flex justify-between text-blue-600 text-sm border-t border-gray-200 pt-1.5">
                    <span>{t("الباقي", "Change")}</span>
                    <span className="font-medium">{change.toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={processSale}
                disabled={
                  processing ||
                  ((Number(amountPaid) || 0) < total)
                }
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white py-3 rounded-xl font-bold text-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("جاري المعالجة...", "Processing...")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    {t("تأكيد الدفع", "Confirm Payment")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Receipt Modal ===== */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" dir={pageDir}>
            {/* Receipt Content */}
            <div className="p-6 text-center" id="receipt">
              <h2 className="font-bold text-xl mb-1">{store.name}</h2>
              {store.address && (
                <p className="text-gray-500 text-xs mb-1">{store.address}</p>
              )}
              {store.phone && (
                <p className="text-gray-500 text-xs mb-3">{store.phone}</p>
              )}
              <div className="border-t border-dashed border-gray-300 my-3" />

              <div className="flex justify-between text-xs text-gray-500 mb-3">
                <span>
                  {new Date(lastSale.created_at).toLocaleDateString(locale)}
                </span>
                <span>#{lastSale.sale_number}</span>
              </div>

              <div className="border-t border-dashed border-gray-300 my-2" />

              {/* Items */}
              <div className="space-y-1.5 text-sm">
                {lastSale.items.map((item: POSSaleItem, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-right flex-1">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold mr-3">
                      {item.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t("المجموع", "Subtotal")}</span>
                  <span>{lastSale.subtotal.toFixed(2)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>{t("الخصم", "Discount")}</span>
                    <span>-{lastSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>{t("الإجمالي", "Total")}</span>
                  <span>{lastSale.total.toFixed(2)} {currencyLabel}</span>
                </div>
                {lastSale.payment_method === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>{t("المدفوع", "Paid")}</span>
                      <span>{lastSale.amount_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>{t("الباقي", "Change")}</span>
                      <span>{lastSale.change.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />

              <p className="text-gray-400 text-xs mb-4">{t("شكراً لتسوقكم معنا", "Thank you for shopping with us")}</p>

              {/* QR Code for invoice */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="bg-white p-3 rounded-xl border-2 border-gray-200 shadow-sm">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/pos/receipt?id=${encodeURIComponent(String(lastSale.id))}`}
                    size={140}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-gray-500 text-[11px]">{t("امسح الكود لعرض الفاتورة", "Scan the code to view the receipt")}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 sm:p-4 border-t flex gap-2">
              <button
                onClick={sendWhatsApp}
                disabled={!canSendReceiptViaWhatsApp}
                className={`flex-1 py-2 sm:py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm ${
                  canSendReceiptViaWhatsApp
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                title={
                  canSendReceiptViaWhatsApp
                    ? t("إرسال عبر واتساب", "Send via WhatsApp")
                    : t(
                        "أدخل رقم هاتف العميل أثناء الدفع لتفعيل إرسال واتساب",
                        "Enter customer phone during payment to enable WhatsApp sending",
                      )
                }
              >
                <MessageCircle className="h-4 w-4" />
                {t("واتساب", "WhatsApp")}
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 sm:py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm"
              >
                <Printer className="h-4 w-4" />
                {t("طباعة", "Print")}
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 sm:py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("تم", "Done")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POS PIN Setup Modal ===== */}
      {showPOSPinSetup && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-gray-800 text-lg font-bold">
                {t("تعيين الرقم السري لـ QPOS", "Set QPOS PIN")}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {t(
                  "هذا الرقم سيُستخدم قبل فتح ملخص اليوم وسجل المبيعات.",
                  "This PIN will be required before opening daily summary and sales history.",
                )}
              </p>
            </div>

            <div className="p-4 space-y-3 bg-gray-50">
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">
                  {t("الرقم السري (4-8 أرقام)", "PIN (4-8 digits)")}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={posPinInput}
                  onChange={(e) => setPosPinInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-11 bg-white text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">
                  {t("تأكيد الرقم السري", "Confirm PIN")}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={posPinConfirmInput}
                  onChange={(e) => setPosPinConfirmInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-11 bg-white text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white flex gap-3">
              <button
                onClick={handleSetupPOSPin}
                disabled={pinLoading}
                className="flex-1 bg-gradient-to-r from-violet-500 to-violet-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pinLoading ? t("جارٍ الحفظ...", "Saving...") : t("حفظ الرقم السري", "Save PIN")}
              </button>
              <button
                onClick={() => router.push("/seller/dashboard")}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("العودة", "Back")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POS PIN Verify Modal ===== */}
      {showPOSPinVerify && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-gray-800 text-lg font-bold">
                {t("تحقق من الرقم السري", "Verify PIN")}
              </h2>
              <button
                onClick={() => {
                  setShowPOSPinVerify(false)
                  setPendingProtectedAction(null)
                  setPosVerifyPinInput("")
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-gray-50">
              <p className="text-gray-600 text-sm">
                {pendingProtectedAction === "history"
                  ? t("أدخل الرقم السري لفتح سجل المبيعات", "Enter PIN to open sales history")
                  : t("أدخل الرقم السري لفتح ملخص اليوم", "Enter PIN to open today's summary")}
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={posVerifyPinInput}
                onChange={(e) => setPosVerifyPinInput(e.target.value.replace(/\D/g, ""))}
                className="w-full h-11 bg-white text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                autoFocus
              />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white flex gap-3">
              <button
                onClick={handleVerifyPOSPin}
                disabled={pinLoading}
                className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pinLoading ? t("جارٍ التحقق...", "Verifying...") : t("تأكيد", "Confirm")}
              </button>
              <button
                onClick={() => {
                  setShowPOSPinVerify(false)
                  setPendingProtectedAction(null)
                  setPosVerifyPinInput("")
                }}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Sales History Modal ===== */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-rose-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-1.5 rounded-lg">
                  <Receipt className="h-4 w-4 text-white" />
                </div>
                {t("سجل المبيعات", "Sales History")}
              </h2>
              <button
                onClick={() => {
                  setShowHistory(false)
                  setHistorySessionPin("")
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleHistoryMonthChange("current")}
                  disabled={historyMonthLoading !== null}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    historyMonth === "current"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  } disabled:opacity-70`}
                >
                  {t("الشهر الحالي", "Current Month")}
                </button>
                <button
                  onClick={() => handleHistoryMonthChange("previous")}
                  disabled={historyMonthLoading !== null}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    historyMonth === "previous"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  } disabled:opacity-70`}
                >
                  {t("الشهر الماضي", "Previous Month")}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {(activeMonthlyHistory?.totalRevenue || 0).toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs font-medium mt-1">
                    {t("إجمالي الإيرادات", "Total Revenue")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                  <p className="text-2xl font-bold text-violet-600">
                    {(activeMonthlyHistory?.netProfit || 0).toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs font-medium mt-1">
                    {t("صافي الربح", "Net Profit")} ({currencyLabel})
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                {activeMonthlyHistory ? (
                  <p className="text-xs text-gray-500 text-center">
                    {new Date(activeMonthlyHistory.startDate).toLocaleDateString(locale)} -{" "}
                    {new Date(activeMonthlyHistory.endDate).toLocaleDateString(locale)}
                  </p>
                ) : (
                  <div />
                )}
                <button
                  onClick={downloadSelectedMonthSalesHistory}
                  disabled={!activeMonthlyHistory || sortedActiveSalesHistory.length === 0 || historyMonthLoading !== null}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("تنزيل السجل", "Download History")}
                </button>
              </div>

              {historyMonthLoading === historyMonth && !activeMonthlyHistory ? (
                <div className="text-center text-gray-500 py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-rose-500 mx-auto mb-3" />
                  <p>{t("جارٍ تحميل سجل الشهر...", "Loading monthly sales...")}</p>
                </div>
              ) : sortedActiveSalesHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-gray-600 font-medium">
                    {historyMonth === "current"
                      ? t("لا توجد مبيعات هذا الشهر", "No sales this month")
                      : t("لا توجد مبيعات الشهر الماضي", "No sales last month")}
                  </p>
                </div>
              ) : (
                <div className="max-h-[42vh] overflow-y-auto space-y-2 pr-1">
                  {sortedActiveSalesHistory.map((sale) => (
                    <div
                      key={sale.id}
                      className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm hover:shadow-md transition"
                    >
                      <div>
                        <p className="text-gray-800 font-bold text-sm">
                          #{sale.sale_number}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(sale.created_at).toLocaleString(locale)}
                        </p>
                        {sale.customer_name && (
                          <p className="text-gray-600 text-xs flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {sale.customer_name}
                          </p>
                        )}
                      </div>
                      <div className="text-end">
                        <p className="text-emerald-600 font-bold">
                          {Number(sale.total).toFixed(2)} {currencyLabel}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {sale.items?.length || 0} {t("منتج", "item")} •{" "}
                          {sale.payment_method === "cash"
                            ? t("نقدي", "Cash")
                            : sale.payment_method === "card"
                            ? t("بطاقة", "Card")
                            : t("محفظة", "Wallet")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Daily Summary Modal ===== */}
      {showSummary && dailySummary && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-violet-500 to-violet-600 p-1.5 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                {t("ملخص اليوم", "Today's Summary")}
              </h2>
              <button
                onClick={() => {
                  setShowSummary(false)
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-600">
                    {dailySummary.totalSales}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{t("عمليات البيع", "Sales")}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-600">
                    {dailySummary.totalRevenue.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">
                    {t("إجمالي الإيرادات", "Total Revenue")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.totalItems}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{t("المنتجات المباعة", "Items Sold")}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.averageOrderValue.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">
                    {t("متوسط الطلب", "Average Order")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-blue-600">
                    {dailySummary.netProfit.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">
                    {t("صافي الربح", "Net Profit")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-amber-600">
                    {dailySummary.cashInTotal.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">
                    {t("المبلغ الداخل نقدًا", "Cash In Today")} ({currencyLabel})
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-gray-800 font-bold mb-3">{t("طرق الدفع", "Payment Methods")}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <Banknote className="h-4 w-4" />
                      {t("نقدي", "Cash")}
                    </span>
                    <span className="text-gray-800 font-bold">{dailySummary.cashSales}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <CreditCard className="h-4 w-4" />
                      {t("بطاقة / محفظة", "Card / Wallet")}
                    </span>
                    <span className="text-gray-800 font-bold">{dailySummary.cardSales}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => {
                  setShowSummary(false)
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl transition"
              >
                {t("إغلاق", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Print-Only Receipt ===== */}
      {lastSale && (
        <div className="hidden print:block p-8 max-w-[80mm] mx-auto">
          <div className="text-center mb-4">
            <h2 className="font-bold text-xl">{store.name}</h2>
            {store.address && <p className="text-xs text-gray-500">{store.address}</p>}
            {store.phone && <p className="text-xs text-gray-500">{store.phone}</p>}
          </div>
          <div className="border-t border-dashed my-2" />
          <div className="flex justify-between text-xs mb-2">
            <span>{new Date(lastSale.created_at).toLocaleDateString(locale)}</span>
            <span>#{lastSale.sale_number}</span>
          </div>
          <div className="border-t border-dashed my-2" />
          {lastSale.items.map((item: POSSaleItem, i: number) => (
            <div key={i} className="flex justify-between text-sm py-0.5">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{item.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-dashed my-2" />
          {lastSale.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span>{t("خصم", "Discount")}</span>
              <span>-{lastSale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg my-1">
            <span>{t("الإجمالي", "Total")}</span>
            <span>{lastSale.total.toFixed(2)} {currencyLabel}</span>
          </div>
          {lastSale.payment_method === "cash" && (
            <>
              <div className="flex justify-between text-sm">
                <span>{t("المدفوع", "Paid")}</span>
                <span>{lastSale.amount_paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t("الباقي", "Change")}</span>
                <span>{lastSale.change.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="border-t border-dashed my-3" />
          <p className="text-center text-xs text-gray-400">{t("شكراً لتسوقكم معنا", "Thank you for shopping with us")}</p>
        </div>
      )}

      {/* ===== Barcode Scanner Modal ===== */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* ===== Edit Product Modal ===== */}
      {showEditProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold">{t("تعديل المنتج", "Edit Product")}</h2>
              <button
                onClick={() => {
                  setShowEditProduct(false)
                  resetEditProductForm()
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("اسم المنتج *", "Product Name *")}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("سعر البيع *", "Selling Price *")}</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("سعر الشراء *", "Cost Price *")}</label>
                  <input
                    type="number"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الفئة *", "Category *")}</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>
                    {t("اختر الفئة", "Select category")}
                  </option>
                  {editCategory && !storeSubcategories.some((sub) => sub.name === editCategory) && (
                    <option value={editCategory}>{editCategory}</option>
                  )}
                  {storeSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الباركود", "Barcode")}</label>
                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSaveEditedProduct}
                disabled={editProductLoading || !editName.trim() || !editPrice || !editCostPrice || !editCategory.trim()}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition"
              >
                {editProductLoading ? t("جاري الحفظ...", "Saving...") : t("حفظ التعديلات", "Save Changes")}
              </button>
              <button
                onClick={() => {
                  setShowEditProduct(false)
                  resetEditProductForm()
                }}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add Stock Modal ===== */}
      {showAddStock && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold">{t("إضافة كمية للمخزون", "Add Stock Quantity")}</h2>
              <button
                onClick={() => {
                  setShowAddStock(false)
                  resetAddStockForm()
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                <p className="text-gray-800 font-semibold truncate">{stockTargetProduct?.name || "-"}</p>
                <p className="text-gray-500 text-sm">
                  {t("المخزون الحالي", "Current Stock")}: <span className="font-bold text-gray-700">{stockTargetProduct?.stock ?? 0}</span>
                </p>
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الكمية المضافة *", "Added Quantity *")}</label>
                <input
                  type="number"
                  value={stockToAdd}
                  onChange={(e) => setStockToAdd(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleAddStockToProduct}
                disabled={addStockLoading || !stockToAdd}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition"
              >
                {addStockLoading ? t("جاري التحديث...", "Updating...") : t("إضافة الكمية", "Add Quantity")}
              </button>
              <button
                onClick={() => {
                  setShowAddStock(false)
                  resetAddStockForm()
                }}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Quick Add Product Modal ===== */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-1.5 rounded-lg">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                {t("إضافة منتج سريع", "Quick Add Product")}
              </h2>
              <button
                onClick={() => {
                  setShowQuickAdd(false)
                  resetQuickAddForm()
                }}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {quickAddBarcode && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-gray-500">{t("الباركود", "Barcode")}</p>
                    <p className="text-emerald-700 font-bold font-mono">{quickAddBarcode}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("اسم المنتج *", "Product Name *")}</label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder={t("مثال: بيبسي 330 مل", "Example: Pepsi 330 ml")}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("سعر البيع *", "Selling Price *")}</label>
                  <input
                    type="number"
                    value={quickAddPrice}
                    onChange={(e) => setQuickAddPrice(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("سعر الشراء *", "Cost Price *")}</label>
                  <input
                    type="number"
                    value={quickAddCostPrice}
                    onChange={(e) => setQuickAddCostPrice(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الكمية", "Quantity")}</label>
                  <input
                    type="number"
                    value={quickAddStock}
                    onChange={(e) => setQuickAddStock(e.target.value)}
                    placeholder="1"
                    min="1"
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الفئة *", "Category *")}</label>
                <select
                  value={quickAddCategory}
                  onChange={(e) => setQuickAddCategory(e.target.value)}
                  required
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>{t("اختر الفئة", "Select category")}</option>
                  {storeSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("صورة المنتج (اختياري)", "Product Image (Optional)")}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openQuickAddUploadDialog}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                  >
                    <Camera className="h-4 w-4" />
                    {t("رفع/التقاط صورة", "Upload/Capture Image")}
                  </button>
                  {quickAddImagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAddImageFile(null)
                        setQuickAddImagePreview(null)
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                    >
                      <X className="h-4 w-4" />
                      {t("إزالة الصورة", "Remove Image")}
                    </button>
                  )}
                </div>
                {quickAddImagePreview ? (
                  <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <img
                      src={quickAddImagePreview}
                      alt={t("معاينة صورة المنتج", "Product image preview")}
                      className="w-full h-40 object-cover"
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    {t("يمكنك رفع صورة من الجهاز أو التقاط صورة بالكاميرا", "You can upload from device or capture using camera")}
                  </p>
                )}
              </div>

              {!quickAddBarcode && (
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الباركود (اختياري)", "Barcode (Optional)")}</label>
                  <input
                    type="text"
                    value={quickAddBarcode}
                    onChange={(e) => setQuickAddBarcode(e.target.value)}
                    placeholder={t("رقم الباركود", "Barcode number")}
                    className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleQuickAddProduct}
                disabled={quickAddLoading || !quickAddName.trim() || !quickAddPrice || !quickAddCostPrice || !quickAddCategory.trim()}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2"
              >
                {quickAddLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {t("جاري الإضافة...", "Adding...")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t("إضافة وإضافة للسلة", "Add and add to cart")}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowQuickAdd(false)
                  resetQuickAddForm()
                }}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadDialog
        t={t}
        open={quickAddUploadDialogOpen}
        onOpenChange={setQuickAddUploadDialogOpen}
        fileInputRef={quickAddFileInputRef}
        cameraInputRef={quickAddCameraInputRef}
        onFileChange={handleQuickAddFileInputChange}
      />
    </div>
  )
}
