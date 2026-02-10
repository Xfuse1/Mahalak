"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp"
import { Phone, Shield, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { initRecaptchaVerifier, sendPhoneOTP, verifyPhoneOTP, clearPhoneAuth } from "@/lib/firebase/client"

interface PhoneVerificationProps {
  phoneNumber: string
  onPhoneChange: (phone: string) => void
  onVerified: (verified: boolean) => void
  isVerified: boolean
  disabled?: boolean
  language?: "ar" | "en"
  // New props for external control
  triggerSendOTP?: boolean // When true, triggers sending OTP
  onOTPSent?: (success: boolean, error?: string) => void // Callback when OTP is sent
  onStepChange?: (step: "phone" | "otp" | "verified") => void // Notify parent of step changes
}

export function PhoneVerification({
  phoneNumber,
  onPhoneChange,
  onVerified,
  isVerified,
  disabled = false,
  language = "ar",
  triggerSendOTP = false,
  onOTPSent,
  onStepChange,
}: PhoneVerificationProps) {
  const [step, setStep] = useState<"phone" | "otp" | "verified">(isVerified ? "verified" : "phone")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const maxAttempts = 3

  const t = useCallback(
    (ar: string, en: string) => (language === "ar" ? ar : en),
    [language]
  )

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Reset when phone number changes
  useEffect(() => {
    if (!isVerified) {
      setStep("phone")
      setOtpCode("")
      setError("")
      setAttempts(0)
    }
  }, [phoneNumber, isVerified])

  // Notify parent of step changes
  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])

  // Trigger OTP send from parent (when "Create Account" is clicked)
  useEffect(() => {
    if (triggerSendOTP && step === "phone" && !isLoading) {
      handleSendOTPExternal()
    }
  }, [triggerSendOTP])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPhoneAuth()
    }
  }, [])

  const handleSendOTPExternal = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      const errorMsg = t("يرجى إدخال رقم هاتف صحيح", "Please enter a valid phone number")
      setError(errorMsg)
      onOTPSent?.(false, errorMsg)
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Initialize reCAPTCHA
      initRecaptchaVerifier("recaptcha-container")

      // Send OTP
      const result = await sendPhoneOTP(phoneNumber)

      if (result.success) {
        setStep("otp")
        setCountdown(60)
        setAttempts(0)
        onOTPSent?.(true)
      } else {
        const errorMsg = result.error || t("فشل إرسال كود التحقق", "Failed to send verification code")
        setError(errorMsg)
        onOTPSent?.(false, errorMsg)
      }
    } catch (err: any) {
      const errorMsg = t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again")
      setError(errorMsg)
      onOTPSent?.(false, errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError(t("يرجى إدخال رقم هاتف صحيح", "Please enter a valid phone number"))
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Initialize reCAPTCHA
      initRecaptchaVerifier("recaptcha-container")

      // Send OTP
      const result = await sendPhoneOTP(phoneNumber)

      if (result.success) {
        setStep("otp")
        setCountdown(60) // 60 seconds before resend
        setAttempts(0)
      } else {
        setError(result.error || t("فشل إرسال كود التحقق", "Failed to send verification code"))
      }
    } catch (err: any) {
      setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      setError(t("يرجى إدخال كود التحقق المكون من 6 أرقام", "Please enter the 6-digit verification code"))
      return
    }

    if (attempts >= maxAttempts) {
      setError(t("تم تجاوز عدد المحاولات المسموحة", "Maximum attempts exceeded"))
      return
    }

    setIsLoading(true)
    setError("")
    setAttempts((prev) => prev + 1)

    try {
      const result = await verifyPhoneOTP(otpCode)

      if (result.success) {
        setStep("verified")
        onVerified(true)
      } else {
        setError(result.error || t("كود التحقق غير صحيح", "Invalid verification code"))
        if (attempts + 1 >= maxAttempts) {
          setError(t("تم تجاوز عدد المحاولات. يرجى طلب كود جديد", "Maximum attempts exceeded. Please request a new code"))
        }
      }
    } catch (err: any) {
      setError(t("حدث خطأ أثناء التحقق", "An error occurred during verification"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (countdown > 0) return

    setOtpCode("")
    setError("")
    setAttempts(0)
    await handleSendOTP()
  }

  const handleChangePhone = () => {
    clearPhoneAuth()
    setStep("phone")
    setOtpCode("")
    setError("")
    setAttempts(0)
    onVerified(false)
  }

  // Render verified state
  if (step === "verified" || isVerified) {
    return (
      <div className="space-y-2">
        <Label className="text-base font-medium text-gray-700">
          {t("رقم الهاتف", "Phone Number")}
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input
              type="tel"
              value={phoneNumber}
              disabled
              className="h-12 bg-green-50 border-green-200 pr-10"
            />
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChangePhone}
              className="h-12 px-4"
            >
              {t("تغيير", "Change")}
            </Button>
          )}
        </div>
        <p className="text-sm text-green-600 flex items-center gap-1">
          <Shield className="h-4 w-4" />
          {t("تم التحقق من رقم الهاتف", "Phone number verified")}
        </p>
      </div>
    )
  }

  // Render OTP input step
  if (step === "otp") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">
            {t("أدخل كود التحقق", "Enter Verification Code")}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t(`تم إرسال كود التحقق إلى ${phoneNumber}`, `Verification code sent to ${phoneNumber}`)}
          </p>
        </div>

        <div className="flex justify-center" dir="ltr">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            disabled={isLoading}
            autoComplete="one-time-code"
            textAlign="center"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="text-sm text-gray-500 text-center">
          {t(`المحاولات المتبقية: ${maxAttempts - attempts}`, `Remaining attempts: ${maxAttempts - attempts}`)}
        </p>

        <Button
          type="button"
          onClick={handleVerifyOTP}
          disabled={isLoading || otpCode.length !== 6}
          className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("جاري التحقق...", "Verifying...")}
            </>
          ) : (
            t("تأكيد الكود", "Verify Code")
          )}
        </Button>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleChangePhone}
            disabled={isLoading}
          >
            {t("تغيير الرقم", "Change Number")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResendOTP}
            disabled={isLoading || countdown > 0}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            {countdown > 0
              ? t(`إعادة الإرسال (${countdown}ث)`, `Resend (${countdown}s)`)
              : t("إعادة إرسال الكود", "Resend Code")}
          </Button>
        </div>

        {/* Hidden reCAPTCHA container */}
        <div id="recaptcha-container" />
      </div>
    )
  }

  // Render phone input step
  return (
    <div className="space-y-2">
      <Label htmlFor="phone-input" className="text-base font-medium text-gray-700">
        {t("رقم الهاتف", "Phone Number")}
      </Label>
      <div className="relative">
        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          id="phone-input"
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="01012345678"
          disabled={disabled || isLoading}
          className="h-12 pr-10"
          dir="ltr"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <p className="text-xs text-gray-500">
        {t("سيتم إرسال رسالة نصية تحتوي على كود التحقق", "A text message with verification code will be sent")}
      </p>

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container" />
    </div>
  )
}
