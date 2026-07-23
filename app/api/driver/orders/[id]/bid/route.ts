import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { submitDriverBid } from "@/lib/delivery/bids"
import { dispatchErrorStatus } from "@/lib/delivery/dispatch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// عرض سعر مضاد من السائق على طلب معروض. مصادَق بكوكي جلسة السائق فقط.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  let body: { price?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  // نرفض الأنواع غير الرقمية قبل التحويل (Number('')/[] = 0 لا يمرّ كسعر).
  if (typeof body?.price !== "number" || !Number.isFinite(body.price)) {
    return NextResponse.json({ success: false, error: "invalid_price" }, { status: 400 })
  }
  const reason = typeof body?.reason === "string" ? body.reason : ""
  const res = await submitDriverBid(driverId, id, body.price, reason)
  return NextResponse.json(res, { status: res.success ? 200 : dispatchErrorStatus(res.error) })
}
