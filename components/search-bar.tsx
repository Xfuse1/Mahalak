"use client"

import type React from "react"

import { useState } from "react"
import { Search, Mic } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language-context"

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
}

export function SearchBar({ placeholder, onSearch, className = "" }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [isListening, setIsListening] = useState(false)
  const router = useRouter()
  const { t, language } = useLanguage()

  const searchPlaceholder = placeholder || t("ابحث عن منتجات، متاجر...", "Search for products, stores...")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
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
        alert(t("حدث خطأ في البحث الصوتي", "An error occurred with voice search"))
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } else {
      alert(t("البحث الصوتي غير مدعوم في هذا المتصفح", "Voice search is not supported in this browser"))
    }
  }

  return (
    <form onSubmit={handleSearch} className={`flex gap-2 ${className}`}>
      <div className="flex-1 relative">
        <Label htmlFor="search-input" className="sr-only">
          {searchPlaceholder}
        </Label>
        <Input
          id="search-input"
          type="text"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-10 border-2 border-gray-300 focus:border-[#1F478B] h-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute left-2 top-1/2 -translate-y-1/2 transition-colors ${
            isListening ? "text-red-500 animate-pulse" : "text-gray-500 hover:text-[#1F478B]"
          }`}
          onClick={handleVoiceSearch}
          title={t("البحث الصوتي", "Voice Search")}
          aria-label={t("البحث الصوتي", "Voice Search")}
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
      <Button type="submit" className="bg-[#1F478B] hover:bg-[#1a3a70] px-6 h-12">
        <Search className="h-4 w-4 ml-2" />
        {t("بحث", "Search")}
      </Button>
    </form>
  )
}
