import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processQueuedImages } from "@/lib/import/images"
import { getCurrentUser, hasAdminAccess } from "@/lib/auth/session"
import { logError } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// مكنسة جلب صور الاستيراد على دفعات. يستدعيها الكرون (Authorization: Bearer $CRON_SECRET) أو الأدمن
// يدويًّا. تفشل-مغلقة: بلا CRON_SECRET لا يمرّ إلا أدمن موثّق. (نفس نمط cron/dispatch-timeout.)
function secretOk(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const got = request.headers.get("authorization") || ""
  const a = Buffer.from(got)
  const b = Buffer.from(`Bearer ${expected}`)
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
    const result = await processQueuedImages()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logError("[api/cron/import-images]", err)
    return NextResponse.json({ error: "server_error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}
export async function POST(request: Request) {
  return handle(request)
}
