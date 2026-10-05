'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStationScope } from '@/components/ScopeContext'
import { ReadinessAnalysis } from '@/components/OperatingSurfaces'
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBadge } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import { formatDate, titleCase } from '@/lib/utils'

const tabs = ['overview', 'readiness', 'staffing', 'credentials', 'coverage'] as const
type AnalyticsTab = typeof tabs[number]

const periods = [7, 14, 30, 90]
const chartTooltip = {
  backgroundColor: '#1b201e', border: '1px solid rgba(231,237,233,.16)', borderRadius: 6,
  color: '#f5f7f6', fontSize: 11, boxShadow: '0 14px 40px rgba(0,0,0,.35)',
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

  const operations = useQuery({
    queryKey: queryKeys.operations(stationId),
    queryFn: () => api.operationsSnapshot(scopedStation),
    enabled: true,
  })
  const trends = useQuery({
    queryKey: queryKeys.analytics.trends(days, scopedStation),
    queryFn: () => api.readinessTrends(days, scopedStation),
    enabled: activeTab === 'overview' || activeTab === 'readiness',
  })
  const staffing = useQuery({
    queryKey: queryKeys.analytics.staffing(scopedStation),
    queryFn: () => api.staffingGaps(scopedStation),
    enabled: true,
  })
  const credentialRisk = useQuery({
    queryKey: queryKeys.analytics.credentialRisk(days, scopedStation),
    queryFn: () => api.certificationRisk(days, scopedStation),
    enabled: true,
  })
  const liveShifts = useQuery({
    queryKey: queryKeys.liveShifts,
    queryFn: () => api.liveShifts(),
    enabled: activeTab === 'coverage',
  })
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
  const totalGap = staffing.data?.reduce((sum, row) => sum + row.gap, 0) || 0
  const expiredRisk = credentialRisk.data?.filter((row) => row.status === 'EXPIRED').length || 0
  const latestTrend = Number(trendData.at(-1)?.overall || 0)
  const firstTrend = Number(trendData[0]?.overall || 0)
  const trendDelta = Math.round((latestTrend - firstTrend) * 10) / 10

  const coverageRows = (liveShifts.data || []).filter((shift) => !scopedStation || shift.station_id === scopedStation).map((shift) => ({
    name: shift.location.replace(/^Station \d+ — /, ''),
    assigned: shift.assigned_count,
    clockedIn: shift.clocked_in_count,
    required: shift.required_headcount,
    coverage: Math.round((shift.clocked_in_count / shift.required_headcount) * 100),
    status: shift.status,
  }))

  const exportCsv = () => {
    let rows: Array<Record<string, string | number>> = []
    if (activeTab === 'readiness' || activeTab === 'overview') rows = trendData.map((row) => ({ date: row.date, overall_readiness: row.overall, ...Object.fromEntries(stationKeys.map((key) => [key, Number(row[key] || 0)])) }))
    if (activeTab === 'staffing') rows = (staffing.data || []).map((row) => ({ unit: row.unit_name, station: row.station_id || '', present: row.staff_present, required: row.staff_required, gap: row.gap, readiness: row.readiness_score }))
    if (activeTab === 'credentials') rows = (credentialRisk.data || []).map((row) => ({ personnel: row.personnel_name, station: row.station_id || '', credential: row.cert, expires_on: row.expires_on, days_left: row.days_left, status: row.status }))
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
  const isLoading = operations.isLoading || trends.isLoading || staffing.isLoading || credentialRisk.isLoading || liveShifts.isLoading

  return (
    <div className="ops-page page-enter civic-workspace">
      <div className="ops-shell space-y-6">
        <PageHeader eyebrow="Decision intelligence" title="Analytics" description="Move between focused readiness, staffing, credential, and coverage analyses without losing station or time context." actions={<Button onClick={exportCsv}><Download className="size-4" />Export current view</Button>} />

        <div className="analytics-filterbar">
          <div className="analytics-filter-group"><span><CalendarRange className="size-4" />Analysis window</span><div className="segmented-control">{periods.map((period) => <button key={period} className={days === period ? 'active' : ''} onClick={() => updateFilters({ days: period })}>{period} days</button>)}</div></div>
          <label className="compare-toggle"><input type="checkbox" checked={compare} onChange={(event) => updateFilters({ compare: event.target.checked })} /><span /><div><strong>Compare baseline</strong><small>Show period average</small></div></label>
          <div className="active-scope"><span>Active scope</span><strong>{scopedStation ? stations.data?.find((station) => station.station_id === scopedStation)?.name.replace(/^Station \d+ — /, '') || scopedStation : 'All stations'}</strong></div>
        </div>

        {operations.data && <ReadinessAnalysis snapshot={operations.data} gaps={staffing.data || []} risks={credentialRisk.data || []} />}
        <p className="civic-provenance">Synthetic planning report · trend window and credential horizon: {days} days. Staffing and attendance are current snapshots; changing the window does not manufacture their history.</p>

        {currentError && <ErrorState message={currentError.message} retry={() => { operations.refetch(); trends.refetch(); staffing.refetch(); credentialRisk.refetch(); liveShifts.refetch() }} />}

        <Tabs.Root value={activeTab} onValueChange={(value) => updateFilters({ view: value as AnalyticsTab })} className="workspace-tabs analytics-tabs">
          <Tabs.List className="tab-list" aria-label="Analytics views">
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="readiness">Readiness</Tabs.Trigger>
            <Tabs.Trigger value="staffing">Staffing</Tabs.Trigger>
            <Tabs.Trigger value="credentials">Credentials</Tabs.Trigger>
            <Tabs.Trigger value="coverage">Coverage</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="overview" className="tab-content">
            {isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : <OverviewPanel summary={summary} latestTrend={latestTrend} trendDelta={trendDelta} totalGap={totalGap} expiredRisk={expiredRisk} trendData={trendData} compare={compare} operations={operations.data} />}
          </Tabs.Content>

          <Tabs.Content value="readiness" className="tab-content">
            {trends.isLoading || operations.isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : <div className="analytics-layout"><section className="ops-panel analytics-chart-wide"><SectionHeader title="Readiness trajectory" description={`${days}-day station and district trend`} /><div className="chart-frame chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(231,237,233,.06)" vertical={false} /><XAxis dataKey="displayDate" tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={26} /><YAxis domain={[0, 100]} tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltip} />{stationKeys.map((key, index) => <Line key={key} type="monotone" dataKey={key} name={stations.data?.find((station) => station.station_id === key)?.name.replace(/^Station \d+ — /, '') || key} stroke={['#3C7B62', '#244A63', '#D59A2E', '#C44732'][index % 4]} strokeWidth={2} dot={false} />)}{compare && <Line type="monotone" dataKey="baseline" name="Period average" stroke="#5D6B71" strokeDasharray="5 5" dot={false} />}</LineChart></ResponsiveContainer></div></section><section className="ops-panel analytics-side"><SectionHeader title="Station posture" description="Current readiness and critical assets" /><div className="station-analytics-list">{summary?.station_summaries.filter((station) => !scopedStation || station.station_id === scopedStation).map((station) => <div key={station.station_id}><span className={`score-ring ${station.avg_readiness >= 85 ? 'score-success' : station.avg_readiness >= 60 ? 'score-warning' : 'score-danger'}`}>{Math.round(station.avg_readiness)}</span><div><strong>{station.station_name.replace(/^Station \d+ — /, '')}</strong><small>{station.unit_count} units · {station.critical_units} critical</small></div><StatusBadge tone={station.avg_readiness >= 85 ? 'success' : station.avg_readiness >= 60 ? 'warning' : 'danger'}>{station.avg_readiness >= 85 ? 'Ready' : station.avg_readiness >= 60 ? 'Degraded' : 'Critical'}</StatusBadge></div>)}</div></section></div>}
          </Tabs.Content>

          <Tabs.Content value="staffing" className="tab-content">
            {staffing.isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : <div className="analytics-layout"><section className="ops-panel analytics-chart"><SectionHeader title="Headcount gaps by unit" description="Present staffing compared with minimum requirement" /><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={staffing.data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(231,237,233,.06)" vertical={false} /><XAxis dataKey="unit_name" tick={{ fill: '#5D6B71', fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="staff_present" name="Present" fill="#244A63" radius={0} /><Bar dataKey="gap" name="Gap" fill="#C44732" radius={0} /></BarChart></ResponsiveContainer></div></section><section className="ops-panel table-panel analytics-table"><SectionHeader title="Staffing exceptions" description="Highest operational gaps first" /><div className="responsive-table" tabIndex={0} role="region" aria-label="Scrollable record table"><table className="data-table"><thead><tr><th>Unit</th><th>Present</th><th>Required</th><th>Gap</th><th>Readiness</th></tr></thead><tbody>{staffing.data?.map((row) => <tr key={row.unit_id}><td><strong>{row.unit_name}</strong><small className="table-subtitle">{titleCase(row.unit_type)}</small></td><td>{row.staff_present}</td><td>{row.staff_required}</td><td><StatusBadge tone={row.gap ? 'danger' : 'success'}>{row.gap ? `-${row.gap}` : 'Covered'}</StatusBadge></td><td>{row.readiness_score}%</td></tr>)}</tbody></table></div></section></div>}
          </Tabs.Content>

          <Tabs.Content value="credentials" className="tab-content">
            {credentialRisk.isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : <CredentialAnalytics rows={credentialRisk.data || []} days={days} />}
          </Tabs.Content>

          <Tabs.Content value="coverage" className="tab-content">
            {liveShifts.isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : <CoverageAnalytics rows={coverageRows} />}
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  )
}

function OverviewPanel({ summary, latestTrend, trendDelta, totalGap, expiredRisk, trendData, compare, operations }: {
  summary?: { overall_readiness_pct: number; ready_units: number; total_units: number; open_alerts: number; active_incidents: number }
  latestTrend: number
  trendDelta: number
  totalGap: number
  expiredRisk: number
  trendData: Array<Record<string, string | number>>
  compare: boolean
  operations?: Awaited<ReturnType<typeof api.operationsSnapshot>>
}) {
  const postureData = [
    { name: 'Ready', value: operations?.summary.ready_units || 0, fill: '#3C7B62' },
    { name: 'Degraded', value: operations?.summary.degraded_units || 0, fill: '#D59A2E' },
    { name: 'Critical', value: operations?.summary.critical_units || 0, fill: '#C44732' },
  ]
  return <div className="space-y-4"><section className="instrument-register grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Current readiness" value={`${Math.round(summary?.overall_readiness_pct || latestTrend)}%`} detail={`${trendDelta >= 0 ? '+' : ''}${trendDelta} points over ${trendData.length} days`} icon={Gauge} tone={(summary?.overall_readiness_pct || 0) >= 85 ? 'success' : 'warning'} /><StatCard label="Coverage gap" value={totalGap} detail="Personnel below unit minimums" icon={Users} tone={totalGap ? 'danger' : 'success'} /><StatCard label="Expired credentials" value={expiredRisk} detail="Immediate qualification risks" icon={ShieldAlert} tone={expiredRisk ? 'danger' : 'success'} /><StatCard label="Open exceptions" value={(summary?.open_alerts || 0) + (summary?.active_incidents || 0)} detail="Alerts and active incidents" icon={AlertTriangle} tone={(summary?.open_alerts || 0) ? 'warning' : 'success'} /></section><div className="analytics-layout"><section className="ops-panel analytics-chart-wide"><SectionHeader title="District readiness trend" description="Operational posture across the selected analysis window" /><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(231,237,233,.06)" vertical={false} /><XAxis dataKey="displayDate" tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltip} /><Area type="monotone" dataKey="overall" name="Readiness" stroke="#3C7B62" fill="#3C7B62" fillOpacity={0.12} strokeWidth={2} />{compare && <Line type="monotone" dataKey="baseline" stroke="#5D6B71" strokeDasharray="5 5" dot={false} />}</AreaChart></ResponsiveContainer></div></section><section className="ops-panel analytics-side"><SectionHeader title="Unit posture" description={`${summary?.ready_units || 0} of ${summary?.total_units || 0} units fully ready`} /><div className="chart-frame chart-compact"><ResponsiveContainer width="100%" height="100%"><BarChart data={postureData} layout="vertical" margin={{ top: 5, right: 10, left: 8, bottom: 5 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} width={62} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="value" name="Units" radius={0}>{postureData.map((row) => <Cell key={row.name} fill={row.fill} />)}</Bar></BarChart></ResponsiveContainer></div><div className="analytics-callout"><TrendingUp className="size-4" /><span>{trendDelta >= 0 ? 'Readiness is improving over this window.' : 'Readiness has declined and needs review.'}</span></div></section></div></div>
}

function CredentialAnalytics({ rows, days }: { rows: Awaited<ReturnType<typeof api.certificationRisk>>; days: number }) {
  const buckets = [{ name: 'Expired', value: rows.filter((row) => row.status === 'EXPIRED').length, fill: '#C44732' }, { name: '0–14 days', value: rows.filter((row) => row.status === 'CRITICAL').length, fill: '#D59A2E' }, { name: '15+ days', value: rows.filter((row) => row.status === 'WARNING').length, fill: '#244A63' }]
  return <div className="analytics-layout"><section className="ops-panel analytics-chart"><SectionHeader title="Credential risk horizon" description={`Qualification expirations in the next ${days} days`} /><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={buckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(231,237,233,.06)" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="value" name="Credentials" radius={0}>{buckets.map((row) => <Cell key={row.name} fill={row.fill} />)}</Bar></BarChart></ResponsiveContainer></div></section><section className="ops-panel table-panel analytics-table"><SectionHeader title="At-risk credentials" description="Ordered by earliest expiration" /><div className="responsive-table" tabIndex={0} role="region" aria-label="Scrollable record table"><table className="data-table"><thead><tr><th>Personnel</th><th>Credential</th><th>Expires</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.personnel_id}-${row.cert}`}><td><strong>{row.personnel_name}</strong></td><td>{row.cert}</td><td>{formatDate(row.expires_on)}</td><td><StatusBadge tone={row.status === 'EXPIRED' || row.status === 'CRITICAL' ? 'danger' : 'warning'}>{row.days_left < 0 ? `${Math.abs(row.days_left)} days expired` : `${row.days_left} days`}</StatusBadge></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="No credential risk" description="No qualifications expire in this analysis window." icon={CheckCircle2} />}</section></div>
}

function CoverageAnalytics({ rows }: { rows: Array<{ name: string; assigned: number; clockedIn: number; required: number; coverage: number; status: string }> }) {
  return <div className="analytics-layout"><section className="ops-panel analytics-chart"><SectionHeader title="Live shift coverage" description="Clocked attendance against required headcount" /><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(231,237,233,.06)" vertical={false} /><XAxis dataKey="name" tick={{ fill: '#5D6B71', fontSize: 8 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#5D6B71', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltip} /><Bar dataKey="required" name="Required" fill="#5D6B71" radius={0} /><Bar dataKey="clockedIn" name="Clocked in" fill="#3C7B62" radius={0} /></BarChart></ResponsiveContainer></div></section><section className="ops-panel analytics-side"><SectionHeader title="Coverage status" description="Current station-by-station attendance" /><div className="coverage-analytics-list">{rows.map((row) => <div key={row.name}><span className="coverage-score"><strong>{row.coverage}%</strong><i><b style={{ width: `${Math.min(100, row.coverage)}%` }} /></i></span><div><strong>{row.name}</strong><small>{row.clockedIn} clocked in · {row.required} required</small></div><StatusBadge tone={row.coverage >= 100 ? 'success' : 'danger'}>{titleCase(row.status)}</StatusBadge></div>)}</div>{!rows.length && <EmptyState title="No live shifts" description="There are no active shifts in this station scope." icon={Clock3} />}</section></div>
}

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="ops-page"><div className="ops-shell"><div className="ops-panel"><LoadingState rows={8} /></div></div></div>}><AnalyticsWorkspace /></Suspense>
}
