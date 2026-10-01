'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ListOrdered, Plus, Search, Truck, UserPlus, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CrewPictogram, WarningPictogram, WrenchPictogram } from '@/components/Pictograms'
import { WriteButton } from '@/components/ui'
import { clip, clock, duration, eventTime, incidentHistory, incidentRef, LIFECYCLE_LABEL, SERVICE_LABEL, serviceSegments, ticks, type IncidentHistory, type LifecycleStatus, type ServiceState } from '@/lib/history'
import type { AuditEvent, Incident, OperationsSnapshot, Personnel, SimulationResult, Station, Unit, UnitAssignment, UnitReadiness } from '@/lib/schemas'

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
  loading: boolean
}

type Group = 'ENGINE' | 'TRUCK' | 'MEDIC' | 'RESCUE' | 'OTHER'
type Condition = 'ready' | 'attention' | 'critical'
type TimelineScope = 'FOCUS' | 'STATION' | 'ALL'
type Bar = { key: string; start: number; end: number; kind: 'service' | 'incident' | 'crew'; state: string; label: string; detail: string; incident?: Incident; event?: AuditEvent; unit: Unit }

const GROUPS: Group[] = ['ENGINE', 'TRUCK', 'MEDIC', 'RESCUE', 'OTHER']
const GROUP_LABEL: Record<Group, string> = { ENGINE: 'Engines', TRUCK: 'Trucks', MEDIC: 'Medics', RESCUE: 'Rescues', OTHER: 'Other apparatus' }
const TYPE_NAME: Partial<Record<Unit['type'], string>> = { ENGINE: 'Engine', LADDER: 'Ladder', TRUCK: 'Truck', MEDIC: 'Medic', AMBULANCE: 'Ambulance', RESCUE: 'Rescue', TANKER: 'Tanker', COMMAND: 'Command', SAFETY: 'Safety', HAZMAT: 'HazMat', SAR_TEAM: 'SAR Team' }
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
const dossierTitle = (unit: Unit) => /^[A-Z]{1,2}\d+$/.test(unit.unit_name) ? `${typeName(unit).toUpperCase()} ${unit.unit_name.replace(/^[A-Z]+/, '')}` : unit.unit_name.toUpperCase()
const serviceWord = (status: Unit['operational_status']) => status === 'AVAILABLE' ? 'In service' : status === 'DEPLOYED' ? 'Committed' : status === 'MAINTENANCE' ? 'Maintenance' : 'Out of service'
const outOfService = (status: Unit['operational_status']) => status === 'OUT_OF_SERVICE' || status === 'MAINTENANCE'
const isLinked = (incident: Incident, unit: Unit) => incident.unit_id === unit.unit_id || incident.assigned_unit_ids.includes(unit.unit_id)

function unitState(unit: Unit, readiness?: UnitReadiness): Condition | 'committed' {
  if (outOfService(unit.operational_status)) return 'critical'
  if ((readiness?.readiness_score ?? 0) < 85) return 'attention'
  return unit.operational_status === 'DEPLOYED' ? 'committed' : 'ready'
}

const POS = (role: string, certifications: string[], index: number) => {
  if (/officer|captain|chief/i.test(role) || index === 0 && /company/i.test(role)) return 'OIC'
  if (certifications.includes('DRIVER')) return 'DR'
  if (/paramedic/i.test(role)) return 'ALS'
  if (/technician|emt/i.test(role) && !/firefighter/i.test(role)) return 'BLS'
  return 'FF'
}
const QUAL: Record<string, string> = { 'HAZMAT-OPS': 'HAZ', 'HAZMAT-TECH': 'HZT', 'TECH-RESCUE': 'TECH', PARAMEDIC: 'ALS', DRIVER: 'DRV', AERIAL: 'AER', 'ICS-300': 'ICS', SAFETY: 'ISO' }

