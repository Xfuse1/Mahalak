"use client"

import type React from "react"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { EyeOpenIcon, EyeOffIcon } from "../ui/icons"
import Link from "next/link"

interface LoginFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  showPassword: boolean
  setShowPassword: (show: boolean) => void
  t: (ar: string, en: string) => string
}

export function LoginForm({ onSubmit, isLoading, showPassword, setShowPassword, t }: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="login-emailOrPhone" className="text-base font-medium text-gray-700">
          {t("البريد الإلكتروني أو رقم الهاتف", "Email or Phone Number")}
        </Label>
        <Input
          id="login-emailOrPhone"
          name="emailOrPhone"
          type="text"
          required
          placeholder={t("example@email.com أو 01012345678", "example@email.com or 01012345678")}
          className="h-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-base font-medium text-gray-700">
            {t("كلمة المرور", "Password")}
          </Label>
          <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline transition-colors">
            {t("هل نسيت كلمة السر؟", "Forgot Password?")}
          </Link>
        </div>
        <div className="relative group">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            className="h-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all pe-12"
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 flex items-center px-4 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        disabled={isLoading}
      >
        {isLoading ? t("جاري تسجيل الدخول...", "Logging in...") : t("تسجيل الدخول", "Login")}
      </Button>
    </form>
  )
}
