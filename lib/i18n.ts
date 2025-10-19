import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// Translation resources
const resources = {
  ar: {
    common: {
      // Header
      searchNow: "ابحث الآن",
      switchLanguage: "تبديل اللغة",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",

      // Navigation
      home: "الرئيسية",
      stores: "المتاجر",
      categories: "الفئات",
      about: "من نحن",
      contact: "اتصل بنا",

      // Common
      search: "بحث",
      viewMore: "عرض المزيد",
      addToCart: "أضف للسلة",
      buyNow: "اشتر الآن",
      price: "السعر",
      description: "الوصف",

      // Footer
      allRightsReserved: "جميع الحقوق محفوظة",
    },
  },
  en: {
    common: {
      // Header
      searchNow: "Search Now",
      switchLanguage: "Switch Language",
      login: "Login",
      logout: "Logout",

      // Navigation
      home: "Home",
      stores: "Stores",
      categories: "Categories",
      about: "About Us",
      contact: "Contact Us",

      // Common
      search: "Search",
      viewMore: "View More",
      addToCart: "Add to Cart",
      buyNow: "Buy Now",
      price: "Price",
      description: "Description",

      // Footer
      allRightsReserved: "All Rights Reserved",
    },
  },
}

i18n.use(initReactI18next).init({
  resources,
  lng: "ar", // Default language
  fallbackLng: "ar",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
})

export default i18n
