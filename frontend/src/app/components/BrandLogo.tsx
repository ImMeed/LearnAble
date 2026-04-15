type BrandLogoProps = {
  size?: number;
  className?: string;
};

export function BrandLogo({ size = 34, className }: BrandLogoProps) {
  return (
    <span className={className} aria-hidden="true" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="learnable-book-left" x1="10" y1="18" x2="30" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5CA2F4" />
            <stop offset="1" stopColor="#2F63D9" />
          </linearGradient>
          <linearGradient id="learnable-book-right" x1="54" y1="18" x2="34" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="#83E1B0" />
            <stop offset="1" stopColor="#39B978" />
          </linearGradient>
          <linearGradient id="learnable-path" x1="32" y1="18" x2="32" y2="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF3B0" />
            <stop offset="1" stopColor="#FFFFFF" />
          </linearGradient>
          <filter id="learnable-shadow" x="4" y="8" width="56" height="48" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#16315E" floodOpacity="0.18" />
          </filter>
        </defs>

        <g filter="url(#learnable-shadow)">
          <path
            d="M32 46C24.1 42 17.3 40.7 10 41.8V21.7C17 19.9 23.8 20.8 32 25.9V46Z"
            fill="url(#learnable-book-left)"
          />
          <path
            d="M32 46C39.9 42 46.7 40.7 54 41.8V21.7C47 19.9 40.2 20.8 32 25.9V46Z"
            fill="url(#learnable-book-right)"
          />
          <path
            d="M32 46C25.1 42.8 18.9 41.6 12.2 42.4"
            stroke="#EAF4FF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M32 46C38.9 42.8 45.1 41.6 51.8 42.4"
            stroke="#F1FFF7"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M32 42.8C26.4 40.2 21.1 39.1 15.6 39.7"
            stroke="#EAF4FF"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.74"
          />
          <path
            d="M32 42.8C37.6 40.2 42.9 39.1 48.4 39.7"
            stroke="#F1FFF7"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.74"
          />
          <path
            d="M10 21.7C17 19.9 23.8 20.8 32 25.9"
            stroke="#20498F"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M54 21.7C47 19.9 40.2 20.8 32 25.9"
            stroke="#1C8156"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M32 17.2C28.8 17.2 26.3 19.7 26.3 22.8V31.1C26.3 34.8 24.1 38.1 20.7 39.6"
            stroke="url(#learnable-path)"
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M32 17.2C35.2 17.2 37.7 19.7 37.7 22.8V31.1C37.7 34.8 39.9 38.1 43.3 39.6"
            stroke="url(#learnable-path)"
            strokeWidth="4.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M32 18.4V45.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M32 12L33.2 14.9L36.1 16.1L33.2 17.3L32 20.2L30.8 17.3L27.9 16.1L30.8 14.9L32 12Z"
            fill="#FFD93D"
          />
          <path
            d="M10 41.8C17.3 40.7 24.1 42 32 46C39.9 42 46.7 40.7 54 41.8"
            stroke="#18325E"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </span>
  );
}
