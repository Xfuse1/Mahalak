"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp"
import { Phone, Shield, CheckCircle2, Loader2, RefreshCw, AlertTriangle } from "lucide-react"
import {
  clearPhoneAuth,
  getOTPStatus,
  sendPhoneOTP,
  type OTPFlow,
  verifyPhoneOTP,
} from "@/lib/firebase/client"

interface PhoneVerificationProps {
  phoneNumber: string
  onPhoneChange: (phone: string) => void
  onVerified: (verified: boolean) => void
  isVerified: boolean
  disabled?: boolean
  language?: "ar" | "en"
  recaptchaId?: string
  flow?: OTPFlow
  mode?: "input" | "inline"
}

export function PhoneVerification({
  phoneNumber,
  onPhoneChange,
  onVerified,
  isVerified,
  disabled = false,
  language = "ar",
  recaptchaId = "recaptcha-container",
  flow = "other",
  mode = "inline",
}: PhoneVerificationProps) {
  const [step, setStep] = useState<"phone" | "otp" | "verified">(isVerified ? "verified" : "phone")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  const [sessionLost, setSessionLost] = useState(false)

  const t = useCallback(
    (ar: string, en: string) => (language === "ar" ? ar : en),
    [language],
  )

  const syncStatus = useCallback(() => {
    const status = getOTPStatus(flow)
    setCountdown(status.cooldownRemaining)
    setAttemptsRemaining(status.attemptsRemaining)
    setSessionLost(status.sessionLost)

    if (mode === "inline" && status.hasRequestedCode && !isVerified) {
      setStep("otp")
    }
  }, [flow, isVerified, mode])

  useEffect(() => {
    syncStatus()
  }, [syncStatus])

  useEffect(() => {
    if (countdown <= 0) {
      return
    }

    const timer = setTimeout(() => {
      syncStatus()
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, syncStatus])

  useEffect(() => {
    if (isVerified) {
      setStep("verified")
      return
    }

    if (mode === "input") {
      setStep("phone")
      setOtpCode("")
      setError("")
      setSuccessMsg("")
      setSessionLost(false)
      setAttemptsRemaining(3)
      setCountdown(0)
      return
    }

    clearPhoneAuth(flow)
    setStep("phone")
    setOtpCode("")
    setError("")
    setSuccessMsg("")
    setSessionLost(false)
    setAttemptsRemaining(3)
    setCountdown(0)
  }, [phoneNumber, isVerified, mode, flow])

  useEffect(() => {
    if (mode === "input") return
    return () => {
      clearPhoneAuth(flow)
    }
  }, [flow, mode])

  const handleSendOTP = async () => {
    setIsLoading(true)
    setError("")
    setSuccessMsg("")
    setSessionLost(false)

    try {
      const result = await sendPhoneOTP(phoneNumber, { containerId: recaptchaId, flow })

      if (result.success) {
        const status = getOTPStatus(flow)
        setStep("otp")
        setCountdown(result.cooldown ?? status.cooldownRemaining)
        setAttemptsRemaining(result.attemptsRemaining ?? status.attemptsRemaining)
        setSuccessMsg(t("تم إرسال كود التحقق بنجاح", "Verification code sent successfully"))
        setTimeout(() => setSuccessMsg(""), 4000)
      } else {
        setCountdown(result.cooldown ?? 0)
        setAttemptsRemaining(result.attemptsRemaining ?? 3)
        setSessionLost(Boolean(result.sessionLost))
        setError(result.error || t("فشل إرسال كود التحقق", "Failed to send verification code"))
      }
    } catch {
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

    if (attemptsRemaining <= 0) {
      setError(t("تم تجاوز عدد المحاولات. يرجى طلب كود جديد", "Maximum attempts exceeded. Please request a new code"))
      return
    }

    setIsLoading(true)
    setError("")
    setSuccessMsg("")

    try {
      const result = await verifyPhoneOTP(otpCode, { flow })

      if (result.success) {
        setStep("verified")
        setSessionLost(false)
        setAttemptsRemaining(3)
        onVerified(true)
      } else {
        setAttemptsRemaining(result.attemptsRemaining ?? attemptsRemaining)
        setSessionLost(Boolean(result.sessionLost))
        setError(result.error || t("كود التحقق غير صحيح", "Invalid verification code"))
      }
    } catch {
      setError(t("حدث خطأ أثناء التحقق", "An error occurred during verification"))
    } finally {
      syncStatus()
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (countdown > 0) {
      return
    }

    setOtpCode("")
    await handleSendOTP()
  }

  const handleChangePhone = () => {
    clearPhoneAuth(flow)
    setStep("phone")
    setOtpCode("")
    setError("")
    setSuccessMsg("")
    setSessionLost(false)
    setAttemptsRemaining(3)
    setCountdown(0)
    onVerified(false)
  }

  if (step === "verified" || isVerified) {
    return (
      <div className="space-y-2">
        <Label className="text-base font-medium text-gray-700">
          {t("رقم الهاتف", "Phone Number")}
        </Label>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input type="tel" value={phoneNumber} disabled className="h-12 bg-green-50 border-green-200 pr-10" />
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
          </div>
          {!disabled && (
            <Button type="button" variant="outline" size="sm" onClick={handleChangePhone} className="h-12 px-4">
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

  if (mode === "input") {
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-gray-500">
          {t("سيتم إرسال كود التحقق في الخطوة التالية", "The verification code will be sent in the next step")}
        </p>
      </div>
    )
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">{t("أدخل كود التحقق", "Enter Verification Code")}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {t(`تم إرسال كود التحقق إلى ${phoneNumber}`, `Verification code sent to ${phoneNumber}`)}
          </p>
        </div>

        <div className="flex justify-center" dir="ltr">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} disabled={isLoading || sessionLost} autoComplete="one-time-code">
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

        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <p className="text-sm text-green-600 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              {successMsg}
            </p>
          </div>
        )}

        {sessionLost && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <p className="text-sm text-amber-700 flex items-center justify-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {t("انتهت جلسة التحقق محلياً. يرجى إعادة إرسال الكود", "Verification session was lost locally. Please resend the code")}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        {attemptsRemaining <= 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <p className="text-sm text-amber-700 flex items-center justify-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {t("تم تجاوز عدد المحاولات. يرجى طلب كود جديد", "Max attempts reached. Please request a new code")}
            </p>
          </div>
        )}

        <p className="text-sm text-gray-500 text-center">
          {t(`المحاولات المتبقية: ${attemptsRemaining}`, `Remaining attempts: ${attemptsRemaining}`)}
        </p>

        <Button
          type="button"
          onClick={handleVerifyOTP}
          disabled={isLoading || otpCode.length !== 6 || attemptsRemaining <= 0 || sessionLost}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("جاري التحقق...", "Verifying...")}
            </>
          ) : (
            t("تأكيد الكود", "Verify Code")
          )}
        </Button>

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleChangePhone} disabled={isLoading}>
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

        <div id={recaptchaId} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={handleSendOTP} disabled={disabled || isLoading} className="w-full h-12">
        {isLoading ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {t("جاري الإرسال...", "Sending...")}
          </>
        ) : (
          t("إرسال كود التحقق", "Send Verification Code")
        )}
      </Button>

      <p className="text-xs text-gray-500">
        {t("سيتم إرسال رسالة نصية تحتوي على كود التحقق", "A text message with verification code will be sent")}
      </p>

      <div id={recaptchaId} />
    </div>
  )
}
