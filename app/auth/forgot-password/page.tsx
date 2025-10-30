"use client"

import type React from "react"
import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"

type AccountType = "customer" | "seller"
type View = "selection" | "login" | "register"

export default function AuthPage() {
  const { t } = useLanguage()
  const [view, setView] = useState<View>("selection")
  const [accountType, setAccountType] = useState<AccountType>("customer")
  const [error, setError] = useState("")

  // State for registration form
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("") // ← حقل العنوان المضاف
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // State for login form
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const handleAccountTypeSelect = (type: AccountType) => {
    setAccountType(type)
    setError("")
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // التحقق من صحة البيانات
    if (!fullName || !email || !password || !confirmPassword) {
      setError(t("الرجاء ملء جميع الحقول المطلوبة", "Please fill all required fields"))
      return
    }

    if (password !== confirmPassword) {
      setError(t("كلمتا المرور غير متطابقتين", "Passwords do not match"))
      return
    }

    if (password.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters"))
      return
    }

    // هنا يمكنك إضافة منطق تسجيل الحساب
    console.log("Registering:", { fullName, email, address, password, accountType })
    
    // محاكاة نجاح التسجيل
    alert(t("تم إنشاء الحساب بنجاح", "Account created successfully"))
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!loginEmail || !loginPassword) {
      setError(t("الرجاء إدخال البريد الإلكتروني وكلمة المرور", "Please enter email and password"))
      return
    }

    // هنا يمكنك إضافة منطق تسجيل الدخول
    console.log("Logging in:", { loginEmail, loginPassword, accountType })
  }

  const renderSelectionView = () => (
    <div className="space-y-6">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl text-center">{t("سجل دخولك كعميل", "Login as Customer")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">{t("نوع الحساب", "Account Type")}</Label>
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              variant={accountType === "customer" ? "default" : "outline"}
              className={`h-12 ${accountType === "customer" ? "bg-[#1F478B] hover:bg-[#1a3a70]" : ""}`}
              onClick={() => handleAccountTypeSelect("customer")}
            >
              {t("عميل", "Customer")}
            </Button>
            <Button
              type="button"
              variant={accountType === "seller" ? "default" : "outline"}
              className={`h-12 ${accountType === "seller" ? "bg-[#1F478B] hover:bg-[#1a3a70]" : ""}`}
              onClick={() => handleAccountTypeSelect("seller")}
            >
              {t("بائع", "Seller")}
            </Button>
          </div>
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {t("نوع الحساب غير صحيح، يرجى اختيار النوع الصحيح", "Invalid account type, please select correct type")}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button 
            className="h-12 bg-[#1F478B] hover:bg-[#1a3a70]"
            onClick={() => setView("register")}
          >
            {t("إنشاء حساب", "Create Account")}
          </Button>
          <Button 
            variant="outline" 
            className="h-12"
            onClick={() => setView("login")}
          >
            {t("تسجيل الدخول", "Login")}
          </Button>
        </div>
      </CardContent>
    </div>
  )

  const renderRegisterView = () => (
    <div className="space-y-6">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl text-center">
          {t("إنشاء حساب", "Create Account")} {accountType === "customer" ? t("كعميل", "as Customer") : t("كبائع", "as Seller")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-base">
              {t("الاسم الكامل", "Full Name")} *
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder={t("أحمد محمد", "Ahmed Mohamed")}
              required
              className="h-12"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              {t("البريد الإلكتروني", "Email")} *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              required
              className="h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* حقل العنوان المضاف */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-base">
              {t("العنوان", "Address")}
            </Label>
            <Input
              id="address"
              type="text"
              placeholder={t("أدخل عنوانك الكامل", "Enter your full address")}
              className="h-12"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              {t("كلمة المرور", "Password")} *
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              required
              className="h-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-base">
              {t("تأكيد كلمة المرور", "Confirm Password")} *
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••"
              required
              className="h-12"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold">
            {t("إنشاء حساب", "Create Account")}
          </Button>

          <Button 
            type="button" 
            variant="link" 
            className="w-full"
            onClick={() => setView("selection")}
          >
            {t("العودة إلى اختيار نوع الحساب", "Back to Account Type Selection")}
          </Button>
        </form>
      </CardContent>
    </div>
  )

  const renderLoginView = () => (
    <div className="space-y-6">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl text-center">
          {t("تسجيل الدخول", "Login")} {accountType === "customer" ? t("كعميل", "as Customer") : t("كبائع", "as Seller")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="loginEmail" className="text-base">
              {t("البريد الإلكتروني", "Email")}
            </Label>
            <Input
              id="loginEmail"
              type="email"
              placeholder="example@email.com"
              required
              className="h-12"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loginPassword" className="text-base">
              {t("كلمة المرور", "Password")}
            </Label>
            <Input
              id="loginPassword"
              type="password"
              placeholder="••••••"
              required
              className="h-12"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </div>

          <div className="text-right">
            <Button variant="link" className="p-0 h-auto" asChild>
              <Link href="/auth/forgot-password">
                {t("نسيت كلمة المرور؟", "Forgot Password?")}
              </Link>
            </Button>
          </div>

          <Button type="submit" className="w-full h-12 bg-[#1F478B] hover:bg-[#1a3a70] text-base font-semibold">
            {t("تسجيل الدخول", "Login")}
          </Button>

          <Button 
            type="button" 
            variant="link" 
            className="w-full"
            onClick={() => setView("selection")}
          >
            {t("العودة إلى اختيار نوع الحساب", "Back to Account Type Selection")}
          </Button>
        </form>
      </CardContent>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12 bg-secondary">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            {view === "selection" && renderSelectionView()}
            {view === "register" && renderRegisterView()}
            {view === "login" && renderLoginView()}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}