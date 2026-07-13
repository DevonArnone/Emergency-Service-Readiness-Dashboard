import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="ops-page flex items-center justify-center">
      <section className="ops-panel max-w-lg text-center">
        <div className="panel-kicker">404</div>
        <h1 className="mt-3 text-2xl font-semibold text-white">Workspace not found</h1>
        <p className="mt-2 text-sm text-slate-400">The requested operational view does not exist.</p>
        <Link href="/" className="ops-button-secondary mt-6 gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to command center
        </Link>
      </section>
    </div>
  )
}
