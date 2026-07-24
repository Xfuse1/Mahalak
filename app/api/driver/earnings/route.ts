import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { getDriverEarnings } from "@/lib/drivers/driver-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ملخّص محفظة السائق (COD). مصادَق بكوكي جلسة السائق فقط.
export async function GET() {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const earnings = await getDriverEarnings(driverId)
  return NextResponse.json({ earnings })
}
