'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, Clock3, Download } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStationScope } from '@/components/ScopeContext'
import { Button, EmptyState, ErrorState, LoadingState, Meter, PageHeader, Panel, StatusBadge, TextLink } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import { cn, formatDate, titleCase } from '@/lib/utils'
import styles from './analytics.module.css'

const tabs = ['overview', 'readiness', 'staffing', 'credentials', 'coverage'] as const
type AnalyticsTab = typeof tabs[number]

const periods = [7, 14, 30, 90]
const tooltipStyle = { backgroundColor: '#0e1e3a', border: '1px solid #223a63', borderRadius: 6, color: '#e7eefb', fontSize: 13 }
const axisTick = { fill: '#a3b5d4', fontSize: 12 }
const SERIES = ['#78a2ff', '#3ad29a', '#ffc24a', '#ff6f61', '#c2cfe6', '#b79cff']
const shortStation = (name: string) => name.replace(/^Station \d+ — /, '')
const tone = (score: number) => score >= 85 ? 'success' as const : score >= 60 ? 'warning' as const : 'danger' as const

function Analysis({ title, description, chart, findings, evidenceLabel, evidence, loading }: { title: string; description: string; chart: ReactNode; findings: ReactNode[]; evidenceLabel?: string; evidence?: ReactNode; loading?: boolean }) {
  return (
    <div className={styles.analysis}>
      <section className={cn('ui-stage', styles.chartStage)} aria-label={title}>
        <header className="ui-stage-header"><div><h2>{title}</h2><p>{description}</p></div></header>
        <div className={styles.chart}>{loading ? <LoadingState rows={6} /> : chart}</div>
      </section>
      <Panel title="Findings" description="Read from the chart and its source rows">
        <ul className={styles.findings}>{findings.filter(Boolean).map((finding, index) => <li key={index}>{finding}</li>)}</ul>
      </Panel>
      {evidence && (
        <details className={cn('ui-disclosure', styles.evidence)}>
          <summary>{evidenceLabel || 'Evidence table'}<ChevronDown className="ui-chevron" aria-hidden="true" /></summary>
          <Panel className={styles.evidencePanel} flush>{evidence}</Panel>
        </details>
      )}
    </div>
  )
}

