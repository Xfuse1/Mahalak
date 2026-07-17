import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { getAvailableOffers } from "@/lib/drivers/driver-orders"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// العروض المتاحة للسائق (طلبات توزيع معروضة غير مُسنَدة). مصادَق بكوكي جلسة السائق فقط.
export async function GET() {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    const offers = await getAvailableOffers(driverId)
    return NextResponse.json({ offers })
  } catch (err) {
    logError("[api/driver/offers] GET", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
