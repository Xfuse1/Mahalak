"use client"

import { useEffect } from "react"
import { captureAttribution, classifyChannel } from "@/lib/analytics/attribution"

type ClarityFn = (command: "set", key: string, value: string) => void

// يلتقط مصدر الزيارة (UTM / fbclid / المُحيل) مرة عند تحميل الصفحة ويحفظه في المتصفح، ليُرفق
// بالطلب عند إنشائه. ويوسم جلسة Clarity بالقناة والحملة كي تُفلتر تسجيلات زوار الإعلانات وحدها.
export default function AnalyticsClient() {
  useEffect(() => {
    const touch = captureAttribution()
    if (!touch) return
    const tag = () => {
      const clarity = (window as unknown as { clarity?: ClarityFn }).clarity
      if (typeof clarity !== "function") return false
      try {
        clarity("set", "channel", classifyChannel(touch))
        if (touch.utm_campaign) clarity("set", "utm_campaign", touch.utm_campaign)
      } catch {
        // وسم غير حرِج
      }
      return true
    }
    // سكربت Clarity afterInteractive قد يصل بعد هذا الـ effect — نعيد المحاولة قليلًا ثم نتوقف
    if (tag()) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      if (tag() || tries >= 10) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return null
}
