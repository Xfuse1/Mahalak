"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SellerHeader } from "../../../components/seller-header"
import { useAuth } from "../../../lib/auth-context"
import { useLanguage } from "../../../lib/language-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Textarea } from "../../../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { getStoreByUserId, updateStore, createStore, uploadStoreImage, getCategoryNameById, type Store, type StoreCreateInput } from "../../../lib/actions/stores"
import { logError } from "../../../lib/logger"
import Image from "next/image"
import { Upload, Phone, MapPin, Loader2, CheckCircle, Truck, Trash2 } from "lucide-react"
import Link from "next/link"
import { requestSellerAccountDeletion } from "../../../lib/actions/account-deletion"
import dynamic from "next/dynamic"
import { useToast } from "@/components/ui/toast"
import { normalizeEgyptPhone } from "@/lib/utils/phone"
import { imgSrc } from "@/lib/storage/public-url"

function PhoneVerificationLoading() {
  const { t } = useLanguage()

  return <div className="flex items-center justify-center p-4">{t("جاري التحميل...", "Loading...")}</div>
}

// Lazy load phone verification (heavy: Firebase reCAPTCHA)
const PhoneVerification = dynamic(
  () => import("../../../components/phone-verification").then(m => ({ default: m.PhoneVerification })),
  { ssr: false, loading: () => <PhoneVerificationLoading /> }
)

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const { t, language } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [requestingDeletion, setRequestingDeletion] = useState(false)
  const [deletionRequested, setDeletionRequested] = useState(false)
  const [store, setStore] = useState<Store | null>(null)
  const [isLoadingStore, setIsLoadingStore] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  
  // Phone verification state
  const [isChangingPhone, setIsChangingPhone] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  
  // Location state
  const [storeLocation, setStoreLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSuccess, setLocationSuccess] = useState(false)

  const defaultStoreCategory = t("خدمات أخرى", "Other services")
  const defaultWorkingDays = t("السبت - الخميس", "Saturday - Thursday")
  const defaultReturnPolicy = t(
    "يمكن إرجاع المنتجات خلال 14 يوم من تاريخ الشراء",
    "Products can be returned within 14 days from the purchase date",
  )
  
  // Get current location function
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t("المتصفح لا يدعم تحديد الموقع", "Your browser does not support geolocation"))
      return
    }
    
    setIsGettingLocation(true)
    setLocationError(null)
    setLocationSuccess(false)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStoreLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(t("تم رفض إذن الموقع. يرجى السماح بالوصول للموقع", "Location access was denied. Please allow location permission."))
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError(t("معلومات الموقع غير متاحة", "Location information is unavailable"))
            break
          case error.TIMEOUT:
            setLocationError(t("انتهت مهلة طلب الموقع", "Location request timed out"))
            break
          default:
            setLocationError(t("حدث خطأ في تحديد الموقع", "An error occurred while getting location"))
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }
  
  // Save location to store
  const saveLocation = async () => {
    if (!user?.id || !storeLocation) return
    
    setIsSaving(true)
    try {
      await updateStore(user.id, {
        latitude: storeLocation.latitude,
        longitude: storeLocation.longitude,
      }, user.id)
      setLocationSuccess(true)
      // Update local store state
      setStore((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          latitude: storeLocation.latitude,
          longitude: storeLocation.longitude,
        }
      })
    } catch (error) {
      setLocationError(t("حدث خطأ في حفظ الموقع", "An error occurred while saving location"))
    }
    setIsSaving(false)
  }

  // Controlled form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: defaultStoreCategory,
    address: "",
    phone: "",
    open_time: "09:00",
    close_time: "22:00",
    working_days: defaultWorkingDays,
    support_email: "",
    whatsapp_number: "",
    return_policy: defaultReturnPolicy,
    free_shipping: false,
    free_shipping_cap: 0,
  })

  useEffect(() => {
    // انتظر انتهاء تحميل المصادقة قبل أي تحويل — وإلا يُطرد البائع لحظة التحميل (user=null)
    if (isLoading) return
    if (!user) {
      router.push("/auth?role=seller")
      return
    }
    if (user.role !== "seller") {
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
          category: storeData.category || defaultStoreCategory,
          address: storeData.address || "",
          phone: storeData.phone || "",
          open_time: storeData.open_time || "09:00",
          close_time: storeData.close_time || "22:00",
          working_days: storeData.working_days || defaultWorkingDays,
          support_email: storeData.support_email || user?.email || "",
          whatsapp_number: storeData.phone || "",
          return_policy: storeData.return_policy || defaultReturnPolicy,
          free_shipping: storeData.free_shipping || false,
          free_shipping_cap: storeData.free_shipping_cap || 0,
        })
        // Fetch fresh category name from Firebase by ID
        if (storeData.category_id) {
          getCategoryNameById(storeData.category_id as string).then(freshName => {
            if (freshName) setFormData(prev => ({ ...prev, category: freshName }))
          }).catch(() => {})
        }
      }
      setIsLoadingStore(false)
    }

    if (user?.id && user?.role === "seller") {
      fetchStore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.error(t("لم يتم العثور على بيانات المستخدم. يرجى تسجيل الدخول مرة أخرى.", "User data was not found. Please log in again."))
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
        uploadFormData.append("callerId", user.id)

        const uploadResult = await uploadStoreImage(uploadFormData)

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || t("فشل رفع الصورة", "Failed to upload image"))
        }

        imageUrl = uploadResult.url!
      } catch (error: unknown) {
        logError("Error uploading image:", error)
        const errorMessage = error instanceof Error && error.message ? error.message : t("خطأ غير معروف", "Unknown error")
        toast.error(t("فشل رفع الصورة: ", "Image upload failed: ") + errorMessage)
        setIsSaving(false)
        setIsUploadingImage(false)
        return
      }
      setIsUploadingImage(false)
    }

    const updateData = {
      ...formData,
      whatsapp_number: formData.phone,
      image_url: imageUrl,
    }

    let result
    if (store?.id) {
      result = await updateStore(store.id, updateData, user.id)
    } else {
      // Create new store if missing
      const createData: StoreCreateInput = {
        seller_id: user.id,
        ...updateData,
      }
      result = await createStore(createData)
    }

    setIsSaving(false)

    if (result.success) {
      setStore(result.data as Store)
      setImageFile(null)
      if ((result.data as Store).image_url) {
        setImagePreview((result.data as Store).image_url!)
      }
      toast.success(t("تم حفظ الإعدادات بنجاح", "Settings saved successfully"))
    } else {
      toast.error(t("حدث خطأ أثناء حفظ الإعدادات: ", "An error occurred while saving settings: ") + result.error)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SellerHeader />

      <main className="flex-1 pt-16 lg:pt-8 pb-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{t("الإعدادات", "Settings")}</h1>
            <p className="text-gray-500 mt-1">{t("إدارة معلومات المتجر والإعدادات", "Manage store information and settings")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Information */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  {t("معلومات المتجر", "Store Information")}
                </CardTitle>
                <CardDescription>{t("تحديث معلومات المتجر الأساسية", "Update basic store information")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div>
                  <Label htmlFor="storeLogo" className="text-gray-700 font-medium">{t("شعار المتجر", "Store Logo")}</Label>
                  <div className="mt-3 flex items-center gap-4">
                    {imagePreview && (
                      <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-md">
                        <Image
                          src={imgSrc(imagePreview)}
                          alt={t("معاينة شعار المتجر", "Store logo preview")}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Label
                        htmlFor="storeLogo"
                        className="flex items-center justify-center gap-3 px-5 py-4 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-primary hover:bg-primary/10 transition-all"
                      >
                        <Upload className="h-6 w-6 text-primary" />
                        <span className="font-medium text-gray-700">
                          {imagePreview ? t("تغيير الشعار", "Change Logo") : t("رفع شعار المتجر", "Upload Store Logo")}
                        </span>
                      </Label>
                      <Input
                        id="storeLogo"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-500 mt-2">{t("PNG, JPG, GIF حتى 5MB", "PNG, JPG, GIF up to 5MB")}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="storeName" className="text-gray-700 font-medium">{t("اسم المتجر", "Store Name")}</Label>
                  <Input id="storeName" name="name" value={formData.name} onChange={handleInputChange} required className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                </div>
                <div>
                  <Label htmlFor="storeDescription" className="text-gray-700 font-medium">{t("وصف المتجر", "Store Description")}</Label>
                  <Textarea
                    id="storeDescription"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    className="mt-2 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <div>
                  <Label htmlFor="storeCategory" className="text-gray-700 font-medium">{t("فئة المتجر", "Store Category")}</Label>
                  <div className="relative mt-2">
                    <Input
                      id="storeCategory"
                      value={formData.category}
                      disabled
                      className="bg-gray-100 cursor-not-allowed h-12 rounded-xl"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t("لا يمكن تغيير فئة المتجر بعد الإنشاء", "Store category cannot be changed after creation")}</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="storeAddress" className="text-gray-700 font-medium">{t("العنوان", "Address")}</Label>
                  <Input id="storeAddress" name="address" value={formData.address} onChange={handleInputChange} required className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                </div>
                
                {/* Phone with verification */}
                <div className="space-y-3">
                  <Label className="text-gray-700 font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t("رقم الهاتف", "Phone Number")}
                  </Label>
                  
                  {!isChangingPhone ? (
                    <div className="flex items-center gap-3">
                      <Input 
                        value={formData.phone} 
                        disabled 
                        className="mt-2 h-12 rounded-xl bg-green-50 border-green-200 flex-1" 
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsChangingPhone(true)
                          setNewPhone("")
                          setIsPhoneVerified(false)
                        }}
                        className="h-12 px-4 rounded-xl"
                      >
                        {t("تغيير الرقم", "Change Number")}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                      <PhoneVerification
                        phoneNumber={newPhone}
                        onPhoneChange={setNewPhone}
                        flow="other"
                        onVerified={(verified) => {
                          setIsPhoneVerified(verified)
                          if (verified) {
                            const normalizedPhone = normalizeEgyptPhone(newPhone) || newPhone
                            // Update form data with new verified phone + whatsapp
                            setFormData(prev => ({ ...prev, phone: normalizedPhone, whatsapp_number: normalizedPhone }))
                          }
                        }}
                        isVerified={isPhoneVerified}
                        language={language}
                      />
                      {!isPhoneVerified && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsChangingPhone(false)
                            setNewPhone("")
                            setIsPhoneVerified(false)
                          }}
                          className="mt-3 text-gray-500"
                        >
                          {t("إلغاء التغيير", "Cancel Change")}
                        </Button>
                      )}
                      {isPhoneVerified && (
                        <p className="text-sm text-green-600 mt-2">{t('✓ تم التحقق من الرقم الجديد. اضغط "حفظ التغييرات" لحفظ التعديلات.', '✓ New phone number verified. Click "Save Changes" to keep updates.')}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Store Location */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  {t("موقع المتجر", "Store Location")}
                </CardTitle>
                <CardDescription>{t("حدد الموقع الجغرافي للمتجر", "Set the store geographic location")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {/* Current Location Display */}
                {store?.latitude && store?.longitude && !storeLocation && (
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <p className="text-sm font-medium text-gray-700 mb-1">{t("الموقع الحالي", "Current Location")}</p>
                    <p className="text-xs text-gray-500">
                      {t("خط العرض", "Lat")}: {store.latitude.toFixed(6)}, {t("خط الطول", "Lng")}: {store.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
                
                {/* New Location Capture */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="w-full h-12 flex items-center justify-center gap-2"
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {t("جاري تحديد الموقع...", "Detecting location...")}
                      </>
                    ) : storeLocation ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        {t("تم تحديد الموقع الجديد", "New location selected")}
                      </>
                    ) : (
                      <>
                        <MapPin className="h-5 w-5" />
                        {t("تحديد موقع المتجر من الجهاز", "Detect store location from device")}
                      </>
                    )}
                  </Button>
                  
                  {storeLocation && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700">{t("الموقع الجديد", "New Location")}</p>
                          <p className="text-xs text-green-600">
                            {t("خط العرض", "Lat")}: {storeLocation.latitude.toFixed(6)}, {t("خط الطول", "Lng")}: {storeLocation.longitude.toFixed(6)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveLocation}
                          disabled={isSaving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            t("حفظ الموقع", "Save Location")
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {locationSuccess && (
                    <p className="text-sm text-green-600">{t("✓ تم حفظ الموقع بنجاح", "✓ Location saved successfully")}</p>
                  )}
                  
                  {locationError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                      {locationError}
                    </div>
                  )}
                  
                  {!store?.latitude && !store?.longitude && !storeLocation && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      {t("⚠️ لم يتم تحديد موقع المتجر بعد. الموقع مطلوب للموافقة على المتجر.", "⚠️ Store location is not set yet. Location is required for store approval.")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle>{t("ساعات العمل", "Working Hours")}</CardTitle>
                <CardDescription>{t("حدد أوقات عمل المتجر", "Set store working hours")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="openTime" className="text-gray-700 font-medium">{t("وقت الفتح", "Opening Time")}</Label>
                    <Input
                      id="openTime"
                      name="open_time"
                      type="time"
                      value={formData.open_time}
                      onChange={handleInputChange}
                      required
                      className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <Label htmlFor="closeTime" className="text-gray-700 font-medium">{t("وقت الإغلاق", "Closing Time")}</Label>
                    <Input
                      id="closeTime"
                      name="close_time"
                      type="time"
                      value={formData.close_time}
                      onChange={handleInputChange}
                      required
                      className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="workingDays" className="text-gray-700 font-medium">{t("أيام العمل", "Working Days")}</Label>
                  <Input
                    id="workingDays"
                    name="working_days"
                    value={formData.working_days}
                    onChange={handleInputChange}
                    required
                    className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Customer Service */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle>{t("خدمة العملاء", "Customer Service")}</CardTitle>
                <CardDescription>{t("معلومات التواصل مع العملاء", "Customer contact information")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div>
                  <Label htmlFor="supportEmail" className="text-gray-700 font-medium">{t("البريد الإلكتروني للدعم", "Support Email")}</Label>
                  <Input
                    id="supportEmail"
                    name="support_email"
                    type="email"
                    value={formData.support_email}
                    onChange={handleInputChange}
                    required
                    className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsappNumber" className="text-gray-700 font-medium">{t("رقم واتساب", "WhatsApp Number")}</Label>
                  <Input
                    id="whatsappNumber"
                    name="whatsapp_number"
                    type="tel"
                    value={formData.phone}
                    disabled
                    className="mt-2 h-12 rounded-xl bg-gray-100 border-gray-200 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t("رقم الواتساب هو نفس رقم الهاتف", "WhatsApp number is the same as phone number")}</p>
                </div>
                <div>
                  <Label htmlFor="returnPolicy" className="text-gray-700 font-medium">{t("سياسة الإرجاع", "Return Policy")}</Label>
                  <Textarea
                    id="returnPolicy"
                    name="return_policy"
                    value={formData.return_policy}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-2 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* شحن مجاني */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  {t("شحن مجاني", "Free Shipping")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "تتحمّل أنت رسوم التوصيل عن العميل (تُخصم من حصيلتك). السائق يأخذ أجرته كاملة.",
                    "You cover the delivery fee instead of the customer (deducted from your payout). The driver still gets paid in full.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800">{t("تفعيل الشحن المجاني", "Enable free shipping")}</p>
                    <p className="text-sm text-gray-500">{t("العميل يدفع 0 للتوصيل", "Customer pays 0 for delivery")}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.free_shipping}
                    onClick={() => setFormData((p) => ({ ...p, free_shipping: !p.free_shipping }))}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${formData.free_shipping ? "bg-primary" : "bg-gray-300"}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${formData.free_shipping ? "translate-x-1" : "translate-x-6"}`}
                    />
                  </button>
                </div>
                {formData.free_shipping && (
                  <div className="pt-3 border-t border-gray-100">
                    <Label htmlFor="freeShipCap" className="text-gray-700 font-medium">
                      {t("سقف ما تتحمّله لكل طلب (جنيه)", "Cap per order you cover (EGP)")}
                    </Label>
                    <Input
                      id="freeShipCap"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={formData.free_shipping_cap}
                      onChange={(e) => setFormData((p) => ({ ...p, free_shipping_cap: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                      className="mt-2 h-12 rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20 max-w-[200px]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t(
                        "0 = تتحمّل التوصيل كاملًا. أي رقم = تتحمّل حتى هذا الحدّ والباقي على العميل (يحميك في التوصيلات البعيدة).",
                        "0 = cover the full delivery. Any number = cover up to this amount, the customer pays the rest (protects you on far deliveries).",
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end pb-8">
              <Button type="submit" className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 px-8 py-3 text-lg" disabled={isSaving || isUploadingImage}>
                {isUploadingImage ? t("جاري رفع الصورة...", "Uploading image...") : isSaving ? t("جاري الحفظ...", "Saving...") : t("حفظ التغييرات", "Save Changes")}
              </Button>
            </div>
          </form>

          {/* حذف حساب التاجر — مدخل داخل التطبيق (التاجر لا يرى صفحة /account أصلًا) */}
          <Card className="border border-destructive/30 rounded-2xl overflow-hidden mb-10">
            <CardHeader className="bg-destructive/5 border-b border-destructive/20">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                {t("إغلاق المتجر وحذف الحساب", "Close store and delete account")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t("• متجرك هيتخفي من الموقع فورًا وما حدش هيقدر يطلب منه.", "• Your store is hidden immediately and can no longer receive orders.")}</li>
                <li>{t("• بنراجع الطلب وننفّذ حذف الكتالوج والبيانات بعد تسوية المستحقات.", "• We review the request and delete the catalog after settling any dues.")}</li>
                <li>{t("• لو عندك نقدية غير مسوّاة مع السائقين، لازم تتسوّى الأول.", "• Unsettled cash with drivers must be settled first.")}</li>
              </ul>
              {deletionRequested ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  {t("تم استلام طلب الحذف — متجرك مخفي دلوقتي وهنتواصل معاك.", "Deletion request received — your store is now hidden.")}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl px-8"
                  disabled={requestingDeletion}
                  onClick={async () => {
                    setRequestingDeletion(true)
                    try {
                      const res = await requestSellerAccountDeletion({})
                      if (res?.success) {
                        setDeletionRequested(true)
                        toast.success(t("تم إرسال طلب حذف الحساب", "Deletion request sent"))
                      } else {
                        toast.error(res?.error || t("تعذّر إرسال الطلب", "Could not send the request"))
                      }
                    } catch {
                      toast.error(t("تعذّر إرسال الطلب، حاول مرة أخرى", "Could not send the request"))
                    } finally {
                      setRequestingDeletion(false)
                    }
                  }}
                >
                  {requestingDeletion && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  {t("اطلب حذف الحساب", "Request account deletion")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                <Link href="/delete-account" className="text-primary hover:underline">
                  {t("تفاصيل أكثر عن حذف الحساب", "More about account deletion")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
