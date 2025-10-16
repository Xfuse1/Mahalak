"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { useAuth } from "@/lib/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, UserIcon, MapPin } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function AccountPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth")
    }
    if (user?.role === "seller") {
      router.push("/seller/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return null
  }

  // Mock orders data
  const orders = [
    {
      id: "ORD-001",
      date: "2024-01-15",
      total: 3500,
      status: "delivered",
      items: 2,
    },
    {
      id: "ORD-002",
      date: "2024-01-20",
      total: 235,
      status: "shipped",
      items: 3,
    },
    {
      id: "ORD-003",
      date: "2024-01-22",
      total: 120,
      status: "processing",
      items: 1,
    },
  ]

  const getStatusText = (status: string) => {
    const statusMap: Record<string, { ar: string; en: string }> = {
      pending: { ar: "قيد الانتظار", en: "Pending" },
      processing: { ar: "قيد المعالجة", en: "Processing" },
      shipped: { ar: "تم الشحن", en: "Shipped" },
      delivered: { ar: "تم التوصيل", en: "Delivered" },
      cancelled: { ar: "ملغي", en: "Cancelled" },
    }
    return statusMap[status] ? t(statusMap[status].ar, statusMap[status].en) : status
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8 bg-secondary">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <h1 className="text-3xl font-bold mb-8">{t("حسابي", "My Account")}</h1>

          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="orders" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <Package className="ml-2 h-4 w-4" />
                {t("طلباتي", "My Orders")}
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <UserIcon className="ml-2 h-4 w-4" />
                {t("الملف الشخصي", "Profile")}
              </TabsTrigger>
              <TabsTrigger value="address" className="data-[state=active]:bg-[#1F478B] data-[state=active]:text-white">
                <MapPin className="ml-2 h-4 w-4" />
                {t("العناوين", "Addresses")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>{t("طلباتي", "My Orders")}</CardTitle>
                  <CardDescription>
                    {t("تتبع جميع طلباتك وحالتها", "Track all your orders and their status")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {orders.length > 0 ? (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-lg">
                                {t("طلب رقم:", "Order #")} {order.id}
                              </p>
                              <p className="text-sm text-gray-600">{order.date}</p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}
                            >
                              {getStatusText(order.status)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              <span>
                                {order.items} {t("منتج", "items")}
                              </span>
                            </div>
                            <div className="text-left">
                              <p className="text-xl font-bold text-[#1F478B]">
                                {order.total} {t("جنيه", "EGP")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600">{t("لا توجد طلبات بعد", "No orders yet")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>{t("الملف الشخصي", "Profile")}</CardTitle>
                  <CardDescription>{t("إدارة معلوماتك الشخصية", "Manage your personal information")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div>
                      <Label htmlFor="name">{t("الاسم الكامل", "Full Name")}</Label>
                      <Input id="name" defaultValue={user.name} />
                    </div>
                    <div>
                      <Label htmlFor="email">{t("البريد الإلكتروني", "Email")}</Label>
                      <Input id="email" type="email" defaultValue={user.email} disabled />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t("رقم الهاتف", "Phone Number")}</Label>
                      <Input id="phone" type="tel" placeholder="01xxxxxxxxx" defaultValue={user.phone || ""} />
                    </div>
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]">
                      {t("حفظ التغييرات", "Save Changes")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle>{t("عناوين التوصيل", "Delivery Addresses")}</CardTitle>
                  <CardDescription>
                    {t("إدارة عناوين التوصيل الخاصة بك", "Manage your delivery addresses")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div>
                      <Label htmlFor="address">{t("العنوان", "Address")}</Label>
                      <Input
                        id="address"
                        placeholder={t("الشارع، المنطقة", "Street, Area")}
                        defaultValue={user.address || ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">{t("المدينة", "City")}</Label>
                      <Input id="city" placeholder={t("القاهرة", "Cairo")} />
                    </div>
                    <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]">
                      {t("حفظ العنوان", "Save Address")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}
