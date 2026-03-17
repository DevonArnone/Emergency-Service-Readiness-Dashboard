'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface CoverageSummary {
  location: string
  hour: number
  scheduled_headcount: number
  actual_headcount: number
  understaffed_flag: boolean
  overtime_risk_flag: boolean
  date: string
}

interface HourlyAggregate {
  hour: number
  scheduled: number
  actual: number
  readinessGap: number
  coverageRatio: number
  criticalLocations: string[]
}

export default function AnalyticsPage() {
  const [coverage, setCoverage] = useState<CoverageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${apiBaseUrl}/api/analytics/coverage?target_date=${selectedDate}`)
        if (!response.ok) {
          throw new Error('Failed to fetch analytics')
        }
        const data = await response.json()
        setCoverage(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [selectedDate, apiBaseUrl])

  const groupedByHour = coverage.reduce<Record<number, HourlyAggregate>>((acc, item) => {
    if (!acc[item.hour]) {
      acc[item.hour] = {
        hour: item.hour,
        scheduled: 0,
        actual: 0,
        readinessGap: 0,
        coverageRatio: 100,
        criticalLocations: [],
      }
    }

    const gap = Math.max(item.scheduled_headcount - item.actual_headcount, 0)
    acc[item.hour].scheduled += item.scheduled_headcount
    acc[item.hour].actual += item.actual_headcount
    acc[item.hour].readinessGap += gap
    if (item.understaffed_flag || item.overtime_risk_flag) {
      acc[item.hour].criticalLocations.push(item.location)
    }

    const ratio =
      acc[item.hour].scheduled > 0
        ? Math.round((acc[item.hour].actual / acc[item.hour].scheduled) * 100)
        : 100
    acc[item.hour].coverageRatio = ratio

    return acc
  }, {})

  const hourlyData = Object.values(groupedByHour).sort((a, b) => a.hour - b.hour)
  const totalScheduled = coverage.reduce((sum, item) => sum + item.scheduled_headcount, 0)
  const totalActual = coverage.reduce((sum, item) => sum + item.actual_headcount, 0)
  const readinessGap = Math.max(totalScheduled - totalActual, 0)
  const coverageRate = totalScheduled > 0 ? Math.round((totalActual / totalScheduled) * 100) : 100
  const criticalWindows = hourlyData.filter((item) => item.readinessGap > 0).length
  const impactedStations = new Set(
    coverage
      .filter((item) => item.understaffed_flag || item.overtime_risk_flag)
      .map((item) => item.location)
  ).size

  const stationRollup = Object.entries(
    coverage.reduce<
      Record<
        string,
        {
          location: string
          scheduled: number
          actual: number
          gap: number
          riskHours: number
        }
      >
    >((acc, item) => {
      if (!acc[item.location]) {
        acc[item.location] = {
          location: item.location,
          scheduled: 0,
          actual: 0,
          gap: 0,
          riskHours: 0,
        }
      }

      acc[item.location].scheduled += item.scheduled_headcount
      acc[item.location].actual += item.actual_headcount
      acc[item.location].gap += Math.max(item.scheduled_headcount - item.actual_headcount, 0)
      if (item.understaffed_flag || item.overtime_risk_flag) {
        acc[item.location].riskHours += 1
      }

      return acc
    }, {})
  )
    .map(([, value]) => ({
      ...value,
      coverageRate:
        value.scheduled > 0 ? Math.round((value.actual / value.scheduled) * 100) : 100,
    }))
    .sort((a, b) => b.gap - a.gap || b.riskHours - a.riskHours)

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell">
          <div className="ops-panel flex h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
              <p className="mt-4 text-sm uppercase tracking-[0.2em] text-slate-400">Loading analytics</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ops-page">
        <div className="ops-shell">
          <div className="ops-panel border-red-400/30">
            <div className="panel-kicker text-red-300">Analytics unavailable</div>
            <h1 className="panel-title">The Snowflake analytics view could not be loaded.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ops-page">
      <div className="ops-shell space-y-8">
        <section className="hero-panel">
          <div className="hero-grid">
            <div>
              <div className="panel-kicker">Command analytics</div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Measure where staffing plans degrade into operational risk.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                The analytics layer should explain readiness loss, not just display warehouse rows.
                This view turns Snowflake output into command metrics: exposure hours, readiness gap,
                and the stations that need intervention first.
              </p>
            </div>

            <div className="metric-card">
              <div className="metric-label">Analysis date</div>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-[#08121f] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/50"
              />
              <p className="metric-detail">Querying `/api/analytics/coverage` for Snowflake coverage aggregates.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="stat-panel">
            <div className="stat-label">Coverage rate</div>
            <div className="stat-value">{coverageRate}%</div>
            <p className="stat-detail">{totalActual} staffed against {totalScheduled} scheduled seats.</p>
          </div>
          <div className="stat-panel">
            <div className="stat-label">Readiness gap</div>
            <div className="stat-value">{readinessGap}</div>
            <p className="stat-detail">Unfilled seats across the analyzed operating day.</p>
          </div>
          <div className="stat-panel">
            <div className="stat-label">Critical windows</div>
            <div className="stat-value">{criticalWindows}</div>
            <p className="stat-detail">Hours where at least one location fell below plan.</p>
          </div>
          <div className="stat-panel">
            <div className="stat-label">Impacted stations</div>
            <div className="stat-value">{impactedStations}</div>
            <p className="stat-detail">Locations with understaffing or overtime risk exposure.</p>
          </div>
        </section>

        {hourlyData.length > 0 ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="ops-panel">
                <div className="panel-kicker">Hourly posture</div>
                <h2 className="panel-title">Scheduled vs. available coverage</h2>
                <div className="mt-6 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData}>
                      <defs>
                        <linearGradient id="scheduledFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#67e8f9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                      <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#08121f',
                          borderColor: 'rgba(148, 163, 184, 0.18)',
                          borderRadius: 16,
                          color: '#e2e8f0',
                        }}
                      />
                      <Area type="monotone" dataKey="scheduled" stroke="#67e8f9" fill="url(#scheduledFill)" strokeWidth={2} />
                      <Area type="monotone" dataKey="actual" stroke="#34d399" fill="url(#actualFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ops-panel">
                <div className="panel-kicker">Exposure</div>
                <h2 className="panel-title">Readiness gap by hour</h2>
                <div className="mt-6 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                      <XAxis dataKey="hour" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#08121f',
                          borderColor: 'rgba(148, 163, 184, 0.18)',
                          borderRadius: 16,
                          color: '#e2e8f0',
                        }}
                      />
                      <Bar dataKey="readinessGap" fill="#f87171" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="ops-panel">
                <div className="panel-kicker">Station ranking</div>
                <h2 className="panel-title">Where intervention matters most</h2>
                <div className="mt-6 space-y-4">
                  {stationRollup.slice(0, 5).map((station) => (
                    <div key={station.location} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
                            {station.location}
                          </div>
                          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                            {station.coverageRate}% coverage
                          </div>
                        </div>
                        <div className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-red-200">
                          {station.gap} gap
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {station.actual} staffed seats across {station.scheduled} scheduled positions with {station.riskHours} risk hours flagged.
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ops-panel overflow-hidden">
                <div className="panel-kicker">Detailed output</div>
                <h2 className="panel-title">Operational rollup by station and hour</h2>
                <div className="mt-6 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Hour</th>
                        <th>Scheduled</th>
                        <th>Actual</th>
                        <th>Gap</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {coverage.map((item, index) => {
                        const gap = Math.max(item.scheduled_headcount - item.actual_headcount, 0)
                        const status = item.understaffed_flag
                          ? 'Understaffed'
                          : item.overtime_risk_flag
                            ? 'Overtime risk'
                            : 'Within plan'

                        return (
                          <tr key={`${item.location}-${item.hour}-${index}`} className="bg-transparent">
                            <td>{item.location}</td>
                            <td>{item.hour}:00</td>
                            <td>{item.scheduled_headcount}</td>
                            <td>{item.actual_headcount}</td>
                            <td>{gap}</td>
                            <td>
                              <span
                                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${
                                  item.understaffed_flag
                                    ? 'bg-red-400/10 text-red-200'
                                    : item.overtime_risk_flag
                                      ? 'bg-amber-300/10 text-amber-200'
                                      : 'bg-emerald-400/10 text-emerald-200'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="ops-panel">
            <div className="panel-kicker">No analytics data</div>
            <h2 className="panel-title">Snowflake is returning no coverage aggregates for this date.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              The UI now expects enough warehouse data to explain risk windows. If the page is empty,
              the next fix is the pipeline: populate `ANALYTICS.SHIFT_COVERAGE_HOURLY` with realistic
              station-level coverage rows and show trendable readiness metrics instead of placeholder totals.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
