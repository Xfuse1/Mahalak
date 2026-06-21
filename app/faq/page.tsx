"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslation } from "react-i18next"
import { useLanguage } from "@/lib/language-context"
import { HelpCircle, MessageCircle, Phone, Mail, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function FAQPage() {
  const { t } = useTranslation()
  // مساعد ثنائي اللغة t(ar, en) للنصوص غير الموجودة في مفاتيح i18n
  const { t: tt } = useLanguage()

  const faqs = [
    { question: t("faq1Q"), answer: t("faq1A"), icon: "👤" },
    { question: t("faq2Q"), answer: t("faq2A"), icon: "🔍" },
    { question: t("faq3Q"), answer: t("faq3A"), icon: "💳" },
    { question: t("faq4Q"), answer: t("faq4A"), icon: "🚚" },
    { question: t("faq5Q"), answer: t("faq5A"), icon: "🔄" },
    { question: t("faq6Q"), answer: t("faq6A"), icon: "🏪" },
    { question: t("faq7Q"), answer: t("faq7A"), icon: "📦" },
    { question: t("faq8Q"), answer: t("faq8A"), icon: "🔒" },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary mb-6 shadow-lg shadow-primary/30">
              <HelpCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              {t("faqTitle")}
            </h1>
            <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t("faqSubtitle")}
            </p>
          </div>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="bg-white rounded-2xl border-0 shadow-md hover:shadow-lg transition-all duration-300 px-6 overflow-hidden group"
              >
                <AccordionTrigger className="hover:no-underline py-5 gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-2xl">{faq.icon}</span>
                    <span className="font-semibold text-lg text-gray-800 text-right flex-1">
                      {faq.question}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed pb-6 ps-12">
                  <div className="bg-gray-50 rounded-xl p-4 border-s-4 border-primary">
                    {faq.answer}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Contact Section */}
          <div className="mt-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary rounded-3xl" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative p-10 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-6">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{t("faqNotFound")}</h2>
              <p className="text-white/90 mb-8 max-w-md mx-auto leading-relaxed">
                {t("faqContactUs")}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-primary/10 rounded-xl px-8 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  <Phone className="w-5 h-5 me-2" />
                  010 55161600
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="border-2 border-white/30 bg-white/10 text-white hover:bg-white/20 rounded-xl px-8 backdrop-blur-sm"
                >
                  <Mail className="w-5 h-5 me-2" />
                  {tt("راسلنا", "Email")}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🛍️", label: tt("الطلبات", "Orders"), color: "from-primary to-primary" },
              { icon: "💰", label: tt("المدفوعات", "Payments"), color: "from-emerald-500 to-emerald-600" },
              { icon: "🚚", label: tt("التوصيل", "Delivery"), color: "from-amber-500 to-amber-600" },
              { icon: "🔐", label: tt("الحساب", "Account"), color: "from-violet-500 to-violet-600" },
            ].map((item, index) => (
              <div 
                key={index}
                className="group bg-white rounded-2xl p-6 text-center border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer"
              >
                <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <span className="font-medium text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
