'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, LogIn, LogOut, Plus, UserPlus, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import ConfirmAction from '@/components/ConfirmAction'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { Button, EmptyState, ErrorState, InlineError, Inspector, InspectorBody, InspectorFooter, InspectorHeader, LoadingState, Notice, PageHeader, Pagination, Panel, SearchInput, Section, StatusBadge, SummaryStrip, WriteButton, type NoticeValue } from '@/components/ui'
import { usePagination } from '@/hooks/usePagination'
import { api, queryKeys } from '@/lib/api'
import type { LiveShift, Shift } from '@/lib/schemas'
import { cn, formatDate, formatRelativeTime, ratioTone, titleCase } from '@/lib/utils'
import styles from '../workforce.module.css'

function dateInput(date = new Date()) {
  return formatDate(date.toISOString(), 'yyyy-MM-dd')
}

function shiftTone(status: string) {
  if (status === 'fully_staffed' || status === 'over_staffed') return 'success' as const
  if (status === 'understaffed') return 'danger' as const
  if (status === 'CANCELLED') return 'neutral' as const
  return 'info' as const
}

type DutyRow = { shift: Shift; id: string; label: string; present?: number; assigned?: number; required?: number }

export default function SchedulingPage() {
  const queryClient = useQueryClient()
  const { stationId } = useStationScope()
  const [selectedDate, setSelectedDate] = useState(dateInput())
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [shiftDialog, setShiftDialog] = useState(false)
  const [rosterDialog, setRosterDialog] = useState(false)
  const [notice, setNotice] = useState<NoticeValue>(null)

  const shifts = useQuery({ queryKey: queryKeys.shifts, queryFn: api.shifts })
  const liveShifts = useQuery({ queryKey: [...queryKeys.liveShifts, selectedDate], queryFn: () => api.liveShifts(selectedDate), refetchInterval: 15_000 })
  const personnel = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const units = useQuery({ queryKey: queryKeys.units, queryFn: api.units })
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
    onSuccess: async (shift) => { await invalidate(); setSelectedId(shift.shift_id); setInspectorOpen(true); setSelectedDate(formatDate(shift.start_time, 'yyyy-MM-dd')); setShiftDialog(false); setNotice({ tone: 'success', message: 'Shift created.' }) },
  })
  const cancelShift = useMutation({
    mutationFn: api.cancelShift,
    onSuccess: async () => { await invalidate(); setNotice({ tone: 'success', message: 'Shift and linked assignments cancelled.' }) },
  })
  const assignPerson = useMutation({
    mutationFn: ({ shiftId, personnelId }: { shiftId: string; personnelId: string }) => api.assignShift(shiftId, personnelId),
    onSuccess: async () => { await invalidate(); setRosterDialog(false); setNotice({ tone: 'success', message: 'Personnel added to the shift roster.' }) },
  })
  const clockAction = useMutation({
    mutationFn: ({ shiftId, personnelId, action }: { shiftId: string; personnelId: string; action: 'in' | 'out' }) => action === 'in' ? api.clockIn(shiftId, personnelId) : api.clockOut(shiftId, personnelId),
    onSuccess: async (result) => { await invalidate(); setNotice({ tone: 'success', message: `Personnel clocked ${result.status === 'clocked_in' ? 'in' : 'out'}.` }) },
  })

  const dayStart = new Date(`${selectedDate}T00:00:00`).getTime()
  const dayEndDate = new Date(`${selectedDate}T00:00:00`); dayEndDate.setDate(dayEndDate.getDate() + 1)
  const dayLength = dayEndDate.getTime() - dayStart
  const filteredShifts = useMemo(() => (shifts.data || []).filter((shift) => {
    const start = new Date(`${selectedDate}T00:00:00`)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    const dateMatches = new Date(shift.start_time) < end && new Date(shift.end_time) > start
    const scopeMatches = stationId === 'all' || shift.station_id === stationId
    const searchMatches = shift.location.toLowerCase().includes(search.toLowerCase())
    return dateMatches && scopeMatches && searchMatches
  }), [shifts.data, selectedDate, stationId, search])
  const selected = filteredShifts.find((shift) => shift.shift_id === selectedId) || filteredShifts[0]
  const liveSelected = liveShifts.data?.find((shift) => shift.shift_id === selected?.shift_id)
  const scopedLive = liveShifts.data?.filter((shift) => shift.status !== 'CANCELLED' && filteredShifts.some(row => row.shift_id === shift.shift_id)) || []
  const required = scopedLive.reduce((sum, shift) => sum + shift.required_headcount, 0)
  const clocked = scopedLive.reduce((sum, shift) => sum + shift.clocked_in_count, 0)
  const gaps = scopedLive.filter((shift) => shift.clocked_in_count < shift.required_headcount).length
  const rosterPage = usePagination(liveSelected?.assigned_personnel || [], selected?.shift_id || 'none', 20)
  const shiftActivity = activity.data?.filter((event) => event.entity_type === 'shift' && (!selected || event.entity_id === selected.shift_id)).slice(0, 10) || []
  const unitList = units.data || []

  // A countywide shift can contain many apparatus. Its rows are actual roster groups, not invented station shifts.
  const dutyRows = filteredShifts.flatMap<DutyRow>(shift => {
    const attendance = liveShifts.data?.find(item => item.shift_id === shift.shift_id)
    const groups = new Map<string, LiveShift['assigned_personnel']>()
    attendance?.assigned_personnel.forEach(person => groups.set(person.unit_id, [...(groups.get(person.unit_id) || []), person]))
    if (!groups.size) return [{ shift, id: shift.shift_id, label: shift.location, present: attendance?.clocked_in_count, assigned: attendance?.assigned_count, required: shift.required_headcount }]
    return Array.from(groups).map(([id, crew]) => ({ shift, id: `${shift.shift_id}:${id}`, label: unitList.find(unit => unit.unit_id === id)?.unit_name || id, present: crew.filter(person => person.clocked_in_at && !person.clocked_out_at).length, assigned: crew.length, required: unitList.find(unit => unit.unit_id === id)?.minimum_staff }))
  })
  const ledger = unitList.map(unit => {
    const crew = liveSelected?.assigned_personnel.filter(person => person.unit_id === unit.unit_id) || []
    return { unit, assigned: crew.length, present: crew.filter(person => person.clocked_in_at && !person.clocked_out_at).length }
  }).filter(row => row.assigned > 0).sort((a, b) => (b.unit.minimum_staff - b.present) - (a.unit.minimum_staff - a.present))

  const select = (id: string) => { setSelectedId(id); setInspectorOpen(true); clockAction.reset(); cancelShift.reset() }
  const moveDay = (days: number) => { const date = new Date(`${selectedDate}T12:00:00`); date.setDate(date.getDate() + days); setSelectedDate(dateInput(date)) }

  const submitShift = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const station = stations.data?.find((item) => item.station_id === data.get('station_id'))
    createShift.mutate({
      location: data.get('location') || station?.name || 'District coverage', station_id: data.get('station_id') || null,
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
    <div className="ui-page" data-view="scheduling">
      <PageHeader title="Scheduling" description="Plan coverage for a day, staff each shift, and track clock events against required headcount." actions={<WriteButton variant="primary" onClick={() => { createShift.reset(); setShiftDialog(true) }}><Plus aria-hidden="true" />Create shift</WriteButton>} />
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {(shifts.isError || liveShifts.isError) && <ErrorState message={shifts.error?.message || liveShifts.error?.message} retry={() => { shifts.refetch(); liveShifts.refetch() }} />}

      <div className="ui-toolbar">
        <div className={styles.dateControls}>
          <Button onClick={() => moveDay(-1)} aria-label="Previous day"><ChevronLeft aria-hidden="true" /></Button>
          <label className={styles.date}><input aria-label="Roster date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || dateInput())} /></label>
          <Button onClick={() => moveDay(1)} aria-label="Next day"><ChevronRight aria-hidden="true" /></Button>
          <Button onClick={() => setSelectedDate(dateInput())} disabled={selectedDate === dateInput()}>Today</Button>
        </div>
        <SearchInput label="Search shift location" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shift location" />
      </div>

      <SummaryStrip label="Coverage summary" items={[
        { label: 'Roster attendance', value: required ? `${Math.round((clocked / required) * 100)}%` : '—', detail: `${clocked} clocked in · ${required} required`, tone: required ? ratioTone(clocked / required * 100) : undefined },
        { label: 'Shifts in view', value: scopedLive.length, detail: 'selected date and scope' },
        { label: 'Staffing gaps', value: gaps, detail: 'shifts below minimum', tone: gaps ? 'bad' : undefined },
        { label: 'Scheduled roster', value: scopedLive.reduce((sum, shift) => sum + shift.assigned_count, 0), detail: 'personnel linked to live shifts' },
      ]} />

      <div className="ui-workspace" data-inspector="true">
        <div className={styles.main}>
          <section className={cn('ui-stage', styles.duty)} aria-labelledby="duty-heading">
            <header className="ui-stage-header">
              <div><h2 id="duty-heading">Duty timeline</h2><p>{formatDate(`${selectedDate}T12:00:00`, 'EEEE, MMMM d')} · recorded shift windows grouped by apparatus assignment</p></div>
              <ul className={styles.dutyLegend} aria-label="Timeline legend"><li><i data-state="covered" />Covered</li><li><i data-state="gap" />Below minimum</li><li><i data-state="cancelled" />Cancelled</li></ul>
            </header>
            <div className={styles.dutyScroll} tabIndex={0} role="region" aria-label="Duty timeline by hour">
              <div className={styles.dutyCanvas}>
                <div className={styles.dutyHead}><span>Shift / apparatus</span><div>{[0, 4, 8, 12, 16, 20, 24].map(hour => <b key={hour} style={{ left: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, '0')}00</b>)}</div><span>Present / min</span></div>
                {shifts.isLoading ? <LoadingState rows={6} /> : dutyRows.map(row => {
                  const left = Math.max(0, (new Date(row.shift.start_time).getTime() - dayStart) / dayLength * 100)
                  const right = Math.min(100, (new Date(row.shift.end_time).getTime() - dayStart) / dayLength * 100)
                  const cancelled = row.shift.status === 'CANCELLED'
                  const gap = row.present !== undefined && row.required !== undefined && row.present < row.required
                  const state = cancelled ? 'cancelled' : gap ? 'gap' : 'covered'
                  return (
                    <button type="button" key={row.id} className={styles.dutyRow} data-ui="duty-row" aria-pressed={selected?.shift_id === row.shift.shift_id} onClick={() => select(row.shift.shift_id)} aria-label={`Inspect ${row.label}, ${cancelled ? 'cancelled' : `${row.present ?? 'unreported'} present, ${row.required ?? 'unreported'} required`}`}>
                      <strong>{row.label}</strong>
                      <span className={styles.dutyTrack}>{[4, 8, 12, 16, 20].map(hour => <i key={hour} style={{ left: `${hour / 24 * 100}%` }} />)}<span className={styles.dutyWindow} data-ui="duty-window" data-state={state} style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}>{formatDate(row.shift.start_time, 'HHmm')}–{formatDate(row.shift.end_time, 'HHmm')}{new Date(row.shift.end_time).getDate() !== new Date(row.shift.start_time).getDate() ? ' +1D' : ''}</span></span>
                      <span className={styles.dutyCount} data-state={state}><span className="ui-num">{row.present ?? '—'} / {row.required ?? '—'}</span><small>{cancelled ? 'Cancelled' : gap ? 'Gap' : row.present === undefined ? 'Unreported' : 'Covered'}</small></span>
                    </button>
                  )
                })}
                {!shifts.isLoading && !dutyRows.length && <p className="ui-empty-inline">No recorded windows for this day. Select another date or create a shift.</p>}
              </div>
            </div>
            <p className="ui-stage-note">Select a row to inspect its parent shift. Rows are actual roster groups, not separate station shifts.</p>
          </section>

          <div className={styles.pair}>
            <Panel title="Shifts on this day" description={`${filteredShifts.length} scheduled`} flush>
              {shifts.isLoading ? <LoadingState rows={3} /> : (
                <ul className="ui-list">
                  {filteredShifts.map((shift) => {
                    const live = liveShifts.data?.find((item) => item.shift_id === shift.shift_id)
                    const coverage = live ? Math.min(100, Math.round((live.clocked_in_count / shift.required_headcount) * 100)) : 0
                    return <li key={shift.shift_id}><button type="button" className="ui-list-row" data-ui="shift-row" aria-pressed={selected?.shift_id === shift.shift_id} onClick={() => select(shift.shift_id)}><span className="ui-mono" style={{ fontSize: '0.875rem' }}>{formatDate(shift.start_time, 'HH:mm')}</span><span className="ui-list-main"><strong>{shift.location}</strong><small>{live ? `${live.clocked_in_count}/${shift.required_headcount} clocked in` : `${shift.required_headcount} required`} · {titleCase(shift.status)}</small></span><StatusBadge tone={shiftTone(live?.status || shift.status)}>{live ? `${coverage}%` : titleCase(shift.status)}</StatusBadge></button></li>
                  })}
                </ul>
              )}
              {!shifts.isLoading && !filteredShifts.length && <EmptyState title="No shifts scheduled" description="Create a shift for this date or select another day." icon={CalendarDays} action={<WriteButton variant="primary" onClick={() => setShiftDialog(true)}><Plus aria-hidden="true" />Create shift</WriteButton>} />}
            </Panel>
            <Panel title="Shift activity" description="Clock, roster, and lifecycle events from the audit history" flush>
              <ul className="ui-list">
                {shiftActivity.map((event) => <li key={event.audit_id} className="ui-list-row"><span className="ui-list-main"><strong style={{ fontWeight: 500 }}>{event.summary}</strong><small>{event.actor} · {formatRelativeTime(event.created_at)}</small></span><StatusBadge tone="neutral" dot={false}>{titleCase(event.action)}</StatusBadge></li>)}
              </ul>
              {!shiftActivity.length && <p className="ui-empty-inline">No shift events in this view.</p>}
            </Panel>
          </div>
        </div>

        <Inspector label="Shift details" open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)} recordKey={selected?.shift_id}>
          {selected ? <>
            <InspectorHeader kind="Shift" title={selected.location} headingId="shift-heading" subtitle={`${formatDate(selected.start_time, 'EEEE · MMM d')} · ${formatDate(selected.start_time, 'HH:mm')} – ${formatDate(selected.end_time, 'HH:mm')}`} badge={<StatusBadge tone={shiftTone(liveSelected?.status || selected.status)}>{titleCase(liveSelected?.status || selected.status)}</StatusBadge>} />
            <InspectorBody>
              <dl className="ui-facts">
                <div><dt>Clocked in</dt><dd className="ui-num">{liveSelected?.clocked_in_count ?? 0}</dd></div>
                <div><dt>Assigned</dt><dd className="ui-num">{liveSelected?.assigned_count ?? 0}</dd></div>
                <div><dt>Required</dt><dd className="ui-num">{selected.required_headcount}</dd></div>
              </dl>
              <Section title="Apparatus coverage" meta="attendance against unit minimums">
                <div className={cn('ui-table-wrap', styles.ledger)} tabIndex={0} role="region" aria-label="Apparatus coverage ledger">
                  <table className="ui-table" data-ui="coverage-ledger">
                    <thead><tr><th scope="col">Apparatus</th><th scope="col" className="ui-num">Present</th><th scope="col" className="ui-num">Min</th><th scope="col">Posture</th></tr></thead>
                    <tbody>{ledger.map(row => <tr key={row.unit.unit_id}><th scope="row"><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unit.unit_id)}`}>{row.unit.unit_name}</Link></th><td className="ui-num">{row.present}</td><td className="ui-num">{row.unit.minimum_staff}</td><td><StatusBadge tone={row.present >= row.unit.minimum_staff ? 'success' : 'danger'}>{row.present >= row.unit.minimum_staff ? 'Covered' : `${row.unit.minimum_staff - row.present} short`}</StatusBadge></td></tr>)}</tbody>
                  </table>
                  {!ledger.length && <p className="ui-empty-inline">No apparatus assignments recorded for this shift.</p>}
                </div>
              </Section>
              <Section title="Roster" meta="clock status updates readiness immediately">
                <InlineError message={clockAction.error?.message} />
                <ul className={styles.roster}>
                  {rosterPage.rows.map((person) => {
                    const present = Boolean(person.clocked_in_at && !person.clocked_out_at)
                    return (
                      <li key={person.personnel_id} data-ui="roster-row">
                        <i data-present={present || undefined} aria-hidden="true" />
                        <span><strong>{person.name}</strong><small>{titleCase(person.status)} · {unitList.find(unit => unit.unit_id === person.unit_id)?.unit_name || `Unit ${person.unit_id.slice(0, 8)}`}</small></span>
                        {present
                          ? <WriteButton onClick={() => clockAction.mutate({ shiftId: selected.shift_id, personnelId: person.personnel_id, action: 'out' })} busy={clockAction.isPending}><LogOut aria-hidden="true" />Clock out</WriteButton>
                          : <WriteButton onClick={() => clockAction.mutate({ shiftId: selected.shift_id, personnelId: person.personnel_id, action: 'in' })} busy={clockAction.isPending}><LogIn aria-hidden="true" />Clock in</WriteButton>}
                      </li>
                    )
                  })}
                </ul>
                {!liveSelected?.assigned_personnel.length && <p className="ui-empty-inline" style={{ padding: 0 }}>No personnel assigned to this shift.</p>}
                {liveSelected?.assigned_personnel.length ? <Pagination {...rosterPage} /> : null}
              </Section>
              {selected.notes && <Section title="Shift notes"><p style={{ color: 'var(--ink-2)', fontSize: '0.875rem' }}>{selected.notes}</p></Section>}
            </InspectorBody>
            <InspectorFooter>
              <div className="ui-inspector-actions">
                <WriteButton variant="primary" onClick={() => { assignPerson.reset(); setRosterDialog(true) }} disabled={selected.status === 'CANCELLED'}><UserPlus aria-hidden="true" />Add to roster</WriteButton>
                <ConfirmAction title="Cancel this shift?" description={`${selected.location}: linked roster assignments will be cancelled and clocked-in personnel released.`} onConfirm={() => cancelShift.mutateAsync(selected.shift_id)} disabled={selected.status === 'CANCELLED'}><XCircle aria-hidden="true" />Cancel shift</ConfirmAction>
              </div>
            </InspectorFooter>
          </> : <EmptyState title="Select a shift" description="Choose a row on the duty timeline to review its coverage and roster." />}
        </Inspector>
      </div>

      <FormDialog open={shiftDialog} onOpenChange={setShiftDialog} title="Create shift" description="Define the station, time window, and minimum coverage target." submitLabel="Create shift" submitting={createShift.isPending} error={createShift.error?.message} onSubmit={submitShift}>
        <div className="ui-form-grid">
          <Field label="Station"><select className="ui-select" name="station_id" defaultValue={stationId === 'all' ? '' : stationId} required><option value="">Select station</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field>
          <Field label="Location override"><input className="ui-input" name="location" placeholder="Defaults to station name" /></Field>
          <Field label="Start"><input className="ui-input" type="datetime-local" name="start_time" required /></Field>
          <Field label="End"><input className="ui-input" type="datetime-local" name="end_time" required /></Field>
          <Field label="Required headcount"><input className="ui-input" type="number" min="1" name="required_headcount" defaultValue="7" required /></Field>
        </div>
        <Field label="Shift notes"><textarea className="ui-input" name="notes" /></Field>
      </FormDialog>
      <FormDialog open={rosterDialog} onOpenChange={setRosterDialog} title={`Add to ${selected?.location || 'shift'}`} description="The service validates active personnel, unit availability, and assignment overlap." submitLabel="Add to roster" submitting={assignPerson.isPending} error={assignPerson.error?.message} onSubmit={submitRoster}>
        <Field label="Personnel"><select className="ui-select" name="personnel_id" required><option value="">Select available personnel</option>{personnel.data?.filter((person) => !liveSelected?.assigned_personnel.some((assigned) => assigned.personnel_id === person.personnel_id)).map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.name} · {titleCase(person.availability_status)}</option>)}</select></Field>
      </FormDialog>
    </div>
  )
}
