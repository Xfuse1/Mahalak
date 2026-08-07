"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Search, Mic, Sparkles } from "lucide-react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Label } from "./ui/label"
import { useRouter } from "next/navigation"
import { useLanguage } from "../lib/language-context"
import { useToast } from "@/components/ui/toast"
import { getAiSearchAvailability } from "@/lib/actions/ai-search"
import { shouldUseAiSearch } from "@/lib/ai/intent"

// حالة الميزة تُجلب مرّة واحدة لكل تحميل صفحة مهما تكرّر شريط البحث فيها. الوعد محفوظ على مستوى
// الوحدة لا داخل المكوّن: الصفحة الواحدة قد تحمل شريطين (الترويسة + المتن) وكل واحد كان سيُطلق
// نداءه — والنتيجة واحدة للجميع لأنها إعداد منصّة لا تفضيل مستخدم.
// النجاح وحده يُحفَظ. حفظ الفشل كان يجعل انقطاعًا شبكيًّا عابرًا يُطفئ الميزة لبقية الجلسة:
// التنقّل داخل App Router لا يعيد تحميل الوحدة، فلا سبيل لإعادة المحاولة إلا بإعادة تحميل كاملة.
let availabilityPromise: Promise<{ enabled: boolean }> | null = null
function fetchAvailability(): Promise<{ enabled: boolean }> {
  if (!availabilityPromise) {
    availabilityPromise = getAiSearchAvailability().catch(() => {
      availabilityPromise = null
      return { enabled: false }
    })
  }
  return availabilityPromise
}

interface SearchBarProps {
  placeholder?: string
  onSearch?: (query: string) => void
  className?: string
  initialValue?: string
  /** «ذكي» كوضع ابتدائي (صفحة نتائج البحث الذكي تمرّره كي يبقى الزرّ متّسقًا مع ما يراه المستخدم). */
  initialMode?: "normal" | "ai"
}

