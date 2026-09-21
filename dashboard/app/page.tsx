'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Users } from 'lucide-react'
import Link from 'next/link'
import { api, queryKeys } from '@/lib/api'
import { useAccess } from '@/hooks/useAccess'
import { useStationScope } from '@/components/ScopeContext'
import { ErrorState, LoadingState } from '@/components/ui'
import { downloadText } from '@/lib/download'
import CommandMap from '@/components/CommandMap'

function registerTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function statusClass(value: string) {
  if (value === 'ON_SCENE' || value === 'RESOLVED') return 'dispatch-status-red'
  if (value === 'ENROUTE' || value === 'TRANSPORT') return 'dispatch-status-amber'
  return 'dispatch-status-blue'
}

function nextBriefTime(value?: string | null) {
  if (!value) return '22:00'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '22:00'
  date.setHours(date.getHours() + 3)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function CommandCenterPage() {
  const { stationId } = useStationScope()
  const session = useAccess()
  const operations = useQuery({ queryKey: queryKeys.operations(stationId), queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId) })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const weather = useQuery({ queryKey: queryKeys.weather, queryFn: api.weatherFairfax, retry: false })
  const snapshot = operations.data
  const board = snapshot?.command_board
  const units = snapshot?.units || []
  const incidents = [...(snapshot?.incidents || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  const readiness = units.length ? Math.round(units.reduce((sum, unit) => sum + unit.readiness_score, 0) / units.length) : 0
  const target = 100
  const firstForecast = weather.data?.forecast_periods[0]
  const allBriefItems = [
    ...(board?.duty_brief.high_priority_incidents || []),
    ...(board?.duty_brief.alert_messages || []),
    ...(board?.duty_brief.recommendations || []),
    ...(firstForecast?.short_forecast ? [`Weather: ${firstForecast.short_forecast}; wind ${firstForecast.wind_speed || 'not reported'}.`] : []),
  ].slice(0, 5)
  const dutyOfficer = session.data?.display_name || 'N. CARTER'
  const nextBrief = nextBriefTime(snapshot?.timestamp)

  const exportBrief = () => {
    if (!snapshot) return
    const lines = [
      '# Aegis Command — duty officer brief', '',
      'UNOFFICIAL FAIRFAX COUNTY CONCEPT · SYNTHETIC OPERATIONS · NOT FOR DISPATCH', '',
      `Snapshot: ${snapshot.timestamp}`, `Readiness: ${readiness}%`, `Active incidents: ${incidents.length}`, '',
      '## Key items', ...allBriefItems.map((item) => `- ${item}`), '',
      `Duty officer: ${dutyOfficer}`, `Next brief: ${nextBrief}`,
    ]
    downloadText(`aegis-command-brief-${new Date().toISOString().slice(0, 10)}.md`, lines.join('\n'))
  }

  return <div className="command-page page-enter">
    {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}

    <section className="command-metrics" aria-label="Operational instrument register">
      <article className="command-metric readiness-instrument">
        <header><i />OPERATIONAL READINESS</header>
        <div className="instrument-body"><div className="readiness-ring" style={{ '--readiness': `${readiness * 3.6}deg` } as React.CSSProperties} aria-hidden="true"><span /></div><strong>{snapshot ? readiness : '—'}<small>%</small></strong><dl><div><dt>TARGET</dt><dd>{target}%</dd></div><div><dt>VARIANCE</dt><dd>{readiness - target}%</dd></div><div><dt>AS OF</dt><dd>{registerTime(snapshot?.timestamp)}</dd></div></dl></div>
      </article>
      <article className="command-metric personnel-instrument">
        <header><i />ON-DUTY PERSONNEL</header>
        <div className="instrument-body"><Users className="instrument-pictogram" aria-hidden="true" /><strong>{board ? board.personnel.on_duty : '—'}<small> / {board?.personnel.authorized || '—'}</small></strong></div>
        <footer><span>AVAILABLE <b>{board?.personnel.available ?? '—'}</b></span><span>DEPLOYED <b>{board?.personnel.deployed ?? '—'}</b></span><span>OFF / TRAINING <b>{board ? board.personnel.off + board.personnel.in_training : '—'}</b></span></footer>
      </article>
      <article className="command-metric incident-instrument">
        <header><i />ACTIVE INCIDENTS</header>
        <div className="instrument-body"><AlertTriangle className="instrument-alert" aria-hidden="true" /><strong>{snapshot ? incidents.length.toString().padStart(2, '0') : '—'}</strong><dl><div><dt>FIRE</dt><dd>{board?.incident_types.FIRE ?? 0}</dd></div><div><dt>EMS</dt><dd>{board?.incident_types.EMS ?? 0}</dd></div><div><dt>HAZMAT</dt><dd>{board?.incident_types.HAZMAT ?? 0}</dd></div><div><dt>OTHER</dt><dd>{board?.incident_types.OTHER ?? 0}</dd></div></dl></div>
      </article>
      <article className="command-metric station-instrument">
        <header><i />STATION NETWORK</header>
        <div className="instrument-body"><Building2 className="instrument-pictogram" aria-hidden="true" /><strong>{board?.station_network.total ?? stations.data?.length ?? '—'}</strong><dl><div><dt>ONLINE</dt><dd>{board?.station_network.online ?? '—'}</dd></div><div><dt>STAFFING LOW</dt><dd>{board?.station_network.staffing_attention ?? '—'}</dd></div><div><dt>OFFLINE</dt><dd>{board?.station_network.offline ?? '—'}</dd></div></dl></div>
      </article>
    </section>

    <div className="command-situation-grid">
      <CommandMap stations={stations.data || []} units={units} incidents={incidents} scope={stationId} />
      <aside className="command-right-stack">
        <section className="command-register dispatch-register" aria-labelledby="dispatch-heading">
          <header className="register-heading"><h2 id="dispatch-heading">INCIDENT DISPATCH</h2><span>LIVE</span></header>
          {operations.isLoading ? <LoadingState rows={5} /> : <div className="register-table-wrap"><table><thead><tr><th>#</th><th>TIME</th><th>TYPE</th><th>LOCATION</th><th>UNITS</th><th>STATUS</th></tr></thead><tbody>{incidents.slice(0, 5).map((incident, index) => <tr key={incident.incident_id}><td>{index + 1}</td><td>{registerTime(incident.created_at)}</td><td className={`incident-type type-${incident.incident_type.toLowerCase()}`}>{incident.incident_type}</td><td><Link href={`/readiness?view=incidents&incident=${encodeURIComponent(incident.incident_id)}`}>{incident.display_location || incident.title}</Link></td><td>{incident.assigned_unit_ids.length ? incident.assigned_unit_ids.map((unit) => <span key={unit}>{unit.replace(/^unit-/, '').toUpperCase()}</span>) : <span>—</span>}</td><td><span className={`dispatch-status ${statusClass(incident.status)}`}>{incident.status.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table>{!incidents.length && <p className="register-empty">NO ACTIVE INCIDENTS IN CURRENT SCOPE</p>}</div>}
          <footer><span>SHOWING {Math.min(incidents.length, 5)} OF {incidents.length} ACTIVE INCIDENTS</span><span>UPDATED {registerTime(snapshot?.timestamp)}</span></footer>
        </section>
        <section className="command-register alerts-register" aria-labelledby="alerts-heading">
          <header className="register-heading"><h2 id="alerts-heading">ALERTS &amp; NOTICES</h2><span>{snapshot?.alerts.length ?? 0} OPEN</span></header>
          <div className="register-table-wrap"><table><thead><tr><th>TIME</th><th>CATEGORY</th><th>MESSAGE</th></tr></thead><tbody>{snapshot?.alerts.slice(0, 3).map((alert) => <tr key={alert.alert_id}><td>{registerTime(alert.created_at)}</td><td className={alert.alert_type.toLowerCase().includes('staff') ? 'category-ops' : 'category-info'}>{alert.alert_type.toUpperCase().slice(0, 8)}</td><td><Link href="/readiness?view=alerts">{alert.message}</Link></td></tr>)}</tbody></table>{!snapshot?.alerts.length && <p className="register-empty">NO UNRESOLVED OPERATIONAL ALERTS</p>}</div>
          <footer><span>{weather.data?.active_alerts.length ? `${weather.data.active_alerts.length} WEATHER ALERTS` : 'ALL SYSTEMS OPERATIONAL'}</span></footer>
        </section>
      </aside>
    </div>

    <div className="command-bottom-grid">
      <section className="command-register resource-register" id="resource-posture" aria-labelledby="resource-heading">
        <header className="register-heading"><h2 id="resource-heading">RESOURCE POSTURE</h2><nav aria-label="Resource categories"><span>APPARATUS</span><Link href="/readiness?view=units">SPECIAL TEAMS</Link><Link href="/readiness?view=units">SUPPLY</Link></nav></header>
        <div className="register-table-wrap"><table><thead><tr><th>TYPE</th><th>TOTAL</th><th>IN SERVICE</th><th>OUT OF SERVICE</th><th>% AVAIL</th><th aria-label="Availability bar" /></tr></thead><tbody>{board?.apparatus.map((group) => <tr key={group.key}><td>{group.label}</td><td>{group.total}</td><td>{group.in_service}</td><td>{group.out_of_service}</td><td className={group.availability_pct < 90 ? 'resource-low' : ''}>{Math.round(group.availability_pct)}%</td><td><div className="posture-track"><i className={group.availability_pct < 90 ? 'low' : ''} style={{ width: `${group.availability_pct}%` }} /></div></td></tr>)}</tbody></table></div>
      </section>
      <section className="command-register brief-register" aria-labelledby="brief-heading">
        <header className="register-heading"><h2 id="brief-heading">DUTY OFFICER BRIEF</h2><button type="button" aria-label="Export duty officer brief" onClick={exportBrief} disabled={!snapshot}>1900 – 0700 (BRAVO SHIFT)</button></header>
        <div className="brief-worksheet"><div><h3>KEY ITEMS</h3><ul>{allBriefItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}{!allBriefItems.length && <li>No priority exceptions in the current scope.</li>}</ul></div><dl><div><dt>NEXT BRIEF</dt><dd>{nextBrief}</dd></div><div><dt>DUTY OFFICER</dt><dd>{dutyOfficer}<small>{session.data?.can_write ? 'AUTHORIZED OPERATOR' : 'READ-ONLY'}</small></dd></div><div><dt>OPERATING PRINCIPLE</dt><dd><em>“READINESS BUILDS RESILIENCE”</em></dd></div></dl></div>
      </section>
    </div>

    <footer className="command-footer-note"><span>UNOFFICIAL CONCEPT · SYNTHETIC OPERATIONS · PUBLIC STATION GEOGRAPHY</span><span>FAIRFAX COUNTY FIRE AND RESCUE <i /> COUNTY STATUS WALL <i /> v1.0</span></footer>
  </div>
}
