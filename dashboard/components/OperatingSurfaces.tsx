'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { Personnel, Station, Shift, LiveShift, Unit, OperationsSnapshot, StaffingGap, CertificationRisk } from '@/lib/schemas'
import { cn, formatDate, titleCase } from '@/lib/utils'
import { SectionHeader, StatusBadge } from './ui'

export function PersonnelStationRegister({ people, stations, onInspect }: { people: Personnel[]; stations: Station[]; onInspect: (stationId: string) => void }) {
  return <section className="civic-plate"><SectionHeader title="Station personnel register" description="Select a station to inspect its roster · availability is not qualification clearance" /><div className="personnel-station-register">{stations.filter(station => people.some(person => person.station_id === station.station_id)).map(station => {
    const roster = people.filter(person => person.station_id === station.station_id)
    const states = ['DEPLOYED', 'AVAILABLE', 'ON_CALL', 'IN_TRAINING', 'OFF'] as const
    return <button type="button" key={station.station_id} onClick={() => onInspect(station.station_id)} aria-label={`Inspect personnel at ${station.name}`}><strong>{station.name.replace(/^Station /, 'ST. ').split(' — ')[0]}</strong><span className="personnel-state-track">{states.map(state => <i key={state} className={`personnel-state-${state.toLowerCase()}`} style={{ width: `${roster.filter(person => person.availability_status === state).length / roster.length * 100}%` }} />)}</span><span>{roster.length}</span></button>
  })}</div><footer className="civic-legend">{['DEPLOYED', 'AVAILABLE', 'ON_CALL', 'IN_TRAINING', 'OFF'].map(state => <span key={state}><i className={`personnel-state-${state.toLowerCase()}`} />{titleCase(state)}</span>)}</footer></section>
}

export function ShiftTimeBoard({ shifts, live, units, selectedId, date, onSelect }: { shifts: Shift[]; live: LiveShift[]; units: Unit[]; selectedId?: string; date: string; onSelect: (id: string) => void }) {
  const start = new Date(`${date}T00:00:00`).getTime()
  const end = new Date(`${date}T00:00:00`); end.setDate(end.getDate() + 1)
  const duration = end.getTime() - start
  // A countywide shift can contain many apparatus. Its rows are actual roster groups, not invented station shifts.
  const rows = shifts.flatMap<{ shift: Shift; id: string; label: string; present: number | undefined; assigned: number | undefined; required: number | undefined }>(shift => {
    const attendance = live.find(item => item.shift_id === shift.shift_id)
    const groups = new Map<string, LiveShift['assigned_personnel']>()
    attendance?.assigned_personnel.forEach(person => groups.set(person.unit_id, [...(groups.get(person.unit_id) || []), person]))
    if (!groups.size) return [{ shift, id: shift.shift_id, label: shift.location, present: attendance?.clocked_in_count, assigned: attendance?.assigned_count, required: shift.required_headcount }]
    return Array.from(groups).map(([id, crew]) => ({ shift, id: `${shift.shift_id}:${id}`, label: units.find(unit => unit.unit_id === id)?.unit_name || id, present: crew.filter(person => person.clocked_in_at && !person.clocked_out_at).length, assigned: crew.length, required: units.find(unit => unit.unit_id === id)?.minimum_staff }))
  })
  return <section className="civic-plate duty-board"><SectionHeader title="Duty-roster board" description={`${formatDate(`${date}T12:00:00`, 'EEEE, MMMM d')} · recorded shift windows and apparatus attendance`} /><div className="civic-scroll" tabIndex={0} aria-label="Duty board time ruler"><div className="duty-board-canvas"><div className="duty-board-head"><span>SHIFT / APPARATUS</span><div>{[0, 4, 8, 12, 16, 20, 24].map(hour => <span key={hour}>{String(hour).padStart(2, '0')}00</span>)}</div><span>PRESENT / MIN.</span></div><div className="duty-board-rows">{rows.map(row => {
    const left = Math.max(0, (new Date(row.shift.start_time).getTime() - start) / duration * 100)
    const right = Math.min(100, (new Date(row.shift.end_time).getTime() - start) / duration * 100)
    const cancelled = row.shift.status === 'CANCELLED'
    const gap = row.present !== undefined && row.required !== undefined && row.present < row.required
    return <button type="button" key={row.id} className={cn('duty-board-row', selectedId === row.shift.shift_id && 'is-selected')} onClick={() => onSelect(row.shift.shift_id)} aria-label={`Inspect ${row.label}, ${cancelled ? 'cancelled' : `${row.present ?? 'unreported'} present, ${row.required ?? 'unreported'} required`}`}><strong>{row.label}</strong><span className="duty-track"><i className={cn('duty-window', cancelled ? 'is-cancelled' : gap ? 'is-gap' : 'is-covered')} style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}><span>{formatDate(row.shift.start_time, 'HHmm')}–{formatDate(row.shift.end_time, 'HHmm')}{new Date(row.shift.end_time).getDate() !== new Date(row.shift.start_time).getDate() ? ' +1D' : ''}</span></i></span><span>{row.present ?? '—'} / {row.required ?? '—'}<small>{cancelled ? 'CANCELLED' : gap ? 'GAP' : row.present === undefined ? 'UNREPORTED' : 'COVERED'}</small></span></button>
  })}</div>{!rows.length && <p className="civic-empty">No recorded windows for this day. Select another date or create a shift.</p>}</div></div><footer className="civic-legend"><span><i className="is-covered" />Covered</span><span><i className="is-gap" />Below minimum</span><span><i className="is-cancelled" />Cancelled</span><span>Grouped by recorded apparatus assignment · select a row to inspect its parent shift</span></footer></section>
}

