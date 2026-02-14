"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft, ShoppingCart, Tag } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function CartPage() {
  const { t } = useLanguage()
  const { items, addItem, decrementItem, removeItem, clear } = useCartStore()
  const { user } = useAuth()
  const router = useRouter()
  const confirm = useConfirm()

  const handleClearCart = async () => {
    const confirmed = await confirm({
      title: t("إفراغ السلة", "Clear Cart"),
      message: t("هل أنت متأكد من إفراغ السلة؟", "Are you sure you want to clear the cart?"),
      confirmText: t("إفراغ", "Clear"),
      cancelText: t("إلغاء", "Cancel"),
      variant: "danger",
    })
    if (confirmed) clear()
  }
  
  // Calculate total with discounts
  const total = items.reduce((sum, item) => {
    const discountedPrice = item.discount_percentage && item.discount_percentage > 0
      ? item.price - (item.price * item.discount_percentage / 100)
      : item.price
    return sum + discountedPrice * item.quantity
  }, 0)

  const handleCheckout = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    router.push("/checkout")
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-lg">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("سلة التسوق", "Shopping Cart")}</h1>
          </div>

          {items.length === 0 ? (
            <Card className="border-0 shadow-xl bg-white rounded-2xl overflow-hidden">
              <CardContent className="py-20 text-center">
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <ShoppingBag className="h-12 w-12 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-gray-800">{t("السلة فارغة", "Cart is Empty")}</h2>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                  {t("لم تقم بإضافة أي منتجات إلى السلة بعد", "You haven't added any products to your cart yet")}
                </p>
                <Button asChild className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl px-8 py-6 text-lg font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105">
                  <Link href="/search" className="flex items-center gap-2">
                    {t("تصفح المنتجات", "Browse Products")}
                    <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {items.map((item, index) => (
                  <Card key={item.id} className="border-0 shadow-lg bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group" style={{ animationDelay: `${index * 100}ms` }}>
                    <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 group-hover:shadow-lg transition-all">
                        <Image src={item.image_url || "/placeholder.svg"} alt={item.name} fill loading="lazy" sizes="112px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">{item.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          {item.store_name || t("المتجر", "Store")}
                        </p>
                        {item.description && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        {item.discount_percentage && item.discount_percentage > 0 ? (
                          <div className="flex flex-col items-end">
                            <div className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold mb-1">
                              <Tag className="h-3 w-3" />
                              {item.discount_percentage}%
                            </div>
                            <p className="text-sm text-gray-400 line-through">{item.price} {t("جنيه", "EGP")}</p>
                            <p className="text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                              {(item.price - (item.price * item.discount_percentage / 100)).toLocaleString()} {t("جنيه", "EGP")}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{item.price} {t("جنيه", "EGP")}</p>
                        )}

                        {/* Stock info */}
                        <p className="text-xs text-gray-400">
                          {t("المتاح:", "Available:")} {item.stock}
                        </p>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-md transition-all"
                            onClick={() => decrementItem(item.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-9 w-9 rounded-lg transition-all ${item.quantity >= item.stock ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white hover:shadow-md'}`}
                            onClick={() => addItem(item)}
                            disabled={item.quantity >= item.stock}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {item.quantity >= item.stock && (
                          <p className="text-xs text-amber-600 font-medium">
                            {t("الحد الأقصى", "Max quantity")}
                          </p>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 me-1" />
                          {t("حذف", "Remove")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 rounded-2xl overflow-hidden">
                <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{t("الإجمالي", "Total")}</p>
                    <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{total.toFixed(2)} <span className="text-lg text-gray-500">{t("جنيه", "EGP")}</span></p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleClearCart} className="rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-all">
                      {t("إفراغ السلة", "Clear Cart")}
                    </Button>
                    <Button onClick={handleCheckout} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl px-8 font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105">
                      {t("إكمال الطلب", "Checkout")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
