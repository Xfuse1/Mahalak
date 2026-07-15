import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// حارس دفاع-في-العمق سيرفر-سايد: يمنع تحميل قشرة صفحات البائع/الحساب بدون كوكي جلسة —
// قبل هذا كانت الحماية على /seller و/account تعتمد كليًا على حارس عميل (useEffect + redirect)
// يمكن تجاوز قشرته بطلب URL مباشر. لا نتحقق من الدور هنا (التحقق الكامل يتم في server actions
// والصفحة). /driver مستثنى: يستخدم آلية جلسة PIN منفصلة (driver_session) تُدار داخل صفحته.
const SESSION_COOKIE = "__session"

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (hasSession) return NextResponse.next()

  const loginUrl = new URL("/auth", request.url)
  loginUrl.searchParams.set("returnUrl", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/seller/:path*", "/account/:path*"],
}
