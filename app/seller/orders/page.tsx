import { redirect } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrderStatusSelector } from "@/components/order-status-selector"
import { getStoreByUserId } from "@/lib/actions/stores"
import { getStoreOrders } from "@/lib/actions/orders"
import { createServerClient } from "@/lib/supabase/server"

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
  }
  order_items: OrderItem[]
}

export default async function SellerOrdersPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth?role=seller")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "seller") {
    redirect("/")
  }

  let orders: Order[] = []
  try {
    const store = await getStoreByUserId(user.id)
    if (store) {
      orders = (await getStoreOrders(store.id)) as Order[]
    }
  } catch (error) {
    console.error("Error fetching orders:", error)
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "قيد الانتظار",
      processing: "قيد المعالجة",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
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

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">إدارة الطلبات</h1>

          <Card>
            <CardHeader>
              <CardTitle>جميع الطلبات</CardTitle>
              <CardDescription>إدارة ومتابعة طلبات العملاء</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">لا توجد طلبات حتى الآن</div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold text-lg">#{order.id.slice(0, 8)}</p>
                            <p className="text-sm text-gray-600">
                              {order.profiles?.full_name || order.profiles?.email || "عميل غير معروف"} •{" "}
                              {order.order_items.length} منتج
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
                          <p className="text-xl font-bold text-[#1F478B]">{order.total.toLocaleString()} جنيه</p>
                          <OrderStatusSelector orderId={order.id} currentStatus={order.status} />
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
