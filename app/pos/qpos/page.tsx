"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
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
import {
  holdCart,
  getHeldCarts,
  deleteHeldCart,
  createOrUpdatePOSCustomer,
  searchPOSCustomers,
  updateCustomerAfterSale,
  getSaleForReturn,
  createPOSReturn,
  openShift,
  closeShift,
  getCurrentShift,
  validatePOSCoupon,
  redeemPOSCoupon,
  type HeldCart,
  type HeldCartItem,
  type POSCustomer,
  type POSReturn,
  type POSReturnItem,
  type POSShift,
  type SplitPaymentEntry,
} from "@/lib/actions/pos-features"
import {
  getExpiryAlerts,
  updateProductPharmacyFields,
  savePrescriptionRecord,
  searchPrescriptions,
  addInsuranceCompany,
  getInsuranceCompanies,
  toggleInsuranceCompany,
  createInsuranceClaim,
  getInsuranceClaims,
  updateClaimStatus,
  findDrugAlternatives,
  batchCheckExpiry,
  checkDrugInteractions,
  updateProductInteractionGroup,
  updateProductUnits,
  createOrUpdatePatient,
  searchPatients,
  getPatientByPhone,
  recordPatientMedication,
  getPatientMedications,
  checkPatientAllergies,
  generateDrugLabel,
  getBatchInventory,
  getFEFOProducts,
  getEnhancedPharmacyData,
  type ExpiryAlert,
  type PrescriptionRecord,
  type PrescriptionItem,
  type InsuranceCompany,
  type InsuranceClaim,
  type DrugAlternative,
  type PatientFile,
  type PatientMedication,
  type BatchInventoryItem,
  type DrugLabel,
  type ProductUnit,
} from "@/lib/actions/pos-pharmacy"

// Local synchronous helper (not a server action) for calculating product units
function calculateProductUnitsLocal(
  totalPieces: number,
  piecePerStrip?: number,
  stripPerBox?: number,
  boxPerCarton?: number
): { type: string; count: number; unit: string }[] {
  const results: { type: string; count: number; unit: string }[] = []
  let remaining = totalPieces

  if (piecePerStrip && piecePerStrip > 1 && stripPerBox && stripPerBox > 1 && boxPerCarton && boxPerCarton > 1) {
    const piecesPerCarton = piecePerStrip * stripPerBox * boxPerCarton
    const cartons = Math.floor(remaining / piecesPerCarton)
    if (cartons > 0) { results.push({ type: "carton", count: cartons, unit: "كرتونة" }); remaining -= cartons * piecesPerCarton }
  }

  if (piecePerStrip && piecePerStrip > 1 && stripPerBox && stripPerBox > 1) {
    const piecesPerBox = piecePerStrip * stripPerBox
    const boxes = Math.floor(remaining / piecesPerBox)
    if (boxes > 0) { results.push({ type: "box", count: boxes, unit: "علبة" }); remaining -= boxes * piecesPerBox }
  }

  if (piecePerStrip && piecePerStrip > 1) {
    const strips = Math.floor(remaining / piecePerStrip)
    if (strips > 0) { results.push({ type: "strip", count: strips, unit: "شريط" }); remaining -= strips * piecePerStrip }
  }

  if (remaining > 0) {
    results.push({ type: "piece", count: remaining, unit: "قطعة" })
  }

  return results
}

