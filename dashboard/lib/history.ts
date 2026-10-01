import type { AuditEvent, Incident, Unit } from './schemas'

/**
 * Reconstructs recorded unit service states and incident lifecycles from audit `details`.
 * Nothing here infers activity that was not recorded: intervals before the first recorded
 * fact are returned as `UNRECORDED`, and transitions without timestamps are flagged.
 */

export type ServiceState = Unit['operational_status'] | 'UNRECORDED'
export type LifecycleStatus = Incident['status']

export type ServiceSegment = { start: number; end: number; state: ServiceState; event?: AuditEvent }
export type LifecycleStage = { start: number; end: number; status: LifecycleStatus; event?: AuditEvent; untimed?: boolean }
export type Association = { start: number; end: number; inferred?: boolean }
export type IncidentHistory = { incident: Incident; stages: LifecycleStage[]; units: Map<string, Association[]>; recorded: boolean }

export const LIFECYCLE_LABEL: Record<LifecycleStatus, string> = {
  ACTIVE: 'DISPATCHED', ENROUTE: 'ENROUTE', ON_SCENE: 'ON SCENE', TRANSPORT: 'TRANSPORT', INVESTIGATING: 'INVESTIGATING', RESOLVED: 'RESOLVED',
}
export const SERVICE_LABEL: Record<ServiceState, string> = {
  AVAILABLE: 'AVAILABLE', DEPLOYED: 'ASSIGNED', OUT_OF_SERVICE: 'OUT OF SERVICE', MAINTENANCE: 'MAINTENANCE', UNRECORDED: 'NO RECORD',
}

const SERVICE_STATES = new Set(['AVAILABLE', 'DEPLOYED', 'OUT_OF_SERVICE', 'MAINTENANCE'])
const LIFECYCLE_STATES = new Set(['ACTIVE', 'ENROUTE', 'ON_SCENE', 'TRANSPORT', 'INVESTIGATING', 'RESOLVED'])

const ms = (value?: string | null) => (value ? new Date(value).getTime() : Number.NaN)
const at = (event: AuditEvent) => {
  const recorded = ms(typeof event.details.recorded_at === 'string' ? event.details.recorded_at : null)
  return Number.isFinite(recorded) ? recorded : ms(event.created_at)
}
const ids = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null)

export function eventTime(event: AuditEvent) {
  return at(event)
}

/** Service-state anchors for one unit: the recorded watch baseline plus every recorded change. */
export function serviceSegments(unitId: string, unitEvents: AuditEvent[], baselines: AuditEvent[], now: number): ServiceSegment[] {
  const anchors: { time: number; state: ServiceState; event: AuditEvent }[] = []
  for (const event of baselines) {
    const states = event.details.unit_service_states
    if (states && typeof states === 'object' && unitId in states) {
      const state = String((states as Record<string, unknown>)[unitId])
      if (SERVICE_STATES.has(state)) anchors.push({ time: at(event), state: state as ServiceState, event })
    }
  }
  for (const event of unitEvents) {
    if (event.entity_id !== unitId || !event.details.service_state) continue
    const state = String(event.details.after_status)
    if (SERVICE_STATES.has(state)) anchors.push({ time: at(event), state: state as ServiceState, event })
  }
  anchors.sort((a, b) => a.time - b.time)
  if (!anchors.length) return [{ start: Number.NEGATIVE_INFINITY, end: now, state: 'UNRECORDED' }]
  const segments: ServiceSegment[] = [{ start: Number.NEGATIVE_INFINITY, end: anchors[0].time, state: 'UNRECORDED' }]
  anchors.forEach((anchor, index) => {
    const end = index + 1 < anchors.length ? anchors[index + 1].time : now
    if (end > anchor.time) segments.push({ start: anchor.time, end, state: anchor.state, event: anchor.event })
  })
  return segments
}

/** Lifecycle stages and per-unit association windows for one incident. */
export function incidentHistory(incident: Incident, incidentEvents: AuditEvent[], now: number): IncidentHistory {
  const events = incidentEvents
    .filter((event) => event.entity_id === incident.incident_id && event.details.lifecycle)
    .sort((a, b) => at(a) - at(b))
  const created = ms(incident.created_at)
  const closedAt = incident.is_active ? now : (ms(incident.resolved_at) || now)
  const units = new Map<string, Association[]>()
  const open = new Map<string, number>()

  if (!events.length) {
    const start = Number.isFinite(created) ? created : closedAt
    const stages: LifecycleStage[] = [{ start, end: closedAt, status: incident.is_active ? incident.status : 'RESOLVED', untimed: true }]
    for (const unitId of Array.from(new Set([...(incident.unit_id ? [incident.unit_id] : []), ...incident.assigned_unit_ids]))) units.set(unitId, [{ start, end: closedAt, inferred: true }])
    return { incident, stages, units, recorded: false }
  }

  const stages: LifecycleStage[] = []
  let current: LifecycleStage | null = null
  for (const event of events) {
    const time = at(event)
    const status = String(event.details.after_status)
    if (LIFECYCLE_STATES.has(status) && (!current || current.status !== status)) {
      if (current) current.end = time
      if (status !== 'RESOLVED') {
        current = { start: time, end: closedAt, status: status as LifecycleStatus, event }
        stages.push(current)
      } else {
        current = null
      }
    }
    const assigned = ids(event.details.assigned_unit_ids)
    if (assigned) {
      for (const unitId of assigned) if (!open.has(unitId)) open.set(unitId, time)
      for (const [unitId, start] of Array.from(open)) {
        if (assigned.includes(unitId)) continue
        units.set(unitId, [...(units.get(unitId) || []), { start, end: time }])
        open.delete(unitId)
      }
    }
  }
  for (const [unitId, start] of Array.from(open)) units.set(unitId, [...(units.get(unitId) || []), { start, end: closedAt }])
  return { incident, stages, units, recorded: true }
}

export function clip<T extends { start: number; end: number }>(items: T[], start: number, end: number): T[] {
  return items
    .filter((item) => item.end > start && item.start < end)
    .map((item) => ({ ...item, start: Math.max(item.start, start), end: Math.min(item.end, end) }))
}

export function duration(from: number, to: number) {
  const minutes = Math.max(0, Math.round((to - from) / 60000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

export function clock(value: number | string | null | undefined) {
  const time = typeof value === 'number' ? value : ms(value)
  if (!Number.isFinite(time)) return '—'
  return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function incidentRef(incident: Pick<Incident, 'incident_id' | 'source_reference'>) {
  const reference = incident.source_reference?.match(/^DEMO-(\d+)$/)?.[1]
  return `I-${reference || incident.incident_id.replace(/^inc-/, '').slice(0, 6).toUpperCase()}`
}

/** Hour ticks across a range; step chosen to keep 6–13 labels. */
export function ticks(start: number, end: number) {
  const span = (end - start) / 3600000
  const step = span <= 6 ? 0.5 : span <= 13 ? 1 : 2
  const first = Math.ceil(start / (step * 3600000)) * step * 3600000
  const out: number[] = []
  for (let value = first; value <= end; value += step * 3600000) out.push(value)
  return out
}
