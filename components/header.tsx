"use client"

import Link from "next/link"
import { User, LogOut, Cuboid } from "lucide-react"
import { Button } from "./ui/button"
import { useAuth } from "../lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "./logo"
import { LanguageSwitcher } from "./language-switcher"
import { useTranslation } from "react-i18next"

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { t } = useTranslation("common")

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 bg-[#1F478B] text-white shadow-md">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link href="/" className="hover:opacity-90 transition-opacity flex-shrink-0">
            <Logo className="h-8 md:h-12 w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {/* 3D Supermarket Link - Icon only on mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center justify-center text-white hover:bg-white/20 h-8 w-8 px-0 md:w-auto md:px-4 md:gap-2"
              onClick={() => router.push("/supermarket")}
              title="3D Market"
            >
              <Cuboid className="h-4 w-4 md:h-5 md:w-5" />
              <span className="font-bold hidden md:inline ml-2">3D Market</span>
            </Button>

            {/* Hide Language Switcher on very small screens to save space */}
            <div className="hidden xs:block">
              <LanguageSwitcher />
            </div>

            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/30 transition-all h-8 w-8 md:h-10 md:w-10"
                  onClick={() => router.push(user.role === "seller" ? "/seller/dashboard" : "/account")}
                >
                  <User className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/30 transition-all h-8 w-8 md:h-10 md:w-10"
                  onClick={() => {
                    logout()
                    router.push("/")
                  }}
                >
                  <LogOut className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </>
            ) : (
              <Button
                className="bg-white text-[#1F478B] hover:bg-gray-100 hover:scale-105 active:bg-gray-200 active:scale-95 font-bold text-xs md:text-base px-3 md:px-6 h-8 md:h-10 shadow-md transition-all border-2 border-white focus:border-[#1F478B]/40 focus:bg-gray-100"
                onClick={() => router.push("/auth")}
              >
                {t("login")}
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
