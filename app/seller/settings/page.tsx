"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "@/components/seller-header"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
    alert("تم حفظ الإعدادات بنجاح")
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <SellerHeader />

      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">الإعدادات</h1>
            <p className="text-gray-600 mt-1">إدارة معلومات المتجر والإعدادات</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Information */}
            <Card>
              <CardHeader>
                <CardTitle>معلومات المتجر</CardTitle>
                <CardDescription>تحديث معلومات المتجر الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="storeName">اسم المتجر</Label>
                  <Input id="storeName" name="storeName" defaultValue="متجر الإلكترونيات" required />
                </div>
                <div>
                  <Label htmlFor="storeDescription">وصف المتجر</Label>
                  <Textarea
                    id="storeDescription"
                    name="storeDescription"
                    defaultValue="متجر متخصص في بيع الأجهزة الإلكترونية والهواتف الذكية"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="storeCategory">فئة المتجر</Label>
                  <Select name="storeCategory" defaultValue="إلكترونيات">
                    <SelectTrigger id="storeCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="بقالة">بقالة</SelectItem>
                      <SelectItem value="صحة">صحة</SelectItem>
                      <SelectItem value="ملابس">ملابس</SelectItem>
                      <SelectItem value="إلكترونيات">إلكترونيات</SelectItem>
                      <SelectItem value="أغذية">أغذية</SelectItem>
                      <SelectItem value="أثاث">أثاث</SelectItem>
                      <SelectItem value="خدمات أخرى">خدمات أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="storeAddress">العنوان</Label>
                  <Input id="storeAddress" name="storeAddress" defaultValue="القاهرة، مصر" required />
                </div>
                <div>
                  <Label htmlFor="storePhone">رقم الهاتف</Label>
                  <Input id="storePhone" name="storePhone" type="tel" defaultValue="01055161600" required />
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader>
                <CardTitle>ساعات العمل</CardTitle>
                <CardDescription>حدد أوقات عمل المتجر</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="openTime">وقت الفتح</Label>
                    <Input id="openTime" name="openTime" type="time" defaultValue="09:00" required />
                  </div>
                  <div>
                    <Label htmlFor="closeTime">وقت الإغلاق</Label>
                    <Input id="closeTime" name="closeTime" type="time" defaultValue="22:00" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workingDays">أيام العمل</Label>
                  <Input id="workingDays" name="workingDays" defaultValue="السبت - الخميس" required />
                </div>
              </CardContent>
            </Card>

            {/* Customer Service */}
            <Card>
              <CardHeader>
                <CardTitle>خدمة العملاء</CardTitle>
                <CardDescription>معلومات التواصل مع العملاء</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="supportEmail">البريد الإلكتروني للدعم</Label>
                  <Input id="supportEmail" name="supportEmail" type="email" defaultValue="support@store.com" required />
                </div>
                <div>
                  <Label htmlFor="whatsappNumber">رقم واتساب</Label>
                  <Input id="whatsappNumber" name="whatsappNumber" type="tel" defaultValue="01055161600" required />
                </div>
                <div>
                  <Label htmlFor="returnPolicy">سياسة الإرجاع</Label>
                  <Textarea
                    id="returnPolicy"
                    name="returnPolicy"
                    defaultValue="يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الشراء"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]" disabled={isSaving}>
                {isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
