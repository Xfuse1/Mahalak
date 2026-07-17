import { NextResponse } from "next/server"
import { verifyDriverOtp } from "@/lib/auth/driver-otp"
import { createDriverSession } from "@/lib/auth/driver-session"
import { getDriverPublicProfile } from "@/lib/drivers/driver-repo"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { phone?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  const phone = String(body?.phone || "").trim()
  const code = String(body?.code || "").trim()
  if (!phone || !code) {
    return NextResponse.json({ success: false, error: "missing_fields" }, { status: 400 })
  }

  const result = await verifyDriverOtp(phone, code)
  if (!result.success || !result.driverId) {
    // كبح الـIP لا يميّز السائق (ينطبق على الجميع) → 429. خطأ بنية تحتية → 500. رقم غير صالح → 400.
    // كل فشل تحقّق آخر (كود غلط/منتهٍ/مقفول) يُرجَّع موحّدًا invalid_code/401 حتى لا يميّز السائق عن غيره.
    if (result.error === "rate_limited") return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 })
    if (result.error === "server_error") return NextResponse.json({ success: false, error: "server_error" }, { status: 500 })
    if (result.error === "invalid_phone") return NextResponse.json({ success: false, error: "invalid_phone" }, { status: 400 })
    return NextResponse.json({ success: false, error: "invalid_code" }, { status: 401 })
  }

  // نتأكد أن السائق ما زال متاحًا (لم يُعطَّل/يُرفَض بين طلب الكود والتحقق) قبل إصدار الجلسة، ونحرس
  // إنشاء الجلسة بـ try/catch حتى لا يتحوّل خطأ عابر إلى 500 غير معالَج بعد استهلاك الكود.
  const driver = await getDriverPublicProfile(result.driverId)
  if (!driver) {
    return NextResponse.json({ success: false, error: "driver_unavailable" }, { status: 403 })
  }
  try {
    // إصدار جلسة السائق (كوكي httpOnly) — يُبطل أي جلسة سابقة لنفس السائق.
    await createDriverSession(result.driverId)
  } catch (err) {
    logError("[verify-otp] createDriverSession", err)
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 })
  }
  return NextResponse.json({ success: true, driver })
}
