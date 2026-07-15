"use server"

import { getAdminDb } from "../firebase/admin"
import { logError } from "../logger"
import { getCurrentUid } from "../auth/session"

export type Notification = {
  id: string
  user_id: string
  title: string
  title_en?: string
  message: string
  message_en?: string
  type: "order_delivered" | "order_status" | "review_request" | "promotion" | "general" 
    | "new_order" | "new_multi_order" | "store_confirmed" | "store_rejected" | "all_items_picked" | "driver_picked_from_store" | "order_updated" | "driver_rejected"
  link?: string
  is_read: boolean
  data?: Record<string, any>
  created_at?: string
}

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

// Get user's notifications
export async function getUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
  try {
    // إشعارات المستخدم خاصة به فقط — نشتق الهوية من الجلسة ولا نثق بـ userId القادم من العميل
    const uid = await getCurrentUid()
    if (!uid || uid !== userId) return []
    const db = getAdminDb()
    
    // Try with orderBy first (requires composite index)
    let snapshot
    try {
      snapshot = await db
        .collection("notifications")
        .where("user_id", "==", userId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .get()
    } catch (indexError: any) {
      // If index error, fallback to simple query and sort in memory
      console.warn("[v0] Index not found for notifications, falling back to simple query:", indexError?.message)
      // بدون limit صغير: نجلب نطاقًا أوسع ثم نرتّب في الذاكرة كي لا تخرج الأحدث من النافذة
      snapshot = await db
        .collection("notifications")
        .where("user_id", "==", userId)
        .limit(200)
        .get()
    }

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString?.() || doc.data().created_at,
    })) as Notification[]
    
    // Sort by created_at desc and limit
    notifications.sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    
    return notifications.slice(0, limit)
  } catch (error) {
    logError("[v0] Error fetching notifications:", error)
    return []
  }
}

// Get unread notifications count
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const uid = await getCurrentUid()
    if (!uid || uid !== userId) return 0
    const db = getAdminDb()
    const snapshot = await db
      .collection("notifications")
      .where("user_id", "==", userId)
      .where("is_read", "==", false)
      .get()

    return snapshot.size
  } catch (error) {
    logError("[v0] Error counting notifications:", error)
    return 0
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
  try {
    const uid = await getCurrentUid()
    if (!uid) return { success: false, error: "Unauthorized" }
    const db = getAdminDb()
    const ref = db.collection("notifications").doc(notificationId)
    // نتحقق أن الإشعار يخص المستخدم الحالي قبل تعديله (منع IDOR)
    const snap = await ref.get()
    if (!snap.exists || snap.data()?.user_id !== uid) {
      return { success: false, error: "Unauthorized" }
    }
    await ref.update({
      is_read: true,
      read_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (error: any) {
    logError("[v0] Error marking notification as read:", error)
    return { success: false, error: error?.message }
  }
}

// Mark all unread notifications as read for a user
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const uid = await getCurrentUid()
    if (!uid || uid !== userId) return { success: false, error: "Unauthorized" }
    const db = getAdminDb()
    const unreadSnapshot = await db
      .collection("notifications")
      .where("user_id", "==", userId)
      .where("is_read", "==", false)
      .get()

    if (unreadSnapshot.empty) {
      return { success: true, updated: 0 }
    }

    const batch = db.batch()
    const readAt = new Date().toISOString()

    unreadSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        is_read: true,
        read_at: readAt,
      })
    })

    await batch.commit()
    return { success: true, updated: unreadSnapshot.size }
  } catch (error: any) {
    logError("[v0] Error marking all notifications as read:", error)
    return { success: false, error: error?.message || "Failed to mark all notifications as read" }
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


