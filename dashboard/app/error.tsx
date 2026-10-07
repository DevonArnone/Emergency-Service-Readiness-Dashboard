'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui'
import styles from './states.module.css'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={styles.inline}>
      <section className={styles.inlineCard} role="alert">
        <span className={styles.icon}><AlertTriangle aria-hidden="true" /></span>
        <h1>This workspace could not load</h1>
        <p>{error.message || 'An unexpected application error occurred.'}</p>
        <p>Your records are unchanged. Retry, or return to the county overview.</p>
        <div className="ui-page-actions" style={{ marginTop: 20 }}>
          <Button variant="primary" onClick={reset}><RefreshCw aria-hidden="true" />Retry</Button>
          <Link className="ui-button" href="/">County overview</Link>
        </div>
      </section>
    </div>
  )
}
