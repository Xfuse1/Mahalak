import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { setDriverAvailability } from "@/lib/drivers/driver-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// تبديل حالة توفّر السائق (متاح/مش متاح). مصادَق بكوكي جلسة السائق فقط.
export async function POST(request: Request) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  let body: { online?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 })
  }
  if (typeof body?.online !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 })
  }
  const res = await setDriverAvailability(driverId, body.online)
  return NextResponse.json(res, { status: res.ok ? 200 : 500 })
}
