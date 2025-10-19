"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useLanguage } from "@/lib/language-context"

export default function TermsPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">{t("شروط الاستخدام", "Terms of Use")}</h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">{t("مقدمة", "Introduction")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "مرحباً بك في محلك. باستخدامك لهذه المنصة، فإنك توافق على الالتزام بشروط الاستخدام التالية. يرجى قراءة هذه الشروط بعناية قبل استخدام خدماتنا.",
                  "Welcome to Mahalak. By using this platform, you agree to comply with the following terms of use. Please read these terms carefully before using our services.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("استخدام المنصة", "Platform Use")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t("عند استخدام محلك، فإنك توافق على:", "When using Mahalak, you agree to:")}
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>
                  {t(
                    "تقديم معلومات دقيقة وصحيحة عند إنشاء حسابك",
                    "Provide accurate and correct information when creating your account",
                  )}
                </li>
                <li>
                  {t(
                    "الحفاظ على سرية معلومات حسابك وكلمة المرور",
                    "Maintain the confidentiality of your account information and password",
                  )}
                </li>
                <li>
                  {t(
                    "عدم استخدام المنصة لأي أغراض غير قانونية أو احتيالية",
                    "Not use the platform for any illegal or fraudulent purposes",
                  )}
                </li>
                <li>
                  {t("احترام حقوق الملكية الفكرية للآخرين", "Respect the intellectual property rights of others")}
                </li>
                <li>
                  {t(
                    "عدم محاولة الوصول غير المصرح به إلى أنظمة المنصة",
                    "Not attempt unauthorized access to platform systems",
                  )}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("حسابات المستخدمين", "User Accounts")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك. يجب عليك إخطارنا فوراً بأي استخدام غير مصرح به لحسابك. نحتفظ بالحق في تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط.",
                  "You are responsible for all activities conducted through your account. You must notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate your account if you violate these terms.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("الطلبات والمدفوعات", "Orders and Payments")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t("عند تقديم طلب على محلك، فإنك توافق على:", "When placing an order on Mahalak, you agree to:")}
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>
                  {t(
                    "دفع السعر المحدد للمنتجات بالإضافة إلى أي رسوم شحن أو ضرائب",
                    "Pay the specified price for products plus any shipping fees or taxes",
                  )}
                </li>
                <li>{t("تقديم معلومات دقيقة للتوصيل والدفع", "Provide accurate delivery and payment information")}</li>
                <li>
                  {t("استلام المنتجات في الوقت والمكان المحددين", "Receive products at the specified time and place")}
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                {t(
                  "نحتفظ بالحق في رفض أو إلغاء أي طلب لأسباب تشمل عدم توفر المنتج، أخطاء في التسعير، أو الاشتباه في نشاط احتيالي.",
                  "We reserve the right to refuse or cancel any order for reasons including product unavailability, pricing errors, or suspected fraudulent activity.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("الإرجاع والاسترداد", "Returns and Refunds")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن تكون في حالتها الأصلية. سيتم استرداد المبلغ خلال 7-14 يوم عمل بعد استلام المنتج المرتجع. قد تختلف سياسات الإرجاع حسب البائع.",
                  "You can return products within 14 days of receipt, provided they are in their original condition. Refunds will be processed within 7-14 business days after receiving the returned product. Return policies may vary by seller.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("مسؤوليات البائعين", "Seller Responsibilities")}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t("إذا كنت بائعاً على محلك، فإنك توافق على:", "If you are a seller on Mahalak, you agree to:")}
              </p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>
                  {t(
                    "تقديم معلومات دقيقة وصادقة عن منتجاتك",
                    "Provide accurate and honest information about your products",
                  )}
                </li>
                <li>{t("الالتزام بمعايير الجودة والخدمة", "Comply with quality and service standards")}</li>
                <li>{t("معالجة الطلبات وشحنها في الوقت المحدد", "Process and ship orders on time")}</li>
                <li>
                  {t("الامتثال لجميع القوانين واللوائح المعمول بها", "Comply with all applicable laws and regulations")}
                </li>
                <li>{t("دفع العمولات والرسوم المتفق عليها", "Pay agreed commissions and fees")}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("الملكية الفكرية", "Intellectual Property")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "جميع المحتويات على منصة محلك، بما في ذلك النصوص والصور والشعارات والتصميمات، محمية بحقوق الملكية الفكرية. لا يجوز استخدام أي محتوى دون إذن كتابي مسبق منا.",
                  "All content on the Mahalak platform, including text, images, logos, and designs, is protected by intellectual property rights. No content may be used without prior written permission from us.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("إخلاء المسؤولية", "Disclaimer")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "نحن نسعى لتوفير منصة موثوقة وآمنة، لكننا لا نضمن أن الخدمة ستكون خالية من الأخطاء أو متاحة دائماً. لا نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنصة.",
                  "We strive to provide a reliable and secure platform, but we do not guarantee that the service will be error-free or always available. We are not responsible for any direct or indirect damages resulting from use of the platform.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("تعديل الشروط", "Terms Modification")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية، واستمرارك في استخدام المنصة يعني موافقتك على الشروط المعدلة.",
                  "We reserve the right to modify these terms at any time. You will be notified of any material changes, and your continued use of the platform means your acceptance of the modified terms.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("القانون الحاكم", "Governing Law")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "تخضع هذه الشروط وتفسر وفقاً لقوانين جمهورية مصر العربية. أي نزاع ينشأ عن هذه الشروط سيتم حله في المحاكم المختصة.",
                  "These terms are subject to and interpreted in accordance with the laws of the Arab Republic of Egypt. Any dispute arising from these terms will be resolved in the competent courts.",
                )}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">{t("تواصل معنا", "Contact Us")}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t(
                  "إذا كان لديك أي أسئلة حول شروط الاستخدام، يرجى التواصل معنا على الهاتف: 010 55161600",
                  "If you have any questions about the terms of use, please contact us at: 010 55161600",
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
