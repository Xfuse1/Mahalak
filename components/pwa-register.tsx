"use client"

import { useEffect } from "react"

// يسجّل عامل الخدمة الموحّد (/sw.js) — يفعّل التثبيت كـPWA + العمل أوفلاين + إشعارات FCM في الخلفية.
// غير مشروط (لا يعتمد على VAPID): الأوفلاين يفيد الجميع، وجزء FCM داخل العامل خامل بلا رمز.
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.warn("[pwa] SW registration failed:", e)
      })
    }
    // نؤجّل حتى اكتمال التحميل كي لا نزاحم موارد الصفحة الحرجة.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])
  return null
}
