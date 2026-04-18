'use client'

import { useEffect, useState } from 'react'

interface DashboardSummary {
  total_units: number
  ready_units: number
  degraded_units: number
  critical_units: number
  open_alerts: number
  active_incidents: number
  overall_readiness_pct: number
  station_summaries: Array<{
    station_id: string
    station_name: string
    unit_count: number
    avg_readiness: number
    critical_units: number
  }>
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
}

interface Incident {
  incident_id: string
  title: string
  priority: string
  station_id?: string
  is_active: boolean
}

const stackLayers = [
  { label: 'Experience',   desc: 'Next.js 14 · React 18 · Tailwind · Recharts · WebSocket push' },
  { label: 'API',          desc: 'FastAPI · Pydantic v2 · 40+ validated REST endpoints' },
  { label: 'Streaming',    desc: 'Kafka event capture · WebSocket broadcast · aggregated ops channel' },
  { label: 'Warehouse',    desc: 'Snowflake Streams & Tasks · hourly coverage · readiness aggregates' },
]

const proofPoints = [
  {
    label: 'Operational readiness',
    desc: 'Each unit scored 0–100 against staffing ratios, missing certifications, and expired credentials — not just headcount.',
  },
  {
    label: 'Live alert lifecycle',
    desc: 'Alerts move through OPEN → ACKNOWLEDGED → RESOLVED with metadata: who acted, when, and why.',
  },
  {
    label: 'Recommendation engine',
    desc: 'Rules engine surfaces REASSIGN, ESCALATE, and RENEW_CERT actions automatically when readiness degrades.',
  },
  {
    label: 'What-if simulation',
    desc: 'POST /api/simulations/staffing-gap shows how readiness degrades if specific crew call out, and which recovery actions apply.',
  },
]

