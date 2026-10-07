'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ChevronDown, Edit3, Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState, type FormEvent } from 'react'
import ConfirmAction from '@/components/ConfirmAction'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { EmptyState, ErrorState, Filters, InlineError, Inspector, InspectorBody, InspectorFooter, InspectorHeader, LoadingState, Notice, PageHeader, Pagination, Panel, SearchInput, Section, StatusBadge, SummaryStrip, WriteButton, type NoticeValue } from '@/components/ui'
import { useAccess } from '@/hooks/useAccess'
import { usePagination } from '@/hooks/usePagination'
import { api, queryKeys } from '@/lib/api'
import type { Personnel } from '@/lib/schemas'
import { formatDate, titleCase } from '@/lib/utils'
import styles from '../workforce.module.css'

const STATES = ['DEPLOYED', 'AVAILABLE', 'ON_CALL', 'IN_TRAINING', 'OFF'] as const
const VIEWS: Array<[string, string]> = [['active', 'All'], ['available', 'Deployable'], ['deployed', 'Assigned'], ['off', 'Unavailable']]

function availabilityTone(status: Personnel['availability_status']) {
  if (status === 'AVAILABLE' || status === 'ON_CALL') return 'success' as const
  if (status === 'DEPLOYED') return 'info' as const
  if (status === 'IN_TRAINING') return 'warning' as const
  return 'neutral' as const
}
const stationCode = (name?: string) => name?.split(' — ')[0].replace('Station ', 'St. ') || '—'

