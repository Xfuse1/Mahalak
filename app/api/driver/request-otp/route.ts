import { NextResponse } from "next/server"
import { requestDriverOtp } from "@/lib/auth/driver-otp"

// firebase-admin + node:crypto يتطلبان بيئة Node (لا Edge)، وقراءة الهيدر تجعله ديناميكيًا.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 })
  }
  const phone = String(body?.phone || "").trim()
  if (!phone) return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 })

  const result = await requestDriverOtp(phone)
  // نُرجع ok حتى لو لم يكن الرقم سائقًا (منع تعداد الحسابات). خطأ البنية التحتية = 5xx لا 4xx.
  if (!result.ok) {
    const status = result.error === "rate_limited" ? 429 : result.error === "server_error" ? 500 : 400
    return NextResponse.json(result, { status })
  }
  return NextResponse.json(result)
}
