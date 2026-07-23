"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUid } from "@/lib/auth/session"
import { respondToDriverBid } from "@/lib/delivery/bids"

// ردّ العميل على عرض سعر سائق. الهوية تُشتق سيرفر-سايد من الجلسة — لا نثق بأي معرّف من العميل،
// والملكية تُعاد فحصها داخل المعاملة.
export async function respondToBid(orderId: string, driverId: string, accept: boolean) {
  const uid = await getCurrentUid()
  if (!uid) return { success: false, error: "unauthenticated" }
  if (typeof orderId !== "string" || !orderId || typeof driverId !== "string" || !driverId) {
    return { success: false, error: "bad_request" }
  }
  const res = await respondToDriverBid(uid, orderId, driverId, accept === true)
  if (res.success) revalidatePath("/account")
  return res
}
