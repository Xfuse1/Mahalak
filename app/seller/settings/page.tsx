"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Textarea } from "../../../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { getStoreByUserId, updateStore, createStore, uploadStoreImage } from "../../../lib/actions/stores"
import Image from "next/image"
import { Upload } from "lucide-react"

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [store, setStore] = useState<any>(null)
  const [isLoadingStore, setIsLoadingStore] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Controlled form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "خدمات أخرى",
    address: "",
    phone: "",
    open_time: "09:00",
    close_time: "22:00",
    working_days: "السبت - الخميس",
    support_email: "",
    whatsapp_number: "",
    return_policy: "يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الشراء"
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth?role=seller")
    }
    if (user?.role !== "seller") {
      router.push("/")
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const fetchStore = async () => {
      if (!user?.id) return

      setIsLoadingStore(true)
      const storeData = await getStoreByUserId(user.id)
      if (storeData) {
        setStore(storeData)
        if (storeData.image_url) {
          setImagePreview(storeData.image_url)
        }
        setFormData({
          name: storeData.name || "",
          description: storeData.description || "",
          category: storeData.category || "خدمات أخرى",
          address: storeData.address || "",
          phone: storeData.phone || "",
          open_time: storeData.open_time || "09:00",
          close_time: storeData.close_time || "22:00",
          working_days: storeData.working_days || "السبت - الخميس",
          support_email: storeData.support_email || "",
          whatsapp_number: storeData.whatsapp_number || "",
          return_policy: storeData.return_policy || "يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الشراء"
        })
      }
      setIsLoadingStore(false)
    }

    if (user?.id && user?.role === "seller") {
      fetchStore()
    }
  }, [user?.id, user?.role])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (isLoading || !user || user.role !== "seller" || isLoadingStore) {
    return null
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!user?.id) {
      alert("لم يتم العثور على بيانات المستخدم. يرجى تسجيل الدخول مرة أخرى.")
      return
    }

    setIsSaving(true)

    let imageUrl = store?.image_url || ""

    if (imageFile) {
      setIsUploadingImage(true)
      try {
        const uploadFormData = new FormData()
        uploadFormData.append("file", imageFile)
        uploadFormData.append("storeId", store?.id || user.id)

        const uploadResult = await uploadStoreImage(uploadFormData)

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "فشل رفع الصورة")
        }

        imageUrl = uploadResult.url!
        console.log("[v0] Store image uploaded successfully")
      } catch (error: any) {
        console.error("Error uploading image:", error)
        alert("فشل رفع الصورة: " + (error.message || "Unknown error"))
        setIsSaving(false)
        setIsUploadingImage(false)
        return
      }
      setIsUploadingImage(false)
    }

    const updateData = {
      ...formData,
      image_url: imageUrl,
    }

    let result
    if (store?.id) {
      result = await updateStore(store.id, updateData)
    } else {
      // Create new store if missing
      result = await createStore({
        seller_id: user.id,
        ...updateData,
      } as any)
    }

    setIsSaving(false)

    if (result.success) {
      setStore(result.data)
      setImageFile(null)
      alert("تم حفظ الإعدادات بنجاح")
      window.location.reload() // Force reload to ensure data is fresh
    } else {
      alert("حدث خطأ أثناء حفظ الإعدادات: " + result.error)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">الإعدادات</h1>
            <p className="text-gray-500 mt-1">إدارة معلومات المتجر والإعدادات</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Information */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Upload className="h-5 w-5 text-blue-600" />
                  </div>
                  معلومات المتجر
                </CardTitle>
                <CardDescription>تحديث معلومات المتجر الأساسية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div>
                  <Label htmlFor="storeLogo" className="text-gray-700 font-medium">شعار المتجر</Label>
                  <div className="mt-3 flex items-center gap-4">
                    {imagePreview && (
                      <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-blue-200 shadow-md">
                        <Image
                          src={imagePreview || "/placeholder.svg"}
                          alt="Store logo preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Label
                        htmlFor="storeLogo"
                        className="flex items-center justify-center gap-3 px-5 py-4 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                      >
                        <Upload className="h-6 w-6 text-blue-600" />
                        <span className="font-medium text-gray-700">{imagePreview ? "تغيير الشعار" : "رفع شعار المتجر"}</span>
                      </Label>
                      <Input
                        id="storeLogo"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF حتى 5MB</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="storeName" className="text-gray-700 font-medium">اسم المتجر</Label>
                  <Input id="storeName" name="name" value={formData.name} onChange={handleInputChange} required className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <Label htmlFor="storeDescription" className="text-gray-700 font-medium">وصف المتجر</Label>
                  <Textarea
                    id="storeDescription"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-2 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor="storeCategory" className="text-gray-700 font-medium">فئة المتجر</Label>
                  <div className="relative mt-2">
                    <Input
                      id="storeCategory"
                      value={formData.category}
                      disabled
                      className="bg-gray-100 cursor-not-allowed h-12 rounded-xl"
                    />
                    <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير فئة المتجر بعد الإنشاء</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="storeAddress" className="text-gray-700 font-medium">العنوان</Label>
                  <Input id="storeAddress" name="address" value={formData.address} onChange={handleInputChange} required className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <Label htmlFor="storePhone" className="text-gray-700 font-medium">رقم الهاتف</Label>
                  <Input id="storePhone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle>ساعات العمل</CardTitle>
                <CardDescription>حدد أوقات عمل المتجر</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="openTime" className="text-gray-700 font-medium">وقت الفتح</Label>
                    <Input
                      id="openTime"
                      name="open_time"
                      type="time"
                      value={formData.open_time}
                      onChange={handleInputChange}
                      required
                      className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="closeTime" className="text-gray-700 font-medium">وقت الإغلاق</Label>
                    <Input
                      id="closeTime"
                      name="close_time"
                      type="time"
                      value={formData.close_time}
                      onChange={handleInputChange}
                      required
                      className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workingDays" className="text-gray-700 font-medium">أيام العمل</Label>
                  <Input
                    id="workingDays"
                    name="working_days"
                    value={formData.working_days}
                    onChange={handleInputChange}
                    required
                    className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Customer Service */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle>خدمة العملاء</CardTitle>
                <CardDescription>معلومات التواصل مع العملاء</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div>
                  <Label htmlFor="supportEmail" className="text-gray-700 font-medium">البريد الإلكتروني للدعم</Label>
                  <Input
                    id="supportEmail"
                    name="support_email"
                    type="email"
                    value={formData.support_email}
                    onChange={handleInputChange}
                    required
                    className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsappNumber" className="text-gray-700 font-medium">رقم واتساب</Label>
                  <Input
                    id="whatsappNumber"
                    name="whatsapp_number"
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={handleInputChange}
                    required
                    className="mt-2 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <Label htmlFor="returnPolicy" className="text-gray-700 font-medium">سياسة الإرجاع</Label>
                  <Textarea
                    id="returnPolicy"
                    name="return_policy"
                    value={formData.return_policy}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-2 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pb-8">
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8 py-3 text-lg" disabled={isSaving || isUploadingImage}>
                {isUploadingImage ? "جاري رفع الصورة..." : isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
