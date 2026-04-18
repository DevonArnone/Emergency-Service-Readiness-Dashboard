'use client'

import { useEffect, useState, useCallback } from 'react'

interface Personnel {
  personnel_id: string
  name: string
  rank?: string
  role: string
  certifications: string[]
  cert_expirations?: Record<string, string>
  availability_status: string
  station_id?: string
  current_unit_id?: string
}

interface Unit {
  unit_id: string
  unit_name: string
  type: string
  minimum_staff: number
  required_certifications: string[]
  station_id?: string
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:   'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  OFF:         'bg-slate-500/10 text-slate-400 border-slate-500/30',
  IN_TRAINING: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  DEPLOYED:    'bg-orange-500/10 text-orange-300 border-orange-500/30',
  ON_CALL:     'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Deployable', OFF: 'Off Duty', IN_TRAINING: 'Training', DEPLOYED: 'Deployed', ON_CALL: 'On Call',
}

const UNIT_COLORS: Record<string, string> = {
  ENGINE: 'bg-red-500/10 text-red-300 border-red-500/30',
  LADDER: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  RESCUE: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  MEDIC:  'bg-blue-500/10 text-blue-300 border-blue-500/30',
  SAR_TEAM: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
}

function isExpiringSoon(dateStr?: string): boolean {
  if (!dateStr) return false
  const exp = new Date(dateStr)
  const delta = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return delta >= 0 && delta <= 30
}

