"use client"

import Link from "next/link"
import { User, LogOut, ShoppingCart, Bell, X } from "lucide-react"
import { Button } from "./ui/button"
import { useAuth } from "../lib/auth-context"
import { useRouter } from "next/navigation"
import { Logo } from "./logo"
import { useLanguage } from "../lib/language-context"
import { useCartStore } from "@/lib/stores/cart-store"
import { useEffect, useState } from "react"
import { getUnreadNotificationsCount, getUserNotifications, markAllNotificationsAsRead, markNotificationAsRead, type Notification } from "@/lib/actions/notifications"

export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { t } = useLanguage()
  const { items } = useCartStore()
  const cartItemsCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const notificationLocale = "ar-EG"

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
    // نتنقّل فقط لمسارات داخلية نسبية (دفاع في العمق ضد رابط خارجي/إعادة توجيه مخزَّن)
    if (targetLink && targetLink.startsWith("/") && !targetLink.startsWith("//")) {
      router.push(targetLink)
    }
  }

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 bg-[oklch(0.30_0.05_155)] text-white shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-between h-16 md:h-18 gap-2">
          <Link href="/" className="hover:opacity-90 transition-all duration-300 flex-shrink-0 hover:scale-105">
            <Logo className="h-8 md:h-12 w-auto drop-shadow-lg" />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 md:gap-2">
            {/* Cart Button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative text-white hover:bg-white/20 transition-all duration-300 h-10 w-10 rounded-xl hover:scale-105"
              onClick={() => router.push("/cart")}
            >
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
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
                    className="relative text-white hover:bg-white/20 transition-all duration-300 h-10 w-10 rounded-xl hover:scale-105"
                    onClick={handleNotificationClick}
                  >
                    <Bell className="h-4 w-4 md:h-5 md:w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg animate-pulse">
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
                        <div className="p-6 border-b border-border bg-secondary/50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                              <Bell className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="font-extrabold text-gray-900 text-xl">
                              {t("الإشعارات", "Notifications")}
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
                              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                              <p className="text-gray-500 font-medium">{t("جاري التحميل...", "Loading...")}</p>
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="p-12 text-center">
                              <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bell className="h-8 w-8 text-gray-300" />
                              </div>
                              <p className="text-gray-500 font-medium">{t("لا توجد إشعارات حالياً", "No notifications")}</p>
                              <p className="text-gray-400 text-sm mt-1">{t("سنوافيك بكل جديد هنا", "Stay tuned for updates")}</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {notifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  className={`p-4 cursor-pointer hover:bg-primary/5 transition-all duration-200 group relative ${!notification.is_read ? "bg-primary/10" : ""
                                    }`}
                                  onClick={() => handleNotificationItemClick(notification)}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={`mt-1 h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${notification.type === 'order_status' ? 'bg-accent/20 text-accent-foreground' :
                                      notification.type === 'review_request' ? 'bg-primary/10 text-primary' :
                                        'bg-info/10 text-info'
                                      }`}>
                                      <Bell className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className={`font-bold text-sm truncate ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                                          {notification.title}
                                        </p>
                                        {!notification.is_read && (
                                          <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse flex-shrink-0 ms-2" />
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                        {notification.message}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                          {notification.created_at
                                            ? new Date(notification.created_at).toLocaleDateString(notificationLocale, {
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
                          <div className="p-3 bg-secondary/40 border-t border-border text-center">
                            <button
                              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors py-2 px-4 rounded-xl hover:bg-primary/10"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!user?.id) return

                                const result = await markAllNotificationsAsRead(user.id)
                                if (!result.success) return

                                setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
                                setUnreadCount(0)
                              }}
                            >
                              {t("تعليم الكل كمقروء", "Mark all as read")}
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
                  className="text-white hover:bg-white/20 transition-all duration-300 h-10 w-10 rounded-xl hover:scale-105"
                  onClick={() => router.push(user.role === "seller" ? "/seller/dashboard" : "/account")}
                >
                  <User className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-rose-500/30 transition-all duration-300 h-10 w-10 rounded-xl hover:scale-105"
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
                className="bg-white text-primary hover:bg-white/90 active:scale-95 font-bold text-xs md:text-sm px-4 md:px-6 h-9 md:h-10 shadow-lg transition-all duration-300 rounded-xl border-2 border-white/50 hover:border-white"
                onClick={() => router.push("/auth")}
              >
                {t("تسجيل الدخول", "Login")}
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header >
  )
}