function AnalyticsWorkspace() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { stationId } = useStationScope()
  const tabParam = searchParams.get('view')
  const activeTab: AnalyticsTab = tabs.includes(tabParam as AnalyticsTab) ? tabParam as AnalyticsTab : 'overview'
  const periodParam = Number(searchParams.get('days'))
  const days = periods.includes(periodParam) ? periodParam : 14
  const compare = searchParams.get('compare') === '1'
  const scopedStation = stationId === 'all' ? undefined : stationId
  const [comparisonStation, setComparisonStation] = useState('')

  const operations = useQuery({ queryKey: queryKeys.operations(stationId), queryFn: () => api.operationsSnapshot(scopedStation) })
  const trends = useQuery({ queryKey: queryKeys.analytics.trends(days, scopedStation), queryFn: () => api.readinessTrends(days, scopedStation), enabled: activeTab === 'overview' || activeTab === 'readiness' })
  const staffing = useQuery({ queryKey: queryKeys.analytics.staffing(scopedStation), queryFn: () => api.staffingGaps(scopedStation) })
  const credentialRisk = useQuery({ queryKey: queryKeys.analytics.credentialRisk(days, scopedStation), queryFn: () => api.certificationRisk(days, scopedStation) })
  const liveShifts = useQuery({ queryKey: queryKeys.liveShifts, queryFn: () => api.liveShifts(), enabled: activeTab === 'coverage' })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })

  useEffect(() => {
    const currentScope = searchParams.get('scope') || 'all'
    if (currentScope === stationId) return
    const next = new URLSearchParams(searchParams.toString())
    if (stationId === 'all') next.delete('scope')
    else next.set('scope', stationId)
    window.history.replaceState(null, '', `${pathname}?${next}`)
  }, [pathname, searchParams, stationId])

  const updateFilters = (changes: { view?: AnalyticsTab; days?: number; compare?: boolean }) => {
    const next = new URLSearchParams(searchParams.toString())
    if (changes.view) next.set('view', changes.view)
    if (changes.days) next.set('days', String(changes.days))
    if (changes.compare !== undefined) {
      if (changes.compare) next.set('compare', '1')
      else next.delete('compare')
    }
    window.history.replaceState(null, '', `${pathname}?${next}`)
  }

  const trendData = useMemo(() => {
    const rows = trends.data || []
    const baseline = rows.length ? rows.reduce((sum, row) => sum + row.overall, 0) / rows.length : 0
    return rows.map((row): Record<string, string | number> => ({ ...row, displayDate: formatDate(`${row.date}T12:00:00`, days > 30 ? 'MMM d' : 'EEE d'), baseline: Math.round(baseline * 10) / 10 }))
  }, [trends.data, days])
  const stationKeys = scopedStation ? [scopedStation] : (stations.data || []).map((station) => station.station_id)
  const summary = operations.data?.summary
  const gaps = staffing.data || []
  const risks = credentialRisk.data || []
  const totalGap = gaps.reduce((sum, row) => sum + row.gap, 0)
  const expiredRisk = risks.filter((row) => row.status === 'EXPIRED').length
  const latestTrend = Number(trendData.at(-1)?.overall || 0)
  const firstTrend = Number(trendData[0]?.overall || 0)
  const trendDelta = Math.round((latestTrend - firstTrend) * 10) / 10
  const stationSummaries = summary?.station_summaries || []
  const selectedStation = stationSummaries.find(station => station.station_id === comparisonStation) || [...stationSummaries].sort((a, b) => a.avg_readiness - b.avg_readiness)[0]
  const stationExceptions = gaps.filter(gap => gap.station_id === selectedStation?.station_id)
  const stationQualifications = risks.filter(risk => risk.station_id === selectedStation?.station_id)
  const lowest = [...stationSummaries].sort((a, b) => a.avg_readiness - b.avg_readiness)[0]
  const gapRows = gaps.filter(row => row.gap > 0).sort((a, b) => b.gap - a.gap)

  const coverageRows = (liveShifts.data || []).filter((shift) => !scopedStation || shift.station_id === scopedStation).map((shift) => ({
    name: shortStation(shift.location),
    assigned: shift.assigned_count,
    clockedIn: shift.clocked_in_count,
    required: shift.required_headcount,
    coverage: Math.round((shift.clocked_in_count / shift.required_headcount) * 100),
    status: shift.status,
  }))
  const buckets = [
    { name: 'Expired', value: risks.filter((row) => row.status === 'EXPIRED').length, fill: '#ff6f61' },
    { name: '0–14 days', value: risks.filter((row) => row.status === 'CRITICAL').length, fill: '#ffc24a' },
    { name: '15+ days', value: risks.filter((row) => row.status === 'WARNING').length, fill: '#78a2ff' },
  ]
  const postureData = [
    { name: 'Ready', value: summary?.ready_units || 0, fill: '#3ad29a' },
    { name: 'Degraded', value: summary?.degraded_units || 0, fill: '#ffc24a' },
    { name: 'Critical', value: summary?.critical_units || 0, fill: '#ff6f61' },
  ]

  const exportCsv = () => {
    let rows: Array<Record<string, string | number>> = []
    if (activeTab === 'readiness' || activeTab === 'overview') rows = trendData.map((row) => ({ date: row.date, overall_readiness: row.overall, ...Object.fromEntries(stationKeys.map((key) => [key, Number(row[key] || 0)])) }))
    if (activeTab === 'staffing') rows = gaps.map((row) => ({ unit: row.unit_name, station: row.station_id || '', present: row.staff_present, required: row.staff_required, gap: row.gap, readiness: row.readiness_score }))
    if (activeTab === 'credentials') rows = risks.map((row) => ({ personnel: row.personnel_name, station: row.station_id || '', credential: row.cert, expires_on: row.expires_on, days_left: row.days_left, status: row.status }))
    if (activeTab === 'coverage') rows = coverageRows.map((row) => ({ shift: row.name, assigned: row.assigned, clocked_in: row.clockedIn, required: row.required, coverage_pct: row.coverage, status: row.status }))
    if (!rows.length) return
    const columns = Object.keys(rows[0])
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `aegis-${activeTab}-${days}d-${stationId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const currentError = operations.error || trends.error || staffing.error || credentialRisk.error || liveShifts.error
  const grid = <CartesianGrid stroke="#223a63" vertical={false} />

  return (
    <div className="ui-page" data-view="analytics">
      <PageHeader title="Analytics" description="One analysis at a time across readiness, staffing, credentials, and coverage, in the current station scope." actions={<Button onClick={exportCsv}><Download aria-hidden="true" />Export current view</Button>} />

      <div className="ui-toolbar">
        <div className="ui-segmented" role="group" aria-label="Analysis window">
          {periods.map((period) => <button key={period} type="button" aria-pressed={days === period} onClick={() => updateFilters({ days: period })}>{period} days</button>)}
        </div>
        <label className={styles.compare}><input type="checkbox" checked={compare} onChange={(event) => updateFilters({ compare: event.target.checked })} /><span>Compare baseline <small>period average</small></span></label>
        <span className="ui-toolbar-spacer" />
        <span className={styles.scope}>Scope <strong>{scopedStation ? shortStation(stations.data?.find((station) => station.station_id === scopedStation)?.name || scopedStation) : 'All stations'}</strong></span>
      </div>

      {currentError && <ErrorState message={currentError.message} retry={() => { operations.refetch(); trends.refetch(); staffing.refetch(); credentialRisk.refetch(); liveShifts.refetch() }} />}

      <Tabs.Root value={activeTab} onValueChange={(value) => updateFilters({ view: value as AnalyticsTab })}>
        <Tabs.List className="ui-tabs" aria-label="Analytics views">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="readiness">Readiness</Tabs.Trigger>
          <Tabs.Trigger value="staffing">Staffing</Tabs.Trigger>
          <Tabs.Trigger value="credentials">Credentials</Tabs.Trigger>
          <Tabs.Trigger value="coverage">Coverage</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="ui-tab-content">
          <Analysis title="Department readiness trend" description={`Overall readiness across the last ${days} days`} loading={trends.isLoading}
            chart={<ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>{grid}<XAxis dataKey="displayDate" tick={axisTick} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="overall" name="Readiness" stroke="#78a2ff" fill="#78a2ff" fillOpacity={0.18} strokeWidth={2.5} />{compare && <Line type="monotone" dataKey="baseline" name="Period average" stroke="#a3b5d4" strokeDasharray="5 5" dot={false} />}</AreaChart></ResponsiveContainer>}
            findings={[
              <>Current readiness is <strong>{Math.round(summary?.overall_readiness_pct || latestTrend)}%</strong>, {trendDelta >= 0 ? 'up' : 'down'} {Math.abs(trendDelta)} points over {trendData.length} days.</>,
              <><strong>{summary?.ready_units ?? 0} of {summary?.total_units ?? 0}</strong> units are fully ready; {summary?.degraded_units ?? 0} degraded and {summary?.critical_units ?? 0} critical.</>,
              <><strong>{totalGap}</strong> personnel below unit minimums and <strong>{expiredRisk}</strong> expired credentials in the current snapshot.</>,
              <><strong>{(summary?.open_alerts || 0) + (summary?.active_incidents || 0)}</strong> open exceptions: {summary?.open_alerts ?? 0} alerts and {summary?.active_incidents ?? 0} active incidents.</>,
            ]}
            evidenceLabel="Unit posture"
            evidence={<div className={styles.posture}>{postureData.map(row => <div key={row.name}><span>{row.name}</span><Meter value={summary?.total_units ? row.value / summary.total_units * 100 : 0} tone={row.name === 'Ready' ? 'success' : row.name === 'Degraded' ? 'warning' : 'danger'} /><strong className="ui-num">{row.value}</strong></div>)}</div>} />

          {operations.data && (
            <Panel title="Station comparison" description={`Snapshot ${formatDate(operations.data.timestamp, 'MMM d · HH:mm')} · select a station to trace its measured exceptions`} className={styles.comparisonPanel}>
              <div className={styles.comparison}>
                <div className={styles.stationGrid}>
                  {stationSummaries.map(station => (
                    <button type="button" key={station.station_id} data-ui="station-comparison" aria-pressed={selectedStation?.station_id === station.station_id} onClick={() => setComparisonStation(station.station_id)}>
                      <span>{station.station_name.replace(/^Station /, 'St. ').split(' — ')[0]}</span>
                      <strong className="ui-num">{Math.round(station.avg_readiness)}%</strong>
                      <Meter value={station.avg_readiness} tone={tone(station.avg_readiness)} />
                      <small>{station.unit_count} units · {station.critical_units} critical</small>
                    </button>
                  ))}
                </div>
                <div className={styles.stationEvidence} data-ui="analysis-evidence" aria-live="polite">
                  <h3>{selectedStation?.station_name || 'No stations in scope'}</h3>
                  <dl className="ui-facts ui-facts-rows">
                    <div><dt>Current readiness</dt><dd>{selectedStation ? `${Math.round(selectedStation.avg_readiness)}%` : '—'}</dd></div>
                    <div><dt>Staffing deficit</dt><dd>{stationExceptions.reduce((sum, row) => sum + row.gap, 0)} personnel</dd></div>
                    <div><dt>Credential exposure</dt><dd>{stationQualifications.length} records in horizon</dd></div>
                  </dl>
                  <h4>Exceptions</h4>
                  <ul className="ui-list">
                    {stationExceptions.filter(row => row.gap > 0).map(row => <li key={row.unit_id}><Link className="ui-list-row" data-ui="evidence-link" href={`/readiness?view=units&unit=${encodeURIComponent(row.unit_id)}`}><span className="ui-list-main"><strong>{row.unit_name}</strong><small>{row.staff_present}/{row.staff_required} present</small></span><StatusBadge tone="danger">{row.gap} short</StatusBadge></Link></li>)}
                    {stationQualifications.slice(0, 4).map(row => <li key={`${row.personnel_id}:${row.cert}`}><Link className="ui-list-row" data-ui="evidence-link" href={`/personnel?person=${encodeURIComponent(row.personnel_id)}`}><span className="ui-list-main"><strong>{row.personnel_name}</strong><small>{row.cert}</small></span><StatusBadge tone={row.days_left < 0 ? 'danger' : 'warning'}>{row.days_left < 0 ? 'Expired' : `${row.days_left} days`}</StatusBadge></Link></li>)}
                  </ul>
                  {!stationExceptions.some(row => row.gap > 0) && !stationQualifications.length && <p className="ui-empty-inline" style={{ padding: '8px 0' }}>No staffing or credential exceptions returned for this station.</p>}
                  <div className="ui-link-row" style={{ marginTop: 12 }}><TextLink href={`/analytics?view=readiness&scope=${encodeURIComponent(selectedStation?.station_id || 'all')}`}>Station trend</TextLink><TextLink href="/shifts">Duty coverage</TextLink><TextLink href="/readiness?view=simulation">Test contingency</TextLink></div>
                </div>
              </div>
            </Panel>
          )}
        </Tabs.Content>

        <Tabs.Content value="readiness" className="ui-tab-content">
          <Analysis title="Readiness trajectory" description={`${days}-day station and department trend`} loading={trends.isLoading || operations.isLoading}
            chart={<ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>{grid}<XAxis dataKey="displayDate" tick={axisTick} axisLine={false} tickLine={false} minTickGap={26} /><YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} />{stationKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} name={shortStation(stations.data?.find((station) => station.station_id === key)?.name || key)} stroke={SERIES[index % SERIES.length]} strokeWidth={stationKeys.length > 6 ? 1.2 : 2.2} strokeOpacity={stationKeys.length > 6 ? 0.55 : 1} dot={false} />)}{compare && <Line type="monotone" dataKey="baseline" name="Period average" stroke="#ffffff" strokeDasharray="5 5" dot={false} />}</LineChart></ResponsiveContainer>}
            findings={[
              <>Department readiness moved from <strong>{Math.round(firstTrend)}%</strong> to <strong>{Math.round(latestTrend)}%</strong> across the window.</>,
              lowest && <>Lowest current station: <strong>{shortStation(lowest.station_name)}</strong> at {Math.round(lowest.avg_readiness)}% with {lowest.critical_units} critical units.</>,
              <><strong>{stationSummaries.filter(station => station.avg_readiness < 85).length}</strong> of {stationSummaries.length} stations are below the 85% ready threshold.</>,
            ]}
            evidenceLabel="Station posture"
            evidence={<div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Station posture"><table className="ui-table"><thead><tr><th scope="col">Station</th><th scope="col" className="ui-num">Units</th><th scope="col" className="ui-num">Critical</th><th scope="col">Readiness</th><th scope="col">Posture</th></tr></thead><tbody>{stationSummaries.filter((station) => !scopedStation || station.station_id === scopedStation).map((station) => <tr key={station.station_id}><th scope="row">{shortStation(station.station_name)}</th><td className="ui-num">{station.unit_count}</td><td className="ui-num">{station.critical_units}</td><td className="ui-num">{Math.round(station.avg_readiness)}%</td><td><StatusBadge tone={tone(station.avg_readiness)}>{station.avg_readiness >= 85 ? 'Ready' : station.avg_readiness >= 60 ? 'Degraded' : 'Critical'}</StatusBadge></td></tr>)}</tbody></table></div>} />
        </Tabs.Content>

        <Tabs.Content value="staffing" className="ui-tab-content">
          <Analysis title="Headcount gaps by unit" description="Units below minimum staffing in the current snapshot" loading={staffing.isLoading}
            chart={gapRows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={gapRows.slice(0, 24)} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>{grid}<XAxis dataKey="unit_name" tick={axisTick} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={54} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(120,162,255,.12)' }} /><Bar dataKey="staff_present" name="Present" stackId="staff" fill="#78a2ff" radius={[0, 0, 3, 3]} /><Bar dataKey="gap" name="Gap" stackId="staff" fill="#ff6f61" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="ui-empty-inline">No unit is below its minimum staffing in this scope.</p>}
            findings={[
              <><strong>{gapRows.length}</strong> of {gaps.length} units are below minimum staffing, short <strong>{totalGap}</strong> personnel in total.</>,
              gapRows[0] && <>Largest gap: <strong>{gapRows[0].unit_name}</strong> with {gapRows[0].staff_present} of {gapRows[0].staff_required} present.</>,
              <>Staffing is a current snapshot; changing the analysis window does not create staffing history.</>,
            ]}
            evidenceLabel="Staffing exceptions"
            evidence={<div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Staffing exceptions"><table className="ui-table"><thead><tr><th scope="col">Unit</th><th scope="col" className="ui-num">Present</th><th scope="col" className="ui-num">Required</th><th scope="col">Gap</th><th scope="col" className="ui-num">Readiness</th></tr></thead><tbody>{gaps.map((row) => <tr key={row.unit_id}><th scope="row"><Link href={`/readiness?view=units&unit=${encodeURIComponent(row.unit_id)}`}>{row.unit_name}</Link><small>{titleCase(row.unit_type)}</small></th><td className="ui-num">{row.staff_present}</td><td className="ui-num">{row.staff_required}</td><td><StatusBadge tone={row.gap ? 'danger' : 'success'}>{row.gap ? `${row.gap} short` : 'Covered'}</StatusBadge></td><td className="ui-num">{row.readiness_score}%</td></tr>)}</tbody></table></div>} />
        </Tabs.Content>

        <Tabs.Content value="credentials" className="ui-tab-content">
          <Analysis title="Credential risk horizon" description={`Qualification expirations in the next ${days} days`} loading={credentialRisk.isLoading}
            chart={<ResponsiveContainer width="100%" height="100%"><BarChart data={buckets} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>{grid}<XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(120,162,255,.12)' }} /><Bar dataKey="value" name="Credentials" radius={[4, 4, 0, 0]} maxBarSize={120}>{buckets.map((row) => <Cell key={row.name} fill={row.fill} />)}</Bar></BarChart></ResponsiveContainer>}
            findings={[
              <><strong>{risks.length}</strong> credential records expire or have expired within the {days}-day horizon.</>,
              <><strong>{buckets[0].value}</strong> expired and <strong>{buckets[1].value}</strong> due within 14 days.</>,
              risks[0] && <>Earliest: <strong>{risks[0].personnel_name}</strong>, {risks[0].cert}, {risks[0].days_left < 0 ? `${Math.abs(risks[0].days_left)} days expired` : `${risks[0].days_left} days left`}.</>,
            ]}
            evidenceLabel="At-risk credentials"
            evidence={risks.length ? <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="At-risk credentials"><table className="ui-table"><thead><tr><th scope="col">Personnel</th><th scope="col">Credential</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead><tbody>{risks.map((row) => <tr key={`${row.personnel_id}-${row.cert}`}><th scope="row"><Link href={`/personnel?person=${encodeURIComponent(row.personnel_id)}`}>{row.personnel_name}</Link></th><td className="ui-mono">{row.cert}</td><td>{formatDate(row.expires_on)}</td><td><StatusBadge tone={row.status === 'EXPIRED' || row.status === 'CRITICAL' ? 'danger' : 'warning'}>{row.days_left < 0 ? `${Math.abs(row.days_left)} days expired` : `${row.days_left} days`}</StatusBadge></td></tr>)}</tbody></table></div> : <EmptyState title="No credential risk" description="No qualifications expire in this analysis window." icon={CheckCircle2} />} />
        </Tabs.Content>

        <Tabs.Content value="coverage" className="ui-tab-content">
          <Analysis title="Live shift coverage" description="Clocked attendance against required headcount" loading={liveShifts.isLoading}
            chart={coverageRows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={coverageRows} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>{grid}<XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} /><YAxis tick={axisTick} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(120,162,255,.12)' }} /><Bar dataKey="required" name="Required" fill="#5d7196" radius={[4, 4, 0, 0]} maxBarSize={90} /><Bar dataKey="clockedIn" name="Clocked in" fill="#3ad29a" radius={[4, 4, 0, 0]} maxBarSize={90} /></BarChart></ResponsiveContainer> : <p className="ui-empty-inline">There are no live shifts in this station scope.</p>}
            findings={[
              <><strong>{coverageRows.length}</strong> live {coverageRows.length === 1 ? 'shift' : 'shifts'} in scope; {coverageRows.filter(row => row.coverage < 100).length} below required headcount.</>,
              coverageRows[0] && <><strong>{coverageRows.reduce((sum, row) => sum + row.clockedIn, 0)}</strong> clocked in against <strong>{coverageRows.reduce((sum, row) => sum + row.required, 0)}</strong> required.</>,
              <>Attendance is live for today; it is not a historical series.</>,
            ]}
            evidenceLabel="Coverage by shift"
            evidence={coverageRows.length ? <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Coverage by shift"><table className="ui-table"><thead><tr><th scope="col">Shift</th><th scope="col" className="ui-num">Clocked in</th><th scope="col" className="ui-num">Assigned</th><th scope="col" className="ui-num">Required</th><th scope="col" className="ui-num">Coverage</th><th scope="col">Status</th></tr></thead><tbody>{coverageRows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td className="ui-num">{row.clockedIn}</td><td className="ui-num">{row.assigned}</td><td className="ui-num">{row.required}</td><td className="ui-num">{row.coverage}%</td><td><StatusBadge tone={row.coverage >= 100 ? 'success' : 'danger'}>{titleCase(row.status)}</StatusBadge></td></tr>)}</tbody></table></div> : <EmptyState title="No live shifts" description="There are no active shifts in this station scope." icon={Clock3} />} />
        </Tabs.Content>
      </Tabs.Root>
      <p className="ui-provenance">Synthetic planning report · trend window and credential horizon: {days} days. Current comparison is not a predictive coverage model.</p>
    </div>
  )
}

export default function AnalyticsPage() {
  return <Suspense fallback={<LoadingState rows={8} />}><AnalyticsWorkspace /></Suspense>
}
