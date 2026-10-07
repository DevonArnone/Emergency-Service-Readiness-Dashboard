'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, History as HistoryIcon, Plus, UserPlus, Wrench } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { EmptyState, Filters, InlineError, Inspector, InspectorBody, InspectorFooter, InspectorHeader, Meter, PageHeader, Panel, SearchInput, Section, StatusBadge, SummaryStrip, WriteButton, type StatusTone } from './ui'
import { clip, clock, duration, eventTime, incidentHistory, incidentRef, LIFECYCLE_LABEL, SERVICE_LABEL, serviceSegments, ticks, type IncidentHistory, type LifecycleStatus, type ServiceState } from '@/lib/history'
import type { AuditEvent, Incident, OperationsSnapshot, Personnel, SimulationResult, Station, Unit, UnitAssignment, UnitReadiness } from '@/lib/schemas'
import { cn, titleCase } from '@/lib/utils'
import styles from './ops.module.css'

type History = { incidentEvents: AuditEvent[]; unitEvents: AuditEvent[]; baselines: AuditEvent[]; incidents: Incident[]; loading: boolean }

type Props = {
  snapshot?: OperationsSnapshot
  stations: Station[]
  definitions: Unit[]
  assignments: UnitAssignment[]
  personnel: Personnel[]
  history: History
  scope: string
  selectedUnit?: UnitReadiness
  onSelectUnit: (id: string) => void
  onAddUnit: () => void
  onAssign: () => void
  onSimulate: (unitId: string) => void
  simulation?: SimulationResult
  simulating: boolean
  onSetStatus: (unit: Unit, status: Unit['operational_status']) => void
  updatingStatus: boolean
  actionError?: { key: string; message: string } | null
  loading: boolean
}

type Group = 'ENGINE' | 'TRUCK' | 'MEDIC' | 'RESCUE' | 'OTHER'
type Condition = 'ready' | 'attention' | 'critical'
type UnitTone = Condition | 'committed'
type TimelineScope = 'FOCUS' | 'STATION' | 'ALL'
type Pane = 'register' | 'matrix' | 'history'
type Bar = { key: string; start: number; end: number; kind: 'service' | 'incident' | 'crew'; state: string; label: string; detail: string; incident?: Incident; event?: AuditEvent; unit: Unit }

const GROUPS: Group[] = ['ENGINE', 'TRUCK', 'MEDIC', 'RESCUE', 'OTHER']
const GROUP_LABEL: Record<Group, string> = { ENGINE: 'Engines', TRUCK: 'Trucks', MEDIC: 'Medics', RESCUE: 'Rescues', OTHER: 'Other apparatus' }
const TYPE_NAME: Partial<Record<Unit['type'], string>> = { ENGINE: 'Engine', LADDER: 'Ladder', TRUCK: 'Truck', MEDIC: 'Medic', AMBULANCE: 'Ambulance', RESCUE: 'Rescue', TANKER: 'Tanker', COMMAND: 'Command', SAFETY: 'Safety', HAZMAT: 'HazMat', SAR_TEAM: 'SAR Team' }
const PANES: Array<[Pane, string]> = [['register', 'Register'], ['matrix', 'Coverage matrix'], ['history', 'Deployment history']]
const HOUR = 3600000

function groupOf(type: Unit['type']): Group {
  if (type === 'ENGINE') return 'ENGINE'
  if (type === 'LADDER' || type === 'TRUCK') return 'TRUCK'
  if (type === 'MEDIC' || type === 'AMBULANCE') return 'MEDIC'
  if (type === 'RESCUE') return 'RESCUE'
  return 'OTHER'
}
const stationNumber = (station?: Station) => Number(station?.name.match(/Station\s+(\d+)/i)?.[1] || 0)
const stationArea = (station?: Station) => (station ? station.name.split('—').slice(1).join('—').trim() || station.name : 'Unassigned')
const battalion = (station?: Station) => station?.district?.match(/Battalion\s+(\d+)/i)?.[1] || '—'
const typeName = (unit: Unit) => TYPE_NAME[unit.type] || unit.type.replaceAll('_', ' ')
const recordTitle = (unit: Unit) => /^[A-Z]{1,2}\d+$/.test(unit.unit_name) ? `${typeName(unit)} ${unit.unit_name.replace(/^[A-Z]+/, '')}` : unit.unit_name
const serviceWord = (status: Unit['operational_status']) => status === 'AVAILABLE' ? 'In service' : status === 'DEPLOYED' ? 'Committed' : status === 'MAINTENANCE' ? 'Maintenance' : 'Out of service'
const outOfService = (status: Unit['operational_status']) => status === 'OUT_OF_SERVICE' || status === 'MAINTENANCE'
const isLinked = (incident: Incident, unit: Unit) => incident.unit_id === unit.unit_id || incident.assigned_unit_ids.includes(unit.unit_id)
const sentence = (value: string) => value.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())

function unitState(unit: Unit, readiness?: UnitReadiness): UnitTone {
  if (outOfService(unit.operational_status)) return 'critical'
  if ((readiness?.readiness_score ?? 0) < 85) return 'attention'
  return unit.operational_status === 'DEPLOYED' ? 'committed' : 'ready'
}
const TONE: Record<UnitTone, StatusTone> = { ready: 'success', attention: 'warning', critical: 'danger', committed: 'info' }
const CONDITION_WORD: Record<Condition, string> = { ready: 'Ready', attention: 'Attention', critical: 'Critical' }

const POS = (role: string, certifications: string[], index: number) => {
  if (/officer|captain|chief/i.test(role) || index === 0 && /company/i.test(role)) return 'OIC'
  if (certifications.includes('DRIVER')) return 'DR'
  if (/paramedic/i.test(role)) return 'ALS'
  if (/technician|emt/i.test(role) && !/firefighter/i.test(role)) return 'BLS'
  return 'FF'
}
const QUAL: Record<string, string> = { 'HAZMAT-OPS': 'HAZ', 'HAZMAT-TECH': 'HZT', 'TECH-RESCUE': 'TECH', PARAMEDIC: 'ALS', DRIVER: 'DRV', AERIAL: 'AER', 'ICS-300': 'ICS', SAFETY: 'ISO' }

