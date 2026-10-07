'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import CountyMap, { CONDITION_LABEL, stationNumber, stationRows, type MapLayer } from '@/components/CountyMap'
import { useStationScope } from '@/components/ScopeContext'
import StationInspector, { readinessTone } from '@/components/StationInspector'
import { Button, ErrorState, LoadingState, Meter, PageHeader, Panel, SearchInput, StatusBadge, SummaryStrip, TextLink, type StatusTone } from '@/components/ui'
import { useAccess } from '@/hooks/useAccess'
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod'
import { api, queryKeys } from '@/lib/api'
import { downloadText } from '@/lib/download'
import { incidentRef } from '@/lib/history'
import type { Incident } from '@/lib/schemas'
import { titleCase } from '@/lib/utils'
import styles from './overview.module.css'

type View = 'overview' | 'stations' | 'resources'

function clock(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function nextBriefTime(value?: string | null) {
  if (!value) return '22:00'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '22:00'
  date.setHours(date.getHours() + 3)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const incidentTone = (status: Incident['status']): StatusTone => status === 'ON_SCENE' ? 'danger' : status === 'ENROUTE' || status === 'TRANSPORT' ? 'warning' : 'info'
const alertCategory = (type: string) => /STAFF/i.test(type) ? 'Staffing' : /CERT|CREDENTIAL/i.test(type) ? 'Credential' : titleCase(type.split('_')[0])
const TYPE_LABEL: Record<Incident['incident_type'], string> = { FIRE: 'Fire', EMS: 'EMS', HAZMAT: 'HazMat', OTHER: 'Other' }
const STATUS_WORD: Record<Incident['status'], string> = { ACTIVE: 'Dispatched', ENROUTE: 'Enroute', ON_SCENE: 'On scene', TRANSPORT: 'Transport', INVESTIGATING: 'Investigating', RESOLVED: 'Closed' }
const TEAM_KEYS = ['command', 'hazmat', 'special_operations']

export default function CommandCenterPage() {
  const params = useSearchParams()
  const router = useRouter()
  const { stationId } = useStationScope()
  const session = useAccess()
  const view: View = params.get('panel') === 'resources' ? 'resources' : params.get('layer') === 'stations' ? 'stations' : 'overview'
  const operations = useQuery({ queryKey: queryKeys.operations(stationId), queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId) })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const weather = useQuery({ queryKey: queryKeys.weather, queryFn: api.weatherFairfax, retry: false, enabled: view === 'overview' })
  const definitions = useQuery({ queryKey: queryKeys.units, queryFn: api.units, enabled: view === 'resources' })
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ stations: true, incidents: view !== 'stations', risk: false })
  const [selectedStationId, setSelectedStationId] = useState<string | null>(params.get('station'))
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(params.get('station')))
  const [directorySearch, setDirectorySearch] = useState('')
  const [resourceTab, setResourceTab] = useState('apparatus')

  useEffect(() => { setLayers({ stations: true, incidents: view !== 'stations', risk: false }) }, [view])
  useEffect(() => { const requested = params.get('station'); if (requested) { setSelectedStationId(requested); setInspectorOpen(true) } }, [params])

  const snapshot = operations.data
  const period = useOperationalPeriod(snapshot ? new Date(snapshot.timestamp).getTime() : 0)
  const board = snapshot?.command_board
  const units = useMemo(() => snapshot?.units || [], [snapshot?.units])
  const incidents = useMemo(() => [...(snapshot?.incidents || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()), [snapshot?.incidents])
  const alerts = snapshot?.alerts || []
  const openAlerts = alerts.filter((alert) => alert.state === 'OPEN')
  const readiness = units.length ? Math.round(units.reduce((sum, unit) => sum + unit.readiness_score, 0) / units.length) : 0
  const rows = useMemo(() => stationRows(stations.data || [], units), [stations.data, units])
  const selectedStation = rows.find((station) => station.station_id === selectedStationId)
  const unitNames = new Map(units.map((unit) => [unit.unit_id, unit.unit_name]))
  const firstForecast = weather.data?.forecast_periods[0]
  const briefItems = [
    ...(board?.duty_brief.high_priority_incidents || []),
    ...(board?.duty_brief.alert_messages || []),
    ...(board?.duty_brief.recommendations || []),
    ...(firstForecast?.short_forecast ? [`Weather: ${firstForecast.short_forecast}; wind ${firstForecast.wind_speed || 'not reported'}.`] : []),
  ].slice(0, 5)
  const dutyOfficer = session.data?.display_name || 'Not signed in'
  const nextBrief = nextBriefTime(snapshot?.timestamp)

  const selectStation = (id: string | null) => {
    setSelectedStationId(id)
    setInspectorOpen(Boolean(id))
    if (view !== 'stations') return
    const query = new URLSearchParams(params.toString())
    if (id) query.set('station', id); else query.delete('station')
    router.replace(`/?${query}`, { scroll: false })
  }

  const exportBrief = () => {
    if (!snapshot) return
    const lines = [
      '# Aegis Command — duty officer brief', '',
      'UNOFFICIAL FAIRFAX COUNTY CONCEPT · SYNTHETIC OPERATIONS · NOT FOR DISPATCH', '',
      `Snapshot: ${snapshot.timestamp}`, `Readiness: ${readiness}%`, `Active incidents: ${incidents.length}`, '',
      '## Key items', ...briefItems.map((item) => `- ${item}`), '',
      `Duty officer: ${dutyOfficer}`, `Next brief: ${nextBrief}`,
    ]
    downloadText(`aegis-command-brief-${new Date().toISOString().slice(0, 10)}.md`, lines.join('\n'))
  }

  const summary = (
    <SummaryStrip label="Countywide readiness summary" items={[
      { label: 'Operational readiness', value: snapshot ? `${readiness}%` : '—', detail: `target 100% · as of ${clock(snapshot?.timestamp)}`, tone: !snapshot ? undefined : readiness >= 85 ? 'ok' : readiness >= 60 ? 'warn' : 'bad' },
      { label: 'On-duty personnel', value: board ? `${board.personnel.on_duty} / ${board.personnel.authorized}` : '—', detail: board ? `${board.personnel.authorized - board.personnel.on_duty} short · ${board.personnel.available} off-unit reserve` : undefined },
      { label: 'Active incidents', value: snapshot ? incidents.length : '—', detail: board ? `Fire ${board.incident_types.FIRE ?? 0} · EMS ${board.incident_types.EMS ?? 0} · HazMat ${board.incident_types.HAZMAT ?? 0} · Other ${board.incident_types.OTHER ?? 0}` : undefined, href: '/readiness?view=incidents' },
      { label: 'Open alerts', value: snapshot ? openAlerts.length : '—', detail: openAlerts.length ? 'awaiting review' : 'none awaiting review', tone: openAlerts.length ? 'bad' : undefined, href: '/readiness?view=alerts' },
      { label: 'Station network', value: board?.station_network.total ?? stations.data?.length ?? '—', detail: board ? `${board.station_network.online} normal · ${board.station_network.staffing_attention} staffing attention · ${board.station_network.offline} offline` : undefined, href: '/?layer=stations' },
    ]} />
  )

  const map = (
    <CountyMap title={view === 'stations' ? 'Station map' : 'County readiness map'} stations={stations.data || []} units={units} incidents={incidents} scope={stationId} layers={layers}
      onToggleLayer={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))}
      selectedStationId={selectedStationId} onStationSelect={selectStation} onReset={() => selectStation(null)} />
  )

  const apparatus = board?.apparatus || []
  const tankers = (definitions.data || []).filter((unit) => unit.type === 'TANKER' && !unit.is_archived && (stationId === 'all' || unit.station_id === stationId))
  const tankersOut = tankers.filter((unit) => unit.operational_status === 'OUT_OF_SERVICE' || unit.operational_status === 'MAINTENANCE').length
  const supply = tankers.length ? [{ key: 'tankers', label: 'Tankers', total: tankers.length, in_service: tankers.length - tankersOut, out_of_service: tankersOut, availability_pct: (tankers.length - tankersOut) / tankers.length * 100 }] : []
  const resourceTable = (groups: typeof apparatus, caption: string) => (
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="ui-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">Type</th><th scope="col" className="ui-num">Total</th><th scope="col" className="ui-num">In service</th><th scope="col" className="ui-num">Out of service</th><th scope="col" className="ui-num">Available</th><th scope="col" className={styles.barColumn}><span className="sr-only">Availability comparison</span></th></tr></thead>
        <tbody>{groups.map((group) => (
          <tr key={group.key}>
            <th scope="row">{group.label}</th>
            <td className="ui-num">{group.total}</td>
            <td className="ui-num">{group.in_service}</td>
            <td className="ui-num">{group.out_of_service}</td>
            <td className="ui-num" style={group.availability_pct < 90 ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{Math.round(group.availability_pct)}%</td>
            <td className={styles.barColumn}><Meter value={group.availability_pct} tone={group.availability_pct < 90 ? 'danger' : 'success'} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )

  const footer = <p className={styles.footnote}>Unofficial concept · synthetic operations · public station geography. Not authorized for dispatch or real emergency operations.</p>

  if (view === 'resources') {
    return (
      <div className="ui-page" data-view="resources">
        <PageHeader title="Resource status" description="Availability of apparatus, command and special teams, and supply units in the current station scope." actions={<Link className="ui-button" href="/readiness?view=units">Open Units</Link>} />
        {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}
        {summary}
        <Panel id="resource-posture" title="Resource posture" description={`Snapshot ${clock(snapshot?.timestamp)} · in service against total, by type`} flush>
          <Tabs.Root value={resourceTab} onValueChange={setResourceTab}>
            <Tabs.List className="ui-tabs" aria-label="Resource categories" style={{ padding: '0 8px' }}>
              <Tabs.Trigger value="apparatus">Apparatus</Tabs.Trigger>
              <Tabs.Trigger value="teams">Special teams</Tabs.Trigger>
              <Tabs.Trigger value="supply">Supply</Tabs.Trigger>
            </Tabs.List>
            {operations.isLoading ? <LoadingState rows={5} /> : <>
              <Tabs.Content value="apparatus">{resourceTable(apparatus.filter((group) => !TEAM_KEYS.includes(group.key)), 'Apparatus availability by type')}</Tabs.Content>
              <Tabs.Content value="teams">{resourceTable(apparatus.filter((group) => TEAM_KEYS.includes(group.key)), 'Command and special team availability')}</Tabs.Content>
              <Tabs.Content value="supply">
                {definitions.isError ? <div style={{ padding: 16 }}><ErrorState message={definitions.error.message} retry={() => definitions.refetch()} /></div> : definitions.isLoading ? <LoadingState rows={2} /> : supply.length ? resourceTable(supply, 'Supply unit availability') : <p className="ui-empty-inline">No supply units are recorded in this station scope. Consumable inventory is not tracked in this concept.</p>}
              </Tabs.Content>
            </>}
          </Tabs.Root>
        </Panel>
        <div className="ui-link-row"><TextLink href="/readiness?view=units">Review units by station</TextLink><TextLink href="/analytics?view=staffing">Staffing analysis</TextLink><TextLink href="/">County overview</TextLink></div>
        {footer}
      </div>
    )
  }

  if (view === 'stations') {
    const term = directorySearch.trim().toLowerCase()
    const directory = rows.filter((station) => (stationId === 'all' || station.station_id === stationId) && `${station.name} ${station.address || ''} ${station.district || ''}`.toLowerCase().includes(term)).sort((a, b) => Number(stationNumber(a)) - Number(stationNumber(b)))
    return (
      <div className="ui-page" data-view="stations">
        <PageHeader title="Stations" description="Find a station, see where it sits in the county, and open its units and personnel." />
        {(operations.isError || stations.isError) && <ErrorState message={(operations.error || stations.error)?.message} retry={() => { operations.refetch(); stations.refetch() }} />}
        <div className="ui-workspace" data-inspector="true">
          <div className={styles.stationsMain}>
            {map}
            <Panel title="Station directory" description={`${directory.length} of ${rows.length} stations`} action={<SearchInput label="Search stations" value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Search station, area, or battalion" />} flush>
              {stations.isLoading ? <LoadingState rows={8} /> : (
                <div className={`ui-table-wrap ${styles.directory}`} tabIndex={0} role="region" aria-label="Station directory">
                  <table className="ui-table">
                    <thead><tr><th scope="col">Station</th><th scope="col">Battalion</th><th scope="col" className="ui-num">Units</th><th scope="col">Readiness</th><th scope="col">Condition</th></tr></thead>
                    <tbody>{directory.map((station) => {
                      const selected = station.station_id === selectedStationId
                      return (
                        <tr key={station.station_id} data-selectable="true" aria-selected={selected} onClick={() => selectStation(station.station_id)}>
                          <th scope="row"><button type="button" className="ui-row-button" onClick={(event) => { event.stopPropagation(); selectStation(station.station_id) }} aria-label={`Select ${station.name}`}><span className="ui-mono">{stationNumber(station).padStart(2, '0')}</span> {station.name.split(' — ')[1] || station.name}</button><small>{station.address}</small></th>
                          <td>{station.district?.split(' · ')[0] || '—'}</td>
                          <td className="ui-num">{station.assigned.length}</td>
                          <td><span className={styles.readinessCell}><Meter value={station.score ?? 0} tone={station.score === null ? 'neutral' : readinessTone(station.score)} /><span className="ui-num">{station.score === null ? '—' : `${Math.round(station.score)}%`}</span></span></td>
                          <td><StatusBadge tone={station.condition === 'normal' ? 'success' : station.condition === 'attention' ? 'warning' : 'danger'}>{CONDITION_LABEL[station.condition]}</StatusBadge></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                  {!directory.length && <p className="ui-empty-inline">No stations match “{directorySearch.trim()}” in this scope. Clear the search to restore the directory.</p>}
                </div>
              )}
            </Panel>
          </div>
          <StationInspector station={selectedStation} open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
        </div>
        {footer}
      </div>
    )
  }

  return (
    <div className="ui-page" data-view="overview">
      <PageHeader title="Fairfax County readiness board" description="Countywide readiness, active incidents, and open exceptions for the current operational period." actions={<Button onClick={exportBrief} disabled={!snapshot} aria-label="Export duty officer brief"><Download aria-hidden="true" />Export brief</Button>} />
      {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}
      {summary}

      <div className={styles.situation}>
        {map}
        {selectedStation && inspectorOpen
          ? <StationInspector station={selectedStation} open={inspectorOpen} onClose={() => selectStation(null)} dismissible />
          : (
            <Panel title="Needs attention" description={`Updated ${clock(snapshot?.timestamp)} · live`} className={styles.queue} flush>
              <section aria-labelledby="queue-incidents">
                <div className={styles.queueHead}><h3 id="queue-incidents">Active incidents</h3><TextLink href="/readiness?view=incidents">All incidents</TextLink></div>
                {operations.isLoading ? <LoadingState rows={5} /> : (
                  <ul className="ui-list" data-ui="incident-queue">
                    {incidents.slice(0, 5).map((incident) => (
                      <li key={incident.incident_id}>
                        <Link className="ui-list-row" href={`/readiness?view=incidents&incident=${encodeURIComponent(incident.incident_id)}`}>
                          <span className={styles.queueTime}><span className="ui-mono">{clock(incident.created_at)}</span><small>{incidentRef(incident)}</small></span>
                          <span className="ui-list-main"><strong>{(incident.display_location || incident.title).split(',')[0]}</strong><small>{TYPE_LABEL[incident.incident_type]} · {incident.assigned_unit_ids.length ? incident.assigned_unit_ids.map((unit) => unitNames.get(unit) || unit.replace(/^unit-/, '').toUpperCase()).join(', ') : 'no units assigned'}</small></span>
                          <StatusBadge tone={incidentTone(incident.status)}>{STATUS_WORD[incident.status]}</StatusBadge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!operations.isLoading && !incidents.length && <p className="ui-empty-inline">No active incidents in the current scope.</p>}
                {incidents.length > 5 && <p className={styles.queueMore}>Showing 5 of {incidents.length} active incidents.</p>}
              </section>
              <section aria-labelledby="queue-alerts" className={styles.queueSection}>
                <div className={styles.queueHead}><h3 id="queue-alerts">Open alerts <span className="ui-num">{openAlerts.length}</span></h3><TextLink href="/readiness?view=alerts">Alert queue</TextLink></div>
                <ul className="ui-list" data-ui="alert-queue">
                  {openAlerts.slice(0, 4).map((alert) => (
                    <li key={alert.alert_id}>
                      <Link className="ui-list-row" href={`/readiness?view=alerts&alert=${encodeURIComponent(alert.alert_id)}`}>
                        <span className={styles.queueTime}><span className="ui-mono">{clock(alert.created_at)}</span><small>{alertCategory(alert.alert_type)}</small></span>
                        <span className="ui-list-main"><strong style={{ fontWeight: 500 }}>{alert.message}</strong></span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {!openAlerts.length && <p className="ui-empty-inline">No open operational alerts.</p>}
              </section>
              <p className={styles.queueFoot}>{weather.data?.active_alerts.length ? <Link href="/weather">{weather.data.active_alerts.length} active weather {weather.data.active_alerts.length === 1 ? 'alert' : 'alerts'}</Link> : weather.isError ? 'Weather alerts unavailable' : 'No active weather alerts returned'}</p>
            </Panel>
          )}
      </div>

      <div className={styles.lower}>
        <Panel id="resource-posture" title="Resource posture" description="Units in service against total, by type" action={<TextLink href="/?panel=resources#resource-posture">Resource status</TextLink>} flush>
          {operations.isLoading ? <LoadingState rows={6} /> : resourceTable(apparatus, 'Resource availability by type')}
        </Panel>
        <Panel title="Handover brief" description={`${period.window === 'NO ACTIVE SHIFT' ? 'No active shift' : period.window} · ${period.name === 'NO RECORDED WATCH' ? 'no recorded watch' : titleCase(period.name)}`}>
          <ul className={styles.brief}>
            {briefItems.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
            {!briefItems.length && <li>No priority exceptions in the current scope.</li>}
          </ul>
          <dl className="ui-facts" style={{ marginTop: 16 }}>
            <div><dt>Next brief</dt><dd className="ui-mono">{nextBrief}</dd></div>
            <div><dt>Duty officer</dt><dd>{dutyOfficer}</dd></div>
            <div><dt>Access</dt><dd>{session.data?.can_write ? 'Authorized operator' : 'Read-only'}</dd></div>
          </dl>
        </Panel>
      </div>
      {footer}
    </div>
  )
}
