"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslation } from "react-i18next"

export default function FAQPage() {
  const { t } = useTranslation()

  const faqs = [
    { question: t("faq1Q"), answer: t("faq1A") },
    { question: t("faq2Q"), answer: t("faq2A") },
    { question: t("faq5Q"), answer: t("faq5A") },
    { question: t("faq6Q"), answer: t("faq6A") },
    { question: t("faq7Q"), answer: t("faq7A") },
    { question: t("faq8Q"), answer: t("faq8A") },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-4 text-center">{t("faqTitle")}</h1>
          <p className="text-xl text-gray-600 text-center mb-12 leading-relaxed">{t("faqSubtitle")}</p>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-white rounded-lg border px-6">
                <AccordionTrigger className="text-right hover:no-underline py-4">
                  <span className="font-semibold text-lg">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 leading-relaxed pb-4">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 bg-secondary rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">{t("faqNotFound")}</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">{t("faqContactUs")}</p>
            <p className="text-[#1F478B] font-semibold text-lg">{t("phone")}: 010 55161600</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
