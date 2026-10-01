'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Clock3, Filter, LocateFixed, Sigma, Truck } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import CommandMap from './CommandMap'
import FormDialog from './FormDialog'
import { WarningPictogram } from './Pictograms'
import { WriteButton } from './ui'
import { clip, clock, duration, incidentHistory, incidentRef, LIFECYCLE_LABEL, ticks, type IncidentHistory } from '@/lib/history'
import type { AuditEvent, Incident, OperationsSnapshot, Station, Unit, UnitReadiness } from '@/lib/schemas'

type History = { incidentEvents: AuditEvent[]; unitEvents: AuditEvent[]; baselines: AuditEvent[]; incidents: Incident[]; loading: boolean }
type Props = {
  snapshot?: OperationsSnapshot
  stations: Station[]
  definitions: Unit[]
  history: History
  scope: string
  updating: boolean
  resolving: boolean
  onOpen: () => void
  onUpdate: (incident: Incident) => Promise<void>
  onResolve: (id: string) => void
}
type RegisterView = 'ALL' | 'ACTIVE' | 'RECENT' | Incident['status']
type IncidentType = Incident['incident_type']

const HOUR = 3600000
const TYPES: IncidentType[] = ['FIRE', 'EMS', 'HAZMAT', 'OTHER']
const TYPE_LABEL: Record<IncidentType, string> = { FIRE: 'Fire', EMS: 'EMS', HAZMAT: 'HazMat', OTHER: 'Other' }
const PRIORITY_LABEL: Record<Incident['priority'], string> = { CRITICAL: 'P1 - Critical', HIGH: 'P2 - High', MEDIUM: 'P3 - Medium', LOW: 'P4 - Low' }
const STATUS_WORD: Record<Incident['status'], string> = { ACTIVE: 'Dispatched', ENROUTE: 'Enroute', ON_SCENE: 'On Scene', TRANSPORT: 'Transport', INVESTIGATING: 'Investigating', RESOLVED: 'Closed' }
const UNIT_TYPE: Record<string, string> = { ENGINE: 'Engine', LADDER: 'Ladder', TRUCK: 'Truck', MEDIC: 'Medic', AMBULANCE: 'Ambulance', RESCUE: 'Rescue', TANKER: 'Tanker', COMMAND: 'Command', SAFETY: 'Safety', HAZMAT: 'HazMat', SAR_TEAM: 'SAR Team' }

const street = (incident: Incident) => (incident.display_location || incident.title).split(',')[0]
const city = (incident: Incident) => (incident.display_location || '').split(',').slice(1).join(',').trim()
const statusKey = (incident: Incident) => (incident.is_active ? incident.status : 'RESOLVED').toLowerCase()

