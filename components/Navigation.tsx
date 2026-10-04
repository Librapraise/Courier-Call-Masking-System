'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GhostCrmLogoIcon } from '@/components/crm/GhostCrmLogo'
import ThemeToggle from '@/components/ThemeToggle'

interface NavLink {
  href: string
  label: string
  isPrimary?: boolean
  onClick?: () => void
}

interface NavigationProps {
  title: string
  links: NavLink[]
  onLogout?: () => void
  showCrmLink?: boolean
}

export default function Navigation({ title, links, onLogout, showCrmLink }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  // Strictly hide Persian CRM button from couriers; only show on /admin or if explicitly requested
  const shouldShowCrm = showCrmLink ?? (pathname ? pathname.startsWith('/admin') : false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleLinkClick = (link: NavLink) => {
    closeMenu()
    if (link.onClick) {
      link.onClick()
    }
  }

  const ariaExpanded = isMenuOpen ? 'true' : 'false'

  return (
    <nav className="bg-white dark:bg-[#0B0F17] border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex lg:h-16 md:h-24 flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-3 sm:py-0">
          {/* Title and Hamburger Button */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2.5">
              <GhostCrmLogoIcon className="w-7 h-7 drop-shadow-sm shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white transition-colors">{title}</h1>
            </div>
            {/* Hamburger Button - Mobile Only */}
            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle />
              <button
                onClick={toggleMenu}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Toggle menu"
                {...(isMenuOpen ? { 'aria-expanded': 'true' } : { 'aria-expanded': 'false' })}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden sm:flex items-center flex-wrap gap-2 sm:gap-4">
            <ThemeToggle />

            {links.map((link) => (
              link.onClick ? (
                <button
                  key={link.href}
                  onClick={link.onClick}
                  className={`rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition ${
                    link.isPrimary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition ${
                    link.isPrimary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}

            {/* Direct Switcher to Persian CRM (Strictly Admin Only) */}
            {shouldShowCrm && (
              <Link
                href="/crm"
                className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold bg-[#1E2235] text-white hover:bg-[#4352E8] transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Open Persian Team Management CRM"
              >
                <span>Persian CRM</span>
                <span className="text-[10px] bg-emerald-500/25 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded">/crm</span>
              </Link>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="rounded-md bg-gray-200 dark:bg-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 transition"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu - Slides down when open */}
        <div
          className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="py-4 space-y-2 border-t border-gray-200 dark:border-slate-800">
            {/* Direct Switcher to Persian CRM on Mobile (Strictly Admin Only) */}
            {shouldShowCrm && (
              <Link
                href="/crm"
                onClick={closeMenu}
                className="block w-full rounded-md px-4 py-2 text-sm font-bold bg-[#1E2235] text-white flex items-center justify-between"
              >
                <span>Persian CRM</span>
                <span className="text-[10px] bg-emerald-500/25 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded">/crm</span>
              </Link>
            )}
            {links.map((link) => (
              link.onClick ? (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link)}
                  className={`block w-full text-left rounded-md px-4 py-2 text-sm font-medium ${
                    link.isPrimary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={`block w-full text-left rounded-md px-4 py-2 text-sm font-medium ${
                    link.isPrimary
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
            {onLogout && (
              <button
                onClick={() => {
                  closeMenu()
                  onLogout()
                }}
                className="block w-full text-left rounded-md px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

