"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useLanguage } from "@/lib/language-context"
import { FileText, User, CreditCard, RotateCcw, Store, Copyright, AlertTriangle, Edit, Scale, Phone, Clock, Sparkles } from "lucide-react"

export default function TermsPage() {
  const { t } = useLanguage()

  const sections = [
    {
      icon: FileText,
      color: "from-primary to-primary",
      title: t("مقدمة", "Introduction"),
      content: t(
        "مرحباً بك في محلك. باستخدامك لهذه المنصة، فإنك توافق على الالتزام بشروط الاستخدام التالية. يرجى قراءة هذه الشروط بعناية قبل استخدام خدماتنا.",
        "Welcome to Mahalak. By using this platform, you agree to comply with the following terms of use. Please read these terms carefully before using our services.",
      )
    },
    {
      icon: User,
      color: "from-emerald-500 to-emerald-600",
      title: t("استخدام المنصة", "Platform Use"),
      content: t("عند استخدام محلك، فإنك توافق على:", "When using Mahalak, you agree to:"),
      list: [
        t("تقديم معلومات دقيقة وصحيحة عند إنشاء حسابك", "Provide accurate and correct information when creating your account"),
        t("الحفاظ على سرية معلومات حسابك وكلمة المرور", "Maintain the confidentiality of your account information and password"),
        t("عدم استخدام المنصة لأي أغراض غير قانونية أو احتيالية", "Not use the platform for any illegal or fraudulent purposes"),
        t("احترام حقوق الملكية الفكرية للآخرين", "Respect the intellectual property rights of others"),
        t("عدم محاولة الوصول غير المصرح به إلى أنظمة المنصة", "Not attempt unauthorized access to platform systems"),
      ]
    },
    {
      icon: User,
      color: "from-primary to-primary",
      title: t("حسابات المستخدمين", "User Accounts"),
      content: t(
        "أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك. يجب عليك إخطارنا فوراً بأي استخدام غير مصرح به لحسابك. نحتفظ بالحق في تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط.",
        "You are responsible for all activities conducted through your account. You must notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate your account if you violate these terms.",
      )
    },
    {
      icon: CreditCard,
      color: "from-amber-500 to-amber-600",
      title: t("الطلبات والمدفوعات", "Orders and Payments"),
      content: t("عند تقديم طلب على محلك، فإنك توافق على:", "When placing an order on Mahalak, you agree to:"),
      list: [
        t("دفع السعر المحدد للمنتجات بالإضافة إلى أي رسوم شحن أو ضرائب", "Pay the specified price for products plus any shipping fees or taxes"),
        t("تقديم معلومات دقيقة للتوصيل والدفع", "Provide accurate delivery and payment information"),
        t("استلام المنتجات في الوقت والمكان المحددين", "Receive products at the specified time and place"),
      ],
      extraContent: t(
        "نحتفظ بالحق في رفض أو إلغاء أي طلب لأسباب تشمل عدم توفر المنتج، أخطاء في التسعير، أو الاشتباه في نشاط احتيالي.",
        "We reserve the right to refuse or cancel any order for reasons including product unavailability, pricing errors, or suspected fraudulent activity.",
      )
    },
    {
      icon: RotateCcw,
      color: "from-rose-500 to-rose-600",
      title: t("الإرجاع والاسترداد", "Returns and Refunds"),
      content: t(
        "يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن تكون في حالتها الأصلية. سيتم استرداد المبلغ خلال 7-14 يوم عمل بعد استلام المنتج المرتجع. قد تختلف سياسات الإرجاع حسب البائع.",
        "You can return products within 14 days of receipt, provided they are in their original condition. Refunds will be processed within 7-14 business days after receiving the returned product. Return policies may vary by seller.",
      )
    },
    {
      icon: Store,
      color: "from-cyan-500 to-cyan-600",
      title: t("مسؤوليات البائعين", "Seller Responsibilities"),
      content: t("إذا كنت بائعاً على محلك، فإنك توافق على:", "If you are a seller on Mahalak, you agree to:"),
      list: [
        t("تقديم معلومات دقيقة وصادقة عن منتجاتك", "Provide accurate and honest information about your products"),
        t("الالتزام بمعايير الجودة والخدمة", "Comply with quality and service standards"),
        t("معالجة الطلبات وشحنها في الوقت المحدد", "Process and ship orders on time"),
        t("الامتثال لجميع القوانين واللوائح المعمول بها", "Comply with all applicable laws and regulations"),
        t("دفع العمولات والرسوم المتفق عليها", "Pay agreed commissions and fees"),
      ]
    },
    {
      icon: Copyright,
      color: "from-primary to-primary",
      title: t("الملكية الفكرية", "Intellectual Property"),
      content: t(
        "جميع المحتويات على منصة محلك، بما في ذلك النصوص والصور والشعارات والتصميمات، محمية بحقوق الملكية الفكرية. لا يجوز استخدام أي محتوى دون إذن كتابي مسبق منا.",
        "All content on the Mahalak platform, including text, images, logos, and designs, is protected by intellectual property rights. No content may be used without prior written permission from us.",
      )
    },
    {
      icon: AlertTriangle,
      color: "from-orange-500 to-orange-600",
      title: t("إخلاء المسؤولية", "Disclaimer"),
      content: t(
        "نحن نسعى لتوفير منصة موثوقة وآمنة، لكننا لا نضمن أن الخدمة ستكون خالية من الأخطاء أو متاحة دائماً. لا نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنصة.",
        "We strive to provide a reliable and secure platform, but we do not guarantee that the service will be error-free or always available. We are not responsible for any direct or indirect damages resulting from use of the platform.",
      )
    },
    {
      icon: Sparkles,
      color: "from-amber-500 to-amber-600",
      title: t("البحث الذكي", "AI Search"),
      content: t(
        "«البحث الذكي» أداة مساعدة تفهم ما تكتبه وتقترح عليك أصنافًا معروضة على المنصّة. هو أداة تسوّق فقط، وليس استشارة من أي نوع.",
        "\"AI Search\" is an assistive tool that interprets what you type and suggests items listed on the platform. It is a shopping tool only, not advice of any kind.",
      ),
      list: [
        t(
          "الاقتراحات قد تكون غير دقيقة. راجع اسم الصنف وسعره وتوفّره قبل إتمام أي طلب — ما يُعتمد عليه هو ما يظهر في صفحة الطلب لا في الاقتراح.",
          "Suggestions may be inaccurate. Check the item name, price, and availability before completing any order — what counts is what appears on the order page, not the suggestion.",
        ),
        t(
          "المنتجات الصحّية والدوائية: ما يُعرض منتجات مرتبطة بما ذكرته، وليس تشخيصًا ولا وصفة ولا جرعة. لا تستخدم المنصّة بديلًا عن الطبيب أو الصيدلي، وفي أي حالة طارئة توجّه للطوارئ فورًا.",
          "Health and pharmacy products: what is shown are items related to what you mentioned — not a diagnosis, prescription, or dosage. Do not use the platform as a substitute for a doctor or pharmacist, and in any emergency go to emergency services immediately.",
        ),
        t(
          "الصيدلية المعروضة منتجاتها هي المسؤولة قانونًا عن صرف الدواء وصلاحيته وملاءمته لحالتك، ولا تُدرَج أي صيدلية في هذا المسار إلا بعد إقرارها بذلك. محلك وسيط عرض وطلب لا صارف دواء.",
          "The pharmacy whose products are listed is legally responsible for dispensing, validity, and suitability, and no pharmacy is included in this path without acknowledging that. Mahalak is a listing and ordering intermediary, not a dispenser.",
        ),
        t(
          "نحتفظ بنصّ استعلامك لتحسين النتائج وقياس الطلب غير الملبّى، حسب ما هو موضّح في سياسة الخصوصية.",
          "We retain your query text to improve results and measure unmet demand, as detailed in the Privacy Policy.",
        ),
      ],
    },
    {
      icon: Edit,
      color: "from-pink-500 to-pink-600",
      title: t("تعديل الشروط", "Terms Modification"),
      content: t(
        "نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية، واستمرارك في استخدام المنصة يعني موافقتك على الشروط المعدلة.",
        "We reserve the right to modify these terms at any time. You will be notified of any material changes, and your continued use of the platform means your acceptance of the modified terms.",
      )
    },
    {
      icon: Scale,
      color: "from-teal-500 to-teal-600",
      title: t("القانون الحاكم", "Governing Law"),
      content: t(
        "تخضع هذه الشروط وتفسر وفقاً لقوانين جمهورية مصر العربية. أي نزاع ينشأ عن هذه الشروط سيتم حله في المحاكم المختصة.",
        "These terms are subject to and interpreted in accordance with the laws of the Arab Republic of Egypt. Any dispute arising from these terms will be resolved in the competent courts.",
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
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 mb-6 shadow-lg shadow-emerald-500/30">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-800 via-emerald-700 to-emerald-600 bg-clip-text text-transparent">
              {t("شروط الاستخدام", "Terms of Use")}
            </h1>
            <p className="text-lg text-gray-600 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              {t("آخر تحديث: أغسطس 2026", "Last updated: August 2026")}
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
                        <ul className="space-y-3 mb-4">
                          {section.list.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-600">
                              <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${section.color} mt-2 flex-shrink-0`} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.extraContent && (
                        <div className="bg-gray-50 rounded-xl p-4 border-s-4 border-amber-500">
                          <p className="text-gray-600 text-sm">{section.extraContent}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="mt-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative p-10 text-center text-white">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4">{t("تواصل معنا", "Contact Us")}</h2>
              <p className="text-emerald-100 mb-6 max-w-md mx-auto">
                {t(
                  "إذا كان لديك أي أسئلة حول شروط الاستخدام، يرجى التواصل معنا",
                  "If you have any questions about the terms of use, please contact us",
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