function isExpired(dateStr?: string): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function certExpLabel(dateStr?: string): string {
  if (!dateStr) return ''
  const exp = new Date(dateStr)
  const delta = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (delta < 0) return `Expired ${Math.abs(delta)}d ago`
  if (delta <= 30) return `Expires in ${delta}d`
  return exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WorkforcePage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [certsList, setCertsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'personnel' | 'units'>('personnel')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [stationFilter, setStationFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null)
  const [creating, setCreating] = useState(false)
  const [showAddPersonnel, setShowAddPersonnel] = useState(false)
  const [certExpCheck, setCertExpCheck] = useState<Record<string, boolean>>({})

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, uRes, cRes] = await Promise.all([
        fetch(`${apiBase}/api/personnel`),
        fetch(`${apiBase}/api/units`),
        fetch(`${apiBase}/api/certifications`),
      ])
      if (pRes.ok) setPersonnel(await pRes.json())
      if (uRes.ok) setUnits(await uRes.json())
      if (cRes.ok) setCertsList(await cRes.json())
    } catch { /* backend offline */ }
    setLoading(false)
  }, [apiBase])

  useEffect(() => { fetchAll() }, [fetchAll])

  const stations = Array.from(new Set(personnel.map((p) => p.station_id).filter(Boolean)))

  const filteredPersonnel = personnel.filter((p) => {
    const matchStatus = statusFilter === 'ALL' || p.availability_status === statusFilter
    const matchStation = stationFilter === 'ALL' || p.station_id === stationFilter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.role.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchStation && matchSearch
  })

  const deployable = filteredPersonnel.filter((p) => p.availability_status === 'AVAILABLE')
  const constrained = filteredPersonnel.filter((p) => p.availability_status !== 'AVAILABLE')

  const expiredCertCount = personnel.reduce((acc, p) => {
    if (!p.cert_expirations) return acc
    return acc + Object.values(p.cert_expirations).filter(isExpired).length
  }, 0)
  const expiringSoonCount = personnel.reduce((acc, p) => {
    if (!p.cert_expirations) return acc
    return acc + Object.values(p.cert_expirations).filter((d) => isExpiringSoon(d) && !isExpired(d)).length
  }, 0)

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading workforce…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ops-page">
      <div className="ops-shell space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="panel-kicker">Ridgecrest ESD</div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">Workforce</h1>
            <p className="mt-1 text-sm text-slate-400">Personnel status, qualification matrix, and credential exposure.</p>
          </div>
          <button onClick={() => setShowAddPersonnel(true)} className="ops-button-primary text-sm">+ Add Personnel</button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Personnel', value: personnel.length, cls: 'text-white' },
            { label: 'Deployable',      value: personnel.filter((p) => p.availability_status === 'AVAILABLE').length, cls: 'text-emerald-400' },
            { label: 'Certs Expiring',  value: expiringSoonCount, cls: 'text-amber-400' },
            { label: 'Certs Expired',   value: expiredCertCount,  cls: 'text-red-400' },
          ].map((s) => (
            <div key={s.label} className="stat-panel">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1 w-fit">
          {(['personnel', 'units'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === 'personnel' ? 'Personnel' : 'Units'}
            </button>
          ))}
        </div>

        {tab === 'personnel' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or role…" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
              {['ALL', 'AVAILABLE', 'OFF', 'IN_TRAINING', 'DEPLOYED', 'ON_CALL'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statusFilter === s ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                  {s === 'ALL' ? 'All Status' : STATUS_LABELS[s] ?? s}
                </button>
              ))}
              {stations.map((st) => (
                <button key={st} onClick={() => setStationFilter(stationFilter === st ? 'ALL' : st!)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${stationFilter === st ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                  {st}
                </button>
              ))}
            </div>

            {/* Personnel table */}
            <div className="ops-panel overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Name / Rank</th>
                      <th>Role</th>
                      <th>Station</th>
                      <th>Status</th>
                      <th>Certifications</th>
                      <th>Credential Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredPersonnel.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-slate-500">No personnel found</td></tr>
                    )}
                    {filteredPersonnel.map((p) => {
                      const hasExpired = Object.values(p.cert_expirations ?? {}).some(isExpired)
                      const hasSoon = Object.values(p.cert_expirations ?? {}).some((d) => isExpiringSoon(d) && !isExpired(d))
                      return (
                        <tr key={p.personnel_id} className={`cursor-pointer transition hover:bg-white/[0.03] ${selectedPerson?.personnel_id === p.personnel_id ? 'bg-white/[0.04]' : ''}`} onClick={() => setSelectedPerson(selectedPerson?.personnel_id === p.personnel_id ? null : p)}>
                          <td>
                            <div className="font-medium text-white">{p.name}</div>
                            {p.rank && <div className="text-xs text-slate-500 mt-0.5">{p.rank}</div>}
                          </td>
                          <td className="text-slate-300">{p.role}</td>
                          <td className="text-slate-400 text-xs">{p.station_id ?? '—'}</td>
                          <td>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[p.availability_status] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/30'}`}>
                              {STATUS_LABELS[p.availability_status] ?? p.availability_status}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {p.certifications.slice(0, 4).map((c) => (
                                <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">{c}</span>
                              ))}
                              {p.certifications.length > 4 && <span className="text-[10px] text-slate-500">+{p.certifications.length - 4}</span>}
                            </div>
                          </td>
                          <td>
                            {hasExpired && <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-400 mr-1">Expired</span>}
                            {hasSoon && !hasExpired && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-400">Expiring soon</span>}
                            {!hasExpired && !hasSoon && <span className="text-[10px] text-slate-600">OK</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expanded row */}
            {selectedPerson && (
              <div className="ops-panel">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{selectedPerson.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedPerson.role} · {selectedPerson.station_id ?? 'No station'}</p>
                  </div>
                  <button onClick={() => setSelectedPerson(null)} className="text-xs text-slate-500 hover:text-slate-300">✕</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2">Certifications & Expiration</div>
                    {selectedPerson.certifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No certifications</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedPerson.certifications.map((c) => {
                          const exp = selectedPerson.cert_expirations?.[c]
                          const expired = isExpired(exp)
                          const soon = isExpiringSoon(exp)
                          return (
                            <div key={c} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                              <span className="text-xs text-slate-200">{c}</span>
                              {exp && (
                                <span className={`text-[10px] ${expired ? 'text-red-400' : soon ? 'text-amber-400' : 'text-slate-500'}`}>
                                  {certExpLabel(exp)}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2">Assignment</div>
                    <div className="text-sm text-slate-300">
                      <div>Unit: <span className="text-white">{selectedPerson.current_unit_id ?? '—'}</span></div>
                      <div className="mt-1">Status: <span className={`font-medium ${STATUS_COLORS[selectedPerson.availability_status]?.match(/text-\S+/)?.[0] ?? 'text-white'}`}>{STATUS_LABELS[selectedPerson.availability_status]}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'units' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {units.length === 0 && (
              <div className="ops-panel col-span-full py-12 text-center">
                <p className="text-sm text-slate-500">No units configured.</p>
              </div>
            )}
            {units.map((u) => (
              <div key={u.unit_id} className="ops-panel">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${UNIT_COLORS[u.type] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/30'}`}>{u.type}</span>
                    <h3 className="mt-1.5 text-sm font-semibold text-white">{u.unit_name}</h3>
                  </div>
                  <div className="text-xs text-slate-500">{u.station_id ?? '—'}</div>
                </div>
                <div className="mt-3 text-xs text-slate-400">Min staff: <span className="text-white">{u.minimum_staff}</span></div>
                {u.required_certifications.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {u.required_certifications.map((c) => (
                      <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add personnel modal */}
      {showAddPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddPersonnel(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1928] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Add Personnel</h2>
              <button onClick={() => setShowAddPersonnel(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <form onSubmit={async (e) => {
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
                setShowAddPersonnel(false); fetchAll()
              } catch { /* ignore */ }
              setCreating(false)
            }} className="space-y-4">
              <div><label className="block text-xs text-slate-400 mb-1">Name *</label><input required name="name" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Rank</label><input name="rank" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
              <div><label className="block text-xs text-slate-400 mb-1">Role *</label><input required name="role" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Certifications</label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-2 space-y-1.5">
                  {certsList.map((c) => (
                    <div key={c.certification_id}>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" name="certifications" value={c.name} onChange={(ev) => setCertExpCheck((p) => ({ ...p, [c.name]: ev.target.checked }))} className="accent-cyan-400" />{c.name}</label>
                      {certExpCheck[c.name] && <div className="ml-5 mt-1"><label className="text-[10px] text-slate-500">Expiration</label><input type="date" name={`cert_expiration_${c.name}`} className="ml-2 rounded bg-white/[0.05] border border-white/10 px-2 py-0.5 text-xs text-white" /></div>}
                    </div>
                  ))}
                </div>
              </div>
              <div><label className="block text-xs text-slate-400 mb-1">Status</label><select name="availability_status" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"><option value="AVAILABLE">Deployable</option><option value="OFF">Off Duty</option><option value="IN_TRAINING">Training</option><option value="DEPLOYED">Deployed</option><option value="ON_CALL">On Call</option></select></div>
              <div><label className="block text-xs text-slate-400 mb-1">Station ID</label><input name="station_id" placeholder="s1, s2…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPersonnel(false)} className="ops-button-secondary text-sm py-2 px-4">Cancel</button>
                <button type="submit" disabled={creating} className="ops-button-primary text-sm py-2 px-4">{creating ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
