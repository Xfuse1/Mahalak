import type React from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { Logo } from "@/components/logo"

// ADM-01: حارس مساحة الإدارة — يتحقق من دور admin سيرفر-سايد قبل تسليم أي صفحة.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || user.role !== "admin") {
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
            <Link href="/admin/complaints" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الشكاوى</Link>
            <Link href="/admin/commission-settings" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">العمولات</Link>
            <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-white/15 transition-colors">الموقع</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-5xl">{children}</main>
    </div>
  )
}