export default function UnitsSwitchboard({ snapshot, stations, definitions, assignments, personnel, history, scope, selectedUnit, onSelectUnit, onAddUnit, onAssign, onSimulate, simulation, simulating, onSetStatus, updatingStatus, loading }: Props) {
  const [battalionFilter, setBattalionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | Group>('ALL')
  const [search, setSearch] = useState('')
  const timelineRef = useRef<HTMLElement>(null)
  const matrixRef = useRef<HTMLDivElement>(null)

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
      : linked.length ? LIFECYCLE_LABEL[linked[0].status].toLowerCase().replace(/^./, (c) => c.toUpperCase())
        : required - present > 0 ? `${required - present} short` : 'Normal'
    return { station, members, present, required, average, condition, linked, note, down }
  })
  const visibleRows = rows.filter((row) => {
    if (battalionFilter !== 'ALL' && battalion(row.station) !== battalionFilter) return false
    if (typeFilter !== 'ALL' && !row.members.some((unit) => groupOf(unit.type) === typeFilter)) return false
    if (statusFilter !== 'ALL' && row.condition.toUpperCase() !== statusFilter) return false
    const haystack = `${row.station.name} ${row.station.address || ''} ${row.members.map((unit) => `${unit.unit_name} ${unit.unit_id}`).join(' ')}`.toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
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

  useEffect(() => {
    if (!selectedStation) return
    const row = matrixRef.current?.querySelector<HTMLElement>(`[data-station="${selectedStation.station_id}"]`)
    const scroller = matrixRef.current
    if (!row || !scroller) return
    // Keep three preceding stations in view so the selection reads in its battalion context.
    const header = scroller.querySelector('thead')?.getBoundingClientRect().height || 0
    if (row.offsetTop - header < scroller.scrollTop || row.offsetTop + row.offsetHeight > scroller.scrollTop + scroller.clientHeight) scroller.scrollTo({ top: Math.max(0, row.offsetTop - header - row.offsetHeight * 3) })
  }, [selectedStation])

  function chooseStation(members: Unit[]) {
    const term = search.trim().toLowerCase()
    const match = (term && members.find((unit) => `${unit.unit_name} ${unit.unit_id}`.toLowerCase().includes(term))) || members.find((unit) => typeFilter === 'ALL' || groupOf(unit.type) === typeFilter) || members[0]
    if (match) onSelectUnit(match.unit_id)
  }

  function apparatusCell(members: Unit[], group: Group, stationLabel: string) {
    const units = members.filter((unit) => groupOf(unit.type) === group)
    if (!units.length) return <span className="sb-dash" aria-label="None">—</span>
    const first = units.find((unit) => unit.unit_id === selectedUnit?.unit_id) || units[0]
    const state = unitState(first, readiness.get(first.unit_id))
    if (units.length === 1) {
      return <button type="button" className={`sb-unit state-${state} ${selectedUnit?.unit_id === first.unit_id ? 'is-selected' : ''}`} onClick={() => onSelectUnit(first.unit_id)} aria-pressed={selectedUnit?.unit_id === first.unit_id} aria-label={`${first.unit_name}, ${typeName(first)}, ${serviceWord(first.operational_status)}`}><i aria-hidden="true" /><span>{first.unit_name}</span></button>
    }
    return <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild><button type="button" className={`sb-unit sb-unit-multi state-${state} ${units.some((unit) => unit.unit_id === selectedUnit?.unit_id) ? 'is-selected' : ''}`} aria-label={`${units.length} ${GROUP_LABEL[group].toLowerCase()} at ${stationLabel}: choose a unit`}><i aria-hidden="true" /><span>{first.unit_name}</span><b>+{units.length - 1}</b></button></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content className="sb-chooser" align="start" sideOffset={3}>
        <DropdownMenu.Label className="sb-chooser-label">{GROUP_LABEL[group].toUpperCase()} · {stationLabel.toUpperCase()}</DropdownMenu.Label>
        {units.map((unit) => { const tone = unitState(unit, readiness.get(unit.unit_id)); return <DropdownMenu.Item key={unit.unit_id} className={`sb-chooser-item state-${tone}`} onSelect={() => onSelectUnit(unit.unit_id)}><i aria-hidden="true" /><strong>{unit.unit_name}</strong><span>{typeName(unit)}</span><small>{serviceWord(unit.operational_status)}</small></DropdownMenu.Item> })}
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
  }

  // Dossier facts derived from records.
  const selectedReadiness = selectedUnit
  const currentIncident = selectedDefinition ? activeIncidents.find((incident) => isLinked(incident, selectedDefinition)) : undefined
  const selectedSegments = selectedDefinition ? serviceSegments(selectedDefinition.unit_id, history.unitEvents, history.baselines, now) : []
  const lastRecorded = [...selectedSegments].reverse().find((segment) => segment.state !== 'UNRECORDED')
  const unitLog = selectedDefinition ? unitChronology(selectedDefinition, histories, history.unitEvents) : []
  const crew = (selectedReadiness?.assigned_personnel || []).map((person, index) => ({ ...person, rank: people.get(person.personnel_id)?.rank || '—', pos: POS(person.role, person.certifications, index) }))
  const unitAlerts = (snapshot?.alerts || []).filter((alert) => alert.unit_id === selectedDefinition?.unit_id && alert.state !== 'RESOLVED')
  const crewWindows = assignments.filter((assignment) => assignment.unit_id === selectedDefinition?.unit_id && assignment.assignment_status !== 'CANCELLED')
  const shortBy = selectedReadiness ? Math.max(0, selectedReadiness.staff_required - selectedReadiness.staff_present) : 0
  const selectedState = selectedDefinition ? unitState(selectedDefinition, selectedReadiness) : 'ready'

  return <div className="units-switchboard">
    <section className="sb-instruments" aria-label="County unit summary">
      <div className="sb-instrument sb-apparatus"><h1>APPARATUS READINESS</h1><div className="sb-rings">{groupStats.map(({ group, ready, total, pct }) => <div key={group}><Ring pct={pct} /><span>{group === 'TRUCK' ? 'TRUCKS' : `${group}S`}</span><strong>{ready}<small>/{total}</small></strong><em>{pct}%</em></div>)}</div></div>
      <div className="sb-instrument sb-staff"><h2>STAFFING <small>(ALL UNITS)</small></h2><div><CrewPictogram className="sb-pictogram sb-crew-icon" /><p><strong>{staffPresent}<small> / {staffRequired}</small></strong><span>{staffRequired ? Math.round(staffPresent / staffRequired * 100) : 0}% STAFFED</span></p><b>{staffingGap}<small>POSITIONS<br />BELOW MIN</small></b></div></div>
      <div className="sb-instrument sb-oos"><h2>UNITS OUT OF SERVICE</h2><div><WrenchPictogram className="sb-pictogram" /><strong>{String(down.length).padStart(2, '0')}</strong><ul><li>{down.filter((unit) => unit.operational_status === 'MAINTENANCE').length} MAINTENANCE</li><li>{down.filter((unit) => unit.operational_status === 'OUT_OF_SERVICE').length} OUT OF SERVICE</li><li>{committed.length} COMMITTED</li></ul></div></div>
      <div className="sb-instrument sb-incidents"><h2>ACTIVE INCIDENTS</h2><div><WarningPictogram className="sb-warning" /><strong>{String(activeIncidents.length).padStart(2, '0')}</strong><dl>{(['FIRE', 'EMS', 'HAZMAT', 'OTHER'] as const).map((kind) => <div key={kind}><dt>{kind}</dt><dd>{snapshot?.command_board.incident_types[kind] || 0}</dd></div>)}</dl></div></div>
    </section>

    <div className="sb-main">
      <section className="sb-matrix" aria-labelledby="sb-matrix-heading">
        <header className="sb-bar"><h2 id="sb-matrix-heading">STATION DEPLOYMENT MATRIX</h2><span>{visibleRows.length === allStations.length ? `${allStations.length} STATIONS × ${battalions.length} BATTALIONS` : `${visibleRows.length} OF ${allStations.length} STATIONS`}<i aria-hidden="true" />APPARATUS • STAFFING • READINESS • INCIDENTS</span></header>
        <div className="sb-filters">
          <WriteButton variant="ghost" className="sb-add" onClick={onAddUnit}><Plus aria-hidden="true" />Add unit</WriteButton>
          <label><span className="sr-only">Battalion</span><select value={battalionFilter} onChange={(event) => setBattalionFilter(event.target.value)}><option value="ALL">All Battalions</option>{battalions.map((value) => <option key={value} value={value}>Battalion {value}</option>)}</select></label>
          <label><span className="sr-only">Station readiness</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All Statuses</option><option value="READY">Ready</option><option value="ATTENTION">Attention</option><option value="CRITICAL">Critical</option></select></label>
          <label><span className="sr-only">Unit type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | Group)}><option value="ALL">All Unit Types</option>{GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABEL[group]}</option>)}</select></label>
          <label className="sb-search"><span className="sr-only">Find unit or station</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find unit or station…" /><Search aria-hidden="true" /></label>
        </div>
        <div className="sb-matrix-scroll" ref={matrixRef}>
          <table>
            <caption className="sr-only">Station apparatus deployment. Choose a unit to open its dossier; cells with several units open a chooser.</caption>
            <thead><tr><th scope="col">#</th><th scope="col">STATION / AREA</th><th scope="col">BN</th><th scope="col">ENGINE</th><th scope="col">TRUCK</th><th scope="col">MEDIC</th><th scope="col">RESCUE</th><th scope="col">OTHER</th><th scope="col">STAFFING</th><th scope="col">READINESS</th><th scope="col">INCIDENT</th><th scope="col">NOTES</th></tr></thead>
            <tbody>{visibleRows.map((row) => { const selected = selectedStation?.station_id === row.station.station_id; const label = `Station ${stationNumber(row.station)} ${stationArea(row.station)}`; return <tr key={row.station.station_id} data-station={row.station.station_id} className={selected ? 'is-selected' : ''} aria-selected={selected}>
              <td data-label="#"><button type="button" className="sb-station-number" onClick={() => chooseStation(row.members)} aria-label={`Select ${label}`}>{selected && <span aria-hidden="true">▸</span>}{stationNumber(row.station)}</button></td>
              <td data-label="STATION / AREA"><button type="button" className="sb-area" onClick={() => chooseStation(row.members)}>{stationArea(row.station)}</button></td>
              <td data-label="BN">B{battalion(row.station)}</td>
              {GROUPS.map((group) => <td key={group} data-label={group}>{apparatusCell(row.members, group, label)}</td>)}
              <td data-label="STAFFING" className="sb-num">{row.present} / {row.required}</td>
              <td data-label="READINESS"><span className={`sb-stamp state-${row.condition}`}>{row.condition === 'ready' ? 'READY' : row.condition === 'attention' ? 'ATTENTION' : 'CRITICAL'}</span></td>
              <td data-label="INCIDENT">{row.linked.length ? <Link className="sb-incident-ref" href={`/readiness?view=incidents&incident=${encodeURIComponent(row.linked[0].incident_id)}`}>{incidentRef(row.linked[0])}{row.linked.length > 1 ? ` +${row.linked.length - 1}` : ''}</Link> : <span className="sb-dash">—</span>}</td>
              <td data-label="NOTES" className={row.down.length ? 'sb-note-alert' : ''} title={row.down.map((unit) => `${unit.unit_name}: ${serviceWord(unit.operational_status)}`).join(', ') || undefined}>{row.note}</td>
            </tr> })}</tbody>
          </table>
          {!visibleRows.length && !loading && <p className="sb-empty">No stations match the current filters. Clear the filters to restore the county register.</p>}
          {loading && <p className="sb-empty">Loading station and apparatus records…</p>}
        </div>
      </section>

      <section className="sb-dossier" aria-labelledby="sb-dossier-heading">
        {selectedDefinition && selectedReadiness ? <>
          <header className="sb-dossier-head">
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild><button type="button" className="sb-dossier-title" aria-label={`${selectedDefinition.unit_name}, ${serviceWord(selectedDefinition.operational_status)}. Choose another unit at this station`}><h2 id="sb-dossier-heading">{dossierTitle(selectedDefinition)}</h2><span className={`sb-service state-${selectedState}`}><i aria-hidden="true" />{serviceWord(selectedDefinition.operational_status).toUpperCase()}</span><ChevronDown aria-hidden="true" /></button></DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content className="sb-chooser" align="start" sideOffset={2}>
                <DropdownMenu.Label className="sb-chooser-label">STATION {stationNumber(selectedStation)} APPARATUS</DropdownMenu.Label>
                {selectedStationUnits.map((unit) => <DropdownMenu.Item key={unit.unit_id} className={`sb-chooser-item state-${unitState(unit, readiness.get(unit.unit_id))}`} onSelect={() => onSelectUnit(unit.unit_id)}><i aria-hidden="true" /><strong>{unit.unit_name}</strong><span>{typeName(unit)}</span><small>{serviceWord(unit.operational_status)}</small></DropdownMenu.Item>)}
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
            <div className="sb-dossier-station"><strong>STATION {stationNumber(selectedStation) || '—'}</strong><span>{stationArea(selectedStation).toUpperCase()} · BN {battalion(selectedStation)}</span></div>
          </header>
          <div className="sb-dossier-top">
            <div className="sb-picture">{['ENGINE', 'TRUCK', 'LADDER'].includes(selectedDefinition.type) ? <Image src="/assets/plates/apparatus-image.png" alt="Illustrative unbranded fire apparatus; not a photograph of the selected unit" width={700} height={420} priority /> : <div className="sb-no-photo"><Truck aria-hidden="true" /><strong>NO RECORD PHOTO</strong><span>{typeName(selectedDefinition).toUpperCase()} · UNIT RECORD</span></div>}</div>
            <dl className="sb-facts">
              <div><dt>TYPE</dt><dd>{typeName(selectedDefinition)} ({selectedDefinition.unit_name})</dd></div>
              <div><dt>STATION</dt><dd>{stationNumber(selectedStation) || '—'} – {stationArea(selectedStation)}</dd></div>
              <div><dt>BATTALION</dt><dd>{battalion(selectedStation)}</dd></div>
              <div><dt>STATUS</dt><dd>{serviceWord(selectedDefinition.operational_status)} · {selectedReadiness.readiness_score}%</dd></div>
              <div><dt>CURRENT<br />ASSIGNMENT</dt><dd>{currentIncident ? <Link className="sb-alert-link" href={`/readiness?view=incidents&incident=${encodeURIComponent(currentIncident.incident_id)}`}>{incidentRef(currentIncident)} · {LIFECYCLE_LABEL[currentIncident.status]}</Link> : 'None recorded'}</dd></div>
              <div><dt>LOCATION</dt><dd className="sb-wrap">{currentIncident?.display_location || selectedStation?.address || '—'}</dd></div>
              <div><dt>STATUS<br />SINCE</dt><dd>{lastRecorded ? `${clock(lastRecorded.start)} (${duration(lastRecorded.start, now)})` : 'No recorded change'}</dd></div>
            </dl>
          </div>
          <section className="sb-crew" aria-labelledby="sb-crew-heading">
            <header><h3 id="sb-crew-heading">CREW ROSTER ({selectedReadiness.staff_present} / {selectedReadiness.staff_required})</h3><span className={`sb-flag ${shortBy ? 'state-attention' : 'state-ready'}`}>{shortBy ? `SHORT ${shortBy}` : 'COMPLETE'}</span></header>
            <div className="sb-crew-scroll"><table><thead><tr><th scope="col">POS</th><th scope="col">NAME</th><th scope="col">RANK</th><th scope="col">QUALIFICATIONS</th></tr></thead><tbody>
              {crew.map((person) => <tr key={person.personnel_id}><td>{person.pos}</td><td><Link href={`/personnel?person=${encodeURIComponent(person.personnel_id)}`}>{person.name}</Link></td><td>{person.rank === '—' ? person.role.replace(/\/.*/, '') : person.rank}</td><td><span className="sb-quals">{person.certifications.slice(0, 4).map((cert) => <span key={cert}>{QUAL[cert] || cert}</span>)}</span></td></tr>)}
              {Array.from({ length: shortBy }, (_, index) => <tr key={`vacant-${index}`} className="sb-vacant"><td>—</td><td colSpan={3}>Vacant position · below minimum staffing</td></tr>)}
            </tbody></table>{!crew.length && !shortBy && <p className="sb-empty">No crew recorded for this unit.</p>}</div>
          </section>
          <div className="sb-dossier-lower">
            <section aria-labelledby="sb-unit-log"><h3 id="sb-unit-log">UNIT TIMELINE (RECORDED)</h3><div className="sb-log" tabIndex={0} role="group" aria-label="Recorded unit activity">{unitLog.slice(-4).map((entry) => <div key={entry.key}><time>{clock(entry.time)}</time><span className={`tone-${entry.tone}`}>{entry.label}</span>{entry.incident ? <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(entry.incident.incident_id)}`}>{entry.detail}</Link> : <small>{entry.detail}</small>}</div>)}{!unitLog.length && <p>No recorded activity for this unit.</p>}</div></section>
            <section aria-labelledby="sb-checks"><h3 id="sb-checks">READINESS CHECKS</h3><div className="sb-log sb-checks" tabIndex={0} role="group" aria-label="Readiness checks">
              <div><span>Staffing</span><small>{selectedReadiness.staff_present}/{selectedReadiness.staff_required}</small><b className={shortBy ? 'tone-attention' : 'tone-ready'}>{shortBy ? 'Short' : 'Complete'}</b></div>
              <div><span>Credentials</span><small>{selectedReadiness.certifications_missing.length ? selectedReadiness.certifications_missing.slice(0, 2).join(', ') : 'Held'}</small><b className={selectedReadiness.certifications_missing.length ? 'tone-attention' : 'tone-ready'}>{selectedReadiness.certifications_missing.length ? 'Missing' : 'Complete'}</b></div>
              <div><span>Crew window</span><small>{crewWindows.length ? `${clock(crewWindows[0].shift_start)} · ${duration(new Date(crewWindows[0].shift_start).getTime(), new Date(crewWindows[0].shift_end).getTime()).replace(/ 00m$/, '')}` : 'None recorded'}</small><b className={crewWindows.length ? 'tone-ready' : 'tone-muted'}>{crewWindows.length ? `${crewWindows.length} rec.` : 'N/A'}</b></div>
              <div><span>Open alerts</span><small>{unitAlerts[0]?.message.slice(0, 26) || 'None'}</small><b className={unitAlerts.length ? 'tone-critical' : 'tone-ready'}>{unitAlerts.length ? unitAlerts.length : 'Clear'}</b></div>
            </div></section>
          </div>
          {simulation && simulation.original_readiness.some((unit) => unit.unit_id === selectedDefinition.unit_id) && <div className="sb-simulation" role="status">Scenario only · {simulation.original_readiness[0]?.readiness_score ?? '—'}% before → {simulation.degraded_readiness[0]?.readiness_score ?? '—'}% after. No live assignment changed.</div>}
          <div className="sb-actions">
            <WriteButton variant="primary" onClick={onAssign}><UserPlus aria-hidden="true" />Assign crew</WriteButton>
            <WriteButton className="sb-action-blue" onClick={() => onSimulate(selectedDefinition.unit_id)} busy={simulating}><ClipboardList aria-hidden="true" />Test offline</WriteButton>
            <button type="button" className="button button-ghost sb-action-outline" onClick={() => { timelineRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); timelineRef.current?.querySelector<HTMLElement>('.sb-row.is-selected button')?.focus({ preventScroll: true }) }}><ListOrdered aria-hidden="true" />View history</button>
            <ServiceAction unit={selectedDefinition} incident={currentIncident} busy={updatingStatus} onSetStatus={onSetStatus} />
          </div>
        </> : <p className="sb-empty">{loading ? 'Loading unit records…' : 'Select a station or unit to review crew, readiness, and actions.'}</p>}
      </section>
    </div>

    <UnitTimeline sectionRef={timelineRef} units={liveUnits} stationById={stationById} readiness={readiness} assignments={assignments} histories={histories} history={history} now={now} selected={selectedDefinition} selectedStationUnits={selectedStationUnits} onSelectUnit={onSelectUnit} />
    <footer className="sb-provenance"><span>UNOFFICIAL CONCEPT · SYNTHETIC OPERATIONS · PUBLIC STATION GEOGRAPHY</span><span>A STRONGER SAFER FAIRFAX</span><span>FAIRFAX COUNTY FIRE AND RESCUE <i aria-hidden="true" /> UNITS WORKSPACE</span></footer>
  </div>
}

function Ring({ pct }: { pct: number }) {
  const tone = pct >= 90 ? 'ready' : pct >= 75 ? 'attention' : 'critical'
  return <svg className={`sb-ring state-${tone}`} viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="17.5" /><circle cx="22" cy="22" r="17.5" pathLength="100" strokeDasharray={`${pct} 100`} transform="rotate(-90 22 22)" /></svg>
}

function ServiceAction({ unit, incident, busy, onSetStatus }: { unit: Unit; incident?: Incident; busy: boolean; onSetStatus: Props['onSetStatus'] }) {
  if (outOfService(unit.operational_status)) return <WriteButton variant="secondary" className="sb-action-return" onClick={() => onSetStatus(unit, 'AVAILABLE')} busy={busy}><Wrench aria-hidden="true" />Return unit</WriteButton>
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild><WriteButton variant="danger" busy={busy} title={incident ? `${unit.unit_name} is committed to ${incidentRef(incident)}` : undefined}><Wrench aria-hidden="true" />Out of service</WriteButton></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className="sb-chooser" align="end" sideOffset={3}>
      <DropdownMenu.Label className="sb-chooser-label">{incident ? `COMMITTED TO ${incidentRef(incident)} · CONFIRMATION REQUIRED` : 'RECORD SERVICE STATE'}</DropdownMenu.Label>
      <DropdownMenu.Item className="sb-chooser-item state-critical" onSelect={() => onSetStatus(unit, 'OUT_OF_SERVICE')}><i aria-hidden="true" /><strong>Out of service</strong><span>Unplanned</span></DropdownMenu.Item>
      <DropdownMenu.Item className="sb-chooser-item state-attention" onSelect={() => onSetStatus(unit, 'MAINTENANCE')}><i aria-hidden="true" /><strong>Maintenance</strong><span>Planned</span></DropdownMenu.Item>
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>
}

type LogEntry = { key: string; time: number; label: string; detail: string; tone: string; incident?: Incident }

function unitChronology(unit: Unit, histories: IncidentHistory[], unitEvents: AuditEvent[]): LogEntry[] {
  const entries: LogEntry[] = []
  for (const record of histories) {
    for (const window of record.units.get(unit.unit_id) || []) {
      const where = record.incident.display_location?.split(',')[0] || record.incident.title
      entries.push({ key: `${record.incident.incident_id}-${window.start}-d`, time: window.start, label: 'Dispatched', detail: `${incidentRef(record.incident)} ${record.incident.incident_type} – ${where}`, tone: 'ready', incident: record.incident })
      for (const stage of record.stages) {
        if (stage.status === 'ACTIVE' || stage.start <= window.start || stage.start >= window.end) continue
        entries.push({ key: `${record.incident.incident_id}-${stage.start}`, time: stage.start, label: LIFECYCLE_LABEL[stage.status].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), detail: `${incidentRef(record.incident)} ${record.incident.title}`, tone: 'info', incident: record.incident })
      }
    }
  }
  for (const event of unitEvents) {
    if (event.entity_id !== unit.unit_id || !event.details.service_state) continue
    const after = String(event.details.after_status) as ServiceState
    if (after === 'DEPLOYED') continue
    const reason = typeof event.details.reason === 'string' ? event.details.reason.replace(/\s*\(synthetic\)/i, '') : after === 'AVAILABLE' ? 'Returned to service' : 'Service state recorded'
    entries.push({ key: event.audit_id, time: eventTime(event), label: SERVICE_LABEL[after].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), detail: reason, tone: after === 'AVAILABLE' ? 'muted' : 'critical' })
  }
  return entries.sort((a, b) => a.time - b.time)
}

type TimelineProps = {
  sectionRef: React.RefObject<HTMLElement | null>
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

function UnitTimeline({ sectionRef, units, stationById, readiness, assignments, histories, history, now, selected, selectedStationUnits, onSelectUnit }: TimelineProps) {
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
      label: SERVICE_LABEL[segment.state], detail: segment.state === 'UNRECORDED' ? 'No service state recorded for this interval; availability is not assumed.' : typeof segment.event?.details.reason === 'string' ? segment.event.details.reason : `Recorded ${SERVICE_LABEL[segment.state].toLowerCase()} state`,
    }))
    for (const record of histories) {
      for (const window of record.units.get(unit.unit_id) || []) {
        const stages = clip(record.stages.map((stage) => ({ ...stage, start: Math.max(stage.start, window.start), end: Math.min(stage.end, window.end) })).filter((stage) => stage.end > stage.start), start, Math.min(end, now))
        stages.forEach((stage, index) => bars.push({
          key: `${unit.unit_id}-${record.incident.incident_id}-${stage.start}`, start: stage.start, end: stage.end, kind: 'incident', state: window.inferred ? 'inferred' : STAGE_TONE[stage.status], unit, incident: record.incident, event: stage.event,
          label: index === 0 && stage.status === 'ACTIVE' ? `${incidentRef(record.incident)} ${record.incident.incident_type} – ${record.incident.display_location?.split(',')[0] || record.incident.title}` : `${LIFECYCLE_LABEL[stage.status]} (${duration(stage.start, stage.end)})`,
          detail: `${record.incident.title} · ${LIFECYCLE_LABEL[stage.status]}${window.inferred || stage.untimed ? ' · transition times not recorded' : ''}`,
        }))
      }
    }
    for (const assignment of assignments) {
      if (assignment.unit_id !== unit.unit_id || assignment.assignment_status === 'CANCELLED') continue
      const window = clip([{ start: new Date(assignment.shift_start).getTime(), end: new Date(assignment.shift_end).getTime() }], start, end)[0]
      if (window) bars.push({ key: `${unit.unit_id}-c-${assignment.assignment_id}`, start: window.start, end: window.end, kind: 'crew', state: assignment.assignment_status.toLowerCase(), unit, label: 'CREW WINDOW', detail: `${assignment.assignment_status.replaceAll('_', ' ')} assignment ${clock(assignment.shift_start)}–${clock(assignment.shift_end)}` })
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
    return pool.sort((a, b) => Number(station.has(b.unit_id)) - Number(station.has(a.unit_id)) || stationNumber(stationById.get(a.station_id || '')) - stationNumber(stationById.get(b.station_id || '')) || a.unit_name.localeCompare(b.unit_name))
  }, [units, histories, history.unitEvents, selectedStationUnits, unitScope, start, end, stationById])
  const visible = candidates.filter((unit) => (typeFilter === 'ALL' || groupOf(unit.type) === typeFilter) && (!focusSelected || unit.unit_id === selected?.unit_id))
  const rows = visible.map((unit) => ({ unit, bars: barsFor(unit) }))
  const allBars = rows.flatMap((row) => row.bars)
  const detail = allBars.find((bar) => bar.key === activeBar)
  const notable = rows.flatMap((row) => row.bars.filter((bar) => bar.kind === 'incident' ? bar.label.startsWith('#') : bar.kind === 'service' && bar.event && !['available', 'assigned', 'unrecorded'].includes(bar.state) && bar.start > start))
    .sort((a, b) => b.start - a.start)
    .filter((bar, index, list) => list.findIndex((item) => (item.incident?.incident_id || item.key) === (bar.incident?.incident_id || bar.key)) === index)
  const hourTicks = ticks(start, end)
  const windowLabel = `${clock(start)}–${clock(end)}`

  return <section className="sb-timeline" aria-labelledby="sb-timeline-heading" ref={sectionRef}>
    <header className="sb-timeline-head">
      <h2 id="sb-timeline-heading">UNIT DEPLOYMENT TIMELINE</h2>
      <span className="sb-window">{windowLabel}</span>
      <ul className="sb-legend" aria-label="Timeline legend">{[['available', 'AVAILABLE'], ['assigned', 'ASSIGNED'], ['scene', 'ON SCENE'], ['oos', 'OUT OF SERVICE'], ['unrecorded', 'NO RECORD'], ['maintenance', 'MAINTENANCE'], ['crew', 'CREW WINDOW']].map(([tone, label]) => <li key={tone}><i className={`tone-${tone}`} aria-hidden="true" />{label}</li>)}</ul>
      <div className="sb-time-controls">
        <label><span className="sr-only">Units shown</span><select value={unitScope} onChange={(event) => setUnitScope(event.target.value as TimelineScope)}><option value="FOCUS">Station + activity</option><option value="STATION">Selected station</option><option value="ALL">All units</option></select></label>
        <label><span className="sr-only">Unit type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | Group)}><option value="ALL">All types</option>{GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABEL[group]}</option>)}</select></label>
        <div className="sb-range" role="group" aria-label="Time range">
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Earlier"><ChevronLeft aria-hidden="true" /></button>
          <label><span className="sr-only">Window length</span><select value={range} onChange={(event) => { setRange(event.target.value === 'WATCH' ? 'WATCH' : Number(event.target.value) as Range); setOffset(0) }}><option value="WATCH">Current watch</option>{RANGES.map((value) => <option key={value} value={value}>{value} hours</option>)}</select></label>
          <button type="button" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Later"><ChevronRight aria-hidden="true" /></button>
        </div>
        <button type="button" className={`sb-focus ${focusSelected ? 'is-on' : ''}`} aria-pressed={focusSelected} onClick={() => setFocusSelected(!focusSelected)} disabled={!selected}>Focus {selected?.unit_name || 'unit'}</button>
      </div>
    </header>
    <div className="sb-timeline-body">
      <div className="sb-chart" role="table" aria-label="Recorded unit activity by time" aria-rowcount={rows.length + 1}>
        <div className="sb-chart-head" role="row"><span role="columnheader">UNIT</span><span role="columnheader">TYPE</span><span role="columnheader">STATION</span><span role="columnheader">CREW</span><div role="columnheader" className="sb-ruler" aria-label={`Time ruler ${windowLabel}`}>{hourTicks.filter((tick) => pct(tick) > 2.5 && pct(tick) < 97.5).map((tick) => <span key={tick} style={{ left: `${pct(tick)}%` }}>{clock(tick)}</span>)}</div></div>
        <div className="sb-chart-rows">
          {rows.map(({ unit, bars }) => { const metric = readiness.get(unit.unit_id); const station = stationById.get(unit.station_id || ''); const tone = unitState(unit, metric); return <div role="row" key={unit.unit_id} className={`sb-row ${selected?.unit_id === unit.unit_id ? 'is-selected' : ''}`}>
            <span role="cell"><button type="button" onClick={() => onSelectUnit(unit.unit_id)} aria-label={`Select ${unit.unit_name}`}>{unit.unit_name}</button></span>
            <span role="cell">{typeName(unit)}</span>
            <span role="cell" className={`sb-station-dot state-${tone}`} title={`Station ${stationNumber(station)} · ${serviceWord(unit.operational_status)}`}><i aria-hidden="true" />{stationNumber(station) || '—'}</span>
            <span role="cell">{metric?.staff_present ?? 0}/{metric?.staff_required ?? unit.minimum_staff}</span>
            <div role="cell" className="sb-track">
              {hourTicks.map((tick) => <i key={tick} className="sb-grid" style={{ left: `${pct(tick)}%` }} aria-hidden="true" />)}
              {now > start && now < end && <i className="sb-now" style={{ left: `${pct(now)}%` }} aria-hidden="true" />}
              {bars.filter((bar) => bar.kind !== 'crew').sort((a, b) => Number(a.kind === 'incident') - Number(b.kind === 'incident')).map((bar) => <button type="button" key={bar.key} className={`sb-seg kind-${bar.kind} tone-${bar.state} ${activeBar === bar.key ? 'is-active' : ''}`} style={{ left: `${pct(bar.start)}%`, width: `${Math.max(0.35, pct(bar.end) - pct(bar.start))}%` }} onClick={() => setActiveBar(bar.key)} aria-label={`${unit.unit_name}: ${bar.label}, ${clock(bar.start)} to ${bar.end >= now - 1000 ? 'now' : clock(bar.end)}`}><span>{bar.label}</span></button>)}
              {bars.filter((bar) => bar.kind === 'crew').map((bar) => <button type="button" key={bar.key} className={`sb-crewline status-${bar.state} ${activeBar === bar.key ? 'is-active' : ''}`} style={{ left: `${pct(bar.start)}%`, width: `${Math.max(0.35, pct(bar.end) - pct(bar.start))}%` }} onClick={() => setActiveBar(bar.key)} aria-label={`${unit.unit_name}: ${bar.detail}`} />)}
            </div>
          </div> })}
          {!rows.length && <p className="sb-timeline-empty">{history.loading ? 'Loading recorded activity…' : 'No units match the timeline filters.'}</p>}
        </div>
        <p className="sr-only">Bars show recorded service states and incident lifecycle stages. The thin rule beneath each bar is the crew assignment window. Hatched grey means no record. {rows.length} units shown.</p>
      </div>
      <aside className="sb-events" aria-labelledby="sb-events-heading">
        <h3 id="sb-events-heading">{detail ? 'EVENT DETAIL' : 'NOTABLE EVENTS'}</h3>
        {detail ? <div className="sb-event-detail" role="status">
          <strong>{detail.unit.unit_name} · {detail.kind === 'crew' ? 'CREW WINDOW' : detail.label}</strong>
          <p>{detail.detail}</p>
          <dl><div><dt>FROM</dt><dd>{clock(detail.start)}</dd></div><div><dt>TO</dt><dd>{detail.end >= now - 1000 ? 'Now' : clock(detail.end)}</dd></div><div><dt>LENGTH</dt><dd>{duration(detail.start, detail.end)}</dd></div><div><dt>SOURCE</dt><dd>{detail.event ? `${detail.event.actor} · ${detail.event.audit_id}` : detail.kind === 'crew' ? 'Assignment record' : 'No source event'}</dd></div></dl>
          <div className="sb-event-links">{detail.incident && <Link href={`/readiness?view=incidents&incident=${encodeURIComponent(detail.incident.incident_id)}`}>Open {incidentRef(detail.incident)} <ArrowRight aria-hidden="true" /></Link>}<button type="button" onClick={() => onSelectUnit(detail.unit.unit_id)}>Open {detail.unit.unit_name}</button><button type="button" onClick={() => setActiveBar(null)}>Back to events</button></div>
        </div> : <ol>{notable.slice(0, 12).map((bar) => <li key={bar.key}><button type="button" onClick={() => setActiveBar(bar.key)}><time>{clock(bar.start)}</time><span>{bar.incident ? `${incidentRef(bar.incident)} ${bar.incident.title} – ${bar.incident.display_location?.split(',').slice(-2, -1)[0]?.trim() || ''}` : `${bar.unit.unit_name} ${bar.label}`}</span></button></li>)}{!notable.length && <li className="sb-events-empty">No recorded incident or service events in this window.</li>}</ol>}
      </aside>
    </div>
  </section>
}