function readinessColor(score: number) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function readinessBg(score: number) {
  if (score >= 85) return 'bg-emerald-400'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function alertBadge(type: string) {
  const map: Record<string, string> = {
    UNDERSTAFFED_UNIT: 'border-red-500/40 bg-red-500/10 text-red-300',
    EXPIRED_CERTIFICATION: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    EXPIRING_CERTIFICATION: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    OVERTIME_RISK: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
    UNIT_OFFLINE: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  }
  return map[type] ?? 'border-slate-500/40 bg-slate-500/10 text-slate-300'
}

function incidentBadge(priority: string) {
  const map: Record<string, string> = {
    CRITICAL: 'border-red-500/40 bg-red-500/10 text-red-300',
    HIGH:     'border-orange-500/40 bg-orange-500/10 text-orange-300',
    MEDIUM:   'border-amber-500/40 bg-amber-500/10 text-amber-300',
    LOW:      'border-slate-500/40 bg-slate-500/10 text-slate-300',
  }
  return map[priority] ?? 'border-slate-500/40 bg-slate-500/10 text-slate-300'
}

export default function Home() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, alertRes, incRes] = await Promise.all([
          fetch(`${apiBase}/api/dashboard/summary`),
          fetch(`${apiBase}/api/alerts?state=OPEN`),
          fetch(`${apiBase}/api/incidents?active_only=true`),
        ])
        if (sumRes.ok) setSummary(await sumRes.json())
        if (alertRes.ok) setAlerts(await alertRes.json())
        if (incRes.ok) setIncidents(await incRes.json())
      } catch {
        // backend not available — static fallback
      }
    }
    load()
  }, [apiBase])

  return (
    <div className="ops-page">
      <div className="ops-shell space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="hero-panel overflow-hidden">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
              Emergency Readiness Platform
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Real-time command visibility for staffing, readiness, and credential risk.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                Full-stack operations platform for emergency services. Live unit posture,
                alert lifecycle, certification exposure, and Snowflake-backed trend analytics —
                designed as a recruiter-grade portfolio and functional ops tool.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="ops-button-primary" href="/readiness">Open Operations Board</a>
              <a className="ops-button-secondary" href="/analytics">View Analytics</a>
              <a className="ops-button-secondary" href="/workforce">Workforce</a>
            </div>
          </div>

          {/* Live summary strip */}
          {summary && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Total Units',      value: summary.total_units,           color: 'text-white' },
                { label: 'Ready',            value: summary.ready_units,           color: 'text-emerald-400' },
                { label: 'Degraded',         value: summary.degraded_units,        color: 'text-amber-400' },
                { label: 'Critical',         value: summary.critical_units,        color: 'text-red-400' },
                { label: 'Open Alerts',      value: summary.open_alerts,           color: 'text-orange-400' },
                { label: 'Active Incidents', value: summary.active_incidents,      color: 'text-rose-400' },
              ].map((s) => (
                <div key={s.label} className="metric-card text-center">
                  <div className={`text-3xl font-semibold ${s.color}`}>{s.value}</div>
                  <div className="metric-label mt-2">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Station readiness strip ─────────────────────────────────────── */}
        {summary && summary.station_summaries.length > 0 && (
          <section>
            <div className="mb-4 text-[11px] uppercase tracking-[0.22em] text-slate-500">Station Posture</div>
            <div className="grid gap-4 md:grid-cols-3">
              {summary.station_summaries.map((st) => (
                <div key={st.station_id} className="ops-panel">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{st.station_id.toUpperCase()}</div>
                      <div className="mt-1 text-sm font-semibold text-white">{st.station_name.split('—')[1]?.trim() ?? st.station_name}</div>
                    </div>
                    <div className={`text-2xl font-semibold ${readinessColor(st.avg_readiness)}`}>
                      {st.avg_readiness}%
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${readinessBg(st.avg_readiness)}`}
                      style={{ width: `${st.avg_readiness}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{st.unit_count} units</span>
                    {st.critical_units > 0 && (
                      <span className="text-red-400">{st.critical_units} critical</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Alerts + Incidents ──────────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Open alerts */}
          <div className="ops-panel">
            <div className="panel-kicker">Live Alerts</div>
            <h2 className="panel-title text-xl">Open Readiness Alerts</h2>
            <div className="mt-5 space-y-3">
              {alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No open alerts</p>
              ) : (
                alerts.slice(0, 5).map((a) => (
                  <div key={a.alert_id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${alertBadge(a.alert_type)}`}>
                    <span className="mt-0.5 shrink-0 text-base">
                      {a.alert_type === 'UNDERSTAFFED_UNIT' ? '⚠' :
                       a.alert_type.includes('CERT') ? '⏱' : '!'}
                    </span>
                    <p className="leading-5">{a.message}</p>
                  </div>
                ))
              )}
              {alerts.length > 5 && (
                <a href="/readiness" className="block text-center text-xs text-cyan-400 hover:underline">
                  +{alerts.length - 5} more — view in Operations
                </a>
              )}
            </div>
          </div>

          {/* Active incidents */}
          <div className="ops-panel">
            <div className="panel-kicker">Active Incidents</div>
            <h2 className="panel-title text-xl">Dispatched Units</h2>
            <div className="mt-5 space-y-3">
              {incidents.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No active incidents</p>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.incident_id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${incidentBadge(inc.priority)}`}>
                    <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-current">
                      {inc.priority}
                    </span>
                    <p className="leading-5">{inc.title}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Platform proof points ──────────────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="ops-panel">
            <div className="panel-kicker">Design Rationale</div>
            <h2 className="panel-title text-xl">What makes this platform meaningful</h2>
            <div className="mt-5 space-y-4">
              {proofPoints.map((pt) => (
                <div key={pt.label} className="border-l-2 border-cyan-400/40 pl-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{pt.label}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{pt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-panel">
            <div className="panel-kicker">Architecture</div>
            <h2 className="panel-title text-xl">Full-stack event pipeline</h2>
            <div className="mt-5 space-y-5">
              {stackLayers.map((layer) => (
                <div key={layer.label} className="flex gap-4">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{layer.label}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{layer.desc}</p>
                  </div>
                </div>
              ))}

              <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2">Quick demo</div>
                <code className="block text-[11px] leading-6 text-cyan-300">
                  POST /api/demo/reset<br />
                  GET  /api/dashboard/summary<br />
                  GET  /api/alerts<br />
                  POST /api/simulations/staffing-gap
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* ── Page cards ────────────────────────────────────────────────── */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { href: '/readiness',  kicker: 'Operations Board', title: 'Unit deployment posture',  desc: 'Sortable unit grid with alert queue, staffing gaps, and per-unit action drawer.' },
            { href: '/personnel',  kicker: 'Workforce',        title: 'Personnel readiness matrix', desc: 'Qualification view: deployable, constrained, training-only, and expiring credentials.' },
            { href: '/analytics',  kicker: 'Analytics',        title: 'Trend & forecast views',   desc: 'Readiness trends, cert-risk forecast, staffing gap decomposition, and station comparison.' },
          ].map((card) => (
            <a key={card.href} href={card.href} className="ops-panel block transition hover:border-cyan-400/30 hover:shadow-[0_0_0_1px_rgba(103,232,249,0.12)]">
              <div className="panel-kicker">{card.kicker}</div>
              <h3 className="mt-2 text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{card.desc}</p>
            </a>
          ))}
        </section>

      </div>
    </div>
  )
}
