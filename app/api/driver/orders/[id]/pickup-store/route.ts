import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { driverPickupStore, dispatchErrorStatus } from "@/lib/delivery/dispatch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// استلام متجر واحد في طلب توزيع متعدد المتاجر. مصادَق بكوكي جلسة السائق فقط.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  let body: { store_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  if (typeof body?.store_id !== "string" || !body.store_id) {
    return NextResponse.json({ success: false, error: "invalid_store" }, { status: 400 })
  }
  const res = await driverPickupStore(driverId, id, body.store_id)
  return NextResponse.json(res, { status: res.success ? 200 : dispatchErrorStatus(res.error) })
}
