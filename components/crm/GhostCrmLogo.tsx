import React from 'react'

interface GhostCrmLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showText?: boolean
  subtext?: string
}

export function GhostCrmLogoIcon({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Persian CRM Logo"
    >
      <defs>
        <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="50%" stopColor="#0B0F19" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="logoIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient id="logoCyan" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        <linearGradient id="logoRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.7" />
        </linearGradient>

        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Squircle Container */}
      <rect
        x="28"
        y="28"
        width="456"
        height="456"
        rx="124"
        fill="url(#logoBgGrad)"
        stroke="url(#logoRim)"
        strokeWidth="8"
      />

      {/* Radial Ambient Back-Glow */}
      <circle cx="256" cy="240" r="160" fill="#4F46E5" opacity="0.25" filter="url(#logoGlow)" />
      <circle cx="256" cy="240" r="90" fill="#06B6D4" opacity="0.2" filter="url(#logoGlow)" />

      {/* Signal Radiation Wave Arcs (Call Masking / Telegram Pipeline) */}
      <path
        d="M 172 152 A 114 114 0 0 1 340 152"
        fill="none"
        stroke="url(#logoCyan)"
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M 204 184 A 72 72 0 0 1 308 184"
        fill="none"
        stroke="url(#logoCyan)"
        strokeWidth="12"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Ghost Stealth Shield Body */}
      <path
        d="M 256 194
           C 314 194 356 232 356 290
           C 356 344 316 388 256 424
           C 196 388 156 344 156 290
           C 156 232 198 194 256 194 Z"
        fill="url(#logoIndigo)"
      />

      {/* Right Shaded Facet for 3D Cyber Depth */}
      <path
        d="M 256 194
           C 314 194 356 232 356 290
           C 356 344 316 388 256 424
           L 256 194 Z"
        fill="#000000"
        opacity="0.2"
      />

      {/* Glowing Slits / Visor / Eyes (Masked Identity) */}
      <path
        d="M 202 284 L 236 298 C 238 299 236 304 232 304 L 200 294 C 196 292 197 285 202 284 Z"
        fill="#FFFFFF"
        filter="url(#logoGlow)"
      />
      <path
        d="M 202 284 L 236 298 C 238 299 236 304 232 304 L 200 294 C 196 292 197 285 202 284 Z"
        fill="url(#logoCyan)"
      />

      <path
        d="M 310 284 L 276 298 C 274 299 276 304 280 304 L 312 294 C 316 292 315 285 310 284 Z"
        fill="#FFFFFF"
        filter="url(#logoGlow)"
      />
      <path
        d="M 310 284 L 276 298 C 274 299 276 304 280 304 L 312 294 C 316 292 315 285 310 284 Z"
        fill="url(#logoCyan)"
      />

      {/* Center Connected Pulse Beacon */}
      <circle cx="256" cy="346" r="10" fill="#FFFFFF" />
      <circle cx="256" cy="346" r="16" fill="url(#logoCyan)" opacity="0.8" />
    </svg>
  )
}

export default function GhostCrmLogo({
  size = 'md',
  className = '',
  showText = true,
  subtext = 'Bilingual Ops & Inventory'
}: GhostCrmLogoProps) {
  const iconSizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  }[size]

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative shrink-0 transition-transform duration-200 hover:scale-105">
        <GhostCrmLogoIcon className={`${iconSizeClasses} drop-shadow-md`} />
      </div>

      {showText && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1 truncate">
              <span>Persian CRM</span>
            </h2>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
              v2.0
            </span>
          </div>
          {subtext && (
            <p className="text-[11px] text-slate-400 font-medium truncate">{subtext}</p>
          )}
        </div>
      )}
    </div>
  )
}
