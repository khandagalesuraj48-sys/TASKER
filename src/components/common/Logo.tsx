import React from 'react';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'icon' | 'full';
  showTagline?: boolean;
  className?: string;
  animate?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  showTagline = false,
  className = '',
  animate = false,
}) => {
  const iconDimensions = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const taglineSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  };

  const [imgError, setImgError] = React.useState(false);

  const uniqueGradId = `tasker_brand_grad_${size}`;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon Mark */}
      <div
        className={`relative shrink-0 flex items-center justify-center ${iconDimensions[size]} ${
          animate ? 'animate-pulse' : ''
        }`}
      >
        {!imgError ? (
          <img
            src="/icon-192.png"
            alt="TASKER"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-[22%] shadow-sm transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
          >
            <defs>
              <linearGradient id={uniqueGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>

            {/* Squircle Background */}
            <rect width="48" height="48" rx="12" fill={`url(#${uniqueGradId})`} />

            {/* Subtle Inner Highlight Border */}
            <rect
              x="0.75"
              y="0.75"
              width="46.5"
              height="46.5"
              rx="11.25"
              stroke="white"
              strokeOpacity="0.15"
              strokeWidth="1.5"
            />

            {/* Top Task Bar */}
            <path
              d="M13 14.5H35"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Dynamic Action Checkmark (forming the T + Execution) */}
            <path
              d="M14 26L21.5 33.5L35 18"
              stroke="white"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Wordmark */}
      {variant === 'full' && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`font-black tracking-tight text-slate-900 dark:text-slate-100 ${textSizes[size]}`}
          >
            TASKER
          </span>
          {showTagline && (
            <span
              className={`font-medium text-slate-500 dark:text-slate-400 mt-0.5 tracking-normal ${taglineSizes[size]}`}
            >
              Work & Productivity
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;

