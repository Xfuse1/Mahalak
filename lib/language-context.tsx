"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

type Language = "ar" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lng: Language) => void
  toggleLanguage: () => void
  t: (ar: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const language: Language = "ar"

  useEffect(() => {
    // Force Arabic-only UI and reset any previously saved language preference.
    i18n.changeLanguage("ar")
    document.documentElement.lang = "ar"
    document.documentElement.dir = "rtl"
    localStorage.removeItem("language")
  }, [i18n])

  const setLanguage = (_lng: Language) => {
    i18n.changeLanguage("ar")
    document.documentElement.lang = "ar"
    document.documentElement.dir = "rtl"
  }

  const toggleLanguage = () => {
    setLanguage("ar")
  }

  const t = (ar: string, _en: string) => {
    return ar
  }

  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
