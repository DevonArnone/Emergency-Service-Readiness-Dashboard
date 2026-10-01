'use client'

import { useQuery } from '@tanstack/react-query'
import { api, queryKeys } from '@/lib/api'

/** Recorded lifecycle and service-state audit history shared by the Units and Incidents timelines. */
export function useOperationalHistory(enabled = true) {
  const incidentEvents = useQuery({ queryKey: queryKeys.history('incident'), queryFn: () => api.auditEvents(500, 'incident'), enabled })
  const unitEvents = useQuery({ queryKey: queryKeys.history('unit'), queryFn: () => api.auditEvents(500, 'unit'), enabled })
  const watchEvents = useQuery({ queryKey: queryKeys.history('shift'), queryFn: () => api.auditEvents(40, 'shift'), enabled })
  const incidents = useQuery({ queryKey: queryKeys.incidents, queryFn: api.incidents, enabled })
  return {
    incidentEvents: incidentEvents.data || [],
    unitEvents: unitEvents.data || [],
    baselines: (watchEvents.data || []).filter((event) => event.details.unit_service_states),
    incidents: incidents.data || [],
    loading: incidentEvents.isLoading || unitEvents.isLoading || watchEvents.isLoading || incidents.isLoading,
    error: incidentEvents.error || unitEvents.error || watchEvents.error || incidents.error,
  }
}
