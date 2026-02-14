import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const next = requestUrl.searchParams.get("next") ?? "/"

  // Validate redirect URL - must be a safe relative path
  const isSafePath = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
  const safePath = isSafePath ? next : "/"

  return NextResponse.redirect(new URL(safePath, requestUrl.origin))
}
