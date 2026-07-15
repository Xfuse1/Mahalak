// وحدة خادوم داخلية (بدون توجيه "use server") — ليست نقطة RPC عامة.
// إنشاء الإشعارات يجب أن يُستدعى فقط من أكشنات خادوم موثوقة (طلبات/أدمن/شكاوى)؛ تصديره من ملف
// "use server" كان يكشفه كنقطة نهاية عامة بلا مصادقة → تلفيق/إغراق إشعارات. النقل هنا يمنع ذلك.
import { getAdminDb } from "./firebase/admin"
import { logError } from "./logger"
import type { Notification } from "./actions/notifications"

// Create a notification
export async function createNotification(data: {
  user_id: string
  title: string
  title_en?: string
  message: string
  message_en?: string
  type: Notification["type"]
  link?: string
  data?: Record<string, any>
}) {
  try {
    const db = getAdminDb()
    const now = new Date().toISOString()

    const notificationRef = await db.collection("notifications").add({
      ...data,
      is_read: false,
      created_at: now,
    })

    return { success: true, id: notificationRef.id }
  } catch (error: any) {
    logError("[v0] Error creating notification:", error)
    return { success: false, error: error?.message || "Failed to create notification" }
  }
}

// Send review request notification when order is delivered
export async function sendReviewRequestNotification(data: {
  user_id: string
  order_id: string
  driver_name?: string
}) {
  return createNotification({
    user_id: data.user_id,
    title: "تم توصيل طلبك بنجاح! 🎉",
    title_en: "Your order has been delivered! 🎉",
    message: `شكراً لك! يرجى تقييم تجربتك مع ${data.driver_name || "السائق"} والمنتجات`,
    message_en: `Thank you! Please rate your experience with ${data.driver_name || "the driver"} and products`,
    type: "review_request",
    link: `/review/${data.order_id}`,
    data: {
      order_id: data.order_id,
      driver_name: data.driver_name,
    },
  })
}
