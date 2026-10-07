'use client'

import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Inspectors dock beside the workspace from this width; below it they open as drawers. */
export const useDockedInspector = () => useMediaQuery('(min-width: 1280px)')
