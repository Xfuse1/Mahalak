"use client"

import { memo } from "react"
import Link from "next/link"
import { Facebook, X, Instagram, Mail } from "lucide-react"
import { useLanguage } from "../lib/language-context"

const FooterComponent = () => {
  const { t } = useLanguage()

  return (
    <footer className="bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white mt-16 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* About */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">{t("الرئيسية", "Home")}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{t("منصة محلك - وجهتك الأولى للتسوق من المتاجر المحلية", "Mahalak - Your go-to platform for shopping from local stores")}</p>
            <div className="flex items-center gap-4 pt-4">
              <a
                href="https://www.facebook.com/profile.php?id=61582717256643"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-white/5 hover:bg-blue-600 rounded-xl text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>

              <a
                href="https://x.com/mahalk600"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-white/5 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg"
                aria-label="X"
              >
                <X className="h-5 w-5" />
              </a>

              <a
                href="https://www.tiktok.com/@mahalk600?is_from_webapp=1&sender_device=pc"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-white/5 hover:bg-pink-600 rounded-xl text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-pink-500/20"
                aria-label="TikTok"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d="M448.5 209.9c-44 .1-87-13.6-122.8-39.2l0 178.7c0 33.1-10.1 65.4-29 92.6s-45.6 48-76.6 59.6-64.8 13.5-96.9 5.3-60.9-25.9-82.7-50.8-35.3-56-39-88.9 2.9-66.1 18.6-95.2 40-52.7 69.6-67.7 62.9-20.5 95.7-16l0 89.9c-15-4.7-31.1-4.6-46 .4s-27.9 14.6-37 27.3-14 28.1-13.9 43.9 5.2 31 14.5 43.7 22.4 22.1 37.4 26.9 31.1 4.8 46-.1 28-14.4 37.2-27.1 14.2-28.1 14.2-43.8l0-349.4 88 0c-.1 7.4 .6 14.9 1.9 22.2 3.1 16.3 9.4 31.9 18.7 45.7s21.3 25.6 35.2 34.6c19.9 13.1 43.2 20.1 67 20.1l0 87.4z"/>
                </svg>
              </a>

              <a
                href="https://www.instagram.com/mahalk600/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-white/5 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 rounded-xl text-gray-400 hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-purple-500/20"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg text-white">{t("روابط سريعة", "Quick Links")}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("من نحن", "About Us")}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("الأسئلة الشائعة", "FAQ")}
                </Link>
              </li>
              <li>
                <Link href="/store" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("المتاجر", "Stores")}
                </Link>
              </li>
              <li>
                <Link href="/search" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("المنتجات", "Products")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg text-white">{t("الشروط والسياسات", "Terms & Policies")}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("سياسة الخصوصية", "Privacy Policy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full group-hover:scale-150 transition-transform"></span>
                  {t("شروط الاستخدام", "Terms of Use")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg text-white">{t("اتصل بنا", "Contact Us")}</h4>
            <div className="space-y-3">
              <a href="mailto:contact@mahalk.com" className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
                <div className="p-2 bg-white/5 rounded-lg group-hover:bg-blue-600 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm">contact@mahalk.com</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">{t("© 2025 محلك. جميع الحقوق محفوظة.", "© 2025 Mahalak. All Rights Reserved.")}</p>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span>{t("صنع بـ", "Made with")}</span>
              <span className="text-red-500 animate-pulse">❤️</span>
              <span>{t("في مصر", "in Egypt")}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export const Footer = memo(FooterComponent)
