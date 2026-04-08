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
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9.2 3.5C7.1 3.5 5.4 5.2 5.4 7.3V8.4C4.3 8.9 3.5 10 3.5 11.3C3.5 12.6 4.3 13.7 5.4 14.2V15.4C5.4 17.5 7.1 19.2 9.2 19.2H10.3V3.5H9.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.8 3.5C16.9 3.5 18.6 5.2 18.6 7.3V8.4C19.7 8.9 20.5 10 20.5 11.3C20.5 12.6 19.7 13.7 18.6 14.2V15.4C18.6 17.5 16.9 19.2 14.8 19.2H13.7V3.5H14.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10.3 7H13.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.3 11.3H13.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.3 15.5H13.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
