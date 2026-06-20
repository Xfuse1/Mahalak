"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { getMultiStoreOrderForEdit, addStopsToMultiStoreOrder } from "@/lib/actions/orders"
import type { PickupStop } from "@/lib/actions/orders"
import { searchProducts } from "@/lib/actions/products"
import { logError } from "@/lib/logger"
import Image from "next/image"
import { Store, Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Package } from "lucide-react"

type Product = {
  id: string
  name: string
  price: number
  stock: number
  image_url?: string | null
  store_id: string
  category?: string
  stores?: {
    id: string
    name: string
  }
  discount_percentage?: number
}

type NewItem = {
  product_id: string
  name: string
  quantity: number
  price: number
  image_url?: string | null
  store_id: string
  store_name: string
  stock: number
}

export default function EditOrderPage({ params }: { params: { id: string } }) {
  const unwrappedParams = typeof params === "object" && "then" in params
    ? React.use(params as unknown as Promise<{ id: string }>)
    : (params as { id: string })
  const { id: orderId } = unwrappedParams

  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [newItems, setNewItems] = useState<NewItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Fetch order data
  useEffect(() => {
    if (authLoading || !user) return

    async function fetchOrder() {
      setLoading(true)
      const result = await getMultiStoreOrderForEdit(orderId, user!.id)
      if (result.success && result.order) {
        setOrder(result.order)
      } else {
        setError(result.error || "فشل تحميل الطلب")
      }
      setLoading(false)
    }

    fetchOrder()
  }, [orderId, user, authLoading])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
    }
  }, [user, authLoading, router])

  // Search products
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await searchProducts(searchQuery) as unknown as Product[]
      // Filter out products from rejected stores that were already in the order
      // and products already added to newItems
      const rejectedStoreIds = (order?.pickup_stops || [])
        .filter((s: PickupStop) => s.status === "rejected")
        .map((s: PickupStop) => s.store_id)

      // Show all products that are in stock, optionally excluding the rejected stores
      const filtered = results.filter((p: Product) =>
        p.stock > 0 && !rejectedStoreIds.includes(p.store_id)
      )
      setSearchResults(filtered)
    } catch (err) {
      logError("Search error:", err)
    }
    setSearching(false)
  }

  // Add product to new items
  const addProduct = (product: Product) => {
    const existing = newItems.find(item => item.product_id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock) return
      setNewItems(prev =>
        prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      const effectivePrice = product.discount_percentage && product.discount_percentage > 0
        ? product.price - (product.price * product.discount_percentage / 100)
        : product.price

      setNewItems(prev => [...prev, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        price: effectivePrice,
        image_url: product.image_url,
        store_id: product.store_id,
        store_name: product.stores?.name || "متجر",
        stock: product.stock,
      }])
    }
  }

  // Remove item from new items
  const removeItem = (productId: string) => {
    setNewItems(prev => prev.filter(item => item.product_id !== productId))
  }

  // Increment/decrement quantity
  const updateQuantity = (productId: string, delta: number) => {
    setNewItems(prev =>
      prev.map(item => {
        if (item.product_id !== productId) return item
        const newQty = item.quantity + delta
        if (newQty <= 0) return item
        if (newQty > item.stock) return item
        return { ...item, quantity: newQty }
      })
    )
  }

  // Group new items by store
  const getNewStopsByStore = () => {
    const storeMap = new Map<string, {
      store_id: string
      store_name: string
      items: NewItem[]
      subtotal: number
    }>()

    for (const item of newItems) {
      const existing = storeMap.get(item.store_id)
      if (existing) {
        existing.items.push(item)
        existing.subtotal += item.price * item.quantity
      } else {
        storeMap.set(item.store_id, {
          store_id: item.store_id,
          store_name: item.store_name,
          items: [item],
          subtotal: item.price * item.quantity,
        })
      }
    }

    return Array.from(storeMap.values())
  }

  // Save changes
  const handleSave = async () => {
    if (!user || newItems.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const newStops = getNewStopsByStore().map(stop => ({
        store_id: stop.store_id,
        store_name: stop.store_name,
        items: stop.items.map(item => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image_url: item.image_url,
        })),
        subtotal: stop.subtotal,
      }))

      const result = await addStopsToMultiStoreOrder(orderId, user.id, newStops)

      if (result.success) {
        setSaveSuccess(true)
        setTimeout(() => {
          router.push("/account")
        }, 2000)
      } else {
        setError(result.error || "فشل تعديل الطلب")
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ")
    }

    setSaving(false)
  }

  const stops: PickupStop[] = order?.pickup_stops || []
  const rejectedStops = stops.filter(s => s.status === "rejected")
  const activeStops = stops.filter(s => s.status !== "rejected")
  const newStopsGrouped = getNewStopsByStore()
  const newItemsSubtotal = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-500">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 max-w-4xl">
            <BackButton />
            <div className="text-center py-16">
              <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 text-lg">{error}</p>
              <Button onClick={() => router.push("/account")} className="mt-6 rounded-xl">
                {t("العودة لطلباتي", "Back to My Orders")}
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (saveSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{t("تم تعديل الطلب بنجاح!", "Order Updated Successfully!")}</h2>
              <p className="text-gray-500">{t("جاري تحويلك لصفحة طلباتك...", "Redirecting to your orders...")}</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl text-white shadow-lg">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {t("تعديل الطلب", "Edit Order")}
              </h1>
              <p className="text-sm text-gray-500">#{orderId.slice(0, 8)}</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Rejected Stops Alert */}
          {rejectedStops.length > 0 && (
            <Card className="mb-6 border-0 shadow-lg rounded-2xl bg-red-50 border-l-4 border-l-red-400">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-800 mb-2">
                      {t("متاجر رفضت طلبك", "Stores that rejected your order")}
                    </h3>
                    <div className="space-y-2">
                      {rejectedStops.map((stop, idx) => (
                        <div key={idx} className="bg-white border border-red-200 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{stop.store_name}</p>
                              <p className="text-xs text-gray-500">
                                {stop.items.length} {t("منتج", "items")} • {stop.subtotal.toLocaleString()} {t("جنيه", "EGP")}
                              </p>
                            </div>
                            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                              {t("مرفوض", "Rejected")}
                            </span>
                          </div>
                          {stop.rejection_reason && (
                            <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">
                              {t("السبب:", "Reason:")} {stop.rejection_reason}
                            </p>
                          )}
                          <div className="mt-2 space-y-1">
                            {stop.items.map((item, iIdx) => (
                              <div key={iIdx} className="flex items-center gap-2 text-sm text-gray-600">
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                  <Image src={item.image_url || "/placeholder.svg"} alt={item.name} width={32} height={32} className="object-cover w-full h-full" />
                                </div>
                                <span className="flex-1">{item.name}</span>
                                <span className="text-gray-400">×{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-red-700 mt-3">
                      {t("يمكنك البحث عن منتجات بديلة من متاجر أخرى أدناه", "You can search for replacement products from other stores below")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Stops - Current Order */}
          {activeStops.length > 0 && (
            <Card className="mb-6 border-0 shadow-lg rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-green-100 rounded-xl">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  {t("المتاجر النشطة في الطلب", "Active Stores in Order")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {activeStops.map((stop, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                    stop.status === "confirmed" ? "bg-green-50 border-green-200" :
                    stop.status === "picked_up" ? "bg-indigo-50 border-indigo-200" :
                    "bg-yellow-50 border-yellow-200"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        stop.status === "confirmed" ? "bg-green-500 text-white" :
                        stop.status === "picked_up" ? "bg-indigo-500 text-white" :
                        "bg-yellow-500 text-white"
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{stop.store_name}</p>
                        <p className="text-xs text-gray-500">
                          {stop.items.length} {t("منتج", "items")} • {stop.subtotal.toLocaleString()} {t("جنيه", "EGP")}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      stop.status === "confirmed" ? "bg-green-100 text-green-700" :
                      stop.status === "picked_up" ? "bg-indigo-100 text-indigo-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {stop.status === "pending" ? t("في الانتظار", "Pending") :
                       stop.status === "confirmed" ? t("تم التأكيد", "Confirmed") :
                       t("تم الاستلام", "Picked Up")}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Search for Replacement Products */}
          <Card className="mb-6 border-0 shadow-lg rounded-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                {t("ابحث عن منتجات بديلة", "Search for Replacement Products")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex gap-3 mb-6">
                <Input
                  placeholder={t("ابحث عن منتج...", "Search for a product...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-12 rounded-xl border-gray-200 focus:border-blue-500"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl px-6 h-12"
                >
                  {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {searchResults.map((product) => {
                    const alreadyAdded = newItems.find(i => i.product_id === product.id)
                    return (
                      <div key={product.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-300 hover:shadow-md transition-all">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image src={product.image_url || "/placeholder.svg"} alt={product.name} width={64} height={64} className="object-cover w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-800 truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            {product.stores?.name || "متجر"}
                          </p>
                          <p className="text-sm font-bold text-blue-600">
                            {product.discount_percentage && product.discount_percentage > 0
                              ? (product.price - (product.price * product.discount_percentage / 100)).toLocaleString()
                              : product.price.toLocaleString()
                            } {t("جنيه", "EGP")}
                          </p>
                          <p className="text-xs text-gray-400">{t("المتاح:", "Stock:")} {product.stock}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addProduct(product)}
                          disabled={!!alreadyAdded && alreadyAdded.quantity >= product.stock}
                          className={`rounded-lg flex-shrink-0 ${alreadyAdded ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          {alreadyAdded ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !searching && (
                <div className="text-center py-8 text-gray-500">
                  <Search className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p>{t("لا توجد نتائج", "No results found")}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Items Cart */}
          {newItems.length > 0 && (
            <Card className="mb-6 border-0 shadow-xl rounded-2xl border-2 border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  {t("المنتجات البديلة المضافة", "Replacement Products Added")}
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm">{newItems.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {/* Group by store */}
                {newStopsGrouped.map((stop) => (
                  <div key={stop.store_id} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg">
                      <Store className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-sm text-gray-700">{stop.store_name}</span>
                      <span className="text-xs text-gray-400 mr-auto">
                        {stop.subtotal.toLocaleString()} {t("جنيه", "EGP")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stop.items.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <Image src={item.image_url || "/placeholder.svg"} alt={item.name} width={48} height={48} className="object-cover w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800 truncate">{item.name}</p>
                            <p className="text-sm font-bold text-blue-600">{(item.price * item.quantity).toLocaleString()} {t("جنيه", "EGP")}</p>
                          </div>
                          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => updateQuantity(item.product_id, -1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => updateQuantity(item.product_id, 1)}
                              disabled={item.quantity >= item.stock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500 rounded-lg"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Totals */}
                <div className="mt-4 pt-4 border-t border-dashed">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600">{t("المنتجات البديلة", "Replacement items")}</span>
                    <span className="font-bold text-blue-600">{newItemsSubtotal.toLocaleString()} {t("جنيه", "EGP")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("إجمالي الطلب الجديد", "New Order Total")}</span>
                    <span className="font-extrabold text-xl bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                      {((order?.total || 0) + newItemsSubtotal).toLocaleString()} {t("جنيه", "EGP")}
                    </span>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSave}
                  disabled={saving || newItems.length === 0}
                  className="w-full mt-5 h-14 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg font-bold"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      {t("جاري الحفظ...", "Saving...")}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 ml-2" />
                      {t("حفظ التعديلات", "Save Changes")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No items added yet hint */}
          {newItems.length === 0 && rejectedStops.length > 0 && (
            <Card className="border-0 shadow-lg rounded-2xl bg-blue-50">
              <CardContent className="p-6 text-center">
                <ShoppingCart className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                <p className="text-blue-700 font-medium mb-1">
                  {t("لم تضف منتجات بديلة بعد", "No replacement products added yet")}
                </p>
                <p className="text-blue-500 text-sm">
                  {t("استخدم البحث أعلاه لإيجاد منتجات بديلة وأضفها للطلب", "Use the search above to find and add replacement products")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
