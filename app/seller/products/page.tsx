"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { Button } from "../../../components/ui/button"
import { Card, CardContent } from "../../../components/ui/card"
import { getProductsByStoreId, deleteProduct } from "../../../lib/actions/products"
import { getStoreByUserId } from "../../../lib/actions/stores"
import { Edit, Trash2, Plus } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useLanguage } from "../../../lib/language-context"

export default function SellerProductsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    async function fetchProducts() {
      if (!user?.id) return

      try {
        setLoading(true)

        const store = await getStoreByUserId(user.id)

        if (!store) {
          setProducts([])
          return
        }

        const storeProducts = await getProductsByStoreId(store.id)

        setProducts(storeProducts)
      } catch (error) {
        console.error("[v0] Error fetching products:", error)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    if (user?.id && user.role === "seller") {
      fetchProducts()
    }
  }, [user?.id, user?.role])
  // </CHANGE>

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const handleDelete = async (id: string) => {
    if (confirm(t("هل أنت متأكد من حذف هذا المنتج؟", "Are you sure you want to delete this product?"))) {
      const result = await deleteProduct(id)
      if (result.success) {
        setProducts(products.filter((p) => p.id !== id))
      } else {
        alert(t("فشل حذف المنتج", "Failed to delete product"))
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <SellerHeader />
        <main className="flex-1 pt-16 lg:pt-8 pb-8">
          <div className="container mx-auto px-4">
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">{t("جاري التحميل...", "Loading...")}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{t("إدارة المنتجات", "Product Management")}</h1>
              <p className="text-gray-500 mt-1">{t("إدارة وتعديل منتجاتك", "Manage and edit your products")}</p>
            </div>
            <Button asChild className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-6">
              <Link href="/seller/products/new">
                <Plus className="ml-2 h-4 w-4" />
                {t("إضافة منتج جديد", "Add New Product")}
              </Link>
            </Button>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <Card key={product.id} className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group">
                  <CardContent className="p-0">
                    <div className="aspect-square relative bg-gray-100 overflow-hidden">
                      <Image
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2 text-gray-800">{product.name}</h3>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                          {product.price} <span className="text-sm text-gray-500">{t("جنيه", "EGP")}</span>
                        </p>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.stock > 10 ? 'bg-emerald-100 text-emerald-700' : product.stock > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {t("المخزون:", "Stock:")} {product.stock}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"
                          onClick={() => router.push(`/seller/products/edit/${product.id}`)}
                        >
                          <Edit className="ml-2 h-4 w-4" />
                          {t("تعديل", "Edit")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="py-20 text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-gray-800">{t("لا توجد منتجات", "No Products")}</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  {t("ابدأ بإضافة منتجات إلى متجرك", "Start adding products to your store")}
                </p>
                <Button asChild className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8 py-3">
                  <Link href="/seller/products/new">
                    <Plus className="ml-2 h-5 w-5" />
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
