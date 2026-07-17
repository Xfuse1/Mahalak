import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { getDriverPublicProfile } from "@/lib/drivers/driver-repo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// يؤكّد جلسة السائق ويرجّع ملفه العام — يستخدمه التطبيق للتحقق من الدخول عند الإقلاع.
export async function GET() {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ authenticated: false }, { status: 401 })
  const driver = await getDriverPublicProfile(driverId)
  if (!driver) return NextResponse.json({ authenticated: false }, { status: 401 })
  return NextResponse.json({ authenticated: true, driver })
}
