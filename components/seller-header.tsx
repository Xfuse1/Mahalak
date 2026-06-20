"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingBag, Tag, Settings, LogOut, Home, Menu } from "lucide-react"
import { Button } from "./ui/button"
import { useAuth } from "../lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "./logo"
import { useLanguage } from "../lib/language-context"
import { logError } from "../lib/logger"
import { cn } from "../lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import { getStoreByUserId } from "../lib/actions/stores"
import { getPendingOrdersCount } from "../lib/actions/orders"

export function SellerHeader() {
  const pathname = usePathname()
  const { logout, user } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    let active = true

    const fetchPendingCount = async () => {
      try {
        const store = await getStoreByUserId(userId)
        if (store && active) {
          const count = await getPendingOrdersCount(store.id)
          if (active) setPendingCount(count)
        }
      } catch (e) {
        logError("Error fetching pending count:", e)
      }
    }

    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30000) // refresh every 30s
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user?.id])

  const navItems = [
    { href: "/seller/dashboard", label: t("لوحة التحكم", "Dashboard"), icon: LayoutDashboard },
    { href: "/seller/products", label: t("المنتجات", "Products"), icon: Package },
    { href: "/seller/orders", label: t("الطلبات", "Orders"), icon: ShoppingBag },
    { href: "/seller/offers", label: t("العروض", "Offers"), icon: Tag },
    { href: "/seller/settings", label: t("الإعدادات", "Settings"), icon: Settings },
  ]

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-gray-50 flex items-center justify-center">
        <Link href="/" className="block hover:opacity-80 transition-all hover:scale-105 active:scale-95">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 p-6 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="pb-4">
          <p className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{t("القائمة الرئيسية", "Main Menu")}</p>
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative group overflow-hidden",
                      isActive
                        ? "bg-[#1F478B] text-white shadow-xl shadow-blue-900/10 scale-102"
                        : "text-gray-500 hover:bg-blue-50/50 hover:text-[#1F478B]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white opacity-20" />
                    )}
                    <Icon className={cn("h-5 w-5 transition-transform duration-500 group-hover:scale-110", isActive ? "text-white" : "text-gray-400 group-hover:text-[#1F478B]")} />
                    <span className="font-black text-[14px]">{item.label}</span>
                    {item.href === "/seller/orders" && pendingCount > 0 && (
                      <span className="ms-auto me-2 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-black px-1.5 animate-pulse shadow-lg shadow-red-500/30">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      <div className="p-6 border-t border-gray-50 bg-gray-50/30 space-y-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-4 px-4 h-12 rounded-xl text-gray-500 hover:text-[#1F478B] hover:bg-blue-50/50 font-black text-sm transition-all"
          onClick={() => router.push("/")}
        >
          <Home className="h-5 w-5" />
          <span>{t("العودة للموقع", "Back to Site")}</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-4 px-4 h-12 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 font-black text-sm transition-all"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span>{t("تسجيل الخروج", "Logout")}</span>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 border-l border-gray-100 min-h-screen flex-col shadow-[rgba(0,0,0,0.02)_1px_0_10px] z-50 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-[100] shadow-sm">
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-600">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-72">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("القائمة", "Menu")}</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        </div>

        <Link href="/">
          <Logo className="h-8 w-auto" />
        </Link>
        <div className="w-10"></div> {/* Spacer for balance */}
      </header>
    </>
  )
}
