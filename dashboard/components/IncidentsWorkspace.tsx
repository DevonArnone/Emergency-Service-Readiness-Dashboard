'use client'

import { Check, ChevronLeft, ChevronRight, LocateFixed, NotebookPen, Plus, Truck } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from './ConfirmAction'
import CountyMap, { type MapLayer } from './CountyMap'
import FormDialog from './FormDialog'
import { EmptyState, InlineError, Inspector, InspectorBody, InspectorFooter, InspectorHeader, PageHeader, Panel, SearchInput, Section, StatusBadge, SummaryStrip, WriteButton, type StatusTone } from './ui'
import { clip, clock, duration, incidentHistory, incidentRef, LIFECYCLE_LABEL, ticks, type IncidentHistory } from '@/lib/history'
import type { AuditEvent, Incident, OperationsSnapshot, Station, Unit, UnitReadiness } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import styles from './ops.module.css'

type History = { incidentEvents: AuditEvent[]; unitEvents: AuditEvent[]; baselines: AuditEvent[]; incidents: Incident[]; loading: boolean }
type Props = {
  snapshot?: OperationsSnapshot
  stations: Station[]
  definitions: Unit[]
  history: History
  scope: string
  loading: boolean
  updating: boolean
  resolving: boolean
  actionError?: { key: string; message: string } | null
  onOpen: () => void
  onUpdate: (incident: Incident) => Promise<void>
  onResolve: (id: string) => Promise<unknown>
}
type RegisterView = 'ALL' | 'ACTIVE' | 'RECENT' | Incident['status']
type IncidentType = Incident['incident_type']
type Pane = 'register' | 'map' | 'timeline'

const HOUR = 3600000
const TYPES: IncidentType[] = ['FIRE', 'EMS', 'HAZMAT', 'OTHER']
const TYPE_LABEL: Record<IncidentType, string> = { FIRE: 'Fire', EMS: 'EMS', HAZMAT: 'HazMat', OTHER: 'Other' }
const PRIORITY_LABEL: Record<Incident['priority'], string> = { CRITICAL: 'P1 – Critical', HIGH: 'P2 – High', MEDIUM: 'P3 – Medium', LOW: 'P4 – Low' }
const STATUS_WORD: Record<Incident['status'], string> = { ACTIVE: 'Dispatched', ENROUTE: 'Enroute', ON_SCENE: 'On scene', TRANSPORT: 'Transport', INVESTIGATING: 'Investigating', RESOLVED: 'Closed' }
const UNIT_TYPE: Record<string, string> = { ENGINE: 'Engine', LADDER: 'Ladder', TRUCK: 'Truck', MEDIC: 'Medic', AMBULANCE: 'Ambulance', RESCUE: 'Rescue', TANKER: 'Tanker', COMMAND: 'Command', SAFETY: 'Safety', HAZMAT: 'HazMat', SAR_TEAM: 'SAR Team' }
const PANES: Array<[Pane, string]> = [['register', 'Register'], ['map', 'Map'], ['timeline', 'Timeline']]

const street = (incident: Incident) => (incident.display_location || incident.title).split(',')[0]
const city = (incident: Incident) => (incident.display_location || '').split(',').slice(1).join(',').trim()
const statusKey = (incident: Incident) => (incident.is_active ? incident.status : 'RESOLVED').toLowerCase()
const statusLabel = (incident: Incident) => incident.is_active ? STATUS_WORD[incident.status] : 'Closed'
export const incidentStatusTone = (incident: Pick<Incident, 'is_active' | 'status'>): StatusTone => !incident.is_active ? 'neutral' : incident.status === 'ON_SCENE' ? 'danger' : incident.status === 'ENROUTE' || incident.status === 'TRANSPORT' ? 'warning' : 'info'

