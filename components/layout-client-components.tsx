"use client"

import dynamic from "next/dynamic"

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

export function LayoutClientComponents() {
  return (
    <>
      <TrackingConsent />
      <GlobalContactTracker />
      <ScrollToTop />
    </>
  )
}
