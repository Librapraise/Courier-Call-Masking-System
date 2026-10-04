'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

interface ThemeToggleProps {
  /** Language for localized option labels: 'en' or 'he' */
  lang?: 'en' | 'he'
  /** Optional custom CSS classes for the trigger button */
  className?: string
  /** Whether to show a text label next to the active icon on the trigger button */
  showLabel?: boolean
  /** Dropdown menu alignment relative to trigger button: 'start' | 'end' */
  align?: 'start' | 'end'
  /** Dropdown menu placement direction: 'up' | 'down' | 'auto' */
  direction?: 'up' | 'down' | 'auto'
}

/**
 * Sun Icon (Light Mode)
 */
export function SunIcon({ className = 'w-4 h-4', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

/**
 * Moon Icon (Dark Mode)
 */
export function MoonIcon({ className = 'w-4 h-4', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  )
}

/**
 * Desktop / Monitor Icon (System Preference)
 */
export function MonitorIcon({ className = 'w-4 h-4', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" />
      <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" />
      <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Checkmark Icon
 */
function CheckIcon({ className = 'w-3.5 h-3.5', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.5"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/**
 * Sleek, bilingual, RTL-compatible Dark/Light/System Theme Toggle Dropdown.
 * Uses `next-themes` to manage active theme cleanly without hydration mismatch.
 */
export default function ThemeToggle({
  lang = 'en',
  className = '',
  showLabel = false,
  align = 'end',
  direction = 'auto'
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [resolvedDirection, setResolvedDirection] = useState<'up' | 'down'>('down')
  const [resolvedAlign, setResolvedAlign] = useState<'left' | 'right'>('right')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Prevent Next.js SSR hydration mismatches
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-detect direction and alignment based on viewport boundary space when opened
  const toggleDropdown = () => {
    setIsOpen(prev => {
      const willOpen = !prev
      if (willOpen && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceRight = window.innerWidth - rect.left
        const spaceLeft = rect.right

        // 1. Vertical placement check (dropdown height is ~180-210px)
        if (direction === 'up' || direction === 'down') {
          setResolvedDirection(direction)
        } else {
          if (spaceBelow < 220 && rect.top > 220) {
            setResolvedDirection('up')
          } else {
            setResolvedDirection('down')
          }
        }

        // 2. Horizontal placement check (dropdown width is ~224px)
        // If there's less than 230px on the left, right-0 would clip off screen! Force left-0.
        // If there's less than 230px on the right, left-0 would clip off screen! Force right-0.
        if (spaceLeft < 230) {
          setResolvedAlign('left')
        } else if (spaceRight < 230) {
          setResolvedAlign('right')
        } else {
          // Inside comfortable bounds, respect requested alignment
          if (align === 'start') {
            setResolvedAlign(isRtl ? 'right' : 'left')
          } else {
            setResolvedAlign(isRtl ? 'left' : 'right')
          }
        }
      }
      return willOpen
    })
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const isRtl = lang === 'he'

  const labels = {
    light: isRtl ? 'בהיר' : 'Light',
    dark: isRtl ? 'כהה' : 'Dark',
    system: isRtl ? 'מערכת' : 'System',
    title: isRtl ? 'ערכת נושא' : 'Theme',
    deviceDark: isRtl ? 'כהה' : 'Dark',
    deviceLight: isRtl ? 'בהיר' : 'Light',
    matchDevice: isRtl ? 'תואם להגדרות המכשיר' : 'Matches device OS',
    alwaysLight: isRtl ? 'מצב בהיר קבוע' : 'Always light mode',
    alwaysDark: isRtl ? 'מצב כהה קבוע' : 'Always dark mode'
  }

  // Pre-hydration placeholder to match server HTML exactly
  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-xs text-slate-400 ${className}`}
        aria-hidden="true"
      >
        <span className="w-4 h-4 block rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </div>
    )
  }

  // Active Icon Resolver
  const currentIcon = () => {
    if (theme === 'system') {
      return (
        <MonitorIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400 transition-transform duration-200 group-hover:scale-110" />
      )
    }
    if (resolvedTheme === 'dark') {
      return (
        <MoonIcon className="w-4 h-4 text-indigo-400 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110" />
      )
    }
    return (
      <SunIcon className="w-4 h-4 text-amber-500 transition-transform duration-200 group-hover:rotate-45 group-hover:scale-110" />
    )
  }

  const currentLabel = () => {
    if (theme === 'light') return labels.light
    if (theme === 'dark') return labels.dark
    const detectedName = resolvedTheme === 'dark' ? labels.deviceDark : labels.deviceLight
    return `${labels.system} (${detectedName})`
  }

  const currentTooltip = () => {
    if (theme === 'system') {
      const detectedName = resolvedTheme === 'dark' ? labels.deviceDark : labels.deviceLight
      return isRtl
        ? `ערכת נושא: מערכת (תואם למכשיר שלך - כרגע ${detectedName})`
        : `Theme: System (matches your device - currently ${detectedName})`
    }
    return `${labels.title}: ${theme === 'dark' ? labels.dark : labels.light}`
  }

  const themeOptions: Array<{
    id: 'light' | 'dark' | 'system'
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      id: 'light',
      label: labels.light,
      description: labels.alwaysLight,
      icon: <SunIcon className="w-4 h-4 text-amber-500 shrink-0" />
    },
    {
      id: 'dark',
      label: labels.dark,
      description: labels.alwaysDark,
      icon: <MoonIcon className="w-4 h-4 text-indigo-400 shrink-0" />
    },
    {
      id: 'system',
      label: labels.system,
      description: `${labels.matchDevice} (${resolvedTheme === 'dark' ? labels.deviceDark : labels.deviceLight})`,
      icon: <MonitorIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
    }
  ]

  const handleSelect = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme)
    setIsOpen(false)
  }

  // Positioning computation
  const horizontalClass = resolvedAlign === 'left' ? 'left-0' : 'right-0'

  // Vertical placement & transform origin:
  const isUp = resolvedDirection === 'up'
  const verticalClass = isUp ? 'bottom-full mb-2' : 'top-full mt-2'

  const originClass = isUp
    ? (resolvedAlign === 'right' ? 'origin-bottom-right' : 'origin-bottom-left')
    : (resolvedAlign === 'right' ? 'origin-top-right' : 'origin-top-left')

  return (
    <div className="relative inline-block text-start" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleDropdown}
        className={`group flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/90 text-slate-700 dark:text-slate-200 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40 ${className}`}
        aria-label={currentTooltip()}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={currentTooltip()}
      >
        <span className="flex items-center justify-center shrink-0">
          {currentIcon()}
        </span>

        {showLabel && (
          <span className="text-xs font-semibold tracking-tight text-slate-700 dark:text-slate-200 hidden sm:inline-block">
            {currentLabel()}
          </span>
        )}

        <svg
          className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? (isUp ? 'rotate-0' : 'rotate-180') : (isUp ? 'rotate-180' : '')
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Sleek Glassmorphic Dropdown Menu */}
      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`absolute z-50 ${verticalClass} ${horizontalClass} ${originClass} w-48 sm:w-56 py-1.5 rounded-2xl bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/50 transition-all duration-150 animate-in fade-in zoom-in-95`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 mb-1">
            {labels.title}
          </div>

          <div className="p-1 space-y-0.5">
            {themeOptions.map(option => {
              const isSelected = theme === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#4352E8]/10 dark:bg-[#4352E8]/20 text-[#4352E8] dark:text-[#818cf8] font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {option.icon}
                    <div className="flex flex-col text-start min-w-0">
                      <span className="truncate">{option.label}</span>
                      <span className={`text-[10px] font-normal truncate ${
                        isSelected
                          ? 'text-[#4352E8]/80 dark:text-[#818cf8]/80'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {option.description}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <CheckIcon className="w-3.5 h-3.5 text-[#4352E8] dark:text-[#818cf8] shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
