/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // أخطاء الأنواع توقف البناء (تم إصلاح كل الأخطاء الموجودة)
    ignoreBuildErrors: false,
  },
  images: {
    // Enable image optimization for better performance
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
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
    // إزالة جميع أنواع console في الإنتاج لمنع تسريب معلومات تقنية
    removeConsole: process.env.NODE_ENV === 'production',
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
}

export default nextConfig