export default function IncidentsWorkspace({ snapshot, stations, definitions, history, scope, loading, updating, resolving, actionError, onOpen, onUpdate, onResolve }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const now = snapshot?.timestamp ? new Date(snapshot.timestamp).getTime() : 0
  const [registerView, setRegisterView] = useState<RegisterView>('ALL')
  const [search, setSearch] = useState('')
  const [layers, setLayers] = useState<Record<MapLayer, boolean>>({ stations: false, incidents: true, risk: false })
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(params.get('incident')))
  const pane: Pane = PANES.some(([value]) => value === params.get('pane')) ? params.get('pane') as Pane : 'register'

  const unitById = useMemo(() => new Map(definitions.map((unit) => [unit.unit_id, unit])), [definitions])
  const readiness = useMemo(() => new Map((snapshot?.units || []).map((unit) => [unit.unit_id, unit])), [snapshot?.units])
  const unitName = (id: string) => unitById.get(id)?.unit_name || readiness.get(id)?.unit_name || id.replace(/^unit-/, '').toUpperCase()

  const active = useMemo(() => [...(snapshot?.incidents || [])].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()), [snapshot?.incidents])
  const scopedStation = scope === 'all' ? null : scope
  const recent = useMemo(() => history.incidents
    .filter((incident) => !incident.is_active && (!scopedStation || incident.station_id === scopedStation) && now - new Date(incident.resolved_at || incident.created_at || 0).getTime() < 24 * HOUR)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()), [history.incidents, scopedStation, now])
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

  function replace(changes: Record<string, string>) {
    const query = new URLSearchParams(params.toString())
    query.set('view', 'incidents')
    for (const [key, value] of Object.entries(changes)) query.set(key, value)
    if (query.get('pane') === 'register') query.delete('pane')
    router.replace(`/readiness?${query}`, { scroll: false })
  }
  function select(id: string) {
    setInspectorOpen(true)
    replace({ incident: id })
  }

  return (
    <div className="ui-page" data-view="incidents">
      <PageHeader title="Incidents" description="Active and recently closed incidents in the current scope. Select one to review and update its record." actions={<WriteButton variant="primary" onClick={onOpen} aria-label="Open incident"><Plus aria-hidden="true" />Open incident</WriteButton>} />
      <SummaryStrip label="Incident summary" items={[
        { label: 'Active incidents', value: snapshot ? active.length : '—', detail: `${count('ON_SCENE')} on scene · ${count('ENROUTE')} enroute · ${count('TRANSPORT')} transport · ${count('ACTIVE') + count('INVESTIGATING')} other` },
        { label: 'Units available', value: definitions.length ? available : '—', detail: `${committed} committed · ${down} out of service`, tone: down ? 'warn' : undefined },
        { label: 'Longest open', value: active.length ? duration(oldest, now) : '—', detail: active.length ? 'elapsed since opening' : 'no active incidents' },
        { label: 'Opened today', value: snapshot ? today : '—', detail: 'active and closed in the last 24 hours' },
      ]} />

      <div className="ui-toolbar">
        <div className="ui-segmented" role="tablist" aria-label="Incident views">
          {PANES.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pane === value} onClick={() => replace({ pane: value })}>{label}</button>)}
        </div>
        <SearchInput label="Search incidents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, location, type, or unit" />
        <label className="ui-inline-field"><span>Show</span>
          <select className="ui-select" aria-label="Register view" value={registerView} onChange={(event) => setRegisterView(event.target.value as RegisterView)}>
            <option value="ALL">All incidents</option><option value="ACTIVE">Active only</option><option value="RECENT">Recent closed</option>
            <option value="ENROUTE">Enroute</option><option value="ON_SCENE">On scene</option><option value="TRANSPORT">Transport</option><option value="INVESTIGATING">Investigating</option>
          </select>
        </label>
      </div>

      <div className="ui-workspace" data-inspector="true">
        <div className={styles.main}>
          {pane === 'register' && (
            <Panel title="Incident register" description={`${register.length} of ${records.length} incidents · active and closed in the last 24 hours`} flush>
              <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Incident register">
                <table className="ui-table" data-ui="incident-register">
                  <caption className="sr-only">Active and recently closed synthetic incidents. Choose a row to open its record.</caption>
                  <thead><tr><th scope="col">Incident</th><th scope="col">Opened</th><th scope="col">Type</th><th scope="col">Location</th><th scope="col">Units</th><th scope="col">Status</th></tr></thead>
                  <tbody>{register.map((incident) => {
                    const isSelected = selected?.incident_id === incident.incident_id
                    return (
                      <tr key={incident.incident_id} data-selectable="true" aria-selected={isSelected} onClick={() => select(incident.incident_id)}>
                        <th scope="row"><button type="button" className="ui-row-button ui-mono" onClick={(event) => { event.stopPropagation(); select(incident.incident_id) }} aria-label={`Select ${incidentRef(incident)}, ${incident.incident_type} at ${incident.display_location || incident.title}`}>{incidentRef(incident)}</button></th>
                        <td className="ui-mono">{clock(incident.created_at)}</td>
                        <td><span className={styles.type} data-type={incident.incident_type.toLowerCase()}><i aria-hidden="true" />{TYPE_LABEL[incident.incident_type]}</span></td>
                        <td>{street(incident)}<small>{city(incident) || incident.title}</small><span className="sr-only"> · {incident.title}</span></td>
                        <td className="ui-mono" style={{ fontSize: '0.8125rem' }}>{incident.assigned_unit_ids.map(unitName).join(' ') || '—'}</td>
                        <td><span data-ui="incident-status" data-status={statusKey(incident)}><StatusBadge tone={incidentStatusTone(incident)}>{statusLabel(incident)}</StatusBadge></span></td>
                      </tr>
                    )
                  })}</tbody>
                </table>
                {!register.length && <p className="ui-empty-inline">{loading ? 'Loading incident records…' : 'No incidents match this register view or search.'}</p>}
              </div>
            </Panel>
          )}
          {pane === 'map' && (
            <CountyMap title="County incident plot" mode="incidents" stations={stations} units={snapshot?.units || []} incidents={register} scope={scope} layers={layers}
              onToggleLayer={(layer) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))} selectedIncidentId={selected?.incident_id} onIncidentSelect={select} />
          )}
          {pane === 'timeline' && <IncidentTimeline records={records} histories={histories} selectedId={selected?.incident_id} onSelect={select} now={now} unitName={unitName} />}
        </div>

        <Inspector label="Incident record" open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)} recordKey={selected?.incident_id}>
          {selected
            ? <IncidentRecord key={selected.incident_id} incident={selected} record={histories.get(selected.incident_id)} active={active} histories={histories} units={snapshot?.units || []} unitById={unitById} readiness={readiness} unitName={unitName} now={now} updating={updating} resolving={resolving} actionError={actionError?.key === selected.incident_id ? actionError.message : undefined} onUpdate={onUpdate} onResolve={onResolve} onLocate={() => { replace({ pane: 'map' }); setInspectorOpen(false) }} />
            : <EmptyState title={loading ? 'Loading incidents' : 'No incident selected'} description={loading ? 'Incident records are loading.' : 'Select an incident in the register, on the map, or on the timeline to review its record.'} />}
        </Inspector>
      </div>
      <p className="ui-provenance">Unofficial concept · synthetic incidents · public station geography. Not a dispatch record.</p>
    </div>
  )
}

