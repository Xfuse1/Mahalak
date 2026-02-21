"use client"

import type React from "react"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { MapPin, Loader2, CheckCircle, Upload, X, Map } from "lucide-react"
import Image from "next/image"
import dynamic from "next/dynamic"

const PhoneVerification = dynamic(
  () => import("../phone-verification").then(m => ({ default: m.PhoneVerification })),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-4">جاري التحميل...</div> }
)

export interface CategoryItem {
  id: string
  name: string
}

interface SellerFieldsProps {
  t: (ar: string, en: string) => string
  isRTL: boolean
  language: "ar" | "en"
  setError: (error: string) => void
  // Categories from Firestore
  categories: CategoryItem[]
  isCategoriesLoading: boolean
  // Phone verification
  sellerPhone: string
  setSellerPhone: (phone: string) => void
  isPhoneVerified: boolean
  setIsPhoneVerified: (verified: boolean) => void
  triggerSendOTP: boolean
  setTriggerSendOTP: (trigger: boolean) => void
  phoneStep: "phone" | "otp" | "verified"
  setPhoneStep: (step: "phone" | "otp" | "verified") => void
  // Store name
  handleStoreNameChange: (value: string) => void
  isCheckingStoreName: boolean
  storeNameExists: boolean
  // Store type
  selectedStoreType: string
  setSelectedStoreType: (type: string) => void
  // Store logo
  storeLogoPreview: string | null
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeStoreLogo: () => void
  // Owner ID
  ownerIdNumber: string
  setOwnerIdNumber: (id: string) => void
  // Document previews
  idCardImageFrontPreview: string | null
  idCardImageBackPreview: string | null
  commercialRegisterImagePreview: string | null
  taxCardImageFrontPreview: string | null
  taxCardImageBackPreview: string | null
  removeImage: (target: string) => void
  openUploadDialog: (target: string) => void
  // Location
  storeLocation: { latitude: number; longitude: number } | null
  getCurrentLocation: () => void
  isGettingLocation: boolean
  locationError: string | null
  setShowMapPicker: (show: boolean) => void
}

