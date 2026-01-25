"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrderStatusSelector } from "@/components/order-status-selector"
import { getStoreByUserId } from "@/lib/actions/stores"
import { getStoreOrders } from "@/lib/actions/orders"
import { useAuth } from "@/lib/auth-context"

type OrderItem = {
  id: string
  quantity: number
  price: number
  products: {
    id: string
    name: string
    image_url: string | null
  }
}

type Order = {
  id: string
  customer_id: string
  store_id: string
  total: number
  status: string
  delivery_address: string
  created_at: string
  updated_at: string
  profiles: {
    id: string
    full_name: string | null
    email: string
    phone: string | null
  } | null
  order_items: OrderItem[]
}

export default function SellerOrdersPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  const loadOrders = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoadingOrders(true)
      const store = await getStoreByUserId(user.id)
      if (store) {
        const data = (await getStoreOrders(store.id)) as Order[]
        setOrders(data)
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error("Error fetching orders:", error)
      setOrders([])
    } finally {
      setLoadingOrders(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id && user?.role === "seller") {
      loadOrders()
    }
  }, [loadOrders, user?.id, user?.role])

  if (isLoading || !user || user.role !== "seller") {
    return null
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Ù‚ÙŠØ¯ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±",
      processing: "Ù‚ÙŠØ¯ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©",
      shipped: "ØªÙ… Ø§Ù„Ø´Ø­Ù†",
      delivered: "ØªÙ… Ø§Ù„ØªÙˆØµÙŠÙ„",
      cancelled: "Ù…Ù„ØºÙŠ",
    }
    return statusMap[status] || status
  }

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colorMap[status] || "bg-gray-100 text-gray-800"
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  if (loadingOrders) {
    return (
      <div className="flex min-h-screen bg-secondary">
        <SellerHeader />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-gray-500">Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª</h1>

          <Card>
            <CardHeader>
              <CardTitle>Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø·Ù„Ø¨Ø§Øª</CardTitle>
              <CardDescription>Ø¥Ø¯Ø§Ø±Ø© ÙˆÙ…ØªØ§Ø¨Ø¹Ø© Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø·Ù„Ø¨Ø§Øª Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold text-lg">#{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-gray-600">
                              {order.profiles?.full_name || order.profiles?.email || "Ø¹Ù…ÙŠÙ„ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ"} â€¢{" "}
                              {order.order_items.length} Ù…Ù†ØªØ¬
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                        <div className="flex items-center gap-4">
                          <p className="text-xl font-bold text-[#1F478B]">{Number(order.total).toLocaleString()} Ø¬Ù†ÙŠÙ‡</p>
                          <OrderStatusSelector orderId={order.id} currentStatus={order.status} onUpdated={loadOrders} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
