'use client'

import { useEffect, useState, useCallback } from 'react'

interface Certification {
  certification_id: string
  name: string
  description?: string
  category?: string
  typical_validity_days?: number
}

interface ExpiringEntry {
  personnel_id: string
  personnel_name: string
  certification: string
  expiration_date: string
  days_until_expiry: number
}

const CATEGORY_COLORS: Record<string, string> = {
  Fire:    'border-red-400/30 bg-red-400/10 text-red-300',
  EMS:     'border-blue-400/30 bg-blue-400/10 text-blue-300',
  Rescue:  'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
}

function categoryColor(cat?: string) {
  return CATEGORY_COLORS[cat ?? ''] ?? 'border-slate-400/30 bg-slate-400/10 text-slate-300'
}

export default function CredentialsPage() {
  const [certs, setCerts] = useState<Certification[]>([])
  const [expiring, setExpiring] = useState<ExpiringEntry[]>([])
  const [expired, setExpired] = useState<ExpiringEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lookahead, setLookahead] = useState(30)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Certification | null>(null)
  const [saving, setSaving] = useState(false)
  const [catFilter, setCatFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, expRes, exdRes] = await Promise.all([
        fetch(`${apiBase}/api/certifications`),
        fetch(`${apiBase}/api/certifications/expiring?days=${lookahead}`),
        fetch(`${apiBase}/api/certifications/expired`),
      ])
      if (cRes.ok) setCerts(await cRes.json())
      if (expRes.ok) setExpiring(await expRes.json())
      if (exdRes.ok) setExpired(await exdRes.json())
    } catch { /* offline */ }
    setLoading(false)
  }, [apiBase, lookahead])

  useEffect(() => { fetchAll() }, [fetchAll])

  const categories = Array.from(new Set(certs.map((c) => c.category).filter(Boolean))) as string[]

  const filtered = certs.filter((c) => {
    const matchCat = catFilter === 'ALL' || c.category === catFilter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  async function saveCert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: fd.get('name') as string,
      description: (fd.get('description') as string) || undefined,
      category: (fd.get('category') as string) || undefined,
      typical_validity_days: fd.get('validity') ? parseInt(fd.get('validity') as string) : undefined,
    }
    try {
      const url = editTarget
        ? `${apiBase}/api/certifications/${editTarget.certification_id}`
        : `${apiBase}/api/certifications`
      const res = await fetch(url, {
        method: editTarget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setShowAdd(false)
      setEditTarget(null)
      fetchAll()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deleteCert(id: string) {
    try {
      await fetch(`${apiBase}/api/certifications/${id}`, { method: 'DELETE' })
      fetchAll()
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading credentials…</p>
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
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">Credentials</h1>
            <p className="mt-1 text-sm text-slate-400">Certification library, expiring credential tracker, and renewal pipeline.</p>
          </div>
          <button onClick={() => { setEditTarget(null); setShowAdd(true) }} className="ops-button-primary text-sm">+ Add Certification</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Defined Certs',   value: certs.length,     cls: 'text-white' },
            { label: 'Expiring Soon',   value: expiring.length,  cls: 'text-amber-400' },
            { label: 'Expired',         value: expired.length,   cls: 'text-red-400' },
            { label: 'Categories',      value: categories.length, cls: 'text-cyan-400' },
          ].map((s) => (
            <div key={s.label} className="stat-panel">
              <div className="stat-label">{s.label}</div>
              <div className={`stat-value ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Expiring / expired alerts */}
        {(expired.length > 0 || expiring.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {expired.length > 0 && (
              <div className="ops-panel border border-red-400/20">
                <div className="panel-kicker text-red-400">Expired Credentials</div>
                <div className="mt-3 space-y-2">
                  {expired.slice(0, 6).map((e, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.05] px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-white">{e.personnel_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{e.certification}</div>
                      </div>
                      <span className="text-[10px] text-red-400 shrink-0">Expired</span>
                    </div>
                  ))}
                  {expired.length > 6 && <p className="text-center text-[10px] text-slate-500">+{expired.length - 6} more</p>}
                </div>
              </div>
            )}
            {expiring.length > 0 && (
              <div className="ops-panel border border-amber-400/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="panel-kicker text-amber-400">Expiring Within</div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500">Days:</label>
                    <select value={lookahead} onChange={(e) => setLookahead(parseInt(e.target.value))} className="rounded bg-white/[0.05] border border-white/10 px-2 py-0.5 text-xs text-white focus:outline-none">
                      <option value={7}>7</option>
                      <option value={14}>14</option>
                      <option value={30}>30</option>
                      <option value={60}>60</option>
                      <option value={90}>90</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  {expiring.slice(0, 6).map((e, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-white">{e.personnel_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{e.certification}</div>
                      </div>
                      <span className="text-[10px] text-amber-400 shrink-0">{e.days_until_expiry}d left</span>
                    </div>
                  ))}
                  {expiring.length > 6 && <p className="text-center text-[10px] text-slate-500">+{expiring.length - 6} more</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Certification library */}
        <div className="ops-panel">
          <div className="panel-kicker">Certification Library</div>
          <div className="mt-3 mb-4 flex flex-wrap gap-2 items-center">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400" />
            {(['ALL', ...categories] as string[]).map((c) => (
              <button key={c} onClick={() => setCatFilter(c)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${catFilter === c ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-slate-400 hover:border-white/20'}`}>
                {c === 'ALL' ? 'All' : c}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Validity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">No certifications found</td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.certification_id}>
                    <td className="font-medium text-white">{c.name}</td>
                    <td>
                      {c.category && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryColor(c.category)}`}>{c.category}</span>
                      )}
                    </td>
                    <td className="text-slate-400 max-w-xs truncate">{c.description ?? '—'}</td>
                    <td className="text-slate-300">{c.typical_validity_days ? `${c.typical_validity_days}d` : '—'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditTarget(c); setShowAdd(true) }}
                          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 hover:text-white hover:border-white/20 transition"
                        >Edit</button>
                        <button
                          onClick={() => deleteCert(c.certification_id)}
                          className="rounded border border-red-400/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-400/10 transition"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Add / edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowAdd(false); setEditTarget(null) }}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1928] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">{editTarget ? 'Edit Certification' : 'Add Certification'}</h2>
              <button onClick={() => { setShowAdd(false); setEditTarget(null) }} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>
            <form onSubmit={saveCert} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name *</label>
                <input required name="name" defaultValue={editTarget?.name} className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <input name="category" defaultValue={editTarget?.category} placeholder="Fire, EMS, Rescue…" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <input name="description" defaultValue={editTarget?.description} className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Typical validity (days)</label>
                <input type="number" name="validity" defaultValue={editTarget?.typical_validity_days} min={1} placeholder="365" className="w-full rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowAdd(false); setEditTarget(null) }} className="ops-button-secondary text-sm py-2 px-4">Cancel</button>
                <button type="submit" disabled={saving} className="ops-button-primary text-sm py-2 px-4">{saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
