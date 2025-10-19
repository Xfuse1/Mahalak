"use client"

import { useEffect, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "./i18n"

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Load saved language from localStorage
    const savedLanguage = localStorage.getItem("language")
    if (savedLanguage && (savedLanguage === "ar" || savedLanguage === "en")) {
      i18n.changeLanguage(savedLanguage)
      document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr"
      document.documentElement.lang = savedLanguage
    }
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
