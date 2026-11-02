import Script from "next/script"

// سكربتات القياس الخارجية (مكوّن سيرفر يُرسم في الـ root layout).
//
// البكسل كان يُحمَّل بعد ضغط «قبول» في بانر الكوكيز فقط (وبعد تحميل وترطيب JS الصفحة)، فمن يتجاهل
// البانر أو يرفضه أو يغادر قبل اكتمال التحميل لم يكن يُحسب إطلاقًا. القرار (المالك + المحامي،
// 2026-11-02): البكسل يعمل لكل زائر من أول صفحة، والبانر أُزيل.
//
// وسم البكسل نفسه يُرسم مباشرة في app/layout.tsx (beforeInteractive يجب أن يكون في الـ root layout
// نفسه): صغير ولا يحجب الرسم (fbevents.js يُحمَّل async)، وتشغيله قبل الترطيب يعني أن PageView
// يُسجَّل حتى لزائر الـ 3G الذي يغادر قبل اكتمال JavaScript. التنقّل الداخلي (pushState) يُطلق
// PageView تلقائيًا من fbevents.js — مقيس — فلا متتبّع مسارات يدوي.
//
// كل معرّف يُتحقَّق من شكله قبل حقنه داخل سكربت inline: قيمة env خاطئة لا تتحوّل إلى كود.

const PIXEL_ID = /^\d{5,20}$/.test(process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID || "")
  ? process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
  : null

/** نص وسم Meta Pixel الأساسي، أو null بلا معرّف صالح. */
export function metaPixelSnippet(): string | null {
  if (!PIXEL_ID) return null
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`
}

// Microsoft Clarity: تسجيلات الجلسات + خرائط الضغط + الضغطات الغاضبة/الميتة + أخطاء JS.
const CLARITY_ID = /^[a-z0-9]{5,20}$/i.test(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || "")
  ? process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
  : null

// Sentry Loader Script (من إعدادات المشروع ← Client Keys ← Loader Script): سكربت صغير يحمّل
// الـ SDK الكامل عند أول خطأ فقط — بلا حزمة npm ولا تعديل next.config.
const SENTRY_LOADER_URL = /^https:\/\/js(-[a-z]{2})?\.sentry-cdn\.com\/[a-f0-9]{32}\.min\.js$/.test(
  process.env.NEXT_PUBLIC_SENTRY_LOADER_URL || "",
)
  ? process.env.NEXT_PUBLIC_SENTRY_LOADER_URL
  : null

export function AnalyticsScripts() {
  return (
    <>
      {CLARITY_ID && (
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`,
          }}
        />
      )}

      {SENTRY_LOADER_URL && (
        <Script id="sentry-loader" strategy="afterInteractive" src={SENTRY_LOADER_URL} crossOrigin="anonymous" />
      )}
    </>
  )
}
