"use client"

import type React from "react"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { Loader2, Upload, X } from "lucide-react"
import Image from "next/image"
import dynamic from "next/dynamic"

const PhoneVerification = dynamic(
  () => import("../phone-verification").then((m) => ({ default: m.PhoneVerification })),
  { ssr: false, loading: () => <div className="flex items-center justify-center p-4">جاري التحميل...</div> },
)

export interface CategoryItem {
  id: string
  name: string
}

interface SellerFieldsProps {
  t: (ar: string, en: string) => string
  isRTL: boolean
  language: "ar" | "en"
  categories: CategoryItem[]
  isCategoriesLoading: boolean
  sellerPhone: string
  setSellerPhone: (phone: string) => void
  handleStoreNameChange: (value: string) => void
  isCheckingStoreName: boolean
  storeNameExists: boolean
  selectedStoreType: string
  setSelectedStoreType: (type: string) => void
  selectedStoreTypeId: string
  setSelectedStoreTypeId: (id: string) => void
  storeLogoPreview: string | null
  handleLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  removeStoreLogo: () => void
  ownerIdNumber: string
  setOwnerIdNumber: (id: string) => void
  idCardImageFrontPreview: string | null
  idCardImageBackPreview: string | null
  commercialRegisterImagePreview: string | null
  taxCardImageFrontPreview: string | null
  taxCardImageBackPreview: string | null
  removeImage: (target: string) => void
  openUploadDialog: (target: string) => void
  storeLocation: { latitude: number; longitude: number } | null
  getCurrentLocation: () => void
  isGettingLocation: boolean
  locationError: string | null
  setShowMapPicker: (show: boolean) => void
}

