'use client'

import { useCallback, useSyncExternalStore } from 'react'

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
