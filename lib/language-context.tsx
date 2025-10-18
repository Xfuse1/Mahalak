"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Language = "ar" | "en"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (ar: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("ar")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Only access localStorage after component mounts (client-side only)
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("language") as Language | null
      if (savedLanguage) {
        setLanguage(savedLanguage)
      }
    }
  }, [])

  useEffect(() => {
    // Only update DOM and localStorage after component is mounted
    if (mounted && typeof window !== "undefined") {
      document.documentElement.lang = language
      document.documentElement.dir = language === "ar" ? "rtl" : "ltr"
      localStorage.setItem("language", language)
    }
  }, [language, mounted])

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "ar" ? "en" : "ar"))
  }

  const t = (ar: string, en: string) => {
    return language === "ar" ? ar : en
  }

  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ language: "ar", toggleLanguage: () => {}, t: (ar) => ar }}>
        {children}
      </LanguageContext.Provider>
    )
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
