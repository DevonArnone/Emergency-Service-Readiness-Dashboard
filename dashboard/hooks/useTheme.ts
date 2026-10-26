'use client'

import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'aegis-theme'

/** Runs before first paint (inlined in the root layout). Dark is the default; a stored choice wins. */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`

const listeners = new Set<() => void>()
const read = (): Theme => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

export function useTheme() {
  const theme = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, read, () => 'dark' as Theme)
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    listeners.forEach((listener) => listener())
  }, [])
  return { theme, setTheme, toggle: () => setTheme(read() === 'dark' ? 'light' : 'dark') }
}

const stored = (): Theme => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' } }

/**
 * Keeps the theme on <html> if React ever re-renders the root element (for example while recovering from a
 * hydration mismatch), which drops attributes that are not in the JSX. Runs before paint, so nothing flashes.
 */
export function useThemeGuard() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const restore = () => { if (root.dataset.theme !== 'light' && root.dataset.theme !== 'dark') { root.dataset.theme = stored(); listeners.forEach((listener) => listener()) } }
    restore()
    const observer = new MutationObserver(restore)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
}

