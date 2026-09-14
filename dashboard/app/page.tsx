'use client'

import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Clock3, Radio, ShieldCheck, Siren, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { api, queryKeys } from '@/lib/api'
import { formatRelativeTime, titleCase } from '@/lib/utils'
import { useStationScope } from '@/components/ScopeContext'
import { ErrorState, LoadingState, StatusBadge } from '@/components/ui'
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
  const visibleUnits = (unitFilter === 'attention' ? units.filter(unit => unit.is_understaffed) : units).slice(0, 12)
  const incidents = [...(snapshot?.incidents || [])].sort((a, b) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(a.priority) - ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].indexOf(b.priority))

  return <div className="command-page page-enter">
    <div className="command-heading"><div><span className="command-kicker"><span className="live-beacon" />AEGIS COMMAND / OPERATIONAL OVERVIEW</span><h1>Every resource.<br className="mobile-heading-break" /> One clear picture<span>.</span></h1><p>Fairfax County Fire and Rescue Department <span className="concept-tag">Unofficial concept</span></p></div><Link href="/readiness" className="command-primary">Open operations <ArrowUpRight size={17} /></Link></div>
    {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}

    <section className="command-metrics" aria-label="Operational summary">
      <div className="command-metric"><div><span>OPERATIONAL READINESS</span><Activity size={17} /></div><strong>{score ?? '—'}<small>%</small></strong><p><span className="metric-positive">{ready} ready</span> / {units.length} response units</p><div className="metric-track"><i style={{ width: `${score || 0}%` }} /></div></div>
      <div className="command-metric"><div><span>ON-DUTY PERSONNEL</span><Users size={17} /></div><strong>{snapshot ? present : '—'}<small> / {required || '—'}</small></strong><p><span className={gaps ? 'metric-warning' : 'metric-positive'}>{gaps} open positions</span> across active assignments</p><div className="metric-track"><i style={{ width: `${required ? present / required * 100 : 0}%` }} /></div></div>
      <div className="command-metric"><div><span>ACTIVE INCIDENTS</span><Siren size={17} /></div><strong>{snapshot ? incidents.length.toString().padStart(2, '0') : '—'}<span className="metric-wave">⌁</span></strong><p><span className="metric-warning">{incidents.filter(incident => incident.priority === 'CRITICAL').length} critical</span> requiring command attention</p><div className="incident-mini-bars">{incidents.map(incident => <i key={incident.incident_id} className={incident.priority === 'CRITICAL' ? 'critical' : ''} />)}</div></div>
      <div className="command-metric"><div><span>STATION NETWORK</span><Radio size={17} /></div><strong>{stations.data?.length ?? '—'}<small> stations</small></strong><p>Public Fairfax geography <span className="metric-positive">· synthetic activity</span></p><div className="station-mini-grid">{stations.data?.map(station => <i key={station.station_id} title={station.name} />)}</div></div>
    </section>

    <div className="command-situation-grid">
      <CommandMap stations={stations.data || []} units={units} scope={stationId} />
      <section className="command-incidents"><div className="command-section-heading"><div><span className="command-kicker">LIVE OPERATIONS</span><h2>Incident board <span>{incidents.length.toString().padStart(2, '0')}</span></h2></div><Siren size={20} /></div>
        {operations.isLoading ? <LoadingState rows={5} /> : incidents.length ? <div className="incident-board-list">{incidents.map((incident, index) => <Link href="/readiness" key={incident.incident_id} className={`command-incident incident-${incident.priority.toLowerCase()}`}><div className="incident-meta"><span><i />{incident.priority}</span><small>INC / {String(index + 1).padStart(3, '0')}</small></div><h3>{incident.title}</h3><p><Clock3 size={12} />{formatRelativeTime(incident.created_at)}<span>·</span>{incident.assigned_unit_ids.length} units assigned</p><ChevronRight className="incident-chevron" size={17} /></Link>)}</div> : <div className="compact-empty">No active incidents in this scope.</div>}
        <Link className="command-panel-link" href="/readiness">Review all operations <ArrowRight size={15} /></Link>
      </section>
    </div>

    <div className="command-bottom-grid">
      <section className="command-resources"><div className="command-section-heading"><div><span className="command-kicker">RESOURCE POSTURE</span><h2>Ready for the next call</h2></div><div className="command-segmented"><button aria-pressed={unitFilter === 'all'} onClick={() => setUnitFilter('all')}>All units</button><button aria-pressed={unitFilter === 'attention'} onClick={() => setUnitFilter('attention')}>Needs attention <span>{units.filter(unit => unit.is_understaffed).length}</span></button></div></div>
        {operations.isLoading ? <LoadingState rows={3} /> : <div className="resource-tiles">{visibleUnits.map(unit => <Link href="/readiness" className={`resource-tile ${unit.is_understaffed ? 'resource-attention' : ''}`} key={unit.unit_id}><div><span><Radio size={14} />{unit.unit_name}</span><ArrowUpRight size={14} /></div><p>{titleCase(unit.unit_type)}</p><footer><span><i />{unit.is_understaffed ? 'Attention' : 'Ready'}</span><strong>{unit.staff_present}<small>/{unit.staff_required}</small></strong></footer></Link>)}</div>}
        <Link className="command-panel-link" href="/readiness">View complete resource roster <ArrowRight size={15} /></Link>
      </section>
      <section className="command-briefing"><div className="command-section-heading"><div><span className="command-kicker">DUTY OFFICER BRIEF</span><h2>What needs you</h2></div><ShieldCheck size={20} /></div><div className="briefing-content"><div className="briefing-priority"><span className="briefing-number">{gaps.toString().padStart(2, '0')}</span><div><h3>Staffing positions to cover</h3><p>Review qualified replacements and restore unit coverage.</p></div><ArrowDownRight size={24} /></div>{snapshot?.recommendations.slice(0, 2).map(item => <Link href="/readiness" className="briefing-action" key={item.recommendation_id}><span>{item.action_type === 'ESCALATE' ? 'ESCALATE' : 'RECOMMENDED'}</span><p>{item.message}</p><ArrowUpRight size={14} /></Link>)}<Link href="/certifications-management" className="briefing-credentials"><ShieldCheck size={17} /><span>{snapshot?.renewals.length ?? 0} credential renewals in progress</span><ChevronRight size={16} /></Link></div></section>
    </div>
    <section className="command-activity"><span className="command-kicker"><Activity size={14} />COMMAND LOG</span>{snapshot?.activity.slice(0, 3).map(event => <div key={event.audit_id}><i /><span>{event.summary}</span><small>{formatRelativeTime(event.created_at)}</small></div>)}</section>
    <footer className="command-footer-note"><span><ShieldCheck size={13} />Synthetic personnel and incidents · Public station geography</span><StatusBadge tone="neutral">Portfolio environment</StatusBadge></footer>
  </div>
}
