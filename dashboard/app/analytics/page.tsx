'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'

interface TrendRow {
  date: string
  overall: number
  s1?: number
  s2?: number
  s3?: number
  [key: string]: number | string | undefined
}

interface CertRiskRow {
  personnel_name: string
  station_id: string
  cert: string
  expires_on: string
  days_left: number
  status: 'EXPIRED' | 'CRITICAL' | 'WARNING'
}

interface GapRow {
  unit_name: string
  unit_type: string
  station_id: string
  staff_present: number
  staff_required: number
  gap: number
  readiness_score: number
}

interface CoverageSummary {
  location: string
  hour: number
  scheduled_headcount: number
  actual_headcount: number
  understaffed_flag: boolean
  date: string
}

const STATION_COLORS: Record<string, string> = {
  s1: '#22d3ee', s2: '#34d399', s3: '#f59e0b',
}

const STATUS_STYLES: Record<string, string> = {
  EXPIRED:  'border-red-400/30 bg-red-400/10 text-red-300',
  CRITICAL: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  WARNING:  'border-amber-400/30 bg-amber-400/10 text-amber-300',
}

function scoreColor(s: number) {
  return s >= 85 ? '#34d399' : s >= 60 ? '#f59e0b' : '#f87171'
}

const TOOLTIP_STYLE = {
  backgroundColor: '#0d1928',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
  color: '#e2e8f0',
  fontSize: 12,
}

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<TrendRow[]>([])
  const [certRisk, setCertRisk] = useState<CertRiskRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [coverage, setCoverage] = useState<CoverageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [coverageDate, setCoverageDate] = useState(new Date().toISOString().split('T')[0])

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, cRes, gRes] = await Promise.all([
        fetch(`${apiBase}/api/analytics/readiness-trends`),
        fetch(`${apiBase}/api/analytics/certification-risk`),
        fetch(`${apiBase}/api/analytics/staffing-gaps`),
      ])
      if (tRes.ok) setTrends(await tRes.json())
      if (cRes.ok) setCertRisk(await cRes.json())
      if (gRes.ok) setGaps(await gRes.json())
    } catch { /* backend offline */ }
    setLoading(false)
  }, [apiBase])

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/analytics/coverage?date=${coverageDate}`)
      if (res.ok) setCoverage(await res.json())
    } catch { /* ignore */ }
  }, [apiBase, coverageDate])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchCoverage() }, [fetchCoverage])

  // Aggregate coverage into hourly series
  const hourlyMap: Record<number, { hour: number; scheduled: number; actual: number }> = {}
  coverage.forEach((row) => {
    if (!hourlyMap[row.hour]) hourlyMap[row.hour] = { hour: row.hour, scheduled: 0, actual: 0 }
    hourlyMap[row.hour].scheduled += row.scheduled_headcount
    hourlyMap[row.hour].actual += row.actual_headcount
  })
  const hourlySeries = Object.values(hourlyMap).sort((a, b) => a.hour - b.hour).map((r) => ({
    ...r,
    label: `${String(r.hour).padStart(2, '0')}:00`,
    gap: Math.max(0, r.scheduled - r.actual),
  }))

  // Station names from trends
  const stationKeys = trends.length > 0
    ? Object.keys(trends[0]).filter((k) => k !== 'date' && k !== 'overall')
    : []

  // Cert risk buckets
  const expired  = certRisk.filter((r) => r.status === 'EXPIRED')
  const critical = certRisk.filter((r) => r.status === 'CRITICAL')
  const warning  = certRisk.filter((r) => r.status === 'WARNING')

  // Overall readiness from last trend entry
  const latestOverall = trends.length > 0 ? trends[trends.length - 1].overall : 0
  const prevOverall   = trends.length > 1 ? trends[trends.length - 2].overall : latestOverall
  const trend = latestOverall - prevOverall

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading analytics…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ops-page">
      <div className="ops-shell space-y-6">

        {/* Header */}
        <div>
          <div className="panel-kicker">Ridgecrest ESD</div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Readiness trends, certification risk forecast, staffing gaps, and coverage analysis.</p>
        </div>

        {/* Executive summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Overall Readiness',  value: `${latestOverall}%`, sub: trend >= 0 ? `+${trend.toFixed(1)} vs yesterday` : `${trend.toFixed(1)} vs yesterday`, cls: scoreColor(latestOverall) },
            { label: 'Cert Risk Items',     value: certRisk.length,     sub: `${expired.length} expired · ${critical.length} critical`,  cls: expired.length ? '#f87171' : '#f59e0b' },
            { label: 'Staffing Gaps',       value: gaps.filter((g) => g.gap > 0).length, sub: `units below minimum staffing`, cls: '#f87171' },
            { label: 'Coverage Data',       value: hourlySeries.length ? `${hourlySeries.length}h` : '—', sub: coverageDate, cls: '#22d3ee' },
          ].map((s) => (
            <div key={s.label} className="stat-panel">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.cls }}>{s.value}</div>
              <div className="stat-detail">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* 14-day readiness trend */}
        <div className="ops-panel">
          <div className="panel-kicker">14-Day Trend</div>
          <h2 className="mt-1 text-base font-semibold text-white mb-5">Station readiness over time</h2>
          {trends.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No trend data — seed demo via POST /api/demo/reset</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  {stationKeys.map((k) => (
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={STATION_COLORS[k] ?? '#94a3b8'} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={STATION_COLORS[k] ?? '#94a3b8'} stopOpacity={0} />
                    </linearGradient>
                  ))}
                  <linearGradient id="grad-overall" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e2e8f0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="overall" name="Overall" stroke="#e2e8f0" strokeWidth={2} fill="url(#grad-overall)" strokeDasharray="4 2" dot={false} />
                {stationKeys.map((k) => (
                  <Area key={k} type="monotone" dataKey={k} name={k.toUpperCase()} stroke={STATION_COLORS[k] ?? '#94a3b8'} strokeWidth={1.5} fill={`url(#grad-${k})`} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Staffing gaps + station comparison */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Staffing gap by unit */}
          <div className="ops-panel">
            <div className="panel-kicker">Staffing Gaps</div>
            <h2 className="mt-1 text-base font-semibold text-white mb-5">Gap by unit (staff below minimum)</h2>
            {gaps.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No gap data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gaps} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="unit_name" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="gap" name="Gap" fill="#f87171" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="staff_present" name="Present" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Unit</th><th>Station</th><th>Present</th><th>Required</th><th>Gap</th><th>Score</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {gaps.slice(0, 8).map((g) => (
                    <tr key={g.unit_name}>
                      <td className="font-medium text-white">{g.unit_name}</td>
                      <td className="text-slate-400 text-xs">{g.station_id?.toUpperCase()}</td>
                      <td>{g.staff_present}</td>
                      <td>{g.staff_required}</td>
                      <td className={g.gap > 0 ? 'font-medium text-red-400' : 'text-emerald-400'}>{g.gap > 0 ? `-${g.gap}` : '—'}</td>
                      <td style={{ color: scoreColor(g.readiness_score) }}>{g.readiness_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Station comparison */}
          <div className="ops-panel">
            <div className="panel-kicker">Station Comparison</div>
            <h2 className="mt-1 text-base font-semibold text-white mb-5">Average readiness by station · 14 days</h2>
            {stationKeys.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No station data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  {stationKeys.map((k) => (
                    <Line key={k} type="monotone" dataKey={k} name={k.toUpperCase()} stroke={STATION_COLORS[k] ?? '#94a3b8'} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
            {/* Per-station summary */}
            {stationKeys.length > 0 && trends.length > 0 && (
              <div className="mt-4 space-y-2">
                {stationKeys.map((k) => {
                  const latest = trends[trends.length - 1][k] as number ?? 0
                  return (
                    <div key={k} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: STATION_COLORS[k] ?? '#94a3b8' }} />
                        <span className="text-xs text-slate-300">{k.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1 w-24 rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${latest}%`, background: STATION_COLORS[k] ?? '#94a3b8' }} />
                        </div>
                        <span className="w-10 text-right text-xs" style={{ color: scoreColor(latest) }}>{latest}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Certification risk forecast */}
        <div className="ops-panel">
          <div className="panel-kicker">Credential Risk Forecast</div>
          <h2 className="mt-1 text-base font-semibold text-white mb-2">Personnel certifications expiring within 90 days</h2>
          <div className="mb-5 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> Expired ({expired.length})</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" /> Critical ≤14d ({critical.length})</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Warning ≤90d ({warning.length})</span>
          </div>
          {certRisk.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No certifications expiring within 90 days</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Personnel</th><th>Station</th><th>Certification</th><th>Expires</th><th>Days Left</th><th>Risk</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {certRisk.slice(0, 15).map((r, i) => (
                    <tr key={i}>
                      <td className="font-medium text-white">{r.personnel_name}</td>
                      <td className="text-slate-400 text-xs">{r.station_id?.toUpperCase()}</td>
                      <td><span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">{r.cert}</span></td>
                      <td className="text-xs text-slate-400">{r.expires_on}</td>
                      <td className={r.days_left < 0 ? 'font-medium text-red-400' : r.days_left <= 14 ? 'text-orange-400' : 'text-amber-400'}>
                        {r.days_left < 0 ? `${Math.abs(r.days_left)}d ago` : `${r.days_left}d`}
                      </td>
                      <td><span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[r.status]}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {certRisk.length > 15 && (
                <p className="mt-2 text-center text-xs text-slate-500">+{certRisk.length - 15} more — see Credentials page</p>
              )}
            </div>
          )}
        </div>

        {/* Hourly coverage breakdown */}
        <div className="ops-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <div className="panel-kicker">Coverage Analysis</div>
              <h2 className="mt-1 text-base font-semibold text-white">Scheduled vs. actual headcount by hour</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Date</label>
              <input
                type="date"
                value={coverageDate}
                onChange={(e) => setCoverageDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>
          {hourlySeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No coverage data for this date. Seed via POST /api/analytics/populate.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlySeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad-sched" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-actual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="scheduled" name="Scheduled" stroke="#22d3ee" strokeWidth={1.5} fill="url(#grad-sched)" dot={false} />
                <Area type="monotone" dataKey="actual" name="Actual" stroke="#34d399" strokeWidth={1.5} fill="url(#grad-actual)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {hourlySeries.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="data-table w-full">
                <thead><tr><th>Hour</th><th>Scheduled</th><th>Actual</th><th>Gap</th><th>Status</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {hourlySeries.map((r) => (
                    <tr key={r.hour}>
                      <td className="font-mono text-xs">{r.label}</td>
                      <td>{r.scheduled}</td>
                      <td>{r.actual}</td>
                      <td className={r.gap > 0 ? 'text-red-400 font-medium' : 'text-emerald-400'}>{r.gap > 0 ? `-${r.gap}` : '—'}</td>
                      <td>
                        {r.gap > 0 ? (
                          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-300">Understaffed</span>
                        ) : (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
