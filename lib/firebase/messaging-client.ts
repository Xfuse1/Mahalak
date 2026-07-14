// عميل FCM لإشعارات الدفع (Web Push) — تسجيل الرمز والاستماع للرسائل في المقدمة.
//
// خامل تمامًا (STRICTLY INERT): كل مدخل هنا يعود مبكرًا إن لم يكن
// NEXT_PUBLIC_FIREBASE_VAPID_KEY مضبوطًا — فبلا المفتاح لا يُطلب إذن، ولا يُسجَّل service
// worker، ولا يُنشأ رمز، ولا يُكتب أي شيء على السيرفر. لا يرمي أبدًا (الأخطاء تُبتلع بـ console.warn).
//
// يُستخدم فقط من مكوّنات العميل (يعتمد على APIs المتصفح: Notification / serviceWorker).
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging"
import { saveFcmToken } from "@/lib/actions/push"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// حارس ضد تسجيل مستمعات onMessage مكرّرة (إعادة دخول السائق، React StrictMode).
let foregroundSubscribed = false

// يعيد استخدام تطبيق Firebase العميل المهيّأ من lib/firebase/client.ts إن وُجد،
// وإلا يُهيّئ واحدًا بنفس قيم NEXT_PUBLIC_*.
function getClientApp(): FirebaseApp {
  if (getApps().length) {
    return getApp()
  }
  return initializeApp(firebaseConfig)
}

/**
 * يطلب إذن الإشعارات ويسجّل رمز FCM على السيرفر. لا-عملية تمامًا بلا VAPID key.
 * لا يرمي أبدًا.
 */
export async function registerForPush(): Promise<void> {
  // حارس الخمول: بلا مفتاح VAPID لا نفعل أي شيء إطلاقًا.
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) return
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return
  if (!("Notification" in window)) return

  try {
    const supported = await isSupported()
    if (!supported) return

    const perm = await Notification.requestPermission()
    if (perm !== "granted") return

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    const messaging = getMessaging(getClientApp())
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })

    if (token) {
      await saveFcmToken(token)
    }
  } catch (error) {
    // لا نرمي أبدًا — الإشعارات تحسين اختياري، لا يجب أن تُعطّل أي تدفّق.
    console.warn("[push] registerForPush failed:", error)
  }
}

/**
 * يستمع لرسائل الدفع أثناء فتح التطبيق (المقدمة) ويبثّها كحدث مخصّص ليعرضها الـUI toast.
 * لا-عملية بلا VAPID key. لا يرمي أبدًا.
 */
export function listenForegroundPush(): void {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) return
  if (typeof window === "undefined") return
  if (!("serviceWorker" in navigator)) return

  // منع تسجيل أكثر من مستمع onMessage عند استدعاء الدالة مرارًا.
  if (foregroundSubscribed) return
  foregroundSubscribed = true

  try {
    const messaging = getMessaging(getClientApp())
    onMessage(messaging, (payload) => {
      try {
        const title = payload.notification?.title || "محلك"
        const body = payload.notification?.body || ""
        const link =
          (payload.fcmOptions as { link?: string } | undefined)?.link || payload.data?.link || "/"
        window.dispatchEvent(
          new CustomEvent("mahalak:push", { detail: { title, body, link } }),
        )
      } catch {
        // تجاهل — عرض الإشعار في المقدمة غير حرج.
      }
    })
  } catch (error) {
    console.warn("[push] listenForegroundPush failed:", error)
  }
}
