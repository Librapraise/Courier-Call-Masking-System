'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Global ThemeProvider wrapping the application with next-themes.
 * Manages class-based theme toggling ('light', 'dark', 'system')
 * and synchronizes with localStorage and system OS color scheme preferences.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