export function SearchBar({ placeholder, onSearch, className = "", initialValue = "", initialMode = "normal" }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue)
  const [isListening, setIsListening] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiMode, setAiMode] = useState(initialMode === "ai")
  // هل بدّل المستخدم الوضع بيده؟ بعدها لا يلمسه التحويل التلقائي أبدًا — اقتراحٌ يتجاهل اختيارًا
  // صريحًا ليس اقتراحًا.
  const modeTouchedRef = useRef(initialMode === "ai")
  const router = useRouter()
  const { t, language } = useLanguage()
  const toast = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isRTL = language === "ar"
  // `onSearch` تعني: هذا الشريط **يفلتر محتوى الصفحة الحالية** (بحث داخل متجر، قائمة المتاجر) لا
  // يفتح صفحة نتائج. مثل هذا الشريط ليس مدخلًا للبحث الذكي: لا يعرض المبدّل ولا ينتقل أبدًا.
  //
  // بدونه كان الاقتراح التلقائي (`shouldUseAiSearch`) يرفع `aiMode` بلا لمسة من المستخدم، فيتحوّل
  // بحثٌ داخل صفحة متجر إلى **قذف المستخدم خارج المتجر** إلى /search/ai. مستهلكان قائمان يتأثّران:
  // app/store/[id]/page.tsx و components/store/store-list-client.tsx.
  const isInPageFilter = !!onSearch
  const searchPlaceholder = placeholder || t("ابحث عن منتجات، متاجر...", "Search for products, stores...")

  // مزامنة قيمة الصندوق مع الاستعلام الحالي عند تغيّره من الرابط (back/forward/رابط داخلي) دون remount
  useEffect(() => {
    setQuery(initialValue)
  }, [initialValue])

  // الحالة تُجلب عند الرسم لا عند أول تفاعل.
  //
  // كانت تُجلب عند التركيز/الكتابة توفيرًا لنداء شبكة على كل زيارة — وكان ثمنُها أن المبدّل
  // **لا يظهر إلا بعد أن يلمس المستخدم الصندوق**، فيقرأ ذلك كزرٍّ «يظهر ويختفي» بلا سبب مفهوم.
  // والتوفير موهوم أصلًا: النداء واحد لكل تحميل صفحة مهما تكرّر الشريط (الوعد محفوظ على مستوى
  // الوحدة)، والنتيجة محفوظة 60 ثانية على الخادم. ظهورُ عنصر تحكّم لا يجوز أن يتوقّف على تفاعل.
  const askedRef = useRef(false)
  const ensureAvailability = useCallback(() => {
    if (isInPageFilter || askedRef.current) return
    askedRef.current = true
    fetchAvailability().then((res) => setAiAvailable(res.enabled === true))
  }, [isInPageFilter])

  useEffect(() => {
    ensureAvailability()
  }, [ensureAvailability])

  // اقتراح الوضع أثناء الكتابة: جملة أو سؤال ⇒ ذكي، كلمة أو كلمتان ⇒ عادي. يعمل مرّة واحدة فقط،
  // فبمجرّد أن يلمس المستخدم الزرّ يصمت نهائيًّا.
  useEffect(() => {
    if (!aiAvailable || modeTouchedRef.current) return
    setAiMode(shouldUseAiSearch(query))
  }, [query, aiAvailable])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const debouncedOnSearch = useCallback(
    (value: string) => {
      if (!onSearch) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(value)
      }, 300)
    },
    [onSearch],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    ensureAvailability()
    // If onSearch is provided (live search mode), debounce it
    if (onSearch) {
      debouncedOnSearch(value)
    }
  }

  // وجهة الإرسال. البحث الذكي صفحة مستقلّة لا وضعٌ داخل صفحة النتائج: مخرجه سلّة مجمَّعة لا شبكة
  // بطاقات، وحشرهما في صفحة واحدة كان يعني فلاتر وترتيبًا لا معنى لهما فوق سلة وصفة.
  const submit = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // الفلترة داخل الصفحة أولًا وبلا شرط: أي تنقّل هنا يهجر الصفحة التي يفلترها المستخدم.
    if (onSearch) {
      onSearch(value)
      return
    }
    const text = value.trim()
    // الوضع يُشتقّ من **النصّ المُرسَل** لا من حالة الرسمة الحالية: البحث الصوتي يضبط النصّ وينادي
    // الإرسال في نفس الدورة، والتأثير الذي يشتقّ الوضع لم يُنفَّذ بعد على النصّ الجديد ⇒ كان النطق
    // ينطلق دائمًا بوضع النصّ **السابق**. أما اختيار المستخدم الصريح فيسبق الاشتقاق دائمًا.
    const useAi = modeTouchedRef.current ? aiMode : shouldUseAiSearch(text)
    // البحث الذكي بلا نصّ لا معنى له؛ البحث العادي بلا نصّ يعرض كل المنتجات (سلوك قائم).
    if (useAi && aiAvailable && text) {
      router.push(`/search/ai?q=${encodeURIComponent(text)}`)
      return
    }
    router.push(`/search?q=${encodeURIComponent(value)}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    submit(query)
  }

  const toggleMode = () => {
    modeTouchedRef.current = true
    setAiMode((v) => !v)
  }

  const handleVoiceSearch = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = language === "ar" ? "ar-EG" : "en-US"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ""
        if (!transcript) {
          setIsListening(false)
          return
        }
        setQuery(transcript)
        setIsListening(false)
        // بعد التعرّف على الصوت ننفّذ نفس مسار الإرسال — بما فيه اختيار الوضع، وإلا كان النطق
        // يتجاوز البحث الذكي دائمًا مهما كان الزرّ.
        submit(transcript)
      }

      recognition.onerror = () => {
        setIsListening(false)
        toast.error(t("حدث خطأ في البحث الصوتي", "An error occurred with voice search"))
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } else {
      toast.error(t("البحث الصوتي غير مدعوم في هذا المتصفح", "Voice search is not supported in this browser"))
    }
  }

  return (
    <form onSubmit={handleSearch} className={`flex flex-col gap-2 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* مبدّل الوضع — لا يُرسم أصلًا والميزة مطفأة، فلا يرى المستخدم زرًّا لا يعمل */}
      {aiAvailable && !isInPageFilter && (
        <div className="flex items-center gap-1 self-start rounded-2xl border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => aiMode && toggleMode()}
            aria-pressed={!aiMode}
            className={`rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${!aiMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            بحث عادي
          </button>
          <button
            type="button"
            onClick={() => !aiMode && toggleMode()}
            aria-pressed={aiMode}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-bold transition-colors ${aiMode ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="h-4 w-4" />
            بحث ذكي
          </button>
        </div>
      )}

      <div className="flex gap-3">
      <div className={`flex-1 relative transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
        <Label htmlFor="search-input" className="sr-only">
          {searchPlaceholder}
        </Label>
        <div className={`absolute inset-0 bg-gradient-to-r from-primary/15 to-accent/15 rounded-2xl blur-xl transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`}></div>
        <Input
          id="search-input"
          type="text"
          // الاتجاه يتبع ما يُكتب فعلًا لا لغة الواجهة: كتالوجات الكاشير لاتينية بالكامل تقريبًا،
          // فاستعلام «Panadol 500» داخل حقل مفروض عليه RTL يظهر بترتيب مقلوب أثناء الكتابة.
          dir="auto"
          placeholder={searchPlaceholder}
          value={query}
          onChange={handleChange}
          onFocus={() => {
            setIsFocused(true)
            ensureAvailability()
          }}
          onBlur={() => setIsFocused(false)}
          className={`relative border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 hover:border-primary/50 transition-all duration-300 h-14 rounded-2xl shadow-sm bg-card ${isRTL ? 'text-right pl-12 pr-5' : 'text-left pr-12 pl-5'} text-base`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300 rounded-xl ${isRTL ? 'left-2' : 'right-2'
            } ${isListening ? "text-destructive animate-pulse bg-destructive/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            }`}
          onClick={handleVoiceSearch}
          title={t("البحث الصوتي", "Voice Search")}
          aria-label={t("البحث الصوتي", "Voice Search")}
        >
          <Mic className="h-5 w-5" />
        </Button>
      </div>
      <Button
        type="submit"
        className={`px-6 md:px-8 h-14 font-bold transition-colors duration-300 rounded-2xl shadow-lg active:scale-95 flex items-center gap-2 ${aiMode && aiAvailable && !isInPageFilter ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
      >
        {aiMode && aiAvailable && !isInPageFilter ? <Sparkles className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        <span className="hidden sm:inline">{t("بحث", "Search")}</span>
      </Button>
      </div>
    </form>
  )
}
