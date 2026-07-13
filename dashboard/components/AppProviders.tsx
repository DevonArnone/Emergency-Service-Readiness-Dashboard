'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useState } from 'react'
import { ScopeProvider } from './ScopeContext'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: false,
      },
      mutations: { retry: false },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <ScopeProvider>{children}</ScopeProvider>
      </Tooltip.Provider>
    </QueryClientProvider>
  )
}
