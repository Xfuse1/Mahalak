"use client"

import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useLanguage } from "@/lib/language-context"
import { Shield, Database, Share2, UserCheck, Cookie, RefreshCw, Phone, Lock, Eye, FileText } from "lucide-react"

export default function PrivacyPage() {
  const { t } = useLanguage()

  const sections = [
    {
      icon: FileText,
      color: "from-primary to-primary",
      title: t("مقدمة", "Introduction"),
      content: t(
        "نحن في محلك نلتزم بحماية خصوصيتك وأمان معلوماتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية البيانات التي تقدمها لنا عند استخدام منصتنا.",
        "At Mahalak, we are committed to protecting your privacy and the security of your personal information. This policy explains how we collect, use, and protect the data you provide when using our platform.",
      )
    },
    {
      icon: Database,
      color: "from-emerald-500 to-emerald-600",
      title: t("المعلومات التي نجمعها", "Information We Collect"),
      content: t("نقوم بجمع الأنواع التالية من المعلومات:", "We collect the following types of information:"),
      list: [
        t("معلومات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف", "Account information: name, email, phone number"),
        t("معلومات الاستخدام: كيفية تفاعلك مع المنصة، المنتجات التي تتصفحها", "Usage information: how you interact with the platform, products you browse"),
        t("معلومات تقنية: عنوان IP، نوع المتصفح، نظام التشغيل", "Technical information: IP address, browser type, operating system"),
      ]
    },
    {
      icon: Eye,
      color: "from-primary to-primary",
      title: t("كيفية استخدام المعلومات", "How We Use Information"),
      content: t("نستخدم المعلومات التي نجمعها للأغراض التالية:", "We use the information we collect for the following purposes:"),
      list: [
        t("معالجة وتنفيذ طلباتك", "Process and fulfill your orders"),
        t("تحسين تجربة المستخدم وتخصيص المحتوى", "Improve user experience and personalize content"),
        t("التواصل معك بشأن طلباتك والعروض الخاصة", "Communicate with you about your orders and special offers"),
        t("حماية المنصة من الاحتيال والأنشطة غير القانونية", "Protect the platform from fraud and illegal activities"),
        t("تحليل استخدام المنصة لتحسين خدماتنا", "Analyze platform usage to improve our services"),
      ]
    },
    {
      icon: Share2,
      color: "from-amber-500 to-amber-600",
      title: t("مشاركة المعلومات", "Information Sharing"),
      content: t(
        "لا نقوم ببيع أو تأجير معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك مع البائعين على المنصة لتنفيذ طلباتك، ومع مزودي الخدمات الذين يساعدوننا في تشغيل المنصة.",
        "We do not sell or rent your personal information to third parties. We may share your information with sellers on the platform to fulfill your orders, and with service providers who help us operate the platform.",
      )
    },
    {
      icon: UserCheck,
      color: "from-rose-500 to-rose-600",
      title: t("حقوقك", "Your Rights"),
      content: t("لديك الحق في:", "You have the right to:"),
      list: [
        t("الوصول إلى معلوماتك الشخصية وتحديثها", "Access and update your personal information"),
        t("طلب حذف حسابك ومعلوماتك", "Request deletion of your account and information"),
        t("الاعتراض على معالجة معلوماتك لأغراض تسويقية", "Object to processing your information for marketing purposes"),
        t("طلب نسخة من بياناتك", "Request a copy of your data"),
      ]
    },
    {
      icon: Cookie,
      color: "from-cyan-500 to-cyan-600",
      title: t("ملفات تعريف الارتباط (Cookies)", "Cookies"),
      content: t(
        "نستخدم ملفات تعريف الارتباط لتحسين تجربتك على المنصة. يمكنك التحكم في ملفات تعريف الارتباط من خلال إعدادات المتصفح الخاص بك.",
        "We use cookies to improve your experience on the platform. You can control cookies through your browser settings.",
      )
    },
    {
      icon: RefreshCw,
      color: "from-primary to-primary",
      title: t("التغييرات على السياسة", "Policy Changes"),
      content: t(
        "قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنقوم بإخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من خلال إشعار على المنصة.",
        "We may update the privacy policy from time to time. We will notify you of any material changes via email or through a notice on the platform.",
      )
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary mb-6 shadow-lg shadow-primary/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
              {t("سياسة الخصوصية", "Privacy Policy")}
            </h1>
            <p className="text-lg text-gray-600 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              {t("آخر تحديث: يونيو 2026", "Last updated: June 2026")}
            </p>
          </div>

          {/* Content Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group"
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <section.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl md:text-2xl font-bold mb-3 text-gray-800">
                        {section.title}
                      </h2>
                      <p className="text-gray-600 leading-relaxed mb-4">
                        {section.content}
                      </p>
                      {section.list && (
                        <ul className="space-y-3">
                          {section.list.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-600">
                              <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${section.color} mt-2 flex-shrink-0`} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* حذف الحساب — الحق المذكور أعلاه، ومعه الطريق اللي ينفّذه فعلًا */}
          <div className="mt-10 rounded-2xl border border-destructive/25 bg-destructive/5 p-6 md:p-8 text-center">
            <h2 className="text-lg md:text-xl font-bold text-foreground mb-2">
              {t("تريد حذف حسابك؟", "Want to delete your account?")}
            </h2>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto text-sm md:text-base">
              {t(
                "تقدر تحذف حسابك وبياناتك الشخصية في أي وقت — من داخل التطبيق مباشرة أو بطلب من الصفحة المخصّصة.",
                "You can delete your account and personal data at any time — from inside the app or via the dedicated page.",
              )}
            </p>
            <Link
              href="/delete-account"
              className="inline-flex items-center justify-center rounded-xl bg-destructive px-6 py-3 font-bold text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              {t("حذف الحساب وبياناتي", "Delete my account and data")}
            </Link>
          </div>

          {/* Contact Section */}
          <div className="mt-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary rounded-3xl" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative p-10 text-center text-white">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4">{t("تواصل معنا", "Contact Us")}</h2>
              <p className="text-white/90 mb-6 max-w-md mx-auto">
                {t(
                  "إذا كان لديك أي أسئلة حول سياسة الخصوصية، يرجى التواصل معنا",
                  "If you have any questions about the privacy policy, please contact us",
                )}
              </p>
              <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-full px-6 py-3">
                <Phone className="w-5 h-5" />
                <span className="font-semibold text-lg">010 55161600</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