import {
  saveProductVariants,
  getProductVariants,
  updateVariantStock,
  getLoyaltyConfig,
  saveLoyaltyConfig,
  getLoyaltyCustomer,
  createLoyaltyCustomer,
  updateLoyaltyAfterSale,
  updateCustomerNotes,
  createInstallment,
  getInstallments,
  payInstallment,
  getSeasons,
  createSeason,
  toggleSeason,
  getActiveSeasonDiscount,
  getSuppliers,
  addSupplier,
  linkSupplierToProduct,
  getProductSuppliers,
  getSupplierProductCounts,
  createGiftCard,
  getGiftCards,
  validateGiftCard,
  redeemGiftCard,
  createReservation,
  getReservations,
  updateReservationStatus,
  getInvoiceDiscountRules,
  saveInvoiceDiscountRules,
  generatePriceTagData,
  type ProductVariant,
  type LoyaltyCustomer,
  type LoyaltyConfig,
  type LoyaltyTier,
  type Installment,
  type Season,
  type Supplier,
  type GiftCard,
  type ProductReservation,
  type InvoiceDiscount,
} from "@/lib/actions/pos-clothing"
import {
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  getTierPricing,
  saveTierPricing,
  getPaymentConfig,
  savePaymentConfig,
  getIncomingOnlineOrders,
  updateOnlineOrderStatus,
  confirmOnlinePayment,
  getLowStockProducts,
  createOnlineReturn,
  getOnlineReturns,
  updateOnlineReturnStatus,
  getOnlineSalesReport,
  type ShippingZone,
  type TierPricing,
  type PaymentMethodConfig,
  type OnlineOrderForPOS,
  type OnlineReturn,
  type OnlineSalesReport,
} from "@/lib/actions/pos-online"
import { uploadProductImage, updateProduct } from "@/lib/actions/products"
import { getStoreByUserId, getCategoryNameById } from "@/lib/actions/stores"
import { fetchStoreSubcategories, fetchSubcategoriesByKeywords, fetchSubcategoriesByCategoryId, type SubcategoryItem } from "@/lib/firebase/categories"
import { useLanguage } from "@/lib/language-context"
import { logError } from "@/lib/logger"
import { UploadDialog } from "@/components/auth/upload-dialog"
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Receipt, DollarSign,
  BarChart3, Printer, Package, ChevronLeft,
  CreditCard, Banknote, Wallet, AlertTriangle, CheckCircle2, Clock,
  User, StickyNote, Tag, Grid3X3, Store, MessageCircle, Camera, ScanLine, Download,
  PauseCircle, PlayCircle, RotateCcw, Users, Ticket, ArrowLeftRight, LogIn, LogOut,
  UserPlus, History, Split, Bookmark, Pill, CalendarClock, Shield, FileText,
  Stethoscope, FlaskConical, AlertOctagon, Building2, RefreshCw,
  Palette, Ruler, Crown, CircleDollarSign, Snowflake, Sun, Truck, Gift, BookmarkCheck,
  PercentCircle, StickyNote as NoteIcon, QrCode, Star, Medal, Award,
  Globe, MapPin, ShoppingBag, Bell, TrendingUp, Undo2, Smartphone, Eye
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import POSBottomBar from "./_components/pos-bottom-bar"
import POSMobileActionsSheet from "./_components/pos-mobile-actions-sheet"
import POSProductContextMenu from "./_components/pos-product-context-menu"

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
  unit_multiplier?: number  // How many pieces this unit represents (e.g. 10 for strip, 30 for box)
  unit_label?: string       // Display label (e.g. "شريط", "علبة")
  unit_price?: number       // Price per unit (price * multiplier)
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
  installmentTotal?: number
  installmentCount?: number
  installmentDownPayments?: number
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
  // --- New Feature Errors ---
  POS_FEATURE_UNAUTHORIZED: { ar: "ليس لديك صلاحية", en: "Unauthorized" },
  POS_HOLD_CART_FAILED: { ar: "فشل في حفظ السلة المعلقة", en: "Failed to hold cart" },
  POS_HOLD_CART_EMPTY: { ar: "السلة فارغة", en: "Cart is empty" },
  POS_HOLD_CART_NOT_FOUND: { ar: "السلة المعلقة غير موجودة", en: "Held cart not found" },
  POS_HOLD_CART_LIMIT_REACHED: { ar: "تم الوصول للحد الأقصى (10 سلات)", en: "Maximum held carts reached (10)" },
  POS_CUSTOMER_NOT_FOUND: { ar: "العميل غير موجود", en: "Customer not found" },
  POS_CUSTOMER_NAME_REQUIRED: { ar: "اسم العميل مطلوب", en: "Customer name is required" },
  POS_CUSTOMER_SAVE_FAILED: { ar: "فشل حفظ بيانات العميل", en: "Failed to save customer" },
  POS_CUSTOMER_LOAD_FAILED: { ar: "فشل تحميل بيانات العملاء", en: "Failed to load customers" },
  POS_RETURN_SALE_NOT_FOUND: { ar: "الفاتورة غير موجودة", en: "Sale not found" },
  POS_RETURN_INVALID_ITEMS: { ar: "لا توجد منتجات للإرجاع", en: "No items to return" },
  POS_RETURN_FAILED: { ar: "فشل عملية الإرجاع", en: "Return failed" },
  POS_SHIFT_ALREADY_OPEN: { ar: "يوجد وردية مفتوحة بالفعل", en: "A shift is already open" },
  POS_SHIFT_NOT_OPEN: { ar: "لا توجد وردية مفتوحة", en: "No open shift found" },
  POS_SHIFT_FAILED: { ar: "فشل في إدارة الوردية", en: "Shift operation failed" },
  POS_COUPON_NOT_FOUND: { ar: "كود الخصم غير موجود", en: "Coupon not found" },
  POS_COUPON_EXPIRED: { ar: "كود الخصم منتهي الصلاحية", en: "Coupon has expired" },
  POS_COUPON_MAX_USES_REACHED: { ar: "كود الخصم وصل للحد الأقصى", en: "Coupon max uses reached" },
  POS_COUPON_MIN_ORDER_NOT_MET: { ar: "قيمة الطلب أقل من الحد الأدنى", en: "Order below minimum" },
  POS_COUPON_INACTIVE: { ar: "كود الخصم غير مفعل", en: "Coupon is inactive" },
  POS_COUPON_CODE_EXISTS: { ar: "كود الخصم موجود بالفعل", en: "Coupon code already exists" },
  POS_COUPON_SAVE_FAILED: { ar: "فشل حفظ كود الخصم", en: "Failed to save coupon" },
  POS_COUPON_LOAD_FAILED: { ar: "فشل تحميل كود الخصم", en: "Failed to load coupon" },
  // --- Pharmacy Errors ---
  PHARM_PRODUCT_NOT_FOUND: { ar: "المنتج غير موجود", en: "Product not found" },
  PHARM_PRODUCT_EXPIRED: { ar: "هذا المنتج منتهي الصلاحية ولا يمكن بيعه", en: "This product is expired and cannot be sold" },
  PHARM_PRESCRIPTION_REQUIRED: { ar: "هذا المنتج يحتاج وصفة طبية", en: "This product requires a prescription" },
  PHARM_INSURANCE_NOT_FOUND: { ar: "شركة التأمين غير موجودة", en: "Insurance company not found" },
  PHARM_INSURANCE_COMPANY_EXISTS: { ar: "شركة التأمين موجودة بالفعل", en: "Insurance company already exists" },
  PHARM_CLAIM_NOT_FOUND: { ar: "المطالبة غير موجودة", en: "Claim not found" },
  PHARM_NO_ALTERNATIVES: { ar: "لا توجد بدائل متاحة", en: "No alternatives available" },
  PHARM_UNAUTHORIZED: { ar: "ليس لديك صلاحية", en: "Unauthorized" },
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
  // --- New Feature States ---
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [holdCartLabel, setHoldCartLabel] = useState("")
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<POSCustomer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerEmail, setNewCustomerEmail] = useState("")
  const [newCustomerNotes, setNewCustomerNotes] = useState("")
  const [showReturn, setShowReturn] = useState(false)
  const [returnSaleId, setReturnSaleId] = useState("")
  const [returnSaleData, setReturnSaleData] = useState<any>(null)
  const [returnItems, setReturnItems] = useState<{product_id: string; name: string; price: number; quantity: number; maxQty: number}[]>([])
  const [returnType, setReturnType] = useState<"refund" | "exchange">("refund")
  const [returnRefundMethod, setReturnRefundMethod] = useState<"cash" | "card" | "wallet" | "store_credit">("cash")
  const [returnReason, setReturnReason] = useState("")
  const [returnProcessing, setReturnProcessing] = useState(false)
  const [currentShift, setCurrentShift] = useState<POSShift | null>(null)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [shiftOpeningCash, setShiftOpeningCash] = useState("")
  const [shiftClosingCash, setShiftClosingCash] = useState("")
  const [shiftNotes, setShiftNotes] = useState("")
  const [shiftLoading, setShiftLoading] = useState(false)
  const [showCouponInput, setShowCouponInput] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{coupon_id: string; code: string; type: string; value: number; discount_amount: number} | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([])
  const [useSplitPayment, setUseSplitPayment] = useState(false)
  const [splitMethod, setSplitMethod] = useState<"cash" | "card" | "wallet">("cash")
  const [splitAmount, setSplitAmount] = useState("")
  // --- Pharmacy States ---
  const [isPharmacy, setIsPharmacy] = useState(false)
  const [pharmacyData, setPharmacyData] = useState<Record<string, { expiry_date?: string | null; batch_number?: string | null; active_ingredient?: string | null; requires_prescription?: boolean; manufacturer?: string | null; dosage_form?: string | null; storage_conditions?: string | null; interaction_group?: string | null; contraindications?: string[] | null; unit_type?: string | null; strip_per_box?: number | null; piece_per_strip?: number | null; box_per_carton?: number | null; price_unit?: string | null; default_selling_unit?: string | null }>>({})
  const [showExpiryAlerts, setShowExpiryAlerts] = useState(false)
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [expiryAlertsLoading, setExpiryAlertsLoading] = useState(false)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [prescriptionPatientName, setPrescriptionPatientName] = useState("")
  const [prescriptionPatientPhone, setPrescriptionPatientPhone] = useState("")
  const [prescriptionDoctorName, setPrescriptionDoctorName] = useState("")
  const [prescriptionNumber, setPrescriptionNumber] = useState("")
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState("")
  const [prescriptionNotes, setPrescriptionNotes] = useState("")
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([])
  const [prescriptionSaving, setPrescriptionSaving] = useState(false)
  const [showPrescriptionHistory, setShowPrescriptionHistory] = useState(false)
  const [prescriptionHistory, setPrescriptionHistory] = useState<PrescriptionRecord[]>([])
  const [prescriptionSearchQuery, setPrescriptionSearchQuery] = useState("")
  const [showInsuranceModal, setShowInsuranceModal] = useState(false)
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([])
  const [showAddInsurance, setShowAddInsurance] = useState(false)
  const [newInsuranceName, setNewInsuranceName] = useState("")
  const [newInsuranceCoverage, setNewInsuranceCoverage] = useState("80")
  const [newInsurancePhone, setNewInsurancePhone] = useState("")
  const [newInsuranceContract, setNewInsuranceContract] = useState("")
  const [insuranceSaving, setInsuranceSaving] = useState(false)
  const [selectedInsuranceCompany, setSelectedInsuranceCompany] = useState<InsuranceCompany | null>(null)
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("")
  const [useInsurance, setUseInsurance] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [alternativesProduct, setAlternativesProduct] = useState<string>("")
  const [alternatives, setAlternatives] = useState<DrugAlternative[]>([])
  const [alternativesIngredient, setAlternativesIngredient] = useState("")
  const [alternativesLoading, setAlternativesLoading] = useState(false)
  const [showPharmacyEdit, setShowPharmacyEdit] = useState(false)
  const [pharmEditProduct, setPharmEditProduct] = useState<Product | null>(null)
  const [pharmEditExpiry, setPharmEditExpiry] = useState("")
  const [pharmEditBatch, setPharmEditBatch] = useState("")
  const [pharmEditIngredient, setPharmEditIngredient] = useState("")
  const [pharmEditManufacturer, setPharmEditManufacturer] = useState("")
  const [pharmEditDosageForm, setPharmEditDosageForm] = useState("")
  const [pharmEditRequiresPrescription, setPharmEditRequiresPrescription] = useState(false)
  const [pharmEditSaving, setPharmEditSaving] = useState(false)
  // Pharmacy Quick-Add extra fields
  const [quickAddExpiry, setQuickAddExpiry] = useState("")
  const [quickAddBatch, setQuickAddBatch] = useState("")
  const [quickAddActiveIngredient, setQuickAddActiveIngredient] = useState("")
  const [quickAddRequiresPrescription, setQuickAddRequiresPrescription] = useState(false)
  const [quickAddManufacturer, setQuickAddManufacturer] = useState("")
  const [quickAddDosageForm, setQuickAddDosageForm] = useState("")
  const [quickAddCustomDosageForm, setQuickAddCustomDosageForm] = useState("")
  const [showCustomDosageInput, setShowCustomDosageInput] = useState(false)
  const [customDosageForms, setCustomDosageForms] = useState<string[]>([])
  const [quickAddStorageConditions, setQuickAddStorageConditions] = useState("")
  const [quickAddInteractionGroup, setQuickAddInteractionGroup] = useState("")
  const [quickAddCustomInteractionGroup, setQuickAddCustomInteractionGroup] = useState("")
  const [showCustomInteractionInput, setShowCustomInteractionInput] = useState(false)
  const [customInteractionGroups, setCustomInteractionGroups] = useState<{value: string; labelAr: string; labelEn: string}[]>([])
  const [quickAddUnitType, setQuickAddUnitType] = useState("")
  const [quickAddPiecePerStrip, setQuickAddPiecePerStrip] = useState("")
  const [quickAddStripPerBox, setQuickAddStripPerBox] = useState("")
  const [quickAddBoxPerCarton, setQuickAddBoxPerCarton] = useState("")
  const [quickAddPriceUnit, setQuickAddPriceUnit] = useState<"piece" | "strip" | "box">("box")
  const [quickAddDefaultSellingUnit, setQuickAddDefaultSellingUnit] = useState<"piece" | "strip" | "box">("box")
  // Drug Interactions
  const [drugInteractionWarnings, setDrugInteractionWarnings] = useState<{product_a:string;product_b:string;severity:string;description_ar:string;description_en:string}[]>([])
  // Patient File
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [patientSearchQuery, setPatientSearchQuery] = useState("")
  const [patientSearchResults, setPatientSearchResults] = useState<PatientFile[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientFile | null>(null)
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([])
  const [patientSaving, setPatientSaving] = useState(false)
  const [showPatientCreate, setShowPatientCreate] = useState(false)
  const [newPatientName, setNewPatientName] = useState("")
  const [newPatientPhone, setNewPatientPhone] = useState("")
  const [newPatientDob, setNewPatientDob] = useState("")
  const [newPatientGender, setNewPatientGender] = useState("")
  const [newPatientAllergies, setNewPatientAllergies] = useState("")
  const [newPatientConditions, setNewPatientConditions] = useState("")
  const [newPatientNotes, setNewPatientNotes] = useState("")
  // Drug Label
  const [showDrugLabelModal, setShowDrugLabelModal] = useState(false)
  const [drugLabelProduct, setDrugLabelProduct] = useState<Product | null>(null)
  const [drugLabelInstructions, setDrugLabelInstructions] = useState("")
  const [drugLabelData, setDrugLabelData] = useState<DrugLabel | null>(null)
  // Batch Inventory
  const [showBatchInventory, setShowBatchInventory] = useState(false)
  const [batchInventoryItems, setBatchInventoryItems] = useState<BatchInventoryItem[]>([])
  const [batchInventoryLoading, setBatchInventoryLoading] = useState(false)
  // FEFO
  const [showFEFO, setShowFEFO] = useState(false)
  const [fefoItems, setFefoItems] = useState<BatchInventoryItem[]>([])
  const [fefoLoading, setFefoLoading] = useState(false)
  // Multi-unit
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [unitProduct, setUnitProduct] = useState<Product | null>(null)
  const [unitEditPiecePerStrip, setUnitEditPiecePerStrip] = useState("")
  const [unitEditStripPerBox, setUnitEditStripPerBox] = useState("")
  const [unitEditBoxPerCarton, setUnitEditBoxPerCarton] = useState("")
  const [unitSaving, setUnitSaving] = useState(false)
  const [unitEditPriceUnit, setUnitEditPriceUnit] = useState<string>("box") // "piece" | "strip" | "box"
  const [unitEditDefaultSelling, setUnitEditDefaultSelling] = useState<string>("box")
  // Unit picker (for adding to cart by unit)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [unitPickerProduct, setUnitPickerProduct] = useState<Product | null>(null)
  // --- Clothing States ---
  const [isClothing, setIsClothing] = useState(false)
  // Variants
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [variantSizes, setVariantSizes] = useState<string[]>(["XS", "S", "M", "L", "XL", "XXL"])
  const [variantColors, setVariantColors] = useState<{name:string;hex:string}[]>([{name:"أسود",hex:"#000000"},{name:"أبيض",hex:"#FFFFFF"},{name:"أحمر",hex:"#FF0000"},{name:"أزرق",hex:"#0000FF"}])
  const [variantStockMatrix, setVariantStockMatrix] = useState<Record<string, number>>({})
  const [variantSaving, setVariantSaving] = useState(false)
  const [productVariants, setProductVariants] = useState<Record<string, ProductVariant[]>>({})
  const [cartVariantMap, setCartVariantMap] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [showVariantPicker, setShowVariantPicker] = useState(false)
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null)
  // Loyalty
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false)
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null)
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null)
  const [loyaltyPhone, setLoyaltyPhone] = useState("")
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0)
  const [loyaltySaving, setLoyaltySaving] = useState(false)
  const [showLoyaltyConfig, setShowLoyaltyConfig] = useState(false)
  const [loyaltyNewName, setLoyaltyNewName] = useState("")
  const [loyaltyNewPhone, setLoyaltyNewPhone] = useState("")
  const [loyaltyNewNotes, setLoyaltyNewNotes] = useState("")
  const [loyaltyNewPrefs, setLoyaltyNewPrefs] = useState("")
  // Installments
  const [showInstallmentModal, setShowInstallmentModal] = useState(false)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [installmentDownPayment, setInstallmentDownPayment] = useState("")
  const [installmentMonths, setInstallmentMonths] = useState("3")
  const [installmentCustomerName, setInstallmentCustomerName] = useState("")
  const [installmentCustomerPhone, setInstallmentCustomerPhone] = useState("")
  const [installmentSaving, setInstallmentSaving] = useState(false)
  // Seasons
  const [showSeasonModal, setShowSeasonModal] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<{discount:number;season_name:string}|null>(null)
  const [newSeasonName, setNewSeasonName] = useState("")
  const [newSeasonNameAr, setNewSeasonNameAr] = useState("")
  const [newSeasonStart, setNewSeasonStart] = useState("")
  const [newSeasonEnd, setNewSeasonEnd] = useState("")
  const [newSeasonDiscount, setNewSeasonDiscount] = useState("")
  const [newSeasonClearance, setNewSeasonClearance] = useState(false)
  const [seasonSaving, setSeasonSaving] = useState(false)
  // Suppliers
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierPhone, setNewSupplierPhone] = useState("")
  const [supplierSaving, setSupplierSaving] = useState(false)
  const [supplierProductCounts, setSupplierProductCounts] = useState<Record<string, number>>({})
  const [linkingSupplier, setLinkingSupplier] = useState<string | null>(null)
  const [linkProductSearch, setLinkProductSearch] = useState("")
  // Gift Cards
  const [showGiftCardModal, setShowGiftCardModal] = useState(false)
  const [giftCards, setGiftCards] = useState<GiftCard[]>([])
  const [newGiftCardBalance, setNewGiftCardBalance] = useState("")
  const [newGiftCardRecipient, setNewGiftCardRecipient] = useState("")
  const [giftCardSaving, setGiftCardSaving] = useState(false)
  const [giftCardCode, setGiftCardCode] = useState("")
  const [appliedGiftCard, setAppliedGiftCard] = useState<{card_id:string;code:string;balance:number;useAmount:number}|null>(null)
  const [isGiftReceipt, setIsGiftReceipt] = useState(false)
  // Reservations
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [reservations, setReservations] = useState<ProductReservation[]>([])
  const [reserveProduct, setReserveProduct] = useState<Product | null>(null)
  const [reserveCustomerName, setReserveCustomerName] = useState("")
  const [reserveCustomerPhone, setReserveCustomerPhone] = useState("")
  const [reserveHours, setReserveHours] = useState("24")
  const [reserveNotes, setReserveNotes] = useState("")
  const [reserveSaving, setReserveSaving] = useState(false)
  // Invoice Discount
  const [invoiceDiscountRules, setInvoiceDiscountRules] = useState<InvoiceDiscount[]>([])
  const [showInvoiceDiscountModal, setShowInvoiceDiscountModal] = useState(false)
  const [newRuleMin, setNewRuleMin] = useState("")
  const [newRuleType, setNewRuleType] = useState<"percentage"|"fixed">("percentage")
  const [newRuleValue, setNewRuleValue] = useState("")
  // Price Tag
  const [showPriceTagModal, setShowPriceTagModal] = useState(false)
  const [priceTagProduct, setPriceTagProduct] = useState<Product | null>(null)

  // ==================== Online Store States ====================
  const [isOnline, setIsOnline] = useState(false)
  // Incoming Orders
  const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false)
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrderForPOS[]>([])
  const [onlineOrdersLoading, setOnlineOrdersLoading] = useState(false)
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState<OnlineOrderForPOS | null>(null)
  // Shipping Zones
  const [showShippingModal, setShowShippingModal] = useState(false)
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([])
  const [shippingZonesLoading, setShippingZonesLoading] = useState(false)
  const [newZoneName, setNewZoneName] = useState("")
  const [newZoneNameAr, setNewZoneNameAr] = useState("")
  const [newZoneGov, setNewZoneGov] = useState("")
  const [newZoneFee, setNewZoneFee] = useState("")
  const [newZoneDays, setNewZoneDays] = useState("3")
  const [newZoneFreeMin, setNewZoneFreeMin] = useState("")
  const [shippingSaving, setShippingSaving] = useState(false)
  // Tier Pricing
  const [showTierPricingModal, setShowTierPricingModal] = useState(false)
  const [tierPricingProduct, setTierPricingProduct] = useState<Product | null>(null)
  const [tierPricingRows, setTierPricingRows] = useState<{ min_qty: string; price: string }[]>([])
  const [tierPricingSaving, setTierPricingSaving] = useState(false)
  // Payment Config
  const [showPaymentConfigModal, setShowPaymentConfigModal] = useState(false)
  const [paymentConfig, setPaymentConfig] = useState<PaymentMethodConfig>({ cod_enabled: true, wallet_enabled: false, instapay_enabled: false })
  const [paymentConfigSaving, setPaymentConfigSaving] = useState(false)
  // Low Stock
  const [showLowStockModal, setShowLowStockModal] = useState(false)
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; stock: number; price: number; image_url?: string }[]>([])
  const [lowStockLoading, setLowStockLoading] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  // Online Returns
  const [showOnlineReturnsModal, setShowOnlineReturnsModal] = useState(false)
  const [onlineReturns, setOnlineReturns] = useState<OnlineReturn[]>([])
  const [onlineReturnsLoading, setOnlineReturnsLoading] = useState(false)
  // Online Reports
  const [showOnlineReportModal, setShowOnlineReportModal] = useState(false)
  const [onlineReport, setOnlineReport] = useState<OnlineSalesReport | null>(null)
  const [onlineReportLoading, setOnlineReportLoading] = useState(false)
  const [onlineReportFrom, setOnlineReportFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().substring(0, 10) })
  const [onlineReportTo, setOnlineReportTo] = useState(() => new Date().toISOString().substring(0, 10))

  // Mobile responsive states
  const [showMobileTools, setShowMobileTools] = useState(false)
  const [contextMenuProduct, setContextMenuProduct] = useState<Product | null>(null)
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
  const activeSalesHistory = useMemo(() => activeMonthlyHistory?.sales ?? [], [activeMonthlyHistory])
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
      // Defer router push to avoid "Cannot update Router while rendering QPOSPage"
      const timer = setTimeout(() => router.push("/auth?role=seller"), 0)
      return () => clearTimeout(timer)
    }

    async function loadData() {
      try {
        const storeData = await getStoreByUserId(user!.id)
        if (!storeData) {
          setTimeout(() => router.push("/seller/dashboard"), 0)
          return
        }
        setStore({
          id: storeData.id,
          name: storeData.name || "",
          address: storeData.address,
          phone: storeData.phone,
          logo_url: storeData.image_url,
          is_approved: storeData.is_approved,
          category: storeData.category,
        })

        // Detect store type — fetch fresh category name from Firebase by ID, fallback to store name
        let categoryName = (storeData.category || "").toLowerCase()
        if (storeData.category_id) {
          const freshName = await getCategoryNameById(storeData.category_id as string)
          if (freshName) categoryName = freshName.toLowerCase()
        }
        const storeName = (storeData.name || "").toLowerCase()
        const detectStr = `${categoryName} ${storeName}`
        const isPharm = detectStr.includes("صحة") || detectStr.includes("صيدل") || detectStr.includes("صيدال") || detectStr.includes("pharmacy") || detectStr.includes("health")
        setIsPharmacy(isPharm)

        // Detect clothing store
        const isCloth = detectStr.includes("ملابس") || detectStr.includes("أزياء") || detectStr.includes("fashion") || detectStr.includes("clothing")
        setIsClothing(isCloth)

        // Detect online store
        const isOnl = detectStr.includes("اون لاين") || detectStr.includes("أونلاين") || detectStr.includes("online") || detectStr.includes("متجر إلكتروني") || detectStr.includes("إلكتروني") || detectStr.includes("الكتروني")
        setIsOnline(isOnl)

        // Fetch subcategories for the store's category
        // First try by category_id (most reliable), then by category name, then by keywords
        if (storeData.category_id) {
          fetchSubcategoriesByCategoryId(storeData.category_id as string).then(setStoreSubcategories).catch(() => {})
        } else if (storeData.category && storeData.category !== "other") {
          fetchStoreSubcategories(storeData.category).then(setStoreSubcategories).catch(() => {})
        } else if (isPharm) {
          fetchSubcategoriesByKeywords(["صيدل", "صيدال", "pharmacy"]).then(setStoreSubcategories).catch(() => {})
        } else if (isCloth) {
          fetchSubcategoriesByKeywords(["ملابس", "أزياء", "fashion"]).then(setStoreSubcategories).catch(() => {})
        } else if (isOnl) {
          fetchSubcategoriesByKeywords(["اون لاين", "online", "إلكتروني"]).then(setStoreSubcategories).catch(() => {})
        }

        const productsData = await getPOSProducts(storeData.id, user!.id)
        setProducts(productsData as Product[])
        await loadPOSPinStatus(storeData.id, user!.id)

        // Load pharmacy product data if pharmacy
        if (isPharm) {
          getEnhancedPharmacyData(storeData.id).then(setPharmacyData).catch(() => {})
        }

        // Load clothing data if clothing store
        if (isCloth) {
          getLoyaltyConfig(storeData.id).then(setLoyaltyConfig).catch(() => {})
          getSeasons(storeData.id).then(setSeasons).catch(() => {})
          getSuppliers(storeData.id).then(setSuppliers).catch(() => {})
          getInvoiceDiscountRules(storeData.id).then(setInvoiceDiscountRules).catch(() => {})
          getGiftCards(storeData.id).then(setGiftCards).catch(() => {})
          getReservations(storeData.id).then(setReservations).catch(() => {})
          getActiveSeasonDiscount(storeData.id).then(setActiveSeason).catch(() => {})
        }

        // Load online store data
        if (isOnl) {
          getShippingZones(storeData.id).then(setShippingZones).catch(() => {})
          getPaymentConfig(storeData.id).then(setPaymentConfig).catch(() => {})
          getIncomingOnlineOrders(storeData.id).then(setOnlineOrders).catch(() => {})
        }
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

  // Computed invoice discount (moved before total so total can include it)
  const computedInvoiceDiscount = useMemo(() => {
    if (!isClothing || invoiceDiscountRules.length === 0) return 0
    // Inline logic (avoid calling server action during render)
    for (const rule of invoiceDiscountRules) {
      if (subtotal >= rule.min_amount) {
        return rule.discount_type === "percentage"
          ? Math.round(subtotal * rule.discount_value / 100)
          : rule.discount_value
      }
    }
    return 0
  }, [isClothing, invoiceDiscountRules, subtotal])

  const total = useMemo(() => {
    let t = roundMoney(Math.max(0, subtotal - discountAmount))
    if (isClothing) {
      // Season discount (percentage off subtotal)
      if (activeSeason) {
        t -= roundMoney(subtotal * activeSeason.discount / 100)
      }
      // Invoice discount (rules-based)
      if (computedInvoiceDiscount > 0) {
        t -= computedInvoiceDiscount
      }
      // Loyalty points discount
      if (loyaltyRedeemPoints > 0 && loyaltyConfig) {
        t -= roundMoney(loyaltyRedeemPoints * (loyaltyConfig.point_value || 0.1))
      }
      // Gift card
      if (appliedGiftCard) {
        t -= appliedGiftCard.useAmount
      }
      t = roundMoney(Math.max(0, t))
    }
    return t
  }, [subtotal, discountAmount, isClothing, activeSeason, computedInvoiceDiscount, loyaltyRedeemPoints, loyaltyConfig, appliedGiftCard])

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
    (product: Product, unitInfo?: { unit_multiplier: number; unit_label: string; unit_price: number }) => {
      setError("")
      const effectivePrice = unitInfo?.unit_price ?? product.price
      const effectiveMultiplier = unitInfo?.unit_multiplier ?? 1
      setCart((prev) => {
        // When adding with unit, check by product id + unit_multiplier to allow same product in different units
        const cartKey = `${product.id}_${effectiveMultiplier}`
        const existing = prev.find((item) => item.id === product.id && (item.unit_multiplier || 1) === effectiveMultiplier)
        if (existing) {
          const piecesInCart = prev
            .filter((item) => item.id === product.id)
            .reduce((sum, item) => sum + item.quantity * (item.unit_multiplier || 1), 0)
          if (piecesInCart + effectiveMultiplier > product.stock) {
            setError(`${t("لا يوجد مخزون كافي من", 'Insufficient stock for')} "${product.name}"`)
            return prev
          }
          return prev.map((item) =>
            item.id === product.id && (item.unit_multiplier || 1) === effectiveMultiplier
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  total: (item.quantity + 1) * effectivePrice,
                }
              : item
          )
        }
        if (product.stock < effectiveMultiplier) {
          setError(`${t("المنتج", "Product")} "${product.name}" ${t("غير متوفر", "is unavailable")}`)
          return prev
        }
        return [
          ...prev,
          {
            ...product,
            quantity: 1,
            total: effectivePrice,
            price: effectivePrice,
            unit_multiplier: unitInfo?.unit_multiplier,
            unit_label: unitInfo?.unit_label,
            unit_price: unitInfo?.unit_price,
          },
        ]
      })
    },
    [t]
  )

  const updateQuantity = useCallback(
    (productId: string, newQty: number, unitMultiplier?: number) => {
      if (newQty <= 0) {
        removeFromCart(productId)
        return
      }
      const product = products.find((p) => p.id === productId)
      if (product) {
        // Check total pieces used across all units of this product
        const otherPieces = cart
          .filter((item) => item.id === productId && (item.unit_multiplier || 1) !== (unitMultiplier || 1))
          .reduce((sum, item) => sum + item.quantity * (item.unit_multiplier || 1), 0)
        const piecesNeeded = newQty * (unitMultiplier || 1) + otherPieces
        if (piecesNeeded > product.stock) {
          setError(`${t("لا يوجد مخزون كافي من", "Insufficient stock for")} "${product.name}"`)
          return
        }
      }
      setCart((prev) =>
        prev.map((item) =>
          item.id === productId && (item.unit_multiplier || 1) === (unitMultiplier || 1)
            ? { ...item, quantity: newQty, total: newQty * item.price }
            : item
        )
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setAppliedCoupon(null)
    setCouponCode("")
    setSelectedCustomer(null)
    setSplitPayments([])
    setUseSplitPayment(false)
    setCartVariantMap({})
  }, [])

  // ===================== Load Held Carts & Shift =====================

  const loadHeldCarts = useCallback(async () => {
    if (!store || !user) return
    const carts = await getHeldCarts(store.id, user.id)
    setHeldCarts(carts)
  }, [store, user])

  const loadCurrentShift = useCallback(async () => {
    if (!store || !user) return
    const shift = await getCurrentShift(store.id, user.id)
    setCurrentShift(shift)
  }, [store, user])

  // Load held carts and current shift when store is ready
  useEffect(() => {
    if (store && user) {
      loadHeldCarts()
      loadCurrentShift()
    }
  }, [store, user, loadHeldCarts, loadCurrentShift])

  // ===================== Hold Cart =====================

  const handleHoldCart = useCallback(async () => {
    if (!store || !user || cart.length === 0) return
    setError("")
    const items: HeldCartItem[] = cart.map((item) => ({
      product_id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      total: item.total,
      image_url: item.image_url,
      unit_multiplier: item.unit_multiplier,
      unit_label: item.unit_label,
    }))
    const result = await holdCart({
      store_id: store.id,
      items,
      customer_name: customerName || selectedCustomer?.name || undefined,
      customer_phone: customerPhone || selectedCustomer?.phone || undefined,
      notes: notes || undefined,
      discount: normalizedDiscountValue > 0 ? normalizedDiscountValue : undefined,
      discount_type: normalizedDiscountValue > 0 ? discountType : undefined,
      label: holdCartLabel || undefined,
    }, user.id)

    if (result.success) {
      clearCart()
      setHoldCartLabel("")
      await loadHeldCarts()
      setSuccess(t("تم تعليق السلة بنجاح", "Cart held successfully"))
      setTimeout(() => setSuccess(""), 2500)
    } else {
      setError(translatePosError(result.error, t("فشل في تعليق السلة", "Failed to hold cart")))
    }
  }, [store, user, cart, customerName, customerPhone, notes, normalizedDiscountValue, discountType, holdCartLabel, clearCart, loadHeldCarts, t, translatePosError, selectedCustomer])

  const handleRetrieveHeldCart = useCallback(async (heldCart: HeldCart) => {
    if (!store || !user) return
    // Restore cart items
    const newCartItems: CartItem[] = []
    for (const item of heldCart.items) {
      const product = products.find((p) => p.id === item.product_id)
      if (product) {
        newCartItems.push({
          ...product,
          quantity: item.quantity,
          total: item.quantity * (item.unit_multiplier ? product.price * item.unit_multiplier : product.price),
          price: item.unit_multiplier ? product.price * item.unit_multiplier : product.price,
          unit_multiplier: item.unit_multiplier,
          unit_label: item.unit_label,
        })
      }
    }
    setCart(newCartItems)
    if (heldCart.customer_name) setCustomerName(heldCart.customer_name)
    if (heldCart.customer_phone) setCustomerPhone(heldCart.customer_phone)
    if (heldCart.notes) setNotes(heldCart.notes)
    if (heldCart.discount && heldCart.discount > 0) {
      setDiscount(String(heldCart.discount))
      setDiscountType(heldCart.discount_type || "fixed")
    }

    // Delete the held cart
    await deleteHeldCart(heldCart.id, store.id, user.id)
    await loadHeldCarts()
    setShowHeldCarts(false)
    setSuccess(t("تم استرجاع السلة", "Cart retrieved"))
    setTimeout(() => setSuccess(""), 2500)
  }, [store, user, products, loadHeldCarts, t])

  const handleDeleteHeldCart = useCallback(async (cartId: string) => {
    if (!store || !user) return
    await deleteHeldCart(cartId, store.id, user.id)
    await loadHeldCarts()
    setSuccess(t("تم حذف السلة المعلقة", "Held cart deleted"))
    setTimeout(() => setSuccess(""), 2500)
  }, [store, user, loadHeldCarts, t])

  // ===================== Customer Search =====================

  const handleCustomerSearch = useCallback(async (q: string) => {
    setCustomerSearchQuery(q)
    if (!store || !user) return
    if (q.trim().length < 2) {
      setCustomerSearchResults([])
      return
    }
    const results = await searchPOSCustomers(store.id, q, user.id)
    setCustomerSearchResults(results)
  }, [store, user])

  const handleSelectCustomer = useCallback((customer: POSCustomer) => {
    setSelectedCustomer(customer)
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone || "")
    setShowCustomerSearch(false)
    setCustomerSearchQuery("")
    setCustomerSearchResults([])
  }, [])

  const handleSaveNewCustomer = useCallback(async () => {
    if (!store || !user || !newCustomerName.trim()) return
    const result = await createOrUpdatePOSCustomer({
      store_id: store.id,
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || undefined,
      email: newCustomerEmail.trim() || undefined,
      notes: newCustomerNotes.trim() || undefined,
    }, user.id)

    if (result.success && result.data) {
      handleSelectCustomer(result.data)
      setShowCustomerForm(false)
      setNewCustomerName("")
      setNewCustomerPhone("")
      setNewCustomerEmail("")
      setNewCustomerNotes("")
      setSuccess(t("تم حفظ العميل", "Customer saved"))
      setTimeout(() => setSuccess(""), 2500)
    } else {
      setError(translatePosError(result.error, t("فشل حفظ العميل", "Failed to save customer")))
    }
  }, [store, user, newCustomerName, newCustomerPhone, newCustomerEmail, newCustomerNotes, handleSelectCustomer, t, translatePosError])

  // ===================== Returns =====================

  const handleSearchSaleForReturn = useCallback(async () => {
    if (!store || !user || !returnSaleId.trim()) return
    setError("")
    const result = await getSaleForReturn(returnSaleId.trim(), store.id, user.id)
    if (result.success && result.data) {
      setReturnSaleData(result.data)
      const saleData: any = result.data
      const items = (saleData.items || []).map((item: any) => ({
        product_id: item.product_id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: 0,
        maxQty: Number(item.quantity) || 0,
      }))
      setReturnItems(items)
    } else {
      setError(translatePosError(result.error, t("الفاتورة غير موجودة", "Sale not found")))
    }
  }, [store, user, returnSaleId, t, translatePosError])

  const handleProcessReturn = useCallback(async () => {
    if (!store || !user || !returnSaleData) return
    const itemsToReturn = returnItems.filter((item) => item.quantity > 0)
    if (itemsToReturn.length === 0) {
      setError(t("اختر منتج واحد على الأقل للإرجاع", "Select at least one item to return"))
      return
    }

    setReturnProcessing(true)
    setError("")
    const refundAmount = itemsToReturn.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const result = await createPOSReturn({
      store_id: store.id,
      original_sale_id: returnSaleData.id,
      original_sale_number: returnSaleData.sale_number || "",
      items: itemsToReturn.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      return_type: returnType,
      refund_amount: refundAmount,
      refund_method: returnRefundMethod,
      reason: returnReason || undefined,
      customer_name: returnSaleData.customer_name || undefined,
      customer_phone: returnSaleData.customer_phone || undefined,
    }, user.id)

    if (result.success) {
      // Refresh products to update stock
      const productsData = await getPOSProducts(store.id, user.id)
      setProducts(productsData as Product[])
      setShowReturn(false)
      setReturnSaleId("")
      setReturnSaleData(null)
      setReturnItems([])
      setReturnReason("")
      setSuccess(t("تمت عملية الإرجاع بنجاح", "Return processed successfully"))
      setTimeout(() => setSuccess(""), 3000)
    } else {
      setError(translatePosError(result.error, t("فشل عملية الإرجاع", "Return failed")))
    }
    setReturnProcessing(false)
  }, [store, user, returnSaleData, returnItems, returnType, returnRefundMethod, returnReason, t, translatePosError])

  // ===================== Shift Management =====================

  const handleOpenShift = useCallback(async () => {
    if (!store || !user) return
    const cash = Number(shiftOpeningCash) || 0
    setShiftLoading(true)
    setError("")
    const result = await openShift({
      store_id: store.id,
      cashier_id: user.id,
      cashier_name: store.name,
      opening_cash: cash,
    }, user.id)

    if (result.success && result.data) {
      setCurrentShift(result.data)
      setShowShiftModal(false)
      setShiftOpeningCash("")
      setSuccess(t("تم فتح الوردية", "Shift opened"))
      setTimeout(() => setSuccess(""), 2500)
    } else {
      setError(translatePosError(result.error, t("فشل فتح الوردية", "Failed to open shift")))
    }
    setShiftLoading(false)
  }, [store, user, shiftOpeningCash, t, translatePosError])

  const handleCloseShift = useCallback(async () => {
    if (!store || !user || !currentShift) return
    const cash = Number(shiftClosingCash) || 0
    setShiftLoading(true)
    setError("")
    const result = await closeShift({
      store_id: store.id,
      shift_id: currentShift.id,
      closing_cash: cash,
      notes: shiftNotes || undefined,
    }, user.id)

    if (result.success && result.data) {
      setCurrentShift(null)
      setShowShiftModal(false)
      setShiftClosingCash("")
      setShiftNotes("")
      setSuccess(
        `${t("تم إغلاق الوردية", "Shift closed")} - ${t("الفرق:", "Difference:")} ${result.data.cash_difference?.toFixed(2)} ${currencyLabel}`
      )
      setTimeout(() => setSuccess(""), 5000)
    } else {
      setError(translatePosError(result.error, t("فشل إغلاق الوردية", "Failed to close shift")))
    }
    setShiftLoading(false)
  }, [store, user, currentShift, shiftClosingCash, shiftNotes, t, translatePosError, currencyLabel])

  // ===================== Coupon =====================

  const handleApplyCoupon = useCallback(async () => {
    if (!store || !user || !couponCode.trim()) return
    setCouponLoading(true)
    setError("")
    const result = await validatePOSCoupon(store.id, couponCode.trim(), subtotal, user.id)
    if (result.success && result.data) {
      setAppliedCoupon(result.data)
      setDiscount(String(result.data.value))
      setDiscountType(result.data.type as "percentage" | "fixed")
      setShowCouponInput(false)
      setSuccess(`${t("تم تطبيق كود الخصم:", "Coupon applied:")} ${result.data.code}`)
      setTimeout(() => setSuccess(""), 2500)
    } else {
      setError(translatePosError(result.error, t("كود الخصم غير صالح", "Invalid coupon code")))
    }
    setCouponLoading(false)
  }, [store, user, couponCode, subtotal, t, translatePosError])

  // ===================== Split Payment =====================

  const splitPaymentTotal = useMemo(
    () => roundMoney(splitPayments.reduce((sum, sp) => sum + sp.amount, 0)),
    [splitPayments]
  )

  const splitPaymentRemaining = useMemo(
    () => roundMoney(total - splitPaymentTotal),
    [total, splitPaymentTotal]
  )

  const addSplitPayment = useCallback(() => {
    const amt = Number(splitAmount) || 0
    if (amt <= 0 || amt > splitPaymentRemaining) return

    setSplitPayments((prev) => [...prev, { method: splitMethod, amount: amt }])
    setSplitAmount("")
  }, [splitAmount, splitMethod, splitPaymentRemaining])

  const removeSplitPayment = useCallback((index: number) => {
    setSplitPayments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ===================== Pharmacy Handlers =====================

  const loadExpiryAlerts = useCallback(async () => {
    if (!store) return
    setExpiryAlertsLoading(true)
    try {
      const alerts = await getExpiryAlerts(store.id)
      setExpiryAlerts(alerts)
    } catch { /* ignore */ }
    setExpiryAlertsLoading(false)
  }, [store])

  const handleLoadAlternatives = useCallback(async (productId: string) => {
    if (!store) return
    setAlternativesLoading(true)
    setShowAlternatives(true)
    setAlternativesProduct(productId)
    try {
      const result = await findDrugAlternatives(store.id, productId)
      if (result.success && result.alternatives) {
        setAlternatives(result.alternatives)
        setAlternativesIngredient(result.active_ingredient || "")
      } else {
        setAlternatives([])
        setAlternativesIngredient("")
        setError(translatePosError(result.error, t("لا توجد بدائل", "No alternatives found")))
      }
    } catch {
      setAlternatives([])
    }
    setAlternativesLoading(false)
  }, [store, t, translatePosError])

  const handleSavePharmacyEdit = useCallback(async () => {
    if (!store || !pharmEditProduct) return
    setPharmEditSaving(true)
    try {
      const result = await updateProductPharmacyFields(store.id, pharmEditProduct.id, {
        expiry_date: pharmEditExpiry || null,
        batch_number: pharmEditBatch || null,
        active_ingredient: pharmEditIngredient || null,
        requires_prescription: pharmEditRequiresPrescription,
        manufacturer: pharmEditManufacturer || null,
        dosage_form: pharmEditDosageForm || null,
      })
      if (result.success) {
        // Update local pharmacy data
        setPharmacyData((prev) => ({
          ...prev,
          [pharmEditProduct.id]: {
            expiry_date: pharmEditExpiry || null,
            batch_number: pharmEditBatch || null,
            active_ingredient: pharmEditIngredient || null,
            requires_prescription: pharmEditRequiresPrescription,
            manufacturer: pharmEditManufacturer || null,
            dosage_form: pharmEditDosageForm || null,
          },
        }))
        setShowPharmacyEdit(false)
        setSuccess(t("تم حفظ بيانات المنتج الدوائية", "Pharmacy data saved"))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(translatePosError(result.error))
      }
    } catch {
      setError(t("فشل حفظ البيانات", "Failed to save data"))
    }
    setPharmEditSaving(false)
  }, [store, pharmEditProduct, pharmEditExpiry, pharmEditBatch, pharmEditIngredient, pharmEditManufacturer, pharmEditDosageForm, pharmEditRequiresPrescription, t, translatePosError])

  const openPharmacyEdit = useCallback((product: Product) => {
    const data = pharmacyData[product.id]
    setPharmEditProduct(product)
    setPharmEditExpiry(data?.expiry_date || "")
    setPharmEditBatch(data?.batch_number || "")
    setPharmEditIngredient(data?.active_ingredient || "")
    setPharmEditManufacturer(data?.manufacturer || "")
    setPharmEditDosageForm(data?.dosage_form || "")
    setPharmEditRequiresPrescription(data?.requires_prescription || false)
    setShowPharmacyEdit(true)
  }, [pharmacyData])

  const handleSavePrescription = useCallback(async (saleId: string, saleNumber: string) => {
    if (!store || !prescriptionPatientName.trim() || !prescriptionDoctorName.trim()) {
      setError(t("اسم المريض والطبيب مطلوبين", "Patient and doctor names are required"))
      return
    }
    setPrescriptionSaving(true)
    try {
      const result = await savePrescriptionRecord({
        store_id: store.id,
        sale_id: saleId,
        sale_number: saleNumber,
        patient_name: prescriptionPatientName.trim(),
        patient_phone: prescriptionPatientPhone || undefined,
        doctor_name: prescriptionDoctorName.trim(),
        prescription_number: prescriptionNumber || undefined,
        diagnosis: prescriptionDiagnosis || undefined,
        items: prescriptionItems,
        notes: prescriptionNotes || undefined,
      })
      if (result.success) {
        setShowPrescriptionModal(false)
        setPrescriptionPatientName("")
        setPrescriptionPatientPhone("")
        setPrescriptionDoctorName("")
        setPrescriptionNumber("")
        setPrescriptionDiagnosis("")
        setPrescriptionNotes("")
        setPrescriptionItems([])
        setSuccess(t("تم حفظ الروشتة بنجاح", "Prescription saved"))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(t("فشل حفظ الروشتة", "Failed to save prescription"))
      }
    } catch {
      setError(t("فشل حفظ الروشتة", "Failed to save prescription"))
    }
    setPrescriptionSaving(false)
  }, [store, prescriptionPatientName, prescriptionPatientPhone, prescriptionDoctorName, prescriptionNumber, prescriptionDiagnosis, prescriptionNotes, prescriptionItems, t])

  const handleLoadPrescriptionHistory = useCallback(async () => {
    if (!store) return
    setShowPrescriptionHistory(true)
    try {
      if (prescriptionSearchQuery.trim()) {
        const results = await searchPrescriptions(store.id, prescriptionSearchQuery.trim())
        setPrescriptionHistory(results)
      } else {
        const results = await searchPrescriptions(store.id, "")
        setPrescriptionHistory(results)
      }
    } catch {
      setPrescriptionHistory([])
    }
  }, [store, prescriptionSearchQuery])

  const handleAddInsuranceCompany = useCallback(async () => {
    if (!store || !newInsuranceName.trim()) return
    setInsuranceSaving(true)
    try {
      const result = await addInsuranceCompany({
        store_id: store.id,
        name: newInsuranceName.trim(),
        coverage_percentage: Number(newInsuranceCoverage) || 80,
        contact_phone: newInsurancePhone || undefined,
        contract_number: newInsuranceContract || undefined,
      })
      if (result.success) {
        setShowAddInsurance(false)
        setNewInsuranceName("")
        setNewInsuranceCoverage("80")
        setNewInsurancePhone("")
        setNewInsuranceContract("")
        // Reload companies
        const companies = await getInsuranceCompanies(store.id)
        setInsuranceCompanies(companies)
        setSuccess(t("تم إضافة شركة التأمين", "Insurance company added"))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(translatePosError(result.error, t("فشل إضافة شركة التأمين", "Failed to add insurance company")))
      }
    } catch {
      setError(t("فشل إضافة شركة التأمين", "Failed to add insurance company"))
    }
    setInsuranceSaving(false)
  }, [store, newInsuranceName, newInsuranceCoverage, newInsurancePhone, newInsuranceContract, t, translatePosError])

  const loadInsuranceCompanies = useCallback(async () => {
    if (!store) return
    try {
      const companies = await getInsuranceCompanies(store.id)
      setInsuranceCompanies(companies)
    } catch { /* ignore */ }
  }, [store])

  // ===================== Clothing Handlers =====================

  // --- Variants ---
  const handleOpenVariantManager = useCallback(async (product: Product) => {
    if (!store) return
    setVariantProduct(product)
    setVariantStockMatrix({})
    setShowVariantModal(true)
    try {
      const existing = await getProductVariants(store.id, product.id)
      if (existing.length > 0) {
        const matrix: Record<string, number> = {}
        existing.forEach(v => { matrix[`${v.size}_${v.color}`] = v.stock })
        setVariantStockMatrix(matrix)
        const sizes = [...new Set(existing.map(v => v.size))]
        // Deduplicate colors by name (new Set doesn't work with objects)
        const colorMap = new Map<string, string>()
        existing.forEach(v => {
          if (!colorMap.has(v.color)) colorMap.set(v.color, v.color_hex || "#000000")
        })
        const colors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }))
        if (sizes.length > 0) setVariantSizes(sizes)
        if (colors.length > 0) setVariantColors(colors)
      }
    } catch { /* ignore */ }
  }, [store])

  const handleSaveVariants = useCallback(async () => {
    if (!store || !variantProduct) return
    setVariantSaving(true)
    try {
      const result = await saveProductVariants(store.id, variantProduct.id, variantSizes, variantColors, variantStockMatrix)
      if (result.success) {
        setShowVariantModal(false)
        setSuccess(t("تم حفظ المقاسات والألوان", "Variants saved"))
        // Reload variants for this product
        const updated = await getProductVariants(store.id, variantProduct.id)
        setProductVariants(prev => ({ ...prev, [variantProduct.id]: updated }))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(t("فشل حفظ المقاسات", "Failed to save variants"))
      }
    } catch {
      setError(t("فشل حفظ المقاسات", "Failed to save variants"))
    }
    setVariantSaving(false)
  }, [store, variantProduct, variantSizes, variantColors, variantStockMatrix, t])

  const handleVariantPick = useCallback((product: Product) => {
    setVariantPickerProduct(product)
    setSelectedVariant(null)
    setShowVariantPicker(true)
    // Load product variants if not cached
    if (store && !productVariants[product.id]) {
      getProductVariants(store.id, product.id).then(variants => {
        setProductVariants(prev => ({ ...prev, [product.id]: variants }))
      }).catch(() => {})
    }
  }, [store, productVariants])

  const handleAddVariantToCart = useCallback((product: Product, variant: ProductVariant) => {
    const cartItemId = `${product.id}_${variant.size}_${variant.color}`
    const variantName = `${product.name} (${variant.size}/${variant.color})`
    const existingIndex = cart.findIndex(c => c.id === cartItemId)
    if (existingIndex >= 0) {
      // Check stock before incrementing
      if (cart[existingIndex].quantity >= variant.stock) {
        setError(`${t("لا يوجد مخزون كافي من", "Insufficient stock for")} "${variantName}"`)
        return
      }
      setCart(prev => prev.map((item, i) => i === existingIndex ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item))
    } else {
      // Check stock for new item
      if (variant.stock <= 0) {
        setError(`${t("لا يوجد مخزون كافي من", "Insufficient stock for")} "${variantName}"`)
        return
      }
      setCart(prev => [...prev, {
        ...product,
        id: cartItemId,
        name: variantName,
        price: variant.price_override || product.price,
        quantity: 1,
        total: variant.price_override || product.price,
        stock: variant.stock,
      } as CartItem])
    }
    // Track variant ID for post-sale stock update
    if (variant.id) {
      setCartVariantMap(prev => ({ ...prev, [cartItemId]: variant.id! }))
    }
    setShowVariantPicker(false)
    setSelectedVariant(null)
  }, [cart, t])

  // --- Loyalty ---
  const handleSearchLoyaltyCustomer = useCallback(async () => {
    if (!store || !loyaltyPhone.trim()) return
    setLoyaltySaving(true)
    try {
      const customer = await getLoyaltyCustomer(store.id, loyaltyPhone.trim())
      if (customer) {
        setLoyaltyCustomer(customer)
      } else {
        setLoyaltyCustomer(null)
        setSuccess(t("لم يتم العثور على عميل بهذا الرقم", "Customer not found"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch { /* ignore */ }
    setLoyaltySaving(false)
  }, [store, loyaltyPhone, t])

  const handleCreateLoyaltyCustomer = useCallback(async () => {
    if (!store || !loyaltyNewName.trim() || !loyaltyNewPhone.trim()) return
    setLoyaltySaving(true)
    try {
      const result = await createLoyaltyCustomer(store.id, { name: loyaltyNewName.trim(), phone: loyaltyNewPhone.trim(), notes: loyaltyNewNotes || undefined })
      if (result) {
        setLoyaltyCustomer(result)
        setLoyaltyNewName("")
        setLoyaltyNewPhone("")
        setLoyaltyNewNotes("")
        setSuccess(t("تم تسجيل العميل في برنامج الولاء", "Customer added to loyalty"))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(t("فشل تسجيل العميل", "Failed to register customer"))
      }
    } catch {
      setError(t("فشل تسجيل العميل", "Failed to register customer"))
    }
    setLoyaltySaving(false)
  }, [store, loyaltyNewName, loyaltyNewPhone, loyaltyNewNotes, t])

  const handleSaveLoyaltyConfig = useCallback(async () => {
    if (!store || !loyaltyConfig) return
    setLoyaltySaving(true)
    try {
      const saved = await saveLoyaltyConfig(store.id, loyaltyConfig)
      if (saved) {
        setShowLoyaltyConfig(false)
        setSuccess(t("تم حفظ إعدادات الولاء", "Loyalty config saved"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch { /* ignore */ }
    setLoyaltySaving(false)
  }, [store, loyaltyConfig, t])

  const handleUpdateCustomerNotes = useCallback(async () => {
    if (!store || !loyaltyCustomer) return
    setLoyaltySaving(true)
    try {
      await updateCustomerNotes(store.id, loyaltyCustomer.id, loyaltyNewNotes, loyaltyNewPrefs)
      setLoyaltyCustomer(prev => prev ? { ...prev, notes: loyaltyNewNotes || undefined, preferences: loyaltyNewPrefs || undefined } : null)
      setSuccess(t("تم تحديث ملاحظات العميل", "Customer notes updated"))
      setTimeout(() => setSuccess(""), 2500)
    } catch { /* ignore */ }
    setLoyaltySaving(false)
  }, [store, loyaltyCustomer, loyaltyNewNotes, loyaltyNewPrefs, t])

  // --- Installments ---
  const handleLoadInstallments = useCallback(async () => {
    if (!store) return
    try {
      const data = await getInstallments(store.id)
      setInstallments(data)
    } catch { /* ignore */ }
  }, [store])

  const handleCreateInstallment = useCallback(async () => {
    if (!store || cart.length === 0 || !installmentCustomerName.trim() || !installmentCustomerPhone.trim()) return
    setInstallmentSaving(true)
    try {
      const result = await createInstallment(store.id, {
        sale_id: `POS-${Date.now()}`,
        customer_name: installmentCustomerName.trim(),
        customer_phone: installmentCustomerPhone.trim(),
        total_amount: total,
        down_payment: Number(installmentDownPayment) || 0,
        num_installments: Number(installmentMonths) || 3,
      })
      if (result) {
        setShowInstallmentModal(false)
        setInstallmentCustomerName("")
        setInstallmentCustomerPhone("")
        setInstallmentDownPayment("")
        setInstallmentMonths("3")
        clearCart()
        setSuccess(t("تم إنشاء خطة التقسيط", "Installment plan created"))
        handleLoadInstallments()
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(t("فشل إنشاء خطة التقسيط", "Failed to create installment plan"))
      }
    } catch {
      setError(t("فشل إنشاء خطة التقسيط", "Failed to create installment plan"))
    }
    setInstallmentSaving(false)
  }, [store, cart, total, installmentCustomerName, installmentCustomerPhone, installmentDownPayment, installmentMonths, t, clearCart, handleLoadInstallments])

  const handlePayInstallment = useCallback(async (installmentId: string, amount: number) => {
    if (!store) return
    try {
      const paid = await payInstallment(store.id, installmentId, amount, "cash")
      if (paid) {
        handleLoadInstallments()
        setSuccess(t("تم تسجيل الدفعة", "Payment recorded"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch { /* ignore */ }
  }, [store, handleLoadInstallments, t])

  // --- Seasons ---
  const handleLoadSeasons = useCallback(async () => {
    if (!store) return
    try {
      const data = await getSeasons(store.id)
      setSeasons(data)
      const active = await getActiveSeasonDiscount(store.id)
      setActiveSeason(active)
    } catch { /* ignore */ }
  }, [store])

  const handleCreateSeason = useCallback(async () => {
    if (!store || !newSeasonName.trim() || !newSeasonStart || !newSeasonEnd) return
    setSeasonSaving(true)
    try {
      const result = await createSeason(store.id, {
        name: newSeasonName.trim(),
        name_ar: newSeasonNameAr.trim() || newSeasonName.trim(),
        start_date: newSeasonStart,
        end_date: newSeasonEnd,
        discount_percentage: Number(newSeasonDiscount) || 0,
        is_clearance: newSeasonClearance,
      })
      if (result) {
        setNewSeasonName("")
        setNewSeasonNameAr("")
        setNewSeasonStart("")
        setNewSeasonEnd("")
        setNewSeasonDiscount("")
        setNewSeasonClearance(false)
        handleLoadSeasons()
        setSuccess(t("تم إنشاء الموسم", "Season created"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch {
      setError(t("فشل إنشاء الموسم", "Failed to create season"))
    }
    setSeasonSaving(false)
  }, [store, newSeasonName, newSeasonNameAr, newSeasonStart, newSeasonEnd, newSeasonDiscount, newSeasonClearance, handleLoadSeasons, t])

  // --- Suppliers ---
  const handleLoadSuppliers = useCallback(async () => {
    if (!store) return
    try {
      const [data, counts] = await Promise.all([
        getSuppliers(store.id),
        getSupplierProductCounts(store.id),
      ])
      setSuppliers(data)
      setSupplierProductCounts(counts)
    } catch { /* ignore */ }
  }, [store])

  const handleAddSupplier = useCallback(async () => {
    if (!store || !newSupplierName.trim()) return
    setSupplierSaving(true)
    try {
      const result = await addSupplier(store.id, {
        name: newSupplierName.trim(),
        phone: newSupplierPhone || undefined,
      })
      if (result) {
        setNewSupplierName("")
        setNewSupplierPhone("")
        handleLoadSuppliers()
        setSuccess(t("تم إضافة المورد", "Supplier added"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch {
      setError(t("فشل إضافة المورد", "Failed to add supplier"))
    }
    setSupplierSaving(false)
  }, [store, newSupplierName, newSupplierPhone, handleLoadSuppliers, t])

  const handleLinkProductToSupplier = useCallback(async (supplierId: string, product: Product) => {
    if (!store) return
    try {
      const linked = await linkSupplierToProduct(store.id, product.id, supplierId, product.cost_price || product.price, 1)
      if (linked) {
        handleLoadSuppliers()
        setSuccess(t("تم ربط المنتج بالمورد", "Product linked to supplier"))
        setLinkingSupplier(null)
        setLinkProductSearch("")
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch {
      setError(t("فشل ربط المنتج", "Failed to link product"))
    }
  }, [store, handleLoadSuppliers, t])

  // --- Gift Cards ---
  const handleLoadGiftCards = useCallback(async () => {
    if (!store) return
    try {
      const data = await getGiftCards(store.id)
      setGiftCards(data)
    } catch { /* ignore */ }
  }, [store])

  const handleCreateGiftCard = useCallback(async () => {
    if (!store || !newGiftCardBalance) return
    setGiftCardSaving(true)
    setError("")
    try {
      const result = await createGiftCard(store.id, {
        balance: Number(newGiftCardBalance),
        recipient_name: newGiftCardRecipient || undefined,
      })
      if (result && result.code) {
        setNewGiftCardBalance("")
        setNewGiftCardRecipient("")
        handleLoadGiftCards()
        setSuccess(`${t("تم إنشاء بطاقة الهدية - الكود:", "Gift card created - Code:")} ${result.code}`)
        setTimeout(() => setSuccess(""), 5000)
      } else {
        setError(t("فشل إنشاء بطاقة الهدية - تأكد من اتصال الإنترنت", "Failed to create gift card - check internet"))
      }
    } catch {
      setError(t("فشل إنشاء بطاقة الهدية", "Failed to create gift card"))
    }
    setGiftCardSaving(false)
  }, [store, newGiftCardBalance, newGiftCardRecipient, handleLoadGiftCards, t])

  const handleApplyGiftCard = useCallback(async () => {
    if (!store || !giftCardCode.trim()) return
    try {
      const result = await validateGiftCard(store.id, giftCardCode.trim())
      if (result.valid && result.card_id) {
        const useAmount = Math.min(result.balance!, total)
        setAppliedGiftCard({ card_id: result.card_id, code: giftCardCode.trim(), balance: result.balance!, useAmount })
        setSuccess(`${t("تم تطبيق بطاقة الهدية - الرصيد:", "Gift card applied - Balance:")} ${result.balance}`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(result.error || t("بطاقة هدية غير صالحة", "Invalid gift card"))
      }
    } catch {
      setError(t("فشل التحقق من بطاقة الهدية", "Failed to validate gift card"))
    }
  }, [store, giftCardCode, total, t])

  // --- Reservations ---
  const handleLoadReservations = useCallback(async () => {
    if (!store) return
    try {
      const data = await getReservations(store.id)
      setReservations(data)
    } catch { /* ignore */ }
  }, [store])

  const handleCreateReservation = useCallback(async () => {
    if (!store || !reserveProduct || !reserveCustomerName.trim() || !reserveCustomerPhone.trim()) return
    setReserveSaving(true)
    try {
      const hours = reserveHours === "custom" ? 24 : Number(reserveHours)
      const result = await createReservation(store.id, {
        product_id: reserveProduct.id,
        product_name: reserveProduct.name,
        customer_name: reserveCustomerName.trim(),
        customer_phone: reserveCustomerPhone.trim(),
        hours: hours || 24,
        quantity: 1,
        notes: reserveNotes || undefined,
        variant_info: selectedVariant ? `${selectedVariant.size}/${selectedVariant.color}` : undefined,
      })
      if (result) {
        setShowReservationModal(false)
        setReserveProduct(null)
        setReserveCustomerName("")
        setReserveCustomerPhone("")
        setReserveHours("24")
        setReserveNotes("")
        handleLoadReservations()
        setSuccess(t("تم حجز المنتج", "Product reserved"))
        setTimeout(() => setSuccess(""), 2500)
      } else {
        setError(t("فشل حجز المنتج", "Failed to reserve product"))
      }
    } catch {
      setError(t("فشل حجز المنتج", "Failed to reserve product"))
    }
    setReserveSaving(false)
  }, [store, reserveProduct, reserveCustomerName, reserveCustomerPhone, reserveHours, reserveNotes, selectedVariant, handleLoadReservations, t])

  // --- Invoice Discount ---
  const handleSaveInvoiceDiscountRules = useCallback(async () => {
    if (!store) return
    try {
      const result = await saveInvoiceDiscountRules(store.id, invoiceDiscountRules)
      if (result) {
        setSuccess(t("تم حفظ قواعد خصم الفاتورة", "Invoice discount rules saved"))
        setTimeout(() => setSuccess(""), 2500)
      }
    } catch { /* ignore */ }
  }, [store, invoiceDiscountRules, t])

  const handleAddInvoiceRule = useCallback(() => {
    if (!newRuleMin || !newRuleValue) return
    setInvoiceDiscountRules(prev => [...prev, {
      min_amount: Number(newRuleMin),
      discount_type: newRuleType,
      discount_value: Number(newRuleValue),
    }].sort((a, b) => a.min_amount - b.min_amount))
    setNewRuleMin("")
    setNewRuleValue("")
  }, [newRuleMin, newRuleType, newRuleValue])

  // --- Price Tag ---
  const handlePrintPriceTag = useCallback((product: Product) => {
    setPriceTagProduct(product)
    setShowPriceTagModal(true)
  }, [])

  // ===================== Process Sale =====================

  const processSale = async () => {
    if (cart.length === 0 || !store || !user) return

    // Pharmacy: check for expired products before sale
    if (isPharmacy) {
      const productIds = cart.map((item) => item.id)
      const expiryCheck = await batchCheckExpiry(store.id, productIds)
      if (expiryCheck.expired.length > 0) {
        const expiredNames = cart.filter((c) => expiryCheck.expired.includes(c.id)).map((c) => c.name).join(", ")
        setError(`${t("منتجات منتهية الصلاحية:", "Expired products:")} ${expiredNames}`)
        return
      }
      if (expiryCheck.nearExpiry.length > 0) {
        const nearNames = expiryCheck.nearExpiry.map((n) => `${n.name} (${n.days} ${t("يوم", "days")})`).join(", ")
        // Show warning but don't block
        setSuccess(`⚠️ ${t("منتجات قاربت على الانتهاء:", "Near-expiry products:")} ${nearNames}`)
      }
      // Check for prescription-required products
      const prescriptionNeeded = cart.some((item) => pharmacyData[item.id]?.requires_prescription)
      if (prescriptionNeeded && !prescriptionDoctorName.trim()) {
        // Auto-open prescription modal for pharmacy sales with Rx items
        setPrescriptionItems(cart.filter((item) => pharmacyData[item.id]?.requires_prescription).map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
        })))
        setShowPrescriptionModal(true)
        // Don't block sale, just prompt - it's a reminder
      }

      // Check drug interactions
      if (cart.length >= 2) {
        const productIds = cart.map((item) => item.id)
        const interactions = await checkDrugInteractions(store.id, productIds)
        if (interactions.warnings.length > 0) {
          setDrugInteractionWarnings(interactions.warnings)
          // Show warnings but don't block sale
          const warningNames = interactions.warnings
            .filter(w => w.severity === "high")
            .map(w => `⚠️ ${w.product_a} + ${w.product_b}`)
            .join("\n")
          if (warningNames) {
            const confirmed = window.confirm(
              `${t("تحذير تفاعلات دوائية خطيرة!", "Serious Drug Interaction Warning!")}\n\n${warningNames}\n\n${interactions.warnings.filter(w => w.severity === "high").map(w => language === "ar" ? w.description_ar : w.description_en).join("\n")}\n\n${t("هل تريد المتابعة؟", "Do you want to continue?")}`
            )
            if (!confirmed) return
          }
        }
      }

      // Check patient allergies if a patient is selected
      if (selectedPatient) {
        const productIds = cart.map((item) => item.id)
        const allergyCheck = await checkPatientAllergies(store.id, selectedPatient.id, productIds)
        if (allergyCheck.warnings.length > 0) {
          const allergyMsg = allergyCheck.warnings.map(w => `⚠️ ${w.product_name}: ${t("حساسية من", "Allergy to")} ${w.allergy}`).join("\n")
          const confirmed = window.confirm(
            `${t("تحذير حساسية المريض!", "Patient Allergy Warning!")}\n\n${allergyMsg}\n\n${t("هل تريد المتابعة؟", "Do you want to continue?")}`
          )
          if (!confirmed) return
        }
      }
    }

    // Validate payment
    if (useSplitPayment) {
      if (Math.abs(splitPaymentRemaining) > 0.01) {
        setError(t("مجموع الدفع المقسم لا يساوي الإجمالي", "Split payment total doesn't match the total"))
        return
      }
    } else if (paymentMethod === "cash" && (Number(amountPaid) || 0) < total) {
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
        unit_multiplier: item.unit_multiplier,
        unit_label: item.unit_label,
      }))

      const saleData: any = {
        store_id: store.id,
        seller_id: user!.id,
        items: saleItems,
        subtotal,
        discount: normalizedDiscountValue,
        discount_type: discountType,
        tax: 0,
        total,
        amount_paid: useSplitPayment ? total : (paymentMethod === "cash" ? Number(amountPaid) || 0 : total),
        change: useSplitPayment ? 0 : (paymentMethod === "cash" ? change : 0),
        payment_method: useSplitPayment ? "split" : paymentMethod,
        customer_name: customerName || selectedCustomer?.name || undefined,
        customer_phone: customerPhone || selectedCustomer?.phone || undefined,
        notes: notes || undefined,
      }

      // Add split payment details
      if (useSplitPayment && splitPayments.length > 0) {
        saleData.split_payments = splitPayments
      }

      // Add applied coupon info
      if (appliedCoupon) {
        saleData.coupon_code = appliedCoupon.code
        saleData.coupon_id = appliedCoupon.coupon_id
      }

      // Add shift info
      if (currentShift) {
        saleData.shift_id = currentShift.id
      }

      // Add customer id
      if (selectedCustomer) {
        saleData.customer_id = selectedCustomer.id
      }

      // Clothing: add clothing-specific data
      if (isClothing) {
        if (activeSeason) {
          saleData.season_name = activeSeason.season_name
          saleData.season_discount = activeSeason.discount
        }
        if (appliedGiftCard) {
          saleData.gift_card_code = appliedGiftCard.code
          saleData.gift_card_amount = appliedGiftCard.useAmount
        }
        if (loyaltyRedeemPoints > 0 && loyaltyConfig) {
          saleData.loyalty_points_used = loyaltyRedeemPoints
          saleData.loyalty_discount = loyaltyRedeemPoints * (loyaltyConfig.point_value || 0.1)
        }
        if (computedInvoiceDiscount > 0) {
          saleData.invoice_discount = computedInvoiceDiscount
        }
        if (isGiftReceipt) {
          saleData.is_gift_receipt = true
        }
      }

      const result = await createPOSSale(saleData, user!.id)

      if (result.success) {
        setLastSale((result.data ?? null) as Sale | null)
        setShowPayment(false)
        setShowReceipt(true)
        setSuccess(t("تمت عملية البيع بنجاح!", "Sale completed successfully!"))

        // Update local product stock
        setProducts((prev) =>
          prev.map((p) => {
            const cartItems = cart.filter((c) => c.id === p.id)
            if (cartItems.length > 0) {
              const totalPiecesDeducted = cartItems.reduce((sum, c) => sum + c.quantity * (c.unit_multiplier || 1), 0)
              return { ...p, stock: Math.max(0, p.stock - totalPiecesDeducted) }
            }
            return p
          })
        )

        // Mark coupon as used
        if (appliedCoupon) {
          redeemPOSCoupon(store.id, appliedCoupon.coupon_id).catch(() => {})
        }

        // Update customer purchase stats
        if (selectedCustomer && (selectedCustomer.phone || customerPhone)) {
          updateCustomerAfterSale(store.id, selectedCustomer.phone || customerPhone, total).catch(() => {})
        }

        // Pharmacy: create insurance claim if insurance is active
        if (isPharmacy && useInsurance && selectedInsuranceCompany && insurancePolicyNumber.trim() && result.data) {
          createInsuranceClaim({
            store_id: store.id,
            sale_id: result.data.id || result.data.sale_number,
            sale_number: result.data.sale_number,
            insurance_company_id: selectedInsuranceCompany.id,
            policy_number: insurancePolicyNumber.trim(),
            patient_name: customerName || selectedCustomer?.name || prescriptionPatientName || "",
            total_amount: total,
            coverage_percentage: selectedInsuranceCompany.coverage_percentage,
          }).catch(() => {})
        }

        // Reset pharmacy states
        if (isPharmacy) {
          // Record patient medication history
          if (selectedPatient && result.data) {
            const meds = cart.map(item => ({
              product_id: item.id,
              product_name: item.name,
              sale_id: result.data.id || result.data.sale_number,
              quantity: item.quantity,
              doctor_name: prescriptionDoctorName || undefined,
            }))
            recordPatientMedication(store.id, selectedPatient.id, meds).catch(() => {})
          }
          setUseInsurance(false)
          setSelectedInsuranceCompany(null)
          setInsurancePolicyNumber("")
          setDrugInteractionWarnings([])
          setSelectedPatient(null)
        }

        // Clothing: post-sale processing
        if (isClothing) {
          // Update loyalty points
          if (loyaltyCustomer) {
            updateLoyaltyAfterSale(store.id, loyaltyCustomer.id, total, loyaltyRedeemPoints).catch(() => {})
          }
          // Deduct gift card
          if (appliedGiftCard) {
          redeemGiftCard(store.id, appliedGiftCard.card_id, appliedGiftCard.useAmount, result?.data?.id || "").catch(() => {})
          }
          // Update variant stock for ALL variant items in cart
          for (const item of cart) {
            const variantId = cartVariantMap[item.id]
            if (variantId) {
              updateVariantStock(store.id, variantId, -item.quantity).catch(() => {})
            }
          }
          // Reset clothing states
          setAppliedGiftCard(null)
          setGiftCardCode("")
          setLoyaltyRedeemPoints(0)
          setIsGiftReceipt(false)
          setSelectedVariant(null)
        }

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
      const [summary, todayInstallments] = await Promise.all([
        getPOSDailySummary(store.id, undefined, user.id, verifiedPin),
        getInstallments(store.id),
      ])
      // Filter installments created today
      const today = new Date().toISOString().split("T")[0]
      const todayInst = todayInstallments.filter(inst => inst.created_at?.startsWith(today))
      const enrichedSummary: DailySummary = {
        ...summary,
        installmentCount: todayInst.length,
        installmentTotal: todayInst.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        installmentDownPayments: todayInst.reduce((sum, i) => sum + (i.down_payment || 0), 0),
      }
      setDailySummary(enrichedSummary)
      setShowSummary(true)
      if (summary.totalSales === 0 && todayInst.length === 0) {
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
    if (!lastSale || !store) return
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
    // Pharmacy fields
    setQuickAddExpiry("")
    setQuickAddBatch("")
    setQuickAddActiveIngredient("")
    setQuickAddRequiresPrescription(false)
    setQuickAddManufacturer("")
    setQuickAddDosageForm("")
    setQuickAddCustomDosageForm("")
    setShowCustomDosageInput(false)
    setQuickAddStorageConditions("")
    setQuickAddInteractionGroup("")
    setQuickAddCustomInteractionGroup("")
    setShowCustomInteractionInput(false)
    setQuickAddUnitType("")
    setQuickAddPiecePerStrip("")
    setQuickAddStripPerBox("")
    setQuickAddBoxPerCarton("")
    setQuickAddPriceUnit("box")
    setQuickAddDefaultSellingUnit("box")
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
          setError(translatePosError(uploadResult.error, t("فشل رفع الصورة - تأكد من اتصال الإنترنت", "Image upload failed - check internet")))
          setQuickAddLoading(false)
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

        // If pharmacy, save pharmacy-specific fields after product creation
        if (isPharmacy && newProduct.id) {
          const pharmFields: Record<string, any> = {}
          if (quickAddExpiry) pharmFields.expiry_date = quickAddExpiry
          if (quickAddBatch) pharmFields.batch_number = quickAddBatch.trim()
          if (quickAddActiveIngredient) pharmFields.active_ingredient = quickAddActiveIngredient.trim()
          if (quickAddRequiresPrescription) pharmFields.requires_prescription = true
          if (quickAddManufacturer) pharmFields.manufacturer = quickAddManufacturer.trim()
          if (quickAddDosageForm) pharmFields.dosage_form = quickAddDosageForm
          if (quickAddStorageConditions) pharmFields.storage_conditions = quickAddStorageConditions

          if (Object.keys(pharmFields).length > 0) {
            updateProductPharmacyFields(store.id, newProduct.id, pharmFields).catch(() => {})
            // Update local pharmacy data cache
            setPharmacyData(prev => ({ ...prev, [newProduct.id]: { ...pharmFields, requires_prescription: quickAddRequiresPrescription } }))
          }
          if (quickAddInteractionGroup) {
            updateProductInteractionGroup(store.id, newProduct.id, quickAddInteractionGroup).catch(() => {})
          }
          if (quickAddUnitType || quickAddPiecePerStrip || quickAddStripPerBox || quickAddBoxPerCarton) {
            updateProductUnits(store.id, newProduct.id, {
              unit_type: quickAddUnitType || null,
              piece_per_strip: Number(quickAddPiecePerStrip) || null,
              strip_per_box: Number(quickAddStripPerBox) || null,
              box_per_carton: Number(quickAddBoxPerCarton) || null,
              price_unit: quickAddPriceUnit,
              default_selling_unit: quickAddDefaultSellingUnit,
            }).catch(() => {})
          }
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <Image
                src={store.logo_url}
                alt={store.name}
                width={40}
                height={40}
                unoptimized
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

          {/* Desktop action buttons - hidden on mobile, available via bottom sheet */}
          <div className="hidden lg:flex items-center gap-1.5 sm:gap-3">

          {/* Shift Button */}
          <button
            onClick={() => setShowShiftModal(true)}
            className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium ${currentShift ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-gray-400 to-gray-500'} text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95`}
            title={currentShift ? t("وردية مفتوحة", "Shift open") : t("فتح وردية", "Open shift")}
          >
            {currentShift ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            <span className="hidden sm:inline">{currentShift ? t("الوردية", "Shift") : t("فتح وردية", "Open Shift")}</span>
          </button>

          {/* Return Button */}
          <button
            onClick={() => setShowReturn(true)}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-xl hover:shadow-orange-500/30 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            title={t("مرتجعات", "Returns")}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{t("مرتجعات", "Returns")}</span>
          </button>

          {/* Pharmacy Buttons */}
          {isPharmacy && (
            <>
              <button
                onClick={() => { loadExpiryAlerts(); setShowExpiryAlerts(true) }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-red-500 to-red-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("تنبيهات الصلاحية", "Expiry Alerts")}
              >
                <CalendarClock className="h-4 w-4" />
                <span className="hidden sm:inline">{t("الصلاحية", "Expiry")}</span>
                {expiryAlerts.filter(a => a.status === "expired").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-800 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {expiryAlerts.filter(a => a.status === "expired").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setShowPrescriptionHistory(true); handleLoadPrescriptionHistory() }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-teal-500 to-teal-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("الروشتات", "Prescriptions")}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{t("روشتات", "Rx")}</span>
              </button>
              <button
                onClick={() => { loadInsuranceCompanies(); setShowInsuranceModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("التأمين", "Insurance")}
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">{t("تأمين", "Insurance")}</span>
              </button>
              <button
                onClick={() => { setShowPatientModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("ملف المريض", "Patient File")}
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">{t("مريض", "Patient")}</span>
              </button>
              <button
                onClick={async () => {
                  setBatchInventoryLoading(true); setShowBatchInventory(true)
                  const items = await getBatchInventory(store!.id); setBatchInventoryItems(items); setBatchInventoryLoading(false)
                }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("جرد بالباتش", "Batch Inventory")}
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">{t("باتش", "Batch")}</span>
              </button>
              <button
                onClick={async () => {
                  setFefoLoading(true); setShowFEFO(true)
                  const items = await getFEFOProducts(store!.id); setFefoItems(items); setFefoLoading(false)
                }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("FEFO - الأقرب انتهاءً أولاً", "FEFO - First Expired First Out")}
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">FEFO</span>
              </button>
            </>
          )}

          {/* Clothing Buttons */}
          {isClothing && (
            <>
              <button
                onClick={() => setShowLoyaltyModal(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("برنامج الولاء", "Loyalty")}
              >
                <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">{t("ولاء", "Loyalty")}</span>
              </button>
              <button
                onClick={() => { handleLoadInstallments(); setShowInstallmentModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-pink-500 to-pink-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("تقسيط", "Installments")}
              >
                <CircleDollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">{t("تقسيط", "Install")}</span>
              </button>
              <button
                onClick={() => { handleLoadSeasons(); setShowSeasonModal(true) }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("إدارة المواسم", "Seasons")}
              >
                <Snowflake className="h-4 w-4" />
                <span className="hidden sm:inline">{t("موسم", "Season")}</span>
                {activeSeason && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-cyan-800 text-[9px] font-bold px-1.5 h-4 rounded-full flex items-center justify-center">
                    {activeSeason.discount}%
                  </span>
                )}
              </button>
              <button
                onClick={() => { handleLoadSuppliers(); setShowSupplierModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-slate-500 to-slate-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("الموردين", "Suppliers")}
              >
                <Truck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("موردين", "Suppliers")}</span>
              </button>
              <button
                onClick={() => { handleLoadGiftCards(); setShowGiftCardModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-fuchsia-500 to-fuchsia-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("بطاقات الهدايا", "Gift Cards")}
              >
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">{t("هدايا", "Gifts")}</span>
              </button>
              <button
                onClick={() => { handleLoadReservations(); setShowReservationModal(true) }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-lime-500 to-lime-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("الحجوزات", "Reservations")}
              >
                <BookmarkCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t("حجز", "Reserve")}</span>
                {reservations.filter(r => r.status === "active").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-lime-800 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {reservations.filter(r => r.status === "active").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowInvoiceDiscountModal(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("خصم الفاتورة", "Invoice Discount")}
              >
                <PercentCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{t("خصم فاتورة", "Inv. Disc.")}</span>
              </button>
            </>
          )}

          {/* Online Store Buttons */}
          {isOnline && (
            <>
              <button
                onClick={async () => {
                  setOnlineOrdersLoading(true); setShowOnlineOrdersModal(true)
                  const orders = await getIncomingOnlineOrders(store!.id)
                  setOnlineOrders(orders); setOnlineOrdersLoading(false)
                }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("الطلبات الواردة", "Incoming Orders")}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">{t("طلبات", "Orders")}</span>
                {onlineOrders.filter(o => o.status === "pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-blue-800 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {onlineOrders.filter(o => o.status === "pending").length}
                  </span>
                )}
              </button>
              <button
                onClick={async () => {
                  setShippingZonesLoading(true); setShowShippingModal(true)
                  const zones = await getShippingZones(store!.id)
                  setShippingZones(zones); setShippingZonesLoading(false)
                }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("مناطق الشحن", "Shipping Zones")}
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">{t("شحن", "Ship")}</span>
              </button>
              <button
                onClick={() => setShowPaymentConfigModal(true)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("طرق الدفع", "Payment Methods")}
              >
                <Smartphone className="h-4 w-4" />
                <span className="hidden sm:inline">{t("دفع", "Pay")}</span>
              </button>
              <button
                onClick={async () => {
                  setLowStockLoading(true); setShowLowStockModal(true)
                  const items = await getLowStockProducts(store!.id, lowStockThreshold)
                  setLowStockProducts(items); setLowStockLoading(false)
                }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("تنبيه المخزون", "Low Stock")}
              >
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">{t("مخزون", "Stock")}</span>
                {lowStockProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-orange-800 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {lowStockProducts.length}
                  </span>
                )}
              </button>
              <button
                onClick={async () => {
                  setOnlineReturnsLoading(true); setShowOnlineReturnsModal(true)
                  const rets = await getOnlineReturns(store!.id)
                  setOnlineReturns(rets); setOnlineReturnsLoading(false)
                }}
                className="relative flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-red-500 to-red-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("مرتجعات اونلاين", "Online Returns")}
              >
                <Undo2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t("مرتجعات", "Returns")}</span>
                {onlineReturns.filter(r => r.status === "pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-800 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {onlineReturns.filter(r => r.status === "pending").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setShowOnlineReportModal(true) }}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-teal-500 to-teal-600 text-white px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl transition-all hover:shadow-lg active:scale-95"
                title={t("تقارير الأونلاين", "Online Reports")}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">{t("تقارير", "Reports")}</span>
              </button>
            </>
          )}

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
          </div>{/* end hidden lg:flex */}
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
          w-[92vw] sm:w-[380px] bg-white flex flex-col border-l border-gray-200 shadow-lg
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
            <div className="flex items-center gap-1">
              {/* Hold Cart */}
              {cart.length > 0 && (
                <button
                  onClick={handleHoldCart}
                  className="text-amber-600 hover:text-amber-700 text-xs flex items-center gap-1 hover:bg-amber-50 px-2 py-1 rounded-lg transition"
                  title={t("تعليق السلة", "Hold Cart")}
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("تعليق", "Hold")}</span>
                </button>
              )}
              {/* Held Carts */}
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setShowHeldCarts(true)}
                  className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg transition relative"
                  title={t("السلات المعلقة", "Held Carts")}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("معلقة", "Held")}</span>
                  <span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 rounded-full">{heldCarts.length}</span>
                </button>
              )}
              {/* Clear All */}
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("مسح", "Clear")}
                </button>
              )}
            </div>
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
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      width={40}
                      height={40}
                      unoptimized
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
                    <div className="flex items-center gap-1">
                      <p className="text-emerald-600 text-xs font-medium">
                        {item.price.toFixed(2)} {currencyLabel}
                      </p>
                      {item.unit_label && (
                        <span className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded-full font-medium">
                          {item.unit_label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1, item.unit_multiplier)}
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition active:scale-90"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateQuantity(item.id, parseInt(e.target.value) || 0, item.unit_multiplier)
                      }
                      className="w-10 h-9 sm:h-7 text-center bg-gray-50 text-gray-800 font-medium rounded-lg text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1, item.unit_multiplier)}
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition active:scale-90"
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
            <div className="flex justify-between text-gray-800 text-base sm:text-lg font-bold pt-2 border-t border-gray-200">
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
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white py-3.5 sm:py-3 rounded-xl font-bold text-base sm:text-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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
                  className="w-full h-10 sm:h-11 bg-gray-50 text-gray-800 rounded-xl pr-9 sm:pr-11 pl-4 text-sm sm:text-sm border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
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
                className="h-10 sm:h-11 px-2 sm:px-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all flex items-center gap-1.5"
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
                className={`h-10 sm:h-11 px-2 sm:px-3 rounded-xl transition-all flex items-center gap-1.5 ${
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
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin pos-scroll">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
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
                  className={`px-3 py-2 sm:py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
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
          <div className="flex-1 overflow-y-auto p-3 pb-24 lg:pb-3 bg-gray-50">
            {filteredProducts.length === 0 ? (
              <div className="text-center text-gray-400 py-20">
                <Package className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 opacity-30" />
                <p className="text-base sm:text-lg text-gray-600 font-medium">{t("لا توجد منتجات", "No products found")}</p>
                {searchQuery && (
                  <p className="text-sm mt-1 text-gray-500">
                    {t("لم يتم العثور على نتائج لـ", "No results found for")} &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((item) => item.id === product.id)
                  const outOfStock = product.stock <= 0

                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        if (outOfStock) return
                        if (isClothing && productVariants[product.id]?.length > 0) {
                          handleVariantPick(product)
                        } else if (isPharmacy && pharmacyData[product.id] && (pharmacyData[product.id].piece_per_strip || pharmacyData[product.id].strip_per_box)) {
                          // Show unit picker for pharmacy products with unit config
                          setUnitPickerProduct(product)
                          setShowUnitPicker(true)
                        } else {
                          addToCart(product)
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !outOfStock) {
                          e.preventDefault()
                          if (isClothing && productVariants[product.id]?.length > 0) {
                            handleVariantPick(product)
                          } else if (isPharmacy && pharmacyData[product.id] && (pharmacyData[product.id].piece_per_strip || pharmacyData[product.id].strip_per_box)) {
                            setUnitPickerProduct(product)
                            setShowUnitPicker(true)
                          } else {
                            addToCart(product)
                          }
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
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={200}
                            height={200}
                            unoptimized
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

                      <div className="relative z-20 mt-2 hidden lg:grid grid-cols-2 gap-1.5">
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
                        {isPharmacy && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openPharmacyEdit(product) }}
                              className="h-8 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition flex items-center justify-center gap-1"
                            >
                              <Pill className="h-3 w-3" />
                              {t("دوائي", "Pharma")}
                            </button>
                            {pharmacyData[product.id]?.active_ingredient && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleLoadAlternatives(product.id) }}
                                className="h-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition flex items-center justify-center gap-1"
                              >
                                <FlaskConical className="h-3 w-3" />
                                {t("بدائل", "Alt.")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDrugLabelProduct(product); setDrugLabelInstructions(""); setDrugLabelData(null); setShowDrugLabelModal(true) }}
                              className="h-8 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition flex items-center justify-center gap-1"
                            >
                              <Printer className="h-3 w-3" />
                              {t("ملصق", "Label")}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setUnitProduct(product)
                                const pd = pharmacyData[product.id]
                                setUnitEditPiecePerStrip(pd?.piece_per_strip?.toString() || "")
                                setUnitEditStripPerBox(pd?.strip_per_box?.toString() || "")
                                setUnitEditBoxPerCarton(pd?.box_per_carton?.toString() || "")
                                setUnitEditPriceUnit(pd?.price_unit || "box")
                                setUnitEditDefaultSelling(pd?.default_selling_unit || "box")
                                setShowUnitModal(true)
                              }}
                              className="h-8 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 transition flex items-center justify-center gap-1"
                            >
                              <Package className="h-3 w-3" />
                              {t("وحدات", "Units")}
                            </button>
                          </>
                        )}
                        {isClothing && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenVariantManager(product) }}
                              className="h-8 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition flex items-center justify-center gap-1"
                            >
                              <Ruler className="h-3 w-3" />
                              {t("مقاسات", "Sizes")}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setReserveProduct(product); setShowReservationModal(true) }}
                              className="h-8 rounded-lg border border-lime-200 bg-lime-50 text-lime-700 text-xs font-semibold hover:bg-lime-100 transition flex items-center justify-center gap-1"
                            >
                              <BookmarkCheck className="h-3 w-3" />
                              {t("حجز", "Hold")}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handlePrintPriceTag(product) }}
                              className="h-8 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition flex items-center justify-center gap-1"
                            >
                              <QrCode className="h-3 w-3" />
                              {t("سعر", "Tag")}
                            </button>
                          </>
                        )}
                      </div>

                      {/* Mobile context menu button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenuProduct(product)
                        }}
                        className="lg:hidden relative z-20 mt-1.5 w-full min-h-[36px] rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-xs font-medium hover:bg-gray-100 transition flex items-center justify-center gap-1"
                      >
                        <StickyNote className="h-3 w-3" />
                        {t("إدارة", "Manage")}
                      </button>

                      {/* Clothing Badges */}
                      {isClothing && (
                        <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                          {activeSeason && (
                            <span className="bg-cyan-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                              -{activeSeason.discount}%
                            </span>
                          )}
                          {productVariants[product.id] && productVariants[product.id].length > 0 && (
                            <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                              {productVariants[product.id].length} {t("مقاس", "var")}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pharmacy Badges */}
                      {isPharmacy && pharmacyData[product.id] && (
                        <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                          {pharmacyData[product.id]?.requires_prescription && (
                            <span className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">Rx</span>
                          )}
                          {(() => {
                            const exp = pharmacyData[product.id]?.expiry_date
                            if (!exp) return null
                            const days = Math.ceil((new Date(exp).getTime() - Date.now()) / (1000*60*60*24))
                            if (days <= 0) return <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow animate-pulse">{t("منتهي", "EXP")}</span>
                            if (days <= 30) return <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">{days}d</span>
                            if (days <= 90) return <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">{days}d</span>
                            return null
                          })()}
                        </div>
                      )}

                      {/* Online Badges */}
                      {isOnline && (
                        <div className="absolute top-1 right-1 flex flex-col gap-0.5">
                          {product.stock <= lowStockThreshold && product.stock > 0 && (
                            <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
                              {t("مخزون قليل", "Low")} ({product.stock})
                            </span>
                          )}
                        </div>
                      )}

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

      {/* ===== Mobile Bottom Bar ===== */}
      <POSBottomBar
        cartCount={cartItemsCount}
        cartTotal={total}
        currencyLabel={currencyLabel}
        onCartToggle={() => setShowMobileCart(!showMobileCart)}
        onToolsToggle={() => setShowMobileTools(true)}
        t={t}
        isCartOpen={showMobileCart}
      />

      {/* ===== Mobile Actions Sheet ===== */}
      <POSMobileActionsSheet
        open={showMobileTools}
        onClose={() => setShowMobileTools(false)}
        t={t}
        isPharmacy={isPharmacy}
        isClothing={isClothing}
        currentShift={currentShift}
        heldCartsCount={heldCarts.length}
        onShift={() => setShowShiftModal(true)}
        onReturn={() => setShowReturn(true)}
        onHistory={() => openProtectedPOSAction("history")}
        onSummary={() => openProtectedPOSAction("summary")}
        onHeldCarts={() => setShowHeldCarts(true)}
        onQuickAdd={() => { resetQuickAddForm(); setShowQuickAdd(true) }}
        onExpiryAlerts={() => { loadExpiryAlerts(); setShowExpiryAlerts(true) }}
        onPrescription={() => setShowPrescriptionModal(true)}
        onPrescriptionHistory={() => { searchPrescriptions(store!.id, "").then(setPrescriptionHistory); setShowPrescriptionHistory(true) }}
        onInsurance={() => { loadInsuranceCompanies(); setShowInsuranceModal(true) }}
        onPatient={() => setShowPatientModal(true)}
        onBatchInventory={async () => { setBatchInventoryLoading(true); setShowBatchInventory(true); const items = await getBatchInventory(store!.id); setBatchInventoryItems(items); setBatchInventoryLoading(false) }}
        onFEFO={async () => { setFefoLoading(true); setShowFEFO(true); const items = await getFEFOProducts(store!.id); setFefoItems(items); setFefoLoading(false) }}
        onLoyalty={() => setShowLoyaltyModal(true)}
        onInstallment={() => { handleLoadInstallments(); setShowInstallmentModal(true) }}
        onSeason={() => { handleLoadSeasons(); setShowSeasonModal(true) }}
        onSupplier={() => { handleLoadSuppliers(); setShowSupplierModal(true) }}
        onGiftCard={() => { handleLoadGiftCards(); setShowGiftCardModal(true) }}
        onReservation={() => { handleLoadReservations(); setShowReservationModal(true) }}
        onInvoiceDiscount={() => setShowInvoiceDiscountModal(true)}
        isOnline={isOnline}
        onOnlineOrders={async () => { setOnlineOrdersLoading(true); setShowOnlineOrdersModal(true); const orders = await getIncomingOnlineOrders(store!.id); setOnlineOrders(orders); setOnlineOrdersLoading(false) }}
        onShippingZones={async () => { setShippingZonesLoading(true); setShowShippingModal(true); const zones = await getShippingZones(store!.id); setShippingZones(zones); setShippingZonesLoading(false) }}
        onPaymentConfig={() => setShowPaymentConfigModal(true)}
        onLowStock={async () => { setLowStockLoading(true); setShowLowStockModal(true); const items = await getLowStockProducts(store!.id, lowStockThreshold); setLowStockProducts(items); setLowStockLoading(false) }}
        onOnlineReturns={async () => { setOnlineReturnsLoading(true); setShowOnlineReturnsModal(true); const rets = await getOnlineReturns(store!.id); setOnlineReturns(rets); setOnlineReturnsLoading(false) }}
        onOnlineReports={() => setShowOnlineReportModal(true)}
        onlineOrdersBadge={onlineOrders.filter(o => o.status === "pending").length || undefined}
        lowStockBadge={lowStockProducts.length || undefined}
        onlineReturnsBadge={onlineReturns.filter(r => r.status === "pending").length || undefined}
      />

      {/* ===== Product Context Menu (Mobile) ===== */}
      <POSProductContextMenu
        open={!!contextMenuProduct}
        onClose={() => setContextMenuProduct(null)}
        productName={contextMenuProduct?.name || ""}
        t={t}
        isPharmacy={isPharmacy}
        isClothing={isClothing}
        onEdit={() => { if (contextMenuProduct) openEditProductModal(contextMenuProduct) }}
        onAddStock={() => { if (contextMenuProduct) openAddStockModal(contextMenuProduct) }}
        onPharmacyEdit={() => { if (contextMenuProduct) openPharmacyEdit(contextMenuProduct) }}
        onAlternatives={() => { if (contextMenuProduct) handleLoadAlternatives(contextMenuProduct.id) }}
        onDrugLabel={() => { if (contextMenuProduct) { setDrugLabelProduct(contextMenuProduct); setDrugLabelInstructions(""); setDrugLabelData(null); setShowDrugLabelModal(true) } }}
        onUnitModal={() => {
          if (contextMenuProduct) {
            setUnitProduct(contextMenuProduct)
            const pd = pharmacyData[contextMenuProduct.id]
            setUnitEditPiecePerStrip(pd?.piece_per_strip?.toString() || "")
            setUnitEditStripPerBox(pd?.strip_per_box?.toString() || "")
            setUnitEditBoxPerCarton(pd?.box_per_carton?.toString() || "")
            setUnitEditPriceUnit(pd?.price_unit || "box")
            setUnitEditDefaultSelling(pd?.default_selling_unit || "box")
            setShowUnitModal(true)
          }
        }}
        onVariantManager={() => { if (contextMenuProduct) handleOpenVariantManager(contextMenuProduct) }}
        onReservation={() => { if (contextMenuProduct) { setReserveProduct(contextMenuProduct); setShowReservationModal(true) } }}
        onPriceTag={() => { if (contextMenuProduct) handlePrintPriceTag(contextMenuProduct) }}
        isOnline={isOnline}
        onTierPricing={() => {
          if (contextMenuProduct) {
            setTierPricingProduct(contextMenuProduct)
            getTierPricing(store!.id, contextMenuProduct.id).then(tiers => {
              setTierPricingRows(tiers.map(t => ({ min_qty: t.min_qty.toString(), price: t.price.toString() })))
              setShowTierPricingModal(true)
            })
          }
        }}
      />

      {/* ===== Payment Modal ===== */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <h2 className="text-gray-800 text-base sm:text-lg font-bold flex items-center gap-2">
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

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-h-[70dvh] md:max-h-[65vh] overflow-y-auto bg-gray-50">
              {/* Pharmacy: Patient Selection — shown first for pharmacy stores */}
              {isPharmacy && (
                <div className="space-y-2 bg-purple-50 rounded-xl p-3 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <label className="text-purple-800 text-sm font-bold flex items-center gap-1.5">
                      <User className="h-4 w-4 text-purple-600" />
                      {t("ربط بمريض", "Link to Patient")}
                    </label>
                    {selectedPatient ? (
                      <button onClick={() => setSelectedPatient(null)}
                        className="text-xs text-red-500 hover:text-red-600">{t("إزالة", "Remove")}</button>
                    ) : (
                      <button onClick={() => setShowPatientModal(true)}
                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition">
                        <Search className="h-3 w-3" />
                        {t("بحث عن مريض", "Search Patient")}
                      </button>
                    )}
                  </div>
                  {selectedPatient && (
                    <div className="bg-white border border-purple-200 rounded-xl px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-500" />
                        <div>
                          <span className="text-sm font-medium text-purple-700">{selectedPatient.name}</span>
                          {selectedPatient.phone && <span className="text-[10px] text-gray-500 mr-2">📱 {selectedPatient.phone}</span>}
                          {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full mr-2">⚠️ {selectedPatient.allergies.length} {t("حساسية", "allergies")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5 text-purple-500" />
                    {t("كود خصم", "Coupon Code")}
                  </label>
                  {appliedCoupon && (
                    <button onClick={() => { setAppliedCoupon(null); setCouponCode(""); setDiscount(""); }}
                      className="text-xs text-red-500 hover:text-red-600">{t("إزالة", "Remove")}</button>
                  )}
                </div>
                {appliedCoupon ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-purple-700">{appliedCoupon.code}</span>
                    <span className="text-xs text-purple-500">{appliedCoupon.type === "percentage" ? `${appliedCoupon.value}%` : `${appliedCoupon.value} ${currencyLabel}`}</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                      placeholder={t("أدخل كود الخصم...", "Enter coupon code...")}
                      className="flex-1 h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
                    <button onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white px-3 rounded-xl text-sm font-medium transition">
                      {couponLoading ? "..." : t("تطبيق", "Apply")}
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Method Toggle: Normal vs Split */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    {t("طريقة الدفع", "Payment Method")}
                  </label>
                  <button
                    onClick={() => setUseSplitPayment(!useSplitPayment)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${useSplitPayment ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    <Split className="h-3 w-3" />
                    {t("تقسيم الدفع", "Split Payment")}
                  </button>
                </div>

                {!useSplitPayment ? (
                  /* Normal Payment */
                  <div>
                    <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("المبلغ المدفوع (نقدي)", "Amount Paid (Cash)")}</label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="w-full h-12 bg-white text-gray-800 text-lg font-semibold rounded-xl px-4 border-2 border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      autoFocus
                    />
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
                ) : (
                  /* Split Payment */
                  <div className="space-y-2">
                    {splitPayments.length > 0 && (
                      <div className="space-y-1.5">
                        {splitPayments.map((sp, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <span className="text-sm text-gray-700">{sp.method === "cash" ? t("نقدي", "Cash") : sp.method === "card" ? t("بطاقة", "Card") : t("محفظة", "Wallet")}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-800">{sp.amount.toFixed(2)} {currencyLabel}</span>
                              <button onClick={() => removeSplitPayment(idx)} className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {splitPaymentRemaining > 0.01 && (
                      <div className="flex gap-2">
                        <select value={splitMethod} onChange={(e) => setSplitMethod(e.target.value as any)}
                          className="h-10 bg-white text-gray-800 rounded-lg px-2 text-sm border border-gray-200">
                          <option value="cash">{t("نقدي", "Cash")}</option>
                          <option value="card">{t("بطاقة", "Card")}</option>
                          <option value="wallet">{t("محفظة", "Wallet")}</option>
                        </select>
                        <input type="number" value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)}
                          placeholder={splitPaymentRemaining.toFixed(2)} min="0" step="0.01"
                          className="flex-1 h-10 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={addSplitPayment}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 rounded-lg text-sm font-medium transition">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <div className="flex justify-between text-sm bg-indigo-50 rounded-lg px-3 py-2">
                      <span className="text-indigo-700">{t("المتبقي", "Remaining")}</span>
                      <span className={`font-bold ${splitPaymentRemaining > 0.01 ? "text-red-500" : "text-green-600"}`}>{splitPaymentRemaining.toFixed(2)} {currencyLabel}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Info (Optional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {t("بيانات العميل (اختياري)", "Customer Details (Optional)")}
                  </label>
                  <button onClick={() => setShowCustomerSearch(true)}
                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600">
                    <Users className="h-3 w-3" />
                    {t("بحث", "Search")}
                  </button>
                </div>
                {selectedCustomer && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-indigo-700">{selectedCustomer.name}</span>
                      {selectedCustomer.loyalty_points > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mr-2">{selectedCustomer.loyalty_points} {t("نقطة", "pts")}</span>
                      )}
                    </div>
                    <button onClick={() => { setSelectedCustomer(null); setCustomerName(""); setCustomerPhone("") }}
                      className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
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

              {/* Pharmacy: Insurance Option */}
              {isPharmacy && insuranceCompanies.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-blue-500" />
                      {t("تأمين صحي", "Health Insurance")}
                    </label>
                    <button onClick={() => setUseInsurance(!useInsurance)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition ${useInsurance ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      <Shield className="h-3 w-3" />
                      {useInsurance ? t("مفعّل", "Active") : t("تفعيل", "Enable")}
                    </button>
                  </div>
                  {useInsurance && (
                    <div className="bg-blue-50 rounded-xl p-3 space-y-2 border border-blue-200">
                      <select value={selectedInsuranceCompany?.id || ""} onChange={(e) => {
                        const c = insuranceCompanies.find((ic) => ic.id === e.target.value)
                        setSelectedInsuranceCompany(c || null)
                      }} className="w-full h-10 bg-white text-gray-800 rounded-lg px-2 text-sm border border-gray-200">
                        <option value="">{t("اختر شركة التأمين...", "Select insurance...")}</option>
                        {insuranceCompanies.filter((c) => c.is_active).map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.coverage_percentage}%)</option>
                        ))}
                      </select>
                      {selectedInsuranceCompany && (
                        <>
                          <input type="text" value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                            placeholder={t("رقم البوليصة / كارنيه التأمين", "Policy / Card number")}
                            className="w-full h-10 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500" />
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{t("على التأمين:", "Insurance pays:")}</span>
                            <span className="font-bold text-blue-600">{(total * selectedInsuranceCompany.coverage_percentage / 100).toFixed(2)} {currencyLabel}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{t("على المريض:", "Patient pays:")}</span>
                            <span className="font-bold text-emerald-600">{(total * (100 - selectedInsuranceCompany.coverage_percentage) / 100).toFixed(2)} {currencyLabel}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Clothing: Gift Card */}
              {isClothing && (
                <div className="space-y-2">
                  <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5 text-fuchsia-500" />
                    {t("بطاقة هدية", "Gift Card")}
                  </label>
                  {appliedGiftCard ? (
                    <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl px-3 py-2 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-fuchsia-700">{appliedGiftCard.code}</span>
                        <span className="text-xs text-fuchsia-500 mr-2">-{appliedGiftCard.useAmount.toFixed(2)} {currencyLabel}</span>
                      </div>
                      <button onClick={() => { setAppliedGiftCard(null); setGiftCardCode("") }}
                        className="text-xs text-red-500 hover:text-red-600">{t("إزالة", "Remove")}</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value)}
                        placeholder={t("أدخل كود البطاقة...", "Enter card code...")}
                        className="flex-1 h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-fuchsia-500" />
                      <button onClick={handleApplyGiftCard} disabled={!giftCardCode.trim()}
                        className="bg-fuchsia-500 hover:bg-fuchsia-600 disabled:bg-gray-300 text-white px-3 rounded-xl text-sm font-medium transition">
                        {t("تطبيق", "Apply")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Clothing: Loyalty Points */}
              {isClothing && loyaltyCustomer && loyaltyCustomer.points > 0 && loyaltyConfig && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-700 text-sm font-medium flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      {t("استبدال نقاط الولاء", "Redeem Loyalty Points")}
                    </label>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{loyaltyCustomer.points} {t("نقطة", "pts")}</span>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" value={loyaltyRedeemPoints} onChange={(e) => setLoyaltyRedeemPoints(Math.min(Number(e.target.value) || 0, loyaltyCustomer.points))}
                      placeholder="0" min="0" max={loyaltyCustomer.points}
                      className="flex-1 h-9 bg-white text-gray-800 rounded-lg px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-amber-500" />
                    <span className="flex items-center text-xs text-gray-500">= {((loyaltyRedeemPoints || 0) * (loyaltyConfig.point_value || 0.1)).toFixed(2)} {currencyLabel}</span>
                  </div>
                </div>
              )}

              {/* Clothing: Gift Receipt & Invoice Discount */}
              {isClothing && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsGiftReceipt(!isGiftReceipt)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition ${isGiftReceipt ? "bg-pink-100 text-pink-700 ring-1 ring-pink-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                    <Gift className="h-3 w-3" />
                    {t("إيصال هدية", "Gift Receipt")}
                  </button>
                  {computedInvoiceDiscount > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1.5 rounded-full">
                      <PercentCircle className="h-3 w-3" />
                      {t("خصم فاتورة:", "Inv. Disc:")} -{computedInvoiceDiscount.toFixed(2)} {currencyLabel}
                    </span>
                  )}
                </div>
              )}

              {/* Pharmacy: Patient Selection for Sale — MOVED: now at top of payment modal */}

              {/* Pharmacy: Drug Interaction Warnings */}
              {isPharmacy && drugInteractionWarnings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <p className="text-sm font-bold text-red-700">{t("تحذيرات تداخل دوائي", "Drug Interaction Warnings")}</p>
                  </div>
                  {drugInteractionWarnings.map((warning, idx) => (
                    <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg ${warning.severity === "high" ? "bg-red-100 border border-red-200" : warning.severity === "medium" ? "bg-orange-100 border border-orange-200" : "bg-yellow-100 border border-yellow-200"}`}>
                      <AlertOctagon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${warning.severity === "high" ? "text-red-600" : warning.severity === "medium" ? "text-orange-600" : "text-yellow-600"}`} />
                      <div>
                        <p className="text-xs font-bold text-gray-800">{warning.product_a} ↔ {warning.product_b}</p>
                        <p className="text-xs text-gray-600">{language === "ar" ? warning.description_ar : warning.description_en}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${warning.severity === "high" ? "bg-red-200 text-red-800" : warning.severity === "medium" ? "bg-orange-200 text-orange-800" : "bg-yellow-200 text-yellow-800"}`}>
                          {warning.severity === "high" ? t("خطورة عالية", "High Severity") : warning.severity === "medium" ? t("خطورة متوسطة", "Medium") : t("خطورة منخفضة", "Low")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                {isClothing && computedInvoiceDiscount > 0 && (
                  <div className="flex justify-between text-yellow-600 text-sm">
                    <span>{t("خصم الفاتورة", "Invoice Discount")}</span>
                    <span className="font-medium">-{computedInvoiceDiscount.toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
                {isClothing && appliedGiftCard && (
                  <div className="flex justify-between text-fuchsia-600 text-sm">
                    <span>{t("بطاقة هدية", "Gift Card")}</span>
                    <span className="font-medium">-{appliedGiftCard.useAmount.toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
                {isClothing && loyaltyRedeemPoints > 0 && loyaltyConfig && (
                  <div className="flex justify-between text-amber-600 text-sm">
                    <span>{t("نقاط الولاء", "Loyalty Points")}</span>
                    <span className="font-medium">-{(loyaltyRedeemPoints * (loyaltyConfig.point_value || 0.1)).toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
                {isClothing && activeSeason && (
                  <div className="flex justify-between text-cyan-600 text-sm">
                    <span>{t("خصم الموسم", "Season Discount")} ({activeSeason.season_name}) {activeSeason.discount}%</span>
                    <span className="font-medium">-{(subtotal * activeSeason.discount / 100).toFixed(2)} {currencyLabel}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-800 font-bold text-base sm:text-lg border-t border-gray-200 pt-1.5">
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
                  (useSplitPayment ? splitPaymentRemaining > 0.01 : (Number(amountPaid) || 0) < total)
                }
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-white py-3 rounded-xl font-bold text-base sm:text-lg transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
            {/* Receipt Content */}
            <div className="p-4 sm:p-6 text-center" id="receipt">
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

              {/* Patient info in receipt */}
              {isPharmacy && selectedPatient && (
                <div className="text-xs text-gray-600 mb-2 bg-purple-50 rounded-lg px-2 py-1.5 text-right">
                  <span className="font-medium">{t("المريض:", "Patient:")}</span> {selectedPatient.name}
                  {selectedPatient.phone && <span className="mr-2"> 📱 {selectedPatient.phone}</span>}
                </div>
              )}

              {/* Items */}
              <div className="space-y-1.5 text-sm">
                {lastSale.items.map((item: POSSaleItem, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-right flex-1">
                      {item.name} × {item.quantity}
                      {item.unit_label && <span className="text-[10px] text-cyan-600 mr-1">({item.unit_label})</span>}
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
                <div className="bg-white p-2 sm:p-3 rounded-xl border-2 border-gray-200 shadow-sm">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/pos/receipt?id=${encodeURIComponent(String(lastSale.id))}`}
                    size={120}
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
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
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
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl max-h-[95dvh] md:max-h-[80vh] flex flex-col shadow-2xl" dir={pageDir}>
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
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                    {(activeMonthlyHistory?.totalRevenue || 0).toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs font-medium mt-1">
                    {t("إجمالي الإيرادات", "Total Revenue")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                  <p className="text-xl sm:text-2xl font-bold text-violet-600">
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
                <div className="max-h-[45dvh] md:max-h-[42vh] overflow-y-auto space-y-2 pr-1">
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
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
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                    {dailySummary.totalSales}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">{t("عمليات البيع", "Sales")}</p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                    {dailySummary.totalRevenue.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">
                    {t("إجمالي الإيرادات", "Total Revenue")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-violet-600">
                    {dailySummary.totalItems}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">{t("المنتجات المباعة", "Items Sold")}</p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-violet-600">
                    {dailySummary.averageOrderValue.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">
                    {t("متوسط الطلب", "Average Order")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                    {dailySummary.netProfit.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">
                    {t("صافي الربح", "Net Profit")} ({currencyLabel})
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 sm:p-4 text-center shadow-sm">
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                    {dailySummary.cashInTotal.toFixed(2)}
                  </p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-1 font-medium">
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

              {/* Installments Section */}
              {(dailySummary.installmentCount || 0) > 0 && (
                <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-orange-100">
                  <h3 className="text-gray-800 font-bold mb-3 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-orange-500" />
                    {t("الأقساط اليوم", "Today's Installments")}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">{t("عدد الأقساط", "Installment Plans")}</span>
                      <span className="text-orange-600 font-bold">{dailySummary.installmentCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">{t("إجمالي مبلغ الأقساط", "Total Installment Amount")}</span>
                      <span className="text-orange-600 font-bold">{(dailySummary.installmentTotal || 0).toFixed(2)} {currencyLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">{t("المقدمات المدفوعة", "Down Payments")}</span>
                      <span className="text-green-600 font-bold">{(dailySummary.installmentDownPayments || 0).toFixed(2)} {currencyLabel}</span>
                    </div>
                  </div>
                </div>
              )}
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
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
              {/* Error inside edit modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 mr-2"><X className="h-4 w-4" /></button>
                </div>
              )}
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir}>
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
              {/* Error inside add-stock modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 mr-2"><X className="h-4 w-4" /></button>
                </div>
              )}
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[95dvh] md:max-h-[90vh]" dir={pageDir}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white shrink-0">
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

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Error/Success inside modal */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 mr-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              )}

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
                    <Image
                      src={quickAddImagePreview}
                      alt={t("معاينة صورة المنتج", "Product image preview")}
                      width={400}
                      height={160}
                      unoptimized
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

              {/* ===== Pharmacy-specific fields ===== */}
              {isPharmacy && (
                <div className="space-y-3 border-t border-green-200 pt-3">
                  <h3 className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                    <Pill className="h-4 w-4" />
                    {t("بيانات الدواء", "Drug Information")}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("تاريخ الصلاحية *", "Expiry Date *")}</label>
                      <input type="date" value={quickAddExpiry} onChange={(e) => setQuickAddExpiry(e.target.value)}
                        className="w-full h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("رقم التشغيلة (Batch)", "Batch Number")}</label>
                      <input type="text" value={quickAddBatch} onChange={(e) => setQuickAddBatch(e.target.value)}
                        placeholder={t("مثال: B2026-001", "e.g. B2026-001")}
                        className="w-full h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500 font-mono" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("المادة الفعالة", "Active Ingredient")}</label>
                      <input type="text" value={quickAddActiveIngredient} onChange={(e) => setQuickAddActiveIngredient(e.target.value)}
                        placeholder={t("مثال: باراسيتامول", "e.g. Paracetamol")}
                        className="w-full h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("الشركة المصنعة", "Manufacturer")}</label>
                      <input type="text" value={quickAddManufacturer} onChange={(e) => setQuickAddManufacturer(e.target.value)}
                        placeholder={t("مثال: فاركو", "e.g. Pharco")}
                        className="w-full h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("الشكل الدوائي", "Dosage Form")}</label>
                      <div className="flex gap-1">
                        <select value={quickAddDosageForm} onChange={(e) => {
                          if (e.target.value === "__custom__") { setShowCustomDosageInput(true); setQuickAddDosageForm("") }
                          else { setQuickAddDosageForm(e.target.value); setShowCustomDosageInput(false) }
                        }}
                          className="flex-1 h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500">
                          <option value="">{t("اختر", "Select")}</option>
                          {/* Solid forms */}
                          <option value="أقراص">{t("أقراص", "Tablets")}</option>
                          <option value="أقراص فوارة">{t("أقراص فوارة", "Effervescent Tablets")}</option>
                          <option value="أقراص مص">{t("أقراص مص", "Lozenges")}</option>
                          <option value="أقراص تحت اللسان">{t("أقراص تحت اللسان", "Sublingual Tablets")}</option>
                          <option value="أقراص مغلفة">{t("أقراص مغلفة", "Coated Tablets")}</option>
                          <option value="أقراص ممتدة المفعول">{t("أقراص ممتدة المفعول", "Extended Release")}</option>
                          <option value="كبسولات">{t("كبسولات", "Capsules")}</option>
                          <option value="كبسولات جيلاتينية">{t("كبسولات جيلاتينية", "Soft Gel Capsules")}</option>
                          <option value="بودرة">{t("بودرة/مسحوق", "Powder")}</option>
                          <option value="حبيبات">{t("حبيبات", "Granules")}</option>
                          {/* Liquid forms */}
                          <option value="شراب">{t("شراب", "Syrup")}</option>
                          <option value="محلول">{t("محلول", "Solution")}</option>
                          <option value="معلق">{t("معلق", "Suspension")}</option>
                          <option value="نقط فموية">{t("نقط فموية", "Oral Drops")}</option>
                          <option value="إكسير">{t("إكسير", "Elixir")}</option>
                          {/* Injectable forms */}
                          <option value="حقن">{t("حقن", "Injection")}</option>
                          <option value="أمبول">{t("أمبول", "Ampoule")}</option>
                          <option value="فيال">{t("فيال", "Vial")}</option>
                          <option value="محلول وريدي">{t("محلول وريدي", "IV Solution")}</option>
                          {/* Topical forms */}
                          <option value="كريم">{t("كريم", "Cream")}</option>
                          <option value="مرهم">{t("مرهم", "Ointment")}</option>
                          <option value="جل">{t("جل", "Gel")}</option>
                          <option value="غسول">{t("غسول", "Lotion")}</option>
                          <option value="لصقة">{t("لصقة", "Patch")}</option>
                          <option value="رغوة">{t("رغوة", "Foam")}</option>
                          {/* Eye/Ear/Nose */}
                          <option value="قطرة عين">{t("قطرة عين", "Eye Drops")}</option>
                          <option value="قطرة أذن">{t("قطرة أذن", "Ear Drops")}</option>
                          <option value="بخاخ أنفي">{t("بخاخ أنفي", "Nasal Spray")}</option>
                          <option value="قطرة أنف">{t("قطرة أنف", "Nasal Drops")}</option>
                          {/* Respiratory */}
                          <option value="بخاخ">{t("بخاخ", "Inhaler/Spray")}</option>
                          <option value="محلول استنشاق">{t("محلول استنشاق", "Nebulizer Solution")}</option>
                          {/* Rectal/Vaginal */}
                          <option value="تحاميل">{t("تحاميل", "Suppositories")}</option>
                          <option value="لبوس مهبلي">{t("لبوس مهبلي", "Vaginal Pessary")}</option>
                          <option value="كريم مهبلي">{t("كريم مهبلي", "Vaginal Cream")}</option>
                          {/* Other */}
                          <option value="غسول فم">{t("غسول فم", "Mouthwash")}</option>
                          <option value="بودرة للحقن">{t("بودرة للحقن", "Powder for Injection")}</option>
                          <option value="أكياس">{t("أكياس", "Sachets")}</option>
                          {/* Custom entries */}
                          {customDosageForms.map((df) => (
                            <option key={df} value={df}>{df}</option>
                          ))}
                          <option value="__custom__">➕ {t("إضافة شكل آخر", "Add other form")}</option>
                        </select>
                      </div>
                      {showCustomDosageInput && (
                        <div className="flex gap-1 mt-1">
                          <input type="text" value={quickAddCustomDosageForm} onChange={(e) => setQuickAddCustomDosageForm(e.target.value)}
                            placeholder={t("اكتب الشكل الدوائي", "Type dosage form")}
                            className="flex-1 h-9 bg-white text-gray-800 rounded-lg px-2 text-xs border border-green-300 focus:ring-2 focus:ring-green-500"
                            autoFocus />
                          <button type="button" onClick={() => {
                            if (quickAddCustomDosageForm.trim()) {
                              setCustomDosageForms(prev => [...prev, quickAddCustomDosageForm.trim()])
                              setQuickAddDosageForm(quickAddCustomDosageForm.trim())
                              setQuickAddCustomDosageForm("")
                              setShowCustomDosageInput(false)
                            }
                          }}
                            className="h-9 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition">
                            {t("إضافة", "Add")}
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-gray-700 text-xs font-medium block mb-1">{t("ظروف التخزين", "Storage")}</label>
                      <select value={quickAddStorageConditions} onChange={(e) => setQuickAddStorageConditions(e.target.value)}
                        className="w-full h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500">
                        <option value="">{t("اختر", "Select")}</option>
                        <option value="درجة حرارة الغرفة">{t("درجة حرارة الغرفة", "Room temperature")}</option>
                        <option value="تبريد (2-8°C)">{t("تبريد (2-8°C)", "Refrigerated (2-8°C)")}</option>
                        <option value="تجميد">{t("تجميد", "Frozen")}</option>
                        <option value="بعيداً عن الضوء">{t("بعيداً عن الضوء", "Protect from light")}</option>
                        <option value="حماية من الرطوبة">{t("حماية من الرطوبة", "Protect from moisture")}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-700 text-xs font-medium">{t("مجموعة التفاعل", "Interaction Group")}</label>
                    </div>
                    <div className="flex gap-1">
                      <select value={quickAddInteractionGroup} onChange={(e) => {
                        if (e.target.value === "__custom__") { setShowCustomInteractionInput(true); setQuickAddInteractionGroup("") }
                        else { setQuickAddInteractionGroup(e.target.value); setShowCustomInteractionInput(false) }
                      }}
                        className="flex-1 h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500">
                        <option value="">{t("بدون", "None")}</option>
                        {/* Anti-inflammatory & Pain */}
                        <option value="NSAID">{t("مضاد التهاب (NSAID)", "NSAID")}</option>
                        <option value="opioid">{t("مسكنات أفيونية", "Opioid")}</option>
                        <option value="corticosteroid">{t("كورتيكوستيرويد", "Corticosteroid")}</option>
                        {/* Cardiovascular */}
                        <option value="anticoagulant">{t("مميع دم (مضاد تخثر)", "Anticoagulant")}</option>
                        <option value="antiplatelet">{t("مضاد تكدس صفائح", "Antiplatelet")}</option>
                        <option value="warfarin">{t("وارفارين", "Warfarin")}</option>
                        <option value="ACE_inhibitor">{t("مثبط ACE (ضغط)", "ACE Inhibitor")}</option>
                        <option value="ARB">{t("حاصرات مستقبلات الأنجيوتنسين (ARB)", "ARB")}</option>
                        <option value="beta_blocker">{t("حاصرات بيتا", "Beta Blocker")}</option>
                        <option value="calcium_channel_blocker">{t("حاصرات قنوات الكالسيوم", "Calcium Channel Blocker")}</option>
                        <option value="diuretic_loop">{t("مدر بول عروي", "Loop Diuretic")}</option>
                        <option value="diuretic_thiazide">{t("مدر بول ثيازيدي", "Thiazide Diuretic")}</option>
                        <option value="diuretic_potassium_sparing">{t("مدر بول حافظ للبوتاسيوم", "K-Sparing Diuretic")}</option>
                        <option value="nitrate">{t("نترات", "Nitrate")}</option>
                        <option value="alpha_blocker">{t("حاصرات ألفا", "Alpha Blocker")}</option>
                        <option value="digitalis">{t("ديجيتاليس (ديجوكسين)", "Digitalis / Digoxin")}</option>
                        {/* Lipid-lowering */}
                        <option value="statin">{t("ستاتين (كوليسترول)", "Statin")}</option>
                        <option value="fibrate">{t("فايبرات", "Fibrate")}</option>
                        {/* Psychiatry / CNS */}
                        <option value="SSRI">{t("مضاد اكتئاب SSRI", "SSRI")}</option>
                        <option value="SNRI">{t("مضاد اكتئاب SNRI", "SNRI")}</option>
                        <option value="TCA">{t("مضاد اكتئاب ثلاثي الحلقات (TCA)", "TCA")}</option>
                        <option value="MAOI">{t("مثبط MAO", "MAOI")}</option>
                        <option value="benzodiazepine">{t("بنزوديازيبين", "Benzodiazepine")}</option>
                        <option value="antipsychotic">{t("مضاد ذهان", "Antipsychotic")}</option>
                        <option value="anticonvulsant">{t("مضاد صرع", "Anticonvulsant")}</option>
                        <option value="sedative">{t("مهدئ/منوم", "Sedative")}</option>
                        <option value="lithium">{t("ليثيوم", "Lithium")}</option>
                        {/* Diabetes */}
                        <option value="antidiabetic">{t("دواء سكري (فموي)", "Oral Antidiabetic")}</option>
                        <option value="insulin">{t("إنسولين", "Insulin")}</option>
                        <option value="sulfonylurea">{t("سلفونيل يوريا", "Sulfonylurea")}</option>
                        <option value="metformin">{t("ميتفورمين", "Metformin")}</option>
                        {/* Antibiotics */}
                        <option value="fluoroquinolone">{t("فلوروكينولون", "Fluoroquinolone")}</option>
                        <option value="macrolide">{t("ماكروليد", "Macrolide")}</option>
                        <option value="tetracycline">{t("تتراسيكلين", "Tetracycline")}</option>
                        <option value="aminoglycoside">{t("أمينوغليكوزيد", "Aminoglycoside")}</option>
                        <option value="penicillin">{t("بنسلين", "Penicillin")}</option>
                        <option value="cephalosporin">{t("سيفالوسبورين", "Cephalosporin")}</option>
                        <option value="metronidazole">{t("ميترونيدازول", "Metronidazole")}</option>
                        <option value="rifampicin">{t("ريفامبيسين", "Rifampicin")}</option>
                        {/* Antifungal */}
                        <option value="antifungal_azole">{t("مضاد فطري أزول", "Azole Antifungal")}</option>
                        {/* GI */}
                        <option value="PPI">{t("مثبط مضخة البروتون (PPI)", "PPI")}</option>
                        <option value="H2_blocker">{t("مضاد مستقبلات H2", "H2 Blocker")}</option>
                        <option value="antacid">{t("مضاد حموضة", "Antacid")}</option>
                        {/* Allergy */}
                        <option value="antihistamine">{t("مضاد هيستامين", "Antihistamine")}</option>
                        {/* Others */}
                        <option value="potassium">{t("بوتاسيوم", "Potassium")}</option>
                        <option value="theophylline">{t("ثيوفيلين", "Theophylline")}</option>
                        <option value="thyroid_hormone">{t("هرمون درقي", "Thyroid Hormone")}</option>
                        <option value="methotrexate">{t("ميثوتريكسات", "Methotrexate")}</option>
                        <option value="cyclosporine">{t("سيكلوسبورين", "Cyclosporine")}</option>
                        <option value="phosphodiesterase_inhibitor">{t("مثبط فوسفودايستراز (PDE5)", "PDE5 Inhibitor")}</option>
                        {/* Custom entries */}
                        {customInteractionGroups.map((ig) => (
                          <option key={ig.value} value={ig.value}>{t(ig.labelAr, ig.labelEn)}</option>
                        ))}
                        <option value="__custom__">➕ {t("إضافة مجموعة أخرى", "Add other group")}</option>
                      </select>
                    </div>
                    {showCustomInteractionInput && (
                      <div className="flex gap-1 mt-1">
                        <input type="text" value={quickAddCustomInteractionGroup} onChange={(e) => setQuickAddCustomInteractionGroup(e.target.value)}
                          placeholder={t("اسم المجموعة", "Group name")}
                          className="flex-1 h-9 bg-white text-gray-800 rounded-lg px-2 text-xs border border-green-300 focus:ring-2 focus:ring-green-500"
                          autoFocus />
                        <button type="button" onClick={() => {
                          if (quickAddCustomInteractionGroup.trim()) {
                            const val = quickAddCustomInteractionGroup.trim().toLowerCase().replace(/\s+/g, "_")
                            setCustomInteractionGroups(prev => [...prev, { value: val, labelAr: quickAddCustomInteractionGroup.trim(), labelEn: quickAddCustomInteractionGroup.trim() }])
                            setQuickAddInteractionGroup(val)
                            setQuickAddCustomInteractionGroup("")
                            setShowCustomInteractionInput(false)
                          }
                        }}
                          className="h-9 px-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition">
                          {t("إضافة", "Add")}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={quickAddRequiresPrescription} onChange={(e) => setQuickAddRequiresPrescription(e.target.checked)}
                          className="w-4 h-4 rounded text-green-600 focus:ring-green-500" />
                        <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-red-500" />
                          {t("يحتاج وصفة طبية", "Requires Prescription")}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Multi-unit section */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <h4 className="text-xs font-bold text-green-700 flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {t("وحدات البيع المتعددة", "Multi-Unit Selling")}
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-gray-600 text-[10px] block mb-0.5">{t("حبة/شريط", "Piece/Strip")}</label>
                        <input type="number" value={quickAddPiecePerStrip} onChange={(e) => setQuickAddPiecePerStrip(e.target.value)}
                          placeholder="10" min="1"
                          className="w-full h-9 bg-white text-gray-800 rounded-lg px-2 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                      </div>
                      <div>
                        <label className="text-gray-600 text-[10px] block mb-0.5">{t("شريط/علبة", "Strip/Box")}</label>
                        <input type="number" value={quickAddStripPerBox} onChange={(e) => setQuickAddStripPerBox(e.target.value)}
                          placeholder="3" min="1"
                          className="w-full h-9 bg-white text-gray-800 rounded-lg px-2 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                      </div>
                      <div>
                        <label className="text-gray-600 text-[10px] block mb-0.5">{t("علبة/كرتونة", "Box/Carton")}</label>
                        <input type="number" value={quickAddBoxPerCarton} onChange={(e) => setQuickAddBoxPerCarton(e.target.value)}
                          placeholder="12" min="1"
                          className="w-full h-9 bg-white text-gray-800 rounded-lg px-2 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {t("مثال: 10 حبات/شريط × 3 شرائط/علبة = 30 حبة/علبة", "Example: 10 pieces/strip × 3 strips/box = 30 pieces/box")}
                    </p>
                    
                    {/* Price Unit & Default Selling Unit */}
                    {(quickAddPiecePerStrip || quickAddStripPerBox) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-gray-600 text-[10px] block mb-0.5">{t("السعر المدخل لـ", "Price entered for")}</label>
                          <select value={quickAddPriceUnit} onChange={(e) => setQuickAddPriceUnit(e.target.value as "piece" | "strip" | "box")}
                            className="w-full h-9 bg-white text-gray-800 rounded-lg px-2 text-xs border border-amber-300 focus:ring-2 focus:ring-amber-400">
                            <option value="piece">{t("حبة", "Piece")}</option>
                            <option value="strip">{t("شريط", "Strip")}</option>
                            <option value="box">{t("علبة", "Box")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-gray-600 text-[10px] block mb-0.5">{t("وحدة البيع الافتراضية", "Default selling unit")}</label>
                          <select value={quickAddDefaultSellingUnit} onChange={(e) => setQuickAddDefaultSellingUnit(e.target.value as "piece" | "strip" | "box")}
                            className="w-full h-9 bg-white text-gray-800 rounded-lg px-2 text-xs border border-cyan-300 focus:ring-2 focus:ring-cyan-400">
                            <option value="piece">{t("حبة", "Piece")}</option>
                            <option value="strip">{t("شريط", "Strip")}</option>
                            <option value="box">{t("علبة", "Box")}</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 shrink-0">
              <button
                onClick={handleQuickAddProduct}
                disabled={quickAddLoading || !quickAddName.trim() || !quickAddPrice || !quickAddCostPrice || !quickAddCategory.trim() || (isPharmacy && !quickAddExpiry)}
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

      {/* ===== Held Carts Modal ===== */}
      {showHeldCarts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowHeldCarts(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[95dvh] md:max-h-[80vh] flex flex-col shadow-2xl" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-blue-600" />
                <h3 className="text-gray-800 font-bold">{t("السلات المعلقة", "Held Carts")} ({heldCarts.length})</h3>
              </div>
              <button onClick={() => setShowHeldCarts(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {heldCarts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">{t("لا توجد سلات معلقة", "No held carts")}</p>
              ) : (
                heldCarts.map((hc) => (
                  <div key={hc.id} className="border border-gray-200 rounded-xl p-3 hover:border-blue-300 transition bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800">{hc.label || hc.customer_name || t("سلة معلقة", "Held Cart")}</span>
                      <span className="text-[10px] text-gray-400">{new Date(hc.held_at).toLocaleTimeString("ar-EG")}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {hc.items.length} {t("منتج", "items")} • {hc.items.reduce((s, i) => s + i.total, 0).toFixed(2)} {currencyLabel}
                    </p>
                    {hc.customer_phone && <p className="text-[10px] text-gray-400 mb-2">📞 {hc.customer_phone}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRetrieveHeldCart(hc)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 rounded-lg transition"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        {t("استرجاع", "Retrieve")}
                      </button>
                      <button
                        onClick={() => handleDeleteHeldCart(hc.id)}
                        className="flex items-center justify-center gap-1 bg-red-100 hover:bg-red-200 text-red-600 text-xs px-3 py-2 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Customer Search Modal ===== */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowCustomerSearch(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[95dvh] md:max-h-[80vh] flex flex-col shadow-2xl" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="text-gray-800 font-bold">{t("بحث عن عميل", "Search Customer")}</h3>
              </div>
              <button onClick={() => setShowCustomerSearch(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                placeholder={t("اكتب اسم أو رقم هاتف العميل...", "Type customer name or phone...")}
                className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {customerSearchResults.length === 0 && customerSearchQuery.length >= 2 && (
                <p className="text-center text-gray-400 py-6 text-sm">{t("لم يتم العثور على عملاء", "No customers found")}</p>
              )}
              {customerSearchResults.map((cust) => (
                <button
                  key={cust.id}
                  onClick={() => handleSelectCustomer(cust)}
                  className="w-full text-start p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">{cust.name}</span>
                    {cust.loyalty_points > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{cust.loyalty_points} {t("نقطة", "pts")}</span>
                    )}
                  </div>
                  {cust.phone && <p className="text-xs text-gray-500 mt-0.5">{cust.phone}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">{cust.total_purchases} {t("عملية شراء", "purchases")} • {cust.total_spent.toFixed(0)} {currencyLabel}</p>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => { setShowCustomerSearch(false); setShowCustomerForm(true) }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium transition"
              >
                <UserPlus className="h-4 w-4" />
                {t("إضافة عميل جديد", "Add New Customer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== New Customer Form Modal ===== */}
      {showCustomerForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowCustomerForm(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-600" />
                <h3 className="text-gray-800 font-bold">{t("عميل جديد", "New Customer")}</h3>
              </div>
              <button onClick={() => setShowCustomerForm(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("الاسم *", "Name *")}</label>
                <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" autoFocus />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("الهاتف", "Phone")}</label>
                <input type="tel" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("البريد الإلكتروني", "Email")}</label>
                <input type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("ملاحظات", "Notes")}</label>
                <textarea value={newCustomerNotes} onChange={(e) => setNewCustomerNotes(e.target.value)} rows={2}
                  className="w-full bg-gray-50 text-gray-800 rounded-xl px-4 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button onClick={handleSaveNewCustomer} disabled={!newCustomerName.trim()}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl font-medium transition">
                {t("حفظ", "Save")}
              </button>
              <button onClick={() => setShowCustomerForm(false)}
                className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition">
                {t("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Return Modal ===== */}
      {showReturn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowReturn(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[95dvh] md:max-h-[85vh] flex flex-col shadow-2xl" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-orange-600" />
                <h3 className="text-gray-800 font-bold">{t("إرجاع / استبدال", "Return / Exchange")}</h3>
              </div>
              <button onClick={() => { setShowReturn(false); setReturnSaleData(null); setReturnSaleId(""); setReturnItems([]) }}
                className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Search Sale */}
              <div className="p-4 border-b border-gray-100">
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("رقم الفاتورة أو رقم البيع", "Invoice or Sale Number")}</label>
                <div className="flex gap-2">
                  <input type="text" value={returnSaleId} onChange={(e) => setReturnSaleId(e.target.value)}
                    placeholder={t("ابحث برقم الفاتورة...", "Search by invoice number...")}
                    className="flex-1 h-11 bg-gray-50 text-gray-800 rounded-xl px-4 text-sm border border-gray-200 focus:ring-2 focus:ring-orange-500" />
                  <button onClick={handleSearchSaleForReturn}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 rounded-xl transition font-medium text-sm">
                    {t("بحث", "Search")}
                  </button>
                </div>
              </div>

              {/* Sale Details */}
              {returnSaleData && (
                <div className="p-4 space-y-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                    <p className="text-gray-700 font-medium">{t("الفاتورة:", "Invoice:")} #{returnSaleData.sale_number || returnSaleData.id?.slice(0, 8)}</p>
                    <p className="text-gray-500 text-xs">{t("الإجمالي:", "Total:")} {returnSaleData.total?.toFixed(2)} {currencyLabel}</p>
                    {returnSaleData.customer_name && <p className="text-gray-500 text-xs">{t("العميل:", "Customer:")} {returnSaleData.customer_name}</p>}
                  </div>

                  {/* Return Type */}
                  <div>
                    <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("نوع العملية", "Operation Type")}</label>
                    <div className="flex gap-2">
                      <button onClick={() => setReturnType("refund")}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${returnType === "refund" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {t("إرجاع", "Return")}
                      </button>
                      <button onClick={() => setReturnType("exchange")}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${returnType === "exchange" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {t("استبدال", "Exchange")}
                      </button>
                    </div>
                  </div>

                  {/* Items to Return */}
                  <div>
                    <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("المنتجات للإرجاع", "Items to Return")}</label>
                    <div className="space-y-2">
                      {returnItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.price.toFixed(2)} {currencyLabel} × {t("أقصى", "max")} {item.maxQty}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: Math.max(0, ri.quantity - 1) } : ri))}
                              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 transition">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                            <button onClick={() => setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: Math.min(ri.maxQty, ri.quantity + 1) } : ri))}
                              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-orange-100 hover:bg-orange-200 flex items-center justify-center text-orange-600 transition">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Refund Method */}
                  {returnType === "refund" && (
                    <div>
                      <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("طريقة الاسترداد", "Refund Method")}</label>
                      <div className="flex gap-2">
                        {["cash", "card", "wallet"].map((method) => (
                          <button key={method} onClick={() => setReturnRefundMethod(method as any)}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${returnRefundMethod === method ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                            {method === "cash" ? t("نقدي", "Cash") : method === "card" ? t("بطاقة", "Card") : t("محفظة", "Wallet")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Return Reason */}
                  <div>
                    <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("السبب (اختياري)", "Reason (Optional)")}</label>
                    <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2}
                      className="w-full bg-gray-50 text-gray-800 rounded-xl px-4 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-orange-500 resize-none"
                      placeholder={t("سبب الإرجاع...", "Return reason...")} />
                  </div>

                  {/* Refund Amount */}
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-orange-600 mb-1">{t("مبلغ الاسترداد", "Refund Amount")}</p>
                    <p className="text-xl sm:text-2xl font-bold text-orange-700">
                      {returnItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)} {currencyLabel}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {returnSaleData && (
              <div className="p-4 border-t border-gray-200">
                <button onClick={handleProcessReturn} disabled={returnProcessing || returnItems.every(i => i.quantity === 0)}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                  {returnProcessing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />{t("جاري المعالجة...", "Processing...")}</>
                  ) : (
                    <><RotateCcw className="h-4 w-4" />{returnType === "refund" ? t("تأكيد الإرجاع", "Confirm Return") : t("تأكيد الاستبدال", "Confirm Exchange")}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Shift Modal ===== */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowShiftModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                {currentShift ? <LogOut className="h-5 w-5 text-red-500" /> : <LogIn className="h-5 w-5 text-teal-600" />}
                <h3 className="text-gray-800 font-bold">{currentShift ? t("إغلاق الوردية", "Close Shift") : t("فتح وردية", "Open Shift")}</h3>
              </div>
              <button onClick={() => setShowShiftModal(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
            </div>

            {!currentShift ? (
              /* Open Shift */
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("الرصيد الافتتاحي (نقدي)", "Opening Cash Balance")}</label>
                  <input type="number" value={shiftOpeningCash} onChange={(e) => setShiftOpeningCash(e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full h-12 bg-gray-50 text-gray-800 rounded-xl px-4 text-lg font-bold border border-gray-200 focus:ring-2 focus:ring-teal-500 text-center" autoFocus />
                </div>
                <button onClick={handleOpenShift} disabled={shiftLoading}
                  className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                  {shiftLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <LogIn className="h-4 w-4" />}
                  {t("فتح الوردية", "Open Shift")}
                </button>
              </div>
            ) : (
              /* Close Shift */
              <div className="p-4 space-y-3">
                <div className="bg-teal-50 rounded-xl p-3 text-sm space-y-1">
                  <p className="text-teal-700 font-medium">{t("بداية الوردية:", "Shift started:")} {new Date(currentShift.started_at).toLocaleTimeString("ar-EG")}</p>
                  <p className="text-teal-600">{t("الرصيد الافتتاحي:", "Opening cash:")} {currentShift.opening_cash.toFixed(2)} {currencyLabel}</p>
                  <p className="text-teal-600">{t("عدد المبيعات:", "Sales count:")} {currentShift.total_sales}</p>
                  <p className="text-teal-700 font-bold">{t("إجمالي المبيعات:", "Total sales:")} {currentShift.total_revenue.toFixed(2)} {currencyLabel}</p>
                </div>
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("النقدي الفعلي في الدرج", "Actual Cash in Drawer")}</label>
                  <input type="number" value={shiftClosingCash} onChange={(e) => setShiftClosingCash(e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full h-12 bg-gray-50 text-gray-800 rounded-xl px-4 text-lg font-bold border border-gray-200 focus:ring-2 focus:ring-red-500 text-center" autoFocus />
                </div>
                <div>
                  <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("ملاحظات (اختياري)", "Notes (Optional)")}</label>
                  <textarea value={shiftNotes} onChange={(e) => setShiftNotes(e.target.value)} rows={2}
                    className="w-full bg-gray-50 text-gray-800 rounded-xl px-4 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-red-500 resize-none" />
                </div>
                <button onClick={handleCloseShift} disabled={shiftLoading}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                  {shiftLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <LogOut className="h-4 w-4" />}
                  {t("إغلاق الوردية", "Close Shift")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Expiry Alerts Modal ===== */}
      {showExpiryAlerts && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowExpiryAlerts(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-red-500" />
                {t("تنبيهات الصلاحية", "Expiry Alerts")}
              </h3>
              <button onClick={() => setShowExpiryAlerts(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh] space-y-2">
              {expiryAlertsLoading ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent mx-auto" /></div>
              ) : expiryAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">{t("لا توجد تنبيهات", "No alerts")}</p>
                </div>
              ) : (
                expiryAlerts.map((alert) => (
                  <div key={alert.product_id} className={`flex items-center justify-between p-3 rounded-xl border ${
                    alert.status === "expired" ? "bg-red-50 border-red-200" : alert.status === "critical" ? "bg-orange-50 border-orange-200" : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{alert.product_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {alert.batch_number && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{alert.batch_number}</span>}
                        <span className="text-xs text-gray-500">{t("مخزون:", "Stock:")} {alert.stock}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        alert.status === "expired" ? "bg-red-500 text-white" : alert.status === "critical" ? "bg-orange-500 text-white" : "bg-amber-500 text-white"
                      }`}>
                        {alert.status === "expired"
                          ? t("منتهي", "Expired")
                          : `${alert.days_remaining} ${t("يوم", "days")}`}
                      </span>
                      <p className="text-[10px] text-gray-500 mt-1">{new Date(alert.expiry_date).toLocaleDateString(locale)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
              <span>{t("منتهي:", "Expired:")} <span className="font-bold text-red-600">{expiryAlerts.filter(a => a.status === "expired").length}</span></span>
              <span>{t("حرج:", "Critical:")} <span className="font-bold text-orange-600">{expiryAlerts.filter(a => a.status === "critical").length}</span></span>
              <span>{t("تحذير:", "Warning:")} <span className="font-bold text-amber-600">{expiryAlerts.filter(a => a.status === "warning").length}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Edit Product Pharmacy Data Modal ===== */}
      {showPharmacyEdit && pharmEditProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPharmacyEdit(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Pill className="h-5 w-5 text-purple-500" />
                {t("بيانات دوائية", "Pharmacy Data")} - {pharmEditProduct.name}
              </h3>
              <button onClick={() => setShowPharmacyEdit(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[75dvh] md:max-h-[65vh] overflow-y-auto">
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("تاريخ الصلاحية", "Expiry Date")}</label>
                <input type="date" value={pharmEditExpiry} onChange={(e) => setPharmEditExpiry(e.target.value)}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("رقم الباتش", "Batch Number")}</label>
                <input type="text" value={pharmEditBatch} onChange={(e) => setPharmEditBatch(e.target.value)}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("المادة الفعالة", "Active Ingredient")}</label>
                <input type="text" value={pharmEditIngredient} onChange={(e) => setPharmEditIngredient(e.target.value)}
                  placeholder={t("مثال: باراسيتامول", "e.g. Paracetamol")}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("الشركة المصنعة", "Manufacturer")}</label>
                <input type="text" value={pharmEditManufacturer} onChange={(e) => setPharmEditManufacturer(e.target.value)}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="text-gray-700 text-sm font-medium block mb-1">{t("الشكل الدوائي", "Dosage Form")}</label>
                <select value={pharmEditDosageForm} onChange={(e) => setPharmEditDosageForm(e.target.value)}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500">
                  <option value="">{t("اختر...", "Select...")}</option>
                  <option value="أقراص">{t("أقراص", "Tablets")}</option>
                  <option value="كبسولات">{t("كبسولات", "Capsules")}</option>
                  <option value="شراب">{t("شراب", "Syrup")}</option>
                  <option value="حقن">{t("حقن", "Injection")}</option>
                  <option value="كريم">{t("كريم", "Cream")}</option>
                  <option value="مرهم">{t("مرهم", "Ointment")}</option>
                  <option value="قطرة">{t("قطرة", "Drops")}</option>
                  <option value="بخاخ">{t("بخاخ", "Spray")}</option>
                  <option value="لبوس">{t("لبوس", "Suppository")}</option>
                  <option value="أكياس">{t("أكياس", "Sachets")}</option>
                </select>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                <input type="checkbox" checked={pharmEditRequiresPrescription} onChange={(e) => setPharmEditRequiresPrescription(e.target.checked)}
                  className="w-4 h-4 accent-purple-500" id="rx-check" />
                <label htmlFor="rx-check" className="text-sm text-gray-700 font-medium">{t("يحتاج وصفة طبية (Rx)", "Requires Prescription (Rx)")}</label>
              </div>
              <button onClick={handleSavePharmacyEdit} disabled={pharmEditSaving}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                {pharmEditSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Pill className="h-4 w-4" />}
                {t("حفظ", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Drug Alternatives Modal ===== */}
      {showAlternatives && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowAlternatives(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-amber-500" />
                {t("بدائل الدواء", "Drug Alternatives")}
              </h3>
              <button onClick={() => setShowAlternatives(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {alternativesIngredient && (
              <div className="px-4 pt-3">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{t("المادة الفعالة:", "Active Ingredient:")} {alternativesIngredient}</span>
              </div>
            )}
            <div className="p-4 space-y-2 max-h-[75dvh] md:max-h-[60vh] overflow-y-auto">
              {alternativesLoading ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent mx-auto" /></div>
              ) : alternatives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>{t("لا توجد بدائل", "No alternatives found")}</p>
                </div>
              ) : (
                alternatives.map((alt) => (
                  <div key={alt.product_id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{alt.product_name}</p>
                      {alt.manufacturer && <p className="text-xs text-gray-500">{alt.manufacturer}</p>}
                      <p className="text-xs text-gray-400">{t("مخزون:", "Stock:")} {alt.stock}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">{alt.price.toFixed(2)} {currencyLabel}</span>
                      <button onClick={() => {
                        const p = products.find((pr) => pr.id === alt.product_id)
                        if (p) { addToCart(p); setShowAlternatives(false) }
                      }} className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-lg hover:bg-emerald-600">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Prescription Modal ===== */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPrescriptionModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-500" />
                {t("تسجيل روشتة", "Record Prescription")}
              </h3>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[75dvh] md:max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 text-xs font-medium block mb-1">{t("اسم المريض *", "Patient Name *")}</label>
                  <input type="text" value={prescriptionPatientName} onChange={(e) => setPrescriptionPatientName(e.target.value)}
                    className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="text-gray-700 text-xs font-medium block mb-1">{t("هاتف المريض", "Patient Phone")}</label>
                  <input type="tel" value={prescriptionPatientPhone} onChange={(e) => setPrescriptionPatientPhone(e.target.value)}
                    className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 text-xs font-medium block mb-1">{t("اسم الطبيب *", "Doctor Name *")}</label>
                  <input type="text" value={prescriptionDoctorName} onChange={(e) => setPrescriptionDoctorName(e.target.value)}
                    className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="text-gray-700 text-xs font-medium block mb-1">{t("رقم الروشتة", "Rx Number")}</label>
                  <input type="text" value={prescriptionNumber} onChange={(e) => setPrescriptionNumber(e.target.value)}
                    className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-700 text-xs font-medium block mb-1">{t("التشخيص", "Diagnosis")}</label>
                <input type="text" value={prescriptionDiagnosis} onChange={(e) => setPrescriptionDiagnosis(e.target.value)}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
              </div>
              {prescriptionItems.length > 0 && (
                <div>
                  <label className="text-gray-700 text-xs font-medium block mb-1">{t("الأدوية", "Medications")}</label>
                  <div className="space-y-1">
                    {prescriptionItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-gray-700">{item.product_name} × {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-gray-700 text-xs font-medium block mb-1">{t("ملاحظات", "Notes")}</label>
                <textarea value={prescriptionNotes} onChange={(e) => setPrescriptionNotes(e.target.value)} rows={2}
                  className="w-full bg-white text-gray-800 rounded-xl px-3 py-2 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
              <button onClick={() => {
                if (lastSale) handleSavePrescription(lastSale.id, lastSale.sale_number)
                else setError(t("لا توجد عملية بيع مرتبطة", "No sale linked"))
              }} disabled={prescriptionSaving || !prescriptionPatientName.trim() || !prescriptionDoctorName.trim()}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                {prescriptionSaving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FileText className="h-4 w-4" />}
                {t("حفظ الروشتة", "Save Prescription")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Prescription History Modal ===== */}
      {showPrescriptionHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPrescriptionHistory(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-teal-500" />
                {t("سجل الروشتات", "Prescription History")}
              </h3>
              <button onClick={() => setShowPrescriptionHistory(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <div className="flex gap-2">
                <input type="text" value={prescriptionSearchQuery} onChange={(e) => setPrescriptionSearchQuery(e.target.value)}
                  placeholder={t("بحث باسم المريض أو الطبيب...", "Search by patient or doctor...")}
                  className="flex-1 h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-teal-500" />
                <button onClick={handleLoadPrescriptionHistory}
                  className="bg-teal-500 hover:bg-teal-600 text-white px-3 rounded-xl text-sm font-medium transition">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[55vh] space-y-2">
              {prescriptionHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>{t("لا توجد روشتات", "No prescriptions found")}</p>
                </div>
              ) : (
                prescriptionHistory.map((rx) => (
                  <div key={rx.id} className="border border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{rx.patient_name}</p>
                        <p className="text-xs text-gray-500">{t("د.", "Dr.")} {rx.doctor_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{new Date(rx.created_at).toLocaleDateString(locale)}</p>
                        {rx.prescription_number && <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">#{rx.prescription_number}</span>}
                      </div>
                    </div>
                    {rx.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rx.items.map((item, i) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.product_name} × {item.quantity}</span>
                        ))}
                      </div>
                    )}
                    {rx.diagnosis && <p className="text-xs text-gray-500 mt-1">{rx.diagnosis}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Insurance Management Modal ===== */}
      {showInsuranceModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowInsuranceModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                {t("شركات التأمين", "Insurance Companies")}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddInsurance(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition">
                  <Plus className="h-3 w-3" />
                  {t("إضافة", "Add")}
                </button>
                <button onClick={() => setShowInsuranceModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {showAddInsurance && (
              <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-2">
                <input type="text" value={newInsuranceName} onChange={(e) => setNewInsuranceName(e.target.value)}
                  placeholder={t("اسم شركة التأمين *", "Insurance company name *")}
                  className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-600 text-xs">{t("نسبة التغطية %", "Coverage %")}</label>
                    <input type="number" value={newInsuranceCoverage} onChange={(e) => setNewInsuranceCoverage(e.target.value)} min="0" max="100"
                      className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-gray-600 text-xs">{t("رقم التعاقد", "Contract #")}</label>
                    <input type="text" value={newInsuranceContract} onChange={(e) => setNewInsuranceContract(e.target.value)}
                      className="w-full h-10 bg-white text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddInsuranceCompany} disabled={insuranceSaving || !newInsuranceName.trim()}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                    {insuranceSaving ? "..." : t("حفظ", "Save")}
                  </button>
                  <button onClick={() => setShowAddInsurance(false)}
                    className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium transition">
                    {t("إلغاء", "Cancel")}
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
              {insuranceCompanies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>{t("لا توجد شركات تأمين", "No insurance companies")}</p>
                </div>
              ) : (
                insuranceCompanies.map((company) => (
                  <div key={company.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    company.is_active ? "border-blue-200 bg-blue-50/50" : "border-gray-200 bg-gray-50 opacity-60"
                  }`}>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{company.name}</p>
                      <p className="text-xs text-gray-500">{t("تغطية:", "Coverage:")} {company.coverage_percentage}%</p>
                      {company.contract_number && <p className="text-[10px] text-gray-400">{company.contract_number}</p>}
                    </div>
                    <button onClick={async () => {
                      await toggleInsuranceCompany(store!.id, company.id)
                      loadInsuranceCompanies()
                    }} className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                      company.is_active ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"
                    }`}>
                      {company.is_active ? t("تعطيل", "Disable") : t("تفعيل", "Enable")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Variant Manager Modal ===== */}
      {showVariantModal && variantProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowVariantModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Ruler className="h-5 w-5 text-indigo-500" />
                {t("مقاسات وألوان", "Sizes & Colors")} - {variantProduct.name}
              </h3>
              <button onClick={() => setShowVariantModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Current Sizes - removable */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t("المقاسات الحالية", "Current Sizes")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {variantSizes.map(size => (
                    <span key={size} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-lg border border-indigo-200">
                      {size}
                      <button onClick={() => setVariantSizes(prev => prev.filter(s => s !== size))}
                        className="text-indigo-400 hover:text-red-500 transition"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Current Colors - removable */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">{t("الألوان الحالية", "Current Colors")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {variantColors.map(c => (
                    <span key={c.name} className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-700 text-xs px-2 py-1 rounded-lg border border-gray-200">
                      <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c.hex }} />
                      {c.name}
                      <button onClick={() => setVariantColors(prev => prev.filter(vc => vc.name !== c.name))}
                        className="text-gray-400 hover:text-red-500 transition"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
              {/* Size/Color Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-2 py-1.5 text-right text-gray-600 font-medium">{t("المقاس", "Size")}</th>
                      {variantColors.map(c => (
                        <th key={c.name} className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c.hex }} />
                            <span className="text-xs text-gray-600">{c.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variantSizes.map(size => (
                      <tr key={size} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-medium text-gray-800">{size}</td>
                        {variantColors.map(color => {
                          const key = `${size}_${color.name}`
                          return (
                            <td key={key} className="px-1 py-1">
                              <input
                                type="number"
                                min="0"
                                value={variantStockMatrix[key] || ""}
                                onChange={(e) => setVariantStockMatrix(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                                className="w-14 h-9 sm:h-8 text-center text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="0"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Add Size/Color */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">{t("إضافة مقاس", "Add Size")}</label>
                  <div className="flex gap-1">
                    <input type="text" id="new-size-input" placeholder="3XL"
                      className="flex-1 h-8 bg-gray-50 text-gray-800 rounded-lg px-2 text-sm border border-gray-200" />
                    <button onClick={() => {
                      const input = document.getElementById("new-size-input") as HTMLInputElement
                      if (input?.value.trim() && !variantSizes.includes(input.value.trim())) {
                        setVariantSizes(prev => [...prev, input.value.trim()])
                        input.value = ""
                      }
                    }} className="bg-indigo-500 text-white px-2 rounded-lg text-sm hover:bg-indigo-600"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t("إضافة لون", "Add Color")}</label>
                  <div className="flex gap-1">
                    <input type="text" id="new-color-name" placeholder={t("أخضر", "Green")}
                      className="flex-1 h-8 bg-gray-50 text-gray-800 rounded-lg px-2 text-sm border border-gray-200" />
                    <input type="color" id="new-color-hex" defaultValue="#00FF00" className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer" />
                    <button onClick={() => {
                      const nameInput = document.getElementById("new-color-name") as HTMLInputElement
                      const hexInput = document.getElementById("new-color-hex") as HTMLInputElement
                      if (nameInput?.value.trim() && !variantColors.some(c => c.name === nameInput.value.trim())) {
                        setVariantColors(prev => [...prev, { name: nameInput.value.trim(), hex: hexInput?.value || "#000000" }])
                        nameInput.value = ""
                      }
                    }} className="bg-indigo-500 text-white px-2 rounded-lg text-sm hover:bg-indigo-600"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button onClick={handleSaveVariants} disabled={variantSaving}
                className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2">
                {variantSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Palette className="h-4 w-4" />}
                {variantSaving ? t("جاري الحفظ...", "Saving...") : t("حفظ المقاسات", "Save Variants")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Variant Picker Modal ===== */}
      {showVariantPicker && variantPickerProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowVariantPicker(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-500" />
                {t("اختر المقاس واللون", "Pick Size & Color")}
              </h3>
              <button onClick={() => setShowVariantPicker(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[75dvh] md:max-h-[60vh] overflow-y-auto">
              <p className="text-sm font-medium text-gray-800">{variantPickerProduct.name}</p>
              {(productVariants[variantPickerProduct.id] || []).length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Ruler className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t("لا توجد مقاسات مسجلة", "No variants set")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(productVariants[variantPickerProduct.id] || []).filter(v => v.stock > 0).map((variant, idx) => (
                    <button key={idx}
                      onClick={() => handleAddVariantToCart(variantPickerProduct, variant)}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition text-right">
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: variant.color_hex || "#000" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{variant.size}</p>
                        <p className="text-xs text-gray-500">{variant.color}</p>
                      </div>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{variant.stock}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Loyalty Modal ===== */}
      {showLoyaltyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowLoyaltyModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                {t("برنامج الولاء", "Loyalty Program")}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowLoyaltyConfig(!showLoyaltyConfig)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg transition">{t("إعدادات", "Settings")}</button>
                <button onClick={() => setShowLoyaltyModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Loyalty Config */}
            {showLoyaltyConfig && loyaltyConfig && (
              <div className="p-4 border-b border-gray-200 bg-amber-50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">{t("نقاط لكل ج.م", "Points per unit")}</label>
                    <input type="number" value={loyaltyConfig.points_per_unit} onChange={(e) => setLoyaltyConfig(prev => prev ? { ...prev, points_per_unit: Number(e.target.value) } : prev)}
                      className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">{t("قيمة النقطة", "Point value")}</label>
                    <input type="number" value={loyaltyConfig.point_value} onChange={(e) => setLoyaltyConfig(prev => prev ? { ...prev, point_value: Number(e.target.value) } : prev)}
                      step="0.01" className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                </div>
                <button onClick={handleSaveLoyaltyConfig} disabled={loyaltySaving}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                  {loyaltySaving ? "..." : t("حفظ الإعدادات", "Save Settings")}
                </button>
              </div>
            )}

            <div className="p-4 overflow-y-auto max-h-[55vh] space-y-4">
              {/* Search Customer */}
              <div className="flex gap-2">
                <input type="tel" value={loyaltyPhone} onChange={(e) => setLoyaltyPhone(e.target.value)}
                  placeholder={t("رقم هاتف العميل...", "Customer phone...")}
                  className="flex-1 h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-amber-500" dir="ltr" />
                <button onClick={handleSearchLoyaltyCustomer} disabled={loyaltySaving || !loyaltyPhone.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white px-3 rounded-xl text-sm font-medium transition">
                  <Search className="h-4 w-4" />
                </button>
              </div>

              {/* Customer Info */}
              {loyaltyCustomer ? (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{loyaltyCustomer.name}</p>
                      <p className="text-xs text-gray-500">{loyaltyCustomer.phone}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{loyaltyCustomer.points}</p>
                      <p className="text-[10px] text-gray-500">{t("نقطة", "points")}</p>
                    </div>
                  </div>
                  {loyaltyCustomer.tier && (
                    <div className="flex items-center gap-1.5">
                      {loyaltyCustomer.tier === "platinum" && <Medal className="h-4 w-4 text-purple-500" />}
                      {loyaltyCustomer.tier === "gold" && <Medal className="h-4 w-4 text-yellow-500" />}
                      {loyaltyCustomer.tier === "silver" && <Medal className="h-4 w-4 text-gray-400" />}
                      <span className="text-sm font-medium text-gray-700 capitalize">{loyaltyCustomer.tier}</span>
                    </div>
                  )}
                  {/* Customer Notes */}
                  <div className="space-y-1.5">
                    <textarea value={loyaltyNewNotes} onChange={(e) => setLoyaltyNewNotes(e.target.value)} rows={2}
                      placeholder={t("ملاحظات عن العميل (المقاس المفضل، اللون...)","Customer notes (preferred size, color...)")}
                      className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                    <input type="text" value={loyaltyNewPrefs} onChange={(e) => setLoyaltyNewPrefs(e.target.value)}
                      placeholder={t("التفضيلات: أسود - M - كاجوال", "Preferences: black - M - casual")}
                      className="w-full h-8 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                    <button onClick={handleUpdateCustomerNotes} disabled={loyaltySaving}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded-lg text-xs font-medium transition">
                      {t("حفظ الملاحظات", "Save Notes")}
                    </button>
                  </div>
                  {loyaltyCustomer.notes && (
                    <p className="text-xs text-gray-500 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                      <span className="font-medium">{t("ملاحظات:", "Notes:")}</span> {loyaltyCustomer.notes}
                    </p>
                  )}
                  {loyaltyCustomer.preferences && (
                    <p className="text-xs text-gray-500 bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                      <span className="font-medium">{t("التفضيلات:", "Prefs:")}</span> {loyaltyCustomer.preferences}
                    </p>
                  )}
                </div>
              ) : (
                /* New Customer Registration */
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                  <p className="text-sm font-medium text-gray-700">{t("تسجيل عميل جديد", "Register New Customer")}</p>
                  <input type="text" value={loyaltyNewName} onChange={(e) => setLoyaltyNewName(e.target.value)}
                    placeholder={t("اسم العميل *", "Customer name *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="tel" value={loyaltyNewPhone} onChange={(e) => setLoyaltyNewPhone(e.target.value)}
                    placeholder={t("رقم الهاتف *", "Phone *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                  <textarea value={loyaltyNewNotes} onChange={(e) => setLoyaltyNewNotes(e.target.value)} rows={2}
                    placeholder={t("ملاحظات أو تفضيلات...", "Notes or preferences...")}
                    className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                  <button onClick={handleCreateLoyaltyCustomer} disabled={loyaltySaving || !loyaltyNewName.trim() || !loyaltyNewPhone.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                    {loyaltySaving ? "..." : t("تسجيل", "Register")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Installment Modal ===== */}
      {showInstallmentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowInstallmentModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-pink-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-pink-500" />
                {t("التقسيط", "Installments")}
              </h3>
              <button onClick={() => setShowInstallmentModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* New Installment */}
              {cart.length > 0 && (
                <div className="bg-pink-50 rounded-xl p-3 border border-pink-200 space-y-2">
                  <p className="text-sm font-medium text-pink-700">{t("خطة تقسيط جديدة", "New Installment Plan")}</p>
                  <p className="text-xs text-gray-500">{t("إجمالي السلة:", "Cart total:")} <span className="font-bold">{total.toFixed(2)} {currencyLabel}</span></p>
                  <input type="text" value={installmentCustomerName} onChange={(e) => setInstallmentCustomerName(e.target.value)}
                    placeholder={t("اسم العميل *", "Customer name *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="tel" value={installmentCustomerPhone} onChange={(e) => setInstallmentCustomerPhone(e.target.value)}
                    placeholder={t("رقم الهاتف *", "Phone *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">{t("المقدم", "Down Payment")}</label>
                      <input type="number" value={installmentDownPayment} onChange={(e) => setInstallmentDownPayment(e.target.value)}
                        placeholder="0" min="0"
                        className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">{t("عدد الأشهر", "Months")}</label>
                      <select value={installmentMonths} onChange={(e) => setInstallmentMonths(e.target.value)}
                        className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200">
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="6">6</option>
                        <option value="12">12</option>
                      </select>
                    </div>
                  </div>
                  {installmentDownPayment && (
                    <p className="text-xs text-gray-500">{t("القسط الشهري:", "Monthly:")} <span className="font-bold text-pink-600">
                      {((total - (Number(installmentDownPayment) || 0)) / (Number(installmentMonths) || 3)).toFixed(2)} {currencyLabel}
                    </span></p>
                  )}
                  <button onClick={handleCreateInstallment} disabled={installmentSaving || !installmentCustomerName.trim() || !installmentCustomerPhone.trim()}
                    className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                    {installmentSaving ? "..." : t("إنشاء خطة التقسيط", "Create Installment")}
                  </button>
                </div>
              )}

              {/* Existing Installments */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><Clock className="h-4 w-4" /> {t("الأقساط الحالية", "Current Installments")}</p>
                {installments.length === 0 ? (
                  <p className="text-center py-4 text-gray-400 text-sm">{t("لا توجد أقساط", "No installments")}</p>
                ) : (
                  installments.map(inst => (
                    <div key={inst.id} className={`p-3 rounded-xl border ${inst.status === "completed" ? "border-green-200 bg-green-50" : inst.status === "overdue" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-gray-800">{inst.customer_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${inst.status === "completed" ? "bg-green-100 text-green-700" : inst.status === "overdue" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {inst.status === "completed" ? t("مكتمل", "Done") : inst.status === "overdue" ? t("متأخر", "Overdue") : t("نشط", "Active")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{inst.total_amount.toFixed(2)} {currencyLabel} / {inst.remaining.toFixed(2)} {t("متبقي", "rem.")}</p>
                      {inst.status === "active" && (
                        <button onClick={() => handlePayInstallment(inst.id!, inst.installment_amount)}
                          className="mt-1.5 w-full bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs py-1.5 rounded-lg border border-pink-200 font-medium transition">
                          {t("دفع قسط", "Pay Installment")} ({inst.installment_amount.toFixed(2)})
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Season Modal ===== */}
      {showSeasonModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowSeasonModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-cyan-500" />
                {t("إدارة المواسم", "Season Management")}
              </h3>
              <button onClick={() => setShowSeasonModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Active Season */}
              {activeSeason && (
                <div className="bg-gradient-to-r from-cyan-50 to-sky-50 rounded-xl p-3 border border-cyan-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Sun className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm font-bold text-cyan-700">{t("الموسم الحالي:", "Active Season:")}</span>
                  </div>
                  <p className="text-sm text-gray-700">{activeSeason.season_name} - <span className="font-bold text-cyan-600">{activeSeason.discount}% {t("خصم", "off")}</span></p>
                </div>
              )}

              {/* New Season */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                <p className="text-sm font-medium text-gray-700">{t("موسم جديد", "New Season")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder={t("الاسم بالإنجليزية *", "Name (EN) *")}
                    className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="text" value={newSeasonNameAr} onChange={(e) => setNewSeasonNameAr(e.target.value)}
                    placeholder={t("الاسم بالعربية", "Name (AR)")}
                    className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">{t("البداية", "Start")}</label>
                    <input type="date" value={newSeasonStart} onChange={(e) => setNewSeasonStart(e.target.value)}
                      className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t("النهاية", "End")}</label>
                    <input type="date" value={newSeasonEnd} onChange={(e) => setNewSeasonEnd(e.target.value)}
                      className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">{t("نسبة الخصم %", "Discount %")}</label>
                    <input type="number" value={newSeasonDiscount} onChange={(e) => setNewSeasonDiscount(e.target.value)}
                      min="0" max="100" className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  </div>
                  <div className="flex items-end pb-0.5">
                    <button onClick={() => setNewSeasonClearance(!newSeasonClearance)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition w-full justify-center ${newSeasonClearance ? "bg-red-100 text-red-700 ring-1 ring-red-300" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                      {newSeasonClearance ? "🔥" : "❄️"} {t("تصفية", "Clearance")}
                    </button>
                  </div>
                </div>
                <button onClick={handleCreateSeason} disabled={seasonSaving || !newSeasonName.trim() || !newSeasonStart || !newSeasonEnd}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                  {seasonSaving ? "..." : t("إنشاء الموسم", "Create Season")}
                </button>
              </div>

              {/* Existing Seasons */}
              <div className="space-y-2">
                {seasons.map(season => (
                  <div key={season.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${season.is_active ? "border-cyan-200 bg-cyan-50/50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{season.name_ar || season.name} {season.is_clearance && "🔥"}</p>
                      <p className="text-xs text-gray-500">{season.start_date} → {season.end_date} {(season.discount_percentage || 0) > 0 && `(${season.discount_percentage || 0}%)`}</p>
                    </div>
                    <button onClick={async () => { await toggleSeason(store!.id, season.id!); handleLoadSeasons() }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${season.is_active ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-green-100 text-green-600 hover:bg-green-200"}`}>
                      {season.is_active ? t("تعطيل", "Disable") : t("تفعيل", "Enable")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Supplier Modal ===== */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowSupplierModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-500" />
                {t("الموردين", "Suppliers")}
              </h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Add Supplier */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                <input type="text" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder={t("اسم المورد *", "Supplier name *")}
                  className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                <input type="tel" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder={t("رقم الهاتف", "Phone")}
                  className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                <button onClick={handleAddSupplier} disabled={supplierSaving || !newSupplierName.trim()}
                  className="w-full bg-slate-500 hover:bg-slate-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  {supplierSaving ? "..." : t("إضافة مورد", "Add Supplier")}
                </button>
              </div>
              {/* List */}
              {suppliers.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>{t("لا يوجد موردين", "No suppliers")}</p>
                </div>
              ) : (
                suppliers.map(supplier => (
                  <div key={supplier.id} className="p-3 rounded-xl border border-gray-200 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{supplier.name}</p>
                        {supplier.phone && <p className="text-xs text-gray-500" dir="ltr">{supplier.phone}</p>}
                        <p className="text-[10px] text-gray-400">{t("عدد المنتجات:", "Products:")} {supplierProductCounts[supplier.id!] || 0}</p>
                      </div>
                      <button onClick={() => setLinkingSupplier(linkingSupplier === supplier.id ? null : supplier.id!)}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded-lg border border-blue-200 transition">
                        <Plus className="h-3 w-3 inline" /> {t("ربط منتج", "Link Product")}
                      </button>
                    </div>
                    {linkingSupplier === supplier.id && (
                      <div className="bg-blue-50 rounded-lg p-2 space-y-1 border border-blue-200">
                        <input type="text" value={linkProductSearch} onChange={(e) => setLinkProductSearch(e.target.value)}
                          placeholder={t("ابحث عن منتج...", "Search product...")}
                          className="w-full h-8 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                        {linkProductSearch.trim() && (
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {products.filter(p => p.name.toLowerCase().includes(linkProductSearch.toLowerCase())).slice(0, 5).map(p => (
                              <button key={p.id} onClick={() => handleLinkProductToSupplier(supplier.id!, p)}
                                className="w-full text-right text-xs p-1.5 rounded hover:bg-blue-100 transition flex items-center justify-between">
                                <span className="text-gray-800">{p.name}</span>
                                <span className="text-gray-400">{p.price} {currencyLabel}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Gift Card Modal ===== */}
      {showGiftCardModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowGiftCardModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-fuchsia-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Gift className="h-5 w-5 text-fuchsia-500" />
                {t("بطاقات الهدايا", "Gift Cards")}
              </h3>
              <button onClick={() => setShowGiftCardModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Create Gift Card */}
              <div className="bg-fuchsia-50 rounded-xl p-3 border border-fuchsia-200 space-y-2">
                <p className="text-sm font-medium text-fuchsia-700">{t("إنشاء بطاقة هدية", "Create Gift Card")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">{t("الرصيد", "Balance")}</label>
                    <input type="number" value={newGiftCardBalance} onChange={(e) => setNewGiftCardBalance(e.target.value)}
                      placeholder="100" min="1"
                      className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">{t("اسم المستلم", "Recipient")}</label>
                    <input type="text" value={newGiftCardRecipient} onChange={(e) => setNewGiftCardRecipient(e.target.value)}
                      placeholder={t("اختياري", "Optional")}
                      className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  </div>
                </div>
                <button onClick={handleCreateGiftCard} disabled={giftCardSaving || !newGiftCardBalance}
                  className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                  {giftCardSaving ? "..." : t("إنشاء البطاقة", "Create Card")}
                </button>
              </div>

              {/* Existing Gift Cards */}
              {giftCards.length === 0 ? (
                <p className="text-center py-4 text-gray-400 text-sm">{t("لا توجد بطاقات هدايا", "No gift cards")}</p>
              ) : (
                giftCards.map(card => (
                  <div key={card.id} className={`flex items-center justify-between p-3 rounded-xl border ${card.current_balance > 0 ? "border-fuchsia-200 bg-fuchsia-50/50" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                    <div>
                      <p className="text-sm font-bold text-gray-800 font-mono">{card.code}</p>
                      <p className="text-xs text-gray-500">{t("الرصيد:", "Balance:")} {card.current_balance.toFixed(2)} / {card.initial_balance.toFixed(2)} {currencyLabel}</p>
                      {card.recipient_name && <p className="text-[10px] text-gray-400">{card.recipient_name}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${card.current_balance > 0 && card.current_balance > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {card.current_balance > 0 && card.current_balance > 0 ? t("نشط", "Active") : t("مستنفد", "Used")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Reservation Modal ===== */}
      {showReservationModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowReservationModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-lime-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-lime-500" />
                {t("الحجوزات", "Reservations")}
              </h3>
              <button onClick={() => setShowReservationModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* New Reservation */}
              {reserveProduct && (
                <div className="bg-lime-50 rounded-xl p-3 border border-lime-200 space-y-2">
                  <p className="text-sm font-medium text-lime-700">{t("حجز:", "Reserve:")} {reserveProduct.name}</p>
                  <input type="text" value={reserveCustomerName} onChange={(e) => setReserveCustomerName(e.target.value)}
                    placeholder={t("اسم العميل *", "Customer name *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="tel" value={reserveCustomerPhone} onChange={(e) => setReserveCustomerPhone(e.target.value)}
                    placeholder={t("رقم الهاتف *", "Phone *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">{t("مدة الحجز", "Hold Duration")}</label>
                      <select value={reserveHours} onChange={(e) => setReserveHours(e.target.value)}
                        className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200">
                        <option value="1">{t("ساعة واحدة", "1 hour")}</option>
                        <option value="24">{t("يوم واحد", "1 day")}</option>
                        <option value="48">{t("يومين", "2 days")}</option>
                        <option value="72">{t("3 أيام", "3 days")}</option>
                        <option value="168">{t("أسبوع", "1 week")}</option>
                        <option value="336">{t("أسبوعين", "2 weeks")}</option>
                        <option value="custom">{t("أخرى...", "Custom...")}</option>
                      </select>
                      {reserveHours === "custom" && (
                        <input type="number" min="1" placeholder={t("عدد الساعات", "Hours")}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v && Number(v) > 0) setReserveHours(v)
                          }}
                          className="w-full h-8 mt-1 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{t("السعر", "Price")}</label>
                      <p className="h-9 flex items-center text-sm font-bold text-gray-800">{reserveProduct.price.toFixed(2)} {currencyLabel}</p>
                    </div>
                  </div>
                  <textarea value={reserveNotes} onChange={(e) => setReserveNotes(e.target.value)} rows={2}
                    placeholder={t("ملاحظات...", "Notes...")}
                    className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                  <button onClick={handleCreateReservation} disabled={reserveSaving || !reserveCustomerName.trim() || !reserveCustomerPhone.trim()}
                    className="w-full bg-lime-500 hover:bg-lime-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                    {reserveSaving ? "..." : t("تأكيد الحجز", "Confirm Reservation")}
                  </button>
                </div>
              )}

              {/* Active Reservations */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{t("الحجوزات النشطة", "Active Reservations")}</p>
                {reservations.filter(r => r.status === "active").length === 0 ? (
                  <p className="text-center py-4 text-gray-400 text-sm">{t("لا توجد حجوزات", "No reservations")}</p>
                ) : (
                  reservations.filter(r => r.status === "active").map(res => (
                    <div key={res.id} className="p-3 rounded-xl border border-lime-200 bg-lime-50/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-800">{res.product_name}</span>
                        {res.variant_info && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{res.variant_info}</span>}
                      </div>
                      <p className="text-xs text-gray-500">{res.customer_name} - {res.customer_phone}</p>
                      <p className="text-[10px] text-gray-400">{t("ينتهي:", "Expires:")} {new Date(res.reserved_until).toLocaleString("ar-EG")}</p>
                      <div className="flex gap-2 mt-1">
                        <button onClick={async () => { await updateReservationStatus(store!.id, res.id!, "fulfilled"); handleLoadReservations() }}
                          className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs py-1.5 rounded-lg border border-green-200 font-medium transition">
                          {t("تم البيع", "Sold")}
                        </button>
                        <button onClick={async () => { await updateReservationStatus(store!.id, res.id!, "cancelled"); handleLoadReservations() }}
                          className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs py-1.5 rounded-lg border border-red-200 font-medium transition">
                          {t("إلغاء", "Cancel")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Clothing: Invoice Discount Rules Modal ===== */}
      {showInvoiceDiscountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowInvoiceDiscountModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <PercentCircle className="h-5 w-5 text-yellow-500" />
                {t("قواعد خصم الفاتورة", "Invoice Discount Rules")}
              </h3>
              <button onClick={() => setShowInvoiceDiscountModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Add Rule */}
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 space-y-2">
                <p className="text-sm font-medium text-yellow-700">{t("إضافة قاعدة", "Add Rule")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">{t("الحد الأدنى", "Min Amount")}</label>
                    <input type="number" value={newRuleMin} onChange={(e) => setNewRuleMin(e.target.value)}
                      placeholder="500" min="0"
                      className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t("النوع", "Type")}</label>
                    <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as "percentage"|"fixed")}
                      className="w-full h-9 bg-white rounded-lg px-1 text-sm border border-gray-200">
                      <option value="percentage">%</option>
                      <option value="fixed">{currencyLabel}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">{t("القيمة", "Value")}</label>
                    <input type="number" value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)}
                      placeholder="10" min="0"
                      className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                  </div>
                </div>
                <button onClick={handleAddInvoiceRule} disabled={!newRuleMin || !newRuleValue}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  {t("إضافة", "Add")}
                </button>
              </div>

              {/* Rules List */}
              {invoiceDiscountRules.length === 0 ? (
                <p className="text-center py-4 text-gray-400 text-sm">{t("لا توجد قواعد خصم", "No discount rules")}</p>
              ) : (
                <div className="space-y-2">
                  {invoiceDiscountRules.map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white">
                      <p className="text-sm text-gray-800">
                        {t("أكثر من", "Over")} <span className="font-bold">{rule.min_amount}</span> {currencyLabel} →{" "}
                        <span className="font-bold text-yellow-600">{rule.discount_value}{rule.discount_type === "percentage" ? "%" : ` ${currencyLabel}`}</span> {t("خصم", "off")}
                      </p>
                      <button onClick={() => setInvoiceDiscountRules(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleSaveInvoiceDiscountRules}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition">
                {t("حفظ القواعد", "Save Rules")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Incoming Orders Modal ===== */}
      {showOnlineOrdersModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => { setShowOnlineOrdersModal(false); setSelectedOnlineOrder(null) }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-blue-500" />
                {t("الطلبات الواردة", "Incoming Orders")}
                {onlineOrders.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{onlineOrders.length}</span>}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  setOnlineOrdersLoading(true)
                  const orders = await getIncomingOnlineOrders(store!.id)
                  setOnlineOrders(orders); setOnlineOrdersLoading(false)
                }} className="text-blue-500 hover:text-blue-700 p-1 rounded-lg hover:bg-blue-50"><RefreshCw className="h-4 w-4" /></button>
                <button onClick={() => { setShowOnlineOrdersModal(false); setSelectedOnlineOrder(null) }} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
              {onlineOrdersLoading ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" /></div>
              ) : selectedOnlineOrder ? (
                <div className="space-y-3">
                  <button onClick={() => setSelectedOnlineOrder(null)} className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"><ChevronLeft className="h-4 w-4" />{t("رجوع", "Back")}</button>
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-bold text-blue-800">#{selectedOnlineOrder.order_number || selectedOnlineOrder.id.substring(0, 8)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        selectedOnlineOrder.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        selectedOnlineOrder.status === "confirmed" ? "bg-green-100 text-green-700" :
                        selectedOnlineOrder.status === "processing" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{selectedOnlineOrder.status}</span>
                    </div>
                    <p className="text-xs text-gray-600">{t("العميل:", "Customer:")} {selectedOnlineOrder.customer_name}</p>
                    {selectedOnlineOrder.customer_phone && <p className="text-xs text-gray-500" dir="ltr">{selectedOnlineOrder.customer_phone}</p>}
                    {selectedOnlineOrder.delivery_address && <p className="text-xs text-gray-500 mt-1"><MapPin className="h-3 w-3 inline" /> {selectedOnlineOrder.delivery_address}</p>}
                    <p className="text-xs text-gray-500">{t("الدفع:", "Payment:")} {selectedOnlineOrder.payment_method || "COD"} — {selectedOnlineOrder.payment_status || "pending"}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(selectedOnlineOrder.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                  {/* Order Items */}
                  <div className="space-y-1">
                    {selectedOnlineOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.quantity} × {item.price.toFixed(2)}</p>
                        </div>
                        <p className="font-bold text-gray-800">{(item.quantity * item.price).toFixed(2)}</p>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                      <span>{t("الإجمالي", "Total")}</span>
                      <span>{selectedOnlineOrder.total.toFixed(2)} {t("ج.م", "EGP")}</span>
                    </div>
                    {(selectedOnlineOrder.delivery_fee || 0) > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{t("رسوم التوصيل", "Delivery fee")}</span>
                        <span>{(selectedOnlineOrder.delivery_fee || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  {/* Status Actions */}
                  <div className="flex gap-2 pt-2">
                    {selectedOnlineOrder.status === "pending" && (
                      <>
                        <button onClick={async () => {
                          await updateOnlineOrderStatus(selectedOnlineOrder.id, "confirmed", "Order confirmed from POS")
                          const orders = await getIncomingOnlineOrders(store!.id); setOnlineOrders(orders)
                          setSelectedOnlineOrder({ ...selectedOnlineOrder, status: "confirmed" })
                        }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-medium transition">
                          {t("قبول", "Accept")}
                        </button>
                        <button onClick={async () => {
                          await updateOnlineOrderStatus(selectedOnlineOrder.id, "cancelled", "Cancelled from POS")
                          const orders = await getIncomingOnlineOrders(store!.id); setOnlineOrders(orders)
                          setSelectedOnlineOrder(null)
                        }} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-medium transition">
                          {t("رفض", "Reject")}
                        </button>
                      </>
                    )}
                    {selectedOnlineOrder.status === "confirmed" && (
                      <button onClick={async () => {
                        await updateOnlineOrderStatus(selectedOnlineOrder.id, "processing", "Order being prepared")
                        const orders = await getIncomingOnlineOrders(store!.id); setOnlineOrders(orders)
                        setSelectedOnlineOrder({ ...selectedOnlineOrder, status: "processing" })
                      }} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-sm font-medium transition">
                        {t("بدء التجهيز", "Start Processing")}
                      </button>
                    )}
                    {selectedOnlineOrder.status === "processing" && (
                      <button onClick={async () => {
                        await updateOnlineOrderStatus(selectedOnlineOrder.id, "shipped", "Order shipped")
                        const orders = await getIncomingOnlineOrders(store!.id); setOnlineOrders(orders)
                        setSelectedOnlineOrder({ ...selectedOnlineOrder, status: "shipped" })
                      }} className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium transition">
                        {t("تم الشحن", "Mark Shipped")}
                      </button>
                    )}
                    {/* Confirm Payment */}
                    {selectedOnlineOrder.payment_status !== "confirmed" && selectedOnlineOrder.payment_method !== "cod" && (
                      <button onClick={async () => {
                        await confirmOnlinePayment(selectedOnlineOrder.id, selectedOnlineOrder.payment_method || "wallet")
                        setSelectedOnlineOrder({ ...selectedOnlineOrder, payment_status: "confirmed" })
                      }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium transition">
                        {t("تأكيد الدفع", "Confirm Pay")}
                      </button>
                    )}
                  </div>
                </div>
              ) : onlineOrders.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">{t("لا توجد طلبات واردة", "No incoming orders")}</p>
              ) : (
                onlineOrders.map(order => (
                  <div key={order.id} onClick={() => setSelectedOnlineOrder(order)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition space-y-1">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-gray-800">#{order.order_number || order.id.substring(0, 8)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        order.status === "confirmed" ? "bg-green-100 text-green-700" :
                        order.status === "processing" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{order.status}</span>
                    </div>
                    <p className="text-xs text-gray-600">{order.customer_name} — {order.items.length} {t("منتج", "items")}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">{new Date(order.created_at).toLocaleString("ar-EG")}</span>
                      <span className="font-bold text-gray-700">{order.total.toFixed(2)} {t("ج.م", "EGP")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Shipping Zones Modal ===== */}
      {showShippingModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowShippingModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-500" />
                {t("مناطق الشحن", "Shipping Zones")}
              </h3>
              <button onClick={() => setShowShippingModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Add Zone */}
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 space-y-2">
                <p className="text-sm font-medium text-emerald-700">{t("إضافة منطقة جديدة", "Add New Zone")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={newZoneNameAr} onChange={e => setNewZoneNameAr(e.target.value)}
                    placeholder={t("اسم المنطقة", "Zone name (AR)")} className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                    placeholder={t("Name (EN)", "Name (EN)")} className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                </div>
                <input type="text" value={newZoneGov} onChange={e => setNewZoneGov(e.target.value)}
                  placeholder={t("المحافظة (مثل: القاهرة)", "Governorate (e.g. Cairo)")} className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={newZoneFee} onChange={e => setNewZoneFee(e.target.value)}
                    placeholder={t("رسوم الشحن", "Shipping fee")} className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" min="0" />
                  <input type="number" value={newZoneDays} onChange={e => setNewZoneDays(e.target.value)}
                    placeholder={t("أيام التوصيل", "Delivery days")} className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" min="1" />
                  <input type="number" value={newZoneFreeMin} onChange={e => setNewZoneFreeMin(e.target.value)}
                    placeholder={t("شحن مجاني فوق", "Free above")} className="h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" min="0" />
                </div>
                <button onClick={async () => {
                  if (!newZoneNameAr || !newZoneGov || !newZoneFee) return
                  setShippingSaving(true)
                  const res = await createShippingZone(store!.id, {
                    name: newZoneName || newZoneNameAr,
                    name_ar: newZoneNameAr,
                    governorate: newZoneGov,
                    delivery_fee: Number(newZoneFee),
                    estimated_days: Number(newZoneDays) || 3,
                    is_active: true,
                    free_shipping_min: newZoneFreeMin ? Number(newZoneFreeMin) : undefined,
                  })
                  if (res.success) {
                    const zones = await getShippingZones(store!.id); setShippingZones(zones)
                    setNewZoneNameAr(""); setNewZoneName(""); setNewZoneGov(""); setNewZoneFee(""); setNewZoneDays("3"); setNewZoneFreeMin("")
                  }
                  setShippingSaving(false)
                }} disabled={shippingSaving || !newZoneNameAr || !newZoneGov || !newZoneFee}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                  {shippingSaving ? "..." : t("إضافة المنطقة", "Add Zone")}
                </button>
              </div>

              {/* Existing Zones */}
              {shippingZonesLoading ? (
                <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent" /></div>
              ) : shippingZones.length === 0 ? (
                <p className="text-center py-4 text-gray-400 text-sm">{t("لا توجد مناطق شحن", "No shipping zones")}</p>
              ) : (
                shippingZones.map(zone => (
                  <div key={zone.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{zone.name_ar || zone.name}</p>
                      <p className="text-xs text-gray-500">{zone.governorate} — {zone.estimated_days} {t("يوم", "days")}</p>
                      <p className="text-xs text-emerald-600 font-medium">{zone.delivery_fee.toFixed(2)} {t("ج.م", "EGP")}
                        {zone.free_shipping_min ? ` (${t("مجاني فوق", "free above")} ${zone.free_shipping_min})` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={async () => {
                        await updateShippingZone(store!.id, zone.id, { is_active: !zone.is_active })
                        const zones = await getShippingZones(store!.id); setShippingZones(zones)
                      }} className={`text-xs px-2 py-1 rounded-lg ${zone.is_active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {zone.is_active ? t("نشط", "On") : t("معطل", "Off")}
                      </button>
                      <button onClick={async () => {
                        await deleteShippingZone(store!.id, zone.id)
                        setShippingZones(prev => prev.filter(z => z.id !== zone.id))
                      }} className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-500 hover:bg-red-200">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Payment Config Modal ===== */}
      {showPaymentConfigModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPaymentConfigModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-indigo-500" />
                {t("إعدادات الدفع", "Payment Settings")}
              </h3>
              <button onClick={() => setShowPaymentConfigModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* COD */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t("الدفع عند الاستلام", "Cash on Delivery")}</p>
                  <p className="text-xs text-gray-500">COD</p>
                </div>
                <button onClick={() => setPaymentConfig(prev => ({ ...prev, cod_enabled: !prev.cod_enabled }))}
                  className={`w-12 h-6 rounded-full transition ${paymentConfig.cod_enabled ? "bg-green-500" : "bg-gray-300"} relative`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${paymentConfig.cod_enabled ? "right-0.5" : "left-0.5"}`} />
                </button>
              </div>
              {/* Wallet */}
              <div className="p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t("محفظة إلكترونية", "E-Wallet")}</p>
                    <p className="text-xs text-gray-500">Vodafone Cash, Fawry, etc.</p>
                  </div>
                  <button onClick={() => setPaymentConfig(prev => ({ ...prev, wallet_enabled: !prev.wallet_enabled }))}
                    className={`w-12 h-6 rounded-full transition ${paymentConfig.wallet_enabled ? "bg-green-500" : "bg-gray-300"} relative`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${paymentConfig.wallet_enabled ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
                {paymentConfig.wallet_enabled && (
                  <input type="tel" value={paymentConfig.wallet_number || ""} onChange={e => setPaymentConfig(prev => ({ ...prev, wallet_number: e.target.value }))}
                    placeholder={t("رقم المحفظة", "Wallet number")} className="w-full h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                )}
              </div>
              {/* InstaPay */}
              <div className="p-3 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">InstaPay</p>
                    <p className="text-xs text-gray-500">{t("تحويل بنكي فوري", "Instant bank transfer")}</p>
                  </div>
                  <button onClick={() => setPaymentConfig(prev => ({ ...prev, instapay_enabled: !prev.instapay_enabled }))}
                    className={`w-12 h-6 rounded-full transition ${paymentConfig.instapay_enabled ? "bg-green-500" : "bg-gray-300"} relative`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${paymentConfig.instapay_enabled ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
                {paymentConfig.instapay_enabled && (
                  <div className="space-y-2">
                    <input type="text" value={paymentConfig.instapay_name || ""} onChange={e => setPaymentConfig(prev => ({ ...prev, instapay_name: e.target.value }))}
                      placeholder={t("اسم صاحب الحساب", "Account holder name")} className="w-full h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" />
                    <input type="text" value={paymentConfig.instapay_number || ""} onChange={e => setPaymentConfig(prev => ({ ...prev, instapay_number: e.target.value }))}
                      placeholder={t("رقم InstaPay", "InstaPay number")} className="w-full h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                  </div>
                )}
              </div>
              <button onClick={async () => {
                setPaymentConfigSaving(true)
                await savePaymentConfig(store!.id, paymentConfig)
                setPaymentConfigSaving(false)
                setShowPaymentConfigModal(false)
              }} disabled={paymentConfigSaving}
                className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold transition">
                {paymentConfigSaving ? "..." : t("حفظ الإعدادات", "Save Settings")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Low Stock Modal ===== */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowLowStockModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                {t("تنبيه المخزون المنخفض", "Low Stock Alerts")}
              </h3>
              <button onClick={() => setShowLowStockModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
              <div className="flex items-center gap-2 bg-orange-50 p-2 rounded-xl">
                <span className="text-xs text-orange-600">{t("الحد:", "Threshold:")}</span>
                <input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(Number(e.target.value) || 5)}
                  className="w-16 h-7 bg-white rounded-lg px-2 text-sm border border-orange-200 text-center" dir="ltr" min="1" />
                <button onClick={async () => {
                  setLowStockLoading(true)
                  const items = await getLowStockProducts(store!.id, lowStockThreshold)
                  setLowStockProducts(items); setLowStockLoading(false)
                }} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600">{t("تحديث", "Refresh")}</button>
              </div>
              {lowStockLoading ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" /></div>
              ) : lowStockProducts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">{t("المخزون بخير!", "Stock is fine!")}</p>
                </div>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-orange-200 bg-orange-50/50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.price.toFixed(2)} {t("ج.م", "EGP")}</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      p.stock === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                    }`}>{p.stock}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Tier Pricing Modal ===== */}
      {showTierPricingModal && tierPricingProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => { setShowTierPricingModal(false); setTierPricingProduct(null) }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Tag className="h-5 w-5 text-purple-500" />
                {t("تسعير بالكمية", "Tier Pricing")}
              </h3>
              <button onClick={() => { setShowTierPricingModal(false); setTierPricingProduct(null) }} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
              <p className="text-sm text-gray-600">{t("المنتج:", "Product:")} <span className="font-bold">{tierPricingProduct.name}</span></p>
              <p className="text-xs text-gray-400">{t("السعر الأساسي:", "Base price:")} {tierPricingProduct.price.toFixed(2)} {t("ج.م", "EGP")}</p>
              {tierPricingRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="number" value={row.min_qty} onChange={e => {
                    const newRows = [...tierPricingRows]; newRows[i] = { ...newRows[i], min_qty: e.target.value }; setTierPricingRows(newRows)
                  }} placeholder={t("من كمية", "Min qty")} className="flex-1 h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" dir="ltr" min="2" />
                  <input type="number" value={row.price} onChange={e => {
                    const newRows = [...tierPricingRows]; newRows[i] = { ...newRows[i], price: e.target.value }; setTierPricingRows(newRows)
                  }} placeholder={t("سعر الوحدة", "Unit price")} className="flex-1 h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" dir="ltr" min="0" step="0.01" />
                  <button onClick={() => setTierPricingRows(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={() => setTierPricingRows(prev => [...prev, { min_qty: "", price: "" }])}
                className="w-full border-2 border-dashed border-purple-300 text-purple-500 py-2 rounded-xl text-sm hover:bg-purple-50 transition">
                + {t("إضافة مستوى", "Add Tier")}
              </button>
              <button onClick={async () => {
                const validTiers = tierPricingRows.filter(r => Number(r.min_qty) > 0 && Number(r.price) > 0)
                  .map(r => ({ min_qty: Number(r.min_qty), price: Number(r.price) }))
                if (validTiers.length === 0) return
                setTierPricingSaving(true)
                await saveTierPricing(store!.id, tierPricingProduct.id, tierPricingProduct.name, validTiers)
                setTierPricingSaving(false); setShowTierPricingModal(false); setTierPricingProduct(null)
              }} disabled={tierPricingSaving}
                className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold transition">
                {tierPricingSaving ? "..." : t("حفظ التسعير", "Save Pricing")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Returns Modal ===== */}
      {showOnlineReturnsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowOnlineReturnsModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-red-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Undo2 className="h-5 w-5 text-red-500" />
                {t("مرتجعات الأونلاين", "Online Returns")}
                {onlineReturns.filter(r => r.status === "pending").length > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{onlineReturns.filter(r => r.status === "pending").length}</span>
                )}
              </h3>
              <button onClick={() => setShowOnlineReturnsModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3">
              {onlineReturnsLoading ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent" /></div>
              ) : onlineReturns.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">{t("لا توجد مرتجعات", "No returns")}</p>
              ) : (
                onlineReturns.map(ret => (
                  <div key={ret.id} className={`p-3 rounded-xl border ${
                    ret.status === "pending" ? "border-yellow-200 bg-yellow-50/50" :
                    ret.status === "approved" ? "border-green-200 bg-green-50/50" :
                    ret.status === "rejected" ? "border-red-200 bg-red-50/50" :
                    "border-blue-200 bg-blue-50/50"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold text-gray-800">#{ret.order_number || ret.order_id.substring(0, 8)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        ret.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        ret.status === "approved" ? "bg-green-100 text-green-700" :
                        ret.status === "rejected" ? "bg-red-100 text-red-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{ret.status}</span>
                    </div>
                    <p className="text-xs text-gray-600">{ret.customer_name} — {ret.reason}</p>
                    <p className="text-xs text-gray-500">{t("المبلغ:", "Amount:")} {ret.refund_amount.toFixed(2)} {t("ج.م", "EGP")} ({ret.refund_method})</p>
                    <div className="text-xs text-gray-400">{new Date(ret.created_at).toLocaleString("ar-EG")}</div>
                    {ret.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={async () => {
                          await updateOnlineReturnStatus(store!.id, ret.id, "approved")
                          const rets = await getOnlineReturns(store!.id); setOnlineReturns(rets)
                        }} className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-green-600">{t("موافقة", "Approve")}</button>
                        <button onClick={async () => {
                          await updateOnlineReturnStatus(store!.id, ret.id, "rejected")
                          const rets = await getOnlineReturns(store!.id); setOnlineReturns(rets)
                        }} className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-red-600">{t("رفض", "Reject")}</button>
                      </div>
                    )}
                    {ret.status === "approved" && (
                      <button onClick={async () => {
                        await updateOnlineReturnStatus(store!.id, ret.id, "refunded")
                        const rets = await getOnlineReturns(store!.id); setOnlineReturns(rets)
                      }} className="w-full mt-2 bg-blue-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-blue-600">{t("تم الاسترداد", "Mark Refunded")}</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Online: Sales Report Modal ===== */}
      {showOnlineReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowOnlineReportModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-teal-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-500" />
                {t("تقارير المبيعات الأونلاين", "Online Sales Report")}
              </h3>
              <button onClick={() => setShowOnlineReportModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Date Range */}
              <div className="flex items-center gap-2">
                <input type="date" value={onlineReportFrom} onChange={e => setOnlineReportFrom(e.target.value)}
                  className="flex-1 h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" />
                <span className="text-gray-400 text-sm">{t("إلى", "to")}</span>
                <input type="date" value={onlineReportTo} onChange={e => setOnlineReportTo(e.target.value)}
                  className="flex-1 h-9 bg-gray-50 rounded-lg px-3 text-sm border border-gray-200" />
                <button onClick={async () => {
                  setOnlineReportLoading(true)
                  const report = await getOnlineSalesReport(store!.id, onlineReportFrom, onlineReportTo)
                  setOnlineReport(report); setOnlineReportLoading(false)
                }} className="bg-teal-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-600">{t("عرض", "Show")}</button>
              </div>
              {onlineReportLoading ? (
                <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-500 border-t-transparent" /></div>
              ) : onlineReport ? (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{onlineReport.total_orders}</p>
                      <p className="text-xs text-blue-500">{t("إجمالي الطلبات", "Total Orders")}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{onlineReport.total_revenue.toFixed(0)}</p>
                      <p className="text-xs text-green-500">{t("الإيرادات", "Revenue")} ({t("ج.م", "EGP")})</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">{onlineReport.total_items_sold}</p>
                      <p className="text-xs text-purple-500">{t("منتجات مباعة", "Items Sold")}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-orange-600">{onlineReport.total_delivery_fees.toFixed(0)}</p>
                      <p className="text-xs text-orange-500">{t("رسوم التوصيل", "Delivery Fees")} ({t("ج.م", "EGP")})</p>
                    </div>
                  </div>
                  {/* Orders by Status */}
                  {Object.keys(onlineReport.orders_by_status).length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">{t("حسب الحالة", "By Status")}</p>
                      {Object.entries(onlineReport.orders_by_status).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-xs py-1">
                          <span className="text-gray-600">{status}</span>
                          <span className="font-bold text-gray-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Orders by Payment */}
                  {Object.keys(onlineReport.orders_by_payment).length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">{t("حسب طريقة الدفع", "By Payment")}</p>
                      {Object.entries(onlineReport.orders_by_payment).map(([method, count]) => (
                        <div key={method} className="flex justify-between text-xs py-1">
                          <span className="text-gray-600">{method}</span>
                          <span className="font-bold text-gray-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Top Products */}
                  {onlineReport.top_products.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">{t("أكثر المنتجات مبيعاً", "Top Products")}</p>
                      {onlineReport.top_products.map((p, i) => (
                        <div key={p.product_id} className="flex justify-between text-xs py-1">
                          <span className="text-gray-600">{i + 1}. {p.name}</span>
                          <span className="font-bold text-gray-800">{p.qty} — {p.revenue.toFixed(0)} {t("ج.م", "EGP")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-400 text-sm">{t("اختر الفترة واضغط عرض", "Select period and click Show")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Patient File Modal ===== */}
      {showPatientModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPatientModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-purple-500" />
                {t("ملف المريض", "Patient File")}
              </h3>
              <div className="flex items-center gap-2">
                {selectedPatient && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-medium">{selectedPatient.name}</span>
                )}
                <button onClick={() => setShowPatientModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Search Patient */}
              <div className="flex gap-2">
                <input type="text" value={patientSearchQuery} onChange={(e) => setPatientSearchQuery(e.target.value)}
                  placeholder={t("بحث بالاسم أو رقم الهاتف...", "Search by name or phone...")}
                  className="flex-1 h-10 bg-gray-50 text-gray-800 rounded-xl px-3 text-sm border border-gray-200 focus:ring-2 focus:ring-purple-500" />
                <button onClick={async () => {
                  if (!store || !patientSearchQuery.trim()) return
                  setPatientSaving(true)
                  try {
                    const results = await searchPatients(store.id, patientSearchQuery.trim())
                    setPatientSearchResults(results)
                  } catch { /* */ }
                  setPatientSaving(false)
                }} disabled={patientSaving || !patientSearchQuery.trim()}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white px-3 rounded-xl text-sm font-medium transition">
                  <Search className="h-4 w-4" />
                </button>
              </div>

              {/* Search Results */}
              {patientSearchResults.length > 0 && !selectedPatient && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">{t("نتائج البحث", "Search Results")} ({patientSearchResults.length})</p>
                  {patientSearchResults.map(patient => (
                    <button key={patient.id} onClick={async () => {
                      setSelectedPatient(patient)
                      if (store) {
                        try {
                          const meds = await getPatientMedications(store.id, patient.id)
                          setPatientMedications(meds)
                        } catch { /* */ }
                      }
                    }} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition text-right">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800">{patient.name}</p>
                        <p className="text-xs text-gray-500" dir="ltr">{patient.phone}</p>
                      </div>
                      {patient.allergies && patient.allergies.length > 0 && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">⚠️ {t("حساسية", "Allergies")}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Patient Info */}
              {selectedPatient && (
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{selectedPatient.name}</p>
                          <p className="text-xs text-gray-500" dir="ltr">{selectedPatient.phone}</p>
                        </div>
                      </div>
                      <button onClick={() => { setSelectedPatient(null); setPatientMedications([]) }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg">{t("تغيير", "Change")}</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedPatient.date_of_birth && (
                        <div className="bg-white rounded-lg px-2 py-1.5 border border-purple-100">
                          <span className="text-gray-400">{t("تاريخ الميلاد:", "DOB:")}</span> <span className="font-medium text-gray-700">{selectedPatient.date_of_birth}</span>
                        </div>
                      )}
                      {selectedPatient.gender && (
                        <div className="bg-white rounded-lg px-2 py-1.5 border border-purple-100">
                          <span className="text-gray-400">{t("النوع:", "Gender:")}</span> <span className="font-medium text-gray-700">{selectedPatient.gender === "male" ? t("ذكر", "Male") : t("أنثى", "Female")}</span>
                        </div>
                      )}
                    </div>
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                      <div className="mt-2 bg-red-50 rounded-lg p-2 border border-red-200">
                        <p className="text-xs font-medium text-red-700 mb-1">⚠️ {t("الحساسية:", "Allergies:")}</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.allergies.map((a, i) => (
                            <span key={i} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPatient.chronic_conditions && selectedPatient.chronic_conditions.length > 0 && (
                      <div className="mt-2 bg-orange-50 rounded-lg p-2 border border-orange-200">
                        <p className="text-xs font-medium text-orange-700 mb-1">{t("الأمراض المزمنة:", "Chronic Conditions:")}</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.chronic_conditions.map((c, i) => (
                            <span key={i} className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPatient.notes && (
                      <p className="mt-2 text-xs text-gray-500 bg-white rounded-lg px-2 py-1.5 border border-gray-100">{selectedPatient.notes}</p>
                    )}
                  </div>

                  {/* Medication History */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><History className="h-4 w-4" /> {t("سجل الأدوية", "Medication History")}</p>
                    {patientMedications.length === 0 ? (
                      <p className="text-center py-4 text-gray-400 text-sm">{t("لا يوجد سجل أدوية", "No medication history")}</p>
                    ) : (
                      <div className="space-y-2 max-h-[40dvh] md:max-h-[30vh] overflow-y-auto">
                        {patientMedications.map((med, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-800">{med.product_name}</span>
                              <span className="text-[10px] text-gray-400">{new Date(med.date).toLocaleDateString("ar-EG")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <span>{t("الكمية:", "Qty:")} {med.quantity}</span>
                              {med.dosage && <span>• {med.dosage}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create New Patient */}
              <div className="border-t border-gray-200 pt-3">
                <button onClick={() => setShowPatientCreate(!showPatientCreate)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium py-2 rounded-lg hover:bg-purple-50 transition">
                  <UserPlus className="h-4 w-4" />
                  {showPatientCreate ? t("إخفاء نموذج التسجيل", "Hide Registration Form") : t("تسجيل مريض جديد", "Register New Patient")}
                </button>
              </div>

              {showPatientCreate && (
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 space-y-2">
                  <input type="text" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder={t("اسم المريض *", "Patient name *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" />
                  <input type="tel" value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder={t("رقم الهاتف *", "Phone *")}
                    className="w-full h-9 bg-white rounded-lg px-3 text-sm border border-gray-200" dir="ltr" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">{t("تاريخ الميلاد", "Date of Birth")}</label>
                      <input type="date" value={newPatientDob} onChange={(e) => setNewPatientDob(e.target.value)}
                        className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{t("النوع", "Gender")}</label>
                      <select value={newPatientGender} onChange={(e) => setNewPatientGender(e.target.value)}
                        className="w-full h-9 bg-white rounded-lg px-2 text-sm border border-gray-200">
                        <option value="">{t("اختر", "Select")}</option>
                        <option value="male">{t("ذكر", "Male")}</option>
                        <option value="female">{t("أنثى", "Female")}</option>
                      </select>
                    </div>
                  </div>
                  <textarea value={newPatientAllergies} onChange={(e) => setNewPatientAllergies(e.target.value)}
                    placeholder={t("الحساسية (مفصولة بفاصلة: بنسلين، أسبرين)", "Allergies (comma-separated: penicillin, aspirin)")}
                    rows={2} className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                  <textarea value={newPatientConditions} onChange={(e) => setNewPatientConditions(e.target.value)}
                    placeholder={t("الأمراض المزمنة (مفصولة بفاصلة: سكري، ضغط)", "Chronic conditions (comma-separated: diabetes, hypertension)")}
                    rows={2} className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                  <textarea value={newPatientNotes} onChange={(e) => setNewPatientNotes(e.target.value)}
                    placeholder={t("ملاحظات...", "Notes...")}
                    rows={2} className="w-full bg-white rounded-lg px-3 py-1.5 text-sm border border-gray-200 resize-none" />
                  <button onClick={async () => {
                    if (!store || !newPatientName.trim() || !newPatientPhone.trim()) return
                    setPatientSaving(true)
                    try {
                      const result = await createOrUpdatePatient(store.id, {
                        name: newPatientName.trim(),
                        phone: newPatientPhone.trim(),
                        date_of_birth: newPatientDob || undefined,
                        gender: (newPatientGender as "male" | "female") || undefined,
                        allergies: newPatientAllergies ? newPatientAllergies.split(",").map(a => a.trim()).filter(Boolean) : undefined,
                        chronic_conditions: newPatientConditions ? newPatientConditions.split(",").map(c => c.trim()).filter(Boolean) : undefined,
                        notes: newPatientNotes.trim() || undefined,
                      })
                      if (result.success && result.patient) {
                        setSelectedPatient(result.patient)
                        setShowPatientCreate(false)
                        setNewPatientName(""); setNewPatientPhone(""); setNewPatientDob(""); setNewPatientGender("")
                        setNewPatientAllergies(""); setNewPatientConditions(""); setNewPatientNotes("")
                        setPatientSearchResults([])
                      }
                    } catch { /* */ }
                    setPatientSaving(false)
                  }} disabled={patientSaving || !newPatientName.trim() || !newPatientPhone.trim()}
                    className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-medium transition">
                    {patientSaving ? "..." : t("تسجيل المريض", "Register Patient")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Drug Label Modal ===== */}
      {showDrugLabelModal && drugLabelProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => { setShowDrugLabelModal(false); setDrugLabelData(null); setDrugLabelInstructions("") }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[85vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                {t("بطاقة الدواء", "Drug Label")}
              </h3>
              <button onClick={() => { setShowDrugLabelModal(false); setDrugLabelData(null); setDrugLabelInstructions("") }} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh] space-y-4">
              {/* Product Info */}
              <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                <p className="text-sm font-bold text-gray-800">{drugLabelProduct.name}</p>
                {pharmacyData[drugLabelProduct.id] && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pharmacyData[drugLabelProduct.id].active_ingredient && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{pharmacyData[drugLabelProduct.id].active_ingredient}</span>
                    )}
                    {pharmacyData[drugLabelProduct.id].dosage_form && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{pharmacyData[drugLabelProduct.id].dosage_form}</span>
                    )}
                    {pharmacyData[drugLabelProduct.id].manufacturer && (
                      <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">{pharmacyData[drugLabelProduct.id].manufacturer}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Instructions Input */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t("تعليمات الاستخدام", "Usage Instructions")}</label>
                <textarea value={drugLabelInstructions} onChange={(e) => setDrugLabelInstructions(e.target.value)}
                  placeholder={t("مثال: قرص واحد 3 مرات يوميًا بعد الأكل", "Example: 1 tablet 3 times daily after meals")}
                  rows={3} className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm border border-gray-200 resize-none focus:ring-2 focus:ring-green-500" />
              </div>

              {/* Generate Button */}
              <button onClick={async () => {
                if (!store) return
                setPatientSaving(true)
                try {
                  const result = await generateDrugLabel(
                    store.id,
                    drugLabelProduct.id,
                    selectedPatient?.name,
                    undefined,
                    drugLabelInstructions || undefined,
                    store.name || undefined
                  )
                  if (result.success && result.label) {
                    setDrugLabelData(result.label)
                  }
                } catch { /* */ }
                setPatientSaving(false)
              }} disabled={patientSaving}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
                {patientSaving ? "..." : t("إنشاء بطاقة الدواء", "Generate Drug Label")}
              </button>

              {/* Label Preview */}
              {drugLabelData && (
                <div className="border-2 border-dashed border-green-300 rounded-xl p-4 space-y-3 bg-green-50/30" id="drug-label-print-area">
                  <div className="text-center border-b border-green-200 pb-2">
                    <p className="text-lg font-bold text-gray-800">{drugLabelData.store_name || store?.name}</p>
                    <p className="text-xs text-gray-500">{t("بطاقة الدواء / Drug Label", "Drug Label")}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("اسم الدواء:", "Drug Name:")}</span>
                      <span className="font-bold text-gray-800">{drugLabelData.product_name}</span>
                    </div>
                    {drugLabelData.active_ingredient && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("المادة الفعالة:", "Active Ingredient:")}</span>
                        <span className="font-medium text-gray-700">{drugLabelData.active_ingredient}</span>
                      </div>
                    )}
                    {drugLabelData.dosage_form && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("الشكل الدوائي:", "Dosage Form:")}</span>
                        <span className="font-medium text-gray-700">{drugLabelData.dosage_form}</span>
                      </div>
                    )}
                    {drugLabelData.manufacturer && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("الشركة المصنعة:", "Manufacturer:")}</span>
                        <span className="font-medium text-gray-700">{drugLabelData.manufacturer}</span>
                      </div>
                    )}
                    {drugLabelData.batch_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("رقم التشغيلة:", "Batch:")}</span>
                        <span className="font-mono text-gray-700">{drugLabelData.batch_number}</span>
                      </div>
                    )}
                    {drugLabelData.expiry_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("تاريخ الانتهاء:", "Expiry:")}</span>
                        <span className="font-medium text-red-600">{drugLabelData.expiry_date}</span>
                      </div>
                    )}
                    {drugLabelData.patient_name && (
                      <div className="flex justify-between border-t border-green-200 pt-2">
                        <span className="text-gray-500">{t("اسم المريض:", "Patient:")}</span>
                        <span className="font-bold text-gray-800">{drugLabelData.patient_name}</span>
                      </div>
                    )}
                    {drugLabelData.instructions && (
                      <div className="border-t border-green-200 pt-2">
                        <p className="text-gray-500 text-xs mb-1">{t("التعليمات:", "Instructions:")}</p>
                        <p className="text-sm font-medium text-gray-800 bg-yellow-50 rounded-lg p-2 border border-yellow-200">{drugLabelData.instructions}</p>
                      </div>
                    )}
                    <div className="text-center border-t border-green-200 pt-2">
                      <p className="text-[10px] text-gray-400">{t("تاريخ الصرف:", "Dispensed:")} {drugLabelData.date}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Print Button */}
              {drugLabelData && (
                <button onClick={() => {
                  const area = document.getElementById("drug-label-print-area")
                  if (area) {
                    const w = window.open("", "_blank", "width=400,height=600")
                    if (w) {
                      w.document.write(`<html><head><style>body{font-family:sans-serif;padding:20px;direction:rtl}*{margin:0;padding:0;box-sizing:border-box}.flex{display:flex;justify-content:space-between}.font-bold{font-weight:700}.text-sm{font-size:14px}.text-xs{font-size:12px}div{margin-bottom:6px}p{margin-bottom:4px}</style></head><body>${area.innerHTML}</body></html>`)
                      w.document.close()
                      w.print()
                      w.close()
                    }
                  }
                }} className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition flex items-center justify-center gap-2">
                  <Printer className="h-4 w-4" />
                  {t("طباعة بطاقة الدواء", "Print Drug Label")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Batch Inventory Modal ===== */}
      {showBatchInventory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowBatchInventory(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                {t("جرد التشغيلات", "Batch Inventory")}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  if (!store) return
                  setBatchInventoryLoading(true)
                  try {
                    const items = await getBatchInventory(store.id)
                    setBatchInventoryItems(items)
                  } catch { /* */ }
                  setBatchInventoryLoading(false)
                }} className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1">
                  <RefreshCw className={`h-3 w-3 ${batchInventoryLoading ? "animate-spin" : ""}`} /> {t("تحديث", "Refresh")}
                </button>
                <button onClick={() => setShowBatchInventory(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[75vh]">
              {batchInventoryLoading ? (
                <div className="text-center py-8 text-gray-400"><RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" /><p className="text-sm">{t("جاري التحميل...", "Loading...")}</p></div>
              ) : batchInventoryItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><Package className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">{t("لا توجد تشغيلات مسجلة", "No batches recorded")}</p></div>
              ) : (
                <div className="space-y-2">
                  {batchInventoryItems.map((item, idx) => {
                    const isExpired = item.status === "expired"
                    const isCritical = item.status === "critical"
                    const isWarning = item.status === "warning"
                    return (
                      <div key={idx} className={`p-3 rounded-xl border ${isExpired ? "border-red-300 bg-red-50" : isCritical ? "border-orange-300 bg-orange-50" : isWarning ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{item.product_name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isExpired ? "bg-red-100 text-red-700" : isCritical ? "bg-orange-100 text-orange-700" : isWarning ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                              {isExpired ? t("منتهي", "Expired") : isCritical ? t("حرج", "Critical") : isWarning ? t("تحذير", "Warning") : t("جيد", "OK")}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">{t("المخزون:", "Stock:")} {item.stock}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {item.batch_number && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.batch_number}</span>}
                          {item.expiry_date && <span className={isExpired ? "text-red-600 font-medium" : isCritical ? "text-orange-600 font-medium" : ""}>{t("انتهاء:", "Exp:")} {item.expiry_date}</span>}
                          {item.days_remaining !== undefined && item.days_remaining > 0 && (
                            <span className="text-gray-400">({item.days_remaining} {t("يوم", "days")})</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: FEFO Modal ===== */}
      {showFEFO && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowFEFO(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95dvh] md:max-h-[90vh] overflow-hidden" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-500" />
                {t("أولوية الصرف (FEFO)", "First Expiry First Out (FEFO)")}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  if (!store) return
                  setFefoLoading(true)
                  try {
                    const items = await getFEFOProducts(store.id)
                    setFefoItems(items)
                  } catch { /* */ }
                  setFefoLoading(false)
                }} className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1">
                  <RefreshCw className={`h-3 w-3 ${fefoLoading ? "animate-spin" : ""}`} /> {t("تحديث", "Refresh")}
                </button>
                <button onClick={() => setShowFEFO(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[75vh]">
              {fefoLoading ? (
                <div className="text-center py-8 text-gray-400"><RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" /><p className="text-sm">{t("جاري التحميل...", "Loading...")}</p></div>
              ) : fefoItems.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">{t("لا توجد منتجات قريبة الانتهاء", "No products near expiry")}</p></div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">{t("المنتجات مرتبة حسب أقرب تاريخ انتهاء — يجب صرفها أولاً", "Products sorted by nearest expiry — dispense first")}</p>
                  {fefoItems.map((item, idx) => {
                    const isExpired = item.status === "expired"
                    const isCritical = item.status === "critical"
                    const isWarning = item.status === "warning"
                    return (
                      <div key={idx} className={`p-3 rounded-xl border flex items-center gap-3 ${isExpired ? "border-red-300 bg-red-50" : isCritical ? "border-orange-300 bg-orange-50" : isWarning ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isExpired ? "bg-red-200 text-red-700" : isCritical ? "bg-orange-200 text-orange-700" : isWarning ? "bg-yellow-200 text-yellow-700" : "bg-green-200 text-green-700"}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{item.product_name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {item.batch_number && <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.batch_number}</span>}
                            <span className={isExpired ? "text-red-600 font-bold" : isCritical ? "text-orange-600 font-bold" : ""}>
                              {item.expiry_date}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-800">{item.stock}</p>
                          <p className="text-[10px] text-gray-400">{t("قطعة", "pcs")}</p>
                        </div>
                        {item.days_remaining !== undefined && (
                          <div className={`text-center min-w-[50px] px-2 py-1 rounded-lg text-xs font-bold ${isExpired ? "bg-red-100 text-red-700" : isCritical ? "bg-orange-100 text-orange-700" : isWarning ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                            {isExpired ? t("منتهي!", "Expired!") : `${item.days_remaining} ${t("يوم", "d")}`}
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
      )}

      {/* ===== Pharmacy: Multi-Unit Modal ===== */}
      {showUnitModal && unitProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => { setShowUnitModal(false); setUnitProduct(null) }}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl max-h-[95dvh] md:max-h-[90vh] flex flex-col" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-white shrink-0">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-cyan-500" />
                {t("وحدات البيع", "Selling Units")}
              </h3>
              <button onClick={() => { setShowUnitModal(false); setUnitProduct(null) }} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">{unitProduct.name}</p>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{unitProduct.price.toFixed(2)} {currencyLabel}</span>
              </div>

              {/* Price Unit Selector — what does the product price represent? */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-xs font-bold text-amber-800 mb-2">{t("السعر المُدخل يمثل سعر:", "The entered price represents:")}</p>
                <div className="flex gap-2">
                  {[
                    { key: "piece", label: t("قطعة/قرص", "Piece") },
                    { key: "strip", label: t("شريط", "Strip") },
                    { key: "box", label: t("علبة", "Box") },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setUnitEditPriceUnit(opt.key)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${unitEditPriceUnit === opt.key ? "bg-amber-500 text-white shadow-md" : "bg-white text-gray-600 border border-amber-200 hover:bg-amber-100"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit Structure Fields */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-700">{t("هيكل التعبئة:", "Packaging Structure:")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">{t("قرص/شريط", "Pcs/Strip")}</label>
                    <input type="number" value={unitEditPiecePerStrip} onChange={(e) => setUnitEditPiecePerStrip(e.target.value)}
                      placeholder="10" min="1"
                      className="w-full h-9 bg-gray-50 rounded-lg px-2 text-sm text-center border border-gray-200 focus:ring-2 focus:ring-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">{t("شريط/علبة", "Strips/Box")}</label>
                    <input type="number" value={unitEditStripPerBox} onChange={(e) => setUnitEditStripPerBox(e.target.value)}
                      placeholder="3" min="1"
                      className="w-full h-9 bg-gray-50 rounded-lg px-2 text-sm text-center border border-gray-200 focus:ring-2 focus:ring-cyan-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">{t("علبة/كرتونة", "Box/Carton")}</label>
                    <input type="number" value={unitEditBoxPerCarton} onChange={(e) => setUnitEditBoxPerCarton(e.target.value)}
                      placeholder="12" min="1"
                      className="w-full h-9 bg-gray-50 rounded-lg px-2 text-sm text-center border border-gray-200 focus:ring-2 focus:ring-cyan-500" />
                  </div>
                </div>
              </div>

              {/* Auto-calculated Price Breakdown */}
              {(unitEditPiecePerStrip || unitEditStripPerBox) && (() => {
                const pps = Number(unitEditPiecePerStrip) || 1
                const spb = Number(unitEditStripPerBox) || 1
                const bpc = Number(unitEditBoxPerCarton) || 1
                const enteredPrice = unitProduct.price
                
                // Calculate piece price based on what unit the entered price represents
                let piecePrice = enteredPrice
                if (unitEditPriceUnit === "strip") {
                  piecePrice = enteredPrice / pps
                } else if (unitEditPriceUnit === "box") {
                  piecePrice = enteredPrice / (pps * spb)
                }
                
                const stripPrice = piecePrice * pps
                const boxPrice = piecePrice * pps * spb
                const cartonPrice = piecePrice * pps * spb * bpc
                
                return (
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 border border-cyan-200">
                    <p className="text-xs font-bold text-cyan-800 mb-2">{t("أسعار الوحدات (تلقائي):", "Unit Prices (auto):")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`bg-white rounded-lg p-2 text-center border ${unitEditPriceUnit === "piece" ? "border-amber-400 ring-1 ring-amber-200" : "border-gray-200"}`}>
                        <p className="text-[10px] text-gray-500">{t("قطعة/قرص", "Piece")}</p>
                        <p className="text-sm font-bold text-cyan-700">{piecePrice.toFixed(2)}</p>
                        {unitEditPriceUnit === "piece" && <span className="text-[8px] text-amber-600">⬆ {t("المُدخل", "entered")}</span>}
                      </div>
                      <div className={`bg-white rounded-lg p-2 text-center border ${unitEditPriceUnit === "strip" ? "border-amber-400 ring-1 ring-amber-200" : "border-gray-200"}`}>
                        <p className="text-[10px] text-gray-500">{t("شريط", "Strip")} ({pps} {t("قرص", "pcs")})</p>
                        <p className="text-sm font-bold text-cyan-700">{stripPrice.toFixed(2)}</p>
                        {unitEditPriceUnit === "strip" && <span className="text-[8px] text-amber-600">⬆ {t("المُدخل", "entered")}</span>}
                      </div>
                      <div className={`bg-white rounded-lg p-2 text-center border ${unitEditPriceUnit === "box" ? "border-amber-400 ring-1 ring-amber-200" : "border-gray-200"}`}>
                        <p className="text-[10px] text-gray-500">{t("علبة", "Box")} ({pps * spb} {t("قرص", "pcs")})</p>
                        <p className="text-sm font-bold text-cyan-700">{boxPrice.toFixed(2)}</p>
                        {unitEditPriceUnit === "box" && <span className="text-[8px] text-amber-600">⬆ {t("المُدخل", "entered")}</span>}
                      </div>
                      {Number(unitEditBoxPerCarton) > 0 && (
                        <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
                          <p className="text-[10px] text-gray-500">{t("كرتونة", "Carton")} ({pps * spb * bpc} {t("قرص", "pcs")})</p>
                          <p className="text-sm font-bold text-cyan-700">{cartonPrice.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Default Selling Unit */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1.5">{t("وحدة البيع الافتراضية:", "Default Selling Unit:")}</p>
                <div className="flex gap-2">
                  {[
                    { key: "piece", label: t("قطعة", "Piece") },
                    { key: "strip", label: t("شريط", "Strip") },
                    { key: "box", label: t("علبة", "Box") },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setUnitEditDefaultSelling(opt.key)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${unitEditDefaultSelling === opt.key ? "bg-cyan-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stock Calculator */}
              {(unitEditPiecePerStrip || unitEditStripPerBox) && unitProduct.stock > 0 && (() => {
                const units = calculateProductUnitsLocal(
                  unitProduct.stock,
                  Number(unitEditPiecePerStrip) || undefined,
                  Number(unitEditStripPerBox) || undefined,
                  Number(unitEditBoxPerCarton) || undefined
                )
                if (units.length === 0) return null
                return (
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">{t("المخزون:", "Stock:")} {unitProduct.stock} {t("قطعة", "pcs")}</p>
                    <div className="flex flex-wrap gap-2">
                      {units.map((u, i) => (
                        <div key={i} className="bg-white px-2 py-1.5 rounded-lg border border-gray-200 text-center">
                          <p className="text-lg font-bold text-cyan-600">{u.count}</p>
                          <p className="text-[10px] text-gray-500">{u.unit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Save Button */}
            <div className="p-4 border-t border-gray-200 shrink-0">
              <button onClick={async () => {
                if (!store || !unitProduct) return
                setUnitSaving(true)
                try {
                  await updateProductUnits(store.id, unitProduct.id, {
                    unit_type: "piece",
                    piece_per_strip: Number(unitEditPiecePerStrip) || undefined,
                    strip_per_box: Number(unitEditStripPerBox) || undefined,
                    box_per_carton: Number(unitEditBoxPerCarton) || undefined,
                    price_unit: unitEditPriceUnit,
                    default_selling_unit: unitEditDefaultSelling,
                  })
                  setPharmacyData(prev => ({
                    ...prev,
                    [unitProduct.id]: {
                      ...prev[unitProduct.id],
                      piece_per_strip: Number(unitEditPiecePerStrip) || undefined,
                      strip_per_box: Number(unitEditStripPerBox) || undefined,
                      box_per_carton: Number(unitEditBoxPerCarton) || undefined,
                      price_unit: unitEditPriceUnit,
                      default_selling_unit: unitEditDefaultSelling,
                    }
                  }))
                  setShowUnitModal(false)
                  setUnitProduct(null)
                } catch { /* */ }
                setUnitSaving(false)
              }} disabled={unitSaving || (!unitEditPiecePerStrip && !unitEditStripPerBox && !unitEditBoxPerCarton)}
                className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-bold transition">
                {unitSaving ? "..." : t("حفظ الوحدات", "Save Units")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pharmacy: Unit Picker for Cart ===== */}
      {showUnitPicker && unitPickerProduct && (() => {
        const pd = pharmacyData[unitPickerProduct.id]
        const enteredPrice = unitPickerProduct.price
        const pps = pd?.piece_per_strip || 1
        const spb = pd?.strip_per_box || 1
        const bpc = pd?.box_per_carton || 0
        const priceUnit = pd?.price_unit || "piece"
        const defaultUnit = pd?.default_selling_unit || "box"
        
        // Calculate piece price based on what unit the entered price represents
        let piecePrice = enteredPrice
        if (priceUnit === "strip") {
          piecePrice = enteredPrice / pps
        } else if (priceUnit === "box") {
          piecePrice = enteredPrice / (pps * spb)
        }
        
        type UnitOption = { key: string; label: string; multiplier: number; price: number; maxQty: number; isDefault: boolean }
        const unitOptions: UnitOption[] = [
          { key: "piece", label: t("قطعة", "Piece"), multiplier: 1, price: piecePrice, maxQty: unitPickerProduct.stock, isDefault: defaultUnit === "piece" },
        ]
        if (pps > 1) {
          const stripPrice = piecePrice * pps
          unitOptions.push({ key: "strip", label: t("شريط", "Strip"), multiplier: pps, price: stripPrice, maxQty: Math.floor(unitPickerProduct.stock / pps), isDefault: defaultUnit === "strip" })
        }
        if (pps >= 1 && spb > 1) {
          const boxMultiplier = pps * spb
          const boxPrice = piecePrice * boxMultiplier
          unitOptions.push({ key: "box", label: t("علبة", "Box"), multiplier: boxMultiplier, price: boxPrice, maxQty: Math.floor(unitPickerProduct.stock / boxMultiplier), isDefault: defaultUnit === "box" })
        }
        if (pps >= 1 && spb >= 1 && bpc > 0) {
          const cartonMultiplier = pps * spb * bpc
          const cartonPrice = piecePrice * cartonMultiplier
          unitOptions.push({ key: "carton", label: t("كرتونة", "Carton"), multiplier: cartonMultiplier, price: cartonPrice, maxQty: Math.floor(unitPickerProduct.stock / cartonMultiplier), isDefault: false })
        }
        // Sort: default unit first
        unitOptions.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
        
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowUnitPicker(false); setUnitPickerProduct(null) }}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl" dir={pageDir} onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-white rounded-t-2xl">
                <div>
                  <h3 className="text-gray-800 font-bold text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-cyan-500" />
                    {t("اختر وحدة البيع", "Choose Selling Unit")}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{unitPickerProduct.name}</p>
                </div>
                <button onClick={() => { setShowUnitPicker(false); setUnitPickerProduct(null) }} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-xs text-gray-500 text-center">{t("المخزون:", "Stock:")} {unitPickerProduct.stock} {t("قطعة", "pcs")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {unitOptions.map((opt) => (
                    <button
                      key={opt.multiplier}
                      disabled={opt.maxQty <= 0}
                      onClick={() => {
                        if (opt.multiplier === 1) {
                          addToCart(unitPickerProduct, {
                            unit_multiplier: 1,
                            unit_label: opt.label,
                            unit_price: opt.price,
                          })
                        } else {
                          addToCart(unitPickerProduct, {
                            unit_multiplier: opt.multiplier,
                            unit_label: opt.label,
                            unit_price: opt.price,
                          })
                        }
                        setShowUnitPicker(false)
                        setUnitPickerProduct(null)
                      }}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        opt.maxQty <= 0
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : opt.isDefault
                            ? 'border-cyan-400 bg-cyan-100 hover:bg-cyan-200 hover:border-cyan-500 cursor-pointer hover:scale-105 ring-2 ring-cyan-200'
                            : 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-400 cursor-pointer hover:scale-105'
                      }`}
                    >
                      <p className="font-bold text-gray-800 text-sm">{opt.label}</p>
                      {opt.isDefault && <p className="text-[9px] text-cyan-600 font-medium">{t("افتراضي", "Default")}</p>}
                      {opt.multiplier > 1 && (
                        <p className="text-[10px] text-gray-500">{opt.multiplier} {t("قطعة", "pcs")}</p>
                      )}
                      <p className="text-emerald-600 font-bold text-sm mt-1">{opt.price.toFixed(2)} {currencyLabel}</p>
                      <p className="text-[10px] text-gray-400">{t("متاح:", "Avail:")} {opt.maxQty}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ===== Clothing: Price Tag Modal ===== */}
      {showPriceTagModal && priceTagProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setShowPriceTagModal(false)}>          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm shadow-2xl max-h-[95dvh] md:max-h-[85vh]" dir={pageDir} onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-white">
              <h3 className="text-gray-800 font-bold flex items-center gap-2">
                <QrCode className="h-5 w-5 text-yellow-600" />
                {t("بطاقة السعر", "Price Tag")}
              </h3>
              <button onClick={() => setShowPriceTagModal(false)} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 sm:p-6 text-center space-y-3" id="price-tag-print-area">
              <p className="text-lg font-bold text-gray-800">{store?.name || ""}</p>
              <p className="text-sm text-gray-600">{priceTagProduct.name}</p>
              {priceTagProduct.barcode && (
                <div className="bg-gray-100 rounded-lg px-4 py-2 inline-block">
                  <p className="font-mono text-sm text-gray-800 tracking-widest">{priceTagProduct.barcode}</p>
                </div>
              )}
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">{priceTagProduct.price.toFixed(2)} <span className="text-base">{currencyLabel}</span></p>
              {activeSeason && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-400 line-through">{priceTagProduct.price.toFixed(2)} {currencyLabel}</p>
                  <p className="text-2xl font-black text-red-600">{(priceTagProduct.price * (1 - activeSeason.discount / 100)).toFixed(2)} <span className="text-sm">{currencyLabel}</span></p>
                  <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">-{activeSeason.discount}% {activeSeason.season_name}</span>
                </div>
              )}
              {productVariants[priceTagProduct.id]?.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {[...new Set(productVariants[priceTagProduct.id].map(v => v.size))].map(size => (
                    <span key={size} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{size}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button onClick={() => {
                const area = document.getElementById("price-tag-print-area")
                if (area) {
                  const w = window.open("", "_blank", "width=300,height=400")
                  if (w) {
                    w.document.write(`<html><head><style>body{font-family:sans-serif;text-align:center;padding:20px}*{margin:0;padding:0;box-sizing:border-box}</style></head><body>${area.innerHTML}</body></html>`)
                    w.document.close()
                    w.print()
                    w.close()
                  }
                }
              }} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" />
                {t("طباعة بطاقة السعر", "Print Price Tag")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
