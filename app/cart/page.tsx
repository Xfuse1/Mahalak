"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { ShoppingBag, Plus, Minus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function CartPage() {
  const { t } = useLanguage()
  const { items, addItem, decrementItem, removeItem, clear } = useCartStore()
  const { user } = useAuth()
  const router = useRouter()
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleCheckout = () => {
    if (!user) {
      router.push("/auth")
      return
    }
    router.push("/checkout")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8">{t("سلة التسوق", "Shopping Cart")}</h1>

          {items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h2 className="text-2xl font-semibold mb-2">{t("السلة فارغة", "Cart is Empty")}</h2>
                <p className="text-gray-600 mb-6">
                  {t("لم تقم بإضافة أي منتجات إلى السلة بعد", "You haven't added any products to your cart yet")}
                </p>
                <Button asChild className="bg-[#1F478B] hover:bg-[#1a3a70]">
                  <Link href="/search">{t("تصفح المنتجات", "Browse Products")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                        <Image src={item.image_url || "/placeholder.svg"} alt={item.name} fill className="object-cover" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.store_name || t("المتجر", "Store")}</p>
                        {item.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-lg font-bold text-[#1F478B]">{item.price} {t("جنيه", "EGP")}</p>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-gray-200"
                            onClick={() => decrementItem(item.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-gray-200"
                            onClick={() => addItem(item)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t("حذف", "Remove")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{t("الإجمالي", "Total")}</p>
                    <p className="text-2xl font-bold text-[#1F478B]">{total.toFixed(2)} {t("جنيه", "EGP")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={clear}>
                      {t("إفراغ السلة", "Clear Cart")}
                    </Button>
                    <Button onClick={handleCheckout} className="bg-[#1F478B] hover:bg-[#1a3a70]">
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
