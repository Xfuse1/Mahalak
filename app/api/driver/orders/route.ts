import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { getDriverOrders } from "@/lib/drivers/driver-orders"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// طلبات السائق المُسنَدة إليه. مصادَق بكوكي جلسة السائق فقط (لا نثق بأي معرّف من العميل).
export async function GET() {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    const orders = await getDriverOrders(driverId)
    return NextResponse.json({ orders })
  } catch (err) {
    logError("[api/driver/orders] GET", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}
