"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useLanguage } from "@/lib/language-context"

export default function PrivacyPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">{t("سياسة الخصوصية", "Privacy Policy")}</h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">{t("مقدمة", "Introduction")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "نحن في محلك نلتزم بحماية خصوصيتك وأمان معلوماتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية البيانات التي تقدمها لنا عند استخدام منصتنا.",
                  "At Mahalak, we are committed to protecting your privacy and the security of your personal information. This policy explains how we collect, use, and protect the data you provide when using our platform.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("المعلومات التي نجمعها", "Information We Collect")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t("نقوم بجمع الأنواع التالية من المعلومات:", "We collect the following types of information:")}
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>
                  {t(
                    "معلومات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف",
                    "Account information: name, email, phone number",
                  )}
                </li>
                <li>
                  {t(
                    "معلومات الاستخدام: كيفية تفاعلك مع المنصة، المنتجات التي تتصفحها",
                    "Usage information: how you interact with the platform, products you browse",
                  )}
                </li>
                <li>
                  {t(
                    "معلومات تقنية: عنوان IP، نوع المتصفح، نظام التشغيل",
                    "Technical information: IP address, browser type, operating system",
                  )}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("كيفية استخدام المعلومات", "How We Use Information")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t(
                  "نستخدم المعلومات التي نجمعها للأغراض التالية:",
                  "We use the information we collect for the following purposes:",
                )}
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>{t("معالجة وتنفيذ طلباتك", "Process and fulfill your orders")}</li>
                <li>{t("تحسين تجربة المستخدم وتخصيص المحتوى", "Improve user experience and personalize content")}</li>
                <li>
                  {t(
                    "التواصل معك بشأن طلباتك والعروض الخاصة",
                    "Communicate with you about your orders and special offers",
                  )}
                </li>
                <li>
                  {t(
                    "حماية المنصة من الاحتيال والأنشطة غير القانونية",
                    "Protect the platform from fraud and illegal activities",
                  )}
                </li>
                <li>{t("تحليل استخدام المنصة لتحسين خدماتنا", "Analyze platform usage to improve our services")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("مشاركة المعلومات", "Information Sharing")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "لا نقوم ببيع أو تأجير معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك مع البائعين على المنصة لتنفيذ طلباتك، ومع مزودي الخدمات الذين يساعدوننا في تشغيل المنصة.",
                  "We do not sell or rent your personal information to third parties. We may share your information with sellers on the platform to fulfill your orders, and with service providers who help us operate the platform.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("حقوقك", "Your Rights")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">{t("لديك الحق في:", "You have the right to:")}</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>{t("الوصول إلى معلوماتك الشخصية وتحديثها", "Access and update your personal information")}</li>
                <li>{t("طلب حذف حسابك ومعلوماتك", "Request deletion of your account and information")}</li>
                <li>
                  {t(
                    "الاعتراض على معالجة معلوماتك لأغراض تسويقية",
                    "Object to processing your information for marketing purposes",
                  )}
                </li>
                <li>{t("طلب نسخة من بياناتك", "Request a copy of your data")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("ملفات تعريف الارتباط (Cookies)", "Cookies")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "نستخدم ملفات تعريف الارتباط لتحسين تجربتك على المنصة. يمكنك التحكم في ملفات تعريف الارتباط من خلال إعدادات المتصفح الخاص بك.",
                  "We use cookies to improve your experience on the platform. You can control cookies through your browser settings.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("التغييرات على السياسة", "Policy Changes")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنقوم بإخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من خلال إشعار على المنصة.",
                  "We may update the privacy policy from time to time. We will notify you of any material changes via email or through a notice on the platform.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("تواصل معنا", "Contact Us")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "إذا كان لديك أي أسئلة حول سياسة الخصوصية، يرجى التواصل معنا على الهاتف: 010 55161600",
                  "If you have any questions about the privacy policy, please contact us at: 010 55161600",
                )}
              </p>
            </section>

            <p className="text-sm text-gray-600 mt-8">{t("آخر تحديث: يناير 2024", "Last updated: January 2024")}</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
