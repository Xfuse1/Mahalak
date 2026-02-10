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
}

export function SearchBar({ placeholder, onSearch, className = "" }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const router = useRouter()
  const { t, language } = useLanguage()
  const toast = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRTL = language === "ar"
  const searchPlaceholder = placeholder || t("ابحث عن منتجات، متاجر...", "Search for products, stores...")

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
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.lang = language === "ar" ? "ar-EG" : "en-US"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setQuery(transcript)
        setIsListening(false)
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
        <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`}></div>
        <Input
          id="search-input"
          type="text"
          placeholder={searchPlaceholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`relative border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 hover:border-blue-300 transition-all duration-300 h-14 rounded-2xl shadow-sm bg-white ${isRTL ? 'text-right pl-12 pr-5' : 'text-left pr-12 pl-5'} text-base`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300 rounded-xl ${isRTL ? 'left-2' : 'right-2'
            } ${isListening ? "text-red-500 animate-pulse bg-red-50" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
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
        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6 md:px-8 h-14 text-white font-bold transition-all duration-300 rounded-2xl shadow-lg hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105 active:scale-95 flex items-center gap-2"
      >
        <Search className="h-5 w-5" />
        <span className="hidden sm:inline">{t("بحث", "Search")}</span>
      </Button>
    </form>
  )
}
