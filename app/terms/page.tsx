import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">شروط الاستخدام</h1>

          <div className="prose prose-lg max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4">مقدمة</h2>
              <p className="text-gray-700 leading-relaxed">
                مرحباً بك في محلك. باستخدامك لهذه المنصة، فإنك توافق على الالتزام بشروط الاستخدام التالية. يرجى قراءة هذه
                الشروط بعناية قبل استخدام خدماتنا.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">استخدام المنصة</h2>
              <p className="text-gray-700 leading-relaxed mb-4">عند استخدام محلك، فإنك توافق على:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>تقديم معلومات دقيقة وصحيحة عند إنشاء حسابك</li>
                <li>الحفاظ على سرية معلومات حسابك وكلمة المرور</li>
                <li>عدم استخدام المنصة لأي أغراض غير قانونية أو احتيالية</li>
                <li>احترام حقوق الملكية الفكرية للآخرين</li>
                <li>عدم محاولة الوصول غير المصرح به إلى أنظمة المنصة</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">حسابات المستخدمين</h2>
              <p className="text-gray-700 leading-relaxed">
                أنت مسؤول عن جميع الأنشطة التي تتم من خلال حسابك. يجب عليك إخطارنا فوراً بأي استخدام غير مصرح به لحسابك.
                نحتفظ بالحق في تعليق أو إنهاء حسابك إذا انتهكت هذه الشروط.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">الطلبات والمدفوعات</h2>
              <p className="text-gray-700 leading-relaxed mb-4">عند تقديم طلب على محلك، فإنك توافق على:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>دفع السعر المحدد للمنتجات بالإضافة إلى أي رسوم شحن أو ضرائب</li>
                <li>تقديم معلومات دقيقة للتوصيل والدفع</li>
                <li>استلام المنتجات في الوقت والمكان المحددين</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                نحتفظ بالحق في رفض أو إلغاء أي طلب لأسباب تشمل عدم توفر المنتج، أخطاء في التسعير، أو الاشتباه في نشاط
                احتيالي.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">الإرجاع والاسترداد</h2>
              <p className="text-gray-700 leading-relaxed">
                يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن تكون في حالتها الأصلية. سيتم استرداد المبلغ
                خلال 7-14 يوم عمل بعد استلام المنتج المرتجع. قد تختلف سياسات الإرجاع حسب البائع.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">مسؤوليات البائعين</h2>
              <p className="text-gray-700 leading-relaxed mb-4">إذا كنت بائعاً على محلك، فإنك توافق على:</p>
              <ul className="list-disc pr-6 space-y-2 text-gray-700">
                <li>تقديم معلومات دقيقة وصادقة عن منتجاتك</li>
                <li>الالتزام بمعايير الجودة والخدمة</li>
                <li>معالجة الطلبات وشحنها في الوقت المحدد</li>
                <li>الامتثال لجميع القوانين واللوائح المعمول بها</li>
                <li>دفع العمولات والرسوم المتفق عليها</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">الملكية الفكرية</h2>
              <p className="text-gray-700 leading-relaxed">
                جميع المحتويات على منصة محلك، بما في ذلك النصوص والصور والشعارات والتصميمات، محمية بحقوق الملكية
                الفكرية. لا يجوز استخدام أي محتوى دون إذن كتابي مسبق منا.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">إخلاء المسؤولية</h2>
              <p className="text-gray-700 leading-relaxed">
                نحن نسعى لتوفير منصة موثوقة وآمنة، لكننا لا نضمن أن الخدمة ستكون خالية من الأخطاء أو متاحة دائماً. لا
                نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنصة.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">تعديل الشروط</h2>
              <p className="text-gray-700 leading-relaxed">
                نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية، واستمرارك في استخدام المنصة
                يعني موافقتك على الشروط المعدلة.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">القانون الحاكم</h2>
              <p className="text-gray-700 leading-relaxed">
                تخضع هذه الشروط وتفسر وفقاً لقوانين جمهورية مصر العربية. أي نزاع ينشأ عن هذه الشروط سيتم حله في المحاكم
                المختصة.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">تواصل معنا</h2>
              <p className="text-gray-700 leading-relaxed">
                إذا كان لديك أي أسئلة حول شروط الاستخدام، يرجى التواصل معنا على الهاتف: 010 55161600
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
