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

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6 text-center">{t("aboutMahalak")}</h1>

          <div className="prose prose-lg max-w-none mb-12">
            <p className="text-xl text-gray-700 text-center mb-8 leading-relaxed">{t("aboutDescription")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <ShoppingBag className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("diverseProducts")}</h3>
                  <p className="text-gray-600 leading-relaxed">{t("diverseProductsDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <Users className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("sellerSupport")}</h3>
                  <p className="text-gray-600 leading-relaxed">{t("sellerSupportDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <TrendingUp className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("continuousGrowth")}</h3>
                  <p className="text-gray-600 leading-relaxed">{t("continuousGrowthDesc")}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <Shield className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("securityAndTrust")}</h3>
                  <p className="text-gray-600 leading-relaxed">{t("securityAndTrustDesc")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-secondary rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">{t("ourVision")}</h2>
            <p className="text-gray-700 leading-relaxed mb-4">{t("visionText1")}</p>
            <p className="text-gray-700 leading-relaxed">{t("visionText2")}</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
