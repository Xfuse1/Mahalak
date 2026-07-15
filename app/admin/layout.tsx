import type React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser, hasAdminAccess } from "@/lib/auth/session"
import { Logo } from "@/components/logo"

// ADM-01: حارس مساحة الإدارة — يتحقق سيرفر-سايد من دور إداري (admin أو superAdmin) قبل تسليم أي صفحة.
// حرِج: قبلًا كان يقبل "admin" فقط، فيُقفَل حسابات superAdmin (المالك) خارج اللوحة — أُصلح هنا.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || !hasAdminAccess(user.role)) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-40 bg-[oklch(0.30_0.05_155)] text-white shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-auto" />
            <span className="font-bold">لوحة الإدارة</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">لوحة التحكم</Link>
            <Link href="/admin/orders" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الطلبات</Link>
            <Link href="/admin/stores" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">المتاجر</Link>
            <Link href="/admin/categories" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الفئات</Link>
            <Link href="/admin/drivers" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">السائقون</Link>
            <Link href="/admin/accounts" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الحسابات</Link>
            <Link href="/admin/complaints" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الشكاوى</Link>
            <Link href="/admin/commission-settings" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">العمولات</Link>
            <Link href="/admin/migrations" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">ترحيل البيانات</Link>
            {/* إدارة المسؤولين: superAdmin فقط (البوابة الحقيقية في الأفعال + الصفحة). */}
            {user.isSuperAdmin && (
              <Link href="/admin/manage-admins" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">إدارة المسؤولين</Link>
            )}
            <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الموقع</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-5xl">{children}</main>
    </div>
  )
}
