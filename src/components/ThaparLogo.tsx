import React from 'react';

interface ThaparLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark-only' | 'horizontal';
  monochrome?: boolean;
}

export function ThaparLogo({
  className = '',
  size = 'md',
  variant = 'full'
}: ThaparLogoProps) {
  const sizeMap = {
    sm: { markW: 24, markH: 26, titleSize: 'text-xs', subSize: 'text-[9px]' },
    md: { markW: 36, markH: 38, titleSize: 'text-sm', subSize: 'text-[10px]' },
    lg: { markW: 52, markH: 56, titleSize: 'text-lg', subSize: 'text-xs' },
    xl: { markW: 68, markH: 74, titleSize: 'text-xl', subSize: 'text-xs' },
  };

  const current = sizeMap[size];

  // The official red "ti" emblem of Thapar Institute of Engineering and Technology
  const MarkSVG = (
    <svg
      width={current.markW}
      height={current.markH}
      viewBox="0 0 100 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        {/* Rich Crimson / Burgundy 3D Gradient matching Thapar emblem */}
        <linearGradient id="thaparRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="35%" stopColor="#dc2626" />
          <stop offset="70%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
        <linearGradient id="thaparHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
        <filter id="thaparShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#7f1d1d" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Stylized 't' */}
      <g filter="url(#thaparShadow)">
        <path
          d="M32 16 C32 16, 22 22, 22 42 L22 46 L14 46 C11.5 46, 9.5 48, 9.5 50.5 C9.5 53, 11.5 55, 14 55 L22 55 L22 76 C22 93, 31 101, 46 101 C52 101, 56.5 99, 58 97.5 C59.5 96, 59.8 93.5, 58.5 92 C57.2 90.5, 54.8 90.5, 52 91.5 C43 94, 34 89, 34 76 L34 55 L52 55 C54.5 55, 56.5 53, 56.5 50.5 C56.5 48, 54.5 46, 52 46 L34 46 L34 38 C34 26, 38 22, 44 20 C46.5 19, 47.5 17, 46.5 14.5 C45.5 12, 43 11, 40.5 12 C37 13.5, 34 14.8, 32 16 Z"
          fill="url(#thaparRedGrad)"
        />
        {/* Soft highlight on 't' */}
        <path
          d="M33 22 C33 22, 25 28, 25 43 L25 47 L34 47 L34 76 C34 85, 39 91, 47 93 C42 91, 36 86, 36 76 L36 49 L25 49"
          fill="url(#thaparHighlight)"
        />

        {/* Stylized 'i' - Circular Dot */}
        <circle cx="75" cy="24" r="11" fill="url(#thaparRedGrad)" />

        {/* Stylized 'i' - Stem */}
        <rect
          x="66"
          y="44"
          width="18"
          height="54"
          rx="9"
          fill="url(#thaparRedGrad)"
        />
      </g>
    </svg>
  );

  if (variant === 'mark-only') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{MarkSVG}</div>;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        {MarkSVG}
        <div className="flex flex-col text-left">
          <span className={`font-serif font-bold text-white tracking-wide uppercase leading-tight ${current.titleSize}`}>
            Thapar Institute
          </span>
          <span className={`text-rose-400 font-sans tracking-wider uppercase font-semibold leading-tight ${current.subSize}`}>
            of Engineering & Technology
          </span>
        </div>
      </div>
    );
  }

  // Full variant (Mark centered above text or stacked)
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {MarkSVG}
      <div className="mt-3 flex flex-col items-center">
        <span className="font-serif font-extrabold text-red-600 dark:text-red-500 tracking-wider text-base sm:text-lg uppercase leading-tight">
          THAPAR INSTITUTE
        </span>
        <span className="text-[10px] sm:text-[11px] font-sans font-medium text-slate-400 uppercase tracking-widest leading-tight mt-0.5">
          OF ENGINEERING & TECHNOLOGY
        </span>
        <span className="text-[9px] text-slate-500 italic mt-0.5">
          (Deemed to be University)
        </span>
      </div>
    </div>
  );
}
