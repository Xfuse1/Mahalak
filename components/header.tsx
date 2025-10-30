"use client"

import Link from "next/link"
import { User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslation } from "react-i18next"

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { t } = useTranslation("common")

  return (
    <header className="sticky top-0 z-50 bg-[#1F478B] text-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity flex-shrink-0">
            <Logo className="h-10 md:h-12 w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 md:gap-2">
            <LanguageSwitcher />

            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/30 hover:scale-110 active:bg-white/40 active:scale-95 transition-all border-2 border-transparent hover:border-white/20 focus:border-white/40 focus:bg-white/30"
                  onClick={() => router.push(user.role === "seller" ? "/seller/dashboard" : "/account")}
                >
                  <User className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/30 hover:scale-110 active:bg-white/40 active:scale-95 transition-all border-2 border-transparent hover:border-white/20 focus:border-white/40 focus:bg-white/30"
                  onClick={() => {
                    logout()
                    router.push("/")
                  }}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Button
                className="bg-white text-[#1F478B] hover:bg-gray-100 hover:scale-105 active:bg-gray-200 active:scale-95 font-bold text-sm md:text-base px-4 md:px-6 h-10 shadow-md transition-all border-2 border-white focus:border-[#1F478B]/40 focus:bg-gray-100"
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
