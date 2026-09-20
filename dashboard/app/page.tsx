'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Clock3, Radio, ShieldCheck, Siren, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { api, queryKeys } from '@/lib/api'
import { formatRelativeTime, titleCase } from '@/lib/utils'
import { useStationScope } from '@/components/ScopeContext'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui'
import { downloadText } from '@/lib/download'
import CommandMap from '@/components/CommandMap'

export default function CommandCenterPage() {
  const { stationId } = useStationScope()
  const [unitFilter, setUnitFilter] = useState<'all' | 'attention'>('all')
  const operations = useQuery({ queryKey: queryKeys.operations(stationId), queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId) })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const snapshot = operations.data
  const units = snapshot?.units || []
  const ready = units.filter(unit => unit.readiness_score >= 85).length
  const present = units.reduce((sum, unit) => sum + unit.staff_present, 0)
  const required = units.reduce((sum, unit) => sum + unit.staff_required, 0)
  const score = units.length ? Math.round(units.reduce((sum, unit) => sum + unit.readiness_score, 0) / units.length) : null
  const gaps = Math.max(0, required - present)
  const visibleUnits = (unitFilter === 'attention' ? units.filter(unit => unit.readiness_score < 85) : units).slice(0, 7)
  const incidents = [...(snapshot?.incidents || [])].sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.priority) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.priority))

  const exportBrief = () => {
    if (!snapshot) return
    const scope = stations.data?.find(station => station.station_id === stationId)?.name || 'All stations'
    const lines = [
      '# Aegis Command — shift handover brief', '',
      'UNOFFICIAL FAIRFAX COUNTY CONCEPT · SYNTHETIC DATA · NOT FOR DISPATCH', '',
      `Snapshot: ${snapshot.timestamp}`, `Scope: ${scope}`, '',
      '## Readiness', `${score}% average readiness · ${ready}/${units.length} units ready`,
      `${present}/${required} staffed positions · ${gaps} open positions`, '',
      '## Active incidents', ...incidents.map(item => `- ${item.priority}: ${item.title} — commander: ${item.commander || 'unassigned'}`),
      ...(incidents.length ? [] : ['No active incidents in this scope.']), '',
      '## Units requiring review', ...units.filter(unit => unit.readiness_score < 85).map(unit => `- ${unit.unit_name}: ${unit.readiness_score}% readiness; ${unit.staff_present}/${unit.staff_required} staffed. ${unit.issues.join('; ')}`), '',
      '## Open exceptions', ...snapshot.alerts.map(alert => `- ${alert.state}: ${alert.message}`), '',
      '## Handover checklist', '- [ ] Verify source freshness and current station scope.', '- [ ] Assign an owner to unresolved exceptions.', '- [ ] Confirm proposed coverage changes with the duty officer.', '- [ ] Record the incoming officer and handover time.', '',
      'This is a generated review aid, not an approved operational order. Verify every action before use.',
    ]
    downloadText(`aegis-handover-${new Date().toISOString().slice(0, 10)}.md`, lines.join('\n'))
  }

  return <div className="command-page page-enter">
    {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}

    <section className="command-metrics" aria-label="Operational summary">
      <div className="command-metric"><div><span>OPERATIONAL READINESS</span><Activity size={17} /></div><strong>{score ?? '—'}<small>%</small></strong><p><span className="metric-positive">{ready} ready</span> / {units.length} response units</p><div className="metric-track"><i style={{ width: `${score || 0}%` }} /></div></div>
      <div className="command-metric"><div><span>ON-DUTY PERSONNEL</span><Users size={17} /></div><strong>{snapshot ? present : '—'}<small> / {required || '—'}</small></strong><p><span className={gaps ? 'metric-warning' : 'metric-positive'}>{gaps} open positions</span> across active assignments</p><div className="metric-track"><i style={{ width: `${required ? present / required * 100 : 0}%` }} /></div></div>
      <div className="command-metric"><div><span>ACTIVE INCIDENTS</span><Siren size={17} /></div><strong>{snapshot ? incidents.length.toString().padStart(2, '0') : '—'}<AlertTriangle className="metric-wave" aria-hidden="true" /></strong><p><span className="metric-warning">{incidents.filter(incident => incident.priority === 'CRITICAL').length} critical</span> requiring command attention</p><div className="incident-mini-bars">{incidents.map(incident => <i key={incident.incident_id} className={incident.priority === 'CRITICAL' ? 'critical' : ''} />)}</div></div>
      <div className="command-metric"><div><span>STATION NETWORK</span><Radio size={17} /></div><strong>{stations.data?.length ?? '—'}<small> stations</small></strong><p>Public Fairfax geography <span className="metric-positive">· synthetic activity</span></p><div className="station-mini-grid">{stations.data?.map(station => <i key={station.station_id} title={station.name} />)}</div></div>
    </section>

    <div className="command-situation-grid">
      <CommandMap stations={stations.data || []} units={units} scope={stationId} actions={<><Link href="/readiness">Operations</Link><button type="button" aria-label="Export handover brief" onClick={exportBrief} disabled={!snapshot}>Export brief</button></>} />
      <div className="command-right-stack">
        <section className="command-incidents"><div className="command-section-heading"><div><h2>Incident dispatch <span>{incidents.length.toString().padStart(2, '0')}</span></h2><small>Live operations docket</small></div><span className="live-stamp">Live</span></div>
          {operations.isLoading ? <LoadingState rows={5} /> : incidents.length ? <div className="incident-board-list">{incidents.map((incident, index) => <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(incident.incident_id)}`} key={incident.incident_id} className={`command-incident incident-${incident.priority.toLowerCase()}`}><span className="incident-sequence">{index + 1}</span><div className="incident-meta"><span>{incident.priority}</span><small>{incident.assigned_unit_ids.length} units</small></div><h3>{incident.title}</h3><p><Clock3 size={12} />{formatRelativeTime(incident.created_at)}<span>·</span>INC / {String(index + 1).padStart(3, '0')}</p><ChevronRight className="incident-chevron" size={17} /></Link>)}</div> : <div className="compact-empty">No active incidents in this scope.</div>}
          <Link className="command-panel-link" href="/readiness?view=incidents">Review all operations <ArrowRight size={15} /></Link>
        </section>
        <section className="command-alerts"><div className="command-section-heading"><div><h2>Alerts &amp; notices</h2><small>Unresolved exceptions</small></div><span className="alert-stamp">{snapshot?.alerts.length ?? 0} open</span></div><div className="alert-register">{snapshot?.alerts.slice(0, 3).map((alert) => <Link href="/readiness?view=alerts" key={alert.alert_id}><time>{formatRelativeTime(alert.created_at)}</time><strong>{titleCase(alert.alert_type)}</strong><span>{alert.message}</span></Link>)}{!snapshot?.alerts.length && <div className="compact-empty">No unresolved operational alerts.</div>}</div></section>
      </div>
    </div>

    <div className="command-bottom-grid">
      <section className="command-resources"><div className="command-section-heading"><div><h2>Resource posture</h2><small>Apparatus readiness register</small></div><div className="command-segmented"><button aria-pressed={unitFilter === 'all'} onClick={() => setUnitFilter('all')}>All units</button><button aria-pressed={unitFilter === 'attention'} onClick={() => setUnitFilter('attention')}>Needs attention <span>{units.filter(unit => unit.readiness_score < 85).length}</span></button></div></div>
        {!operations.isLoading && !visibleUnits.length && <EmptyState title={unitFilter === 'attention' ? 'No units need attention' : 'No units in this scope'} description="Change the station scope or resource filter to review other units." />}{operations.isLoading ? <LoadingState rows={3} /> : <div className="resource-tiles">{visibleUnits.map(unit => <Link href={`/readiness?view=units&unit=${encodeURIComponent(unit.unit_id)}`} className={`resource-tile ${unit.readiness_score < 85 ? 'resource-attention' : ''}`} key={unit.unit_id}><div><span><Radio size={14} />{unit.unit_name}</span><ArrowUpRight size={14} /></div><p>{titleCase(unit.unit_type)}</p><footer><span><i />{unit.readiness_score < 85 ? 'Attention' : 'Ready'}</span><strong>{unit.staff_present}<small>/{unit.staff_required}</small></strong></footer></Link>)}</div>}
        <Link className="command-panel-link" href="/readiness">View complete resource roster <ArrowRight size={15} /></Link>
      </section>
      <section className="command-briefing"><div className="command-section-heading"><div><h2>Duty officer brief</h2><small>Unresolved handover items</small></div><ShieldCheck size={20} /></div><div className="briefing-content"><div className="briefing-priority"><span className="briefing-number">{gaps.toString().padStart(2, '0')}</span><div><h3>Staffing positions to cover</h3><p>Review qualified replacements and restore unit coverage.</p></div><ArrowDownRight size={24} /></div>{snapshot?.recommendations.slice(0, 2).map(item => <Link href="/readiness" className="briefing-action" key={item.recommendation_id}><span>{item.action_type === 'ESCALATE' ? 'ESCALATE' : 'RECOMMENDED'}</span><p>{item.message}</p><ArrowUpRight size={14} /></Link>)}<Link href="/certifications-management" className="briefing-credentials"><ShieldCheck size={17} /><span>{snapshot?.renewals.length ?? 0} credential renewals in progress</span><ChevronRight size={16} /></Link></div></section>
    </div>
    <section className="command-activity"><span className="command-kicker"><Activity size={14} />COMMAND LOG</span>{snapshot?.activity.slice(0, 3).map(event => <div key={event.audit_id}><i /><span>{event.summary}</span><small>{formatRelativeTime(event.created_at)}</small></div>)}</section>
    <footer className="command-footer-note"><span><ShieldCheck size={13} />Synthetic personnel and incidents · Public station geography</span><StatusBadge tone="neutral">Portfolio environment</StatusBadge></footer>
  </div>
}
