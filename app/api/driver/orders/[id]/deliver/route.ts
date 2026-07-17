import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { driverDeliver, dispatchErrorStatus } from "@/lib/delivery/dispatch"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  let body: { code?: string } = {}
  try {
    body = await request.json()
  } catch {
    // بدون جسم → كود فارغ → يفشله فحص الكود
  }
  const res = await driverDeliver(driverId, id, String(body?.code || ""))
  return NextResponse.json(res, { status: res.success ? 200 : dispatchErrorStatus(res.error) })
}
