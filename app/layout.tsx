import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Cairo } from "next/font/google"
import { AuthProvider } from "../lib/auth-context"
import { I18nProvider } from "../lib/i18n-provider"
import { LanguageProvider } from "../lib/language-context"
import { LayoutClientComponents } from "../components/layout-client-components"
import { LocationProvider } from "../lib/location/user-location"

// VIS-01: تحميل خط Cairo فعليًا عبر next/font (self-hosted، محسّن، display:swap)
// كان الخط مُعلَنًا في globals.css لكنه غير محمَّل إطلاقًا → كان التطبيق يعرض بخط النظام.
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
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

// MOB-09: لون الثيم (أخضر الهوية) لشريط المتصفّح/تطبيق PWA
export const viewport: Viewport = {
  themeColor: "#1B7A4B",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="antialiased">
        <I18nProvider>
          <LanguageProvider>
            <AuthProvider>
              <LocationProvider>
                <LayoutClientComponents>
                  {children}
                </LayoutClientComponents>
              </LocationProvider>
            </AuthProvider>
          </LanguageProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
