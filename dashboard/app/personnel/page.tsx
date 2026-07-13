'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBadge } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import type { Personnel } from '@/lib/schemas'
import { cn, formatDate, titleCase } from '@/lib/utils'

type Notice = { tone: 'success' | 'danger'; message: string } | null

function availabilityTone(status: Personnel['availability_status']) {
  if (status === 'AVAILABLE' || status === 'ON_CALL') return 'success' as const
  if (status === 'DEPLOYED') return 'info' as const
  if (status === 'IN_TRAINING') return 'warning' as const
  return 'neutral' as const
}

export default function WorkforcePage() {
  const queryClient = useQueryClient()
  const { stationId } = useStationScope()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('active')
  const [selectedId, setSelectedId] = useState('')
  const [editing, setEditing] = useState<Personnel | 'new' | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

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
    onSuccess: async (saved) => { await invalidate(); setEditing(null); setSelectedId(saved.personnel_id); setNotice({ tone: 'success', message: 'Personnel record saved.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const archivePerson = useMutation({
    mutationFn: api.archivePersonnel,
    onSuccess: async () => { await invalidate(); setSelectedId(''); setNotice({ tone: 'success', message: 'Personnel record archived.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const updateAvailability = useMutation({
    mutationFn: ({ person, status }: { person: Personnel; status: Personnel['availability_status'] }) => api.updatePersonnel(person.personnel_id, { ...person, availability_status: status }),
    onSuccess: async () => { await invalidate(); setNotice({ tone: 'success', message: 'Availability updated.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })

  const scopedPeople = useMemo(() => (people.data || []).filter((person) => stationId === 'all' || person.station_id === stationId), [people.data, stationId])
  const filteredPeople = useMemo(() => scopedPeople.filter((person) => {
    const matchesSearch = `${person.name} ${person.role} ${person.rank || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesView = view === 'active' || (view === 'available' && ['AVAILABLE', 'ON_CALL'].includes(person.availability_status)) || (view === 'deployed' && person.availability_status === 'DEPLOYED') || (view === 'off' && ['OFF', 'IN_TRAINING'].includes(person.availability_status))
    return matchesSearch && matchesView
  }), [scopedPeople, search, view])
  const selected = scopedPeople.find((person) => person.personnel_id === selectedId) || filteredPeople[0]
  const selectedAssignments = assignments.data?.filter((assignment) => assignment.personnel_id === selected?.personnel_id && assignment.assignment_status !== 'CANCELLED') || []
  const selectedUnit = units.data?.find((unit) => unit.unit_id === selected?.current_unit_id)
  const selectedStation = stations.data?.find((station) => station.station_id === selected?.station_id)
  const expiringCount = scopedPeople.reduce((count, person) => count + Object.values(person.cert_expirations).filter((date) => new Date(date).getTime() < Date.now() + 30 * 86400000).length, 0)

  const submitPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const existing = editing === 'new' ? undefined : editing || undefined
    const certs = String(data.get('certifications') || '').split(',').map((value) => value.trim()).filter(Boolean)
    const fallbackExpiry = new Date(Date.now() + 365 * 86400000).toISOString()
    savePerson.mutate({ existing, payload: {
      ...(existing || {}), name: data.get('name'), rank: data.get('rank') || null, role: data.get('role'), station_id: data.get('station_id') || null,
      availability_status: data.get('availability_status'), notes: data.get('notes') || null, certifications: certs,
      cert_expirations: Object.fromEntries(certs.map((cert) => [cert, existing?.cert_expirations[cert] || fallbackExpiry])), is_archived: false,
    } })
  }

  return (
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-6">
        <PageHeader eyebrow="People and qualification" title="Workforce" description="Find deployable personnel quickly, understand role and credential constraints, and maintain the canonical district roster." actions={<Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Add personnel</Button>} />
        {notice && <div className={cn('notice-banner', notice.tone === 'success' ? 'notice-success' : 'notice-danger')} role="status"><span>{notice.message}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
        {people.isError && <ErrorState message={people.error.message} retry={() => people.refetch()} />}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active roster" value={scopedPeople.length} detail="Personnel in current scope" icon={Users} tone="info" />
          <StatCard label="Deployable now" value={scopedPeople.filter((person) => ['AVAILABLE', 'ON_CALL'].includes(person.availability_status)).length} detail="Available or on call" icon={UserCheck} tone="success" />
          <StatCard label="On assignment" value={scopedPeople.filter((person) => person.availability_status === 'DEPLOYED').length} detail="Currently linked to a unit" icon={Clock3} tone="info" />
          <StatCard label="Credential risk" value={expiringCount} detail="Expired or due within 30 days" icon={ShieldAlert} tone={expiringCount ? 'warning' : 'success'} href="/certifications-management" />
        </section>

        <Tabs.Root value={view} onValueChange={setView} className="workspace-tabs">
          <div className="toolbar toolbar-tabs">
            <Tabs.List className="tab-list" aria-label="Roster status">
              <Tabs.Trigger value="active">All <span>{scopedPeople.length}</span></Tabs.Trigger>
              <Tabs.Trigger value="available">Deployable</Tabs.Trigger>
              <Tabs.Trigger value="deployed">Assigned</Tabs.Trigger>
              <Tabs.Trigger value="off">Unavailable</Tabs.Trigger>
            </Tabs.List>
            <label className="search-control"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, role, or rank" /></label>
          </div>
          <Tabs.Content value={view} className="tab-content">
            {people.isLoading ? <div className="ops-panel"><LoadingState rows={8} /></div> : (
              <div className="master-detail-grid workforce-grid">
                <section className="ops-panel people-list-panel">
                  <div className="list-column-heading"><span>Personnel</span><span>Status</span></div>
                  {filteredPeople.map((person) => <button key={person.personnel_id} className={cn('person-list-row', selected?.personnel_id === person.personnel_id && 'person-list-row-active')} onClick={() => setSelectedId(person.personnel_id)}><span className="person-avatar">{person.name.split(' ').filter((part) => !part.endsWith('.')).map((part) => part[0]).slice(0, 2).join('')}</span><span className="min-w-0 flex-1"><strong>{person.name}</strong><small>{person.rank || person.role} · {stations.data?.find((station) => station.station_id === person.station_id)?.name.replace(/^Station \d+ — /, '') || 'Unassigned'}</small></span><StatusBadge tone={availabilityTone(person.availability_status)}>{titleCase(person.availability_status)}</StatusBadge><ChevronRight className="size-4" /></button>)}
                  {!filteredPeople.length && <EmptyState title="No personnel match" description="Try another status view or search phrase." />}
                </section>
                <section className="ops-panel detail-panel">
                  {selected ? <div className="person-detail"><div className="person-detail-heading"><span className="person-avatar person-avatar-large">{selected.name.split(' ').filter((part) => !part.endsWith('.')).map((part) => part[0]).slice(0, 2).join('')}</span><div className="min-w-0 flex-1"><h2>{selected.name}</h2><p>{selected.rank || selected.role} · {selected.role}</p></div><StatusBadge tone={availabilityTone(selected.availability_status)}>{titleCase(selected.availability_status)}</StatusBadge></div><div className="detail-toolbar"><Button onClick={() => setEditing(selected)}><Edit3 className="size-4" />Edit profile</Button><label className="inline-select"><span>Availability</span><select value={selected.availability_status} onChange={(event) => updateAvailability.mutate({ person: selected, status: event.target.value as Personnel['availability_status'] })}><option>AVAILABLE</option><option>ON_CALL</option><option>DEPLOYED</option><option>IN_TRAINING</option><option>OFF</option></select></label></div><dl className="profile-facts"><div><dt><MapPin className="size-4" />Station</dt><dd>{selectedStation?.name || 'Unassigned'}</dd></div><div><dt><Mail className="size-4" />Current unit</dt><dd>{selectedUnit?.unit_name || 'No active unit'}</dd></div><div><dt><Clock3 className="size-4" />Last check-in</dt><dd>{formatDate(selected.last_check_in, 'MMM d, yyyy · h:mm a')}</dd></div></dl><div className="detail-section"><SectionHeader title="Credentials" description={`${selected.certifications.length} active records`} /> <div className="credential-cloud">{selected.certifications.map((cert) => { const date = selected.cert_expirations[cert]; const expired = date && new Date(date) < new Date(); return <span key={cert} className={cn(expired && 'credential-expired')}><Award className="size-3.5" />{cert}<small>{formatDate(date, 'MMM yyyy')}</small></span> })}</div></div><div className="detail-section"><SectionHeader title="Current assignments" description="Live and pending roster linkage" />{selectedAssignments.map((assignment) => <div key={assignment.assignment_id} className="assignment-compact"><span><CheckCircle2 className="size-4" /></span><div><strong>{units.data?.find((unit) => unit.unit_id === assignment.unit_id)?.unit_name || 'Response unit'}</strong><small>{formatDate(assignment.shift_start, 'MMM d · h:mm a')} – {formatDate(assignment.shift_end, 'h:mm a')}</small></div><StatusBadge tone={assignment.assignment_status === 'ON_SHIFT' ? 'success' : 'warning'}>{titleCase(assignment.assignment_status)}</StatusBadge></div>)}{!selectedAssignments.length && <div className="compact-empty">No current unit assignments.</div>}</div>{selected.notes && <div className="profile-notes"><strong>Operational notes</strong><p>{selected.notes}</p></div>}<Button variant="danger" className="mt-5" onClick={() => archivePerson.mutate(selected.personnel_id)} busy={archivePerson.isPending}><Archive className="size-4" />Archive record</Button></div> : <EmptyState title="Select a person" description="Choose a roster member to review their operational profile." />}
                </section>
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <FormDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title={editing === 'new' ? 'Add personnel' : 'Edit personnel'} description="Maintain the canonical record used by readiness and scheduling validation." submitLabel={editing === 'new' ? 'Add personnel' : 'Save changes'} submitting={savePerson.isPending} onSubmit={submitPerson}>
        <div className="form-grid"><Field label="Full name"><input className="form-control" name="name" defaultValue={editing === 'new' ? '' : editing?.name} required /></Field><Field label="Rank"><input className="form-control" name="rank" defaultValue={editing === 'new' ? '' : editing?.rank || ''} /></Field><Field label="Operational role"><input className="form-control" name="role" defaultValue={editing === 'new' ? '' : editing?.role} required /></Field><Field label="Station"><select className="form-control" name="station_id" defaultValue={editing === 'new' ? (stationId === 'all' ? '' : stationId) : editing?.station_id || ''}><option value="">Unassigned</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field><Field label="Availability"><select className="form-control" name="availability_status" defaultValue={editing === 'new' ? 'AVAILABLE' : editing?.availability_status}><option>AVAILABLE</option><option>ON_CALL</option><option>DEPLOYED</option><option>IN_TRAINING</option><option>OFF</option></select></Field><Field label="Credentials" hint="Comma-separated; new credentials receive a one-year review date"><input className="form-control" name="certifications" list="credential-options" defaultValue={editing === 'new' ? '' : editing?.certifications.join(', ')} /><datalist id="credential-options">{certifications.data?.map((cert) => <option key={cert.certification_id}>{cert.name}</option>)}</datalist></Field><Field label="Operational notes"><textarea className="form-control min-h-24" name="notes" defaultValue={editing === 'new' ? '' : editing?.notes || ''} /></Field></div>
      </FormDialog>
    </div>
  )
}
