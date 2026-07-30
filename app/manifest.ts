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
  }
}
