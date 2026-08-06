import type { MetadataRoute } from "next"

// MOB-09: أساس PWA — يجعل التطبيق قابلًا للتثبيت (Add to Home Screen) بهوية محلك.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "محلك — سوق الحي المصري",
    short_name: "محلك",
    description: "اكتشف أفضل المنتجات والمتاجر المحلية في حيّك واطلبها بسهولة مع الدفع عند الاستلام.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F1",
    theme_color: "#1B7A4B",
    dir: "rtl",
    lang: "ar",
    orientation: "portrait",
    categories: ["shopping", "food", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // لقطات شاشة حقيقية من الموقع — يعرضها المتصفّح في نافذة «تثبيت التطبيق» الغنيّة بدل صندوق
    // نصّي باهت. Chrome يشترط لقطة narrow (هاتف) وأخرى wide (شاشة عريضة) معًا لتفعيل تلك النافذة،
    // فوجود أحدهما وحده يُسقط التحسين كليًّا.
    screenshots: [
      {
        src: "/screenshots/home-phone.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "الصفحة الرئيسية — متاجر وفئات قريبة منك",
      },
      {
        src: "/screenshots/stores-phone.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "كل المتاجر المحلية مع البحث والترتيب بالأقرب",
      },
      {
        src: "/screenshots/search-phone.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "البحث في المنتجات مع الفلترة والترتيب",
      },
      {
        src: "/screenshots/home-wide.png",
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "محلك على الشاشات العريضة",
      },
      {
        src: "/screenshots/stores-wide.png",
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "تصفّح المتاجر على الشاشات العريضة",
      },
    ],
  }
}