export default function IncidentsTheater({ snapshot, stations, definitions, history, scope, updating, resolving, onOpen, onUpdate, onResolve }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const now = snapshot?.timestamp ? new Date(snapshot.timestamp).getTime() : 0
  const [registerView, setRegisterView] = useState<RegisterView>('ALL')
  const [search, setSearch] = useState('')

  const unitById = useMemo(() => new Map(definitions.map((unit) => [unit.unit_id, unit])), [definitions])
  const readiness = useMemo(() => new Map((snapshot?.units || []).map((unit) => [unit.unit_id, unit])), [snapshot?.units])
  const unitName = (id: string) => unitById.get(id)?.unit_name || readiness.get(id)?.unit_name || id.replace(/^unit-/, '').toUpperCase()

  const active = useMemo(() => [...(snapshot?.incidents || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()), [snapshot?.incidents])
  const scopedStations = scope === 'all' ? null : scope
  const recent = useMemo(() => history.incidents
    .filter((incident) => !incident.is_active && (!scopedStations || incident.station_id === scopedStations) && now - new Date(incident.resolved_at || incident.created_at || 0).getTime() < 24 * HOUR)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()), [history.incidents, scopedStations, now])
  // A resolution is terminal: prefer the closed record while the active snapshot catches up.
  const records = useMemo(() => { const closed = new Set(recent.map((incident) => incident.incident_id)); return [...active.filter((incident) => !closed.has(incident.incident_id)), ...recent] }, [active, recent])
  const histories = useMemo(() => new Map(records.map((incident) => [incident.incident_id, incidentHistory(incident, history.incidentEvents, now)])), [records, history.incidentEvents, now])

  const term = search.trim().toLowerCase()
  const register = records.filter((incident) => (registerView === 'ALL' || (registerView === 'ACTIVE' ? incident.is_active : registerView === 'RECENT' ? !incident.is_active : incident.is_active && incident.status === registerView))
    && (!term || `${incidentRef(incident)} ${incident.title} ${incident.display_location || ''} ${incident.incident_type} ${incident.assigned_unit_ids.map(unitName).join(' ')}`.toLowerCase().includes(term)))
  const requestedId = params.get('incident')
  const selected = records.find((incident) => incident.incident_id === requestedId) || active[0] || recent[0]

  const committed = definitions.filter((unit) => unit.operational_status === 'DEPLOYED').length
  const down = definitions.filter((unit) => unit.operational_status === 'OUT_OF_SERVICE' || unit.operational_status === 'MAINTENANCE').length
  const available = definitions.filter((unit) => !unit.is_archived && unit.operational_status === 'AVAILABLE').length
  const count = (status: Incident['status']) => active.filter((incident) => incident.status === status).length
  const oldest = active.reduce((min, incident) => Math.min(min, new Date(incident.created_at || now).getTime()), now)
  const startOfDay = new Date(now).setHours(0, 0, 0, 0)
  const today = records.filter((incident) => new Date(incident.created_at || 0).getTime() >= startOfDay).length

  function select(id: string) {
    const query = new URLSearchParams(params.toString())
    query.set('view', 'incidents')
    query.set('incident', id)
    router.replace(`/readiness?${query}`, { scroll: false })
  }

  return <div className="incidents-theater">
    <section className="it-instruments" aria-label="Incident operations register">
      <div className="it-instrument it-counts"><h2>INCIDENTS</h2><div><WarningPictogram className="it-warning" /><p><strong>{active.length}</strong><span>ACTIVE</span></p><p className="it-c-scene"><strong>{count('ON_SCENE')}</strong><span>ON SCENE</span></p><p className="it-c-enroute"><strong>{count('ENROUTE')}</strong><span>ENROUTE</span></p><p className="it-c-transport"><strong>{count('TRANSPORT')}</strong><span>TRANSPORT</span></p><p><strong>{count('ACTIVE') + count('INVESTIGATING')}</strong><span>OTHER</span></p></div></div>
      <div className="it-instrument it-units"><h2>UNIT AVAILABILITY (ALL TYPES)</h2><div><Truck className="it-icon" aria-hidden="true" /><p><strong>{available}</strong><span>AVAILABLE</span></p><p><strong>{committed}</strong><span>COMMITTED</span></p><p className="it-c-critical"><strong>{down}</strong><span>OUT OF SERVICE</span></p></div></div>
      <div className="it-instrument it-single"><h2>LONGEST OPEN</h2><div><Clock3 className="it-icon" aria-hidden="true" /><p><strong>{active.length ? duration(oldest, now).replace(/h /, ':').replace('m', '') : '—'}</strong><span>(ELAPSED{active.length ? ', H:MM' : ''})</span></p></div></div>
      <div className="it-instrument it-single"><h2>TOTAL INCIDENTS</h2><div><Sigma className="it-icon" aria-hidden="true" /><p><strong>{today}</strong><span>(TODAY)</span></p></div></div>
    </section>

    <div className="it-main">
      <CommandMap mode="incidents" stations={stations} units={snapshot?.units || []} incidents={register} scope={scope} selectedIncidentId={selected?.incident_id} onIncidentSelect={select} />
      <div className="it-right">
        <section className="it-register" aria-labelledby="it-register-heading">
          <header className="it-heading"><h2 id="it-register-heading">INCIDENT REGISTER</h2><label className="it-search"><span className="sr-only">Search incidents</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" /></label><Filter className="it-filter-icon" aria-hidden="true" /><label><span className="sr-only">Register view</span><select value={registerView} onChange={(event) => setRegisterView(event.target.value as RegisterView)}><option value="ALL">All incidents</option><option value="ACTIVE">Active only</option><option value="RECENT">Recent closed</option><option value="ENROUTE">Enroute</option><option value="ON_SCENE">On scene</option><option value="TRANSPORT">Transport</option><option value="INVESTIGATING">Investigating</option></select></label><WriteButton variant="ghost" className="it-open" onClick={onOpen} aria-label="Open incident">+ Open</WriteButton></header>
          <div className="it-register-scroll"><table>
            <caption className="sr-only">Active and recently closed synthetic incidents. Choose a row to select it on the map, worksheet, and timeline.</caption>
            <thead><tr><th scope="col">#</th><th scope="col">TIME</th><th scope="col">TYPE</th><th scope="col">LOCATION / ADDRESS</th><th scope="col">UNITS</th><th scope="col">STATUS</th></tr></thead>
            <tbody>{register.map((incident) => { const isSelected = selected?.incident_id === incident.incident_id; return <tr key={incident.incident_id} className={isSelected ? 'is-selected' : ''} aria-selected={isSelected} onClick={() => select(incident.incident_id)}>
              <th scope="row"><button type="button" onClick={(event) => { event.stopPropagation(); select(incident.incident_id) }} aria-label={`Select ${incidentRef(incident)}, ${incident.incident_type} at ${incident.display_location || incident.title}`}>{incidentRef(incident)}</button></th>
              <td>{clock(incident.created_at)}</td>
              <td className={`it-type type-${incident.incident_type.toLowerCase()}`}>{incident.incident_type}</td>
              <td><span className="it-two-line">{street(incident)}<small>{city(incident) || incident.title}</small></span><span className="sr-only"> · {incident.title}</span></td>
              <td className="it-units-cell">{incident.assigned_unit_ids.map(unitName).join(' ') || '—'}</td>
              <td><span className={`it-stamp status-${statusKey(incident)}`}>{(incident.is_active ? LIFECYCLE_LABEL[incident.status] : 'CLOSED')}</span></td>
            </tr> })}</tbody>
          </table>{!register.length && <p className="it-empty">No incidents match this register view or search.</p>}</div>
        </section>
        {selected ? <IncidentWorksheet key={selected.incident_id} incident={selected} record={histories.get(selected.incident_id)} units={snapshot?.units || []} unitName={unitName} updating={updating} resolving={resolving} onUpdate={onUpdate} onResolve={onResolve} /> : <section className="it-sheet"><p className="it-empty">Select an incident to review its worksheet.</p></section>}
      </div>
    </div>

    <div className="it-bottom">
      <IncidentTimeline records={records} histories={histories} selectedId={selected?.incident_id} onSelect={select} now={now} unitName={unitName} />
      <UnitPosture selected={selected} record={selected ? histories.get(selected.incident_id) : undefined} active={active} histories={histories} unitById={unitById} readiness={readiness} unitName={unitName} />
    </div>
    <footer className="it-provenance"><span>UNOFFICIAL CONCEPT · SYNTHETIC OPERATIONS · PUBLIC STATION GEOGRAPHY</span><span>FAIRFAX COUNTY FIRE AND RESCUE <i aria-hidden="true" /> INCIDENTS <i aria-hidden="true" /> v1.0</span></footer>
  </div>
}

