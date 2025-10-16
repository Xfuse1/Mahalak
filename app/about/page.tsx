import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingBag, Users, TrendingUp, Shield } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6 text-center">عن محلك</h1>

          <div className="prose prose-lg max-w-none mb-12">
            <p className="text-xl text-gray-700 text-center mb-8 leading-relaxed">
              محلك هي منصة التجارة الإلكترونية الرائدة التي تربط المتاجر المحلية بالعملاء في جميع أنحاء البلاد
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <ShoppingBag className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">منتجات متنوعة</h3>
                  <p className="text-gray-600 leading-relaxed">
                    آلاف المنتجات من مختلف الفئات متاحة للتسوق بأفضل الأسعار
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <Users className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">دعم البائعين</h3>
                  <p className="text-gray-600 leading-relaxed">
                    نساعد البائعين المحليين على الوصول إلى عملاء جدد وتنمية أعمالهم
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <TrendingUp className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">نمو مستمر</h3>
                  <p className="text-gray-600 leading-relaxed">
                    نعمل باستمرار على تحسين تجربة التسوق وإضافة ميزات جديدة
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-[#1F478B]/10 p-4 rounded-full mb-4">
                    <Shield className="h-8 w-8 text-[#1F478B]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">أمان وثقة</h3>
                  <p className="text-gray-600 leading-relaxed">نضمن حماية بياناتك وتوفير تجربة تسوق آمنة وموثوقة</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-secondary rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">رؤيتنا</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              نسعى لأن نكون المنصة الأولى للتجارة الإلكترونية المحلية، حيث نربط البائعين بالعملاء بطريقة سهلة وفعالة.
              نؤمن بأهمية دعم الاقتصاد المحلي وتمكين أصحاب المتاجر الصغيرة والمتوسطة من المنافسة في السوق الرقمي.
            </p>
            <p className="text-gray-700 leading-relaxed">
              من خلال توفير أدوات متقدمة للبائعين وتجربة تسوق مميزة للعملاء، نساهم في بناء مجتمع تجاري رقمي قوي ومزدهر.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
