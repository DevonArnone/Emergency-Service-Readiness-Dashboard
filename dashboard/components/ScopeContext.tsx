'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type ScopeContextValue = {
  stationId: string
  setStationId: (stationId: string) => void
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [stationId, setStationId] = useState('all')

  useEffect(() => {
    try {
      const savedScope = window.localStorage.getItem('aegis-station-scope')
      if (savedScope) setStationId(savedScope)
    } catch { /* Browsing still works when persistence is unavailable. */ }
  }, [])

  const value = useMemo(() => ({
    stationId,
    setStationId: (nextStationId: string) => {
      setStationId(nextStationId)
      try { window.localStorage.setItem('aegis-station-scope', nextStationId) } catch { /* Keep the session scope. */ }
    },
  }), [stationId])

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useStationScope() {
  const context = useContext(ScopeContext)
  if (!context) throw new Error('useStationScope must be used within ScopeProvider')
  return context
}