function IncidentWorksheet({ incident, record, units, unitName, updating, resolving, onUpdate, onResolve }: {
  incident: Incident; record?: IncidentHistory; units: UnitReadiness[]; unitName: (id: string) => string; updating: boolean; resolving: boolean; onUpdate: Props['onUpdate']; onResolve: Props['onResolve']
}) {
  const [draft, setDraft] = useState({ incident_type: incident.incident_type, priority: incident.priority, status: incident.status, display_location: incident.display_location || '', description: incident.description || '' })
  const [assignOpen, setAssignOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [assignedIds, setAssignedIds] = useState(incident.assigned_unit_ids)
  const [unitSearch, setUnitSearch] = useState('')
  const closed = !incident.is_active
  const dirty = Object.entries(draft).some(([key, value]) => value !== (incident[key as keyof Incident] || ''))
  const lastEvent = record?.stages[record.stages.length - 1]?.event?.created_at || incident.resolved_at || incident.created_at
  const filteredUnits = [...units].sort((a, b) => Number(assignedIds.includes(b.unit_id)) - Number(assignedIds.includes(a.unit_id)) || a.unit_name.localeCompare(b.unit_name)).filter((unit) => `${unit.unit_name} ${unit.unit_type}`.toLowerCase().includes(unitSearch.toLowerCase()))

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { await onUpdate({ ...incident, ...draft }) } catch { /* The parent notice carries the API error. */ }
  }
  async function saveUnits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { await onUpdate({ ...incident, ...draft, assigned_unit_ids: assignedIds, unit_id: assignedIds[0] || null }); setAssignOpen(false) } catch { /* The parent notice carries the API error. */ }
  }
  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entry = `[${clock(Date.now())}] ${note.trim()}`
    const description = [draft.description.trim(), entry].filter(Boolean).join('\n').slice(-500)
    try { await onUpdate({ ...incident, ...draft, description }); setDraft({ ...draft, description }); setNote(''); setNoteOpen(false) } catch { /* The parent notice carries the API error. */ }
  }
  function resolve() {
    if (window.confirm(`Resolve ${incidentRef(incident)} (${incident.title})? Unit assignment windows close at the resolution time, and the resolution is added to the audit history.`)) onResolve(incident.incident_id)
  }
  function locate() {
    const marker = document.querySelector<SVGGElement>('.map-incident-selected')
    marker?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    marker?.focus({ preventScroll: true })
  }

  return <><section className="it-sheet" aria-labelledby="it-sheet-heading">
    <header className="it-heading"><h2 id="it-sheet-heading">SELECTED INCIDENT</h2><p><strong>INCIDENT {incidentRef(incident)}</strong><span>{closed ? `CLOSED ${clock(incident.resolved_at)}` : `UPDATED ${clock(lastEvent)}`}</span></p></header>
    <form onSubmit={save}>
      <fieldset disabled={closed}>
        <label className="it-f-type">TYPE<select value={draft.incident_type} onChange={(event) => setDraft({ ...draft, incident_type: event.target.value as IncidentType })}>{TYPES.map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}</select></label>
        <label className="it-f-priority">PRIORITY<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Incident['priority'] })}>{(Object.keys(PRIORITY_LABEL) as Incident['priority'][]).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>)}</select></label>
        <label className={`it-f-status status-${draft.status.toLowerCase()}`}>STATUS<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Incident['status'] })}>{(['ACTIVE', 'ENROUTE', 'ON_SCENE', 'TRANSPORT', 'INVESTIGATING'] as const).map((status) => <option key={status} value={status}>{STATUS_WORD[status]}</option>)}{closed && <option value="RESOLVED">Closed</option>}</select></label>
        <label className="it-f-location">LOCATION / ADDRESS<span><input value={draft.display_location} onChange={(event) => setDraft({ ...draft, display_location: event.target.value })} required /><button type="button" onClick={locate} aria-label="Show this incident on the map"><LocateFixed aria-hidden="true" /></button></span></label>
        <label className="it-f-notes">NOTES<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} /><small>{draft.description.length}/500</small></label>
      </fieldset>
      <div className="it-actions">
        <WriteButton type="submit" className="it-save" disabled={!dirty || closed} busy={updating}>SAVE CHANGES</WriteButton>
        <WriteButton type="button" variant="ghost" onClick={() => setNoteOpen(true)} disabled={closed}>ADD NOTE</WriteButton>
        <WriteButton type="button" variant="ghost" onClick={() => setAssignOpen(true)} disabled={closed}>ASSIGN UNITS</WriteButton>
        <WriteButton type="button" variant="danger" className="it-resolve" onClick={resolve} busy={resolving} disabled={closed}><Check aria-hidden="true" />{closed ? 'RESOLVED' : 'RESOLVE INCIDENT'}</WriteButton>
      </div>
    </form>
  </section>
  <FormDialog open={assignOpen} onOpenChange={setAssignOpen} title={`Assign units · ${incidentRef(incident)}`} description={`Currently assigned: ${incident.assigned_unit_ids.map(unitName).join(', ') || 'none'}. Changes are recorded with timestamps in the incident history.`} submitLabel="Save unit assignments" submitting={updating} onSubmit={saveUnits}><label className="theater-assignment-search">Search units<input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Unit name or type" /></label><div className="theater-assignment-list">{filteredUnits.map((unit) => <label key={unit.unit_id}><input type="checkbox" checked={assignedIds.includes(unit.unit_id)} onChange={(event) => setAssignedIds(event.target.checked ? [...assignedIds, unit.unit_id] : assignedIds.filter((id) => id !== unit.unit_id))} /><span>{unit.unit_name}<small>{UNIT_TYPE[unit.unit_type] || unit.unit_type.replaceAll('_', ' ')} · {unit.readiness_score}% readiness</small></span></label>)}</div></FormDialog>
  <FormDialog open={noteOpen} onOpenChange={setNoteOpen} title={`Add note · ${incidentRef(incident)}`} description="The note is appended to the incident notes with the current time and saved to the record." submitLabel="Add note" submitting={updating} onSubmit={saveNote}><label className="theater-assignment-search">Note<textarea className="form-control min-h-24" value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} required /></label></FormDialog></>
}

