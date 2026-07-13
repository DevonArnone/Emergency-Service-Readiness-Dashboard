'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Plus,
  Radio,
  Search,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBadge } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import type { LiveShift, Shift } from '@/lib/schemas'
import { cn, formatDate, formatRelativeTime, titleCase } from '@/lib/utils'

type Notice = { tone: 'success' | 'danger'; message: string } | null

function dateInput(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function shiftTone(status: string) {
  if (status === 'fully_staffed' || status === 'over_staffed') return 'success' as const
  if (status === 'understaffed') return 'danger' as const
  if (status === 'CANCELLED') return 'neutral' as const
  return 'info' as const
}

export default function SchedulingPage() {
  const queryClient = useQueryClient()
  const { stationId } = useStationScope()
  const [selectedDate, setSelectedDate] = useState(dateInput())
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [shiftDialog, setShiftDialog] = useState(false)
  const [rosterDialog, setRosterDialog] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const shifts = useQuery({ queryKey: queryKeys.shifts, queryFn: api.shifts })
  const liveShifts = useQuery({ queryKey: queryKeys.liveShifts, queryFn: api.liveShifts, refetchInterval: 15_000 })
  const personnel = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const activity = useQuery({ queryKey: queryKeys.audit, queryFn: () => api.auditEvents(80) })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.liveShifts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments }),
      queryClient.invalidateQueries({ queryKey: queryKeys.personnel }),
      queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      queryClient.invalidateQueries({ queryKey: ['operations'] }),
    ])
  }
  const createShift = useMutation({
    mutationFn: api.createShift,
    onSuccess: async (shift) => { await invalidate(); setSelectedId(shift.shift_id); setShiftDialog(false); setNotice({ tone: 'success', message: 'Shift created.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const cancelShift = useMutation({
    mutationFn: api.cancelShift,
    onSuccess: async () => { await invalidate(); setNotice({ tone: 'success', message: 'Shift and linked assignments cancelled.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const assignPerson = useMutation({
    mutationFn: ({ shiftId, personnelId }: { shiftId: string; personnelId: string }) => api.assignShift(shiftId, personnelId),
    onSuccess: async () => { await invalidate(); setRosterDialog(false); setNotice({ tone: 'success', message: 'Personnel added to the shift roster.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const clockAction = useMutation({
    mutationFn: ({ shiftId, personnelId, action }: { shiftId: string; personnelId: string; action: 'in' | 'out' }) => action === 'in' ? api.clockIn(shiftId, personnelId) : api.clockOut(shiftId, personnelId),
    onSuccess: async (result) => { await invalidate(); setNotice({ tone: 'success', message: `Personnel clocked ${result.status === 'clocked_in' ? 'in' : 'out'}.` }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })

  const filteredShifts = useMemo(() => (shifts.data || []).filter((shift) => {
    const dateMatches = shift.start_time.slice(0, 10) === selectedDate
    const scopeMatches = stationId === 'all' || shift.station_id === stationId
    const searchMatches = shift.location.toLowerCase().includes(search.toLowerCase())
    return dateMatches && scopeMatches && searchMatches
  }), [shifts.data, selectedDate, stationId, search])
  const selected = filteredShifts.find((shift) => shift.shift_id === selectedId) || filteredShifts[0]
  const liveSelected = liveShifts.data?.find((shift) => shift.shift_id === selected?.shift_id)
  const scopedLive = liveShifts.data?.filter((shift) => stationId === 'all' || shift.station_id === stationId) || []
  const required = scopedLive.reduce((sum, shift) => sum + shift.required_headcount, 0)
  const clocked = scopedLive.reduce((sum, shift) => sum + shift.clocked_in_count, 0)
  const shiftActivity = activity.data?.filter((event) => event.entity_type === 'shift' && (!selected || event.entity_id === selected.shift_id)).slice(0, 10) || []

  const submitShift = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const station = stations.data?.find((item) => item.station_id === data.get('station_id'))
    createShift.mutate({
      location: station?.name || data.get('location') || 'District coverage', station_id: data.get('station_id') || null,
      start_time: new Date(String(data.get('start_time'))).toISOString(), end_time: new Date(String(data.get('end_time'))).toISOString(),
      required_headcount: Number(data.get('required_headcount')), status: 'SCHEDULED', notes: data.get('notes') || null,
    })
  }

  const submitRoster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return
    const data = new FormData(event.currentTarget)
    assignPerson.mutate({ shiftId: selected.shift_id, personnelId: String(data.get('personnel_id')) })
  }

  return (
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-6">
        <PageHeader eyebrow="Coverage and attendance" title="Scheduling" description="Plan station coverage, staff each shift, and track clock events against required headcount without leaving the roster view." actions={<Button variant="primary" onClick={() => setShiftDialog(true)}><Plus className="size-4" />Create shift</Button>} />
        {notice && <div className={cn('notice-banner', notice.tone === 'success' ? 'notice-success' : 'notice-danger')} role="status"><span>{notice.message}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
        {(shifts.isError || liveShifts.isError) && <ErrorState message={shifts.error?.message || liveShifts.error?.message} retry={() => { shifts.refetch(); liveShifts.refetch() }} />}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Live coverage" value={required ? `${Math.round((clocked / required) * 100)}%` : '—'} detail={`${clocked} clocked in · ${required} required`} icon={Radio} tone={clocked >= required ? 'success' : 'danger'} />
          <StatCard label="Today's shifts" value={scopedLive.length} detail="Across selected station scope" icon={CalendarDays} tone="info" />
          <StatCard label="Staffing gaps" value={scopedLive.filter((shift) => shift.clocked_in_count < shift.required_headcount).length} detail="Shifts currently below minimum" icon={AlertTriangle} tone={scopedLive.some((shift) => shift.clocked_in_count < shift.required_headcount) ? 'danger' : 'success'} />
          <StatCard label="Scheduled roster" value={scopedLive.reduce((sum, shift) => sum + shift.assigned_count, 0)} detail="Personnel linked to live shifts" icon={Users} tone="info" />
        </section>

        <div className="toolbar schedule-toolbar"><label className="date-control"><CalendarDays className="size-4" /><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><label className="search-control"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shift location" /></label><div className="date-shortcuts"><button onClick={() => setSelectedDate(dateInput())}>Today</button><button onClick={() => setSelectedDate(dateInput(new Date(Date.now() + 86400000)))}>Tomorrow</button></div></div>

        {shifts.isLoading ? <div className="ops-panel"><LoadingState rows={8} /></div> : (
          <div className="master-detail-grid schedule-grid">
            <section className="ops-panel shift-list-panel">
              <SectionHeader title={formatDate(`${selectedDate}T12:00:00`, 'EEEE, MMMM d')} description={`${filteredShifts.length} scheduled shifts`} />
              {filteredShifts.map((shift) => {
                const live = liveShifts.data?.find((item) => item.shift_id === shift.shift_id)
                return <ShiftRow key={shift.shift_id} shift={shift} live={live} active={selected?.shift_id === shift.shift_id} onSelect={() => setSelectedId(shift.shift_id)} />
              })}
              {!filteredShifts.length && <EmptyState title="No shifts scheduled" description="Create a shift for this date or select another day." icon={CalendarDays} action={<Button variant="primary" onClick={() => setShiftDialog(true)}><Plus className="size-4" />Create shift</Button>} />}
            </section>

            <section className="ops-panel detail-panel">
              {selected ? <div className="shift-detail"><div className="shift-detail-heading"><div><span className="eyebrow">{formatDate(selected.start_time, 'EEEE · MMM d')}</span><h2>{selected.location}</h2><p>{formatDate(selected.start_time, 'h:mm a')} – {formatDate(selected.end_time, 'h:mm a')}</p></div><StatusBadge tone={shiftTone(liveSelected?.status || selected.status)}>{titleCase(liveSelected?.status || selected.status)}</StatusBadge></div><div className="coverage-hero"><div><span>Clocked in</span><strong>{liveSelected?.clocked_in_count ?? 0}</strong></div><div><span>Assigned</span><strong>{liveSelected?.assigned_count ?? 0}</strong></div><div><span>Required</span><strong>{selected.required_headcount}</strong></div></div><div className="detail-toolbar"><Button variant="primary" onClick={() => setRosterDialog(true)} disabled={selected.status === 'CANCELLED'}><UserPlus className="size-4" />Add to roster</Button><Button variant="danger" onClick={() => cancelShift.mutate(selected.shift_id)} busy={cancelShift.isPending} disabled={selected.status === 'CANCELLED'}><XCircle className="size-4" />Cancel shift</Button></div><div className="detail-section"><SectionHeader title="Roster" description="Clock status updates readiness immediately" />{liveSelected?.assigned_personnel.map((person) => <div key={person.personnel_id} className="roster-row"><span className={cn('attendance-dot', person.clocked_in_at && 'attendance-live')} /><div className="min-w-0 flex-1"><strong>{person.name}</strong><small>{titleCase(person.status)} · Unit {person.unit_id.slice(0, 8)}</small></div>{person.clocked_in_at ? <Button onClick={() => clockAction.mutate({ shiftId: selected.shift_id, personnelId: person.personnel_id, action: 'out' })} busy={clockAction.isPending}><LogOut className="size-4" />Clock out</Button> : <Button variant="primary" onClick={() => clockAction.mutate({ shiftId: selected.shift_id, personnelId: person.personnel_id, action: 'in' })} busy={clockAction.isPending}><LogIn className="size-4" />Clock in</Button>}</div>)}{!liveSelected?.assigned_personnel.length && <div className="compact-empty">No personnel assigned to this shift.</div>}</div>{selected.notes && <div className="profile-notes"><strong>Shift notes</strong><p>{selected.notes}</p></div>}</div> : <EmptyState title="Select a shift" description="Choose a shift to review its coverage and roster." />}
            </section>
          </div>
        )}

        <section className="ops-panel">
          <SectionHeader title="Shift activity" description="Clock, roster, and lifecycle events from the durable audit stream" action={<Clock3 className="size-4 text-emerald-300" />} />
          <div className="event-strip">{shiftActivity.map((event) => <div key={event.audit_id} className="event-row"><span className="event-icon"><CheckCircle2 className="size-4" /></span><div className="min-w-0 flex-1"><strong>{event.summary}</strong><small>{event.actor} · {formatRelativeTime(event.created_at)}</small></div><StatusBadge tone="info">{event.action}</StatusBadge></div>)}{!shiftActivity.length && <div className="compact-empty">No shift events in this view.</div>}</div>
        </section>
      </div>

      <FormDialog open={shiftDialog} onOpenChange={setShiftDialog} title="Create shift" description="Define the station, time window, and minimum coverage target." submitLabel="Create shift" submitting={createShift.isPending} onSubmit={submitShift}><div className="form-grid"><Field label="Station"><select className="form-control" name="station_id" defaultValue={stationId === 'all' ? '' : stationId} required><option value="">Select station</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field><Field label="Location override"><input className="form-control" name="location" placeholder="Defaults to station name" /></Field><Field label="Start"><input className="form-control" type="datetime-local" name="start_time" required /></Field><Field label="End"><input className="form-control" type="datetime-local" name="end_time" required /></Field><Field label="Required headcount"><input className="form-control" type="number" min="1" name="required_headcount" defaultValue="7" required /></Field><Field label="Shift notes"><textarea className="form-control min-h-24" name="notes" /></Field></div></FormDialog>
      <FormDialog open={rosterDialog} onOpenChange={setRosterDialog} title={`Add to ${selected?.location || 'shift'}`} description="The service validates active personnel, unit availability, and assignment overlap." submitLabel="Add to roster" submitting={assignPerson.isPending} onSubmit={submitRoster}><Field label="Personnel"><select className="form-control" name="personnel_id" required><option value="">Select available personnel</option>{personnel.data?.filter((person) => !liveSelected?.assigned_personnel.some((assigned) => assigned.personnel_id === person.personnel_id)).map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.name} · {titleCase(person.availability_status)}</option>)}</select></Field></FormDialog>
    </div>
  )
}

function ShiftRow({ shift, live, active, onSelect }: { shift: Shift; live?: LiveShift; active: boolean; onSelect: () => void }) {
  const coverage = live ? Math.min(100, Math.round((live.clocked_in_count / shift.required_headcount) * 100)) : 0
  return <button className={cn('shift-list-row', active && 'shift-list-row-active')} type="button" onClick={onSelect}><span className="shift-time"><strong>{formatDate(shift.start_time, 'h:mm')}</strong><small>{formatDate(shift.start_time, 'a')}</small></span><span className="min-w-0 flex-1"><strong>{shift.location}</strong><small>{live ? `${live.clocked_in_count}/${shift.required_headcount} clocked in` : `${shift.required_headcount} required`} · {titleCase(shift.status)}</small>{live && <span className="coverage-track"><i style={{ width: `${coverage}%` }} /></span>}</span><StatusBadge tone={shiftTone(live?.status || shift.status)}>{live ? `${coverage}%` : titleCase(shift.status)}</StatusBadge><ChevronRight className="size-4" /></button>
}
