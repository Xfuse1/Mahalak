import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { rejectOrderOffer, dispatchErrorStatus } from "@/lib/delivery/dispatch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  let body: { reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    // بدون جسم → سبب فارغ → يرفضه المنطق (السبب إجباري)
  }
  const res = await rejectOrderOffer(driverId, id, String(body?.reason || ""))
  return NextResponse.json(res, { status: res.success ? 200 : dispatchErrorStatus(res.error) })
}
