"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"
import Link from "next/link"

const SLIDES_COUNT = 3

const BannerCarouselComponent = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const { t, language } = useLanguage()
  const isRTL = language === "ar"
  const translateValue = isRTL ? currentSlide * 100 : -(currentSlide * 100)

  const slides = [
    {
      id: 1,
      title: t("اكتشف أفضل المنتجات", "Discover the Best Products"),
      description: t("تسوق من آلاف المنتجات بأفضل الأسعار", "Shop from thousands of products at the best prices"),
      image: "/banner-1.jpg",
    },
    {
      id: 2,
      title: t("متاجر موثوقة بالقرب منك", "Trusted Stores Near You"),
      description: t("تواصل مع أفضل المتاجر المحلية", "Connect with the best local stores"),
      image: "/banner-2.jpg",
    },
    {
      id: 3,
      title: t("عروض وخصومات حصرية", "Exclusive Deals & Discounts"),
      description: t("وفر أكثر مع عروضنا المميزة", "Save more with our special offers"),
      image: "/banner-3.jpg",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES_COUNT)
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES_COUNT)
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES_COUNT) % SLIDES_COUNT)
  }, [])

  return (
    <div className="relative overflow-hidden">
      {/* Background Blur Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-sm z-0"></div>
      
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(${translateValue}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="min-w-full relative h-[350px] md:h-[450px] lg:h-[500px]">
            <Image 
              src={slide.image || "/placeholder.svg"} 
              alt={slide.title} 
              fill 
              className="object-cover"
              priority={index === 0}
              sizes="100vw"
              quality={90}
            />
            {/* Modern Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-l from-[oklch(0.22_0.04_155)]/95 via-[oklch(0.30_0.05_155)]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            
            {/* Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4 md:px-8">
                <div className="max-w-2xl">
                  {/* Decorative Element */}
                  <div className="w-20 h-1 bg-accent rounded-full mb-6"></div>
                  
                  <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-4 md:mb-6 text-white text-balance leading-tight drop-shadow-lg">
                    {slide.title}
                  </h2>
                  <p className="text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-xl drop-shadow">
                    {slide.description}
                  </p>
                  
                  {/* CTA Button (optional) */}
                  <div className="mt-8">
                    <Link href="/search">
                      <Button 
                        className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-8 py-6 text-lg rounded-xl shadow-xl transition-colors"
                      >
                        {t("تصفح المنتجات", "Browse Products")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute start-4 md:start-8 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm h-12 w-12 rounded-full transition-all hover:scale-110 shadow-lg"
        onClick={prevSlide}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute end-4 md:end-8 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm h-12 w-12 rounded-full transition-all hover:scale-110 shadow-lg"
        onClick={nextSlide}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2.5 rounded-full transition-all duration-500 ${index === currentSlide ? "bg-white w-10 shadow-lg" : "bg-white/40 w-2.5 hover:bg-white/60"}`}
          />
        ))}
      </div>
    </div>
  )
}

export const BannerCarousel = memo(BannerCarouselComponent)
