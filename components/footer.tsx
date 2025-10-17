"use client"

import Link from "next/link"
import { Facebook } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-xl font-bold mb-4">{t("محلك", "Mahalak")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t(
                "منصة التجارة الإلكترونية الرائدة للمنتجات والمتاجر المحلية",
                "The leading e-commerce platform for local products and stores",
              )}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">{t("روابط سريعة", "Quick Links")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors">
                  {t("عن محلك", "About Mahalak")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white transition-colors">
                  {t("الأسئلة الشائعة", "FAQ")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">{t("الشروط والسياسات", "Terms & Policies")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                  {t("سياسة الخصوصية", "Privacy Policy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                  {t("شروط الاستخدام", "Terms of Use")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">{t("تواصل معنا", "Contact Us")}</h4>
            <ul className="space-y-2 text-sm">
              <li className="text-gray-400">
                <span className="font-medium text-white">{t("الهاتف:", "Phone:")}</span> 01055161600
              </li>
              <li>
                <a
                  href="https://www.facebook.com/share/19sWnVjRPD/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                  <span>{t("فيسبوك", "Facebook")}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>
            © {new Date().getFullYear()} {t("محلك. جميع الحقوق محفوظة.", "Mahalak. All rights reserved.")}
          </p>
        </div>
      </div>
    </footer>
  )
}
