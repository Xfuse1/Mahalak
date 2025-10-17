import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">سياسة الخصوصية</h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">مقدمة</h2>
              <p className="text-gray-700 leading-relaxed">
                نحن في محلك نلتزم بحماية خصوصيتك وأمان معلوماتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية
                البيانات التي تقدمها لنا عند استخدام منصتنا.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">المعلومات التي نجمعها</h2>
              <p className="text-gray-700 leading-relaxed mb-4">نقوم بجمع الأنواع التالية من المعلومات:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>معلومات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف</li>
                <li>معلومات الطلبات: عناوين التوصيل، تفاصيل الدفع، سجل الطلبات</li>
                <li>معلومات الاستخدام: كيفية تفاعلك مع المنصة، المنتجات التي تتصفحها</li>
                <li>معلومات تقنية: عنوان IP، نوع المتصفح، نظام التشغيل</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">كيفية استخدام المعلومات</h2>
              <p className="text-gray-700 leading-relaxed mb-4">نستخدم المعلومات التي نجمعها للأغراض التالية:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>معالجة وتنفيذ طلباتك</li>
                <li>تحسين تجربة المستخدم وتخصيص المحتوى</li>
                <li>التواصل معك بشأن طلباتك والعروض الخاصة</li>
                <li>حماية المنصة من الاحتيال والأنشطة غير القانونية</li>
                <li>تحليل استخدام المنصة لتحسين خدماتنا</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">مشاركة المعلومات</h2>
              <p className="text-gray-700 leading-relaxed">
                لا نقوم ببيع أو تأجير معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك مع البائعين على المنصة لتنفيذ
                طلباتك، ومع مزودي الخدمات الذين يساعدوننا في تشغيل المنصة (مثل خدمات الدفع والشحن).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">أمان المعلومات</h2>
              <p className="text-gray-700 leading-relaxed">
                نستخدم إجراءات أمنية متقدمة لحماية معلوماتك من الوصول غير المصرح به أو التعديل أو الإفصاح أو التدمير.
                نستخدم تقنيات التشفير SSL لحماية البيانات الحساسة أثناء النقل.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">حقوقك</h2>
              <p className="text-gray-700 leading-relaxed mb-4">لديك الحق في:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>الوصول إلى معلوماتك الشخصية وتحديثها</li>
                <li>طلب حذف حسابك ومعلوماتك</li>
                <li>الاعتراض على معالجة معلوماتك لأغراض تسويقية</li>
                <li>طلب نسخة من بياناتك</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">ملفات تعريف الارتباط (Cookies)</h2>
              <p className="text-gray-700 leading-relaxed">
                نستخدم ملفات تعريف الارتباط لتحسين تجربتك على المنصة. يمكنك التحكم في ملفات تعريف الارتباط من خلال
                إعدادات المتصفح الخاص بك.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">التغييرات على السياسة</h2>
              <p className="text-gray-700 leading-relaxed">
                قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنقوم بإخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من
                خلال إشعار على المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">تواصل معنا</h2>
              <p className="text-gray-700 leading-relaxed">
                إذا كان لديك أي أسئلة حول سياسة الخصوصية، يرجى التواصل معنا على الهاتف: 010 55161600
              </p>
            </section>

            <p className="text-sm text-gray-600 mt-8">آخر تحديث: يناير 2024</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
