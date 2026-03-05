"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingBag, Users, TrendingUp, Shield } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function AboutPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-gray-800 via-blue-700 to-blue-600 bg-clip-text text-transparent mb-4">{t("aboutMahalak")}</h1>
            <p className="text-base md:text-lg lg:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">{t("aboutDescription")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <ShoppingBag className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{t("diverseProducts")}</h3>
                  <p className="text-gray-500 leading-relaxed">{t("diverseProductsDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{t("sellerSupport")}</h3>
                  <p className="text-gray-500 leading-relaxed">{t("sellerSupportDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-5 rounded-2xl mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{t("continuousGrowth")}</h3>
                  <p className="text-gray-500 leading-relaxed">{t("continuousGrowthDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-2xl mb-5 shadow-lg group-hover:scale-110 transition-transform">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-800">{t("securityAndTrust")}</h3>
                  <p className="text-gray-500 leading-relaxed">{t("securityAndTrustDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-6 md:p-8 lg:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-5">{t("ourVision")}</h2>
              <p className="text-white/90 leading-relaxed mb-4 text-base md:text-lg">{t("visionText1")}</p>
              <p className="text-white/90 leading-relaxed text-base md:text-lg">{t("visionText2")}</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