export default function UnitsWorkspace({ snapshot, stations, definitions, assignments, personnel, history, scope, selectedUnit, onSelectUnit, onAddUnit, onAssign, onSimulate, simulation, simulating, onSetStatus, updatingStatus, actionError, loading }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [battalionFilter, setBattalionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | Group>('ALL')
  const [search, setSearch] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(params.get('unit')))
  const pane: Pane = PANES.some(([value]) => value === params.get('pane')) ? params.get('pane') as Pane : 'register'

  const now = snapshot?.timestamp ? new Date(snapshot.timestamp).getTime() : 0
  const readiness = useMemo(() => new Map((snapshot?.units || []).map((unit) => [unit.unit_id, unit])), [snapshot?.units])
  const people = useMemo(() => new Map(personnel.map((person) => [person.personnel_id, person])), [personnel])
  const stationById = useMemo(() => new Map(stations.map((station) => [station.station_id, station])), [stations])
  const liveUnits = useMemo(() => definitions.filter((unit) => !unit.is_archived), [definitions])
  const stationUnits = useMemo(() => {
    const map = new Map<string, Unit[]>()
    for (const unit of liveUnits) {
      if (!unit.station_id) continue
      map.set(unit.station_id, [...(map.get(unit.station_id) || []), unit])
    }
    return map
  }, [liveUnits])
  const activeIncidents = useMemo(() => snapshot?.incidents || [], [snapshot?.incidents])
  const histories = useMemo(() => {
    const records = new Map<string, Incident>()
    for (const incident of history.incidents) records.set(incident.incident_id, incident)
    for (const incident of activeIncidents) records.set(incident.incident_id, incident)
    return Array.from(records.values()).map((incident) => incidentHistory(incident, history.incidentEvents, now))
  }, [history.incidents, history.incidentEvents, activeIncidents, now])

  const allStations = useMemo(() => stations.filter((station) => scope === 'all' || station.station_id === scope).sort((a, b) => stationNumber(a) - stationNumber(b)), [stations, scope])
  const rows = allStations.map((station) => {
    const members = stationUnits.get(station.station_id) || []
    const metrics = members.map((unit) => readiness.get(unit.unit_id)).filter((unit): unit is UnitReadiness => Boolean(unit))
    const present = metrics.reduce((sum, unit) => sum + unit.staff_present, 0)
    const required = metrics.reduce((sum, unit) => sum + unit.staff_required, 0)
    const average = metrics.length ? Math.round(metrics.reduce((sum, unit) => sum + unit.readiness_score, 0) / metrics.length) : 0
    const down = members.filter((unit) => outOfService(unit.operational_status))
    const condition: Condition = average < 60 || down.length ? 'critical' : average < 85 || present < required ? 'attention' : 'ready'
    const linked = activeIncidents.filter((incident) => members.some((unit) => isLinked(incident, unit)))
    const note = down.length ? `${down[0].unit_name} ${down[0].operational_status === 'MAINTENANCE' ? 'maint.' : 'OOS'}${down.length > 1 ? ` +${down.length - 1}` : ''}`
      : linked.length ? sentence(LIFECYCLE_LABEL[linked[0].status])
        : required - present > 0 ? `${required - present} short` : 'Normal'
    return { station, members, present, required, average, condition, linked, note, down }
  })
  const term = search.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    if (battalionFilter !== 'ALL' && battalion(row.station) !== battalionFilter) return false
    if (typeFilter !== 'ALL' && !row.members.some((unit) => groupOf(unit.type) === typeFilter)) return false
    if (statusFilter !== 'ALL' && row.condition.toUpperCase() !== statusFilter) return false
    const haystack = `${row.station.name} ${row.station.address || ''} ${row.members.map((unit) => `${unit.unit_name} ${unit.unit_id}`).join(' ')}`.toLowerCase()
    return haystack.includes(term)
  })

  const selectedDefinition = liveUnits.find((unit) => unit.unit_id === selectedUnit?.unit_id)
  const selectedStation = selectedDefinition?.station_id ? stationById.get(selectedDefinition.station_id) : undefined
  const selectedStationUnits = selectedStation ? stationUnits.get(selectedStation.station_id) || [] : []
  const battalions = Array.from(new Set(allStations.map(battalion).filter((value) => value !== '—'))).sort((a, b) => Number(a) - Number(b))
  const scopedUnits = liveUnits.filter((unit) => scope === 'all' || unit.station_id === scope)
  const groupStats = (['ENGINE', 'TRUCK', 'MEDIC', 'RESCUE'] as Group[]).map((group) => {
    const members = scopedUnits.filter((unit) => groupOf(unit.type) === group)
    const ready = members.filter((unit) => !outOfService(unit.operational_status) && (readiness.get(unit.unit_id)?.readiness_score ?? 0) >= 85).length
    return { group, total: members.length, ready, pct: members.length ? Math.round(ready / members.length * 100) : 0 }
  })
  const staffPresent = (snapshot?.units || []).reduce((sum, unit) => sum + unit.staff_present, 0)
  const staffRequired = (snapshot?.units || []).reduce((sum, unit) => sum + unit.staff_required, 0)
  const staffingGap = (snapshot?.units || []).reduce((sum, unit) => sum + Math.max(0, unit.staff_required - unit.staff_present), 0)
  const down = scopedUnits.filter((unit) => outOfService(unit.operational_status))
  const committed = scopedUnits.filter((unit) => unit.operational_status === 'DEPLOYED')
  const activeFilters = Number(battalionFilter !== 'ALL') + Number(statusFilter !== 'ALL') + Number(typeFilter !== 'ALL')

  function setPane(next: Pane) {
    const query = new URLSearchParams(params.toString())
    query.set('view', 'units')
    if (next === 'register') query.delete('pane'); else query.set('pane', next)
    router.replace(`/readiness?${query}`, { scroll: false })
  }
  function select(id: string) {
    setInspectorOpen(true)
    onSelectUnit(id)
  }
  function chooseStation(members: Unit[]) {
    const match = (term && members.find((unit) => `${unit.unit_name} ${unit.unit_id}`.toLowerCase().includes(term))) || members.find((unit) => typeFilter === 'ALL' || groupOf(unit.type) === typeFilter) || members[0]
    if (match) select(match.unit_id)
  }

  function matrixCell(members: Unit[], group: Group, stationLabel: string) {
    const units = members.filter((unit) => groupOf(unit.type) === group)
    if (!units.length) return <span className="ui-muted" aria-label="None">—</span>
    const first = units.find((unit) => unit.unit_id === selectedUnit?.unit_id) || units[0]
    const state = unitState(first, readiness.get(first.unit_id))
    if (units.length === 1) {
      return <button type="button" className={styles.chip} data-ui="unit-chip" data-state={state} aria-pressed={selectedUnit?.unit_id === first.unit_id} onClick={() => select(first.unit_id)} aria-label={`${first.unit_name}, ${typeName(first)}, ${serviceWord(first.operational_status)}`}><i aria-hidden="true" /><span>{first.unit_name}</span></button>
    }
    return (
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild><button type="button" className={styles.chip} data-ui="unit-chip-multi" data-state={state} aria-pressed={units.some((unit) => unit.unit_id === selectedUnit?.unit_id)} aria-label={`${units.length} ${GROUP_LABEL[group].toLowerCase()} at ${stationLabel}: choose a unit`}><i aria-hidden="true" /><span>{first.unit_name}</span><b>+{units.length - 1}</b></button></DropdownMenu.Trigger>
        <DropdownMenu.Portal><DropdownMenu.Content className="ui-menu" align="start" sideOffset={4}>
          <DropdownMenu.Label className="ui-menu-label">{GROUP_LABEL[group]} · {stationLabel}</DropdownMenu.Label>
          {units.map((unit) => <DropdownMenu.Item key={unit.unit_id} className="ui-menu-item" onSelect={() => select(unit.unit_id)}><i className={styles.dot} data-state={unitState(unit, readiness.get(unit.unit_id))} aria-hidden="true" /><strong>{unit.unit_name}</strong><span className="ui-muted">{typeName(unit)}</span><small>{serviceWord(unit.operational_status)}</small></DropdownMenu.Item>)}
        </DropdownMenu.Content></DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  // Record facts derived from the snapshot and audit history.
  const currentIncident = selectedDefinition ? activeIncidents.find((incident) => isLinked(incident, selectedDefinition)) : undefined
  const selectedSegments = selectedDefinition ? serviceSegments(selectedDefinition.unit_id, history.unitEvents, history.baselines, now) : []
  const lastRecorded = [...selectedSegments].reverse().find((segment) => segment.state !== 'UNRECORDED')
  const unitLog = selectedDefinition ? unitChronology(selectedDefinition, histories, history.unitEvents) : []
  const crew = (selectedUnit?.assigned_personnel || []).map((person, index) => ({ ...person, rank: people.get(person.personnel_id)?.rank || '—', pos: POS(person.role, person.certifications, index) }))
  const unitAlerts = (snapshot?.alerts || []).filter((alert) => alert.unit_id === selectedDefinition?.unit_id && alert.state !== 'RESOLVED')
  const crewWindows = assignments.filter((assignment) => assignment.unit_id === selectedDefinition?.unit_id && assignment.assignment_status !== 'CANCELLED')
  const shortBy = selectedUnit ? Math.max(0, selectedUnit.staff_required - selectedUnit.staff_present) : 0
  const selectedState = selectedDefinition ? unitState(selectedDefinition, selectedUnit) : 'ready'

  return (
    <div className="ui-page" data-view="units">
      <PageHeader title="Units" description="Apparatus by station with crew, readiness, and service state. Select a unit to review its record and act on it." actions={<WriteButton variant="primary" onClick={onAddUnit}><Plus aria-hidden="true" />Add unit</WriteButton>} />
      <SummaryStrip label="County unit summary" items={[
        ...groupStats.map(({ group, ready, total, pct }) => ({ label: `${GROUP_LABEL[group]} ready`, value: `${ready} / ${total}`, detail: `${pct}%`, tone: pct >= 90 ? undefined : pct >= 75 ? 'warn' as const : 'bad' as const })),
        { label: 'Staffing', value: `${staffPresent} / ${staffRequired}`, detail: `${staffingGap} below minimum`, tone: staffingGap ? 'warn' as const : undefined },
        { label: 'Out of service', value: down.length, detail: `${down.filter((unit) => unit.operational_status === 'MAINTENANCE').length} maintenance · ${committed.length} committed`, tone: down.length ? 'bad' as const : undefined },
      ]} />

      <div className="ui-toolbar">
        <div className="ui-segmented" role="tablist" aria-label="Unit views">
          {PANES.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pane === value} onClick={() => setPane(value)}>{label}</button>)}
        </div>
        {pane !== 'history' && <>
          <SearchInput label="Find unit or station" data-ui="unit-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find unit or station" />
          <Filters activeCount={activeFilters}>
            <label className="ui-inline-field"><span>Battalion</span><select className="ui-select" value={battalionFilter} onChange={(event) => setBattalionFilter(event.target.value)}><option value="ALL">All battalions</option>{battalions.map((value) => <option key={value} value={value}>Battalion {value}</option>)}</select></label>
            <label className="ui-inline-field"><span>Station readiness</span><select className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All conditions</option><option value="READY">Ready</option><option value="ATTENTION">Attention</option><option value="CRITICAL">Critical</option></select></label>
            <label className="ui-inline-field"><span>Unit type</span><select className="ui-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | Group)}><option value="ALL">All unit types</option>{GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABEL[group]}</option>)}</select></label>
          </Filters>
        </>}
      </div>

      <div className="ui-workspace" data-inspector="true">
        <div className={styles.main}>
          {pane === 'register' && (
            <Panel title="Apparatus register" description={visibleRows.length === allStations.length ? `${allStations.length} stations · ${scopedUnits.length} units` : `${visibleRows.length} of ${allStations.length} stations`} flush>
              <div className={styles.register} data-ui="unit-register">
                {visibleRows.map((row) => {
                  const label = `Station ${stationNumber(row.station)} ${stationArea(row.station)}`
                  const members = row.members.filter((unit) => (typeFilter === 'ALL' || groupOf(unit.type) === typeFilter)).sort((a, b) => GROUPS.indexOf(groupOf(a.type)) - GROUPS.indexOf(groupOf(b.type)) || a.unit_name.localeCompare(b.unit_name))
                  return (
                    <section key={row.station.station_id} className={styles.stationGroup} data-station={row.station.station_id} aria-label={label}>
                      <header>
                        <button type="button" className={styles.stationName} onClick={() => chooseStation(row.members)} aria-label={`Select ${label}`}><span className="ui-mono">{String(stationNumber(row.station)).padStart(2, '0')}</span><strong>{stationArea(row.station)}</strong><small>Battalion {battalion(row.station)}</small></button>
                        <span className={cn('ui-num', styles.stationStaff)}>{row.present} / {row.required} staffed</span>
                        {row.linked.length > 0 && <Link className="ui-mono" href={`/readiness?view=incidents&incident=${encodeURIComponent(row.linked[0].incident_id)}`}>{incidentRef(row.linked[0])}{row.linked.length > 1 ? ` +${row.linked.length - 1}` : ''}</Link>}
                        <StatusBadge tone={TONE[row.condition]}>{CONDITION_WORD[row.condition]}</StatusBadge>
                      </header>
                      <ul>
                        {members.map((unit) => {
                          const metric = readiness.get(unit.unit_id)
                          const state = unitState(unit, metric)
                          const linked = activeIncidents.find((incident) => isLinked(incident, unit))
                          const isSelected = selectedUnit?.unit_id === unit.unit_id
                          return (
                            <li key={unit.unit_id}>
                              <button type="button" className={styles.registerRow} data-ui="unit-row" aria-pressed={isSelected} onClick={() => select(unit.unit_id)} aria-label={`${unit.unit_name}, ${typeName(unit)}, ${serviceWord(unit.operational_status)}`}>
                                <span className={styles.unitName}><i className={styles.dot} data-state={state} aria-hidden="true" /><strong className="ui-mono">{unit.unit_name}</strong><small>{typeName(unit)}</small></span>
                                <span className={styles.unitService}>{serviceWord(unit.operational_status)}{linked ? ` · ${incidentRef(linked)}` : ''}</span>
                                <span className={cn('ui-num', styles.unitCrew)}>{metric?.staff_present ?? 0}/{metric?.staff_required ?? unit.minimum_staff} crew</span>
                                <span className={styles.unitMeter}><Meter value={metric?.readiness_score ?? 0} tone={metric ? (metric.readiness_score >= 85 ? 'success' : metric.readiness_score >= 60 ? 'warning' : 'danger') : 'neutral'} /><span className="ui-num">{metric ? `${metric.readiness_score}%` : '—'}</span></span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
                {!visibleRows.length && !loading && <p className="ui-empty-inline">No stations match the current filters. Clear the filters to restore the county register.</p>}
                {loading && <p className="ui-empty-inline">Loading station and apparatus records…</p>}
              </div>
            </Panel>
          )}

          {pane === 'matrix' && (
            <Panel title="Station coverage matrix" description={`${visibleRows.length === allStations.length ? `${allStations.length} stations × ${battalions.length} battalions` : `${visibleRows.length} of ${allStations.length} stations`} · apparatus, staffing, readiness, incidents`} flush>
              <div className={cn('ui-table-wrap', styles.matrix)} tabIndex={0} role="region" aria-label="Station coverage matrix">
                <table className="ui-table" data-ui="unit-matrix">
                  <caption className="sr-only">Station apparatus coverage. Choose a unit to open its record; cells with several units open a chooser.</caption>
                  <thead><tr><th scope="col">Station</th><th scope="col">Bn</th><th scope="col">Engine</th><th scope="col">Truck</th><th scope="col">Medic</th><th scope="col">Rescue</th><th scope="col">Other</th><th scope="col" className="ui-num">Staffing</th><th scope="col">Readiness</th><th scope="col">Incident</th><th scope="col">Notes</th></tr></thead>
                  <tbody>{visibleRows.map((row) => {
                    const selected = selectedStation?.station_id === row.station.station_id
                    const label = `Station ${stationNumber(row.station)} ${stationArea(row.station)}`
                    return (
                      <tr key={row.station.station_id} data-station={row.station.station_id} aria-selected={selected}>
                        <th scope="row"><button type="button" className="ui-row-button" onClick={() => chooseStation(row.members)} aria-label={`Select ${label}`}><span className="ui-mono">{String(stationNumber(row.station)).padStart(2, '0')}</span> {stationArea(row.station)}</button></th>
                        <td className="ui-mono">B{battalion(row.station)}</td>
                        {GROUPS.map((group) => <td key={group}>{matrixCell(row.members, group, label)}</td>)}
                        <td className="ui-num">{row.present} / {row.required}</td>
                        <td><StatusBadge tone={TONE[row.condition]}>{CONDITION_WORD[row.condition]}</StatusBadge></td>
                        <td>{row.linked.length ? <Link className="ui-mono" href={`/readiness?view=incidents&incident=${encodeURIComponent(row.linked[0].incident_id)}`}>{incidentRef(row.linked[0])}{row.linked.length > 1 ? ` +${row.linked.length - 1}` : ''}</Link> : <span className="ui-muted">—</span>}</td>
                        <td data-ui="station-note" style={row.down.length ? { color: 'var(--bad)', fontWeight: 500 } : undefined} title={row.down.map((unit) => `${unit.unit_name}: ${serviceWord(unit.operational_status)}`).join(', ') || undefined}>{row.note}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
                {!visibleRows.length && !loading && <p className="ui-empty-inline">No stations match the current filters. Clear the filters to restore the county register.</p>}
                {loading && <p className="ui-empty-inline">Loading station and apparatus records…</p>}
              </div>
            </Panel>
          )}

          {pane === 'history' && <UnitTimeline units={liveUnits} stationById={stationById} readiness={readiness} assignments={assignments} histories={histories} history={history} now={now} selected={selectedDefinition} selectedStationUnits={selectedStationUnits} onSelectUnit={select} />}
        </div>

        <Inspector label="Unit record" open={inspectorOpen && Boolean(selectedDefinition)} onClose={() => setInspectorOpen(false)} recordKey={selectedDefinition?.unit_id}>
          {selectedDefinition && selectedUnit ? <>
            <InspectorHeader kind={`${typeName(selectedDefinition)} · Station ${stationNumber(selectedStation) || '—'} ${stationArea(selectedStation)} · Battalion ${battalion(selectedStation)}`} title={recordTitle(selectedDefinition)} headingId="unit-record-heading" badge={<span data-ui="unit-service"><StatusBadge tone={TONE[selectedState]}>{serviceWord(selectedDefinition.operational_status)}</StatusBadge></span>}>
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild><button type="button" className={styles.switcher} aria-label={`${selectedDefinition.unit_name}, ${serviceWord(selectedDefinition.operational_status)}. Choose another unit at this station`}>Other units at this station<ChevronDown aria-hidden="true" /></button></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content className="ui-menu" align="start" sideOffset={4}>
                  <DropdownMenu.Label className="ui-menu-label">Station {stationNumber(selectedStation)} apparatus</DropdownMenu.Label>
                  {selectedStationUnits.map((unit) => <DropdownMenu.Item key={unit.unit_id} className="ui-menu-item" onSelect={() => select(unit.unit_id)}><i className={styles.dot} data-state={unitState(unit, readiness.get(unit.unit_id))} aria-hidden="true" /><strong>{unit.unit_name}</strong><span className="ui-muted">{typeName(unit)}</span><small>{serviceWord(unit.operational_status)}</small></DropdownMenu.Item>)}
                </DropdownMenu.Content></DropdownMenu.Portal>
              </DropdownMenu.Root>
            </InspectorHeader>
            <InspectorBody>
              <dl className="ui-facts">
                <div><dt>Readiness</dt><dd className="ui-num">{selectedUnit.readiness_score}%</dd></div>
                <div><dt>Status since</dt><dd>{lastRecorded ? <><span className="ui-mono">{clock(lastRecorded.start)}</span> ({duration(lastRecorded.start, now)})</> : 'No recorded change'}</dd></div>
                <div><dt>Current assignment</dt><dd>{currentIncident ? <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(currentIncident.incident_id)}`}>{incidentRef(currentIncident)} · {sentence(LIFECYCLE_LABEL[currentIncident.status])}</Link> : 'None recorded'}</dd></div>
                <div><dt>Location</dt><dd>{currentIncident?.display_location || selectedStation?.address || '—'}</dd></div>
              </dl>

              <Section title={`Crew roster (${selectedUnit.staff_present} / ${selectedUnit.staff_required})`} meta={<StatusBadge tone={shortBy ? 'warning' : 'success'}>{shortBy ? `Short ${shortBy}` : 'Complete'}</StatusBadge>}>
                <div className="ui-table-wrap" style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius-control)' }}>
                  <table className="ui-table" data-ui="crew">
                    <thead><tr><th scope="col">Pos</th><th scope="col">Name</th><th scope="col">Qualifications</th></tr></thead>
                    <tbody>
                      {crew.map((person) => <tr key={person.personnel_id}><td className="ui-mono">{person.pos}</td><th scope="row"><Link href={`/personnel?person=${encodeURIComponent(person.personnel_id)}`}>{person.name}</Link><small>{person.rank === '—' ? person.role.replace(/\/.*/, '') : person.rank}</small></th><td className="ui-mono" style={{ fontSize: '0.8125rem' }}>{person.certifications.slice(0, 4).map((cert) => QUAL[cert] || cert).join(' · ')}</td></tr>)}
                      {Array.from({ length: shortBy }, (_, index) => <tr key={`vacant-${index}`}><td className="ui-mono">—</td><td colSpan={2} style={{ color: 'var(--warn)' }}>Vacant position · below minimum staffing</td></tr>)}
                    </tbody>
                  </table>
                  {!crew.length && !shortBy && <p className="ui-empty-inline">No crew recorded for this unit.</p>}
                </div>
              </Section>

              <Section title="Readiness checks" meta={selectedUnit.issues.length ? `${selectedUnit.issues.length} ${selectedUnit.issues.length === 1 ? 'blocker' : 'blockers'}` : 'no blockers'}>
                <dl className={cn('ui-facts ui-facts-rows', styles.checks)}>
                  <div><dt>Staffing</dt><dd><span className="ui-num">{selectedUnit.staff_present}/{selectedUnit.staff_required}</span><StatusBadge tone={shortBy ? 'warning' : 'success'}>{shortBy ? 'Short' : 'Complete'}</StatusBadge></dd></div>
                  <div><dt>Credentials</dt><dd><span>{selectedUnit.certifications_missing.length ? selectedUnit.certifications_missing.slice(0, 2).join(', ') : 'Held'}</span><StatusBadge tone={selectedUnit.certifications_missing.length ? 'warning' : 'success'}>{selectedUnit.certifications_missing.length ? 'Missing' : 'Complete'}</StatusBadge></dd></div>
                  <div><dt>Crew window</dt><dd><span>{crewWindows.length ? `${clock(crewWindows[0].shift_start)} · ${duration(new Date(crewWindows[0].shift_start).getTime(), new Date(crewWindows[0].shift_end).getTime()).replace(/ 00m$/, '')}` : 'None recorded'}</span><StatusBadge tone={crewWindows.length ? 'success' : 'neutral'}>{crewWindows.length ? `${crewWindows.length} recorded` : 'Not applicable'}</StatusBadge></dd></div>
                  <div><dt>Open alerts</dt><dd><span>{unitAlerts[0]?.message || 'None'}</span><StatusBadge tone={unitAlerts.length ? 'danger' : 'success'}>{unitAlerts.length ? `${unitAlerts.length} open` : 'Clear'}</StatusBadge></dd></div>
                </dl>
                {selectedUnit.issues.length > 0 && <ul className={styles.blockers}>{selectedUnit.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              </Section>

              <Section title="Recorded activity" meta="latest four entries">
                <ol className={styles.log} data-ui="unit-log">
                  {unitLog.slice(-4).map((entry) => <li key={entry.key}><time className="ui-mono">{clock(entry.time)}</time><strong>{entry.label}</strong>{entry.incident ? <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(entry.incident.incident_id)}`}>{entry.detail}</Link> : <span>{entry.detail}</span>}</li>)}
                  {!unitLog.length && <li className="ui-muted">No recorded activity for this unit.</li>}
                </ol>
              </Section>

              {simulation && simulation.original_readiness.some((unit) => unit.unit_id === selectedDefinition.unit_id) && <div className="ui-notice" data-tone="info" role="status"><ClipboardList aria-hidden="true" /><span>Scenario only · {simulation.original_readiness[0]?.readiness_score ?? '—'}% before → {simulation.degraded_readiness[0]?.readiness_score ?? '—'}% after. No live assignment changed.</span></div>}
            </InspectorBody>
            <InspectorFooter>
              <InlineError message={actionError?.key === selectedDefinition.unit_id ? actionError.message : undefined} />
              <div className="ui-inspector-actions" data-ui="unit-actions">
                <WriteButton variant="primary" onClick={onAssign}><UserPlus aria-hidden="true" />Assign crew</WriteButton>
                <WriteButton onClick={() => onSimulate(selectedDefinition.unit_id)} busy={simulating}><ClipboardList aria-hidden="true" />Test offline</WriteButton>
                <button type="button" className="ui-button" onClick={() => { setPane('history'); setInspectorOpen(false) }}><HistoryIcon aria-hidden="true" />View history</button>
                <ServiceAction unit={selectedDefinition} incident={currentIncident} busy={updatingStatus} onSetStatus={onSetStatus} />
              </div>
            </InspectorFooter>
          </> : <EmptyState title={loading ? 'Loading unit records' : 'No unit selected'} description={loading ? 'Unit and station records are loading.' : 'Select a station or unit to review crew, readiness, and actions.'} />}
        </Inspector>
      </div>
      <p className="ui-provenance">Unofficial concept · synthetic operations · public station geography.</p>
    </div>
  )
}

function ServiceAction({ unit, incident, busy, onSetStatus }: { unit: Unit; incident?: Incident; busy: boolean; onSetStatus: Props['onSetStatus'] }) {
  if (outOfService(unit.operational_status)) return <WriteButton onClick={() => onSetStatus(unit, 'AVAILABLE')} busy={busy}><Wrench aria-hidden="true" />Return unit</WriteButton>
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild><WriteButton variant="danger" busy={busy} title={incident ? `${unit.unit_name} is committed to ${incidentRef(incident)}` : undefined}><Wrench aria-hidden="true" />Out of service</WriteButton></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content className="ui-menu" align="end" sideOffset={4}>
        <DropdownMenu.Label className="ui-menu-label">{incident ? `Committed to ${incidentRef(incident)} · confirmation required` : 'Record service state'}</DropdownMenu.Label>
        <DropdownMenu.Item className="ui-menu-item" onSelect={() => onSetStatus(unit, 'OUT_OF_SERVICE')}><i className={styles.dot} data-state="critical" aria-hidden="true" /><strong>Out of service</strong><small>Unplanned</small></DropdownMenu.Item>
        <DropdownMenu.Item className="ui-menu-item" onSelect={() => onSetStatus(unit, 'MAINTENANCE')}><i className={styles.dot} data-state="attention" aria-hidden="true" /><strong>Maintenance</strong><small>Planned</small></DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

type LogEntry = { key: string; time: number; label: string; detail: string; incident?: Incident }

function unitChronology(unit: Unit, histories: IncidentHistory[], unitEvents: AuditEvent[]): LogEntry[] {
  const entries: LogEntry[] = []
  for (const record of histories) {
    for (const window of record.units.get(unit.unit_id) || []) {
      const where = record.incident.display_location?.split(',')[0] || record.incident.title
      entries.push({ key: `${record.incident.incident_id}-${window.start}-d`, time: window.start, label: 'Dispatched', detail: `${incidentRef(record.incident)} ${record.incident.incident_type} – ${where}`, incident: record.incident })
      for (const stage of record.stages) {
        if (stage.status === 'ACTIVE' || stage.start <= window.start || stage.start >= window.end) continue
        entries.push({ key: `${record.incident.incident_id}-${stage.start}`, time: stage.start, label: sentence(LIFECYCLE_LABEL[stage.status]), detail: `${incidentRef(record.incident)} ${record.incident.title}`, incident: record.incident })
      }
    }
  }
  for (const event of unitEvents) {
    if (event.entity_id !== unit.unit_id || !event.details.service_state) continue
    const after = String(event.details.after_status) as ServiceState
    if (after === 'DEPLOYED') continue
    const reason = typeof event.details.reason === 'string' ? event.details.reason.replace(/\s*\(synthetic\)/i, '') : after === 'AVAILABLE' ? 'Returned to service' : 'Service state recorded'
    entries.push({ key: event.audit_id, time: eventTime(event), label: sentence(SERVICE_LABEL[after]), detail: reason })
  }
  return entries.sort((a, b) => a.time - b.time)
}

type TimelineProps = {
  units: Unit[]
  stationById: Map<string, Station>
  readiness: Map<string, UnitReadiness>
  assignments: UnitAssignment[]
  histories: IncidentHistory[]
  history: History
  now: number
  selected?: Unit
  selectedStationUnits: Unit[]
  onSelectUnit: (id: string) => void
}

const RANGES = [4, 12, 24] as const
type Range = 'WATCH' | (typeof RANGES)[number]
const STAGE_TONE: Record<LifecycleStatus, string> = { ACTIVE: 'assigned', ENROUTE: 'assigned', ON_SCENE: 'scene', TRANSPORT: 'transport', INVESTIGATING: 'investigating', RESOLVED: 'available' }
const SERVICE_TONE: Record<ServiceState, string> = { AVAILABLE: 'available', DEPLOYED: 'assigned', OUT_OF_SERVICE: 'oos', MAINTENANCE: 'maintenance', UNRECORDED: 'unrecorded' }
const LEGEND: Array<[string, string]> = [['available', 'Available'], ['assigned', 'Assigned'], ['scene', 'On scene'], ['transport', 'Transport'], ['oos', 'Out of service'], ['maintenance', 'Maintenance'], ['unrecorded', 'No record'], ['crew', 'Crew window']]

function UnitTimeline({ units, stationById, readiness, assignments, histories, history, now, selected, selectedStationUnits, onSelectUnit }: TimelineProps) {
  const [range, setRange] = useState<Range>('WATCH')
  const [offset, setOffset] = useState(0)
  const [unitScope, setUnitScope] = useState<TimelineScope>('FOCUS')
  const [typeFilter, setTypeFilter] = useState<'ALL' | Group>('ALL')
  const [focusSelected, setFocusSelected] = useState(false)
  const [activeBar, setActiveBar] = useState<string | null>(null)

  const watchStart = Math.max(...history.baselines.map(eventTime).filter((time) => time <= now), Number.NEGATIVE_INFINITY)
  const watch = range === 'WATCH' && Number.isFinite(watchStart) && now - watchStart > HOUR
  const span = watch ? (now - watchStart) * 1.06 : (range === 'WATCH' ? 12 : range) * HOUR
  const end = (watch ? watchStart + span : now + span * 0.08) - offset * span / 2
  const start = end - span
  const pct = (value: number) => Math.max(0, Math.min(100, (value - start) / (end - start) * 100))

  const barsFor = (unit: Unit): Bar[] => {
    const bars: Bar[] = clip(serviceSegments(unit.unit_id, history.unitEvents, history.baselines, now), start, Math.min(end, now)).map((segment) => ({
      key: `${unit.unit_id}-s-${segment.start}`, start: segment.start, end: segment.end, kind: 'service', state: SERVICE_TONE[segment.state], unit, event: segment.event,
      label: sentence(SERVICE_LABEL[segment.state]), detail: segment.state === 'UNRECORDED' ? 'No service state recorded for this interval; availability is not assumed.' : typeof segment.event?.details.reason === 'string' ? segment.event.details.reason : `Recorded ${SERVICE_LABEL[segment.state].toLowerCase()} state`,
    }))
    for (const record of histories) {
      for (const window of record.units.get(unit.unit_id) || []) {
        const stages = clip(record.stages.map((stage) => ({ ...stage, start: Math.max(stage.start, window.start), end: Math.min(stage.end, window.end) })).filter((stage) => stage.end > stage.start), start, Math.min(end, now))
        stages.forEach((stage, index) => bars.push({
          key: `${unit.unit_id}-${record.incident.incident_id}-${stage.start}`, start: stage.start, end: stage.end, kind: 'incident', state: window.inferred ? 'inferred' : STAGE_TONE[stage.status], unit, incident: record.incident, event: stage.event,
          label: index === 0 && stage.status === 'ACTIVE' ? `${incidentRef(record.incident)} ${record.incident.incident_type} – ${record.incident.display_location?.split(',')[0] || record.incident.title}` : `${sentence(LIFECYCLE_LABEL[stage.status])} (${duration(stage.start, stage.end)})`,
          detail: `${record.incident.title} · ${sentence(LIFECYCLE_LABEL[stage.status])}${window.inferred || stage.untimed ? ' · transition times not recorded' : ''}`,
        }))
      }
    }
    for (const assignment of assignments) {
      if (assignment.unit_id !== unit.unit_id || assignment.assignment_status === 'CANCELLED') continue
      const window = clip([{ start: new Date(assignment.shift_start).getTime(), end: new Date(assignment.shift_end).getTime() }], start, end)[0]
      if (window) bars.push({ key: `${unit.unit_id}-c-${assignment.assignment_id}`, start: window.start, end: window.end, kind: 'crew', state: assignment.assignment_status.toLowerCase(), unit, label: 'Crew window', detail: `${titleCase(assignment.assignment_status)} assignment ${clock(assignment.shift_start)}–${clock(assignment.shift_end)}` })
    }
    return bars
  }

  const candidates = useMemo(() => {
    const station = new Set(selectedStationUnits.map((unit) => unit.unit_id))
    const activity = new Set<string>()
    for (const record of histories) for (const [unitId, windows] of Array.from(record.units)) if (windows.some((window) => window.end > start && window.start < end)) activity.add(unitId)
    for (const event of history.unitEvents) if (event.details.service_state && eventTime(event) > start && eventTime(event) < end) activity.add(event.entity_id)
    for (const unit of units) if (outOfService(unit.operational_status)) activity.add(unit.unit_id)
    const pool = unitScope === 'STATION' ? units.filter((unit) => station.has(unit.unit_id)) : unitScope === 'FOCUS' ? units.filter((unit) => station.has(unit.unit_id) || activity.has(unit.unit_id)) : units
    return [...pool].sort((a, b) => Number(station.has(b.unit_id)) - Number(station.has(a.unit_id)) || stationNumber(stationById.get(a.station_id || '')) - stationNumber(stationById.get(b.station_id || '')) || a.unit_name.localeCompare(b.unit_name))
  }, [units, histories, history.unitEvents, selectedStationUnits, unitScope, start, end, stationById])
  const visible = candidates.filter((unit) => (typeFilter === 'ALL' || groupOf(unit.type) === typeFilter) && (!focusSelected || unit.unit_id === selected?.unit_id))
  const rows = visible.map((unit) => ({ unit, bars: barsFor(unit) }))
  const allBars = rows.flatMap((row) => row.bars)
  const detail = allBars.find((bar) => bar.key === activeBar)
  const notable = rows.flatMap((row) => row.bars.filter((bar) => bar.kind === 'incident' ? /^I-/.test(bar.label) : bar.kind === 'service' && bar.event && !['available', 'assigned', 'unrecorded'].includes(bar.state) && bar.start > start))
    .sort((a, b) => b.start - a.start)
    .filter((bar, index, list) => list.findIndex((item) => (item.incident?.incident_id || item.key) === (bar.incident?.incident_id || bar.key)) === index)
  const hourTicks = ticks(start, end)
  const windowLabel = `${clock(start)}–${clock(end)}`

  return (
    <section className={cn('ui-stage', styles.timeline)} aria-labelledby="unit-timeline-heading" data-ui="unit-timeline">
      <header className="ui-stage-header">
        <div><h2 id="unit-timeline-heading">Unit deployment history</h2><p><span className="ui-mono">{windowLabel}</span> · recorded service states and incident stages · {rows.length} units</p></div>
        <div className={styles.timeControls} data-ui="unit-time-controls">
          <label><span className="sr-only">Units shown</span><select value={unitScope} onChange={(event) => setUnitScope(event.target.value as TimelineScope)}><option value="FOCUS">Station + activity</option><option value="STATION">Selected station</option><option value="ALL">All units</option></select></label>
          <label><span className="sr-only">Unit type</span><select aria-label="Unit type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | Group)}><option value="ALL">All types</option>{GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABEL[group]}</option>)}</select></label>
          <span className={styles.timeControls} role="group" aria-label="Time range">
            <button type="button" className="ui-stage-button" onClick={() => setOffset(offset + 1)} aria-label="Earlier"><ChevronLeft aria-hidden="true" /></button>
            <label><span className="sr-only">Window length</span><select value={range} onChange={(event) => { setRange(event.target.value === 'WATCH' ? 'WATCH' : Number(event.target.value) as Range); setOffset(0) }}><option value="WATCH">Current watch</option>{RANGES.map((value) => <option key={value} value={value}>{value} hours</option>)}</select></label>
            <button type="button" className="ui-stage-button" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Later"><ChevronRight aria-hidden="true" /></button>
          </span>
          <button type="button" className="ui-stage-button" aria-pressed={focusSelected} onClick={() => setFocusSelected(!focusSelected)} disabled={!selected}>Focus {selected?.unit_name || 'unit'}</button>
        </div>
      </header>
      <ul className={styles.legend} aria-label="Timeline legend">{LEGEND.map(([tone, label]) => <li key={tone}><i data-tone={tone} aria-hidden="true" />{label}</li>)}</ul>
      <div className={styles.historyBody}>
        <div className={styles.timeScroll} tabIndex={0} role="region" aria-label="Recorded unit activity by time">
          <div className={styles.timeCanvas} role="table" aria-label={`Recorded unit activity, ${windowLabel}`} aria-rowcount={rows.length + 1}>
            <div className={cn(styles.ruler, styles.unitRuler)} role="row"><span role="columnheader">Unit</span><span role="columnheader">Station</span><span role="columnheader">Crew</span><div role="columnheader" aria-label={`Time ruler ${windowLabel}`}>{hourTicks.filter((tick) => pct(tick) > 2.5 && pct(tick) < 97.5).map((tick) => <b key={tick} style={{ left: `${pct(tick)}%` }}>{clock(tick)}</b>)}</div></div>
            {rows.map(({ unit, bars }) => {
              const metric = readiness.get(unit.unit_id)
              const station = stationById.get(unit.station_id || '')
              const isSelected = selected?.unit_id === unit.unit_id
              return (
                <div role="row" key={unit.unit_id} className={cn(styles.timeRow, styles.unitTimeRow)} data-ui="unit-history-row" data-selected={isSelected || undefined}>
                  <span role="cell" className={styles.rowLabel}><button type="button" onClick={() => onSelectUnit(unit.unit_id)} aria-pressed={isSelected} aria-label={`Select ${unit.unit_name}`}>{unit.unit_name}</button><small data-ui="unit-history-type">{typeName(unit)}</small></span>
                  <span role="cell" className={styles.cell} title={`Station ${stationNumber(station)} · ${serviceWord(unit.operational_status)}`}><i className={styles.dot} data-state={unitState(unit, metric)} aria-hidden="true" />{stationNumber(station) || '—'}</span>
                  <span role="cell" className={cn(styles.cell, 'ui-num')}>{metric?.staff_present ?? 0}/{metric?.staff_required ?? unit.minimum_staff}</span>
                  <div role="cell" className={styles.track}>
                    {hourTicks.map((tick) => <i key={tick} className={styles.gridLine} style={{ left: `${pct(tick)}%` }} aria-hidden="true" />)}
                    {now > start && now < end && <i className={styles.nowLine} style={{ left: `${pct(now)}%` }} aria-hidden="true" />}
                    {bars.filter((bar) => bar.kind !== 'crew').sort((a, b) => Number(a.kind === 'incident') - Number(b.kind === 'incident')).map((bar) => <button type="button" key={bar.key} className={styles.bar} data-ui="unit-bar" data-kind={bar.kind} data-tone={bar.state} data-active={activeBar === bar.key || undefined} style={{ left: `${pct(bar.start)}%`, width: `${Math.max(0.35, pct(bar.end) - pct(bar.start))}%` }} onClick={() => setActiveBar(bar.key)} aria-label={`${unit.unit_name}: ${bar.label}, ${clock(bar.start)} to ${bar.end >= now - 1000 ? 'now' : clock(bar.end)}`}><span>{bar.label}</span></button>)}
                    {bars.filter((bar) => bar.kind === 'crew').map((bar) => <button type="button" key={bar.key} className={styles.crewLine} data-active={activeBar === bar.key || undefined} style={{ left: `${pct(bar.start)}%`, width: `${Math.max(0.35, pct(bar.end) - pct(bar.start))}%` }} onClick={() => setActiveBar(bar.key)} aria-label={`${unit.unit_name}: ${bar.detail}`} />)}
                  </div>
                </div>
              )
            })}
            {!rows.length && <p className="ui-empty-inline">{history.loading ? 'Loading recorded activity…' : 'No units match the timeline filters.'}</p>}
          </div>
        </div>
        <aside className={styles.events} aria-labelledby="unit-events-heading">
          <h3 id="unit-events-heading">{detail ? 'Event detail' : 'Notable events'}</h3>
          {detail ? (
            <div role="status" data-ui="unit-event-detail">
              <strong>{detail.unit.unit_name} · {detail.kind === 'crew' ? 'Crew window' : detail.label}</strong>
              <p>{detail.detail}</p>
              <dl>
                <div><dt>From</dt><dd className="ui-mono">{clock(detail.start)}</dd></div>
                <div><dt>To</dt><dd className="ui-mono">{detail.end >= now - 1000 ? 'Now' : clock(detail.end)}</dd></div>
                <div><dt>Length</dt><dd>{duration(detail.start, detail.end)}</dd></div>
                <div><dt>Source</dt><dd>{detail.event ? `${detail.event.actor} · ${detail.event.audit_id}` : detail.kind === 'crew' ? 'Assignment record' : 'No source event'}</dd></div>
              </dl>
              <div className={styles.eventLinks}>
                {detail.incident && <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(detail.incident.incident_id)}`}>Open {incidentRef(detail.incident)} <ArrowRight aria-hidden="true" /></Link>}
                <button type="button" onClick={() => onSelectUnit(detail.unit.unit_id)}>Open {detail.unit.unit_name}</button>
                <button type="button" onClick={() => setActiveBar(null)}>Back to events</button>
              </div>
            </div>
          ) : (
            <ol>
              {notable.slice(0, 12).map((bar) => <li key={bar.key}><button type="button" onClick={() => setActiveBar(bar.key)}><time className="ui-mono">{clock(bar.start)}</time><span>{bar.incident ? `${incidentRef(bar.incident)} ${bar.incident.title}${bar.incident.display_location ? ` – ${bar.incident.display_location.split(',').slice(-2, -1)[0]?.trim() || ''}` : ''}` : `${bar.unit.unit_name} ${bar.label}`}</span></button></li>)}
              {!notable.length && <li className={styles.eventsEmpty}>No recorded incident or service events in this window.</li>}
            </ol>
          )}
        </aside>
      </div>
      <p className="ui-stage-note">The thin line beneath each bar is the crew assignment window. Hatched grey means no record; availability is not assumed.</p>
    </section>
  )
}
