"use client"

import { useEffect, type ReactNode } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "./i18n"

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Arabic-only mode
    i18n.changeLanguage("ar")
    document.documentElement.dir = "rtl"
    document.documentElement.lang = "ar"
    localStorage.removeItem("language")
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
