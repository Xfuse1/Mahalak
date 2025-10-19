"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

type Language = "ar" | "en"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (ar: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const language = (i18n.language || "ar") as Language

  useEffect(() => {
    // Update DOM attributes when language changes
    document.documentElement.lang = language
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr"
  }, [language])

  const toggleLanguage = () => {
    const newLanguage = language === "ar" ? "en" : "ar"
    i18n.changeLanguage(newLanguage)
  }

  const t = (ar: string, en: string) => {
    return language === "ar" ? ar : en
  }

  return <LanguageContext.Provider value={{ language, toggleLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
