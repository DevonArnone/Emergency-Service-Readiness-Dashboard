'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Minus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmAction'
import { Button, ErrorState, LoadingState, Notice, PageHeader, Panel, StatusBadge, SummaryStrip, type NoticeValue } from '@/components/ui'
import { useAccess } from '@/hooks/useAccess'
import { api, queryKeys } from '@/lib/api'
import { cn, formatDate, formatRelativeTime, titleCase } from '@/lib/utils'
import styles from '../utility.module.css'

type Permission = { label: string; detail: string; roles: string[] }

// Mirrors the server role policy in backend/app/security/identity.py; the server remains authoritative.
const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'duty_officer', label: 'Duty officer' },
  { id: 'battalion_chief', label: 'Battalion chief' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'viewer', label: 'Viewer' },
  { id: 'integration_service', label: 'Integration' },
]
const OPERATORS = ['admin', 'duty_officer', 'battalion_chief']
const READERS = [...OPERATORS, 'analyst', 'viewer']
const PERMISSIONS: Permission[] = [
  { label: 'View operating picture', detail: 'Overview, incidents, units, alerts, analytics', roles: READERS },
  { label: 'Edit incidents and units', detail: 'Worksheets, assignments, service state', roles: OPERATORS },
  { label: 'Manage shifts and rosters', detail: 'Create, cancel, clock in and out', roles: OPERATORS },
  { label: 'Manage credentials', detail: 'Definitions, requirements, renewals', roles: OPERATORS },
  { label: 'Acknowledge and resolve alerts', detail: 'Alert queue actions', roles: OPERATORS },
  { label: 'Ingest integration events', detail: 'Service-to-service event intake', roles: ['integration_service'] },
]

