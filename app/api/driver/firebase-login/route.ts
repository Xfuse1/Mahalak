import { NextResponse } from "next/server"
import { verifyFirebaseDriver } from "@/lib/auth/driver-firebase"
import { createDriverSession } from "@/lib/auth/driver-session"
import { getDriverPublicProfile } from "@/lib/drivers/driver-repo"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// دخول السائق عبر Firebase Phone Auth: يستقبل ID token من التطبيق، يتحقق ويطابق السائق، ثم يصدر
// كوكي driver_session (التطبيق يقرأ Set-Cookie ويخزّنه ويعيد إرساله). نفس نقاط /api/driver/* تقرأه.
export async function POST(request: Request) {
  let body: { idToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  const idToken = String(body?.idToken || "")
  const res = await verifyFirebaseDriver(idToken)
  if (!res.ok || !res.driverId) {
    const status = res.error === "not_a_driver" ? 403 : res.error === "no_phone" || res.error === "missing_token" ? 400 : 401
    return NextResponse.json({ success: false, error: res.error }, { status })
  }
  // نتأكد أن السائق ما زال متاحًا (غير معطَّل/مرفوض) قبل إصدار الجلسة.
  const driver = await getDriverPublicProfile(res.driverId)
  if (!driver) return NextResponse.json({ success: false, error: "driver_unavailable" }, { status: 403 })
  try {
    await createDriverSession(res.driverId)
  } catch (e) {
    logError("[firebase-login] createDriverSession", e)
    return NextResponse.json({ success: false, error: "server_error" }, { status: 500 })
  }
  return NextResponse.json({ success: true, driver })
}
