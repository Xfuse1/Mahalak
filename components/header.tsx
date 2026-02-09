"use client"

import Link from "next/link"
import { User, LogOut, Cuboid, ShoppingCart, Bell, X } from "lucide-react"
import { Button } from "./ui/button"
import { useAuth } from "../lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "./logo"
import { LanguageSwitcher } from "./language-switcher"
import { useTranslation } from "react-i18next"
import { useCartStore } from "@/lib/stores/cart-store"
import { useEffect, useState } from "react"
import { getUnreadNotificationsCount, getUserNotifications, markNotificationAsRead, type Notification } from "@/lib/actions/notifications"
import { isSimulatorEnabled } from "@/lib/actions/delivery"

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
  const [simulatorEnabled, setSimulatorEnabled] = useState(false)

  // Fetch simulator enabled status
  useEffect(() => {
    const fetchSimulatorStatus = async () => {
      const enabled = await isSimulatorEnabled()
      setSimulatorEnabled(enabled)
    }
    fetchSimulatorStatus()
  }, [])

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

  const getNotificationFallbackLink = (notification: Notification) => {
    const orderId = notification.data?.order_id as string | undefined
    // Multi-store order notifications go to edit-order page, single-store go to account
    const orderLink = "/account"

    switch (notification.type) {
      case "review_request":
        return orderId ? `/review/${orderId}` : "/account"
      case "new_order":
      case "new_multi_order":
        return user?.role === "seller" ? "/seller/orders" : orderLink
      case "order_status":
      case "order_delivered":
      case "order_updated":
        return orderLink
      case "driver_rejected":
        // Driver rejected the order - go to change driver page
        return orderId ? `/account/change-driver?orderId=${orderId}` : "/account"
      case "store_confirmed":
      case "store_rejected":
      case "all_items_picked":
      case "driver_picked_from_store":
        // These are multi-store specific notifications
        return orderId ? `/account/edit-order/${orderId}` : "/account"
      case "promotion":
      case "general":
        return "/"
      default:
        return null
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

    const targetLink = notification.link || getNotificationFallbackLink(notification)
    if (targetLink) {
      router.push(targetLink)
    }
  }

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#1e40af] text-white shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-between h-16 md:h-18 gap-2">
          <Link href="/" className="hover:opacity-90 transition-all duration-300 flex-shrink-0 hover:scale-105">
            <Logo className="h-8 md:h-12 w-auto drop-shadow-lg" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 md:gap-2">
            {/* 3D Supermarket Link - Icon only on mobile - Only show if simulator is enabled */}
            {simulatorEnabled && (
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
            )}

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
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
                        onClick={() => setShowNotifications(false)}
                      />

                      {/* Dropdown */}
                      <div className="fixed left-2 right-2 top-16 md:absolute md:left-0 md:right-auto md:top-full md:mt-3 md:w-96 max-h-[70vh] md:max-h-[32rem] overflow-hidden bg-white/95 backdrop-blur-2xl rounded-2xl md:rounded-[2rem] shadow-[0_25px_70px_rgba(0,0,0,0.2)] border border-white/40 z-50 animate-in fade-in zoom-in-95 duration-300 origin-top md:origin-top-left">
                        <div className="p-6 border-b border-gray-100/50 bg-gradient-to-br from-blue-50/80 via-white to-purple-50/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
                              <Bell className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-xl">
                              {t("notifications", "الإشعارات")}
                            </h3>
                          </div>
                          <button
                            onClick={() => setShowNotifications(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <div className="overflow-y-auto max-h-[25rem] scrollbar-thin scrollbar-thumb-gray-200">
                          {loadingNotifications ? (
                            <div className="p-10 text-center">
                              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                              <p className="text-gray-500 font-medium">{t("loading", "جاري التحميل...")}</p>
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="p-12 text-center">
                              <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bell className="h-8 w-8 text-gray-300" />
                              </div>
                              <p className="text-gray-500 font-medium">{t("noNotifications", "لا توجد إشعارات حالياً")}</p>
                              <p className="text-gray-400 text-sm mt-1">{t("stayTuned", "سنوافيك بكل جديد هنا")}</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {notifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  className={`p-4 cursor-pointer hover:bg-blue-50/30 transition-all duration-200 group relative ${!notification.is_read ? "bg-blue-50/50" : ""
                                    }`}
                                  onClick={() => handleNotificationItemClick(notification)}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={`mt-1 h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${notification.type === 'order_status' ? 'bg-orange-100 text-orange-600' :
                                      notification.type === 'review_request' ? 'bg-purple-100 text-purple-600' :
                                        'bg-blue-100 text-blue-600'
                                      }`}>
                                      <Bell className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className={`font-bold text-sm truncate ${!notification.is_read ? "text-blue-900" : "text-gray-700"}`}>
                                          {notification.title}
                                        </p>
                                        {!notification.is_read && (
                                          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse flex-shrink-0 ml-2" />
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                        {notification.message}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                          {notification.created_at
                                            ? new Date(notification.created_at).toLocaleDateString("ar-EG", {
                                              day: "numeric",
                                              month: "short",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })
                                            : ""}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {notifications.length > 0 && (
                          <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-center">
                            <button
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors py-2 px-4 rounded-xl hover:bg-blue-100/50"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Logic for view all or mark all read
                              }}
                            >
                              {t("viewAll", "عرض جميع الإشعارات")}
                            </button>
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
        </div>
      </div>
    </header >
  )
}
