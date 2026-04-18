'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import ToastContainer, { ToastMessage } from '@/components/ToastContainer'

interface LiveShiftStatus {
  shift_id: string
  location: string
  start_time: string
  end_time: string
  required_headcount: number
  assigned_count: number
  clocked_in_count: number
  status: string
  alerts: string[]
}

interface ShiftEvent {
  event_id?: string
  shift_id: string
  employee_id?: string
  event_type: string
  event_time: string
  payload?: Record<string, unknown>
}

interface UnitAssignment {
  assignment_id: string
  unit_id: string
  personnel_id: string
  shift_start: string
  shift_end: string
  assignment_status: string
}

const STATUS_STYLES: Record<string, string> = {
  fully_staffed: 'border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-300',
  understaffed:  'border-red-400/30 bg-red-400/[0.07] text-red-300',
  over_staffed:  'border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-300',
}

const EVENT_STYLES: Record<string, string> = {
  CLOCK_IN:            'text-emerald-400',
  CLOCK_OUT:           'text-slate-400',
  ALERT_UNDERSTAFFED:  'text-red-400',
  ALERT_OVERTIME_RISK: 'text-amber-400',
  ASSIGNED:            'text-cyan-400',
  CREATED:             'text-slate-500',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<LiveShiftStatus[]>([])
  const [events, setEvents] = useState<ShiftEvent[]>([])
  const [assignments, setAssignments] = useState<UnitAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const addToast = (msg: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((p) => [...p, { id, message: msg, type }])
  }

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/shifts/live`)
      if (res.ok) setShifts(await res.json())
    } catch { /* offline */ }
    setLoading(false)
  }, [apiBase])

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/unit-assignments`)
      if (res.ok) setAssignments(await res.json())
    } catch { /* offline */ }
  }, [apiBase])

  useEffect(() => { fetchShifts(); fetchAssignments() }, [fetchShifts, fetchAssignments])

  useEffect(() => {
    const wsUrl = apiBase.replace('http://', 'ws://').replace('https://', 'wss://')
    const ws = new WebSocket(`${wsUrl}/ws/shifts`)
    wsRef.current = ws
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)
    ws.onmessage = (ev) => {
      try {
        const msg: ShiftEvent = JSON.parse(ev.data)
        setEvents((p) => [msg, ...p].slice(0, 50))
        if (msg.event_type === 'ALERT_UNDERSTAFFED') { addToast(`Understaffing alert on shift ${msg.shift_id}`, 'error'); fetchShifts() }
        if (['CLOCK_IN', 'CLOCK_OUT'].includes(msg.event_type)) fetchShifts()
      } catch { /* non-JSON */ }
    }
    return () => { ws.close(); wsRef.current = null }
  }, [apiBase, fetchShifts]) // eslint-disable-line

  const now = new Date()
  const hours = Array.from({ length: 12 }, (_, i) => (now.getHours() - 5 + i + 24) % 24)

  function assignedAtHour(h: number) {
    return assignments.filter((a) => {
      const s = new Date(a.shift_start).getHours()
      const e = new Date(a.shift_end).getHours()
      return a.assignment_status === 'ON_SHIFT' && s <= h && h < e
    }).length
  }

  const maxStaff = Math.max(...hours.map(assignedAtHour), 1)
  const totalOnShift = assignments.filter((a) => a.assignment_status === 'ON_SHIFT').length

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading shift board…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <div className="ops-page">
        <div className="ops-shell space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="panel-kicker">Ridgecrest ESD</div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">Shifts</h1>
              <p className="mt-1 text-sm text-slate-400">Live staffing timeline, clock-in events, and gap markers.</p>
            </div>
            <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${wsConnected ? 'border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-300' : 'border-slate-600 text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
              {wsConnected ? 'Live feed connected' : 'Connecting…'}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Active Shifts',  value: shifts.length,                                          cls: 'text-white' },
              { label: 'On Shift Now',   value: totalOnShift,                                           cls: 'text-emerald-400' },
              { label: 'Understaffed',   value: shifts.filter((s) => s.status === 'understaffed').length, cls: 'text-red-400' },
              { label: 'Events Today',   value: events.length,                                          cls: 'text-cyan-400' },
            ].map((s) => (
              <div key={s.label} className="stat-panel">
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Staffing timeline */}
          <div className="ops-panel">
            <div className="panel-kicker">Staffing Timeline</div>
            <h2 className="mt-1 text-sm font-semibold text-white mb-5">Assigned personnel by hour · today</h2>
            <div className="flex items-end gap-1" style={{ height: '80px' }}>
              {hours.map((h) => {
                const count = assignedAtHour(h)
                const pct = (count / maxStaff) * 100
                const isNow = h === now.getHours()
                return (
                  <div key={h} className="group relative flex flex-1 flex-col items-center justify-end gap-0.5" style={{ height: '100%' }}>
                    <div className="absolute -top-7 left-1/2 hidden -translate-x-1/2 group-hover:block z-10 rounded bg-slate-800 border border-white/10 px-2 py-0.5 text-[10px] text-white whitespace-nowrap">
                      {`${String(h).padStart(2, '0')}:00 · ${count} staff`}
                    </div>
                    <div
                      className={`w-full rounded-sm transition-all duration-300 ${isNow ? 'bg-cyan-400' : count === 0 ? 'bg-red-400/50' : 'bg-slate-500/70'}`}
                      style={{ height: `${Math.max(pct, count === 0 ? 10 : 4)}%` }}
                    />
                    <span className={`text-[9px] ${isNow ? 'font-bold text-cyan-400' : 'text-slate-600'}`}>
                      {String(h).padStart(2, '0')}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-cyan-400" /> Current hour</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-red-400/50" /> Gap</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded bg-slate-500/70" /> Staffed</span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Shift cards */}
            <div className="space-y-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Live Shifts</div>
              {shifts.length === 0 ? (
                <div className="ops-panel py-10 text-center">
                  <p className="text-sm text-slate-500">No active shifts. Seed demo or create via POST /api/shifts.</p>
                </div>
              ) : (
                shifts.map((shift) => {
                  const pct = shift.required_headcount === 0 ? 100 : Math.min(100, Math.round((shift.clocked_in_count / shift.required_headcount) * 100))
                  const style = STATUS_STYLES[shift.status] ?? STATUS_STYLES['understaffed']
                  return (
                    <div key={shift.shift_id} className={`ops-panel border ${style}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{shift.location}</div>
                          <h3 className="mt-0.5 text-sm font-semibold text-white">{fmt(shift.start_time)} – {fmt(shift.end_time)}</h3>
                        </div>
                        <span className={`rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}>
                          {shift.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <span>Clocked in: <span className="text-white font-medium">{shift.clocked_in_count}</span> / {shift.required_headcount}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10">
                          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-400' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1.5 text-xs text-slate-500">Assigned: {shift.assigned_count}</div>
                      </div>
                      {shift.alerts.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {shift.alerts.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-red-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />{a}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Event log */}
            <div className="ops-panel">
              <div className="panel-kicker mb-3">Event Log</div>
              {events.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  Waiting for events…<br />
                  <span className="text-slate-600">Clock-ins, alerts appear here live.</span>
                </p>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {events.map((ev, i) => (
                    <div key={ev.event_id ?? i} className="flex gap-3">
                      <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${(EVENT_STYLES[ev.event_type] ?? 'text-slate-500').replace('text-', 'bg-')}`} />
                      <div>
                        <div className={`text-xs font-medium ${EVENT_STYLES[ev.event_type] ?? 'text-slate-400'}`}>
                          {ev.event_type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{fmtFull(ev.event_time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignments table */}
          <div className="ops-panel overflow-hidden p-0">
            <div className="border-b border-white/[0.06] px-6 py-4">
              <div className="panel-kicker">Today's Unit Assignments</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Unit</th><th>Personnel</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {assignments.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No assignments</td></tr>}
                  {assignments.slice(0, 25).map((a) => {
                    const sc = a.assignment_status === 'ON_SHIFT'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : a.assignment_status === 'ABSENT'
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                    return (
                      <tr key={a.assignment_id}>
                        <td className="font-mono text-xs text-slate-400">{a.unit_id.slice(-8)}</td>
                        <td className="font-mono text-xs text-slate-400">{a.personnel_id.slice(-8)}</td>
                        <td>{fmt(a.shift_start)}</td>
                        <td>{fmt(a.shift_end)}</td>
                        <td><span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${sc}`}>{a.assignment_status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
