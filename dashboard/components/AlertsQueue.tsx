'use client'

import { Check, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useStationScope } from './ScopeContext'
import { EmptyState, ErrorState, InlineError, Inspector, InspectorBody, InspectorFooter, InspectorHeader, LoadingState, PageHeader, Panel, SearchInput, Section, StatusBadge, SummaryStrip, WriteButton, type StatusTone } from './ui'
import type { ReadinessAlert, Station, UnitReadiness } from '@/lib/schemas'
import { formatDate, formatRelativeTime, titleCase } from '@/lib/utils'

type StateFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL'
const STATE_TONE: Record<ReadinessAlert['state'], StatusTone> = { OPEN: 'danger', ACKNOWLEDGED: 'warning', RESOLVED: 'success' }
const FILTERS: Array<[StateFilter, string]> = [['OPEN', 'Open'], ['ACKNOWLEDGED', 'Acknowledged'], ['RESOLVED', 'Resolved'], ['ALL', 'All']]
const stamp = (value?: string | null) => value ? formatDate(value, 'MMM d · HH:mm') : 'Not recorded'

export default function AlertsQueue({ alerts, loading, error, retry, stations, units, acknowledging, resolving, actionError, onAcknowledge, onResolve }: {
  alerts: ReadinessAlert[]; loading: boolean; error?: string; retry: () => void; stations: Station[]; units: UnitReadiness[]
  acknowledging: boolean; resolving: boolean; actionError?: { key: string; message: string } | null; onAcknowledge: (id: string) => void; onResolve: (id: string) => void
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { setStationId } = useStationScope()
  const [filter, setFilter] = useState<StateFilter>('OPEN')
  const [search, setSearch] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(params.get('alert')))
  const unitName = (id?: string | null) => id ? units.find((unit) => unit.unit_id === id)?.unit_name || id.replace(/^unit-/, '').toUpperCase() : null
  const stationName = (id?: string | null) => id ? stations.find((station) => station.station_id === id)?.name || id : null
  const count = (state: ReadinessAlert['state']) => alerts.filter((alert) => alert.state === state).length
  const term = search.trim().toLowerCase()
  const rows = alerts.filter((alert) => (filter === 'ALL' || alert.state === filter) && (!term || `${alert.message} ${alert.alert_type} ${unitName(alert.unit_id) || ''} ${stationName(alert.station_id) || ''}`.toLowerCase().includes(term)))
  const requested = params.get('alert')
  const selected = alerts.find((alert) => alert.alert_id === requested) || rows[0]

  function select(id: string) {
    setInspectorOpen(true)
    const query = new URLSearchParams(params.toString())
    query.set('view', 'alerts')
    query.set('alert', id)
    router.replace(`/readiness?${query}`, { scroll: false })
  }

  return (
    <div className="ui-page" data-view="alerts">
      <PageHeader title="Alerts" description="Operational exceptions awaiting review. Acknowledge to take ownership; resolve when the cause is cleared. Every action is recorded." />
      {error && <ErrorState message={error} retry={retry} />}
      <SummaryStrip label="Alert summary" items={[
        { label: 'Open', value: loading ? '—' : count('OPEN'), detail: 'awaiting duty officer review', tone: count('OPEN') ? 'bad' : undefined },
        { label: 'Acknowledged', value: loading ? '—' : count('ACKNOWLEDGED'), detail: 'owned, not yet cleared', tone: count('ACKNOWLEDGED') ? 'warn' : undefined },
        { label: 'Resolved', value: loading ? '—' : count('RESOLVED'), detail: 'in the retained record' },
      ]} />
      <div className="ui-toolbar">
        <div className="ui-segmented" role="group" aria-label="Alert state">
          {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <SearchInput label="Search alerts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search message, unit, or station" />
      </div>
      <div className="ui-workspace" data-inspector="true">
        <Panel title="Exception queue" description={`${rows.length} of ${alerts.length} alerts in the current scope · newest first`} flush>
          {loading ? <LoadingState rows={8} /> : (
            <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Exception queue">
              <table className="ui-table" data-ui="alert-queue">
                <thead><tr><th scope="col">Alert</th><th scope="col">Record</th><th scope="col">Created</th><th scope="col">State</th></tr></thead>
                <tbody>{rows.map((alert) => (
                  <tr key={alert.alert_id} data-selectable="true" aria-selected={selected?.alert_id === alert.alert_id} onClick={() => select(alert.alert_id)}>
                    <th scope="row"><button type="button" className="ui-row-button" onClick={(event) => { event.stopPropagation(); select(alert.alert_id) }}>{alert.message}</button><small>{titleCase(alert.alert_type)}</small></th>
                    <td>{unitName(alert.unit_id) || stationName(alert.station_id)?.split(' — ')[0] || 'County'}<small>{alert.unit_id && alert.station_id ? stationName(alert.station_id)?.split(' — ')[0] : ''}</small></td>
                    <td><span className="ui-mono">{formatDate(alert.created_at, 'HH:mm')}</span><small>{formatRelativeTime(alert.created_at)}</small></td>
                    <td><StatusBadge tone={STATE_TONE[alert.state]}>{titleCase(alert.state)}</StatusBadge></td>
                  </tr>
                ))}</tbody>
              </table>
              {!rows.length && (alerts.length
                ? <p className="ui-empty-inline">No {filter === 'ALL' ? '' : `${filter.toLowerCase()} `}alerts match{term ? ` “${search.trim()}”` : ' this state'}. Choose another state to see the rest of the queue.</p>
                : <EmptyState title="No alerts" description="This station scope has no operational exceptions." icon={CheckCircle2} />)}
            </div>
          )}
        </Panel>

        <Inspector label="Alert record" open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)} recordKey={selected?.alert_id}>
          {selected ? <>
            <InspectorHeader kind={titleCase(selected.alert_type)} title={selected.message} subtitle={`Created ${formatRelativeTime(selected.created_at)}`} badge={<StatusBadge tone={STATE_TONE[selected.state]}>{titleCase(selected.state)}</StatusBadge>} />
            <InspectorBody>
              <Section title="Record context">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Unit</dt><dd>{selected.unit_id ? <Link href={`/readiness?view=units&unit=${encodeURIComponent(selected.unit_id)}`}>{unitName(selected.unit_id)}</Link> : 'Not unit-specific'}</dd></div>
                  <div><dt>Station</dt><dd>{selected.station_id ? <Link href="/?layer=stations" onClick={() => setStationId(selected.station_id!)}>{stationName(selected.station_id)}</Link> : 'County'}</dd></div>
                  {selected.personnel_id && <div><dt>Personnel</dt><dd><Link href={`/personnel?person=${encodeURIComponent(selected.personnel_id)}`}>Open personnel record</Link></dd></div>}
                  {Object.entries(selected.details || {}).filter(([, value]) => typeof value !== 'object').map(([key, value]) => <div key={key}><dt>{titleCase(key)}</dt><dd>{String(value)}</dd></div>)}
                </dl>
              </Section>
              <Section title="Audit trail">
                <dl className="ui-facts ui-facts-rows">
                  <div><dt>Created</dt><dd className="ui-mono">{stamp(selected.created_at)}</dd></div>
                  <div><dt>Acknowledged</dt><dd>{selected.acknowledged_at ? <><span className="ui-mono">{stamp(selected.acknowledged_at)}</span>{selected.acknowledged_by ? ` · ${selected.acknowledged_by}` : ''}</> : 'Not yet'}</dd></div>
                  {selected.acknowledged_note && <div><dt>Note</dt><dd>{selected.acknowledged_note}</dd></div>}
                  <div><dt>Resolved</dt><dd>{selected.resolved_at ? <span className="ui-mono">{stamp(selected.resolved_at)}</span> : 'Not yet'}</dd></div>
                </dl>
              </Section>
            </InspectorBody>
            <InspectorFooter>
              <InlineError message={actionError?.key === selected.alert_id ? actionError.message : undefined} />
              <div className="ui-inspector-actions">
                {selected.state === 'OPEN' && <WriteButton variant="primary" onClick={() => onAcknowledge(selected.alert_id)} busy={acknowledging}><Check aria-hidden="true" />Acknowledge</WriteButton>}
                {selected.state !== 'RESOLVED' && <WriteButton onClick={() => onResolve(selected.alert_id)} busy={resolving}><CheckCircle2 aria-hidden="true" />Resolve</WriteButton>}
                {selected.state === 'RESOLVED' && <p className="ui-provenance">This alert is resolved. No further action is available.</p>}
              </div>
              <p className="ui-provenance">Acknowledgment and resolution are added to the audit history.</p>
            </InspectorFooter>
          </> : <EmptyState title={loading ? 'Loading alerts' : 'No alert selected'} description={loading ? 'The exception queue is loading.' : 'Select an alert to review its record context and audit trail.'} />}
        </Inspector>
      </div>
    </div>
  )
}
