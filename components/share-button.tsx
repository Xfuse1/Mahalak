"use client"

import { Share2 } from "lucide-react"
import { Button } from "./ui/button"
import { useLanguage } from "@/lib/language-context"

// زر مشاركة: يفتح صحيفة المشاركة الأصلية على الموبايل (وتشمل واتساب — القناة الأساسية في السوق)،
// ويرجع لرابط واتساب مباشر على الحواسيب. حلقة نمو أساسية: نشر رابط المنتج/المتجر.
export function ShareButton({
  title,
  text,
  className,
}: {
  title: string
  text?: string
  className?: string
}) {
  const { t } = useLanguage()

  const handleShare = async () => {
    if (typeof window === "undefined") return
    const url = window.location.href
    const shareText = text || title

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url })
      } catch {
        // المستخدم ألغى صحيفة المشاركة أو فشلت — لا نفعل شيئًا (لا نفتح واتساب عند الإلغاء)
      }
      return
    }

    // بديل الحواسيب فقط: يعمل عندما لا تتوفّر navigator.share أصلًا
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`, "_blank")
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      className={className}
      aria-label={t("مشاركة", "Share")}
    >
      <Share2 className="h-4 w-4" />
      <span className="ms-2">{t("مشاركة", "Share")}</span>
    </Button>
  )
}
