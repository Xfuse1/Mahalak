"use client"

import type { ReactNode } from "react"
import { useSyncExternalStore } from "react"
import { ExternalLink, Info } from "lucide-react"
import { androidChromeIntentUrl, detectInAppBrowser, isAndroidUserAgent, type InAppBrowser } from "@/lib/utils/in-app-browser"

const noopSubscribe = () => () => {}

const APP_NAME: Record<InAppBrowser, string> = {
  facebook: "فيسبوك",
  instagram: "إنستجرام",
  messenger: "ماسنجر",
}

/**
 * يلفّ زرّ «الدخول بجوجل». داخل متصفح فيسبوك/إنستجرام المدمج يُستبدل الزرّ بشرح بديل، لأن جوجل
 * ترفض تسجيل الدخول داخل الـ WebView المدمج (403 disallowed_useragent) فكان الزرّ يفشل بلا تفسير
 * أمام زائر الإعلان. الدخول بالإيميل/الموبايل يبقى كما هو.
 *
 * useSyncExternalStore: على السيرفر وأثناء الترطيب = null (يُرسم الزرّ العادي)، ثم القيمة الحقيقية —
 * بلا اختلاف ترطيب وبلا setState داخل effect.
 */
export function InAppBrowserNotice({ children }: { children: ReactNode }) {
  const app = useSyncExternalStore(
    noopSubscribe,
    () => detectInAppBrowser(navigator.userAgent),
    () => null,
  )
  const chromeUrl = useSyncExternalStore(
    noopSubscribe,
    () => (isAndroidUserAgent(navigator.userAgent) ? androidChromeIntentUrl(window.location.href) : null),
    () => null,
  )

  if (!app) return <>{children}</>

  return (
    <div className="rounded-2xl border border-info/30 bg-info/5 p-4 text-sm leading-6 text-foreground" role="note">
      <p className="flex items-start gap-2 font-semibold">
        <Info className="mt-1 h-4 w-4 shrink-0 text-info" />
        إنت فاتح الموقع من جوه {APP_NAME[app]}، والدخول بجوجل مش بيشتغل هنا.
      </p>
      <p className="mt-1 text-muted-foreground">
        سجّل بالإيميل أو رقم الموبايل، أو افتح الموقع في المتصفح وكمّل بجوجل من هناك.
      </p>
      {chromeUrl ? (
        <a
          href={chromeUrl}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-info/40 px-4 py-2 font-semibold text-info hover:bg-info/10"
        >
          <ExternalLink className="h-4 w-4" />
          افتح في Chrome
        </a>
      ) : (
        <p className="mt-2 text-muted-foreground">
          من الآيفون: اضغط ⋯ فوق وبعدين «فتح في المتصفح».
        </p>
      )}
    </div>
  )
}
