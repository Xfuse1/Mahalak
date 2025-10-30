'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/language-context'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()
  const { t } = useLanguage()

  return (
    <Button
      variant="default"
      onClick={() => router.back()}
      className="mb-4 bg-[#1F478B] hover:bg-[#1a3a70]"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {t('رجوع', 'Back')}
    </Button>
  )
}
