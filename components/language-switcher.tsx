"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/lib/language-context"

export function LanguageSwitcher() {
  const { setLanguage } = useLanguage()

  const changeLanguage = (lng: "ar" | "en") => {
    setLanguage(lng)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/30 hover:scale-110 active:bg-white/40 active:scale-95 transition-all border-2 border-transparent hover:border-white/20 focus:border-white/40 focus:bg-white/30"
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeLanguage("ar")}>العربية</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage("en")}>English</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
