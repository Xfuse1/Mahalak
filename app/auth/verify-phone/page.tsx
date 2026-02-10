"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Shield, ArrowRight, RefreshCw, Phone, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { verifyPhoneOTP, sendPhoneOTP } from "@/lib/firebase/client"
import { useAuth } from "@/lib/auth-context"
import Link from "next/link"

export default function VerifyPhonePage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register } = useAuth()
  const isRTL = language === "ar"

  const phone = searchParams.get("phone") || ""
  const role = searchParams.get("role") || "customer"
  const returnUrl = searchParams.get("returnUrl") || (role === "seller" ? "/seller/dashboard" : "/")
  const mode = searchParams.get("mode") || "register"

  const [otpCode, setOtpCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")
  const [attempts, setAttempts] = useState(3)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const otpSendingRef = useRef(false)

  // Send OTP when page loads
  useEffect(() => {
    const sendInitialOTP = async () => {
      if (!phone || otpSendingRef.current) return
      otpSendingRef.current = true

      setSendingOtp(true)
      try {
        const result = await sendPhoneOTP(phone)
        if (result.success) {
          setOtpSent(true)
          console.log("[v0] OTP sent from verify-phone page")
        } else {
          setError(result.error || "فشل إرسال كود التحقق")
          otpSendingRef.current = false
        }
      } catch (err) {
        setError("حدث خطأ أثناء إرسال الكود")
        otpSendingRef.current = false
      } finally {
        setSendingOtp(false)
      }
    }

    sendInitialOTP()
  }, [phone])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  // Redirect if no phone
  useEffect(() => {
    if (!phone) {
      router.push("/auth")
    }
  }, [phone, router])

  // Auto-verify when 6 digits are entered
  useEffect(() => {
    if (otpCode.length === 6 && !loading) {
      handleVerify(otpCode)
    }
  }, [otpCode])

  const handleVerify = async (code?: string) => {
    const verifyCode = code || otpCode
    if (verifyCode.length !== 6) {
      setError(t("يرجى إدخال الكود كاملاً", "Please enter the complete code"))
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await verifyPhoneOTP(verifyCode)
      if (result.success) {
        // Customer registration
        if (mode === "register" && role === "customer") {
          const pendingDataStr = sessionStorage.getItem("pendingCustomerData")
          if (pendingDataStr) {
            setRegistering(true)
            const pendingData = JSON.parse(pendingDataStr)

            const success = await register(
              pendingData.email,
              pendingData.password,
              pendingData.name,
              "customer",
              undefined,
              pendingData.street,
              pendingData.city,
              pendingData.country,
              pendingData.phone
            )

            if (success) {
              sessionStorage.removeItem("pendingCustomerData")
              router.push(returnUrl)
            } else {
              setError(t("فشل إنشاء الحساب. حاول مرة أخرى", "Failed to create account. Please try again"))
            }
            setRegistering(false)
            return
          }
        }

        // Seller registration
        if (mode === "register" && role === "seller") {
          const pendingDataStr = sessionStorage.getItem("pendingSellerData")
          if (pendingDataStr) {
            setRegistering(true)
            const pendingData = JSON.parse(pendingDataStr)

            const storeAddress = [pendingData.street, pendingData.city, pendingData.country].filter(Boolean).join(", ")

            const sellerData = {
              phone: pendingData.phone,
              storeName: pendingData.storeName,
              storeDescription: pendingData.storeDescription,
              storeType: pendingData.storeType,
              storeLogo: null as File | null,
              storeLogoUrl: pendingData.storeLogoUrl || null,
              address: storeAddress,
              latitude: pendingData.latitude,
              longitude: pendingData.longitude,
              ownerIdNumber: pendingData.ownerIdNumber || "",
              idCardImageUrl: pendingData.idCardImageUrl || null,
              commercialRegisterImageUrl: pendingData.commercialRegisterImageUrl || null,
              taxCardImageUrl: pendingData.taxCardImageUrl || null,
            }

            const success = await register(
              pendingData.email,
              pendingData.password,
              pendingData.name,
              "seller",
              sellerData,
              pendingData.street,
              pendingData.city,
              pendingData.country
            )

            if (success) {
              sessionStorage.removeItem("pendingSellerData")
              router.push(returnUrl)
            } else {
              setError(t("فشل إنشاء الحساب. حاول مرة أخرى", "Failed to create account. Please try again"))
            }
            setRegistering(false)
            return
          }
        }

        // Other modes
        sessionStorage.removeItem("pendingSellerData")
        router.push(returnUrl)
      } else {
        setAttempts((prev) => prev - 1)
        if (attempts <= 1) {
          setError(t("انتهت المحاولات. يرجى طلب كود جديد", "No attempts left. Please request a new code"))
        } else {
          setError(t("الكود غير صحيح. حاول مرة أخرى", "Invalid code. Please try again"))
        }
      }
    } catch (err: any) {
      console.error("[v0] Verification error:", err)
      setAttempts((prev) => prev - 1)
      setError(t("حدث خطأ. حاول مرة أخرى", "An error occurred. Please try again"))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return

    setLoading(true)
    setError("")

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+2${phone}`
      otpSendingRef.current = false
      const result = await sendPhoneOTP(formattedPhone)

      if (result.success) {
        setCountdown(60)
        setCanResend(false)
        setAttempts(3)
        setOtpCode("")
      } else {
        setError(t("فشل إعادة إرسال الكود", "Failed to resend code"))
      }
    } catch (err) {
      setError(t("حدث خطأ أثناء إعادة الإرسال", "Error resending code"))
    } finally {
      setLoading(false)
    }
  }

  const handleChangeNumber = () => {
    router.push(`/auth?role=${role}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {t("أدخل كود التحقق", "Enter Verification Code")}
            </h1>
            <p className="text-gray-500 flex items-center justify-center gap-2">
              <Phone className="h-4 w-4" />
              {t("تم إرسال كود التحقق إلى", "Verification code sent to")}
            </p>
            <p className="text-blue-600 font-bold text-lg mt-1" dir="ltr">{phone}</p>
          </div>

          {/* Sending OTP indicator */}
          {sendingOtp && (
            <div className="flex items-center justify-center gap-2 mb-6 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("جاري إرسال كود التحقق...", "Sending verification code...")}</span>
            </div>
          )}

          {/* OTP Input using InputOTP component */}
          <div className="flex justify-center mb-6" dir="ltr">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={(value) => {
                setOtpCode(value)
                setError("")
              }}
              disabled={loading || attempts <= 0 || sendingOtp}
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Registration in progress */}
          {registering && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-blue-600 text-sm">{t("جاري إنشاء الحساب...", "Creating account...")}</p>
            </div>
          )}

          {/* Attempts Counter */}
          <p className="text-center text-gray-500 text-sm mb-6">
            {t("المحاولات المتبقية:", "Remaining attempts:")} <span className="font-bold text-gray-700">{attempts}</span>
          </p>

          {/* Verify Button */}
          <Button
            type="button"
            onClick={() => handleVerify()}
            disabled={loading || otpCode.length !== 6 || attempts <= 0}
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

          {/* Resend & Change Number */}
          <div className="flex items-center justify-between mt-6 text-sm">
            <button
              type="button"
              onClick={handleChangeNumber}
              className="text-gray-500 hover:text-blue-600 transition-colors"
            >
              {t("تغيير الرقم", "Change Number")}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={!canResend || loading}
              className={`flex items-center gap-1 ${canResend ? "text-blue-600 hover:text-blue-700" : "text-gray-400"} transition-colors`}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {canResend
                ? t("إعادة الإرسال", "Resend")
                : `${t("إعادة الإرسال", "Resend")} (${countdown}${t("ث", "s")})`}
            </button>
          </div>

          {/* Back to Login */}
          <div className="mt-8 pt-6 border-t text-center">
            <Link
              href="/auth"
              className="text-gray-500 hover:text-blue-600 text-sm transition-colors"
            >
              {t("العودة لصفحة التسجيل", "Back to Sign Up")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
