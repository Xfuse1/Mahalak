import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQPage() {
  const faqs = [
    {
      question: "كيف يمكنني إنشاء حساب على محلك؟",
      answer:
        "يمكنك إنشاء حساب بسهولة من خلال النقر على زر 'تسجيل الدخول' في أعلى الصفحة، ثم اختيار 'إنشاء حساب'. ستحتاج إلى إدخال بريدك الإلكتروني وكلمة مرور واختيار نوع الحساب (عميل أو بائع).",
    },
    {
      question: "كيف يمكنني البحث عن منتج معين؟",
      answer:
        "استخدم شريط البحث في أعلى الصفحة لإدخال اسم المنتج أو الفئة التي تبحث عنها. يمكنك أيضاً تصفح المنتجات حسب الفئات من القائمة الرئيسية.",
    },
    {
      question: "ما هي طرق الدفع المتاحة؟",
      answer:
        "نوفر عدة طرق للدفع تشمل الدفع عند الاستلام، البطاقات الائتمانية، والمحافظ الإلكترونية. يمكنك اختيار الطريقة المناسبة لك عند إتمام الطلب.",
    },
    {
      question: "كم تستغرق عملية التوصيل؟",
      answer:
        "تختلف مدة التوصيل حسب موقعك والمتجر البائع. عادةً ما تستغرق من 2-5 أيام عمل. ستتلقى إشعاراً بتفاصيل الشحن بمجرد إرسال طلبك.",
    },
    {
      question: "هل يمكنني إرجاع أو استبدال المنتجات؟",
      answer:
        "نعم، يمكنك إرجاع أو استبدال المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن يكون المنتج في حالته الأصلية. يرجى مراجعة سياسة الإرجاع الخاصة بكل متجر للتفاصيل.",
    },
    {
      question: "كيف يمكنني أن أصبح بائعاً على محلك؟",
      answer:
        "للانضمام كبائع، قم بإنشاء حساب واختر 'بائع' كنوع الحساب. بعد ذلك، ستتمكن من إضافة متجرك ومنتجاتك من خلال لوحة التحكم الخاصة بالبائعين.",
    },
    {
      question: "كيف يمكنني تتبع طلبي؟",
      answer:
        "يمكنك تتبع طلبك من خلال الدخول إلى حسابك والانتقال إلى قسم 'طلباتي'. ستجد هناك جميع تفاصيل طلباتك وحالة كل طلب.",
    },
    {
      question: "هل معلوماتي الشخصية آمنة؟",
      answer:
        "نعم، نحن نأخذ أمان بياناتك على محمل الجد. نستخدم أحدث تقنيات التشفير لحماية معلوماتك الشخصية والمالية. لمزيد من التفاصيل، يرجى مراجعة سياسة الخصوصية.",
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-4 text-center">الأسئلة الشائعة</h1>
          <p className="text-xl text-gray-600 text-center mb-12 leading-relaxed">
            إجابات على الأسئلة الأكثر شيوعاً حول محلك
          </p>

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
            <h2 className="text-2xl font-bold mb-4">لم تجد إجابة لسؤالك؟</h2>
            <p className="text-gray-700 mb-6 leading-relaxed">تواصل معنا وسنكون سعداء بمساعدتك</p>
            <p className="text-[#1F478B] font-semibold text-lg">الهاتف: 010 55161600</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
