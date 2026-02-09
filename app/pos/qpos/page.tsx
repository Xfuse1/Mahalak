"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getPOSProducts, createPOSSale, getPOSSales, getPOSDailySummary, type POSSaleItem } from "@/lib/actions/pos"
import { getStoreByUserId } from "@/lib/actions/stores"
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Receipt, DollarSign,
  BarChart3, Printer, Package, ChevronLeft,
  CreditCard, Banknote, Wallet, AlertTriangle, CheckCircle2, Clock,
  User, StickyNote, Tag, Grid3X3, Store, MessageCircle
} from "lucide-react"

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

// ===================== Main Component =====================

export default function QPOSPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [store, setStore] = useState<any>(null)
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
  const [lastSale, setLastSale] = useState<any>(null)
  const [salesHistory, setSalesHistory] = useState<Sale[]>([])
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [processing, setProcessing] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

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

        const productsData = await getPOSProducts(storeData.id)
        setProducts(productsData as Product[])
      } catch (err) {
        console.error("[POS] Error loading data:", err)
        setError("فشل في تحميل البيانات")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, router])

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
            setError(`لا يوجد مخزون كافي من "${product.name}"`)
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
          setError(`المنتج "${product.name}" غير متوفر`)
          return prev
        }
        return [
          ...prev,
          { ...product, quantity: 1, total: product.price },
        ]
      })
    },
    []
  )

  const updateQuantity = useCallback(
    (productId: string, newQty: number) => {
      if (newQty <= 0) {
        removeFromCart(productId)
        return
      }
      const product = products.find((p) => p.id === productId)
      if (product && newQty > product.stock) {
        setError(`لا يوجد مخزون كافي من "${product.name}"`)
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
    [products]
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
      setError("المبلغ المدفوع أقل من الإجمالي")
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
      })

      if (result.success) {
        setLastSale(result.data)
        setShowPayment(false)
        setShowReceipt(true)
        setSuccess("تمت عملية البيع بنجاح!")

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
        setError(result.error || "فشل في إتمام عملية البيع")
      }
    } catch (err: any) {
      setError(err?.message || "حدث خطأ غير متوقع")
    } finally {
      setProcessing(false)
    }
  }

  // ===================== Load History =====================

  const loadHistory = async () => {
    if (!store) {
      setError("لم يتم العثور على بيانات المتجر")
      return
    }
    setLoadingHistory(true)
    setError("")
    try {
      const history = await getPOSSales(store.id, 50)
      setSalesHistory(history as Sale[])
      setShowHistory(true)
      if (history.length === 0) {
        setSuccess("لا توجد مبيعات مسجلة بعد")
      }
    } catch (err: any) {
      console.error("[POS] Error loading history:", err)
      const errorMsg = err?.message || "حدث خطأ أثناء تحميل سجل المبيعات"
      setError(errorMsg)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadDailySummary = async () => {
    if (!store) {
      setError("لم يتم العثور على بيانات المتجر")
      return
    }
    setLoadingSummary(true)
    setError("")
    try {
      const summary = await getPOSDailySummary(store.id)
      setDailySummary(summary)
      setShowSummary(true)
      if (summary.totalSales === 0) {
        setSuccess("لا توجد مبيعات لهذا اليوم")
      }
    } catch (err: any) {
      console.error("[POS] Error loading summary:", err)
      const errorMsg = err?.message || "حدث خطأ أثناء تحميل ملخص اليوم"
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
    message += `📅 ${new Date(lastSale.created_at).toLocaleDateString("ar-SA")}\n`
    message += `🔢 رقم الفاتورة: #${lastSale.sale_number}\n\n`
    message += `📦 *المنتجات:*\n`
    
    lastSale.items.forEach((item: any) => {
      message += `• ${item.name} × ${item.quantity} = ${item.total.toFixed(2)} ر.س\n`
    })
    
    message += `\n━━━━━━━━━━━━━━━━\n\n`
    message += `المجموع: ${lastSale.subtotal.toFixed(2)} ر.س\n`
    
    if (lastSale.discount > 0) {
      message += `الخصم: -${lastSale.discount.toFixed(2)} ر.س\n`
    }
    
    message += `\n💰 *الإجمالي: ${lastSale.total.toFixed(2)} ر.س*\n\n`
    
    if (lastSale.payment_method === "cash") {
      message += `المدفوع: ${lastSale.amount_paid.toFixed(2)} ر.س\n`
      message += `الباقي: ${lastSale.change.toFixed(2)} ر.س\n\n`
    }
    
    message += `🙏 شكراً لتسوقكم معنا`
    
    // Open WhatsApp with message
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, "_blank")
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
          <p className="text-gray-600 text-lg font-medium">جاري تحميل نظام الكاشير...</p>
        </div>
      </div>
    )
  }

  if (!user || !store) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <p className="text-xl mb-4 text-gray-800 font-bold">لا يمكن الوصول لنظام الكاشير</p>
          <button
            onClick={() => router.push("/seller/dashboard")}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all font-medium"
          >
            العودة للوحة التحكم
          </button>
        </div>
      </div>
    )
  }

  // ===================== Render =====================

  return (
    <div className="h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col overflow-hidden print:bg-white" dir="rtl">
      {/* ===== Top Bar ===== */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/seller/dashboard")}
            className="text-gray-500 hover:text-emerald-600 transition p-1.5 hover:bg-gray-100 rounded-lg"
            title="العودة للوحة التحكم"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-10 h-10 rounded-lg object-cover shadow-sm border border-gray-200"
              />
            ) : (
              <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 p-2 rounded-lg shadow-sm">
                <Store className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-gray-800 font-bold text-lg leading-tight">{store.name}</h1>
              <span className="text-gray-500 text-xs">نظام الكاشير</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDailySummary}
            disabled={loadingSummary}
            className="flex items-center gap-2 text-sm font-medium bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:shadow-xl hover:shadow-violet-500/30 px-4 py-2.5 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loadingSummary ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>جاري التحميل...</span>
              </>
            ) : (
              <>
                <BarChart3 className="h-5 w-5" />
                <span>ملخص اليوم</span>
              </>
            )}
          </button>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="flex items-center gap-2 text-sm font-medium bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:shadow-xl hover:shadow-rose-500/30 px-4 py-2.5 rounded-xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loadingHistory ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>جاري التحميل...</span>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5" />
                <span>سجل المبيعات</span>
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
            إغلاق
          </button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/90 text-white px-4 py-2 text-center text-sm font-medium print:hidden">
          <CheckCircle2 className="inline-block h-4 w-4 ml-1" />
          {success}
        </div>
      )}

      {/* ===== Main Layout ===== */}
      <div className="flex-1 flex overflow-hidden print:hidden">
        {/* ===== Left: Cart Panel ===== */}
        <div className="w-[380px] bg-white flex flex-col border-l border-gray-200 shadow-lg">
          {/* Cart Header */}
          <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-1.5 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <span className="text-gray-800 font-bold">
                السلة ({cartItemsCount})
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                مسح الكل
              </button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-gray-600 font-medium">السلة فارغة</p>
                <p className="text-xs mt-1">اضغط على المنتج لإضافته</p>
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
                      {item.price.toFixed(2)} ر.س
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
                  <div className="text-left w-16 flex-shrink-0">
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
                <span className="text-gray-600 text-xs font-medium">خصم:</span>
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
                  <option value="fixed">ر.س</option>
                  <option value="percentage">%</option>
                </select>
              </div>
            </div>
          )}

          {/* Cart Totals */}
          <div className="p-3 border-t border-gray-200 space-y-1.5 bg-white">
            <div className="flex justify-between text-gray-600 text-sm">
              <span>المجموع الفرعي</span>
              <span className="font-medium">{subtotal.toFixed(2)} ر.س</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-yellow-600 text-sm">
                <span>الخصم</span>
                <span className="font-medium">-{discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}
            <div className="flex justify-between text-gray-800 text-lg font-bold pt-2 border-t border-gray-200">
              <span>الإجمالي</span>
              <span className="text-emerald-600">{total.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Pay Button */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <button
              onClick={() => cart.length > 0 && setShowPayment(true)}
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white py-3 rounded-xl font-bold text-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <DollarSign className="h-5 w-5" />
              دفع (F9)
            </button>
          </div>
        </div>

        {/* ===== Right: Products Panel ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Filters */}
          <div className="p-3 bg-white border-b border-gray-200 space-y-2 shadow-sm">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الباركود... (F2)"
                className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl pr-11 pl-4 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
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
                الكل
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
                <p className="text-lg text-gray-600 font-medium">لا توجد منتجات</p>
                {searchQuery && (
                  <p className="text-sm mt-1 text-gray-500">
                    لم يتم العثور على نتائج لـ &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
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
                            نفذ المخزون
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir="rtl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-1.5 rounded-lg">
                  <DollarSign className="h-4 w-4 text-white" />
                </div>
                إتمام الدفع
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
                <label className="text-gray-700 text-sm font-medium block mb-2">طريقة الدفع</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "cash" as const, label: "نقدي", icon: Banknote },
                    { value: "card" as const, label: "بطاقة", icon: CreditCard },
                    { value: "wallet" as const, label: "محفظة", icon: Wallet },
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
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">المبلغ المدفوع</label>
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
                  بيانات العميل (اختياري)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل"
                  className="w-full h-9 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="رقم الجوال"
                  className="w-full h-9 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-gray-700 text-sm font-medium flex items-center gap-1 mb-1">
                  <StickyNote className="h-3.5 w-3.5" />
                  ملاحظات
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية..."
                  rows={2}
                  className="w-full bg-white text-gray-800 rounded-lg px-3 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 space-y-1.5 border border-gray-200">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>المجموع</span>
                  <span className="font-medium">{subtotal.toFixed(2)} ر.س</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-yellow-600 text-sm">
                    <span>الخصم</span>
                    <span className="font-medium">-{discountAmount.toFixed(2)} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-800 font-bold text-lg border-t border-gray-200 pt-1.5">
                  <span>الإجمالي</span>
                  <span className="text-emerald-600">{total.toFixed(2)} ر.س</span>
                </div>
                {paymentMethod === "cash" && Number(amountPaid) > 0 && (
                  <div className="flex justify-between text-blue-600 text-sm border-t border-gray-200 pt-1.5">
                    <span>الباقي</span>
                    <span className="font-medium">{change.toFixed(2)} ر.س</span>
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
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    تأكيد الدفع
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
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" dir="rtl">
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
                  {new Date(lastSale.created_at).toLocaleDateString("ar-SA")}
                </span>
                <span>#{lastSale.sale_number}</span>
              </div>

              <div className="border-t border-dashed border-gray-300 my-2" />

              {/* Items */}
              <div className="space-y-1.5 text-sm">
                {lastSale.items.map((item: any, i: number) => (
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
                  <span>المجموع</span>
                  <span>{lastSale.subtotal.toFixed(2)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>الخصم</span>
                    <span>-{lastSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>الإجمالي</span>
                  <span>{lastSale.total.toFixed(2)} ر.س</span>
                </div>
                {lastSale.payment_method === "cash" && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>المدفوع</span>
                      <span>{lastSale.amount_paid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>الباقي</span>
                      <span>{lastSale.change.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-dashed border-gray-300 my-3" />

              <p className="text-gray-400 text-xs">شكراً لتسوقكم معنا</p>
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={sendWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition"
                title="إرسال عبر واتساب"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                تم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Sales History Modal ===== */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" dir="rtl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-rose-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-rose-500 to-rose-600 p-1.5 rounded-lg">
                  <Receipt className="h-4 w-4 text-white" />
                </div>
                سجل المبيعات
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
                  <p className="text-gray-600 font-medium">لا توجد مبيعات بعد</p>
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
                          {new Date(sale.created_at).toLocaleString("ar-SA")}
                        </p>
                        {sale.customer_name && (
                          <p className="text-gray-600 text-xs flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {sale.customer_name}
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-emerald-600 font-bold">
                          {Number(sale.total).toFixed(2)} ر.س
                        </p>
                        <p className="text-gray-500 text-xs">
                          {sale.items?.length || 0} منتج •{" "}
                          {sale.payment_method === "cash"
                            ? "نقدي"
                            : sale.payment_method === "card"
                            ? "بطاقة"
                            : "محفظة"}
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir="rtl">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-white">
              <h2 className="text-gray-800 text-lg font-bold flex items-center gap-2">
                <div className="bg-gradient-to-r from-violet-500 to-violet-600 p-1.5 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                ملخص اليوم
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
                  <p className="text-gray-600 text-sm mt-1 font-medium">عمليات البيع</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-emerald-600">
                    {dailySummary.totalRevenue.toFixed(0)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">إجمالي الإيرادات</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.totalItems}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">المنتجات المباعة</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                  <p className="text-3xl font-bold text-violet-600">
                    {dailySummary.averageOrderValue.toFixed(0)}
                  </p>
                  <p className="text-gray-600 text-sm mt-1 font-medium">متوسط الطلب</p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="text-gray-800 font-bold mb-3">طرق الدفع</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <Banknote className="h-4 w-4" />
                      نقدي
                    </span>
                    <span className="text-gray-800 font-bold">{dailySummary.cashSales}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <CreditCard className="h-4 w-4" />
                      بطاقة / محفظة
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
                إغلاق
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
            <span>{new Date(lastSale.created_at).toLocaleDateString("ar-SA")}</span>
            <span>#{lastSale.sale_number}</span>
          </div>
          <div className="border-t border-dashed my-2" />
          {lastSale.items.map((item: any, i: number) => (
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
              <span>خصم</span>
              <span>-{lastSale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg my-1">
            <span>الإجمالي</span>
            <span>{lastSale.total.toFixed(2)} ر.س</span>
          </div>
          {lastSale.payment_method === "cash" && (
            <>
              <div className="flex justify-between text-sm">
                <span>المدفوع</span>
                <span>{lastSale.amount_paid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>الباقي</span>
                <span>{lastSale.change.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="border-t border-dashed my-3" />
          <p className="text-center text-xs text-gray-400">شكراً لتسوقكم معنا</p>
        </div>
      )}
    </div>
  )
}
