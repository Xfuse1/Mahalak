"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import Image from "next/image"
import Link from "next/link"

const BannerCarouselComponent = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const { t } = useTranslation()

  const slides = [
    {
      id: 1,
      title: t("banner1Title"),
      description: t("banner1Desc"),
      image: "/banner-1.jpg",
    },
    {
      id: 2,
      title: t("banner2Title"),
      description: t("banner2Desc"),
      image: "/banner-2.jpg",
    },
    {
      id: 3,
      title: t("banner3Title"),
      description: t("banner3Desc"),
      image: "/banner-3.jpg",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [slides.length])

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  return (
    <div className="relative overflow-hidden">
      {/* Background Blur Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20 backdrop-blur-sm z-0"></div>

      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="min-w-full relative h-[350px] md:h-[450px] lg:h-[500px]">
            <Image
              src={slide.image || "/placeholder.svg"}
              alt={slide.title}
              fill
              className="object-cover"
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
              sizes="100vw"
              quality={90}
            />
            {/* Modern Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-l from-[#0f172a]/95 via-[#1e3a5f]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4 md:px-8">
                <div className="max-w-2xl">
                  {/* Decorative Element */}
                  <div className="w-20 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full mb-6 animate-pulse"></div>

                  <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-4 md:mb-6 text-white text-balance leading-tight drop-shadow-lg">
                    {slide.title}
                  </h2>
                  <p className="text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-xl drop-shadow">
                    {slide.description}
                  </p>

                  {/* CTA Button (optional) */}
                  <div className="mt-8">
                    <Link href="/search" className="block w-fit">
                      <Button className="bg-white text-blue-900 hover:bg-gray-100 font-bold px-8 py-6 text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                        {t("browseProducts", "تصفح المنتجات")}
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
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm h-12 w-12 rounded-full transition-all hover:scale-110 shadow-lg"
        onClick={prevSlide}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30 backdrop-blur-sm h-12 w-12 rounded-full transition-all hover:scale-110 shadow-lg"
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