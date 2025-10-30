import type React from "react"
import type { Metadata } from "next"
import { Cairo } from "next/font/google"
import "./globals.css"
import TrackingConsent from "@/components/tracking-consent"
import GlobalContactTracker from "@/components/global-contact-tracker"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n-provider"
import { ScrollToTop } from "@/components/scroll-to-top"
import { LanguageProvider } from "@/lib/language-context"

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
})

export const metadata: Metadata = {
  title: "محلك - منصة التجارة الإلكترونية المحلية",
  description: "اكتشف أفضل المنتجات والمتاجر المحلية",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="antialiased">
  <TrackingConsent />
  <GlobalContactTracker />
        <I18nProvider>
          <LanguageProvider>
            <AuthProvider>
              <ScrollToTop />
              {children}
            </AuthProvider>
          </LanguageProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
