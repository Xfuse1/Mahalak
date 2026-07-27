/* eslint-disable no-undef */
// محلك — Service Worker موحّد: تخزين أوفلاين خفيف + إشعارات FCM في الخلفية.
// عامل واحد لكل النطاق "/" (المتصفح يسمح بعامل نشط واحد لكل نطاق) — فنُدمج الوظيفتين هنا بدل
// تسجيل عاملين متنازعين. التسجيل غير مشروط (الأوفلاين يفيد الجميع)؛ جزء FCM خامل بلا رمز
// (لا يُنشأ رمز إلا بعد ضبط VAPID، فـ onBackgroundMessage لا يُستدعى أصلًا).

const CACHE = "mahalak-v1"
const OFFLINE_URL = "/offline.html"
// نُقدّم أصولًا مستقلّة تمامًا (صفحة أوفلاين بأنماط مضمّنة + أيقونات) كي تظهر صفحة الأوفلاين
// كاملةً حتى بلا شبكة، دون الاعتماد على أصول Next المجزّأة.
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"]

// تخزين مسبق لكل عنوان على حدة (لا addAll الذرّي: فشل أصل واحد كان يُسقط تخزين الباقي كله ويترك
// المستخدم بلا صفحة أوفلاين). كل عنصر مستقل، وفشله يُتجاهل.
async function precache() {
  const c = await caches.open(CACHE)
  await Promise.all(
    PRECACHE.map((u) =>
      fetch(u, { cache: "reload" })
        .then((r) => (r && r.ok ? c.put(u, r) : null))
        .catch(() => {}),
    ),
  )
}

// شفاء ذاتي: لو صفحة الأوفلاين مش مخبّأة (فشل تخزين وقت التثبيت)، نعيد التخزين — فيتعافى العميل
// بلا انتظار نشر جديد.
async function ensureOffline() {
  const hit = await caches.match(OFFLINE_URL)
  if (!hit) await precache()
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch(() => {}))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return // لا نلمس POST (Server Actions / API)
  let url
  try {
    url = new URL(req.url)
  } catch {
    return
  }
  if (url.origin !== self.location.origin) return // نطاق خارجي (gstatic، خرائط…) → للمتصفح مباشرة

  // تنقّلات الصفحات: شبكة-أولًا (محتوى طازج دائمًا عند الاتصال) مع سقوط لصفحة أوفلاين مستقلّة.
  // لا نخزّن HTML/RSC إطلاقًا كي لا يبيت المحتوى الديناميكي. عند نجاح الاتصال نتأكد أن صفحة الأوفلاين
  // مخبّأة (شفاء ذاتي بلا حجب الاستجابة).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          event.waitUntil(ensureOffline())
          return res
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then((r) => r || new Response("", { status: 504, statusText: "Offline" })),
        ),
    )
    return
  }

  // أصول ثابتة مُقدَّمة فقط (الأيقونات + صفحة الأوفلاين): stale-while-revalidate — نرجع المخبّأ فورًا
  // ونحدّثه بالخلفية، فتتحدّث الأصول عبر النشرات بلا رفع رقم إصدار الكاش. كل ما عداها (/_next، /api،
  // RSC، خطوط…) لا نعترضه → شبكة عادية، فلا خطر بيات.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((cached) => {
          const fetching = fetch(req)
            .then((res) => {
              if (res && res.ok) c.put(req, res.clone()).catch(() => {})
              return res
            })
            .catch(() => cached)
          if (cached) event.waitUntil(fetching.catch(() => {}))
          return cached || fetching
        }),
      ),
    )
  }
})

// ===== إشعارات FCM في الخلفية (مدمجة) =====
// نُغلّف تحميل مكتبات gstatic بـ try/catch: لو تعذّر تحميلها (أوفلاين مثلًا) لا يتعطّل العامل ولا
// وظيفة الأوفلاين — إشعارات الدفع تحسين اختياري.
try {
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js")
  importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js")
  // إعداد الويب العام (نفس NEXT_PUBLIC_* المشحونة لكل متصفّح) — العامل لا يقرأ process.env.
  firebase.initializeApp({
    apiKey: "AIzaSyBJl538WLhVGpdSbi5XcPIpdjRWX5N1SrM",
    authDomain: "studio-2837415731-5df0e.firebaseapp.com",
    projectId: "studio-2837415731-5df0e",
    storageBucket: "studio-2837415731-5df0e.firebasestorage.app",
    messagingSenderId: "896018485696",
    appId: "1:896018485696:web:8d12d8c58d6c8095087825",
  })
  firebase.messaging().onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || "محلك"
    const body = (payload.notification && payload.notification.body) || ""
    const link =
      (payload.fcmOptions && payload.fcmOptions.link) || (payload.data && payload.data.link) || "/"
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { link },
    })
  })
} catch (e) {
  // FCM اختياري — الأوفلاين يظلّ يعمل.
}

// نقر الإشعار يفتح/يركّز على الرابط — مستقلّ عن Firebase فنُسجّله دائمًا.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(link) && "focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(link)
      return undefined
    }),
  )
})
