const platformStats = [
  { label: 'Alert latency', value: '< 1s', detail: 'WebSocket push for critical readiness gaps' },
  { label: 'API surface', value: '30+', detail: 'FastAPI endpoints with validated contracts' },
  { label: 'Pipeline model', value: 'Event-driven', detail: 'Kafka ingestion with Snowflake analytics' },
]

const commandPriorities = [
  {
    title: 'Operational readiness',
    detail: 'Track whether each engine, medic, and rescue unit can deploy right now based on staffed seats, certification coverage, and availability status.',
  },
  {
    title: 'Coverage risk windows',
    detail: 'Surface the specific hours where scheduled capacity diverges from available headcount so leadership can intervene before the shift breaks.',
  },
  {
    title: 'Certification exposure',
    detail: 'Highlight expiring or missing credentials as an operational constraint instead of burying them as administrative metadata.',
  },
]

const systemLayers = [
  { name: 'Experience', value: 'Next.js dashboard with live readiness and analytics views' },
  { name: 'Application', value: 'FastAPI services, Pydantic models, REST APIs, WebSocket broadcasts' },
  { name: 'Streaming', value: 'Kafka topics decoupling event capture from downstream consumers' },
  { name: 'Warehouse', value: 'Snowflake Streams, Tasks, and aggregates for trend analysis' },
]

export default function Home() {
  return (
    <div className="ops-page">
      <div className="ops-shell space-y-8">
        <section className="hero-panel overflow-hidden">
          <div className="hero-grid">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                Emergency Readiness Platform
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                  Real-time command visibility for emergency staffing, readiness, and certification risk.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  This system is strongest when it behaves like an operations product: clear risk framing,
                  low-latency alerting, and analytics that explain whether crews can respond now and stay
                  covered through the next operational window.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="ops-button-primary" href="/readiness">
                  Open readiness board
                </a>
                <a className="ops-button-secondary" href="/analytics">
                  Review analytics
                </a>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {platformStats.map((item) => (
                <div key={item.label} className="metric-card">
                  <div className="metric-label">{item.label}</div>
                  <div className="metric-value">{item.value}</div>
                  <p className="metric-detail">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="ops-panel">
            <div className="panel-kicker">Product framing</div>
            <h2 className="panel-title">What makes this dashboard meaningful</h2>
            <div className="mt-6 grid gap-4">
              {commandPriorities.map((priority) => (
                <div key={priority.title} className="border border-white/8 bg-white/3 p-5">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {priority.title}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{priority.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-panel">
            <div className="panel-kicker">Architecture</div>
            <h2 className="panel-title">Modern event pipeline</h2>
            <div className="mt-6 space-y-4">
              {systemLayers.map((layer) => (
                <div key={layer.name} className="border-l border-cyan-400/50 pl-4">
                  <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                    {layer.name}
                  </div>
                  <p className="mt-1 text-sm leading-7 text-slate-300">{layer.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="ops-panel">
            <div className="panel-kicker">Readiness board</div>
            <h2 className="panel-title">Current-state deployment posture</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Units should be ranked by operational confidence, not just raw headcount. The board needs
              to emphasize critical units, certification blockers, and live staffing gaps.
            </p>
          </div>
          <div className="ops-panel">
            <div className="panel-kicker">Analytics</div>
            <h2 className="panel-title">Trend and exposure review</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Snowflake should answer management questions: when do gaps open, which stations degrade,
              and how many readiness points are being lost to credentials versus staffing.
            </p>
          </div>
          <div className="ops-panel">
            <div className="panel-kicker">Portfolio signal</div>
            <h2 className="panel-title">Show enterprise judgement</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Stronger screenshots, better naming, and sharper metrics make the project read as an
              applied operations platform instead of a generic dashboard exercise.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
