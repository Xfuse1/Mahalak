import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "../lib/auth-context"
import { I18nProvider } from "../lib/i18n-provider"
import { LanguageProvider } from "../lib/language-context"
import { LayoutClientComponents } from "../components/layout-client-components"

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
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <I18nProvider>
          <LanguageProvider>
            <AuthProvider>
              <LayoutClientComponents>
                {children}
              </LayoutClientComponents>
            </AuthProvider>
          </LanguageProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
