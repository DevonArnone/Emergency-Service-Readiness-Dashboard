'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmAction'
import { Button, ErrorState, LoadingState, Notice, PageHeader, Panel, StatusBadge, SummaryStrip, type NoticeValue } from '@/components/ui'
import { useAccess } from '@/hooks/useAccess'
import { api } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, titleCase } from '@/lib/utils'
import styles from '../utility.module.css'

const allowed = (value?: boolean) => <StatusBadge tone={value ? 'success' : 'neutral'}>{value ? 'Allowed' : 'Restricted'}</StatusBadge>

export default function AdminPage() {
  const queryClient = useQueryClient()
  const access = useAccess()
  const operations = useQuery({ queryKey: ['admin', 'operations-health'], queryFn: () => api.operationsSnapshot() })
  const audit = useQuery({ queryKey: ['admin', 'recent-audit'], queryFn: () => api.auditEvents(60) })
  const [section, setSection] = useState('access')
  const [check, setCheck] = useState('operations')
  const [auditFilter, setAuditFilter] = useState('all')
  const [auditId, setAuditId] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [feedback, setFeedback] = useState<NoticeValue>(null)

  const identity = access.data?.display_name || 'Public observer'
  const accessMode = access.data?.can_write ? 'Operator' : 'Read only'
  const serviceReady = operations.isSuccess
  const checking = access.isFetching || operations.isFetching || audit.isFetching
  const checks = [
    { id: 'identity', title: 'Session identity', subtitle: 'Effective access response', ready: access.isSuccess, detail: 'The application access response reports the current display identity and effective permissions. Server-side authorization remains authoritative.' },
    { id: 'operations', title: 'Operating picture', subtitle: 'Tenant-scoped snapshot', ready: serviceReady, detail: `A successful response verifies this browser can retrieve the operating snapshot. Source time: ${operations.data?.timestamp ? formatDate(operations.data.timestamp, 'MMM d · HH:mm:ss') : 'not available'}. This is not an independent database, Kafka, Redis, or Snowflake health probe.` },
    { id: 'audit', title: 'Recorded changes', subtitle: 'Durable audit register', ready: audit.isSuccess, detail: 'A successful audit response verifies access to recorded changes in the current tenant. Missing entries are not evidence that no changes occurred; the register is a bounded recent sample.' },
  ]
  const activeCheck = checks.find(item => item.id === check)!
  const events = audit.data || []
  const kinds = Array.from(new Set(events.map(event => event.entity_type))).sort()
  const auditRows = events.filter(event => auditFilter === 'all' || event.entity_type === auditFilter)
  const selectedEvent = auditRows.find(event => event.audit_id === auditId) || auditRows[0]

  return (
    <div className="ui-page" data-view="admin">
      <PageHeader title="Administration" description="Current identity and effective access, service response checks, recent audit history, and demo maintenance. This workspace never displays credentials or grants additional access." />
      {(access.isError || operations.isError) && <ErrorState message={(access.error || operations.error)?.message} retry={() => { access.refetch(); operations.refetch() }} />}

      {access.isPending ? <Panel flush><LoadingState rows={6} label="Loading access register" /></Panel> : <>
        <SummaryStrip label="Administration status" items={[
          { label: 'Signed-in identity', value: identity, detail: 'from the active session' },
          { label: 'Access mode', value: accessMode, detail: access.data?.can_write ? 'changes enabled' : 'inspect only' },
          { label: 'Operations service', value: operations.isPending ? 'Checking' : serviceReady ? 'Connected' : 'Attention', detail: operations.data ? `snapshot ${formatRelativeTime(operations.data.timestamp)}` : 'waiting for a verified response', tone: operations.isPending ? undefined : serviceReady ? 'ok' : 'bad' },
          { label: 'Data boundary', value: 'Synthetic', detail: 'unofficial concept; no county records' },
        ]} />

        <Tabs.Root value={section} onValueChange={setSection}>
          <Tabs.List className="ui-tabs" aria-label="Administration sections">
            <Tabs.Trigger value="access">Identity and access</Tabs.Trigger>
            <Tabs.Trigger value="checks">Response checks</Tabs.Trigger>
            <Tabs.Trigger value="audit">Audit history <span>{events.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="demo">Demo maintenance</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="access" className={cn('ui-tab-content', styles.stack)}>
            <div className={styles.pair}>
              <Panel title="Identity and permissions" description="Effective rights for this browser session">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Display identity</dt><dd>{identity}</dd></div>
                  <div><dt>View operating picture</dt><dd>{allowed(true)}</dd></div>
                  <div><dt>Modify operational records</dt><dd>{allowed(access.data?.can_write)}</dd></div>
                  <div><dt>Restore demonstration data</dt><dd>{allowed(access.data?.can_reset_demo)}</dd></div>
                  <div><dt>Authorization</dt><dd>Server-enforced permissions remain authoritative; this page only reports the current session state.</dd></div>
                </dl>
              </Panel>
              <Panel title="Provenance" description="What this concept may and may not represent">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Product status</dt><dd>Unofficial portfolio concept; not endorsed by Fairfax County.</dd></div>
                  <div><dt>Station context</dt><dd>Public Fairfax County station references presented for interface demonstration.</dd></div>
                  <div><dt>Operational records</dt><dd>Synthetic units, staffing, incidents, credentials, shifts, alerts, and activity.</dd></div>
                  <div><dt>Restricted content</dt><dd>No patient identifiers, clinical narratives, ePHI, or private county-system data.</dd></div>
                </dl>
              </Panel>
            </div>
            <Panel title="System boundaries" description="Purpose and operational limitations">
              <dl className="ui-facts ui-facts-rows">
                <div><dt>Purpose</dt><dd>Readiness coordination, exception review, and shift handover demonstration.</dd></div>
                <div><dt>Not a replacement for</dt><dd>CAD, dispatch, ePCR, payroll, clinical systems, or public-warning channels.</dd></div>
                <div><dt>Configuration</dt><dd>Secrets and private infrastructure details are intentionally excluded.</dd></div>
              </dl>
            </Panel>
          </Tabs.Content>

          <Tabs.Content value="checks" className="ui-tab-content">
            <Panel title="Response checks" description="Select a check to see what its response actually establishes" action={<Button onClick={() => { access.refetch(); operations.refetch(); audit.refetch() }} disabled={checking}><RefreshCw aria-hidden="true" className={checking ? 'ui-spin' : undefined} />{checking ? 'Checking…' : 'Refresh checks'}</Button>}>
              <div className={styles.checks}>
                <div data-ui="assurance">
                  <ul className={styles.checkList} data-ui="assurance-checks">
                    {checks.map(item => <li key={item.id}><button type="button" className="ui-list-row" aria-pressed={check === item.id} onClick={() => setCheck(item.id)}><span className="ui-list-main"><strong>{item.title}</strong><small>{item.subtitle}</small></span><StatusBadge tone={item.ready ? 'success' : 'warning'}>{item.ready ? 'Response verified' : checking ? 'Checking' : 'Not verified'}</StatusBadge></button></li>)}
                  </ul>
                  <p className={styles.topology}>Client session → authorized read responses. Independent infrastructure probes: not performed. No secret configuration is exposed.</p>
                </div>
                <div className={styles.checkDetail} data-ui="assurance-detail" aria-live="polite">
                  <h3>{activeCheck.title}</h3>
                  <p>{activeCheck.detail}</p>
                  <p className="ui-provenance">Selected check: {activeCheck.ready ? 'verified response' : 'not verified'} · refresh to recheck browser connectivity.</p>
                </div>
              </div>
            </Panel>
          </Tabs.Content>

          <Tabs.Content value="audit" className="ui-tab-content">
            {audit.isError ? <ErrorState message={audit.error.message} retry={() => audit.refetch()} /> : audit.isPending ? <Panel flush><LoadingState rows={6} /></Panel> : (
              <Panel title="Audit history" description="Bounded recent sample of recorded tenant events" action={<label className="ui-inline-field"><span>Record type</span><select className="ui-select" aria-label="Audit record type" value={auditFilter} onChange={event => setAuditFilter(event.target.value)}><option value="all">All records</option>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>} flush>
                <div className={cn('ui-table-wrap', styles.audit)} tabIndex={0} role="region" aria-label="Recent changes">
                  <table className="ui-table" data-ui="audit-register">
                    <thead><tr><th scope="col">Recorded</th><th scope="col">Action and summary</th><th scope="col">Record</th><th scope="col">Actor</th></tr></thead>
                    <tbody>{auditRows.map(event => (
                      <tr key={event.audit_id} data-selectable="true" aria-selected={selectedEvent?.audit_id === event.audit_id} onClick={() => setAuditId(event.audit_id)}>
                        <td className="ui-mono">{formatDate(event.created_at, 'MMM d · HH:mm')}</td>
                        <th scope="row"><button type="button" className="ui-row-button" aria-pressed={selectedEvent?.audit_id === event.audit_id} onClick={(click) => { click.stopPropagation(); setAuditId(event.audit_id) }}>{event.summary}</button><small>{titleCase(event.action)}</small></th>
                        <td>{event.entity_type}</td>
                        <td>{event.actor}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {!auditRows.length && <p className="ui-empty-inline">No matching recorded events in this recent sample.</p>}
                </div>
                {selectedEvent && <div className={styles.auditDetail} data-ui="audit-detail" aria-live="polite"><strong>{titleCase(selectedEvent.action)}</strong> · {selectedEvent.entity_type} / <span className="ui-mono">{selectedEvent.entity_id}</span><small>{selectedEvent.summary} · recorded by {selectedEvent.actor} at {formatDate(selectedEvent.created_at, 'MMM d, yyyy · HH:mm:ss')} · <span className="ui-mono">{selectedEvent.audit_id}</span></small></div>}
              </Panel>
            )}
          </Tabs.Content>

          <Tabs.Content value="demo" className="ui-tab-content">
            <Panel title="Restore demonstration data">
              <div className={styles.reset}>
                <p>Replace the current tenant’s synthetic demonstration records with the baseline dataset. This removes demonstration changes and is available only when the session policy grants reset authority.</p>
                <div>
                  <Button variant="danger" disabled={!access.data?.can_reset_demo} title={!access.data?.can_reset_demo ? 'Your current session is not authorized to restore demonstration data.' : undefined} onClick={() => { setFeedback(null); setResetOpen(true) }}><RefreshCw aria-hidden="true" />Restore demo data</Button>
                  {!access.data?.can_reset_demo && <small>Restricted by the current access policy.</small>}
                </div>
              </div>
              <div style={{ marginTop: feedback ? 16 : 0 }}><Notice notice={feedback} onDismiss={() => setFeedback(null)} /></div>
            </Panel>
          </Tabs.Content>
        </Tabs.Root>
      </>}

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="Restore demo data?" description="All synthetic demonstration records are replaced with the baseline dataset." detail="Current demo edits will be permanently removed. This cannot be undone." confirmLabel="Restore demo data" guarded={false} onConfirm={async () => {
        const result = await api.resetDemo()
        await queryClient.invalidateQueries()
        const count = Object.values(result.seeded).reduce((total, value) => total + value, 0)
        setFeedback({ tone: 'success', message: `Synthetic demonstration records restored. ${count.toLocaleString()} records were seeded across the operating model.` })
      }} />
    </div>
  )
}
