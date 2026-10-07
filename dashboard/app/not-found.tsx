import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import styles from './states.module.css'

export default function NotFound() {
  return (
    <div className={styles.inline}>
      <section className={styles.inlineCard}>
        <span className={styles.code}>404</span>
        <h1>Workspace not found</h1>
        <p>No Aegis Command workspace lives at this address. Use the navigation or search to find a station, unit, or incident.</p>
        <div className="ui-page-actions" style={{ marginTop: 20 }}>
          <Link href="/" className="ui-button ui-button-primary"><ArrowLeft aria-hidden="true" />Return to county overview</Link>
        </div>
      </section>
    </div>
  )
}
