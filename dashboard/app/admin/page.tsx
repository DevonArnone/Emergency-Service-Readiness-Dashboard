'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Database,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { AssuranceInstrument, AuditRegister } from '@/components/UtilityInstruments'
import { useAccess } from '@/hooks/useAccess'
import { api } from '@/lib/api'
import { Button, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils'
import styles from '../utility.module.css'

export default function AdminPage() {
  const queryClient = useQueryClient()
  const access = useAccess()
  const operations = useQuery({ queryKey: ['admin', 'operations-health'], queryFn: () => api.operationsSnapshot() })
  const audit = useQuery({ queryKey: ['admin', 'recent-audit'], queryFn: () => api.auditEvents(60) })
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const resetDemo = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries()
      const count = Object.values(result.seeded).reduce((total, value) => total + value, 0)
      setFeedback({ tone: 'success', message: `Synthetic demonstration records restored. ${count.toLocaleString()} records were seeded across the operating model.` })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const confirmReset = () => {
    setFeedback(null)
    if (window.confirm('Replace all synthetic demonstration records? Current demo edits will be permanently removed.')) resetDemo.mutate()
  }

  const identity = access.data?.display_name || 'Public observer'
  const accessMode = access.data?.can_write ? 'Operator' : 'Read only'
  const serviceReady = operations.isSuccess

  return (
    <div className="ops-page page-enter civic-workspace">
      <div className="ops-shell">
        <div className={styles.workspace}>
          <PageHeader eyebrow="System administration" title="Access & Service Register" description="Review the current identity, effective permissions, service availability, and synthetic-data provenance. This workspace never displays credentials or grants additional access." />

          {(access.isError || operations.isError) && <ErrorState message={(access.error || operations.error)?.message} retry={() => { access.refetch(); operations.refetch() }} />}

          {access.isPending ? <section className={styles.plate} aria-label="Loading access register"><LoadingState rows={6} /></section> : (
            <>
              <section className={styles.register} aria-label="Administration status">
                <div className={styles.registerCell}><span className={styles.registerLabel}><UserRound className="size-4" aria-hidden="true" />Signed-in identity</span><strong className={styles.registerValue}>{identity}</strong><span className={styles.registerDetail}>Identity supplied by the active application session</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><KeyRound className="size-4" aria-hidden="true" />Access mode</span><strong className={styles.registerValue}>{accessMode}</strong><span className={styles.registerDetail}>{access.data?.can_write ? 'Authorized operational changes enabled' : 'Records may be inspected but not changed'}</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><ServerCog className="size-4" aria-hidden="true" />Operations service</span><strong className={styles.registerValue}>{operations.isPending ? 'Checking' : serviceReady ? 'Connected' : 'Attention'}</strong><span className={styles.registerDetail}>{operations.data ? `Snapshot ${formatRelativeTime(operations.data.timestamp)}` : 'Waiting for a verified response'}</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><ShieldCheck className="size-4" aria-hidden="true" />Data boundary</span><strong className={styles.registerValue}>Synthetic</strong><span className={styles.registerDetail}>Unofficial concept; no county operational records</span></div>
              </section>

              <AssuranceInstrument identityReady={access.isSuccess} operationsReady={serviceReady} auditReady={audit.isSuccess} checking={access.isFetching || operations.isFetching || audit.isFetching} snapshotTime={operations.data?.timestamp} onRefresh={() => { access.refetch(); operations.refetch(); audit.refetch() }} />
              {audit.isError ? <ErrorState message={audit.error.message} retry={() => audit.refetch()} /> : audit.isPending ? <LoadingState rows={4} /> : <AuditRegister events={audit.data || []} />}

              <div className={styles.adminGrid}>
                <section className={styles.plate} aria-labelledby="identity-heading">
                  <header className={styles.plateHeader}><div><h2 id="identity-heading">Identity & permissions</h2><p>Effective rights for this browser session</p></div><LockKeyhole className="size-4" aria-hidden="true" /></header>
                  <dl className={styles.permissionList}><div className={styles.permissionRow}><dt>Display identity</dt><dd>{identity}</dd></div><div className={styles.permissionRow}><dt>View operating picture</dt><dd><span className={`${styles.permissionState} ${styles.stateReady}`}>Allowed</span></dd></div><div className={styles.permissionRow}><dt>Modify operational records</dt><dd><span className={`${styles.permissionState} ${access.data?.can_write ? styles.stateReady : ''}`}>{access.data?.can_write ? 'Allowed' : 'Restricted'}</span></dd></div><div className={styles.permissionRow}><dt>Restore demonstration data</dt><dd><span className={`${styles.permissionState} ${access.data?.can_reset_demo ? styles.stateReady : ''}`}>{access.data?.can_reset_demo ? 'Allowed' : 'Restricted'}</span></dd></div></dl>
                </section>

                <section className={styles.plate} aria-labelledby="service-heading">
                  <header className={styles.plateHeader}><div><h2 id="service-heading">Service register</h2><p>Checks performed from this client session</p></div><Database className="size-4" aria-hidden="true" /></header>
                  <dl className={styles.serviceList}><div className={styles.serviceRow}><dt>Identity service</dt><dd><span className={`${styles.serviceState} ${access.isSuccess ? styles.stateReady : styles.stateAttention}`}>{access.isSuccess ? 'Responding' : 'Attention'}</span></dd></div><div className={styles.serviceRow}><dt>Operations API</dt><dd><span className={`${styles.serviceState} ${serviceReady ? styles.stateReady : styles.stateAttention}`}>{operations.isPending ? 'Checking' : serviceReady ? 'Responding' : 'Attention'}</span></dd></div><div className={styles.serviceRow}><dt>Operational snapshot</dt><dd>{operations.data ? formatRelativeTime(operations.data.timestamp) : 'Not available'}</dd></div><div className={styles.serviceRow}><dt>Independent infrastructure probes</dt><dd>Not performed from the browser</dd></div></dl>
                </section>

                <section className={styles.plate} aria-labelledby="provenance-heading">
                  <header className={styles.plateHeader}><div><h2 id="provenance-heading">Provenance ledger</h2><p>What this concept may and may not represent</p></div><CheckCircle2 className="size-4" aria-hidden="true" /></header>
                  <dl className={styles.ledger}><div className={styles.ledgerRow}><dt>Product status</dt><dd>Unofficial portfolio concept; not endorsed by Fairfax County.</dd></div><div className={styles.ledgerRow}><dt>Station context</dt><dd>Public Fairfax County station references presented for interface demonstration.</dd></div><div className={styles.ledgerRow}><dt>Operational records</dt><dd>Synthetic units, staffing, incidents, credentials, shifts, alerts, and activity.</dd></div><div className={styles.ledgerRow}><dt>Restricted content</dt><dd>No patient identifiers, clinical narratives, ePHI, or private county-system data.</dd></div></dl>
                </section>

                <section className={styles.plate} aria-labelledby="system-heading">
                  <header className={styles.plateHeader}><div><h2 id="system-heading">System boundaries</h2><p>Purpose and operational limitations</p></div><ShieldCheck className="size-4" aria-hidden="true" /></header>
                  <dl className={styles.ledger}><div className={styles.ledgerRow}><dt>Purpose</dt><dd>Readiness coordination, exception review, and shift handover demonstration.</dd></div><div className={styles.ledgerRow}><dt>Not a replacement for</dt><dd>CAD, dispatch, ePCR, payroll, clinical systems, or public-warning channels.</dd></div><div className={styles.ledgerRow}><dt>Authorization</dt><dd>Server-enforced permissions remain authoritative; this page only reports the current session state.</dd></div><div className={styles.ledgerRow}><dt>Configuration</dt><dd>Secrets and private infrastructure details are intentionally excluded.</dd></div></dl>
                </section>
              </div>

              <section className={styles.plate} aria-labelledby="reset-heading">
                <div className={styles.protectedAction}><div><h2 id="reset-heading">Protected demonstration reset</h2><p>Replace the current tenant’s synthetic demonstration records with the baseline dataset. This action removes unsaved demonstration changes and is available only when the existing session policy grants reset authority.</p></div><div className={styles.actionControl}><Button type="button" variant="danger" busy={resetDemo.isPending} disabled={!access.data?.can_reset_demo} title={!access.data?.can_reset_demo ? 'Your current session is not authorized to restore demonstration data.' : undefined} onClick={confirmReset}><RefreshCw className="size-4" aria-hidden="true" />Restore demo data</Button>{!access.data?.can_reset_demo && <small>Restricted by the current access policy.</small>}</div></div>
                {feedback && <p className={`${styles.feedback} ${feedback.tone === 'error' ? styles.feedbackError : ''}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
