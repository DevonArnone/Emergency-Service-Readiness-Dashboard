'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export const THEME_KEY = 'aegis-theme'

/** Runs before first paint (inlined in the root layout) so a stored or system dark preference never flashes light. */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`

const listeners = new Set<() => void>()
const read = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

export function useTheme() {
  const theme = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, read, () => 'light' as Theme)
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(THEME_KEY, next) } catch {}
    listeners.forEach((listener) => listener())
  }, [])
  return { theme, setTheme, toggle: () => setTheme(read() === 'dark' ? 'light' : 'dark') }
}
