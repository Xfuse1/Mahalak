import { NextResponse } from "next/server"
import { clearDriverSession } from "@/lib/auth/driver-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await clearDriverSession()
  return NextResponse.json({ ok: true })
}
