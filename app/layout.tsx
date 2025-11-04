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
  preload: true,
  fallback: ['system-ui', 'arial'],
})

export const metadata: Metadata = {
  title: "محلك - منصة التجارة الإلكترونية المحلية",
  description: "اكتشف أفضل المنتجات والمتاجر المحلية",
  generator: "v0.app",
  metadataBase: new URL('https://mahalak.com'),
  openGraph: {
    title: "محلك - منصة التجارة الإلكترونية المحلية",
    description: "اكتشف أفضل المنتجات والمتاجر المحلية",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for faster lookups */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
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