const SPANS = [2, 4, 8, 12] as const
const STAGE_CODE: Record<Incident['status'], string> = { ACTIVE: 'DSP', ENROUTE: 'ENR', ON_SCENE: 'ONS', TRANSPORT: 'TRN', INVESTIGATING: 'INV', RESOLVED: 'CLR' }

function IncidentTimeline({ records, histories, selectedId, onSelect, now, unitName }: { records: Incident[]; histories: Map<string, IncidentHistory>; selectedId?: string; onSelect: (id: string) => void; now: number; unitName: (id: string) => string }) {
  const [span, setSpan] = useState<(typeof SPANS)[number]>(4)
  const [offset, setOffset] = useState(0)
  const [types, setTypes] = useState<Record<IncidentType, boolean>>({ FIRE: true, EMS: true, HAZMAT: true, OTHER: true })
  const [showUnits, setShowUnits] = useState(false)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const end = now + span * HOUR * 0.08 - offset * span * HOUR / 2
  const start = end - span * HOUR
  const pct = (value: number) => Math.max(0, Math.min(100, (value - start) / (end - start) * 100))
  const rows = records
    .filter((incident) => types[incident.incident_type])
    .map((incident) => histories.get(incident.incident_id))
    .filter((record): record is IncidentHistory => Boolean(record) && record!.stages.some((stage) => stage.end > start && stage.start < end))
    .sort((a, b) => Number(b.incident.incident_id === selectedId) - Number(a.incident.incident_id === selectedId) || overlap(b) - overlap(a))
  function overlap(record: IncidentHistory) { return clip(record.stages, start, end).reduce((sum, stage) => sum + stage.end - stage.start, 0) }
  const hourTicks = ticks(start, end)
  const segments = rows.flatMap((record) => clip(record.stages, start, end).map((stage) => ({ key: `${record.incident.incident_id}-${stage.start}`, record, stage })))
  const unitSegments = showUnits ? rows.flatMap((record) => Array.from(record.units).flatMap(([unitId, windows]) => clip(windows, start, end).map((window) => ({ key: `${record.incident.incident_id}-${unitId}-${window.start}`, record, unitId, window })))) : []
  const detail = segments.find((item) => item.key === detailKey)
  const unitDetail = unitSegments.find((item) => item.key === detailKey)
  const dateLabel = new Date(start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()

  return <section className="it-timeline" aria-labelledby="it-timeline-heading">
    <header className="it-heading it-timeline-head">
      <h2 id="it-timeline-heading">EVENT TIMELINE</h2>
      <div className="it-span" role="group" aria-label="Timeline window"><button type="button" onClick={() => setOffset(offset + 1)} aria-label="Earlier"><ChevronLeft aria-hidden="true" /></button><label><span className="sr-only">Window length</span><select value={span} onChange={(event) => { setSpan(Number(event.target.value) as (typeof SPANS)[number]); setOffset(0) }}>{SPANS.map((value) => <option key={value} value={value}>{value} HOURS</option>)}</select></label><button type="button" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={!offset} aria-label="Later"><ChevronRight aria-hidden="true" /></button></div>
      <span className="it-date">{dateLabel}<b>{clock(start)} – {clock(end)}</b></span>
      <fieldset className="it-types"><legend className="sr-only">Incident types</legend>{TYPES.map((type) => <label key={type} className={`type-${type.toLowerCase()}`}><input type="checkbox" checked={types[type]} onChange={(event) => setTypes({ ...types, [type]: event.target.checked })} />{TYPE_LABEL[type]}</label>)}<label className="it-unit-toggle"><input type="checkbox" checked={showUnits} onChange={(event) => setShowUnits(event.target.checked)} />Unit activity</label></fieldset>
    </header>
    <div className="it-ruler" aria-hidden="true"><span />{hourTicks.map((tick) => <b key={tick} style={{ left: `${pct(tick)}%` }}>{pct(tick) > 1.5 && pct(tick) < 98.5 ? clock(tick) : ''}</b>)}</div>
    <div className="it-rows" role="group" aria-label="Recorded incident lifecycle stages">
      {rows.map((record) => { const incident = record.incident; const isSelected = incident.incident_id === selectedId; return <div key={incident.incident_id} className={`it-row-group ${isSelected ? 'is-selected' : ''}`}>
        <div className="it-row"><button type="button" className="it-row-label" onClick={() => onSelect(incident.incident_id)} aria-pressed={isSelected}>{incidentRef(incident)}</button><div className="it-track">{hourTicks.map((tick) => <i key={tick} style={{ left: `${pct(tick)}%` }} aria-hidden="true" />)}{now > start && now < end && <i className="it-now" style={{ left: `${pct(now)}%` }} aria-hidden="true" />}
          {clip(record.stages, start, end).map((stage) => { const key = `${incident.incident_id}-${stage.start}`; return <button type="button" key={key} className={`it-seg type-${incident.incident_type.toLowerCase()} stage-${stage.status.toLowerCase()} ${stage.untimed ? 'is-untimed' : ''} ${detailKey === key ? 'is-active' : ''}`} style={{ left: `${pct(stage.start)}%`, width: `${Math.max(0.4, pct(stage.end) - pct(stage.start))}%` }} onClick={() => { setDetailKey(key); onSelect(incident.incident_id) }} aria-label={`${incidentRef(incident)} ${LIFECYCLE_LABEL[stage.status]} from ${clock(stage.start)} to ${stage.end >= now - 1000 ? 'now' : clock(stage.end)}`}><span>{pct(stage.end) - pct(stage.start) >= 11 ? LIFECYCLE_LABEL[stage.status] : pct(stage.end) - pct(stage.start) >= 4.2 ? STAGE_CODE[stage.status] : ''}</span></button> })}
          {!incident.is_active && incident.resolved_at && new Date(incident.resolved_at).getTime() > start && new Date(incident.resolved_at).getTime() < end && <span className="it-closed-mark" style={{ left: `${pct(new Date(incident.resolved_at).getTime())}%` }} title={`Resolved ${clock(incident.resolved_at)}`} />}
        </div></div>
        {showUnits && Array.from(record.units).map(([unitId, windows]) => <div className="it-row it-unit-row" key={unitId}><span className="it-row-label">{unitName(unitId)}</span><div className="it-track">{clip(windows, start, end).map((window) => { const key = `${incident.incident_id}-${unitId}-${window.start}`; return <button type="button" key={key} className={`it-unit-seg ${window.inferred ? 'is-untimed' : ''} ${detailKey === key ? 'is-active' : ''}`} style={{ left: `${pct(window.start)}%`, width: `${Math.max(0.4, pct(window.end) - pct(window.start))}%` }} onClick={() => setDetailKey(key)} aria-label={`${unitName(unitId)} assigned to ${incidentRef(incident)} from ${clock(window.start)} to ${window.end >= now - 1000 ? 'now' : clock(window.end)}`}><span>{unitName(unitId)} · ASSIGNED</span></button> })}</div></div>)}
      </div> })}
      {!rows.length && <p className="it-empty">No recorded incident activity in this window and type filter.</p>}
    </div>
    <p className="it-detail" role="status">{detail ? <>{incidentRef(detail.record.incident)} · <b>{LIFECYCLE_LABEL[detail.stage.status]}</b> · {clock(detail.stage.start)}–{detail.stage.end >= now - 1000 ? 'now' : clock(detail.stage.end)} ({duration(detail.stage.start, detail.stage.end)}) · {detail.stage.event ? `recorded by ${detail.stage.event.actor} · ${detail.stage.event.audit_id}` : 'transition times not recorded'}</> : unitDetail ? <>{unitName(unitDetail.unitId)} · assigned to {incidentRef(unitDetail.record.incident)} · {clock(unitDetail.window.start)}–{unitDetail.window.end >= now - 1000 ? 'now' : clock(unitDetail.window.end)} ({duration(unitDetail.window.start, unitDetail.window.end)}){unitDetail.window.inferred ? ' · assignment time not recorded' : ''}</> : 'Select a stage for its recorded time and source. Bars show recorded lifecycle stages, not response or travel time.'}</p>
  </section>
}

type PostureTab = 'APPARATUS' | 'STAFF' | 'COMMITTED'

function UnitPosture({ selected, record, active, histories, unitById, readiness, unitName }: { selected?: Incident; record?: IncidentHistory; active: Incident[]; histories: Map<string, IncidentHistory>; unitById: Map<string, Unit>; readiness: Map<string, UnitReadiness>; unitName: (id: string) => string }) {
  const [tab, setTab] = useState<PostureTab>('APPARATUS')
  const rowsFor = (incident: Incident, entry?: IncidentHistory) => {
    const ids = new Set([...incident.assigned_unit_ids, ...(entry ? Array.from(entry.units.keys()) : [])])
    return Array.from(ids).map((unitId) => {
      const current = incident.is_active && incident.assigned_unit_ids.includes(unitId)
      const status = current ? STATUS_WORD[incident.status] : incident.is_active ? 'Released' : 'Cleared'
      const tone = current ? incident.status.toLowerCase() : 'resolved'
      return { unitId, incident, status, tone }
    })
  }
  const apparatus = selected ? rowsFor(selected, record) : []
  const committed = active.flatMap((incident) => rowsFor(incident, histories.get(incident.incident_id)).filter((row) => row.tone !== 'resolved' && row.status !== 'Released'))
  const staff = apparatus.flatMap((row) => (readiness.get(row.unitId)?.assigned_personnel || []).map((person) => ({ ...person, unitId: row.unitId })))
  const others = committed.filter((row) => !apparatus.some((item) => item.unitId === row.unitId))
  const list = tab === 'COMMITTED' ? committed : apparatus

  return <section className="it-posture" aria-labelledby="it-posture-heading">
    <header className="it-heading"><h2 id="it-posture-heading">UNIT POSTURE</h2><div className="it-tabs" role="tablist" aria-label="Unit posture view">{([['APPARATUS', 'APPARATUS'], ['STAFF', 'STAFF'], ['COMMITTED', 'ALL COMMITTED']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}</div></header>
    <div className="it-posture-scroll" role="tabpanel">
      {tab === 'STAFF' ? <table><thead><tr><th scope="col">UNIT</th><th scope="col">NAME</th><th scope="col">ROLE</th><th scope="col">QUALIFICATIONS</th></tr></thead><tbody>{staff.map((person) => <tr key={`${person.unitId}-${person.personnel_id}`}><td><Link href={`/readiness?view=units&unit=${encodeURIComponent(person.unitId)}`}>{unitName(person.unitId)}</Link></td><td>{person.name}</td><td>{person.role}</td><td>{person.certifications.slice(0, 3).join(' · ')}</td></tr>)}</tbody></table>
        : <table><thead><tr><th scope="col">UNIT</th><th scope="col">TYPE</th><th scope="col">STATUS</th><th scope="col">LOCATION / ASSIGNMENT</th></tr></thead><tbody>{list.map((row) => { const unit = unitById.get(row.unitId); return <tr key={`${row.incident.incident_id}-${row.unitId}`}><td><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unitId)}`} aria-label={`Open unit record ${unitName(row.unitId)}`}>{unitName(row.unitId)}</Link></td><td>{unit ? UNIT_TYPE[unit.type] || unit.type : '—'}</td><td><span className={`it-pill status-${row.tone}`}>{row.status}</span></td><td>{incidentRef(row.incident)} {street(row.incident)}</td></tr> })}{tab === 'APPARATUS' && others.length > 0 && <><tr className="it-posture-divider"><th scope="rowgroup" colSpan={4}>OTHER COMMITTED UNITS</th></tr>{others.map((row) => { const unit = unitById.get(row.unitId); return <tr key={`other-${row.incident.incident_id}-${row.unitId}`} className="is-other"><td><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unitId)}`}>{unitName(row.unitId)}</Link></td><td>{unit ? UNIT_TYPE[unit.type] || unit.type : '—'}</td><td><span className={`it-pill status-${row.tone}`}>{row.status}</span></td><td>{incidentRef(row.incident)} {street(row.incident)}</td></tr> })}</>}</tbody></table>}
      {((tab === 'STAFF' && !staff.length) || (tab !== 'STAFF' && !list.length)) && <p className="it-empty">{selected ? 'No units recorded for this view.' : 'Select an incident to review its assigned units.'}</p>}
    </div>
  </section>
}