export function SellerFields(props: SellerFieldsProps) {
  const {
    t,
    isRTL,
    language,
    categories,
    isCategoriesLoading,
    sellerPhone,
    setSellerPhone,
    handleStoreNameChange,
    isCheckingStoreName,
    storeNameExists,
    setSelectedStoreType,
    selectedStoreTypeId,
    setSelectedStoreTypeId,
    storeLogoPreview,
    handleLogoChange,
    removeStoreLogo,
    idCardImageFrontPreview,
    idCardImageBackPreview,
    commercialRegisterImagePreview,
    taxCardImageFrontPreview,
    taxCardImageBackPreview,
    removeImage,
    openUploadDialog,
    storeLocation,
    getCurrentLocation,
    isGettingLocation,
    locationError,
    setShowMapPicker,
  } = props

  const fieldClassName =
    "h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20 sm:h-14"
  const uploadTileClassName =
    "w-full rounded-2xl border border-dashed border-slate-200 bg-white transition shadow-[0_8px_24px_rgba(15,23,42,0.04)] hover:border-primary/50 hover:bg-primary/10"

  return (
    <div className="space-y-6">
      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-3 md:p-5">
        <div className="mb-4">
          <h4 className="text-base font-black text-slate-900 md:text-lg">{t("بيانات المتجر الأساسية", "Store Basics")}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {t("ابدأ برقم الهاتف وبيانات المتجر الرئيسية بشكل واضح ومنظم.", "Start with the phone number and the main store details in a cleaner flow.")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <PhoneVerification
              phoneNumber={sellerPhone}
              onPhoneChange={setSellerPhone}
              onVerified={() => undefined}
              isVerified={false}
              language={language}
              mode="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="register-storeName" className="text-sm font-semibold text-slate-700">
                {t("اسم المتجر", "Store Name")} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="register-storeName"
                  name="storeName"
                  type="text"
                  required
                  placeholder={t("متجر الإلكترونيات", "Electronics Store")}
                  className={`${fieldClassName} ${storeNameExists ? "border-red-400 focus:border-red-400" : ""}`}
                  onChange={(e) => handleStoreNameChange(e.target.value)}
                />
                {isCheckingStoreName && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {storeNameExists && (
                <p className="mt-1 text-xs text-red-500">
                  {t("اسم المتجر مسجل بالفعل. يرجى اختيار اسم آخر", "Store name is already taken. Please choose a different name")}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="register-storeDescription" className="text-sm font-semibold text-slate-700">
                {t("وصف المتجر", "Store Description")} <span className="text-slate-400">{t("(اختياري)", "(Optional)")}</span>
              </Label>
              <Textarea
                id="register-storeDescription"
                name="storeDescription"
                dir="auto"
                placeholder={t("وصف مختصر عن متجرك", "Brief description of your store")}
                className="min-h-[110px] resize-none rounded-2xl border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.04)] placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-primary/20"
                style={{ textAlign: isRTL ? "right" : "left", unicodeBidi: "plaintext" } as React.CSSProperties}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-storeType" className="text-sm font-semibold text-slate-700">
                {t("نوع المتجر", "Store Type")} <span className="text-red-500">*</span>
              </Label>
              <Select
                name="storeType"
                required
                value={selectedStoreTypeId}
                onValueChange={(value) => {
                  const category = categories.find((item) => item.id === value)
                  setSelectedStoreType(category?.name || value)
                  setSelectedStoreTypeId(value)
                }}
              >
                <SelectTrigger id="register-storeType" className={fieldClassName}>
                  <SelectValue placeholder={t("اختر نوع المتجر", "Choose store type")} />
                </SelectTrigger>
                <SelectContent>
                  {isCategoriesLoading ? (
                    <SelectItem value="_loading" disabled>
                      {t("جاري التحميل...", "Loading...")}
                    </SelectItem>
                  ) : categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_empty" disabled>
                      {t("لا توجد فئات", "No categories")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-storeLogo" className="text-sm font-semibold text-slate-700">
                {t("شعار المتجر", "Store Logo")} <span className="text-slate-400">{t("(اختياري)", "(Optional)")}</span>
              </Label>
              <div className="flex min-h-[112px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                {storeLogoPreview ? (
                  <div className="relative">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-sm">
                      <Image src={storeLogoPreview} alt="Store Logo Preview" width={96} height={96} className="h-full w-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={removeStoreLogo}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="register-storeLogo" className={`${uploadTileClassName} flex h-24 cursor-pointer flex-col items-center justify-center`}>
                    <Upload className="mb-1 h-6 w-6 text-slate-500" />
                    <span className="text-xs font-medium text-slate-700">{t("رفع شعار المتجر", "Upload store logo")}</span>
                    <span className="mt-1 text-[11px] text-slate-500">{t("PNG, JPG, WebP حتى 5MB", "PNG, JPG, WebP up to 5MB")}</span>
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
          </div>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-3 md:p-5">
        <div className="mb-4">
          <h4 className="text-base font-black text-slate-900 md:text-lg">{t("موقع المتجر", "Store Location")}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {t("اختر موقع متجرك لتسهيل ظهور العنوان بدقة.", "Set your store location for more accurate address details.")}
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 md:p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGettingLocation ? t("جارٍ تحديد الموقع...", "Getting location...") : t("تحديد موقعي الحالي", "Use current location")}
            </button>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary/50 hover:text-primary"
            >
              {t("اختيار الموقع من الخريطة", "Pick location from map")}
            </button>
          </div>

          {storeLocation && (
            <p className="text-xs text-slate-600 sm:text-sm">
              {t("تم تحديد الموقع بنجاح", "Location selected successfully")}: {storeLocation.latitude.toFixed(6)}, {storeLocation.longitude.toFixed(6)}
            </p>
          )}

          {locationError && <p className="text-xs text-red-500 sm:text-sm">{locationError}</p>}
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-3 md:p-5">
        <div className="mb-4">
          <h4 className="text-base font-black text-slate-900 md:text-lg">{t("الوثائق المطلوبة", "Required Documents")}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {t("ارفع الصور بوضوح. على الموبايل تظهر في عمود واحد وعلى الشاشات الكبيرة في عمودين.", "Upload clear images. They appear in one column on mobile and two columns on larger screens.")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">{t("صورة البطاقة (الوجه الأمامي)", "ID Card (Front)")}</Label>
            {idCardImageFrontPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative h-44 w-full overflow-hidden rounded-xl">
                  <Image src={idCardImageFrontPreview} alt="ID front preview" fill className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage("idCardFront")}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("idCardFront")} className={`${uploadTileClassName} flex h-32 w-full flex-col items-center justify-center`}>
                <Upload className="mb-1 h-6 w-6 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{t("رفع الوجه الأمامي", "Upload front side")}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">{t("صورة البطاقة (الوجه الخلفي)", "ID Card (Back)")}</Label>
            {idCardImageBackPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative h-44 w-full overflow-hidden rounded-xl">
                  <Image src={idCardImageBackPreview} alt="ID back preview" fill className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage("idCardBack")}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("idCardBack")} className={`${uploadTileClassName} flex h-32 w-full flex-col items-center justify-center`}>
                <Upload className="mb-1 h-6 w-6 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{t("رفع الوجه الخلفي", "Upload back side")}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">{t("صورة السجل التجاري", "Commercial Register")}</Label>
            {commercialRegisterImagePreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative h-44 w-full overflow-hidden rounded-xl">
                  <Image src={commercialRegisterImagePreview} alt="Commercial register preview" fill className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage("commercialRegister")}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("commercialRegister")} className={`${uploadTileClassName} flex h-32 w-full flex-col items-center justify-center`}>
                <Upload className="mb-1 h-6 w-6 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{t("رفع السجل التجاري", "Upload commercial register")}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">{t("صورة البطاقة الضريبية (الوجه الأمامي)", "Tax Card (Front)")}</Label>
            {taxCardImageFrontPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative h-44 w-full overflow-hidden rounded-xl">
                  <Image src={taxCardImageFrontPreview} alt="Tax card front preview" fill className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage("taxCardFront")}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("taxCardFront")} className={`${uploadTileClassName} flex h-32 w-full flex-col items-center justify-center`}>
                <Upload className="mb-1 h-6 w-6 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{t("رفع البطاقة الضريبية (أمامي)", "Upload tax card front")}</span>
              </button>
            )}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label className="text-sm font-semibold text-slate-700">{t("صورة البطاقة الضريبية (الوجه الخلفي)", "Tax Card (Back)")}</Label>
            {taxCardImageBackPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative h-44 w-full overflow-hidden rounded-xl">
                  <Image src={taxCardImageBackPreview} alt="Tax card back preview" fill className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage("taxCardBack")}
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => openUploadDialog("taxCardBack")} className={`${uploadTileClassName} flex h-32 w-full flex-col items-center justify-center`}>
                <Upload className="mb-1 h-6 w-6 text-slate-500" />
                <span className="text-xs font-medium text-slate-700">{t("رفع البطاقة الضريبية (خلفي)", "Upload tax card back")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
