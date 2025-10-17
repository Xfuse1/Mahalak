"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { mockProducts } from "@/lib/mock-data"
import { Edit, Trash2, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"

export default function SellerProductsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState(mockProducts.filter((p) => p.storeId === "1"))
  const { t } = useLanguage()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const handleDelete = (id: string) => {
    if (confirm(t("هل أنت متأكد من حذف هذا المنتج؟", "Are you sure you want to delete this product?"))) {
      setProducts(products.filter((p) => p.id !== id))
    }
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">{t("إدارة المنتجات", "Product Management")}</h1>
            <Button asChild className="bg-[#1F478B] hover:bg-[#1a3a70]">
              <Link href="/seller/products/new">
                <Plus className="ml-2 h-4 w-4" />
                {t("إضافة منتج جديد", "Add New Product")}
              </Link>
            </Button>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Card key={product.id}>
                  <CardContent className="p-4">
                    <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden mb-4">
                      <Image
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{product.name}</h3>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xl font-bold text-[#1F478B]">
                        {product.price} {t("جنيه", "EGP")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t("المخزون:", "Stock:")} {product.stock}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => router.push(`/seller/products/edit/${product.id}`)}
                      >
                        <Edit className="ml-2 h-4 w-4" />
                        {t("تعديل", "Edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 bg-transparent"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h2 className="text-2xl font-semibold mb-2">{t("لا توجد منتجات", "No Products")}</h2>
                <p className="text-gray-600 mb-6">
                  {t("ابدأ بإضافة منتجات إلى متجرك", "Start adding products to your store")}
                </p>
                <Button asChild className="bg-[#1F478B] hover:bg-[#1a3a70]">
                  <Link href="/seller/products/new">
                    <Plus className="ml-2 h-4 w-4" />
                    {t("إضافة منتج جديد", "Add New Product")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

function Package(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
