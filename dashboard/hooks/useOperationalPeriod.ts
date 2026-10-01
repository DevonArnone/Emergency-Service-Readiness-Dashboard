'use client'

import { useQuery } from '@tanstack/react-query'
import { api, queryKeys } from '@/lib/api'

const hhmm = (value: string) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')

/** The recorded shift covering now, labeled from its stored window rather than a fixed rota name. */
export function useOperationalPeriod(now: number) {
  const shifts = useQuery({ queryKey: queryKeys.shifts, queryFn: api.shifts, staleTime: 60_000 })
  const current = (shifts.data || []).find((shift) => shift.status !== 'CANCELLED' && new Date(shift.start_time).getTime() <= now && new Date(shift.end_time).getTime() > now)
  if (!current) return { window: 'NO ACTIVE SHIFT', name: 'NO RECORDED WATCH' }
  const watch = current.shift_id.match(/^shift-([a-z])$/i)?.[1]
  return { window: `${hhmm(current.start_time)} – ${hhmm(current.end_time)}`, name: watch ? `${watch.toUpperCase()} WATCH` : 'ACTIVE SHIFT' }
}
