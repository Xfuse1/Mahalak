"use client"

import dynamic from "next/dynamic"
import { ToastProvider } from "./ui/toast"
import { ConfirmProvider } from "./ui/confirm-dialog"
import { PWARegister } from "./pwa-register"

// وسوم البكسل/Clarity/Sentry نفسها في components/analytics-scripts.tsx (سيرفر، root layout)؛
// هنا التقاط مصدر الزيارة فقط. بانر موافقة الكوكيز أُزيل (قرار المالك 2026-11-02).
const AnalyticsClient = dynamic(
  () => import("./analytics-client"),
  { ssr: false }
)
const GlobalContactTracker = dynamic(
  () => import("./global-contact-tracker"),
  { ssr: false }
)
const ScrollToTop = dynamic(
  () => import("./scroll-to-top").then((m) => ({ default: m.ScrollToTop })),
  { ssr: false }
)

export function LayoutClientComponents({ children }: { children?: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PWARegister />
        <AnalyticsClient />
        <GlobalContactTracker />
        <ScrollToTop />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
