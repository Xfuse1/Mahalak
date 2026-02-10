"use client"

import dynamic from "next/dynamic"
import { ToastProvider } from "./ui/toast"
import { ConfirmProvider } from "./ui/confirm-dialog"

const TrackingConsent = dynamic(
  () => import("./tracking-consent"),
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
        <TrackingConsent />
        <GlobalContactTracker />
        <ScrollToTop />
        {children}
      </ConfirmProvider>
    </ToastProvider>
  )
}
