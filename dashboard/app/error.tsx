'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ops-page flex items-center justify-center">
      <section className="ops-panel max-w-lg text-center" role="alert">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">This workspace could not load</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{error.message || 'An unexpected application error occurred.'}</p>
        <button type="button" onClick={reset} className="ops-button-primary mt-6 gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
        </button>
      </section>
    </div>
  )
}
