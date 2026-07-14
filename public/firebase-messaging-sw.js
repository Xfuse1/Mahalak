/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker (background web-push for new-order alerts).
//
// INERT by construction: this worker is only ever registered by the client AFTER
// NEXT_PUBLIC_FIREBASE_VAPID_KEY is set (see lib/firebase/messaging-client.ts). With no
// VAPID key, no client registers it and no token is saved, so the server never sends a push
// and onBackgroundMessage never fires. Merely shipping this file changes no behavior.
//
// A service worker cannot read process.env, so the (public) Firebase web config is hardcoded
// below — these are exactly the NEXT_PUBLIC_* values already shipped to every browser and are
// safe to expose.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyBJl538WLhVGpdSbi5XcPIpdjRWX5N1SrM",
  authDomain: "studio-2837415731-5df0e.firebaseapp.com",
  projectId: "studio-2837415731-5df0e",
  storageBucket: "studio-2837415731-5df0e.firebasestorage.app",
  messagingSenderId: "896018485696",
  appId: "1:896018485696:web:8d12d8c58d6c8095087825",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "محلك"
  const body = (payload.notification && payload.notification.body) || ""
  const link =
    (payload.fcmOptions && payload.fcmOptions.link) ||
    (payload.data && payload.data.link) ||
    "/"

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { link },
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || "/"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(link) && "focus" in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link)
      }
      return undefined
    }),
  )
})
