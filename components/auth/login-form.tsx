"use client"

import type React from "react"
import Link from "next/link"
import { Chrome, Loader2 } from "lucide-react"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { EyeOpenIcon, EyeOffIcon } from "../ui/icons"

interface LoginFormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onGoogleSignIn: () => void
  isLoading: boolean
  isGoogleLoading?: boolean
  showPassword: boolean
  setShowPassword: (show: boolean) => void
  t: (ar: string, en: string) => string
  registerHref?: string
}

export function LoginForm({
  onSubmit,
  onGoogleSignIn,
  isLoading,
  isGoogleLoading = false,
  showPassword,
  setShowPassword,
  t,
  registerHref = "/auth/register",
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="login-emailOrPhone" className="text-sm font-medium text-slate-700 sm:text-base">
          {t("البريد الإلكتروني أو رقم الهاتف", "Email or Phone Number")}
        </Label>
        <Input
          id="login-emailOrPhone"
          name="emailOrPhone"
          type="text"
          required
          placeholder={t("example@email.com أو 01012345678", "example@email.com or 01012345678")}
          className="h-12 rounded-2xl border-slate-200 bg-white px-4 text-sm shadow-sm transition focus-visible:ring-4 focus-visible:ring-primary/20 sm:h-14 sm:text-base"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="login-password" className="text-sm font-medium text-slate-700 sm:text-base">
            {t("كلمة المرور", "Password")}
          </Label>
          <Link href="/auth/forgot-password" className="text-xs font-medium text-primary hover:text-primary/80 sm:text-sm">
            {t("هل نسيت كلمة السر؟", "Forgot Password?")}
          </Link>
        </div>

        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            className="h-12 rounded-2xl border-slate-200 bg-white px-4 pe-12 text-sm shadow-sm transition focus-visible:ring-4 focus-visible:ring-primary/20 sm:h-14 sm:text-base"
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 flex items-center px-4 text-slate-400 transition hover:text-slate-600"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOffIcon /> : <EyeOpenIcon />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-lg transition hover:bg-primary/90 sm:h-14 sm:text-base"
        disabled={isLoading || isGoogleLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="me-2 size-4 animate-spin" />
            {t("جاري تسجيل الدخول...", "Logging in...")}
          </>
        ) : (
          t("تسجيل الدخول", "Login")
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-slate-400">{t("أو", "Or")}</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onGoogleSignIn}
        disabled={isLoading || isGoogleLoading}
        className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:h-14 sm:text-base"
      >
        {isGoogleLoading ? <Loader2 className="size-5 animate-spin" /> : <Chrome className="h-5 w-5" />}
        {isGoogleLoading ? t("جاري المتابعة...", "Continuing...") : t("التسجيل بواسطة Google", "Continue with Google")}
      </Button>

      <p className="text-center text-sm text-slate-500">
        {t("لا تمتلك حسابًا؟", "Don't have an account?")}{" "}
        <Link href={registerHref} className="font-semibold text-primary hover:text-primary/80 hover:underline">
          {t("أنشئ حساب الآن", "Create one now")}
        </Link>
      </p>
    </form>
  )
}
