"use server"

import { getAdminDb } from "../firebase/admin"

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
    console.error("[v0] Error creating notification:", error)
    return { success: false, error: error?.message || "Failed to create notification" }
  }
}

// Get user's notifications
export async function getUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
  try {
    const db = getAdminDb()
    console.log("[v0] Fetching notifications for user:", userId)
    
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
      snapshot = await db
        .collection("notifications")
        .where("user_id", "==", userId)
        .limit(limit * 2) // Get more to have room for sorting
        .get()
    }

    console.log("[v0] Found notifications count:", snapshot.size)

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
    console.error("[v0] Error fetching notifications:", error)
    return []
  }
}

// Get unread notifications count
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const db = getAdminDb()
    const snapshot = await db
      .collection("notifications")
      .where("user_id", "==", userId)
      .where("is_read", "==", false)
      .get()

    return snapshot.size
  } catch (error) {
    console.error("[v0] Error counting notifications:", error)
    return 0
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
  try {
    const db = getAdminDb()
    await db.collection("notifications").doc(notificationId).update({
      is_read: true,
      read_at: new Date().toISOString(),
    })

    return { success: true }
  } catch (error: any) {
    console.error("[v0] Error marking notification as read:", error)
    return { success: false, error: error?.message }
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


