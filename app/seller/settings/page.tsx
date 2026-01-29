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
                  <Label htmlFor="storeLogo">شعار المتجر</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {imagePreview && (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
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
                        className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1F478B] transition-colors"
                      >
                        <Upload className="h-5 w-5" />
                        <span>{imagePreview ? "تغيير الشعار" : "رفع شعار المتجر"}</span>
                      </Label>
                      <Input
                        id="storeLogo"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF حتى 5MB</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="storeName">اسم المتجر</Label>
                  <Input id="storeName" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="storeDescription">وصف المتجر</Label>
                  <Textarea
                    id="storeDescription"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="storeCategory">فئة المتجر</Label>
                  <div className="relative">
                    <Input
                      id="storeCategory"
                      value={formData.category}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير فئة المتجر بعد الإنشاء</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="storeAddress">العنوان</Label>
                  <Input id="storeAddress" name="address" value={formData.address} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="storePhone">رقم الهاتف</Label>
                  <Input id="storePhone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
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
                    <Input
                      id="openTime"
                      name="open_time"
                      type="time"
                      value={formData.open_time}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="closeTime">وقت الإغلاق</Label>
                    <Input
                      id="closeTime"
                      name="close_time"
                      type="time"
                      value={formData.close_time}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workingDays">أيام العمل</Label>
                  <Input
                    id="workingDays"
                    name="working_days"
                    value={formData.working_days}
                    onChange={handleInputChange}
                    required
                  />
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
                  <Input
                    id="supportEmail"
                    name="support_email"
                    type="email"
                    value={formData.support_email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="whatsappNumber">رقم واتساب</Label>
                  <Input
                    id="whatsappNumber"
                    name="whatsapp_number"
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="returnPolicy">سياسة الإرجاع</Label>
                  <Textarea
                    id="returnPolicy"
                    name="return_policy"
                    value={formData.return_policy}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70]" disabled={isSaving || isUploadingImage}>
                {isUploadingImage ? "جاري رفع الصورة..." : isSaving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
