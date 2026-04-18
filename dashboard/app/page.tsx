'use client'

import { useEffect, useRef, useState } from 'react'

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


function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

function RingGauge({ score, size = 80 }: { score: number; size?: number }) {
  const sw = Math.max(5, Math.round(size * 0.08))
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color = score >= 85 ? '#34d399' : score >= 60 ? '#fbbf24' : score > 0 ? '#f87171' : '#1e293b'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s ease-out' }}
      />
    </svg>
  )
}

function readinessColor(score: number) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function AlertIcon({ type }: { type: string }) {
  if (type === 'UNDERSTAFFED_UNIT')
    return (
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    )
  if (type.includes('CERT'))
    return (
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  )
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
  const [loading, setLoading] = useState(true)
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const animatedReadiness = useCountUp(summary?.overall_readiness_pct ?? 0)
  const animatedTotal     = useCountUp(summary?.total_units ?? 0)
  const animatedReady     = useCountUp(summary?.ready_units ?? 0)
  const animatedDegraded  = useCountUp(summary?.degraded_units ?? 0)
  const animatedCritical  = useCountUp(summary?.critical_units ?? 0)
  const animatedAlerts    = useCountUp(summary?.open_alerts ?? 0)
  const animatedIncidents = useCountUp(summary?.active_incidents ?? 0)

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
        // backend not available
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiBase])

  return (
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="hero-panel relative overflow-hidden">
          <div className="hero-glow-sweep" aria-hidden="true" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            {/* Left: copy + CTAs */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Emergency Readiness Platform
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Real-time command visibility for staffing, readiness, and credential risk.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-400">
                  Live unit posture, alert lifecycle, certification exposure, and Snowflake-backed trend analytics for emergency services.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="ops-button-primary" href="/readiness">Open Operations Board</a>
                <a className="ops-button-secondary" href="/analytics">View Analytics</a>
                <a className="ops-button-secondary" href="/personnel">Workforce</a>
              </div>
            </div>

            {/* Right: readiness widget */}
            {summary && (
              <div className="hidden lg:flex flex-col items-center gap-3 min-w-[172px]">
                <div className="relative flex items-center justify-center">
                  <RingGauge score={summary.overall_readiness_pct} size={148} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`text-4xl font-semibold tabular-nums ${readinessColor(summary.overall_readiness_pct)}`}>
                      {animatedReadiness}%
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Readiness</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                    <div className="text-base font-semibold tabular-nums text-emerald-400">{animatedReady}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">Ready</div>
                  </div>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5">
                    <div className="text-base font-semibold tabular-nums text-red-400">{animatedCritical}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">Critical</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Command strip */}
          {(loading || summary) && (
            <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-card h-[72px] rounded-[20px]" />
                ))
              ) : summary ? [
                { label: 'Total Units', value: animatedTotal,     color: 'text-white',       cls: 'border-white/[0.08] bg-white/[0.03]' },
                { label: 'Ready',       value: animatedReady,     color: 'text-emerald-400', cls: 'border-emerald-500/20 bg-emerald-500/[0.06]' },
                { label: 'Degraded',    value: animatedDegraded,  color: 'text-amber-400',   cls: 'border-amber-500/20 bg-amber-500/[0.06]' },
                { label: 'Critical',    value: animatedCritical,  color: 'text-red-400',     cls: 'border-red-500/20 bg-red-500/[0.06]' },
                { label: 'Open Alerts', value: animatedAlerts,    color: 'text-orange-400',  cls: 'border-orange-500/20 bg-orange-500/[0.06]' },
                { label: 'Incidents',   value: animatedIncidents, color: 'text-rose-400',    cls: 'border-rose-500/20 bg-rose-500/[0.06]' },
              ].map((s) => (
                <div key={s.label} className={`rounded-[20px] border px-4 py-4 text-center ${s.cls}`}>
                  <div className={`text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-400">{s.label}</div>
                </div>
              )) : null}
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
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <RingGauge score={st.avg_readiness} size={72} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xs font-semibold tabular-nums ${readinessColor(st.avg_readiness)}`}>
                          {st.avg_readiness}%
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{st.station_id.toUpperCase()}</div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">
                        {st.station_name.split('—')[1]?.trim() ?? st.station_name}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>{st.unit_count} units</span>
                        {st.critical_units > 0 && (
                          <span className="text-red-400">{st.critical_units} critical</span>
                        )}
                      </div>
                    </div>
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
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton-card h-12 rounded-xl" />
                ))
              ) : alerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No open alerts</p>
              ) : (
                alerts.slice(0, 5).map((a) => (
                  <div key={a.alert_id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${alertBadge(a.alert_type)}`}>
                    <AlertIcon type={a.alert_type} />
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
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton-card h-12 rounded-xl" />
                ))
              ) : incidents.length === 0 ? (
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

        {/* ── System Health + API Reference ─────────────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="ops-panel">
            <div className="panel-kicker">System Health</div>
            <h2 className="panel-title text-xl">Infrastructure Status</h2>
            <div className="mt-5 space-y-2.5">
              {[
                { name: 'REST API' },
                { name: 'WebSocket Push' },
                { name: 'Kafka Event Pipeline' },
                { name: 'Snowflake Analytics' },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="text-sm text-slate-300">{svc.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${summary ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className={`text-xs font-medium ${summary ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {summary ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {summary?.timestamp && (
              <div className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
                Last sync: {new Date(summary.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="ops-panel">
            <div className="panel-kicker">API Reference</div>
            <h2 className="panel-title text-xl">Operational Endpoints</h2>
            <div className="mt-5 space-y-2.5">
              {[
                { method: 'GET',  endpoint: '/api/dashboard/summary',        label: 'Fleet readiness snapshot' },
                { method: 'GET',  endpoint: '/api/alerts?state=OPEN',        label: 'Open alert queue' },
                { method: 'POST', endpoint: '/api/simulations/staffing-gap', label: 'What-if staffing analysis' },
                { method: 'POST', endpoint: '/api/demo/reset',               label: 'Reload demo scenarios' },
              ].map((ep) => (
                <div key={ep.endpoint} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ep.method === 'GET' ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'}`}>
                    {ep.method}
                  </span>
                  <div>
                    <code className="text-[11px] text-cyan-300">{ep.endpoint}</code>
                    <p className="mt-0.5 text-xs text-slate-500">{ep.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Page nav cards ────────────────────────────────────────────── */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              href: '/readiness',
              kicker: 'Operations Board',
              title: 'Unit deployment posture',
              desc: 'Sortable unit grid with alert queue, staffing gaps, and per-unit action drawer.',
              stat: summary ? `${animatedReady} ready · ${animatedTotal} total` : null,
              statColor: 'text-emerald-400',
            },
            {
              href: '/personnel',
              kicker: 'Workforce',
              title: 'Personnel readiness matrix',
              desc: 'Qualification view: deployable, constrained, training-only, and expiring credentials.',
              stat: summary ? `${animatedReadiness}% avg fleet readiness` : null,
              statColor: readinessColor(summary?.overall_readiness_pct ?? 0),
            },
            {
              href: '/analytics',
              kicker: 'Analytics',
              title: 'Trend & forecast views',
              desc: 'Readiness trends, cert-risk forecast, staffing gap decomposition, and station comparison.',
              stat: summary ? `${animatedAlerts} open alert${summary.open_alerts !== 1 ? 's' : ''}` : null,
              statColor: summary && summary.open_alerts > 0 ? 'text-orange-400' : 'text-slate-400',
            },
          ].map((card) => (
            <a key={card.href} href={card.href} className="ops-panel block transition hover:border-cyan-400/30 hover:shadow-[0_0_0_1px_rgba(103,232,249,0.12)]">
              <div className="panel-kicker">{card.kicker}</div>
              <h3 className="mt-2 text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{card.desc}</p>
              {card.stat && (
                <div className={`mt-3 text-xs font-medium tabular-nums ${card.statColor}`}>{card.stat}</div>
              )}
            </a>
          ))}
        </section>

      </div>
    </div>
  )
}
