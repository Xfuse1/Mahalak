export function LogoOption1({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
      {/* Modern Geometric Kufic Style - Option 1 */}
      {/* The delivery cart is integrated into the Kaf letter */}
      <g transform="translate(20, 15)">
        {/* Main text "محل" */}
        <text
          x="0"
          y="50"
          fontFamily="'Tajawal', 'Cairo', sans-serif"
          fontSize="52"
          fontWeight="800"
          fill="#1F478B"
          letterSpacing="2"
        >
          محل
        </text>

        {/* Kaf letter with integrated cart */}
        <g transform="translate(140, 0)">
          {/* Kaf body - modified to look like a cart */}
          <path
            d="M 0 50 L 0 20 C 0 15 5 10 10 10 L 50 10 L 48 35 L 10 35 C 5 35 0 40 0 45 Z"
            fill="#1F478B"
            stroke="#1F478B"
            strokeWidth="2"
          />

          {/* Cart wheels integrated into Kaf */}
          <circle cx="15" cy="50" r="6" fill="#1F478B" />
          <circle cx="40" cy="50" r="6" fill="#1F478B" />

          {/* Cart handle */}
          <path d="M 10 10 L 5 0" stroke="#1F478B" strokeWidth="4" strokeLinecap="round" />

          {/* Speed lines */}
          <line x1="-15" y1="20" x2="-5" y2="20" stroke="#6B9BD1" strokeWidth="3" strokeLinecap="round" />
          <line x1="-12" y1="30" x2="-5" y2="30" stroke="#8BB4E0" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

export function LogoOption2({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
      {/* Bold Sans-Serif Style - Option 2 */}
      {/* Cart cleverly integrated as part of Kaf's structure */}
      <g transform="translate(15, 10)">
        {/* Text "محل" */}
        <text
          x="0"
          y="55"
          fontFamily="'Cairo', 'Tajawal', sans-serif"
          fontSize="56"
          fontWeight="900"
          fill="#1F478B"
          letterSpacing="1"
        >
          محل
        </text>

        {/* Kaf with cart design */}
        <g transform="translate(145, 5)">
          {/* Kaf upper part forming cart basket */}
          <rect x="0" y="15" width="45" height="25" rx="3" fill="none" stroke="#1F478B" strokeWidth="5" />

          {/* Kaf vertical stroke */}
          <rect x="0" y="15" width="8" height="35" fill="#1F478B" />

          {/* Cart wheels */}
          <circle cx="12" cy="55" r="7" fill="none" stroke="#1F478B" strokeWidth="4" />
          <circle cx="35" cy="55" r="7" fill="none" stroke="#1F478B" strokeWidth="4" />

          {/* Motion lines */}
          <g opacity="0.6">
            <line x1="-18" y1="25" x2="-8" y2="25" stroke="#1F478B" strokeWidth="4" strokeLinecap="round" />
            <line x1="-15" y1="35" x2="-8" y2="35" stroke="#1F478B" strokeWidth="4" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  )
}

export function LogoOption3({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
      {/* Minimalist Geometric - Option 3 */}
      {/* Cart seamlessly becomes part of the Kaf letter */}
      <g transform="translate(20, 12)">
        {/* "محل" text */}
        <text
          x="0"
          y="52"
          fontFamily="'Tajawal', 'Cairo', sans-serif"
          fontSize="50"
          fontWeight="800"
          fill="#1F478B"
          letterSpacing="3"
        >
          محل
        </text>

        {/* Kaf as cart */}
        <g transform="translate(142, 8)">
          {/* Cart body forming Kaf shape */}
          <path
            d="M 5 45 L 5 18 L 12 12 L 48 12 L 46 38 L 12 38 L 5 45 Z"
            fill="none"
            stroke="#1F478B"
            strokeWidth="6"
            strokeLinejoin="round"
          />

          {/* Wheels */}
          <circle cx="16" cy="50" r="5.5" fill="#1F478B" />
          <circle cx="38" cy="50" r="5.5" fill="#1F478B" />

          {/* Handle */}
          <line x1="12" y1="12" x2="8" y2="4" stroke="#1F478B" strokeWidth="5" strokeLinecap="round" />

          {/* Speed effect */}
          <line x1="-12" y1="22" x2="-2" y2="22" stroke="#6B9BD1" strokeWidth="4" strokeLinecap="round" />
          <line x1="-10" y1="32" x2="-2" y2="32" stroke="#8BB4E0" strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

export function LogoOption4({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
      {/* Modern Rounded Style - Option 4 */}
      {/* Cart integrated organically into Kaf */}
      <g transform="translate(18, 10)">
        {/* "محل" */}
        <text
          x="0"
          y="54"
          fontFamily="'Cairo', sans-serif"
          fontSize="54"
          fontWeight="900"
          fill="#1F478B"
          letterSpacing="2"
        >
          محل
        </text>

        {/* Kaf-Cart hybrid */}
        <g transform="translate(143, 6)">
          {/* Cart basket as Kaf top */}
          <path
            d="M 8 16 L 12 8 L 50 8 L 48 36 L 12 36 L 8 44"
            fill="none"
            stroke="#1F478B"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Kaf vertical extended to ground */}
          <line x1="8" y1="16" x2="8" y2="44" stroke="#1F478B" strokeWidth="7" strokeLinecap="round" />

          {/* Wheels */}
          <circle cx="18" cy="52" r="6" fill="#1F478B" />
          <circle cx="40" cy="52" r="6" fill="#1F478B" />

          {/* Motion blur */}
          <g opacity="0.5">
            <line x1="-16" y1="20" x2="-6" y2="20" stroke="#1F478B" strokeWidth="5" strokeLinecap="round" />
            <line x1="-14" y1="30" x2="-6" y2="30" stroke="#1F478B" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  )
}

// Component to display all logo options for selection
export function LogoShowcase() {
  return (
    <div className="p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-8 text-center">خيارات تصميم اللوجو - Logo Design Options</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-center">الخيار الأول - Option 1</h3>
          <p className="text-sm text-gray-600 mb-4 text-center">Geometric Kufic with integrated cart wheels</p>
          <div className="flex justify-center items-center h-32 bg-gray-50 rounded">
            <LogoOption1 className="h-20 w-auto" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-center">الخيار الثاني - Option 2</h3>
          <p className="text-sm text-gray-600 mb-4 text-center">Bold Sans-Serif with cart basket structure</p>
          <div className="flex justify-center items-center h-32 bg-gray-50 rounded">
            <LogoOption2 className="h-20 w-auto" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-center">الخيار الثالث - Option 3</h3>
          <p className="text-sm text-gray-600 mb-4 text-center">Minimalist geometric with seamless cart integration</p>
          <div className="flex justify-center items-center h-32 bg-gray-50 rounded">
            <LogoOption3 className="h-20 w-auto" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-center">الخيار الرابع - Option 4</h3>
          <p className="text-sm text-gray-600 mb-4 text-center">Modern rounded style with organic cart-Kaf fusion</p>
          <div className="flex justify-center items-center h-32 bg-gray-50 rounded">
            <LogoOption4 className="h-20 w-auto" />
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-600">
        <p className="text-lg">جميع التصاميم تدمج عربة التوصيل بشكل عضوي في حرف الكاف</p>
        <p className="text-sm mt-2">All designs organically integrate the delivery cart into the Kaf letter</p>
      </div>
    </div>
  )
}