function WorkforcePage() {
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const access = useAccess()
  const { stationId } = useStationScope()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('active')
  const [selectedId, setSelectedId] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(params.get('person')))
  const [rosterStation, setRosterStation] = useState('all')
  const [editing, setEditing] = useState<Personnel | 'new' | null>(null)
  const [formError, setFormError] = useState<string>()
  const [notice, setNotice] = useState<NoticeValue>(null)

  const people = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const assignments = useQuery({ queryKey: queryKeys.assignments, queryFn: api.assignments })
  const units = useQuery({ queryKey: queryKeys.units, queryFn: api.units })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const certifications = useQuery({ queryKey: queryKeys.certifications, queryFn: api.certifications })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.personnel }),
      queryClient.invalidateQueries({ queryKey: ['operations'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments }),
    ])
  }

  const savePerson = useMutation({
    mutationFn: ({ existing, payload }: { existing?: Personnel; payload: unknown }) => existing ? api.updatePersonnel(existing.personnel_id, payload) : api.createPersonnel(payload),
    onSuccess: async (saved) => { await invalidate(); setEditing(null); setSelectedId(saved.personnel_id); setInspectorOpen(true); setSearch(saved.name); setRosterStation('all'); setView('active'); setNotice({ tone: 'success', message: 'Personnel record saved.' }) },
  })
  const archivePerson = useMutation({
    mutationFn: api.archivePersonnel,
    onSuccess: async () => { await invalidate(); setSelectedId(''); setInspectorOpen(false); setNotice({ tone: 'success', message: 'Personnel record archived.' }) },
  })
  const updateAvailability = useMutation({
    mutationFn: ({ person, status }: { person: Personnel; status: Personnel['availability_status'] }) => api.updatePersonnel(person.personnel_id, { ...person, availability_status: status }),
    onSuccess: async () => { await invalidate(); setNotice({ tone: 'success', message: 'Availability updated.' }) },
  })

  const scopedPeople = useMemo(() => (people.data || []).filter((person) => stationId === 'all' || person.station_id === stationId), [people.data, stationId])
  const filteredPeople = useMemo(() => scopedPeople.filter((person) => {
    const matchesSearch = `${person.name} ${person.role} ${person.rank || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesView = view === 'active' || (view === 'available' && ['AVAILABLE', 'ON_CALL'].includes(person.availability_status)) || (view === 'deployed' && person.availability_status === 'DEPLOYED') || (view === 'off' && ['OFF', 'IN_TRAINING'].includes(person.availability_status))
    return matchesSearch && matchesView && (rosterStation === 'all' || person.station_id === rosterStation)
  }), [scopedPeople, search, view, rosterStation])
  const page = usePagination(filteredPeople, `${stationId}:${view}:${search}:${rosterStation}`)
  const selected = filteredPeople.find((person) => person.personnel_id === (selectedId || params.get('person'))) || page.rows[0]
  const selectedAssignments = assignments.data?.filter((assignment) => assignment.personnel_id === selected?.personnel_id && assignment.assignment_status !== 'CANCELLED') || []
  const selectedUnit = units.data?.find((unit) => unit.unit_id === selected?.current_unit_id)
  const selectedStation = stations.data?.find((station) => station.station_id === selected?.station_id)
  const expiringCount = scopedPeople.reduce((count, person) => count + Object.values(person.cert_expirations).filter((date) => new Date(date).getTime() < Date.now() + 30 * 86400000).length, 0)
  const stationName = (id?: string | null) => stations.data?.find((station) => station.station_id === id)?.name
  const distribution = (stations.data || []).filter((station) => scopedPeople.some((person) => person.station_id === station.station_id))

  const select = (id: string) => {
    setSelectedId(id)
    setInspectorOpen(true)
    updateAvailability.reset()
    const query = new URLSearchParams(params.toString())
    query.set('person', id)
    window.history.replaceState(null, '', `/personnel?${query}`)
  }

  const submitPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const existing = editing === 'new' ? undefined : editing || undefined
    const certs = String(data.get('certifications') || '').split(',').map((value) => value.trim()).filter(Boolean)
    const expiry = String(data.get('credential_expiry') || '')
    if (certs.some(cert => !existing?.cert_expirations[cert]) && !expiry) {
      setFormError('Enter a verified expiration date for newly added credentials.')
      return
    }
    setFormError(undefined)
    savePerson.mutate({ existing, payload: {
      ...(existing || {}), name: data.get('name'), rank: data.get('rank') || null, role: data.get('role'), station_id: data.get('station_id') || null,
      availability_status: data.get('availability_status'), notes: data.get('notes') || null, certifications: certs,
      cert_expirations: Object.fromEntries(certs.map((cert) => [cert, expiry ? `${expiry}T23:59:59Z` : existing?.cert_expirations[cert]])), is_archived: false,
    } })
  }

  return (
    <div className="ui-page" data-view="personnel">
      <PageHeader title="Personnel" description="Find deployable personnel, understand role and credential constraints, and maintain the canonical roster." actions={<WriteButton variant="primary" onClick={() => { savePerson.reset(); setFormError(undefined); setEditing('new') }}><Plus aria-hidden="true" />Add personnel</WriteButton>} />
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {people.isError && <ErrorState message={people.error.message} retry={() => people.refetch()} />}

      <SummaryStrip label="Roster summary" items={[
        { label: 'Active roster', value: people.data ? scopedPeople.length.toLocaleString() : '—', detail: 'in current scope' },
        { label: 'Deployable now', value: people.data ? scopedPeople.filter((person) => ['AVAILABLE', 'ON_CALL'].includes(person.availability_status)).length.toLocaleString() : '—', detail: 'available or on call' },
        { label: 'On assignment', value: people.data ? scopedPeople.filter((person) => person.availability_status === 'DEPLOYED').length.toLocaleString() : '—', detail: 'linked to a unit' },
        { label: 'Credential risk', value: people.data ? expiringCount : '—', detail: 'expired or due within 30 days', tone: expiringCount ? 'warn' : undefined, href: '/certifications-management' },
      ]} />

      <div className="ui-toolbar">
        <SearchInput label="Search personnel" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role, or rank" />
        <div className="ui-segmented" role="tablist" aria-label="Roster status">
          {VIEWS.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)}>{label}</button>)}
        </div>
        <Filters activeCount={Number(rosterStation !== 'all')}>
          <label className="ui-inline-field"><span>Roster station</span><select className="ui-select" aria-label="Roster station" value={rosterStation} onChange={event => setRosterStation(event.target.value)}><option value="all">All in scope</option>{stations.data?.filter(station => stationId === 'all' || station.station_id === stationId).map(station => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></label>
        </Filters>
      </div>

      <details className="ui-disclosure" data-ui="station-distribution">
        <summary>Station distribution<ChevronDown className="ui-chevron" aria-hidden="true" /></summary>
        <Panel title="Personnel by station" description="Select a station to filter the roster. Availability is not qualification clearance." className={styles.distributionPanel}>
          <div className={styles.distribution}>
            {distribution.map(station => {
              const roster = scopedPeople.filter(person => person.station_id === station.station_id)
              return (
                <button type="button" key={station.station_id} aria-pressed={rosterStation === station.station_id} onClick={() => { setRosterStation(station.station_id); setSelectedId(''); setSearch(''); setView('active') }} aria-label={`Inspect personnel at ${station.name}`}>
                  <strong>{stationCode(station.name)}</strong><span className="ui-num">{roster.length}</span>
                  <span className={styles.stateTrack}>{STATES.map(state => <i key={state} data-state={state.toLowerCase()} style={{ width: `${roster.filter(person => person.availability_status === state).length / roster.length * 100}%` }} />)}</span>
                </button>
              )
            })}
          </div>
          <ul className={styles.stateLegend}>{STATES.map(state => <li key={state}><i data-state={state.toLowerCase()} />{titleCase(state)}</li>)}</ul>
        </Panel>
      </details>

      <div className="ui-workspace" data-inspector="true">
        <Panel title="Roster" description={`${filteredPeople.length.toLocaleString()} of ${scopedPeople.length.toLocaleString()} personnel${rosterStation !== 'all' ? ` · ${stationName(rosterStation) || rosterStation}` : ''}`} flush>
          {people.isLoading ? <LoadingState rows={10} /> : <>
            <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Personnel roster">
              <table className="ui-table">
                <thead><tr><th scope="col">Name and role</th><th scope="col">Station</th><th scope="col">Unit</th><th scope="col">Availability</th></tr></thead>
                <tbody>{page.rows.map((person) => (
                  <tr key={person.personnel_id} data-ui="person-row" data-selectable="true" aria-selected={selected?.personnel_id === person.personnel_id} onClick={() => select(person.personnel_id)}>
                    <th scope="row"><button type="button" className="ui-row-button" onClick={(event) => { event.stopPropagation(); select(person.personnel_id) }}>{person.name}</button><small>{person.rank || person.role}</small></th>
                    <td className="ui-mono" data-ui="person-station">{stationCode(stationName(person.station_id))}</td>
                    <td className="ui-mono">{units.data?.find(unit => unit.unit_id === person.current_unit_id)?.unit_name || '—'}</td>
                    <td><StatusBadge tone={availabilityTone(person.availability_status)}>{titleCase(person.availability_status)}</StatusBadge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!filteredPeople.length && <EmptyState title="No personnel match" description="Try another status, station, or search phrase." />}
            <Pagination {...page} />
          </>}
        </Panel>

        <Inspector label="Personnel profile" open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)} recordKey={selected?.personnel_id}>
          {selected ? <>
            <InspectorHeader kind={`${selected.rank || 'Personnel'} · ${stationCode(selectedStation?.name) === '—' ? 'Unassigned' : stationCode(selectedStation?.name)}`} title={selected.name} headingId="person-heading" subtitle={selected.role} badge={<StatusBadge tone={availabilityTone(selected.availability_status)}>{titleCase(selected.availability_status)}</StatusBadge>} />
            <InspectorBody>
              <dl className="ui-facts">
                <div><dt>Station</dt><dd>{selectedStation?.name || 'Unassigned'}</dd></div>
                <div><dt>Current unit</dt><dd>{selectedUnit?.unit_name || 'No active unit'}</dd></div>
                <div><dt>Last check-in</dt><dd>{formatDate(selected.last_check_in, 'MMM d, yyyy · h:mm a')}</dd></div>
              </dl>
              <label className="ui-field"><span>Availability</span>
                <select className="ui-select" disabled={!access.data?.can_write || updateAvailability.isPending} value={selected.availability_status} onChange={(event) => updateAvailability.mutate({ person: selected, status: event.target.value as Personnel['availability_status'] })}><option>AVAILABLE</option><option>ON_CALL</option><option>DEPLOYED</option><option>IN_TRAINING</option><option>OFF</option></select>
                {!access.data?.can_write && <small>Read-only access. An operator account is required to change availability.</small>}
              </label>
              <InlineError message={updateAvailability.error?.message} />
              <Section title="Credentials" meta={`${selected.certifications.length} on record`}>
                <ul className={styles.credentials}>
                  {selected.certifications.map((cert) => { const date = selected.cert_expirations[cert]; const expired = Boolean(date) && new Date(date) < new Date(); return <li key={cert} data-expired={expired || undefined}><strong className="ui-mono">{cert}</strong><span>{expired ? 'Expired ' : 'Valid to '}{formatDate(date, 'MMM yyyy')}</span></li> })}
                </ul>
                {!selected.certifications.length && <p className="ui-empty-inline">No credentials recorded.</p>}
              </Section>
              <Section title="Current assignments" meta="live and pending">
                <ul className="ui-list" style={{ border: selectedAssignments.length ? '1px solid var(--rule)' : 0, borderRadius: 'var(--radius-control)' }}>
                  {selectedAssignments.map((assignment) => <li key={assignment.assignment_id} className="ui-list-row" style={{ minHeight: 48 }}><span className="ui-list-main"><strong>{units.data?.find((unit) => unit.unit_id === assignment.unit_id)?.unit_name || 'Response unit'}</strong><small>{formatDate(assignment.shift_start, 'MMM d · h:mm a')} – {formatDate(assignment.shift_end, 'h:mm a')}</small></span><StatusBadge tone={assignment.assignment_status === 'ON_SHIFT' ? 'success' : 'warning'}>{titleCase(assignment.assignment_status)}</StatusBadge></li>)}
                </ul>
                {!selectedAssignments.length && <p className="ui-empty-inline" style={{ padding: 0 }}>No current unit assignments.</p>}
              </Section>
              {selected.notes && <Section title="Operational notes"><p style={{ color: 'var(--ink-2)', fontSize: '0.875rem' }}>{selected.notes}</p></Section>}
            </InspectorBody>
            <InspectorFooter>
              <div className="ui-inspector-actions">
                <WriteButton onClick={() => { savePerson.reset(); setFormError(undefined); setEditing(selected) }}><Edit3 aria-hidden="true" />Edit profile</WriteButton>
                <ConfirmAction title="Archive personnel record?" description={`${selected.name} will be removed from the active roster. Existing history is retained; active assignments must be cancelled first.`} onConfirm={() => archivePerson.mutateAsync(selected.personnel_id)}><Archive aria-hidden="true" />Archive record</ConfirmAction>
              </div>
            </InspectorFooter>
          </> : <EmptyState title="Select a person" description="Choose a roster member to review their operational profile." />}
        </Inspector>
      </div>

      <FormDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title={editing === 'new' ? 'Add personnel' : 'Edit personnel'} description="Maintain the canonical record used by readiness and scheduling validation." submitLabel={editing === 'new' ? 'Add personnel' : 'Save changes'} submitting={savePerson.isPending} error={formError || savePerson.error?.message} onSubmit={submitPerson}>
        <div className="ui-form-grid">
          <Field label="Full name"><input className="ui-input" name="name" defaultValue={editing === 'new' ? '' : editing?.name} required /></Field>
          <Field label="Rank"><input className="ui-input" name="rank" defaultValue={editing === 'new' ? '' : editing?.rank || ''} /></Field>
          <Field label="Operational role"><input className="ui-input" name="role" defaultValue={editing === 'new' ? '' : editing?.role} required /></Field>
          <Field label="Station"><select className="ui-select" name="station_id" defaultValue={editing === 'new' ? (stationId === 'all' ? '' : stationId) : editing?.station_id || ''}><option value="">Unassigned</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field>
          <Field label="Availability"><select className="ui-select" name="availability_status" defaultValue={editing === 'new' ? 'AVAILABLE' : editing?.availability_status}><option>AVAILABLE</option><option>ON_CALL</option><option>DEPLOYED</option><option>IN_TRAINING</option><option>OFF</option></select></Field>
          <Field label="Credentials" hint="Comma-separated credential codes; no validity is inferred"><input className="ui-input" name="certifications" list="credential-options" defaultValue={editing === 'new' ? '' : editing?.certifications.join(', ')} /><datalist id="credential-options">{certifications.data?.map((cert) => <option key={cert.certification_id}>{cert.name}</option>)}</datalist></Field>
          <Field label="Verified credential expiration" hint="Required for new credentials. If supplied, applies to all listed credentials. Leave blank to retain existing dates."><input className="ui-input" type="date" name="credential_expiry" /></Field>
        </div>
        <Field label="Operational notes"><textarea className="ui-input" name="notes" defaultValue={editing === 'new' ? '' : editing?.notes || ''} /></Field>
      </FormDialog>
    </div>
  )
}

export default function PersonnelPage() { return <Suspense fallback={<LoadingState rows={8} />}><WorkforcePage /></Suspense> }
