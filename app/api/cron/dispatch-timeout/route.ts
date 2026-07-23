import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processExpiredOffers } from "@/lib/delivery/dispatch-timeout"
import { getCurrentUser, hasAdminAccess } from "@/lib/auth/session"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// مكنسة انتهاء مهلة العروض. يستدعيها Vercel Cron (يرسل Authorization: Bearer $CRON_SECRET)،
// أو الأدمن يدويًّا من المتصفّح. تفشل-مغلقة: بلا CRON_SECRET مضبوط لا يمرّ إلا أدمن موثّق.
function secretOk(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const got = request.headers.get("authorization") || ""
  const want = `Bearer ${expected}`
  // مقارنة ثابتة الزمن (بعد تسوية الطول) — لا نُسرّب طول/محتوى السرّ عبر توقيت الردّ.
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function handle(request: Request) {
  let authorized = secretOk(request)
  if (!authorized) {
    try {
      const user = await getCurrentUser()
      authorized = !!user && hasAdminAccess(user.role)
    } catch {
      authorized = false
    }
  }
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    const result = await processExpiredOffers()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logError("[api/cron/dispatch-timeout]", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
