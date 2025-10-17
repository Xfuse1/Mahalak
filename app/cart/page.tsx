"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BackButton } from "@/components/back-button"
import { ShoppingBag } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"

export default function CartPage() {
  const { t } = useLanguage()
  // Mock empty cart - in production, this would use state management
  const cartItems: never[] = []

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8">{t("سلة التسوق", "Shopping Cart")}</h1>

          {cartItems.length === 0 ? (
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
            <div>
              {/* Cart items would go here */}
              <p>{t("عناصر السلة", "Cart Items")}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
