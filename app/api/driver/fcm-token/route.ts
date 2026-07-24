import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { saveFcmToken, removeFcmToken } from "@/lib/actions/push"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// تسجيل/حذف رمز FCM للسائق من التطبيق (REST بدل server action). الهوية من كوكي جلسة السائق.
// saveFcmToken/removeFcmToken يشتقّان المالك سيرفر-سايد من الجلسة (لا نثق برمز/هوية من العميل).
export async function POST(request: Request) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  let body: { token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  if (typeof body?.token !== "string" || !body.token) {
    return NextResponse.json({ success: false, error: "invalid_token" }, { status: 400 })
  }
  const res = await saveFcmToken(body.token)
  return NextResponse.json(res, { status: res.success ? 200 : 500 })
}

export async function DELETE(request: Request) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  let body: { token?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "bad_request" }, { status: 400 })
  }
  if (typeof body?.token !== "string" || !body.token) {
    return NextResponse.json({ success: false, error: "invalid_token" }, { status: 400 })
  }
  const res = await removeFcmToken(body.token)
  return NextResponse.json(res, { status: res.success ? 200 : 500 })
}
