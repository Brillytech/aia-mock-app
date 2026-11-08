import React from 'react';

export default function AiaLogo({
  className = 'h-8',
  showAcademy = true,
  forceWhiteInk = false,
  useWebpFile = false
}) {
  if (useWebpFile) {
    return (
      <img
        src="/logo.webp"
        alt="AIA Academy"
        className={`${className} w-auto object-contain transition-all duration-200 ${
          forceWhiteInk
            ? 'invert hue-rotate-180 brightness-110'
            : 'dark:invert dark:hue-rotate-180 dark:brightness-110'
        }`}
      />
    );
  }

  const inkColorClass = forceWhiteInk
    ? 'text-white fill-white'
    : 'text-zinc-950 dark:text-white fill-zinc-950 dark:fill-white';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox={showAcademy ? '0 0 560 115' : '0 0 185 115'}
        className="h-full w-auto overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="AIA Academy Logo"
      >
        <path
          d="M28 28L4 102H23L28.5 84H51.5L57 102H76L52 28H28ZM33.5 68L40 46L46.5 68H33.5Z"
          fill="#FF5500"
        />

        <g className={`transition-colors duration-200 ${inkColorClass}`}>
          <polygon points="92,4 58,20 92,34 126,20" />
          <path
            d="M66 23.5V43"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <polygon points="66,41 63.5,48 68.5,48" />
          <path d="M77 29.5L92 36L107 29.5V39C107 39 100 35.5 92 35.5C84 35.5 77 39 77 39V29.5Z" />
          <path d="M78 43C85 40 99 40 106 43V83C99 81 85 81 78 83V43Z" />
          <path d="M78 86.5C85 84.5 99 84.5 106 86.5L92 111L78 86.5Z" />
        </g>

        <path
          d="M132 28L108 102H127L132.5 84H155.5L161 102H180L156 28H132ZM137.5 68L144 46L150.5 68H137.5Z"
          fill="#FF5500"
        />

        {showAcademy && (
          <g className={`transition-colors duration-200 ${inkColorClass}`}>
            <circle cx="204" cy="66" r="8.5" />
            <text
              x="226"
              y="96"
              fill="currentColor"
              fontFamily="Inter, system-ui, -apple-system, sans-serif"
              fontWeight="900"
              fontSize="74"
              letterSpacing="-3.5"
            >
              ACADEMY
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}