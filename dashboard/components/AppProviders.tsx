'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { LazyMotion, MotionConfig } from 'motion/react'
import { useState } from 'react'
import { ScopeProvider } from './ScopeContext'
import AuthBoundary from './AuthBoundary'

const loadMotionFeatures = () => import('./motion-features').then((module) => module.default)

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
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          <Tooltip.Provider delayDuration={300}>
            <AuthBoundary><ScopeProvider>{children}</ScopeProvider></AuthBoundary>
          </Tooltip.Provider>
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  )
}
