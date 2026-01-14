"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingBag, Tag, Settings, LogOut, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { useTranslation } from "react-i18next"

export function SellerHeader() {
  const pathname = usePathname()
  const { logout } = useAuth()
  const router = useRouter()
  const { t } = useTranslation("common")

  const navItems = [
    { href: "/seller/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/seller/products", label: t("products"), icon: Package },
    { href: "/seller/orders", label: t("orders"), icon: ShoppingBag },
    { href: "/seller/offers", label: t("offers"), icon: Tag },
    { href: "/seller/settings", label: t("settings"), icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <aside className="w-64 bg-white border-l border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <Link href="/" className="block hover:opacity-90 transition-opacity">
          <Logo className="h-10 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all border-2 ${isActive
                    ? "bg-[#1F478B] text-white border-[#1F478B] shadow-md scale-[1.02]"
                    : "text-gray-700 hover:bg-gray-100 hover:border-gray-300 border-transparent hover:scale-[1.02] active:bg-gray-200 active:scale-100"
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-[#1F478B] hover:text-[#1a3a70] hover:bg-blue-50 active:bg-blue-100 active:scale-95 transition-all border-2 border-transparent hover:border-blue-200 focus:border-blue-300 focus:bg-blue-50"
          onClick={() => router.push("/")}
        >
          <Home className="h-5 w-5" />
          <span>{t("backToSite")}</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100 active:scale-95 transition-all border-2 border-transparent hover:border-red-200 focus:border-red-300 focus:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span>{t("logout")}</span>
        </Button>
      </div>
    </aside>
  )
}
