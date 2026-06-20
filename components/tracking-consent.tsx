"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import Image from "next/image"
import { useLanguage } from "../lib/language-context"

const STORAGE_KEY = "fb_pixel_consent"

export function TrackingConsent() {
  const [consent, setConsent] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
  const { t } = useLanguage()

  useEffect(() => {
    // قراءة الموافقة المحفوظة بعد التركيب: نمط مقصود وآمن للـ hydration
    // (لا يمكن نقله لمُهيّئ useState لأن وسم البكسل غير محمي بـ ready)
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "true") {
        setConsent(true)
      } else if (saved === "false") {
        setConsent(false)
      } else {
        setConsent(null)
      }
    } catch (e) {
      // ignore storage errors
    }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // If no pixel id provided, don't render or load anything
  if (!pixelId) return null

  const handleConsent = (value: boolean) => {
    setConsent(value)
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch (e) {
      // ignore storage errors
    }
  }

  return (
    <>
      {ready && consent === null && (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl md:left-auto md:max-w-md">
          <p className="text-sm leading-6 text-gray-700">
            {t(
              "نستخدم ملفات تعريف الارتباط وتقنيات التتبع لتحسين تجربتك وقياس الأداء.",
              "We use cookies and tracking technologies to improve your experience and measure performance.",
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#1F478B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163766]"
              onClick={() => handleConsent(true)}
            >
              {t("قبول", "Accept")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => handleConsent(false)}
            >
              {t("رفض", "Reject")}
            </button>
          </div>
        </div>
      )}

      {consent === true && (
        <>
          <Script
            id="facebook-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId}');fbq('track', 'PageView');`,
            }}
          />
          <noscript>
            <Image
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
              unoptimized
            />
          </noscript>
        </>
      )}
    </>
  )
}

export default TrackingConsent
