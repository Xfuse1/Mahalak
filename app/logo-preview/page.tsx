"use client"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function LogoPreviewPage() {
  return (
    <div className="min-h-screen bg-secondary py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">اختر تصميم اللوجو المفضل</h1>
          <p className="text-gray-600 text-lg">تم تصميم 4 خيارات مختلفة للوجو مع دمج عربة التوصيل في حرف الكاف</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Design 1 */}
          <Card>
            <CardHeader>
              <CardTitle>التصميم الأول</CardTitle>
              <CardDescription>عربة التوصيل مدمجة في ذيل حرف الكاف</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center bg-white p-12">
              <Logo variant={1} className="w-full h-24" />
            </CardContent>
          </Card>

          {/* Design 2 */}
          <Card>
            <CardHeader>
              <CardTitle>التصميم الثاني</CardTitle>
              <CardDescription>عربة مبسطة كعنصر زخرفي فوق حرف الكاف</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center bg-white p-12">
              <Logo variant={2} className="w-full h-24" />
            </CardContent>
          </Card>

          {/* Design 3 */}
          <Card>
            <CardHeader>
              <CardTitle>التصميم الثالث</CardTitle>
              <CardDescription>عجلات العربة كجزء من بنية حرف الكاف</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center bg-white p-12">
              <Logo variant={3} className="w-full h-24" />
            </CardContent>
          </Card>

          {/* Design 4 */}
          <Card>
            <CardHeader>
              <CardTitle>التصميم الرابع</CardTitle>
              <CardDescription>عربة هندسية حديثة تشكل ذيل حرف الكاف</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center bg-white p-12">
              <Logo variant={4} className="w-full h-24" />
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="bg-[#1F478B] hover:bg-[#1a3a70]">
            <Link href="/">العودة للصفحة الرئيسية</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
