"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Monitor, ExternalLink, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function QPOSPage() {
  const [qposUrl, setQposUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if QPOS backend URL is configured
    const url = process.env.NEXT_PUBLIC_QPOS_URL
    if (url) {
      setQposUrl(url)
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="mb-6">
            <BackButton />
          </div>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Monitor className="h-7 w-7" />
                نظام نقاط البيع QPOS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {qposUrl ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                    <Monitor className="h-10 w-10 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      نظام QPOS جاهز
                    </h3>
                    <p className="text-gray-600 mb-6">
                      اضغط على الزر أدناه للدخول إلى نظام نقاط البيع
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl px-8 py-6 text-lg shadow-lg"
                  >
                    <a href={qposUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="ml-2 h-5 w-5" />
                      فتح نظام QPOS
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-10 w-10 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      النظام غير مفعل
                    </h3>
                    <p className="text-gray-600 mb-4">
                      نظام QPOS يحتاج إلى تكوين من قبل مدير النظام.
                    </p>
                    <p className="text-sm text-gray-500">
                      يرجى التواصل مع الدعم الفني لتفعيل النظام.
                    </p>
                  </div>
                  <div className="pt-4 border-t">
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link href="/seller/dashboard">
                        <Settings className="ml-2 h-4 w-4" />
                        العودة للوحة التحكم
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