export function SellerFields(props: SellerFieldsProps) {
  const {
    t, isRTL, language, setError,
    categories, isCategoriesLoading,
    sellerPhone, setSellerPhone, isPhoneVerified, setIsPhoneVerified,
    triggerSendOTP, setTriggerSendOTP, phoneStep, setPhoneStep,
    handleStoreNameChange, isCheckingStoreName, storeNameExists,
    selectedStoreType, setSelectedStoreType,
    storeLogoPreview, handleLogoChange, removeStoreLogo,
    ownerIdNumber, setOwnerIdNumber,
    idCardImageFrontPreview, idCardImageBackPreview,
    commercialRegisterImagePreview,
    taxCardImageFrontPreview, taxCardImageBackPreview,
    removeImage, openUploadDialog,
    storeLocation, getCurrentLocation, isGettingLocation, locationError, setShowMapPicker,
  } = props

  return (
    <>
      <PhoneVerification
        phoneNumber={sellerPhone}
        onPhoneChange={setSellerPhone}
        onVerified={setIsPhoneVerified}
        isVerified={isPhoneVerified}
        language={language}
        recaptchaId="recaptcha-container-seller"
        triggerSendOTP={triggerSendOTP}
        onOTPSent={(success, error) => {
          setTriggerSendOTP(false)
          if (!success && error) {
            setError(error)
          }
        }}
        onStepChange={setPhoneStep}
      />
      <div className="space-y-2">
        <Label htmlFor="register-storeName" className="text-base">
          {t("اسم المتجر", "Store Name")} <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="register-storeName"
            name="storeName"
            type="text"
            required
            placeholder={t("متجر الإلكترونيات", "Electronics Store")}
            className={`h-12 ${storeNameExists ? "border-red-500 focus:border-red-500" : ""}`}
            onChange={(e) => handleStoreNameChange(e.target.value)}
          />
          {isCheckingStoreName && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
        {storeNameExists && (
          <p className="text-xs text-red-500 mt-1">
            {t("اسم المتجر مسجل بالفعل. يرجى اختيار اسم آخر", "Store name is already taken. Please choose a different name")}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-storeDescription" className="text-base">
          {t("وصف المتجر", "Store Description")} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="register-storeDescription"
          name="storeDescription"
          required
          dir="auto"
          placeholder={t("وصف مختصر عن متجرك", "Brief description of your store")}
          className="min-h-[80px] resize-none"
          style={{ textAlign: isRTL ? "right" : "left", unicodeBidi: "plaintext" } as React.CSSProperties}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-storeType" className="text-base">
          {t("نوع المتجر", "Store Type")} <span className="text-red-500">*</span>
        </Label>
        <Select 
          name="storeType" 
          required
          value={selectedStoreType}
          onValueChange={(value) => {
            setSelectedStoreType(value)
          }}
        >
          <SelectTrigger id="register-storeType" className="h-12">
            <SelectValue placeholder={t("اختر نوع المتجر", "Choose store type")} />
          </SelectTrigger>
          <SelectContent>
            {isCategoriesLoading ? (
              <SelectItem value="_loading" disabled>{t("جاري التحميل...", "Loading...")}</SelectItem>
            ) : categories.length > 0 ? (
              categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))
            ) : (
              <SelectItem value="_empty" disabled>{t("لا توجد فئات", "No categories")}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      

      
      {/* Store Logo Upload */}
      <div className="space-y-2">
        <Label htmlFor="register-storeLogo" className="text-base">
          {t("لوجو المتجر", "Store Logo")} <span className="text-red-500">*</span>
        </Label>
        <div className="flex flex-col items-center gap-4">
          {storeLogoPreview ? (
            <div className="relative">
              <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                <Image
                  src={storeLogoPreview}
                  alt="Store Logo Preview"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removeStoreLogo}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              htmlFor="register-storeLogo"
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">{t("اضغط لرفع لوجو المتجر", "Click to upload store logo")}</span>
              <span className="text-xs text-gray-400 mt-1">{t("PNG, JPG حتى 2MB", "PNG, JPG up to 2MB")}</span>
            </label>
          )}
          <input
            id="register-storeLogo"
            name="storeLogo"
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            onChange={handleLogoChange}
            className="hidden"
          />
        </div>
      </div>
      
      {/* Owner ID Card Number */}
      <div className="space-y-2">
        <Label htmlFor="register-ownerIdNumber" className="text-base">
          {t("رقم بطاقة صاحب المتجر", "Store Owner ID Card Number")} 
        </Label>
        <Input
          id="register-ownerIdNumber"
          name="ownerIdNumber"
          type="text"
          dir="ltr"
          value={ownerIdNumber}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "")
            setOwnerIdNumber(val)
          }}
          placeholder="12345678901234"
          className={`h-12 ${ownerIdNumber.length > 0 && ownerIdNumber.length !== 14 ? "border-red-400" : ownerIdNumber.length === 14 ? "border-green-400" : ""}`}
          maxLength={14}
        />
        <p className={`text-xs ${ownerIdNumber.length > 0 && ownerIdNumber.length !== 14 ? "text-red-500" : "text-gray-500"}`}>
          {ownerIdNumber.length > 0
            ? t(`${ownerIdNumber.length}/14 رقم`, `${ownerIdNumber.length}/14 digits`)
            : t("أدخل الرقم القومي المكون من 14 رقم", "Enter the 14-digit national ID number")}
        </p>
      </div>
      
      {/* ID Card Images (Front & Back) */}
      <div className="space-y-3">
        <Label className="text-base">
          {t("صورة البطاقة (وجه وظهر)", "ID Card Images (Front & Back)")} <span className="text-red-500">(اختياري)</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Front */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium text-center">{t("الوجه", "Front")}</p>
            {idCardImageFrontPreview ? (
              <div className="relative">
                <div className="w-full h-28 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                  <Image src={idCardImageFrontPreview} alt="ID Card Front" width={200} height={112} className="w-full h-full object-cover" />
                </div>
                <button type="button" onClick={() => removeImage("idCardFront")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("idCardFront")} className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">{t("صورة الوجه", "Front side")}</span>
              </button>
            )}
          </div>
          {/* Back */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium text-center">{t("الظهر", "Back")}</p>
            {idCardImageBackPreview ? (
              <div className="relative">
                <div className="w-full h-28 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                  <Image src={idCardImageBackPreview} alt="ID Card Back" width={200} height={112} className="w-full h-full object-cover" />
                </div>
                <button type="button" onClick={() => removeImage("idCardBack")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("idCardBack")} className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">{t("صورة الظهر", "Back side")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Commercial Register Image (Optional) */}
      <div className="space-y-2">
        <Label className="text-base">
          {t("صورة السجل التجاري", "Commercial Register Image")}
          <span className="text-xs text-gray-400 mr-2">({t("اختياري", "Optional")})</span>
        </Label>
        <div className="flex flex-col items-center gap-3">
          {commercialRegisterImagePreview ? (
            <div className="relative w-full">
              <div className="w-full h-32 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                <Image src={commercialRegisterImagePreview} alt="Commercial Register" width={300} height={128} className="w-full h-full object-cover" />
              </div>
              <button type="button" onClick={() => removeImage("commercialRegister")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => openUploadDialog("commercialRegister")} className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
              <Upload className="h-8 w-8 text-gray-400 mb-1" />
              <span className="text-sm text-gray-500">{t("اضغط لرفع صورة أو فتح الكاميرا", "Click to upload or open camera")}</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Tax Card Images (Front & Back, Optional) */}
      <div className="space-y-3">
        <Label className="text-base">
          {t("صورة البطاقة الضريبية (وجه وظهر)", "Tax Card Images (Front & Back)")}
          <span className="text-xs text-gray-400 mr-2">({t("اختياري", "Optional")})</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Front */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium text-center">{t("الوجه", "Front")}</p>
            {taxCardImageFrontPreview ? (
              <div className="relative">
                <div className="w-full h-28 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                  <Image src={taxCardImageFrontPreview} alt="Tax Card Front" width={200} height={112} className="w-full h-full object-cover" />
                </div>
                <button type="button" onClick={() => removeImage("taxCardFront")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("taxCardFront")} className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">{t("صورة الوجه", "Front side")}</span>
              </button>
            )}
          </div>
          {/* Back */}
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium text-center">{t("الظهر", "Back")}</p>
            {taxCardImageBackPreview ? (
              <div className="relative">
                <div className="w-full h-28 rounded-xl overflow-hidden border-2 border-blue-200 shadow-md">
                  <Image src={taxCardImageBackPreview} alt="Tax Card Back" width={200} height={112} className="w-full h-full object-cover" />
                </div>
                <button type="button" onClick={() => removeImage("taxCardBack")} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("taxCardBack")} className="w-full h-28 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                <Upload className="h-6 w-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">{t("صورة الظهر", "Back side")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Store Location */}
      <div className="space-y-2">
        <Label className="text-base">
          {t("موقع المتجر (اختياري)", "Store Location (Optional)")}
        </Label>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="h-12 flex items-center justify-center gap-2"
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">{t("جاري...", "Getting...")}</span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs">{t("الموقع الحالي", "Current Location")}</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMapPicker(true)}
              className="h-12 flex items-center justify-center gap-2"
            >
              <Map className="h-4 w-4" />
              <span className="text-xs">{t("اختر من الخريطة", "Pick from Map")}</span>
            </Button>
          </div>
          
          {storeLocation && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">{t("تم تحديد الموقع بنجاح", "Location captured successfully")}</span>
              </div>
              <div className="mt-1 text-green-600 text-xs">
                Lat: {storeLocation.latitude.toFixed(6)}, Lng: {storeLocation.longitude.toFixed(6)}
              </div>
            </div>
          )}
          
          {locationError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {locationError}
            </div>
          )}
          
          <p className="text-xs text-gray-500">
            {t("يمكنك تحديد الموقع لاحقاً من إعدادات المتجر", "You can set location later from store settings")}
          </p>
        </div>
      </div>
    </>
  )
}
