"use client"

import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function BackButton() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="mb-4 text-gray-600 hover:text-[#1F478B] hover:bg-gray-100"
      onClick={() => router.back()}
    >
      <ArrowRight className="h-4 w-4 ml-1" />
      رجوع
    </Button>
  )
}
