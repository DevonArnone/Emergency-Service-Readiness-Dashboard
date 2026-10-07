import { LoadingState } from '@/components/ui'
import styles from './states.module.css'

export default function Loading() {
  return (
    <div className={styles.skeletonPage} aria-busy="true" aria-label="Loading workspace">
      <div className={styles.bar} style={{ width: 'min(320px, 60%)', height: 30 }} />
      <div className={styles.bar} style={{ width: 'min(560px, 90%)' }} />
      <div className={styles.block}><LoadingState rows={3} label="Loading summary" /></div>
      <div className={styles.block}><LoadingState rows={9} label="Loading workspace records" /></div>
    </div>
  )
}
