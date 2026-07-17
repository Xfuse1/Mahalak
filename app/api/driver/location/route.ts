import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { updateDriverLocation } from "@/lib/delivery/location"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// رفع موقع السائق الحيّ. مصادَق بكوكي جلسة السائق فقط؛ يحدّث طلباته النشطة له وحده.
export async function POST(request: Request) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  let body: { lat?: number; lng?: number; heading?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 })
  }
  const res = await updateDriverLocation(
    driverId,
    Number(body?.lat),
    Number(body?.lng),
    body?.heading != null ? Number(body.heading) : undefined,
  )
  const status = res.ok ? 200 : res.error === "invalid_coords" ? 400 : 500
  return NextResponse.json(res, { status })
}
