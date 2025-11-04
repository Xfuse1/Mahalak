"use client"

import { useState, useEffect, useCallback, memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"
import Image from "next/image"

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
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(${currentSlide * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="min-w-full relative h-[300px] md:h-[400px]">
            <Image 
              src={slide.image || "/placeholder.svg"} 
              alt={slide.title} 
              fill 
              className="object-cover" 
              priority={index === 0} 
              loading={index === 0 ? "eager" : "lazy"}
              sizes="100vw"
              quality={85}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#1F478B]/90 to-[#1F478B]/70" />
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4">
                <div className="max-w-2xl">
                  <h2 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 text-white text-balance">{slide.title}</h2>
                  <p className="text-lg md:text-xl text-white/95 leading-relaxed">{slide.description}</p>
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
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/20"
        onClick={prevSlide}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/20"
        onClick={nextSlide}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all ${index === currentSlide ? "bg-white w-8" : "bg-white/50 w-2"}`}
          />
        ))}
      </div>
    </div>
  )
}

export const BannerCarousel = memo(BannerCarouselComponent)