"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Search, Mic } from "lucide-react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { useRouter } from "next/navigation"
import { useLanguage } from "../lib/language-context"
import { useToast } from "@/components/ui/toast"

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
  initialValue?: string
}

export function SearchBar({ placeholder, onSearch, className = "", initialValue = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const [isListening, setIsListening] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()
  const { t, language } = useLanguage()
  const toast = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRTL = language === "ar"
  const searchPlaceholder = placeholder || t("ابحث عن منتجات، متاجر...", "Search for products, stores...")

  // مزامنة قيمة الصندوق مع الاستعلام الحالي عند تغيّره من الرابط (back/forward/رابط داخلي) دون remount
  useEffect(() => {
    setQuery(initialValue)
  }, [initialValue])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const debouncedOnSearch = useCallback(
    (value: string) => {
      if (!onSearch) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(value)
      }, 300)
    },
    [onSearch],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    // If onSearch is provided (live search mode), debounce it
    if (onSearch) {
      debouncedOnSearch(value)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Cancel any pending debounced call and fire immediately
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (onSearch) {
      onSearch(query)
    } else {
      router.push(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  const handleVoiceSearch = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = language === "ar" ? "ar-EG" : "en-US"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ""
        if (!transcript) {
          setIsListening(false)
          return
        }
        setQuery(transcript)
        setIsListening(false)
        // بعد التعرّف على الصوت ننفّذ نفس مسار البحث (مثل الإرسال)
        if (onSearch) {
          onSearch(transcript)
        } else {
          router.push(`/search?q=${encodeURIComponent(transcript)}`)
        }
      }

      recognition.onerror = () => {
        setIsListening(false)
        toast.error(t("حدث خطأ في البحث الصوتي", "An error occurred with voice search"))
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } else {
      toast.error(t("البحث الصوتي غير مدعوم في هذا المتصفح", "Voice search is not supported in this browser"))
    }
  }

  return (
    <form onSubmit={handleSearch} className={`flex gap-3 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className={`flex-1 relative transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
        <Label htmlFor="search-input" className="sr-only">
          {searchPlaceholder}
        </Label>
        <div className={`absolute inset-0 bg-gradient-to-r from-primary/15 to-accent/15 rounded-2xl blur-xl transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`}></div>
        <Input
          id="search-input"
          type="text"
          placeholder={searchPlaceholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`relative border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 hover:border-primary/50 transition-all duration-300 h-14 rounded-2xl shadow-sm bg-card ${isRTL ? 'text-right pl-12 pr-5' : 'text-left pr-12 pl-5'} text-base`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300 rounded-xl ${isRTL ? 'left-2' : 'right-2'
            } ${isListening ? "text-destructive animate-pulse bg-destructive/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            }`}
          onClick={handleVoiceSearch}
          title={t("البحث الصوتي", "Voice Search")}
          aria-label={t("البحث الصوتي", "Voice Search")}
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
      <Button 
        type="submit" 
        className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 md:px-8 h-14 font-bold transition-colors duration-300 rounded-2xl shadow-lg active:scale-95 flex items-center gap-2"
      >
        <Search className="h-5 w-5" />
        <span className="hidden sm:inline">{t("بحث", "Search")}</span>
      </Button>
    </form>
  )
}