export default function AdminPage() {
  const queryClient = useQueryClient()
  const access = useAccess()
  const operations = useQuery({ queryKey: ['admin', 'operations-health'], queryFn: () => api.operationsSnapshot() })
  const audit = useQuery({ queryKey: ['admin', 'recent-audit'], queryFn: () => api.auditEvents(60) })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const [section, setSection] = useState('overview')
  const [check, setCheck] = useState('operations')
  const [auditFilter, setAuditFilter] = useState('all')
  const [auditId, setAuditId] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [feedback, setFeedback] = useState<NoticeValue>(null)

  const session = access.data
  const identity = session?.display_name || 'Guest'
  const roles = session?.roles.length ? session.roles : ['viewer']
  const primaryRole = ROLES.find(role => roles.includes(role.id))?.label || titleCase(roles[0])
  const serviceReady = operations.isSuccess
  const checking = access.isFetching || operations.isFetching || audit.isFetching
  const checks = [
    { id: 'identity', title: 'Identity service', subtitle: 'Session and role resolution', ready: access.isSuccess, detail: `Resolved ${identity} with ${roles.length} ${roles.length === 1 ? 'role' : 'roles'} (${roles.map(titleCase).join(', ')}). Permissions are enforced by the API on every request.` },
    { id: 'operations', title: 'Operations API', subtitle: 'Snapshot endpoint', ready: serviceReady, detail: `Last snapshot ${operations.data?.timestamp ? formatDate(operations.data.timestamp, 'MMM d · HH:mm:ss') : 'not available'}, covering ${operations.data?.summary.total_units ?? '—'} units across ${operations.data?.summary.station_summaries.length ?? '—'} stations.` },
    { id: 'audit', title: 'Audit log', subtitle: 'Change history endpoint', ready: audit.isSuccess, detail: `${audit.data?.length ?? 0} recent events returned${audit.data?.[0] ? `; latest ${formatRelativeTime(audit.data[0].created_at)}` : ''}. The log view shows the most recent 60 events.` },
  ]
  const activeCheck = checks.find(item => item.id === check)!
  const events = audit.data || []
  const kinds = Array.from(new Set(events.map(event => event.entity_type))).sort()
  const auditRows = events.filter(event => auditFilter === 'all' || event.entity_type === auditFilter)
  const selectedEvent = auditRows.find(event => event.audit_id === auditId) || auditRows[0]
  const healthy = checks.filter(item => item.ready).length

  return (
    <div className="ui-page" data-view="admin">
      <PageHeader title="Administration" description="Organization settings, roles and permissions, system status, and the audit log." />
      {(access.isError || operations.isError) && <ErrorState message={(access.error || operations.error)?.message} retry={() => { access.refetch(); operations.refetch() }} />}

      {access.isPending ? <Panel flush><LoadingState rows={6} label="Loading administration" /></Panel> : <>
        <SummaryStrip label="Administration status" items={[
          { label: 'Signed in as', value: identity, detail: session?.email || primaryRole },
          { label: 'Role', value: primaryRole, detail: session?.can_write ? 'can edit records' : 'read only' },
          { label: 'System status', value: checking && !healthy ? 'Checking' : `${healthy} / ${checks.length}`, detail: healthy === checks.length ? 'all services responding' : 'services need attention', tone: checking && !healthy ? undefined : healthy === checks.length ? 'ok' : 'bad' },
          { label: 'Audit events', value: events.length, detail: events[0] ? `latest ${formatRelativeTime(events[0].created_at)}` : 'none recorded' },
        ]} />

        <Tabs.Root value={section} onValueChange={setSection}>
          <Tabs.List className="ui-tabs" aria-label="Administration sections">
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="roles">Roles and permissions</Tabs.Trigger>
            <Tabs.Trigger value="checks">System status</Tabs.Trigger>
            <Tabs.Trigger value="audit">Audit log <span>{events.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="maintenance">Maintenance</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="overview" className={cn('ui-tab-content', styles.stack)}>
            <div className={styles.pair}>
              <Panel title="Organization" description="Tenant configuration">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Name</dt><dd>Fairfax County Fire and Rescue Department</dd></div>
                  <div><dt>Tenant ID</dt><dd className="ui-mono">{session?.organization_id || '—'}</dd></div>
                  <div><dt>Stations</dt><dd className="ui-num">{stations.data?.length ?? '—'}</dd></div>
                  <div><dt>Apparatus</dt><dd className="ui-num">{operations.data?.summary.total_units ?? '—'}</dd></div>
                  <div><dt>Time zone</dt><dd>America/New_York</dd></div>
                </dl>
              </Panel>
              <Panel title="Your session" description="Identity and effective access">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Name</dt><dd>{identity}</dd></div>
                  <div><dt>Email</dt><dd>{session?.email || '—'}</dd></div>
                  <div><dt>Roles</dt><dd className={styles.roleList}>{roles.map(role => <StatusBadge key={role} tone="info" dot={false}>{ROLES.find(item => item.id === role)?.label || titleCase(role)}</StatusBadge>)}</dd></div>
                  <div><dt>Edit records</dt><dd><StatusBadge tone={session?.can_write ? 'success' : 'neutral'}>{session?.can_write ? 'Allowed' : 'Not allowed'}</StatusBadge></dd></div>
                  <div><dt>Sign-in</dt><dd>{session?.is_public_demo ? 'Guest session' : 'Single sign-on'}</dd></div>
                </dl>
              </Panel>
            </div>
          </Tabs.Content>

          <Tabs.Content value="roles" className="ui-tab-content">
            <Panel title="Roles and permissions" description="What each role can do. Your roles are highlighted." flush>
              <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Role permission matrix">
                <table className={cn('ui-table', styles.matrix)} data-ui="role-matrix">
                  <thead><tr><th scope="col">Permission</th>{ROLES.map(role => <th key={role.id} scope="col" data-current={roles.includes(role.id) || undefined}>{role.label}</th>)}</tr></thead>
                  <tbody>{PERMISSIONS.map(permission => (
                    <tr key={permission.label}>
                      <th scope="row">{permission.label}<small>{permission.detail}</small></th>
                      {ROLES.map(role => {
                        const granted = permission.roles.includes(role.id)
                        return <td key={role.id} data-current={roles.includes(role.id) || undefined}>{granted ? <Check aria-label="Allowed" className={styles.granted} /> : <Minus aria-label="Not allowed" className={styles.denied} />}</td>
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Panel>
          </Tabs.Content>

          <Tabs.Content value="checks" className="ui-tab-content">
            <Panel title="System status" description="Services this session depends on" action={<Button onClick={() => { access.refetch(); operations.refetch(); audit.refetch() }} disabled={checking}><RefreshCw aria-hidden="true" className={checking ? 'ui-spin' : undefined} />{checking ? 'Checking…' : 'Recheck'}</Button>}>
              <div className={styles.checks}>
                <div data-ui="assurance">
                  <ul className={styles.checkList} data-ui="assurance-checks">
                    {checks.map(item => <li key={item.id}><button type="button" className="ui-list-row" aria-pressed={check === item.id} onClick={() => setCheck(item.id)}><span className="ui-list-main"><strong>{item.title}</strong><small>{item.subtitle}</small></span><StatusBadge tone={item.ready ? 'success' : 'warning'}>{item.ready ? 'Operational' : checking ? 'Checking' : 'Degraded'}</StatusBadge></button></li>)}
                  </ul>
                  <p className={styles.topology}>Checked from this browser session. Database, event stream, and cache health are monitored by the platform.</p>
                </div>
                <div className={styles.checkDetail} data-ui="assurance-detail" aria-live="polite">
                  <h3>{activeCheck.title}</h3>
                  <p>{activeCheck.detail}</p>
                </div>
              </div>
            </Panel>
          </Tabs.Content>

          <Tabs.Content value="audit" className="ui-tab-content">
            {audit.isError ? <ErrorState message={audit.error.message} retry={() => audit.refetch()} /> : audit.isPending ? <Panel flush><LoadingState rows={6} /></Panel> : (
              <Panel title="Audit log" description="Most recent changes across the organization" action={<label className="ui-inline-field"><span>Record type</span><select className="ui-select" aria-label="Audit record type" value={auditFilter} onChange={event => setAuditFilter(event.target.value)}><option value="all">All records</option>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>} flush>
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

          <Tabs.Content value="maintenance" className="ui-tab-content">
            <Panel title="Restore baseline data">
              <div className={styles.reset}>
                <p>Replace all operational records with the baseline dataset. Every change made since the last restore is removed.</p>
                <div>
                  <Button variant="danger" disabled={!access.data?.can_reset_demo} title={!access.data?.can_reset_demo ? 'Requires an operator role in a development environment.' : undefined} onClick={() => { setFeedback(null); setResetOpen(true) }}><RefreshCw aria-hidden="true" />Restore baseline data</Button>
                  {!access.data?.can_reset_demo && <small>Requires an operator role in a development environment.</small>}
                </div>
              </div>
              <div style={{ marginTop: feedback ? 16 : 0 }}><Notice notice={feedback} onDismiss={() => setFeedback(null)} /></div>
            </Panel>
          </Tabs.Content>
        </Tabs.Root>
      </>}

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="Restore baseline data?" description="All operational records are replaced with the baseline dataset." detail="Changes made since the last restore will be permanently removed. This cannot be undone." confirmLabel="Restore baseline data" guarded={false} onConfirm={async () => {
        const result = await api.resetDemo()
        await queryClient.invalidateQueries()
        const count = Object.values(result.seeded).reduce((total, value) => total + value, 0)
        setFeedback({ tone: 'success', message: `Baseline restored. ${count.toLocaleString()} records loaded.` })
      }} />
    </div>
  )
}
