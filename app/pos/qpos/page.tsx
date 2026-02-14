"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuth } from "@/lib/auth-context"
import { getPOSProducts, createPOSSale, getPOSSales, getPOSDailySummary, createPOSQuickProduct, type POSSaleItem } from "@/lib/actions/pos"
import { getStoreByUserId } from "@/lib/actions/stores"
import { useLanguage } from "@/lib/language-context"
import { logError } from "@/lib/logger"
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Receipt, DollarSign,
  BarChart3, Printer, Package, ChevronLeft,
  CreditCard, Banknote, Wallet, AlertTriangle, CheckCircle2, Clock,
  User, StickyNote, Tag, Grid3X3, Store, MessageCircle, Camera, ScanLine
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
}

type StoreData = {
  id: string
  name: string
  address?: string
  phone?: string
  logo_url?: string
  is_approved?: boolean
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
  POS_QUICK_PRODUCT_STOCK_INVALID: { ar: "الكمية يجب أن تكون أكبر من صفر", en: "Stock must be greater than zero" },
  POS_STORE_NOT_APPROVED: {
    ar: "متجرك غير معتمد بعد. لا يمكنك إضافة منتجات جديدة حتى يتم اعتماد متجرك من قبل الإدارة.",
    en: "Your store is not approved yet. You cannot add new products until your store is approved by the administration.",
  },
  POS_DUPLICATE_BARCODE: { ar: "يوجد منتج بنفس الباركود", en: "A product with this barcode already exists" },
  POS_CREATE_QUICK_PRODUCT_FAILED: { ar: "فشل في إضافة المنتج", en: "Failed to add product" },
  POS_LOAD_SALES_HISTORY_FAILED: { ar: "حدث خطأ أثناء تحميل سجل المبيعات", en: "Failed to load sales history" },
  POS_LOAD_DAILY_SUMMARY_FAILED: { ar: "حدث خطأ أثناء تحميل ملخص اليوم", en: "Failed to load daily summary" },
}

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
  const [salesHistory, setSalesHistory] = useState<Sale[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddBarcode, setQuickAddBarcode] = useState("")
  const [quickAddName, setQuickAddName] = useState("")
  const [quickAddPrice, setQuickAddPrice] = useState("")
  const [quickAddStock, setQuickAddStock] = useState("1")
  const [quickAddCategory, setQuickAddCategory] = useState("")
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [showMobileCart, setShowMobileCart] = useState(false)
  const isStoreApproved = store?.is_approved === true
  const searchRef = useRef<HTMLInputElement>(null)
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

        const productsData = await getPOSProducts(storeData.id, user!.id)
        setProducts(productsData as Product[])
      } catch (err) {
        logError("[POS] Error loading data:", err)
        setError(t("فشل في تحميل البيانات", "Failed to load data"))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, router, t])

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
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart]
  )

  const discountAmount = useMemo(() => {
    const d = Number(discount) || 0
    if (discountType === "percentage") {
      return (subtotal * d) / 100
    }
    return d
  }, [subtotal, discount, discountType])

  const total = useMemo(
    () => Math.max(0, subtotal - discountAmount),
    [subtotal, discountAmount]
  )

  const change = useMemo(() => {
    const paid = Number(amountPaid) || 0
    return Math.max(0, paid - total)
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
        discount: discountAmount,
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

  const loadHistory = async () => {
    if (!store) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }
    setLoadingHistory(true)
    setError("")
    try {
      const history = await getPOSSales(store.id, 50, user!.id)
      setSalesHistory(history as Sale[])
      setShowHistory(true)
      if (history.length === 0) {
        setSuccess(t("لا توجد مبيعات مسجلة بعد", "No sales recorded yet"))
      }
    } catch (err: unknown) {
      logError("[POS] Error loading history:", err)
      const errorMsg = getErrorMessage(
        err,
        t("حدث خطأ أثناء تحميل سجل المبيعات", "An error occurred while loading sales history"),
      )
      setError(errorMsg)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadDailySummary = async () => {
    if (!store) {
      setError(t("لم يتم العثور على بيانات المتجر", "Store data was not found"))
      return
    }
    setLoadingSummary(true)
    setError("")
    try {
      const summary = await getPOSDailySummary(store.id, undefined, user!.id)
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

  // ===================== Print Receipt =====================

  const printReceipt = () => {
    window.print()
  }

  // ===================== Send WhatsApp =====================

  const sendWhatsApp = () => {
    if (!lastSale) return
    
    // Format receipt message
    let message = `🧾 *${store.name}*\n`
    if (store.address) message += `📍 ${store.address}\n`
    if (store.phone) message += `📞 ${store.phone}\n`
    message += `\n━━━━━━━━━━━━━━━━\n\n`
    message += `📅 ${new Date(lastSale.created_at).toLocaleDateString(locale)}\n`
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
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
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
      setQuickAddBarcode(code)
      setShowQuickAdd(true)
      setError(`${t("لا يوجد منتج بالباركود", "No product found with barcode")}: ${code}`)
      setTimeout(() => setError(""), 3000)
    }
  }

  // ===================== Quick Add Product =====================

  const handleQuickAddProduct = async () => {
    if (!quickAddName.trim() || !quickAddPrice || Number(quickAddPrice) <= 0) {
      setError(t("يرجى إدخال اسم المنتج والسعر", "Please enter product name and price"))
      return
    }

    setQuickAddLoading(true)
    setError("")

    try {
      const result = await createPOSQuickProduct({
        name: quickAddName.trim(),
        price: Number(quickAddPrice),
        stock: Number(quickAddStock) || 1,
        category: quickAddCategory.trim() || t("عام", "General"),
        barcode: quickAddBarcode.trim() || undefined,
        store_id: store.id,
      }, user!.id)

      if (result.success && result.data) {
        const newProduct = result.data as Product
        setProducts((prev) => [...prev, newProduct])
        addToCart(newProduct)
        setSuccess(`${t("تم إضافة", "Added")} "${newProduct.name}" ${t("وإضافته للسلة", "and added to cart")}`)
        setTimeout(() => setSuccess(""), 3000)
        setShowQuickAdd(false)
        setQuickAddBarcode("")
        setQuickAddName("")
        setQuickAddPrice("")
        setQuickAddStock("1")
        setQuickAddCategory("")
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
        setShowScanner(false)
        setShowQuickAdd(false)
      }
      // F4 = Clear cart
      if (e.key === "F4") {
        e.preventDefault()
        clearCart()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [cart, showPayment, clearCart])

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
            onClick={loadDailySummary}
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
            onClick={loadHistory}
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
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
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
                    <button
                      key={product.id}
                      onClick={() => !outOfStock && addToCart(product)}
                      disabled={outOfStock}
                      className={`relative bg-white rounded-xl p-2 text-right transition-all hover:shadow-lg group ${
                        outOfStock
                          ? "opacity-50 cursor-not-allowed"
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

                      {/* In Cart Badge */}
                      {inCart && (
                        <div className="absolute top-1 left-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                          {inCart.quantity}
                        </div>
                      )}

                      {/* Out of Stock */}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-gray-900/70 rounded-xl flex items-center justify-center">
                          <span className="text-red-500 text-xs font-bold bg-white px-2 py-1 rounded-lg shadow-lg">
                            {t("نفذ المخزون", "Out of stock")}
                          </span>
                        </div>
                      )}
                    </button>
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
              {/* Payment Method */}
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-2">{t("طريقة الدفع", "Payment Method")}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "cash" as const, label: t("نقدي", "Cash"), icon: Banknote },
                    { value: "card" as const, label: t("بطاقة", "Card"), icon: CreditCard },
                    { value: "wallet" as const, label: t("محفظة", "Wallet"), icon: Wallet },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === value
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg scale-105"
                          : "bg-white text-gray-600 hover:bg-gray-100 shadow-sm"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Paid (cash only) */}
              {paymentMethod === "cash" && (
                <div>
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
              )}

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
                {paymentMethod === "cash" && Number(amountPaid) > 0 && (
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
                  (paymentMethod === "cash" && (Number(amountPaid) || 0) < total)
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
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 sm:py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm"
                title={t("إرسال عبر واتساب", "Send via WhatsApp")}
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
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {salesHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-gray-600 font-medium">{t("لا توجد مبيعات بعد", "No sales yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {salesHistory.map((sale) => (
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
                onClick={() => setShowSummary(false)}
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
                    {dailySummary.totalRevenue.toFixed(0)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{t("إجمالي الإيرادات", "Total Revenue")}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.totalItems}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{t("المنتجات المباعة", "Items Sold")}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.averageOrderValue.toFixed(0)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">{t("متوسط الطلب", "Average Order")}</p>
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
                onClick={() => setShowSummary(false)}
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

      {/* ===== Quick Add Product Modal ===== */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir={pageDir}>
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
                  setQuickAddBarcode("")
                  setQuickAddName("")
                  setQuickAddPrice("")
                  setQuickAddStock("1")
                  setQuickAddCategory("")
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("السعر *", "Price *")}</label>
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
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("القسم", "Category")}</label>
                <select
                  value={quickAddCategory}
                  onChange={(e) => setQuickAddCategory(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t("عام", "General")}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
                disabled={quickAddLoading || !quickAddName.trim() || !quickAddPrice}
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
                  setQuickAddBarcode("")
                  setQuickAddName("")
                  setQuickAddPrice("")
                  setQuickAddStock("1")
                  setQuickAddCategory("")
                }}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition"
              >
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
