"use client"

import { useEffect, useState } from "react"
import Script from "next/script"

const STORAGE_KEY = "fb_pixel_consent"

export function TrackingConsent() {
  // Force consent to true and persist it so the banner never appears.
  const [consent, setConsent] = useState<boolean | null>(true)
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch (e) {
      // ignore storage errors
    }
    setConsent(true)
  }, [])

  // If no pixel id provided, don't render or load anything
  if (!pixelId) return null

  return (
    <>
      {/* Banner removed: consent is forced to true and persisted in localStorage */}

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
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  )
}

export default TrackingConsent
