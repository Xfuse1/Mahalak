"use client"

import { useEffect } from "react"
import { trackMetaEvent } from "@/lib/utils"

export default function GlobalContactTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return

      const anchor = target.closest ? (target.closest('a') as HTMLAnchorElement | null) : null
      if (!anchor || !anchor.href) return

      try {
        const href = anchor.href
        const dataset = (anchor.dataset || {}) as Record<string, string>
        const common: Record<string, any> = { href }
        if (dataset.storeId) common.storeId = dataset.storeId
        if (dataset.storeName) common.storeName = dataset.storeName
        if (dataset.productId) common.productId = dataset.productId
        if (dataset.productName) common.productName = dataset.productName

        if (href.startsWith('https://wa.me') || href.includes('wa.me')) {
          trackMetaEvent('Contact', { method: 'whatsapp', ...common })
        } else if (href.startsWith('tel:')) {
          trackMetaEvent('Contact', { method: 'call', ...common })
        }
      } catch (err) {
        // ignore
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  return null
}
