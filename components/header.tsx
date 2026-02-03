"use client"

import Link from "next/link"
import { User, LogOut, Cuboid, ShoppingCart, Bell } from "lucide-react"
import { Button } from "./ui/button"
import { useAuth } from "../lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "./logo"
import { LanguageSwitcher } from "./language-switcher"
import { useTranslation } from "react-i18next"
import { useCartStore } from "@/lib/stores/cart-store"
import { useEffect, useState } from "react"
import { getUnreadNotificationsCount, getUserNotifications, markNotificationAsRead, type Notification } from "@/lib/actions/notifications"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { t } = useTranslation("common")
  const { items } = useCartStore()
  const cartItemsCount = items.reduce((sum, item) => sum + item.quantity, 0)

  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (user?.id) {
        const count = await getUnreadNotificationsCount(user.id)
        setUnreadCount(count)
      }
    }

    fetchUnreadCount()
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Fetch notifications when dropdown opens
  const handleNotificationClick = async () => {
    if (!user?.id) {
      router.push("/auth")
      return
    }

    setShowNotifications(!showNotifications)

    if (!showNotifications) {
      setLoadingNotifications(true)
      const notifs = await getUserNotifications(user.id, 10)
      setNotifications(notifs)
      setLoadingNotifications(false)
    }
  }

  // Handle notification item click
  const handleNotificationItemClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id)
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
    }

    setShowNotifications(false)

    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#1e40af] text-white shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-between h-16 md:h-18 gap-2">
          <Link href="/" className="hover:opacity-90 transition-all duration-300 flex-shrink-0 hover:scale-105">
            <Logo className="h-8 md:h-12 w-auto drop-shadow-lg" />
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-2">
            {/* 3D Supermarket Link - Icon only on mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center justify-center text-white hover:bg-white/20 h-9 w-9 px-0 md:w-auto md:px-4 md:gap-2 rounded-xl transition-all duration-300 hover:scale-105"
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

            {/* Cart Button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-white hover:bg-white/20 transition-all duration-300 h-9 w-9 md:h-10 md:w-10 rounded-xl hover:scale-105"
              onClick={() => router.push("/cart")}
            >
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </span>
              )}
            </Button>

            {user ? (
              <>
                {/* Notifications Button */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-white hover:bg-white/20 transition-all duration-300 h-9 w-9 md:h-10 md:w-10 rounded-xl hover:scale-105"
                    onClick={handleNotificationClick}
                  >
                    <Bell className="h-4 w-4 md:h-5 md:w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={() => setShowNotifications(false)}
                      />

                      {/* Dropdown */}
                      <div className="absolute left-0 md:right-0 md:left-auto top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
                          <h3 className="font-bold text-gray-800 text-lg">{t("notifications", "الإشعارات")}</h3>
                        </div>

                        {loadingNotifications ? (
                          <div className="p-4 text-center text-gray-500">
                            {t("loading", "جاري التحميل...")}
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            {t("noNotifications", "لا توجد إشعارات")}
                          </div>
                        ) : (
                          <div>
                            {notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${!notification.is_read ? "bg-blue-50" : ""
                                  }`}
                                onClick={() => handleNotificationItemClick(notification)}
                              >
                                <div className="flex items-start gap-2">
                                  {!notification.is_read && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-800 truncate">
                                      {notification.title}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {notification.created_at
                                        ? new Date(notification.created_at).toLocaleDateString("ar-EG", {
                                          day: "numeric",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 transition-all duration-300 h-9 w-9 md:h-10 md:w-10 rounded-xl hover:scale-105"
                  onClick={() => router.push(user.role === "seller" ? "/seller/dashboard" : "/account")}
                >
                  <User className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-rose-500/30 transition-all duration-300 h-9 w-9 md:h-10 md:w-10 rounded-xl hover:scale-105"
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
                className="bg-white text-[#1e40af] hover:bg-gray-50 hover:scale-105 active:scale-95 font-bold text-xs md:text-sm px-4 md:px-6 h-9 md:h-10 shadow-lg transition-all duration-300 rounded-xl border-2 border-white/50 hover:border-white"
                onClick={() => router.push("/auth")}
              >
                {t("login")}
              </Button>
            )}
          </nav>

          {/* Navigation - Mobile Hamburger & Essential Actions */}
          <div className="flex md:hidden items-center gap-1">
            {/* Essential Cart Button always visible */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-white hover:bg-white/20 transition-all duration-300 h-9 w-9 rounded-xl"
              onClick={() => router.push("/cart")}
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-lg">
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </span>
              )}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9 rounded-xl">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#1e3a5f] text-white border-l-white/10 p-0 w-[280px]">
                <SheetHeader className="p-6 border-b border-white/10">
                  <SheetTitle className="text-white flex items-center gap-2">
                    <Logo className="h-8 w-auto invert brightness-0" />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-4 gap-4">
                  {/* Market Link */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-white/10 gap-3 py-6 rounded-2xl"
                    onClick={() => {
                      router.push("/supermarket")
                    }}
                  >
                    <Cuboid className="h-5 w-5" />
                    <span className="font-bold">3D Market</span>
                  </Button>

                  {/* Language Switcher in Mobile Menu */}
                  <div className="px-2 py-2 border-y border-white/10 flex items-center justify-between">
                    <span className="text-sm font-medium opacity-70">{t("language", "اللغة")}</span>
                    <LanguageSwitcher />
                  </div>

                  {user ? (
                    <div className="space-y-2 pt-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-white hover:bg-white/10 gap-3 py-6 rounded-2xl"
                        onClick={() => router.push(user.role === "seller" ? "/seller/dashboard" : "/account")}
                      >
                        <User className="h-5 w-5" />
                        <span className="font-bold">{user.name}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full justify-start text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 gap-3 py-6 rounded-2xl"
                        onClick={() => {
                          logout()
                          router.push("/")
                        }}
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="font-bold">{t("logout", "تسجيل الخروج")}</span>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-white text-[#1e40af] hover:bg-gray-100 font-bold py-6 rounded-2xl mt-4"
                      onClick={() => router.push("/auth")}
                    >
                      {t("login")}
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
