"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { useLanguage } from "@/lib/language-context"
import { getFirebaseAuth, initRecaptchaVerifier, sendPhoneOTP, verifyPhoneOTP, clearPhoneAuth } from "@/lib/firebase/client"
import { getUserByPhone, resetUserPassword, generatePasswordResetToken } from "@/lib/actions/profile"
import { ArrowLeft, ArrowRight, CheckCircle2, Phone, Shield, Loader2, RefreshCw, Lock, Eye, EyeOff } from "lucide-react"

type Step = "phone" | "otp" | "new-password" | "success"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [resetToken, setResetToken] = useState("")
  const maxAttempts = 3

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPhoneAuth()
    }
  }, [])

  const handleCheckPhone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (!phone || phone.length < 10) {
      setError(t("يرجى إدخال رقم هاتف صحيح", "Please enter a valid phone number"))
      setIsLoading(false)
      return
    }

    try {
      // Check if phone exists in database
      const result = await getUserByPhone(phone)
      
      if (!result.success || result.error === "phone_not_found") {
        setError(t("رقم الهاتف غير مسجل في النظام", "Phone number is not registered"))
        setIsLoading(false)
        return
      }

      // Store user data for later
      setUserId(result.data!.id)
      setUserEmail(result.data!.email)

      // Initialize reCAPTCHA and send OTP
      initRecaptchaVerifier("recaptcha-container")
      const otpResult = await sendPhoneOTP(phone)

      if (otpResult.success) {
        setStep("otp")
        setCountdown(60)
        setAttempts(0)
      } else {
        setError(otpResult.error || t("فشل إرسال كود التحقق", "Failed to send verification code"))
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
        // Generate a server-side reset token to secure the password reset
        const tokenResult = await generatePasswordResetToken(userId)
        if (tokenResult.success && tokenResult.token) {
          setResetToken(tokenResult.token)
          setStep("new-password")
        } else {
          setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
        }
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
    setIsLoading(true)

    try {
      initRecaptchaVerifier("recaptcha-container")
      const result = await sendPhoneOTP(phone)

      if (result.success) {
        setCountdown(60)
      } else {
        setError(result.error || t("فشل إرسال كود التحقق", "Failed to send verification code"))
      }
    } catch (err: any) {
      setError(t("حدث خطأ. يرجى المحاولة مرة أخرى", "An error occurred. Please try again"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (newPassword.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"))
      setIsLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t("كلمات المرور غير متطابقة", "Passwords do not match"))
      setIsLoading(false)
      return
    }

    try {
      if (!userId) {
        setError(t("يرجى إعادة التحقق من رقم الهاتف", "Please re-verify your phone number"))
        setStep("phone")
        return
      }

      // Use server action with verified reset token to update the password
      const result = await resetUserPassword(userId, newPassword, resetToken)
      
      if (result.success) {
        setStep("success")
      } else {
        setError(result.error || t("فشل تغيير كلمة المرور. يرجى المحاولة مرة أخرى", "Failed to change password. Please try again"))
      }
    } catch (err: any) {
      console.error("[v0] Password reset error:", err)
      setError(t("فشل تغيير كلمة المرور. يرجى المحاولة مرة أخرى", "Failed to change password. Please try again"))
    } finally {
      setIsLoading(false)
    }
  }

  const renderPhoneStep = () => (
    <form onSubmit={handleCheckPhone} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-base">
          {t("رقم الهاتف", "Phone Number")}
        </Label>
        <div className="relative">
          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
            className="h-12 pr-10"
            dir="ltr"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-base font-semibold rounded-xl"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("جاري التحقق...", "Checking...")}
          </>
        ) : (
          t("إرسال كود التحقق", "Send Verification Code")
        )}
      </Button>

      <div className="text-center">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          {t("العودة إلى تسجيل الدخول", "Back to Login")}
        </Link>
      </div>

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container" />
    </form>
  )

  const renderOTPStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">
          {t("أدخل كود التحقق", "Enter Verification Code")}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t(`تم إرسال كود التحقق إلى ${phone}`, `Verification code sent to ${phone}`)}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm text-center">{error}</div>
      )}

      <div className="flex justify-center" dir="ltr">
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={setOtpCode}
          disabled={isLoading}
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

      <p className="text-sm text-gray-500 text-center">
        {t(`المحاولات المتبقية: ${maxAttempts - attempts}`, `Remaining attempts: ${maxAttempts - attempts}`)}
      </p>

      <Button
        type="button"
        onClick={handleVerifyOTP}
        disabled={isLoading || otpCode.length !== 6}
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl"
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
          onClick={() => {
            clearPhoneAuth()
            setStep("phone")
            setOtpCode("")
            setError("")
          }}
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

  const renderNewPasswordStep = () => (
    <form onSubmit={handleResetPassword} className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">
          {t("إنشاء كلمة مرور جديدة", "Create New Password")}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t("أدخل كلمة المرور الجديدة", "Enter your new password")}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-base">
          {t("كلمة المرور الجديدة", "New Password")}
        </Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-base">
          {t("تأكيد كلمة المرور", "Confirm Password")}
        </Label>
        <div className="relative">
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-base font-semibold rounded-xl"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("جاري التغيير...", "Changing...")}
          </>
        ) : (
          t("تغيير كلمة المرور", "Change Password")
        )}
      </Button>
    </form>
  )

  const renderSuccessStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <p className="text-center text-lg font-medium">
          {t("تم تغيير كلمة المرور بنجاح!", "Password Changed Successfully!")}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          {t(
            "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة",
            "You can now login with your new password",
          )}
        </p>
      </div>
      <Button 
        onClick={() => router.push("/auth")} 
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl"
      >
        {t("تسجيل الدخول", "Login")}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-md">
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="space-y-2 bg-gradient-to-r from-gray-50 to-white border-b">
              <CardTitle className="text-2xl text-center">
                {t("نسيت كلمة المرور؟", "Forgot Password?")}
              </CardTitle>
              <CardDescription className="text-center">
                {step === "phone" && t(
                  "أدخل رقم هاتفك المسجل وسنرسل لك كود التحقق",
                  "Enter your registered phone number and we'll send you a verification code",
                )}
                {step === "otp" && t(
                  "أدخل كود التحقق المرسل إلى هاتفك",
                  "Enter the verification code sent to your phone",
                )}
                {step === "new-password" && t(
                  "أنشئ كلمة مرور جديدة لحسابك",
                  "Create a new password for your account",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {step === "phone" && renderPhoneStep()}
              {step === "otp" && renderOTPStep()}
              {step === "new-password" && renderNewPasswordStep()}
              {step === "success" && renderSuccessStep()}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
