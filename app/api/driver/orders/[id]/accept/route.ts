import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { acceptOrderOffer, dispatchErrorStatus } from "@/lib/delivery/dispatch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  const res = await acceptOrderOffer(driverId, id)
  return NextResponse.json(res, { status: res.success ? 200 : dispatchErrorStatus(res.error) })
}
