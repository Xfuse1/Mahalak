import { NextResponse } from "next/server"
import { getCurrentDriverId } from "@/lib/auth/driver-session"
import { updateDriverLocation } from "@/lib/delivery/location"
import { checkRateLimit } from "@/lib/utils/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// رفع موقع السائق الحيّ. مصادَق بكوكي جلسة السائق فقط؛ يحدّث طلباته النشطة التي يرسل معرّفاتها.
export async function POST(request: Request) {
  const driverId = await getCurrentDriverId()
  if (!driverId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })

  // حدّ معدّل لكل سائق: يكبح بثًّا مفرطًا (خطأ عميل حلقي/إساءة) — 20 نبضة/دقيقة تكفي بهامش لدورة
  // ~30-60ث مع خانق العميل (12ث). مفتاحه يتضمّن معرّف السائق فلا يتشارك السائقون خلف NAT واحدًا.
  if (!(await checkRateLimit(`driver-loc:${driverId}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 })
  }

  let body: { lat?: unknown; lng?: unknown; heading?: unknown; order_ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 })
  }
  // نرفض الأنواع غير الرقمية قبل أي تحويل: Number('')/Number([])/Number(false) = 0 كانت تمرّر
  // كإحداثي صفري زائف. نطلب أرقامًا فعلية فقط.
  if (typeof body?.lat !== "number" || typeof body?.lng !== "number") {
    return NextResponse.json({ ok: false, updated: 0, error: "invalid_coords" }, { status: 400 })
  }
  const heading = typeof body?.heading === "number" ? body.heading : undefined
  const orderIds = Array.isArray(body?.order_ids)
    ? (body.order_ids as unknown[]).filter((x): x is string => typeof x === "string")
    : []

  const res = await updateDriverLocation(driverId, body.lat, body.lng, heading, orderIds)
  const status = res.ok ? 200 : res.error === "invalid_coords" ? 400 : 500
  return NextResponse.json(res, { status })
}
