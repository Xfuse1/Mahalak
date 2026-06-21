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
      className="mb-4 bg-primary hover:bg-primary/90"
    >
      <ArrowLeft className="me-2 h-4 w-4" />
      {t('رجوع', 'Back')}
    </Button>
  )
}
