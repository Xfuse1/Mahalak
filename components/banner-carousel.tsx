"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"
import Image from "next/image"

const slides = [
  {
    id: 1,
    title: "عروض خاصة على جميع المنتجات",
    description: "خصم يصل إلى 50% على مختارات من المنتجات",
    image: "/banner-1.jpg",
  },
  {
    id: 2,
    title: "توصيل مجاني للطلبات فوق 500 جنيه",
    description: "اطلب الآن واستمتع بالتوصيل المجاني",
    image: "/banner-2.jpg",
  },
  {
    id: 3,
    title: "منتجات محلية عالية الجودة",
    description: "ادعم المتاجر المحلية واحصل على أفضل المنتجات",
    image: "/banner-3.jpg",
  },
]

export function BannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const { t } = useLanguage()

  const translatedSlides = [
    {
      id: 1,
      title: t("عروض خاصة على جميع المنتجات", "Special Offers on All Products"),
      description: t("خصم يصل إلى 50% على مختارات من المنتجات", "Up to 50% off on selected products"),
      image: "/banner-1.jpg",
    },
    {
      id: 2,
      title: t("توصيل مجاني للطلبات فوق 500 جنيه", "Free Delivery for Orders Over 500 EGP"),
      description: t("اطلب الآن واستمتع بالتوصيل المجاني", "Order now and enjoy free delivery"),
      image: "/banner-2.jpg",
    },
    {
      id: 3,
      title: t("منتجات محلية عالية الجودة", "High Quality Local Products"),
      description: t("ادعم المتاجر المحلية واحصل على أفضل المنتجات", "Support local stores and get the best products"),
      image: "/banner-3.jpg",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % translatedSlides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [translatedSlides.length])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % translatedSlides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + translatedSlides.length) % translatedSlides.length)
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(${currentSlide * 100}%)` }}
      >
        {translatedSlides.map((slide) => (
          <div key={slide.id} className="min-w-full relative h-[300px] md:h-[400px]">
            <Image src={slide.image || "/placeholder.svg"} alt={slide.title} fill className="object-cover" priority />
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
        {translatedSlides.map((_, index) => (
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
