/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // أخطاء الأنواع توقف البناء (تم إصلاح كل الأخطاء الموجودة)
    ignoreBuildErrors: false,
  },
  images: {
    // Enable image optimization for better performance
    unoptimized: false,
    // مقيّد على مضيفات التخزين الفعلية (Supabase / Firebase Storage / صور حسابات Google)
    // بدل '**' الذي كان يحوّل مُحسِّن الصور إلى بروكسي صور مفتوح (SSRF/استهلاك موارد).
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.firebasestorage.app' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
    formats: ['image/webp', 'image/avif'],
    qualities: [75, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Add image optimization quality
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Optimize production bundle
  compiler: {
    // إزالة console في الإنتاج لمنع تسريب المعلومات التقنية، مع الإبقاء على console.error
    // حتى يعمل مسار تسجيل الأخطاء سيرفر-سايد في lib/logger.ts (كان يُحذف بالكامل سابقًا).
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'react-i18next'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Server external packages - required for firebase-admin to work properly
  serverExternalPackages: ['firebase-admin'],
  // Compression
  compress: true,
  // Power pack for static optimization
  reactStrictMode: true,
  // Generate ETags for better caching
  generateEtags: true,
  // Optimize page loading
  poweredByHeader: false,
  // رؤوس أمان على مستوى التطبيق (دفاع متعدد الطبقات). ملاحظة: لم نضف CSP صارمًا هنا
  // لتفادي كسر السكربتات المضمّنة/Facebook Pixel — يُفضّل إضافته لاحقًا بوضع report-only.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
