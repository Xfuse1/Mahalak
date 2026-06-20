"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { ArrowRight, CheckCircle2, Loader2, Phone, RefreshCw, Shield } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { clearPhoneAuth, getOTPStatus, sendPhoneOTP, verifyPhoneOTP } from "@/lib/firebase/client"
import { useAuth } from "@/lib/auth-context"
import { retrievePendingRegistration } from "@/lib/actions/profile"
import { normalizeEgyptPhone } from "@/lib/utils/phone"

const OTP_FLOW = "register" as const

export default function VerifyPhonePage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register } = useAuth()
  const isRTL = language === "ar"

  const phoneParam = searchParams.get("phone") || ""
  const role = (searchParams.get("role") || "customer") as "customer" | "seller"
  const returnUrl = searchParams.get("returnUrl") || (role === "seller" ? "/seller/dashboard" : "/")
  const roleEntryPath = role === "seller" ? "/auth/seller/register" : "/auth/register"
  const normalizedPhone = useMemo(() => normalizeEgyptPhone(phoneParam), [phoneParam])

  const [otpCode, setOtpCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  const [countdown, setCountdown] = useState(0)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [sessionLost, setSessionLost] = useState(false)
  const hasInitializedRef = useRef(false)

  const syncOtpState = () => {
    const status = getOTPStatus(OTP_FLOW)
    setAttemptsRemaining(status.attemptsRemaining)
    setCountdown(status.cooldownRemaining)
    setSessionLost(status.sessionLost)
    return status
  }

  const sendVerificationCode = async (phone: string, resent = false) => {
    setSendingOtp(true)
    setError("")

    try {
      const result = await sendPhoneOTP(phone, {
        flow: OTP_FLOW,
        containerId: "recaptcha-container",
      })

      if (!result.success) {
        setError(result.error || t("فشل إرسال كود التحقق", "Failed to send verification code"))
        syncOtpState()
        return false
      }

      setOtpSent(true)
      setOtpCode("")
      setSessionLost(false)
      syncOtpState()
      setSuccessMsg(
        resent
          ? t("تمت إعادة إرسال الكود بنجاح", "Code resent successfully")
          : t("تم إرسال كود التحقق بنجاح", "Verification code sent successfully"),
      )
      window.setTimeout(() => setSuccessMsg(""), 4000)
      return true
    } catch (sendError) {
      console.error("[auth/verify-phone] Send OTP error:", sendError)
      setError(t("حدث خطأ أثناء إرسال الكود", "An error occurred while sending the code"))
      return false
    } finally {
      setSendingOtp(false)
    }
  }

  useEffect(() => {
    if (!normalizedPhone) {
      setError(t("رقم الهاتف غير صالح", "Invalid phone number"))
      return
    }

    if (hasInitializedRef.current) {
      return
    }

    hasInitializedRef.current = true
    const status = syncOtpState()

    if (status.hasRequestedCode) {
      if (status.phone && status.phone !== normalizedPhone) {
        clearPhoneAuth(OTP_FLOW)
        void sendVerificationCode(normalizedPhone)
        return
      }

      setOtpSent(true)
      if (status.sessionLost) {
        setError(t("انتهت جلسة التحقق. أعد إرسال الكود للمتابعة.", "The verification session was lost. Resend the code to continue."))
      }
      return
    }

    void sendVerificationCode(normalizedPhone)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPhone, t])

  useEffect(() => {
    if (!otpSent) {
      return
    }

    syncOtpState()
    const timer = window.setInterval(() => {
      syncOtpState()
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [otpSent])

  useEffect(() => {
    if (!phoneParam) {
      router.push(roleEntryPath)
    }
  }, [phoneParam, roleEntryPath, router])

  const completeRegistration = async () => {
    const token = sessionStorage.getItem("pendingRegistrationToken")
    if (!token) {
      setError(t("بيانات التسجيل غير متاحة. أعد التسجيل مرة أخرى.", "Registration data is unavailable. Please register again."))
      return false
    }

    const pendingResult = await retrievePendingRegistration(token)
    if (!pendingResult.success || !pendingResult.data) {
      setError(t("انتهت صلاحية بيانات التسجيل. يرجى إعادة التسجيل", "Registration data expired. Please register again"))
      return false
    }

    const pendingData = pendingResult.data as Record<string, any>

    if (role === "customer") {
      return register(
        pendingData.email,
        pendingData.password,
        pendingData.name,
        "customer",
        undefined,
        pendingData.street,
        pendingData.city,
        pendingData.country,
        pendingData.phone,
        true,
      )
    }

    const storeAddress = [pendingData.street, pendingData.city, pendingData.country].filter(Boolean).join(", ")

    const sellerData = {
      phone: pendingData.phone,
      storeName: pendingData.storeName,
      storeDescription: pendingData.storeDescription,
      storeType: pendingData.storeType,
      storeTypeId: pendingData.storeTypeId || "",
      storeLogo: null as File | null,
      storeLogoUrl: pendingData.storeLogoUrl || null,
      address: storeAddress,
      latitude: pendingData.latitude,
      longitude: pendingData.longitude,
      ownerIdNumber: pendingData.ownerIdNumber || "",
      idCardImageUrl: pendingData.idCardImageUrl || null,
      idCardImageBackUrl: pendingData.idCardImageBackUrl || null,
      commercialRegisterImageUrl: pendingData.commercialRegisterImageUrl || null,
      taxCardImageUrl: pendingData.taxCardImageUrl || null,
      taxCardImageBackUrl: pendingData.taxCardImageBackUrl || null,
    }

    return register(
      pendingData.email,
      pendingData.password,
      pendingData.name,
      "seller",
      sellerData,
      pendingData.street,
      pendingData.city,
      pendingData.country,
      undefined,
      true,
    )
  }

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      setError(t("يرجى إدخال الكود كاملاً", "Please enter the complete code"))
      return
    }

    if (sessionLost) {
      setError(t("انتهت جلسة التحقق. أعد إرسال الكود أولاً.", "The verification session was lost. Please resend the code first."))
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await verifyPhoneOTP(otpCode, { flow: OTP_FLOW })
      syncOtpState()

      if (!result.success) {
        setSessionLost(Boolean(result.sessionLost))
        setError(result.error || t("الكود غير صحيح. حاول مرة أخرى", "Invalid code. Please try again"))
        return
      }

      setRegistering(true)
      const success = await completeRegistration()
      if (!success) {
        return
      }

      sessionStorage.removeItem("pendingRegistrationToken")
      clearPhoneAuth(OTP_FLOW)
      router.push(returnUrl)
    } catch (verifyError: any) {
      console.error("[auth/verify-phone] Verification error:", verifyError)
      const msg = verifyError?.message || ""
      if (msg.includes("already registered") || msg.includes("email-already-in-use")) {
        setError(t("البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول", "Email already registered. Please log in instead"))
      } else if (msg.includes("Failed to create store")) {
        setError(t("فشل إنشاء المتجر. يرجى المحاولة مرة أخرى", "Failed to create store. Please try again"))
      } else {
        setError(t("حدث خطأ. حاول مرة أخرى", "An error occurred. Please try again"))
      }

    } finally {
      setLoading(false)
      setRegistering(false)
    }
  }

  const handleResend = async () => {
    if (!normalizedPhone || countdown > 0) {
      return
    }

    await sendVerificationCode(normalizedPhone, true)
  }

  const handleChangeNumber = () => {
    clearPhoneAuth(OTP_FLOW)
    sessionStorage.removeItem("pendingRegistrationToken")
    router.push(roleEntryPath)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{t("أدخل كود التحقق", "Enter Verification Code")}</h1>
            <p className="text-gray-500 flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" />
              {t("تم إرسال كود التحقق إلى", "Verification code sent to")}
            </p>
            <p className="text-blue-600 font-bold text-lg mt-1" dir="ltr">
              {normalizedPhone || phoneParam}
            </p>
          </div>

          {sendingOtp && (
            <div className="flex items-center justify-center gap-2 mb-6 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("جاري إرسال كود التحقق...", "Sending verification code...")}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-green-600 text-sm">{successMsg}</p>
            </div>
          )}

          {sessionLost && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-amber-700 text-sm">
                {t("انتهت جلسة التحقق بعد تحديث الصفحة أو التنقل. أعد إرسال الكود للمتابعة.", "The verification session was lost after refresh/navigation. Resend the code to continue.")}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {registering && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-blue-600 text-sm">{t("جاري إنشاء الحساب...", "Creating account...")}</p>
            </div>
          )}

          <div className="flex justify-center mb-6" dir="ltr">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={(value) => {
                setOtpCode(value)
                setError("")
              }}
              disabled={loading || attemptsRemaining <= 0 || sendingOtp || sessionLost}
              autoComplete="one-time-code"
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot index={0} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
                <InputOTPSlot index={1} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
                <InputOTPSlot index={2} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
                <InputOTPSlot index={3} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
                <InputOTPSlot index={4} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
                <InputOTPSlot index={5} className="w-12 h-14 text-2xl font-bold border-2 rounded-xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <p className="text-center text-gray-500 text-sm mb-6">
            {t("المحاولات المتبقية:", "Remaining attempts:")} <span className="font-bold text-gray-700">{attemptsRemaining}</span>
          </p>

          <Button
            type="button"
            onClick={handleVerify}
            disabled={loading || otpCode.length !== 6 || attemptsRemaining <= 0 || sessionLost}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("جاري التحقق...", "Verifying...")}
              </div>
            ) : (
              <>
                {t("تأكيد الكود", "Verify Code")}
                <ArrowRight className={`h-5 w-5 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between mt-6 text-sm">
            <button type="button" onClick={handleChangeNumber} className="text-gray-500 hover:text-blue-600 transition-colors">
              {t("تغيير الرقم", "Change Number")}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || loading || sendingOtp}
              className={`flex items-center gap-1 ${countdown <= 0 ? "text-blue-600 hover:text-blue-700" : "text-gray-400"} transition-colors`}
            >
              <RefreshCw className={`h-4 w-4 ${loading || sendingOtp ? "animate-spin" : ""}`} />
              {countdown <= 0
                ? t("إعادة الإرسال", "Resend")
                : `${t("إعادة الإرسال", "Resend")} (${countdown}${t("ث", "s")})`}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t text-center">
            <Link href={roleEntryPath} className="text-gray-500 hover:text-blue-600 text-sm transition-colors">
              {t("العودة لصفحة التسجيل", "Back to Sign Up")}
            </Link>
          </div>

          <div id="recaptcha-container" />
        </CardContent>
      </Card>
    </div>
  )
}