type PostureTab = 'APPARATUS' | 'STAFF' | 'COMMITTED'

function IncidentRecord({ incident, record, active, histories, units, unitById, readiness, unitName, now, updating, resolving, actionError, onUpdate, onResolve, onLocate }: {
  incident: Incident; record?: IncidentHistory; active: Incident[]; histories: Map<string, IncidentHistory>; units: UnitReadiness[]; unitById: Map<string, Unit>; readiness: Map<string, UnitReadiness>
  unitName: (id: string) => string; now: number; updating: boolean; resolving: boolean; actionError?: string; onUpdate: Props['onUpdate']; onResolve: Props['onResolve']; onLocate: () => void
}) {
  const [draft, setDraft] = useState({ incident_type: incident.incident_type, priority: incident.priority, status: incident.status, display_location: incident.display_location || '', description: incident.description || '' })
  const [assignOpen, setAssignOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [note, setNote] = useState('')
  const [assignedIds, setAssignedIds] = useState(incident.assigned_unit_ids)
  const [unitSearch, setUnitSearch] = useState('')
  const [dialogError, setDialogError] = useState<string>()
  const [tab, setTab] = useState<PostureTab>('APPARATUS')
  const closed = !incident.is_active
  const dirty = Object.entries(draft).some(([key, value]) => value !== (incident[key as keyof Incident] || ''))
  const lastEvent = record?.stages[record.stages.length - 1]?.event?.created_at || incident.resolved_at || incident.created_at
  const filteredUnits = [...units].sort((a, b) => Number(assignedIds.includes(b.unit_id)) - Number(assignedIds.includes(a.unit_id)) || a.unit_name.localeCompare(b.unit_name)).filter((unit) => `${unit.unit_name} ${unit.unit_type}`.toLowerCase().includes(unitSearch.toLowerCase()))
  const failure = (error: unknown) => setDialogError(error instanceof Error ? error.message : 'The change could not be saved.')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { await onUpdate({ ...incident, ...draft }) } catch { /* The message appears beside the action. */ }
  }
  async function saveUnits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDialogError(undefined)
    try { await onUpdate({ ...incident, ...draft, assigned_unit_ids: assignedIds, unit_id: assignedIds[0] || null }); setAssignOpen(false) } catch (error) { failure(error) }
  }
  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDialogError(undefined)
    const entry = `[${clock(Date.now())}] ${note.trim()}`
    const description = [draft.description.trim(), entry].filter(Boolean).join('\n').slice(-500)
    try { await onUpdate({ ...incident, ...draft, description }); setDraft({ ...draft, description }); setNote(''); setNoteOpen(false) } catch (error) { failure(error) }
  }

  const rowsFor = (item: Incident, entry?: IncidentHistory) => {
    const ids = new Set([...item.assigned_unit_ids, ...(entry ? Array.from(entry.units.keys()) : [])])
    return Array.from(ids).map((unitId) => {
      const current = item.is_active && item.assigned_unit_ids.includes(unitId)
      return { unitId, incident: item, status: current ? STATUS_WORD[item.status] : item.is_active ? 'Released' : 'Cleared', current }
    })
  }
  const apparatus = rowsFor(incident, record)
  const allCommitted = active.flatMap((item) => rowsFor(item, histories.get(item.incident_id)).filter((row) => row.current))
  const staff = apparatus.flatMap((row) => (readiness.get(row.unitId)?.assigned_personnel || []).map((person) => ({ ...person, unitId: row.unitId })))
  const others = allCommitted.filter((row) => !apparatus.some((item) => item.unitId === row.unitId))
  const list = tab === 'COMMITTED' ? allCommitted : apparatus
  const postureRow = (row: (typeof apparatus)[number], other = false) => {
    const unit = unitById.get(row.unitId)
    return (
      <tr key={`${other ? 'other-' : ''}${row.incident.incident_id}-${row.unitId}`} data-other={other || undefined}>
        <th scope="row"><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unitId)}`} aria-label={`Open unit record ${unitName(row.unitId)}`}>{unitName(row.unitId)}</Link><small>{unit ? UNIT_TYPE[unit.type] || unit.type : 'Type not recorded'}</small></th>
        <td><StatusBadge tone={row.current ? incidentStatusTone(row.incident) : 'neutral'}>{row.status}</StatusBadge></td>
        <td>{incidentRef(row.incident)} <span className="ui-muted">{street(row.incident)}</span></td>
      </tr>
    )
  }

  return <>
    <InspectorHeader kind={`Incident ${incidentRef(incident)} · ${TYPE_LABEL[incident.incident_type]}`} title={street(incident)} subtitle={`${incident.title} · ${closed ? `closed ${clock(incident.resolved_at)}` : `updated ${clock(lastEvent)}`}`} badge={<StatusBadge tone={incidentStatusTone(incident)}>{statusLabel(incident)}</StatusBadge>} />
    <form onSubmit={save} style={{ display: 'contents' }} aria-label="Incident worksheet">
      <InspectorBody>
        <fieldset disabled={closed} className={styles.worksheet}>
          <legend className="sr-only">Incident details</legend>
          <label className="ui-field"><span>Type</span><select className="ui-select" value={draft.incident_type} onChange={(event) => setDraft({ ...draft, incident_type: event.target.value as IncidentType })}>{TYPES.map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}</select></label>
          <label className="ui-field"><span>Priority</span><select className="ui-select" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Incident['priority'] })}>{(Object.keys(PRIORITY_LABEL) as Incident['priority'][]).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>)}</select></label>
          <label className={cn('ui-field', styles.wide)}><span>Status</span><select className="ui-select" data-ui="incident-status-select" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Incident['status'] })}>{(['ACTIVE', 'ENROUTE', 'ON_SCENE', 'TRANSPORT', 'INVESTIGATING'] as const).map((status) => <option key={status} value={status}>{STATUS_WORD[status]}</option>)}{closed && <option value="RESOLVED">Closed</option>}</select></label>
          <div className={cn('ui-field', styles.wide)}>
            <label htmlFor={`location-${incident.incident_id}`} style={{ fontSize: '0.875rem', fontWeight: 500 }}>Location / address</label>
            <span className={styles.locate}><input id={`location-${incident.incident_id}`} className="ui-input" data-ui="incident-location" value={draft.display_location} onChange={(event) => setDraft({ ...draft, display_location: event.target.value })} required /><button type="button" className="ui-button" onClick={onLocate} aria-label="Show this incident on the map"><LocateFixed aria-hidden="true" /></button></span>
          </div>
          <label className={cn('ui-field', styles.wide)}><span>Notes</span><textarea className="ui-input" data-ui="incident-notes" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} /><small className="ui-num">{draft.description.length}/500</small></label>
        </fieldset>

        <Section title="Units" meta={`${incident.assigned_unit_ids.length} assigned`}>
          <div className="ui-segmented" role="tablist" aria-label="Unit posture view" style={{ marginBottom: 8 }}>
            {([['APPARATUS', 'Apparatus'], ['STAFF', 'Staff'], ['COMMITTED', 'All committed']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}
          </div>
          <div className={cn('ui-table-wrap', styles.posture)} role="tabpanel" tabIndex={0} aria-label="Unit posture">
            {tab === 'STAFF'
              ? <table className="ui-table" data-ui="posture"><thead><tr><th scope="col">Name</th><th scope="col">Unit</th><th scope="col">Qualifications</th></tr></thead><tbody>{staff.map((person) => <tr key={`${person.unitId}-${person.personnel_id}`}><th scope="row">{person.name}<small>{person.role}</small></th><td><Link href={`/readiness?view=units&unit=${encodeURIComponent(person.unitId)}`}>{unitName(person.unitId)}</Link></td><td className="ui-mono" style={{ fontSize: '0.8125rem' }}>{person.certifications.slice(0, 3).join(' · ')}</td></tr>)}</tbody></table>
              : <table className="ui-table" data-ui="posture"><thead><tr><th scope="col">Unit</th><th scope="col">Status</th><th scope="col">Assignment</th></tr></thead><tbody>
                {list.map((row) => postureRow(row))}
                {tab === 'APPARATUS' && others.length > 0 && <><tr data-ui="posture-divider"><th scope="rowgroup" colSpan={3} className={styles.divider}>Other committed units</th></tr>{others.map((row) => postureRow(row, true))}</>}
              </tbody></table>}
            {((tab === 'STAFF' && !staff.length) || (tab !== 'STAFF' && !list.length && !(tab === 'APPARATUS' && others.length))) && <p className="ui-empty-inline">No units recorded for this view.</p>}
          </div>
        </Section>

        <Section title="Recorded lifecycle" meta={record?.recorded ? `${record.stages.length} ${record.stages.length === 1 ? 'stage' : 'stages'}` : 'times not recorded'}>
          <ol className={styles.lifecycle}>
            {(record?.stages || []).map((stage) => (
              <li key={stage.start} data-status={stage.status.toLowerCase()}>
                <i aria-hidden="true" />
                <div><strong>{STATUS_WORD[stage.status]}</strong><span className="ui-mono">{clock(stage.start)}–{stage.end >= now - 1000 ? 'now' : clock(stage.end)} · {duration(stage.start, stage.end)}</span></div>
                <small>{stage.event ? `recorded by ${stage.event.actor}` : 'transition time not recorded'}</small>
              </li>
            ))}
            {closed && <li data-status="resolved"><i aria-hidden="true" /><div><strong>Closed</strong><span className="ui-mono">{clock(incident.resolved_at)}</span></div><small>resolution recorded</small></li>}
          </ol>
        </Section>
      </InspectorBody>
      <InspectorFooter>
        <InlineError message={actionError} />
        <div className="ui-inspector-actions" data-ui="incident-actions">
          <WriteButton type="submit" variant="primary" disabled={!dirty || closed} busy={updating}>Save changes</WriteButton>
          <WriteButton onClick={() => { setDialogError(undefined); setNoteOpen(true) }} disabled={closed}><NotebookPen aria-hidden="true" />Add note</WriteButton>
          <WriteButton onClick={() => { setDialogError(undefined); setAssignedIds(incident.assigned_unit_ids); setAssignOpen(true) }} disabled={closed}><Truck aria-hidden="true" />Assign units</WriteButton>
          <WriteButton variant="danger" onClick={() => setResolveOpen(true)} busy={resolving} disabled={closed}><Check aria-hidden="true" />{closed ? 'Resolved' : 'Resolve incident'}</WriteButton>
        </div>
        {dirty && !closed && <p className="ui-provenance">Unsaved changes to this worksheet.</p>}
      </InspectorFooter>
    </form>

    <FormDialog open={assignOpen} onOpenChange={setAssignOpen} title={`Assign units · ${incidentRef(incident)}`} description={`Currently assigned: ${incident.assigned_unit_ids.map(unitName).join(', ') || 'none'}. Changes are recorded with timestamps in the incident history.`} submitLabel="Save unit assignments" submitting={updating} error={dialogError} onSubmit={saveUnits}>
      <SearchInput label="Search units" value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Unit name or type" style={{ maxWidth: 'none' }} />
      <div className="ui-check-list" data-ui="assignment-list">{filteredUnits.map((unit) => <label key={unit.unit_id}><input type="checkbox" checked={assignedIds.includes(unit.unit_id)} onChange={(event) => setAssignedIds(event.target.checked ? [...assignedIds, unit.unit_id] : assignedIds.filter((id) => id !== unit.unit_id))} /><span>{unit.unit_name}<small>{UNIT_TYPE[unit.unit_type] || unit.unit_type.replaceAll('_', ' ')} · {unit.readiness_score}% readiness</small></span></label>)}</div>
    </FormDialog>
    <FormDialog open={noteOpen} onOpenChange={setNoteOpen} title={`Add note · ${incidentRef(incident)}`} description="The note is appended to the incident notes with the current time and saved to the record." submitLabel="Add note" submitting={updating} error={dialogError} onSubmit={saveNote}>
      <label className="ui-field"><span>Note</span><textarea className="ui-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} required /></label>
    </FormDialog>
    <ConfirmDialog open={resolveOpen} onOpenChange={setResolveOpen} title={`Resolve ${incidentRef(incident)}?`} description={incident.title} detail="Unit assignment windows close at the resolution time, and the resolution is added to the audit history. A resolved incident cannot be reopened here." confirmLabel="Resolve incident" onConfirm={() => onResolve(incident.incident_id)} />
  </>
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
  function overlap(record: IncidentHistory) { return clip(record.stages, start, end).reduce((sum, stage) => sum + stage.end - stage.start, 0) }
  const rows = records
    .filter((incident) => types[incident.incident_type])
    .map((incident) => histories.get(incident.incident_id))
    .filter((record): record is IncidentHistory => Boolean(record) && record!.stages.some((stage) => stage.end > start && stage.start < end))
    .sort((a, b) => Number(b.incident.incident_id === selectedId) - Number(a.incident.incident_id === selectedId) || overlap(b) - overlap(a))
  const hourTicks = ticks(start, end)
  const segments = rows.flatMap((record) => clip(record.stages, start, end).map((stage) => ({ key: `${record.incident.incident_id}-${stage.start}`, record, stage })))
  const unitSegments = showUnits ? rows.flatMap((record) => Array.from(record.units).flatMap(([unitId, windows]) => clip(windows, start, end).map((window) => ({ key: `${record.incident.incident_id}-${unitId}-${window.start}`, record, unitId, window })))) : []
  const detail = segments.find((item) => item.key === detailKey)
  const unitDetail = unitSegments.find((item) => item.key === detailKey)
  const dateLabel = new Date(start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <section className={cn('ui-stage', styles.timeline)} aria-labelledby="incident-timeline-heading" data-ui="incident-timeline">
      <header className="ui-stage-header">
        <div><h2 id="incident-timeline-heading">Lifecycle timeline</h2><p>{dateLabel} · <span className="ui-mono">{clock(start)}–{clock(end)}</span> · recorded stages, not response or travel time</p></div>
        <div className={styles.timeControls} role="group" aria-label="Timeline window">
          <button type="button" className="ui-stage-button" onClick={() => setOffset(offset + 1)} aria-label="Earlier"><ChevronLeft aria-hidden="true" /></button>
          <label><span className="sr-only">Window length</span><select value={span} onChange={(event) => { setSpan(Number(event.target.value) as (typeof SPANS)[number]); setOffset(0) }}>{SPANS.map((value) => <option key={value} value={value}>{value} hours</option>)}</select></label>
          <button type="button" className="ui-stage-button" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={!offset} aria-label="Later"><ChevronRight aria-hidden="true" /></button>
        </div>
      </header>
      <fieldset className={styles.timeFilters} data-ui="timeline-types">
        <legend className="sr-only">Incident types</legend>
        {TYPES.map((type) => <label key={type} data-type={type.toLowerCase()}><input type="checkbox" checked={types[type]} onChange={(event) => setTypes({ ...types, [type]: event.target.checked })} /><i aria-hidden="true" />{TYPE_LABEL[type]}</label>)}
        <label className={styles.unitToggle}><input type="checkbox" checked={showUnits} onChange={(event) => setShowUnits(event.target.checked)} />Unit activity</label>
      </fieldset>
      <div className={styles.timeScroll} tabIndex={0} role="region" aria-label="Recorded incident lifecycle stages by time">
        <div className={styles.timeCanvas}>
          <div className={styles.ruler} aria-hidden="true"><span />{<div>{hourTicks.map((tick) => <b key={tick} style={{ left: `${pct(tick)}%` }}>{pct(tick) > 1.5 && pct(tick) < 98.5 ? clock(tick) : ''}</b>)}</div>}</div>
          {rows.map((record) => {
            const incident = record.incident
            const isSelected = incident.incident_id === selectedId
            return (
              <div key={incident.incident_id} className={styles.rowGroup} data-ui="timeline-group" data-incident={incidentRef(incident)} data-selected={isSelected || undefined}>
                <div className={styles.timeRow}>
                  <button type="button" className={styles.rowLabel} onClick={() => onSelect(incident.incident_id)} aria-pressed={isSelected}>{incidentRef(incident)}<small>{TYPE_LABEL[incident.incident_type]}</small></button>
                  <div className={styles.track}>
                    {hourTicks.map((tick) => <i key={tick} className={styles.gridLine} style={{ left: `${pct(tick)}%` }} aria-hidden="true" />)}
                    {now > start && now < end && <i className={styles.nowLine} style={{ left: `${pct(now)}%` }} aria-hidden="true" />}
                    {clip(record.stages, start, end).map((stage) => {
                      const key = `${incident.incident_id}-${stage.start}`
                      const width = pct(stage.end) - pct(stage.start)
                      return <button type="button" key={key} className={styles.segment} data-ui="timeline-stage" data-stage={stage.status.toLowerCase()} data-untimed={stage.untimed || undefined} data-active={detailKey === key || undefined} style={{ left: `${pct(stage.start)}%`, width: `${Math.max(0.4, width)}%` }} onClick={() => { setDetailKey(key); onSelect(incident.incident_id) }} aria-label={`${incidentRef(incident)} ${LIFECYCLE_LABEL[stage.status]} from ${clock(stage.start)} to ${stage.end >= now - 1000 ? 'now' : clock(stage.end)}`}><span>{width >= 11 ? STATUS_WORD[stage.status] : width >= 4.2 ? STAGE_CODE[stage.status] : ''}</span></button>
                    })}
                    {!incident.is_active && incident.resolved_at && new Date(incident.resolved_at).getTime() > start && new Date(incident.resolved_at).getTime() < end && <span className={styles.closedMark} style={{ left: `${pct(new Date(incident.resolved_at).getTime())}%` }} title={`Resolved ${clock(incident.resolved_at)}`} />}
                  </div>
                </div>
                {showUnits && Array.from(record.units).map(([unitId, windows]) => (
                  <div className={cn(styles.timeRow, styles.unitRow)} key={unitId} data-ui="timeline-unit-row">
                    <span className={styles.rowLabel}>{unitName(unitId)}</span>
                    <div className={styles.track}>{clip(windows, start, end).map((window) => {
                      const key = `${incident.incident_id}-${unitId}-${window.start}`
                      return <button type="button" key={key} className={styles.unitSegment} data-untimed={window.inferred || undefined} data-active={detailKey === key || undefined} style={{ left: `${pct(window.start)}%`, width: `${Math.max(0.4, pct(window.end) - pct(window.start))}%` }} onClick={() => setDetailKey(key)} aria-label={`${unitName(unitId)} assigned to ${incidentRef(incident)} from ${clock(window.start)} to ${window.end >= now - 1000 ? 'now' : clock(window.end)}`}><span>{unitName(unitId)} · assigned</span></button>
                    })}</div>
                  </div>
                ))}
              </div>
            )
          })}
          {!rows.length && <p className="ui-empty-inline">No recorded incident activity in this window and type filter.</p>}
        </div>
      </div>
      <p className="ui-stage-note" role="status" data-ui="timeline-detail">
        {detail ? <>{incidentRef(detail.record.incident)} · <b>{LIFECYCLE_LABEL[detail.stage.status]}</b> · <span className="ui-mono">{clock(detail.stage.start)}–{detail.stage.end >= now - 1000 ? 'now' : clock(detail.stage.end)}</span> ({duration(detail.stage.start, detail.stage.end)}) · {detail.stage.event ? `recorded by ${detail.stage.event.actor} · ${detail.stage.event.audit_id}` : 'transition times not recorded'}</>
          : unitDetail ? <>{unitName(unitDetail.unitId)} · assigned to {incidentRef(unitDetail.record.incident)} · <span className="ui-mono">{clock(unitDetail.window.start)}–{unitDetail.window.end >= now - 1000 ? 'now' : clock(unitDetail.window.end)}</span> ({duration(unitDetail.window.start, unitDetail.window.end)}){unitDetail.window.inferred ? ' · assignment time not recorded' : ''}</>
            : 'Select a stage for its recorded time and source.'}
      </p>
    </section>
  )
}