export function AttendanceCoverageLedger({ live, units }: { live?: LiveShift; units: Unit[] }) {
  const rows = units.map(unit => {
    const crew = live?.assigned_personnel.filter(person => person.unit_id === unit.unit_id) || []
    return { unit, assigned: crew.length, present: crew.filter(person => person.clocked_in_at && !person.clocked_out_at).length }
  }).filter(row => row.assigned > 0).sort((a, b) => (b.unit.minimum_staff - b.present) - (a.unit.minimum_staff - a.present))
  return <><SectionHeader title="Apparatus coverage ledger" description="Selected shift · attendance against recorded unit minimums" /><div className="civic-scroll coverage-ledger" tabIndex={0} aria-label="Apparatus coverage ledger"><table className="civic-table"><thead><tr><th>Apparatus</th><th>Present</th><th>Min.</th><th>Posture</th></tr></thead><tbody>{rows.map(row => <tr key={row.unit.unit_id}><th><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unit.unit_id)}`}>{row.unit.unit_name}</Link></th><td>{row.present}</td><td>{row.unit.minimum_staff}</td><td><StatusBadge tone={row.present >= row.unit.minimum_staff ? 'success' : 'danger'}>{row.present >= row.unit.minimum_staff ? 'Covered' : `${row.unit.minimum_staff - row.present} short`}</StatusBadge></td></tr>)}</tbody></table>{!rows.length && <p className="civic-empty">No apparatus assignments recorded for this shift.</p>}</div></>
}

export type ExpirationBand = 'all' | 'expired' | '14' | '30' | '90'
export function CredentialHorizon({ days, selected, onSelect }: { days: number[]; selected: ExpirationBand; onSelect: (band: ExpirationBand) => void }) {
  const bands: Array<{ id: ExpirationBand; label: string; test: (day: number) => boolean; tone: string }> = [
    { id: 'all', label: 'All exposure', test: () => true, tone: 'info' },
    { id: 'expired', label: 'Expired', test: day => day < 0, tone: 'danger' },
    { id: '14', label: '0–14 days', test: day => day >= 0 && day <= 14, tone: 'danger' },
    { id: '30', label: '15–30 days', test: day => day > 14 && day <= 30, tone: 'warning' },
    { id: '90', label: '31–90 days', test: day => day > 30 && day <= 90, tone: 'info' },
  ]
  return <section className="civic-plate"><SectionHeader title="Qualification expiration horizon" description="Select an expiration band to open the corresponding personnel risk docket" /><div className="expiration-horizon">{bands.map(band => { const count = days.filter(band.test).length; return <button type="button" key={band.id} aria-pressed={selected === band.id} onClick={() => onSelect(band.id)} className={`horizon-${band.tone}`}><span>{band.label}</span><strong>{count.toString().padStart(2, '0')}</strong><span className="horizon-track"><i style={{ width: `${days.length ? count / days.length * 100 : 0}%` }} /></span><small>credential records</small></button> })}</div></section>
}

export function UnitQualificationMatrix({ units }: { units: Unit[] }) {
  const codes = Array.from(new Set(units.flatMap(unit => unit.required_certifications))).sort()
  return <div className="civic-scroll" tabIndex={0} aria-label="Unit qualification matrix"><table className="civic-table qualification-matrix"><thead><tr><th>Apparatus</th><th>Minimum crew</th>{codes.map(code => <th key={code}>{code}</th>)}</tr></thead><tbody>{units.map(unit => <tr key={unit.unit_id}><th><Link href={`/readiness?view=units&unit=${encodeURIComponent(unit.unit_id)}`}>{unit.unit_name}</Link><small>{titleCase(unit.type)}</small></th><td>{unit.minimum_staff}</td>{codes.map(code => <td key={code}><span className={unit.required_certifications.includes(code) ? 'qualification-required' : 'qualification-none'}>{unit.required_certifications.includes(code) ? 'REQ' : '—'}</span></td>)}</tr>)}</tbody></table></div>
}

export function ReadinessAnalysis({ snapshot, gaps, risks }: { snapshot: OperationsSnapshot; gaps: StaffingGap[]; risks: CertificationRisk[] }) {
  const [stationId, setStationId] = useState('')
  const stations = snapshot.summary.station_summaries
  const selected = stations.find(station => station.station_id === stationId) || [...stations].sort((a, b) => a.avg_readiness - b.avg_readiness)[0]
  const exceptions = gaps.filter(gap => gap.station_id === selected?.station_id)
  const qualifications = risks.filter(risk => risk.station_id === selected?.station_id)
  return <section className="civic-plate"><SectionHeader title="Readiness drivers & station comparison" description={`Snapshot ${formatDate(snapshot.timestamp, 'MMM d · HH:mm')} · select a station to trace measured exceptions`} /><div className="analysis-console"><div className="station-comparison-grid">{stations.map(station => <button type="button" key={station.station_id} aria-pressed={selected?.station_id === station.station_id} onClick={() => setStationId(station.station_id)} className={cn('station-comparison', station.avg_readiness < 60 ? 'is-critical' : station.avg_readiness < 85 ? 'is-attention' : 'is-ready')}><span>{station.station_name.replace(/^Station /, 'ST. ').split(' — ')[0]}</span><strong>{Math.round(station.avg_readiness)}<small>%</small></strong><span className="analysis-meter"><i style={{ width: `${station.avg_readiness}%` }} /></span><small>{station.unit_count} units / {station.critical_units} critical</small></button>)}</div><div className="analysis-evidence" aria-live="polite"><h3>{selected?.station_name || 'No stations in scope'}</h3><dl className="civic-facts"><div><dt>Current readiness</dt><dd>{selected ? `${Math.round(selected.avg_readiness)}%` : '—'}</dd></div><div><dt>Staffing deficit</dt><dd>{exceptions.reduce((sum, row) => sum + row.gap, 0)} personnel</dd></div><div><dt>Credential exposure</dt><dd>{qualifications.length} records in horizon</dd></div></dl><h4>Accountable exception ledger</h4>{exceptions.filter(row => row.gap > 0).map(row => <Link className="evidence-link" key={row.unit_id} href={`/readiness?view=units&unit=${encodeURIComponent(row.unit_id)}`}><strong>{row.unit_name}</strong><span>{row.staff_present}/{row.staff_required} present</span><StatusBadge tone="danger">{row.gap} short</StatusBadge></Link>)}{qualifications.slice(0, 4).map(row => <Link className="evidence-link" key={`${row.personnel_id}:${row.cert}`} href={`/personnel?person=${encodeURIComponent(row.personnel_id)}`}><strong>{row.personnel_name}</strong><span>{row.cert}</span><StatusBadge tone={row.days_left < 0 ? 'danger' : 'warning'}>{row.days_left < 0 ? 'Expired' : `${row.days_left} days`}</StatusBadge></Link>)}{!exceptions.some(row => row.gap > 0) && !qualifications.length && <p className="civic-empty">No staffing or credential exceptions returned for this station.</p>}<div className="civic-links"><Link href={`/analytics?view=readiness&scope=${encodeURIComponent(selected?.station_id || 'all')}`}>Station trend</Link><Link href="/shifts">Duty coverage</Link><Link href="/readiness?view=simulation">Test contingency</Link></div><p className="civic-provenance">Current snapshot and selected credential horizon. Not a predictive coverage model; synthetic operational records.</p></div></div></section>
}

export function ComparisonInstrument({ before, after }: { before: number; after?: number }) {
  return <div className="comparison-instrument">{[{ label: 'Recorded baseline', value: before }, { label: 'Hypothetical result', value: after }].map(reading => <div key={reading.label}><span>{reading.label}</span><strong>{reading.value === undefined ? '—' : `${Math.round(reading.value)}%`}</strong><div className="comparison-scale"><i style={{ '--reading': `${reading.value ?? 0}%` } as CSSProperties} /></div></div>)}<p>{after === undefined ? 'Run a scenario to calculate the projected result.' : `${Math.round(after - before)} percentage-point change · live records unchanged`}</p></div>
}
