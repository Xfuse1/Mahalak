import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// Comprehensive translation resources
const resources = {
  ar: {
    common: {
      // Header & Navigation
      searchNow: "ابحث الآن",
      switchLanguage: "تبديل اللغة",
      login: "تسجيل الدخول",
      logout: "تسجيل الخروج",
      home: "الرئيسية",
      stores: "المتاجر",
      categories: "الفئات",
      about: "من نحن",
      contact: "اتصل بنا",

      // Common Actions
      search: "بحث",
      viewMore: "عرض المزيد",
      viewAll: "عرض الكل",
      addToCart: "أضف للسلة",
      buyNow: "اشتر الآن",
      price: "السعر",
      description: "الوصف",

      // Homepage
      searchPlaceholder: "ابحث عن منتجات أو متاجر...",
      browseByCategory: "تصفح حسب الفئة",
      featuredProducts: "منتجات مميزة",
      featuredStores: "متاجر مميزة",
      allProducts: "جميع المنتجات",
      allStores: "جميع المتاجر",
      browseAllProducts: "تصفح جميع المنتجات المتاحة",
      discoverLocalStores: "اكتشف المتاجر المحلية",
      areYouStoreOwner: "هل أنت صاحب متجر؟",
      joinPlatform: "انضم إلى منصتنا وابدأ في بيع منتجاتك لآلاف العملاء",
      startSellingNow: "ابدأ البيع الآن",

      // Categories
      grocery: "بقالة",
      health: "صحة",
      clothing: "ملابس",
      electronics: "إلكترونيات",
      food: "أغذية",
      furniture: "أثاث",
      otherServices: "خدمات أخرى",

      // Footer
      quickLinks: "روابط سريعة",
      copyright: "© 2025 محلك. جميع الحقوق محفوظة",
      followUs: "تابعنا على فيسبوك",
      phone: "الهاتف",
      termsAndPolicies: "الشروط والسياسات",
      privacyPolicy: "سياسة الخصوصية",
      termsOfUse: "شروط الاستخدام",
      footerDescription: "منصة التجارة الإلكترونية الرائدة للمنتجات والمتاجر المحلية",

      // About Page
      aboutMahalak: "عن محلك",
      aboutDescription:
        "محلك هي منصة التجارة الإلكترونية الرائدة التي تربط المتاجر المحلية بالعملاء في جميع أنحاء البلاد",
      diverseProducts: "منتجات متنوعة",
      diverseProductsDesc: "آلاف المنتجات من مختلف الفئات متاحة للتسوق بأفضل الأسعار",
      sellerSupport: "دعم البائعين",
      sellerSupportDesc: "نساعد البائعين المحليين على الوصول إلى عملاء جدد وتنمية أعمالهم",
      continuousGrowth: "نمو مستمر",
      continuousGrowthDesc: "نعمل باستمرار على تحسين تجربة التسوق وإضافة ميزات جديدة",
      securityAndTrust: "أمان وثقة",
      securityAndTrustDesc: "نضمن حماية بياناتك وتوفير تجربة تسوق آمنة وموثوقة",
      ourVision: "رؤيتنا",
      visionText1:
        "نسعى لأن نكون المنصة الأولى للتجارة الإلكترونية المحلية، حيث نربط البائعين بالعملاء بطريقة سهلة وفعالة. نؤمن بأهمية دعم الاقتصاد المحلي وتمكين أصحاب المتاجر الصغيرة والمتوسطة من المنافسة في السوق الرقمي.",
      visionText2:
        "من خلال توفير أدوات متقدمة للبائعين وتجربة تسوق مميزة للعملاء، نساهم في بناء مجتمع تجاري رقمي قوي ومزدهر.",

      // FAQ Page
      faqTitle: "الأسئلة الشائعة",
      faqSubtitle: "إجابات على الأسئلة الأكثر شيوعاً حول محلك",
      faqNotFound: "لم تجد إجابة لسؤالك؟",
      faqContactUs: "تواصل معنا وسنكون سعداء بمساعدتك",

      // FAQ Questions
      faq1Q: "كيف يمكنني إنشاء حساب على محلك؟",
      faq1A:
        "يمكنك إنشاء حساب بسهولة من خلال النقر على زر 'تسجيل الدخول' في أعلى الصفحة، ثم اختيار 'إنشاء حساب'. ستحتاج إلى إدخال بريدك الإلكتروني وكلمة مرور واختيار نوع الحساب (عميل أو بائع).",
      faq2Q: "كيف يمكنني البحث عن منتج معين؟",
      faq2A:
        "استخدم شريط البحث في أعلى الصفحة لإدخال اسم المنتج أو الفئة التي تبحث عنها. يمكنك أيضاً تصفح المنتجات حسب الفئات من القائمة الرئيسية.",
      faq3Q: "ما هي طرق الدفع المتاحة؟",
      faq3A:
        "نوفر عدة طرق للدفع تشمل الدفع عند الاستلام، البطاقات الائتمانية، والمحافظ الإلكترونية. يمكنك اختيار الطريقة المناسبة لك عند إتمام الطلب.",
      faq4Q: "كم تستغرق عملية التوصيل؟",
      faq4A:
        "تختلف مدة التوصيل حسب موقعك والمتجر البائع. عادةً ما تستغرق من 2-5 أيام عمل. ستتلقى إشعاراً بتفاصيل الشحن بمجرد إرسال طلبك.",
      faq5Q: "هل يمكنني إرجاع أو استبدال المنتجات؟",
      faq5A:
        "نعم، يمكنك إرجاع أو استبدال المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن يكون المنتج في حالته الأصلية. يرجى مراجعة سياسة الإرجاع الخاصة بكل متجر للتفاصيل.",
      faq6Q: "كيف يمكنني أن أصبح بائعاً على محلك؟",
      faq6A:
        "للانضمام كبائع، قم بإنشاء حساب واختر 'بائع' كنوع الحساب. بعد ذلك، ستتمكن من إضافة متجرك ومنتجاتك من خلال لوحة التحكم الخاصة بالبائعين.",
      faq7Q: "كيف يمكنني تتبع طلبي؟",
      faq7A:
        "يمكنك تتبع طلبك من خلال الدخول إلى حسابك والانتقال إلى قسم 'طلباتي'. ستجد هناك جميع تفاصيل طلباتك وحالة كل طلب.",
      faq8Q: "هل معلوماتي الشخصية آمنة؟",
      faq8A:
        "نعم، نحن نأخذ أمان بياناتك على محمل الجد. نستخدم أحدث تقنيات التشفير لحماية معلوماتك الشخصية والمالية. لمزيد من التفاصيل، يرجى مراجعة سياسة الخصوصية.",

      // Banner Carousel
      banner1Title: "عروض خاصة على جميع المنتجات",
      banner1Desc: "خصم يصل إلى 50% على مختارات من المنتجات",
      banner2Title: "توصيل مجاني للطلبات فوق 500 جنيه",
      banner2Desc: "اطلب الآن واستمتع بالتوصيل المجاني",
      banner3Title: "منتجات محلية عالية الجودة",
      banner3Desc: "ادعم المتاجر المحلية واحصل على أفضل المنتجات",
    },
  },
  en: {
    common: {
      // Header & Navigation
      searchNow: "Search Now",
      switchLanguage: "Switch Language",
      login: "Login",
      logout: "Logout",
      home: "Home",
      stores: "Stores",
      categories: "Categories",
      about: "About Us",
      contact: "Contact Us",

      // Common Actions
      search: "Search",
      viewMore: "View More",
      viewAll: "View All",
      addToCart: "Add to Cart",
      buyNow: "Buy Now",
      price: "Price",
      description: "Description",

      // Homepage
      searchPlaceholder: "Search for products or stores...",
      browseByCategory: "Browse by Category",
      featuredProducts: "Featured Products",
      featuredStores: "Featured Stores",
      allProducts: "All Products",
      allStores: "All Stores",
      browseAllProducts: "Browse all available products",
      discoverLocalStores: "Discover local stores",
      areYouStoreOwner: "Are you a store owner?",
      joinPlatform: "Join our platform and start selling your products to thousands of customers",
      startSellingNow: "Start Selling Now",

      // Categories
      grocery: "Grocery",
      health: "Health",
      clothing: "Clothing",
      electronics: "Electronics",
      food: "Food",
      furniture: "Furniture",
      otherServices: "Other Services",

      // Footer
      quickLinks: "Quick Links",
      copyright: "© 2025 Mahalak. All Rights Reserved",
      followUs: "Follow us on Facebook",
      phone: "Phone",
      termsAndPolicies: "Terms and Policies",
      privacyPolicy: "Privacy Policy",
      termsOfUse: "Terms of Use",
      footerDescription: "Leading e-commerce platform for local products and stores",

      // About Page
      aboutMahalak: "About Mahalak",
      aboutDescription:
        "Mahalak is the leading e-commerce platform that connects local stores with customers across the country",
      diverseProducts: "Diverse Products",
      diverseProductsDesc: "Thousands of products from various categories available for shopping at the best prices",
      sellerSupport: "Seller Support",
      sellerSupportDesc: "We help local sellers reach new customers and grow their businesses",
      continuousGrowth: "Continuous Growth",
      continuousGrowthDesc: "We continuously work to improve the shopping experience and add new features",
      securityAndTrust: "Security and Trust",
      securityAndTrustDesc: "We ensure the protection of your data and provide a safe and reliable shopping experience",
      ourVision: "Our Vision",
      visionText1:
        "We strive to be the first platform for local e-commerce, connecting sellers with customers in an easy and effective way. We believe in the importance of supporting the local economy and empowering small and medium-sized store owners to compete in the digital market.",
      visionText2:
        "By providing advanced tools for sellers and a distinctive shopping experience for customers, we contribute to building a strong and prosperous digital business community.",

      // FAQ Page
      faqTitle: "Frequently Asked Questions",
      faqSubtitle: "Answers to the most common questions about Mahalak",
      faqNotFound: "Didn't find an answer to your question?",
      faqContactUs: "Contact us and we'll be happy to help you",

      // FAQ Questions
      faq1Q: "How can I create an account on Mahalak?",
      faq1A:
        "You can easily create an account by clicking the 'Login' button at the top of the page, then selecting 'Create Account'. You'll need to enter your email and password and choose the account type (customer or seller).",
      faq2Q: "How can I search for a specific product?",
      faq2A:
        "Use the search bar at the top of the page to enter the product name or category you're looking for. You can also browse products by categories from the main menu.",
      faq3Q: "What payment methods are available?",
      faq3A:
        "We offer several payment methods including cash on delivery, credit cards, and digital wallets. You can choose the method that suits you when completing your order.",
      faq4Q: "How long does delivery take?",
      faq4A:
        "Delivery time varies depending on your location and the selling store. It usually takes 2-5 business days. You'll receive a notification with shipping details once your order is sent.",
      faq5Q: "Can I return or exchange products?",
      faq5A:
        "Yes, you can return or exchange products within 14 days of receipt, provided the product is in its original condition. Please review each store's return policy for details.",
      faq6Q: "How can I become a seller on Mahalak?",
      faq6A:
        "To join as a seller, create an account and choose 'Seller' as the account type. After that, you'll be able to add your store and products through the seller control panel.",
      faq7Q: "How can I track my order?",
      faq7A:
        "You can track your order by logging into your account and going to the 'My Orders' section. You'll find all your order details and the status of each order there.",
      faq8Q: "Is my personal information safe?",
      faq8A:
        "Yes, we take your data security seriously. We use the latest encryption technologies to protect your personal and financial information. For more details, please review the privacy policy.",

      // Banner Carousel
      banner1Title: "Special Offers on All Products",
      banner1Desc: "Up to 50% off on selected products",
      banner2Title: "Free Delivery for Orders Over 500 EGP",
      banner2Desc: "Order now and enjoy free delivery",
      banner3Title: "High Quality Local Products",
      banner3Desc: "Support local stores and get the best products",
    },
  },
}

i18n.use(initReactI18next).init({
  resources,
  lng: typeof window !== "undefined" ? localStorage.getItem("language") || "ar" : "ar",
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
