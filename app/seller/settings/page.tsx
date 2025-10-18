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
import { getStoreByUserId, updateStore } from "@/lib/actions/stores"
import { createClient } from "@/lib/supabase/client"
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
  const [category, setCategory] = useState<string>("خدمات أخرى")

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
        if (storeData.category) {
          setCategory(storeData.category)
        }
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!store?.id) return

    const form = e.currentTarget
    const formElements = form.elements as any

    const formValues = {
      storeName: formElements.storeName.value,
      storeDescription: formElements.storeDescription.value,
      storeAddress: formElements.storeAddress.value,
      storePhone: formElements.storePhone.value,
      openTime: formElements.openTime.value,
      closeTime: formElements.closeTime.value,
      workingDays: formElements.workingDays.value,
      supportEmail: formElements.supportEmail.value,
      whatsappNumber: formElements.whatsappNumber.value,
      returnPolicy: formElements.returnPolicy.value,
    }

    setIsSaving(true)

    let imageUrl = store.image_url

    if (imageFile) {
      setIsUploadingImage(true)
      try {
        const supabase = createClient()
        const fileExt = imageFile.name.split(".").pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `stores/${store.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, imageFile)

        if (uploadError) {
          console.error("Error uploading image:", uploadError)
          alert("فشل رفع الصورة: " + uploadError.message)
          setIsSaving(false)
          setIsUploadingImage(false)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(filePath)

        imageUrl = publicUrl
      } catch (error) {
        console.error("Error uploading image:", error)
        alert("فشل رفع الصورة")
        setIsSaving(false)
        setIsUploadingImage(false)
        return
      }
      setIsUploadingImage(false)
    }

    const updateData = {
      name: formValues.storeName,
      description: formValues.storeDescription,
      category: category,
      address: formValues.storeAddress,
      phone: formValues.storePhone,
      open_time: formValues.openTime,
      close_time: formValues.closeTime,
      working_days: formValues.workingDays,
      support_email: formValues.supportEmail,
      whatsapp_number: formValues.whatsappNumber,
      return_policy: formValues.returnPolicy,
      image_url: imageUrl,
    }

    const result = await updateStore(store.id, updateData)

    setIsSaving(false)

    if (result.success) {
      setStore(result.data)
      setImageFile(null)
      alert("تم حفظ الإعدادات بنجاح")
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
                  <Input id="storeName" name="storeName" defaultValue={store?.name || ""} required />
                </div>
                <div>
                  <Label htmlFor="storeDescription">وصف المتجر</Label>
                  <Textarea
                    id="storeDescription"
                    name="storeDescription"
                    defaultValue={store?.description || ""}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="storeCategory">فئة المتجر</Label>
                  <Select value={category} onValueChange={setCategory}>
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
                  <Input id="storeAddress" name="storeAddress" defaultValue={store?.address || ""} required />
                </div>
                <div>
                  <Label htmlFor="storePhone">رقم الهاتف</Label>
                  <Input id="storePhone" name="storePhone" type="tel" defaultValue={store?.phone || ""} required />
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
                      name="openTime"
                      type="time"
                      defaultValue={store?.open_time || "09:00"}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="closeTime">وقت الإغلاق</Label>
                    <Input
                      id="closeTime"
                      name="closeTime"
                      type="time"
                      defaultValue={store?.close_time || "22:00"}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workingDays">أيام العمل</Label>
                  <Input
                    id="workingDays"
                    name="workingDays"
                    defaultValue={store?.working_days || "السبت - الخميس"}
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
                    name="supportEmail"
                    type="email"
                    defaultValue={store?.support_email || ""}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="whatsappNumber">رقم واتساب</Label>
                  <Input
                    id="whatsappNumber"
                    name="whatsappNumber"
                    type="tel"
                    defaultValue={store?.whatsapp_number || store?.phone || ""}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="returnPolicy">سياسة الإرجاع</Label>
                  <Textarea
                    id="returnPolicy"
                    name="returnPolicy"
                    defaultValue={store?.return_policy || "يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الشراء"}
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
