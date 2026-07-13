'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Radio,
  ShieldCheck,
  Siren,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { api, queryKeys } from '@/lib/api'
import { formatRelativeTime, titleCase } from '@/lib/utils'
import { useStationScope } from '@/components/ScopeContext'
import { ErrorState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBadge } from '@/components/ui'

function readinessTone(score: number) {
  if (score >= 85) return 'success' as const
  if (score >= 60) return 'warning' as const
  return 'danger' as const
}

export default function CommandCenterPage() {
  const { stationId } = useStationScope()
  const operations = useQuery({
    queryKey: queryKeys.operations(stationId),
    queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId),
  })
  const shifts = useQuery({ queryKey: queryKeys.liveShifts, queryFn: api.liveShifts })

  const snapshot = operations.data
  const visibleShifts = (shifts.data || []).filter((shift) => stationId === 'all' || shift.station_id === stationId)
  const priorityAlerts = snapshot?.alerts.filter((alert) => alert.state !== 'RESOLVED').slice(0, 5) || []

  return (
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-6">
        <PageHeader
          eyebrow="Live district overview"
          title="Command Center"
          description="A concise operational picture of readiness, active risk, staffing coverage, and the next actions requiring attention."
          actions={<><Link href="/readiness" className="button button-secondary"><Siren className="size-4" />Open operations</Link><Link href="/shifts" className="button button-primary"><Clock3 className="size-4" />Manage shift</Link></>}
        />

        {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="District summary">
          <StatCard label="Overall readiness" value={snapshot ? `${Math.round(snapshot.summary.overall_readiness_pct)}%` : '—'} detail={`${snapshot?.summary.ready_units || 0} of ${snapshot?.summary.total_units || 0} units ready`} icon={Activity} tone={readinessTone(snapshot?.summary.overall_readiness_pct || 0)} href="/readiness" />
          <StatCard label="Open alerts" value={snapshot?.summary.open_alerts ?? '—'} detail="Operational exceptions to review" icon={AlertTriangle} tone={(snapshot?.summary.open_alerts || 0) > 0 ? 'danger' : 'success'} href="/readiness" />
          <StatCard label="Active incidents" value={snapshot?.summary.active_incidents ?? '—'} detail="Events under active command" icon={Siren} tone={(snapshot?.summary.active_incidents || 0) > 0 ? 'warning' : 'success'} href="/readiness" />
          <StatCard label="Credential work" value={snapshot?.renewals.filter((task) => task.status === 'OPEN').length ?? '—'} detail="Renewal tasks awaiting ownership" icon={ShieldCheck} tone={(snapshot?.renewals.some((task) => task.status === 'OPEN')) ? 'warning' : 'success'} href="/certifications-management" />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="ops-panel min-w-0">
            <SectionHeader title="Unit readiness" description="Current operational posture by response unit" action={<Link href="/readiness" className="text-link">View all units <ArrowRight className="size-3.5" /></Link>} />
            {operations.isLoading ? <LoadingState rows={6} /> : (
              <div className="unit-summary-grid">
                {snapshot?.units.map((unit) => (
                  <Link key={unit.unit_id} href="/readiness" className="unit-summary-row">
                    <span className={`score-ring score-${readinessTone(unit.readiness_score)}`}>{Math.round(unit.readiness_score)}</span>
                    <span className="min-w-0 flex-1"><strong>{unit.unit_name}</strong><small>{titleCase(unit.unit_type)} · {unit.staff_present}/{unit.staff_required} staffed</small></span>
                    <StatusBadge tone={readinessTone(unit.readiness_score)}>{unit.readiness_score >= 85 ? 'Ready' : unit.readiness_score >= 60 ? 'Degraded' : 'Critical'}</StatusBadge>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="ops-panel min-w-0">
            <SectionHeader title="Priority queue" description="Exceptions ordered for duty officer review" action={<span className="section-count">{priorityAlerts.length}</span>} />
            {operations.isLoading ? <LoadingState rows={5} /> : priorityAlerts.length ? (
              <div className="priority-list">
                {priorityAlerts.map((alert) => (
                  <Link key={alert.alert_id} href="/readiness" className="priority-row">
                    <span className="priority-icon"><AlertTriangle className="size-4" /></span>
                    <span className="min-w-0 flex-1"><strong>{alert.message}</strong><small>{titleCase(alert.alert_type)} · {formatRelativeTime(alert.created_at)}</small></span>
                    <StatusBadge tone={alert.state === 'OPEN' ? 'danger' : 'warning'}>{alert.state}</StatusBadge>
                  </Link>
                ))}
              </div>
            ) : <div className="compact-success"><CheckCircle2 className="size-5" /><div><strong>No active exceptions</strong><span>All open alerts in this scope are clear.</span></div></div>}
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="ops-panel min-w-0">
            <SectionHeader title="Live shifts" description="Actual clock-ins compared with required coverage" action={<Link href="/shifts" className="text-link">Open schedule <ArrowRight className="size-3.5" /></Link>} />
            {shifts.isLoading ? <LoadingState rows={3} /> : (
              <div className="live-shift-list">
                {visibleShifts.map((shift) => {
                  const coverage = Math.min(100, Math.round((shift.clocked_in_count / shift.required_headcount) * 100))
                  return <Link key={shift.shift_id} href="/shifts" className="live-shift-row"><span className="live-dot"><Radio className="size-4" /></span><span className="min-w-0 flex-1"><strong>{shift.location}</strong><small>{shift.clocked_in_count} clocked in · {shift.required_headcount} required</small><span className="coverage-track"><i style={{ width: `${coverage}%` }} /></span></span><StatusBadge tone={coverage >= 100 ? 'success' : 'danger'}>{coverage}%</StatusBadge></Link>
                })}
                {!visibleShifts.length && <div className="compact-empty">No live shifts in this station scope.</div>}
              </div>
            )}
          </section>

          <section className="ops-panel min-w-0">
            <SectionHeader title="Recent activity" description="Durable audit history from operational workflows" action={<Activity className="size-4 text-emerald-300" />} />
            {operations.isLoading ? <LoadingState rows={4} /> : (
              <div className="activity-list">
                {snapshot?.activity.slice(0, 5).map((event) => <div key={event.audit_id} className="activity-row"><span><Users className="size-3.5" /></span><div className="min-w-0 flex-1"><strong>{event.summary}</strong><small>{event.actor} · {formatRelativeTime(event.created_at)}</small></div><span className="activity-action">{event.action}</span></div>)}
                {!snapshot?.activity.length && <div className="compact-empty">No activity has been recorded.</div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
