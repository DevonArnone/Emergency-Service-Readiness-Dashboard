'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import ToastContainer, { ToastMessage } from '@/components/ToastContainer'
import CreateModal from '@/components/CreateModal'

interface UnitReadiness {
  unit_id: string
  unit_name: string
  unit_type: string
  readiness_score: number
  staff_required: number
  staff_present: number
  certifications_missing: string[]
  expired_certifications: string[]
  is_understaffed: boolean
  issues: string[]
  assigned_personnel: Array<{ personnel_id: string; name: string; role: string; certifications: string[] }>
  timestamp: string
}

interface Alert {
  alert_id: string
  alert_type: string
  state: string
  message: string
  unit_id?: string
  station_id?: string
  created_at?: string
  acknowledged_by?: string
}

interface Recommendation {
  recommendation_id: string
  unit_id: string
  action_type: string
  message: string
  priority: string
}

type FilterType = 'ALL' | 'CRITICAL' | 'DEGRADED' | 'READY'
type UnitTypeFilter = 'ALL' | 'ENGINE' | 'LADDER' | 'RESCUE' | 'MEDIC' | 'SAR_TEAM'

const UNIT_TYPE_LABELS: Record<string, string> = {
  ENGINE: 'Engine', LADDER: 'Ladder', RESCUE: 'Rescue', MEDIC: 'Medic', SAR_TEAM: 'SAR',
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 85) return 'bg-emerald-400'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function scoreBorder(score: number) {
  if (score >= 85) return 'border-emerald-400/20'
  if (score >= 60) return 'border-amber-400/20'
  return 'border-red-400/30'
}

function alertTypeBadge(type: string) {
  if (type === 'UNDERSTAFFED_UNIT') return 'bg-red-500/10 text-red-300 border-red-500/30'
  if (type.includes('CERT')) return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
  return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
}

function priorityBadge(p: string) {
  if (p === 'CRITICAL') return 'bg-red-500/10 text-red-300 border-red-500/30'
  if (p === 'HIGH') return 'bg-orange-500/10 text-orange-300 border-orange-500/30'
  return 'bg-amber-500/10 text-amber-300 border-amber-500/30'
}

