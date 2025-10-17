export function Logo({ className = "", variant = 1 }: { className?: string; variant?: 1 | 2 | 3 | 4 }) {
  if (variant === 1) {
    // Design 1: Cart integrated into the Kaf's tail
    return (
      <svg viewBox="0 0 200 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: "#1F478B", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#2d5ba8", stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {/* Arabic text "محلك" with cart integrated into Kaf */}
        <g transform="translate(10, 45)">
          {/* م */}
          <path
            d="M 5 0 Q 5 -15 15 -15 Q 25 -15 25 0 L 25 15 Q 25 25 15 25 Q 5 25 5 15 Z"
            fill="url(#grad1)"
            stroke="#1F478B"
            strokeWidth="2"
          />

          {/* ح */}
          <path
            d="M 35 15 Q 35 -5 50 -5 Q 65 -5 65 15 L 65 20"
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* ل */}
          <path d="M 75 -20 L 75 25" stroke="url(#grad1)" strokeWidth="8" strokeLinecap="round" />

          {/* ك with integrated cart */}
          <g transform="translate(90, 0)">
            {/* Kaf main body */}
            <path
              d="M 0 -15 L 0 15 Q 0 25 10 25 L 25 25"
              fill="none"
              stroke="url(#grad1)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Cart integrated into Kaf's tail - becomes part of the letter */}
            <g transform="translate(12, 18)">
              {/* Cart body as part of Kaf */}
              <path
                d="M 0 0 L 3 0 L 6 -10 L 20 -10 L 18 0 Z"
                fill="none"
                stroke="#1F478B"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* Cart wheels */}
              <circle cx="6" cy="3" r="2.5" fill="#1F478B" />
              <circle cx="16" cy="3" r="2.5" fill="#1F478B" />
              {/* Cart handle */}
              <line x1="6" y1="-10" x2="4" y2="-14" stroke="#1F478B" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </svg>
    )
  }

  if (variant === 2) {
    // Design 2: Minimalist cart as Kaf's dot
    return (
      <svg viewBox="0 0 200 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
        <g transform="translate(15, 50)">
          {/* م - bold geometric */}
          <rect x="0" y="-20" width="20" height="35" rx="10" fill="#1F478B" />
          <rect x="5" y="-15" width="10" height="25" rx="5" fill="#fff" />

          {/* ح - curved */}
          <path
            d="M 30 10 Q 30 -10 50 -10 Q 70 -10 70 10"
            fill="none"
            stroke="#1F478B"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* ل - straight */}
          <rect x="80" y="-25" width="10" height="50" rx="5" fill="#1F478B" />

          {/* ك - with cart as decorative element */}
          <path
            d="M 100 -20 L 100 10 Q 100 20 110 20 L 130 20"
            fill="none"
            stroke="#1F478B"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Minimalist cart above Kaf */}
          <g transform="translate(105, -30)">
            <rect x="0" y="0" width="15" height="10" rx="2" fill="#1F478B" />
            <circle cx="4" cy="12" r="2" fill="#1F478B" />
            <circle cx="11" cy="12" r="2" fill="#1F478B" />
            <line x1="7" y1="0" x2="5" y2="-4" stroke="#1F478B" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    )
  }

  if (variant === 3) {
    // Design 3: Cart wheels as part of Kaf's structure
    return (
      <svg viewBox="0 0 220 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
        <g transform="translate(20, 48)" fontFamily="Cairo, sans-serif">
          {/* م */}
          <text x="0" y="0" fontSize="45" fontWeight="900" fill="#1F478B">
            م
          </text>

          {/* ح */}
          <text x="35" y="0" fontSize="45" fontWeight="900" fill="#1F478B">
            ح
          </text>

          {/* ل */}
          <text x="75" y="0" fontSize="45" fontWeight="900" fill="#1F478B">
            ل
          </text>

          {/* ك with cart wheels integrated */}
          <g transform="translate(110, -5)">
            <path
              d="M 0 -15 L 0 10 Q 0 18 8 18 L 28 18"
              fill="none"
              stroke="#1F478B"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Cart structure integrated into Kaf */}
            <path
              d="M 8 10 L 11 10 L 14 0 L 26 0 L 24 10"
              fill="none"
              stroke="#1F478B"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Wheels as part of the letter structure */}
            <circle cx="12" cy="20" r="3.5" fill="#1F478B" stroke="#fff" strokeWidth="1.5" />
            <circle cx="22" cy="20" r="3.5" fill="#1F478B" stroke="#fff" strokeWidth="1.5" />

            {/* Handle */}
            <line x1="14" y1="0" x2="12" y1="-4" stroke="#1F478B" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    )
  }

  // Design 4: Modern geometric with cart forming Kaf's tail
  return (
    <svg viewBox="0 0 200 80" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="محلك">
      <g transform="translate(10, 45)">
        {/* م - geometric circle */}
        <circle cx="12" cy="0" r="12" fill="none" stroke="#1F478B" strokeWidth="7" />
        <circle cx="12" cy="0" r="5" fill="#1F478B" />

        {/* ح - arc */}
        <path d="M 32 10 A 18 18 0 0 1 68 10" fill="none" stroke="#1F478B" strokeWidth="7" strokeLinecap="round" />

        {/* ل - vertical line */}
        <line x1="78" y1="-22" x2="78" y2="15" stroke="#1F478B" strokeWidth="7" strokeLinecap="round" />

        {/* ك with cart as the tail */}
        <g transform="translate(88, 0)">
          <path d="M 0 -18 L 0 12" stroke="#1F478B" strokeWidth="7" strokeLinecap="round" />

          {/* Cart forming the horizontal part of Kaf */}
          <g transform="translate(0, 12)">
            <path
              d="M 0 0 L 5 0 L 8 -8 L 22 -8 L 20 0 L 25 0"
              fill="none"
              stroke="#1F478B"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="10" cy="4" r="3" fill="#1F478B" />
            <circle cx="18" cy="4" r="3" fill="#1F478B" />
          </g>
        </g>
      </g>
    </svg>
  )
}
