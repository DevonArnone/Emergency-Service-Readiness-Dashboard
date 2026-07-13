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
    const savedScope = window.localStorage.getItem('ridgecrest-station-scope')
    if (savedScope) setStationId(savedScope)
  }, [])

  const value = useMemo(() => ({
    stationId,
    setStationId: (nextStationId: string) => {
      setStationId(nextStationId)
      window.localStorage.setItem('ridgecrest-station-scope', nextStationId)
    },
  }), [stationId])

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useStationScope() {
  const context = useContext(ScopeContext)
  if (!context) throw new Error('useStationScope must be used within ScopeProvider')
  return context
}