export default function OperationsPage() {
  const [units, setUnits] = useState<UnitReadiness[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState<UnitReadiness | null>(null)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [typeFilter, setTypeFilter] = useState<UnitTypeFilter>('ALL')
  const [wsConnected, setWsConnected] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [showCreatePersonnel, setShowCreatePersonnel] = useState(false)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [certsList, setCertsList] = useState<any[]>([])
  const [personnelList, setPersonnelList] = useState<any[]>([])
  const [unitsList, setUnitsList] = useState<any[]>([])
  const [selectedCertExp, setSelectedCertExp] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const wsRef = useRef<Map<string, WebSocket>>(new Map())

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const addToast = (message: string, type: ToastMessage['type'] = 'warning') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const fetchAll = useCallback(async () => {
    try {
      const [unitRes, alertRes, recRes] = await Promise.all([
        fetch(`${apiBase}/api/readiness/units`),
        fetch(`${apiBase}/api/alerts`),
        fetch(`${apiBase}/api/recommendations`),
      ])
      if (unitRes.ok) setUnits(await unitRes.json())
      if (alertRes.ok) setAlerts(await alertRes.json())
      if (recRes.ok) setRecommendations(await recRes.json())
    } catch { /* backend unavailable */ }
    setLoading(false)
  }, [apiBase])

  const fetchSupportData = useCallback(async () => {
    try {
      const [cRes, pRes, uRes] = await Promise.all([
        fetch(`${apiBase}/api/certifications`),
        fetch(`${apiBase}/api/personnel`),
        fetch(`${apiBase}/api/units`),
      ])
      if (cRes.ok) setCertsList(await cRes.json())
      if (pRes.ok) setPersonnelList(await pRes.json())
      if (uRes.ok) setUnitsList(await uRes.json())
    } catch { /* backend unavailable */ }
  }, [apiBase])

  const resetDemo = useCallback(async () => {
    setLoading(true)
    try { await fetch(`${apiBase}/api/demo/reset`, { method: 'POST' }) } catch { /* ignore */ }
    await fetchAll()
    await fetchSupportData()
  }, [apiBase, fetchAll, fetchSupportData])

  useEffect(() => { fetchAll(); fetchSupportData() }, [fetchAll, fetchSupportData])

  // Per-unit WebSockets
  useEffect(() => {
    if (!units.length) return
    const currentIds = new Set(units.map((u) => u.unit_id))

    wsRef.current.forEach((ws, uid) => {
      if (!currentIds.has(uid)) { ws.close(); wsRef.current.delete(uid) }
    })

    units.forEach((unit) => {
      if (wsRef.current.has(unit.unit_id)) return
      const wsUrl = apiBase.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws/unit-readiness/${unit.unit_id}`)
      ws.onopen = () => setWsConnected((p) => {
        const next = new Set(p)
        next.add(unit.unit_id)
        return next
      })
      ws.onclose = () => { setWsConnected((p) => { const n = new Set(p); n.delete(unit.unit_id); return n }); wsRef.current.delete(unit.unit_id) }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'unit_readiness') {
            setUnits((prev) => {
              const old = prev.find((u) => u.unit_id === msg.data.unit_id)
              if (old?.is_understaffed === false && msg.data.is_understaffed)
                addToast(`${msg.data.unit_name} is now UNDERSTAFFED`, 'error')
              return prev.map((u) => u.unit_id === msg.data.unit_id ? msg.data : u)
            })
          }
        } catch { /* ignore */ }
      }
      wsRef.current.set(unit.unit_id, ws)
    })

    const connections = wsRef.current
    return () => { connections.forEach((ws) => ws.close()); connections.clear() }
  }, [apiBase, units.map((u) => u.unit_id).sort().join(',')])  // eslint-disable-line

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`${apiBase}/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'Duty Officer' }),
      })
      fetchAll()
      addToast('Alert acknowledged', 'success')
    } catch { addToast('Failed to acknowledge alert', 'error') }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      await fetch(`${apiBase}/api/alerts/${alertId}/resolve`, { method: 'POST' })
      fetchAll()
      addToast('Alert resolved', 'success')
    } catch { addToast('Failed to resolve alert', 'error') }
  }

  // Filtering
  const filtered = units.filter((u) => {
    const stateOk =
      filter === 'ALL' ||
      (filter === 'CRITICAL' && u.readiness_score < 60) ||
      (filter === 'DEGRADED' && u.readiness_score >= 60 && u.readiness_score < 85) ||
      (filter === 'READY' && u.readiness_score >= 85)
    const typeOk = typeFilter === 'ALL' || u.unit_type === typeFilter
    return stateOk && typeOk
  })

  const openAlerts = alerts.filter((a) => a.state === 'OPEN')
  const ackAlerts = alerts.filter((a) => a.state === 'ACKNOWLEDGED')
  const unitRecs = selectedUnit ? recommendations.filter((r) => r.unit_id === selectedUnit.unit_id) : []

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading operations board…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="ops-page">
        <div className="ops-shell space-y-6">

          {/* Header */}
          <div className="surface-header">
            <div>
              <div className="panel-kicker">Ridgecrest ESD</div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-4xl">Operations Board</h1>
              <p className="mt-1 text-sm text-slate-400">Live unit posture, alert queue, and deployment readiness.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={resetDemo} className="ops-button-secondary text-xs py-2 px-4">↺ Load Demo Data</button>
              <button onClick={() => setShowCreatePersonnel(true)} className="ops-button-secondary text-xs py-2 px-4">+ Personnel</button>
              <button onClick={() => setShowCreateUnit(true)} className="ops-button-secondary text-xs py-2 px-4">+ Unit</button>
              <button onClick={() => setShowCreateAssignment(true)} className="ops-button-secondary text-xs py-2 px-4">+ Assignment</button>
              <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${wsConnected.size > 0 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-slate-600 text-slate-500'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${wsConnected.size > 0 ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
                {wsConnected.size} live
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Units', value: units.length, cls: 'text-white' },
              { label: 'Ready (≥85%)', value: units.filter((u) => u.readiness_score >= 85).length, cls: 'text-emerald-400' },
              { label: 'Degraded',    value: units.filter((u) => u.readiness_score >= 60 && u.readiness_score < 85).length, cls: 'text-amber-400' },
              { label: 'Critical',   value: units.filter((u) => u.readiness_score < 60).length, cls: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="stat-panel">
                <div className="stat-label">{s.label}</div>
                <div className={`stat-value ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* ── Left: Unit grid ─────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'CRITICAL', 'DEGRADED', 'READY'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`filter-chip ${filter === f ? 'filter-chip-active' : ''}`}
                  >
                    {f}
                  </button>
                ))}
                <span className="mx-1 text-slate-700">|</span>
                {(['ALL', 'ENGINE', 'LADDER', 'RESCUE', 'MEDIC', 'SAR_TEAM'] as UnitTypeFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`filter-chip ${typeFilter === t ? 'filter-chip-active' : ''}`}
                  >
                    {t === 'ALL' ? 'All Types' : UNIT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="ops-panel py-12 text-center">
                  <p className="text-sm text-slate-500">No units match the current filters.</p>
                  {units.length === 0 && (
                    <p className="mt-2 text-xs text-slate-600">Use the buttons above to create units or reset demo data via POST /api/demo/reset.</p>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.sort((a, b) => a.readiness_score - b.readiness_score).map((unit) => {
                    const isSelected = selectedUnit?.unit_id === unit.unit_id
                    const unitAlerts = openAlerts.filter((a) => a.unit_id === unit.unit_id)
                    return (
                      <button
                        key={unit.unit_id}
                        onClick={() => setSelectedUnit(isSelected ? null : unit)}
                        className={`ops-panel w-full text-left transition hover:border-white/20 ${scoreBorder(unit.readiness_score)} ${isSelected ? 'ring-1 ring-cyan-400/30' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                              {UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}
                            </div>
                            <div className="mt-0.5 truncate text-sm font-semibold text-white">{unit.unit_name}</div>
                          </div>
                          <div className={`shrink-0 text-2xl font-semibold ${scoreColor(unit.readiness_score)}`}>
                            {unit.readiness_score}%
                          </div>
                        </div>

                        <div className="mt-3 h-1 w-full rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${scoreBg(unit.readiness_score)}`} style={{ width: `${unit.readiness_score}%` }} />
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>Staff {unit.staff_present}/{unit.staff_required}</span>
                          <div className="flex items-center gap-1.5">
                            {unitAlerts.length > 0 && (
                              <span className="rounded border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-[10px] text-red-400">{unitAlerts.length} alert{unitAlerts.length > 1 ? 's' : ''}</span>
                            )}
                            {wsConnected.has(unit.unit_id) && (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Right: Alert queue ───────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="ops-panel">
                <div className="panel-kicker">Alert Queue</div>
                <div className="mt-3 space-y-2">
                  {openAlerts.length === 0 && ackAlerts.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">No alerts</p>
                  ) : (
                    <>
                      {openAlerts.map((a) => (
                        <div key={a.alert_id} className={`rounded-xl border p-3 text-xs ${alertTypeBadge(a.alert_type)}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="leading-5">{a.message}</p>
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            <button onClick={() => acknowledgeAlert(a.alert_id)} className="rounded border border-current px-2 py-0.5 text-[10px] hover:bg-white/10">Ack</button>
                            <button onClick={() => resolveAlert(a.alert_id)} className="rounded border border-current px-2 py-0.5 text-[10px] hover:bg-white/10">Resolve</button>
                          </div>
                        </div>
                      ))}
                      {ackAlerts.map((a) => (
                        <div key={a.alert_id} className="rounded-xl border border-slate-700 bg-slate-700/20 p-3 text-xs text-slate-400">
                          <p className="leading-5">{a.message}</p>
                          <div className="mt-1 text-[10px] text-slate-600">Acknowledged · {a.acknowledged_by ?? 'Unknown'}</div>
                          <button onClick={() => resolveAlert(a.alert_id)} className="mt-1.5 rounded border border-slate-600 px-2 py-0.5 text-[10px] hover:bg-white/5">Resolve</button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Unit action drawer ─────────────────────────────────────────── */}
          {selectedUnit && (
            <div className="ops-panel">
              <div className="flex items-start justify-between">
                <div>
                  <div className="panel-kicker">Unit Detail</div>
                  <h2 className="mt-1 text-lg font-semibold text-white">{selectedUnit.unit_name}</h2>
                </div>
                <button onClick={() => setSelectedUnit(null)} className="text-slate-500 hover:text-slate-300 text-sm">✕ Close</button>
              </div>

              <div className="mt-5 grid gap-6 md:grid-cols-3">
                {/* Staffing */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3">Staffing</div>
                  <div className={`text-3xl font-semibold mb-1 ${scoreColor(selectedUnit.readiness_score)}`}>{selectedUnit.readiness_score}%</div>
                  <div className="text-sm text-slate-400 mb-3">{selectedUnit.staff_present} of {selectedUnit.staff_required} required</div>
                  {selectedUnit.issues.map((iss, i) => (
                    <div key={i} className="mt-1 flex items-center gap-2 text-xs text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                      {iss}
                    </div>
                  ))}
                </div>

                {/* Crew */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3">Assigned Crew</div>
                  {selectedUnit.assigned_personnel.length === 0 ? (
                    <p className="text-xs text-slate-500">No crew assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedUnit.assigned_personnel.map((p) => (
                        <div key={p.personnel_id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="text-xs font-medium text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{p.role}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.certifications.slice(0, 4).map((c) => (
                              <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-slate-300">{c}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3">Recommended Actions</div>
                  {unitRecs.length === 0 ? (
                    <p className="text-xs text-slate-500">No actions recommended</p>
                  ) : (
                    <div className="space-y-2">
                      {unitRecs.map((r) => (
                        <div key={r.recommendation_id} className={`rounded-lg border px-3 py-2 text-xs ${priorityBadge(r.priority)}`}>
                          <div className="font-medium uppercase tracking-wide text-[10px] mb-1">{r.action_type}</div>
                          <p className="leading-5">{r.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create modals (same forms as before, dark-styled) */}
      <CreateModal isOpen={showCreatePersonnel} onClose={() => { setShowCreatePersonnel(false); setSelectedCertExp({}) }} title="Add Personnel"
        onSubmit={async (e) => {
          e.preventDefault(); setCreating(true)
          const fd = new FormData(e.currentTarget)
          const certs = fd.getAll('certifications') as string[]
          const cert_expirations: Record<string, string> = {}
          certs.forEach((name) => {
            const d = fd.get(`cert_expiration_${name}`) as string
            if (d) { try { cert_expirations[name] = new Date(d + 'T23:59:59.000Z').toISOString() } catch { } }
          })
          try {
            const res = await fetch(`${apiBase}/api/personnel`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: fd.get('name'), rank: fd.get('rank') || undefined, role: fd.get('role'), certifications: certs, cert_expirations, availability_status: fd.get('availability_status') || 'AVAILABLE', station_id: fd.get('station_id') || undefined }),
            })
            if (!res.ok) throw new Error(await res.text())
            setShowCreatePersonnel(false); fetchAll(); fetchSupportData(); addToast('Personnel created', 'success')
          } catch (err) { addToast(err instanceof Error ? err.message : 'Error', 'error') }
          setCreating(false)
        }} submitLabel={creating ? 'Saving…' : 'Create'}>
        <div className="space-y-4">
          <div><label className="block text-xs text-slate-400 mb-1">Name *</label><input required name="name" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Rank</label><input name="rank" placeholder="Captain, Lieutenant…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Role *</label><input required name="role" placeholder="Firefighter, Paramedic…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Certifications</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-2">
              {certsList.map((c) => (
                <div key={c.certification_id}>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" name="certifications" value={c.name} onChange={(ev) => setSelectedCertExp((prev) => ({ ...prev, [c.name]: ev.target.checked }))} className="accent-cyan-400" />
                    {c.name} {c.category && <span className="text-slate-500">({c.category})</span>}
                  </label>
                  {selectedCertExp[c.name] && (
                    <div className="ml-5 mt-1"><label className="text-[10px] text-slate-500">Expiration</label><input type="date" name={`cert_expiration_${c.name}`} className="ml-2 rounded bg-white/[0.05] border border-white/10 px-2 py-0.5 text-xs text-white" /></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div><label className="block text-xs text-slate-400 mb-1">Status</label><select name="availability_status" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"><option value="AVAILABLE">Available</option><option value="OFF">Off</option><option value="IN_TRAINING">In Training</option><option value="DEPLOYED">Deployed</option><option value="ON_CALL">On Call</option></select></div>
          <div><label className="block text-xs text-slate-400 mb-1">Station ID</label><input name="station_id" placeholder="s1, s2…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
        </div>
      </CreateModal>

      <CreateModal isOpen={showCreateUnit} onClose={() => setShowCreateUnit(false)} title="Add Unit"
        onSubmit={async (e) => {
          e.preventDefault(); setCreating(true)
          const fd = new FormData(e.currentTarget)
          try {
            const res = await fetch(`${apiBase}/api/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_name: fd.get('unit_name'), type: fd.get('type'), minimum_staff: parseInt(fd.get('minimum_staff') as string), required_certifications: fd.getAll('required_certifications'), station_id: fd.get('station_id') || undefined }) })
            if (!res.ok) throw new Error(await res.text())
            setShowCreateUnit(false); fetchAll(); fetchSupportData(); addToast('Unit created', 'success')
          } catch (err) { addToast(err instanceof Error ? err.message : 'Error', 'error') }
          setCreating(false)
        }} submitLabel={creating ? 'Saving…' : 'Create'}>
        <div className="space-y-4">
          <div><label className="block text-xs text-slate-400 mb-1">Unit Name *</label><input required name="unit_name" placeholder="Engine 1, Medic 5…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Type *</label><select required name="type" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"><option value="ENGINE">Engine</option><option value="LADDER">Ladder</option><option value="RESCUE">Rescue</option><option value="MEDIC">Medic</option><option value="SAR_TEAM">SAR Team</option></select></div>
          <div><label className="block text-xs text-slate-400 mb-1">Min Staff *</label><input required type="number" name="minimum_staff" min="1" defaultValue="3" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Required Certifications</label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-1">
              {certsList.map((c) => (
                <label key={c.certification_id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" name="required_certifications" value={c.name} className="accent-cyan-400" />{c.name}</label>
              ))}
            </div>
          </div>
          <div><label className="block text-xs text-slate-400 mb-1">Station ID</label><input name="station_id" placeholder="s1, s2…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
        </div>
      </CreateModal>

      <CreateModal isOpen={showCreateAssignment} onClose={() => setShowCreateAssignment(false)} title="Assign Personnel"
        onSubmit={async (e) => {
          e.preventDefault(); setCreating(true)
          const fd = new FormData(e.currentTarget)
          try {
            const res = await fetch(`${apiBase}/api/unit-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unit_id: fd.get('unit_id'), personnel_id: fd.get('personnel_id'), shift_start: new Date(`${fd.get('date')}T${fd.get('start_time')}`).toISOString(), shift_end: new Date(`${fd.get('date')}T${fd.get('end_time')}`).toISOString(), assignment_status: 'ON_SHIFT' }) })
            if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error') }
            setShowCreateAssignment(false); fetchAll(); addToast('Assignment created', 'success')
          } catch (err) { addToast(err instanceof Error ? err.message : 'Error', 'error') }
          setCreating(false)
        }} submitLabel={creating ? 'Saving…' : 'Assign'}>
        <div className="space-y-4">
          <div><label className="block text-xs text-slate-400 mb-1">Unit *</label><select required name="unit_id" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"><option value="">Select unit</option>{unitsList.map((u) => <option key={u.unit_id} value={u.unit_id}>{u.unit_name}</option>)}</select></div>
          <div><label className="block text-xs text-slate-400 mb-1">Personnel *</label><select required name="personnel_id" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"><option value="">Select person</option>{personnelList.map((p) => <option key={p.personnel_id} value={p.personnel_id}>{p.name}</option>)}</select></div>
          <div><label className="block text-xs text-slate-400 mb-1">Date *</label><input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-slate-400 mb-1">Start *</label><input type="time" name="start_time" required className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">End *</label><input type="time" name="end_time" required className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
          </div>
        </div>
      </CreateModal>
    </>
  )
}
