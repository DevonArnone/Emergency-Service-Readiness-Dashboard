import { z, type ZodType } from 'zod'
import { accessToken } from './auth'
import {
  alertSchema,
  auditEventSchema,
  assignmentSchema,
  certificationImpactSchema,
  certificationSchema,
  incidentSchema,
  liveShiftSchema,
  operationsSnapshotSchema,
  personnelSchema,
  renewalTaskSchema,
  readinessTrendSchema,
  shiftActionSchema,
  shiftAssignmentSchema,
  shiftSchema,
  simulationResultSchema,
  stationSchema,
  staffingGapSchema,
  certificationRiskSchema,
  unitReadinessSchema,
  unitSchema,
  fairfaxWeatherSchema,
} from './schemas'

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

type ApiErrorPayload = {
  code?: string
  message?: string
  detail?: string
  field_errors?: Record<string, string>
  request_id?: string
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors: Record<string, string> = {},
    public requestId?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

type RequestOptions = RequestInit & {
  timeoutMs?: number
  retries?: number
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const retries = options.retries ?? (method === 'GET' ? 1 : 0)
  const timeoutMs = options.timeoutMs ?? 8000

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const token = await accessToken()
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const payload = await response.json().catch(() => null) as ApiErrorPayload | null
      if (!response.ok) {
        throw new ApiClientError(
          payload?.message || payload?.detail || `Request failed with status ${response.status}`,
          response.status,
          payload?.code || `HTTP_${response.status}`,
          payload?.field_errors,
          payload?.request_id || response.headers.get('x-request-id') || undefined,
        )
      }
      return schema.parse(payload)
    } catch (error) {
      const canRetry = attempt < retries && (
        error instanceof TypeError
        || (error instanceof ApiClientError && error.status >= 500)
      )
      if (!canRetry) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new ApiClientError('The service took too long to respond.', 408, 'REQUEST_TIMEOUT')
        }
        if (error instanceof z.ZodError) {
          throw new ApiClientError('The service returned an unexpected data shape.', 502, 'INVALID_RESPONSE')
        }
        throw error
      }
      await wait(250 * (attempt + 1))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new ApiClientError('Request failed.', 500, 'REQUEST_FAILED')
}

const jsonBody = (value: unknown) => JSON.stringify(value)

const analyticsQuery = (days: number, stationId?: string) => {
  const query = new URLSearchParams({ days: String(days) })
  if (stationId) query.set('station_id', stationId)
  return query.toString()
}

export const api = {
  operationsSnapshot: (stationId?: string) => apiRequest(
    `/api/operations/snapshot${stationId ? `?station_id=${encodeURIComponent(stationId)}` : ''}`,
    operationsSnapshotSchema,
  ),
  personnel: () => apiRequest('/api/personnel', z.array(personnelSchema)),
  createPersonnel: (value: unknown) => apiRequest('/api/personnel', personnelSchema, { method: 'POST', body: jsonBody(value) }),
  updatePersonnel: (id: string, value: unknown) => apiRequest(`/api/personnel/${id}`, personnelSchema, { method: 'PUT', body: jsonBody(value) }),
  archivePersonnel: (id: string) => apiRequest(`/api/personnel/${id}`, personnelSchema, { method: 'DELETE' }),
  units: () => apiRequest('/api/units', z.array(unitSchema)),
  stations: () => apiRequest('/api/stations', z.array(stationSchema)),
  readiness: () => apiRequest('/api/readiness/units', z.array(unitReadinessSchema)),
  createUnit: (value: unknown) => apiRequest('/api/units', unitSchema, { method: 'POST', body: jsonBody(value) }),
  updateUnit: (id: string, value: unknown) => apiRequest(`/api/units/${id}`, unitSchema, { method: 'PUT', body: jsonBody(value) }),
  archiveUnit: (id: string) => apiRequest(`/api/units/${id}`, unitSchema, { method: 'DELETE' }),
  assignments: () => apiRequest('/api/unit-assignments', z.array(assignmentSchema)),
  createAssignment: (value: unknown) => apiRequest('/api/unit-assignments', assignmentSchema, { method: 'POST', body: jsonBody(value) }),
  updateAssignment: (id: string, value: unknown) => apiRequest(`/api/unit-assignments/${id}`, assignmentSchema, { method: 'PUT', body: jsonBody(value) }),
  cancelAssignment: (id: string) => apiRequest(`/api/unit-assignments/${id}`, assignmentSchema, { method: 'DELETE' }),
  shifts: () => apiRequest('/api/shifts', z.array(shiftSchema)),
  liveShifts: (date?: string, timezoneOffsetMinutes = new Date().getTimezoneOffset()) => {
    const query = new URLSearchParams({ timezone_offset_minutes: String(timezoneOffsetMinutes) })
    if (date) query.set('target_date', date)
    return apiRequest(`/api/shifts/live?${query}`, z.array(liveShiftSchema))
  },
  createShift: (value: unknown) => apiRequest('/api/shifts', shiftSchema, { method: 'POST', body: jsonBody(value) }),
  updateShift: (id: string, value: unknown) => apiRequest(`/api/shifts/${id}`, shiftSchema, { method: 'PUT', body: jsonBody(value) }),
  cancelShift: (id: string) => apiRequest(`/api/shifts/${id}`, shiftSchema, { method: 'DELETE' }),
  assignShift: (shiftId: string, personnelId: string) => apiRequest(
    `/api/shifts/${shiftId}/assign?employee_id=${encodeURIComponent(personnelId)}`,
    shiftAssignmentSchema,
    { method: 'POST' },
  ),
  clockIn: (shiftId: string, personnelId: string) => apiRequest(`/api/shifts/${shiftId}/clock-in`, shiftActionSchema, {
    method: 'POST', body: jsonBody({ employee_id: personnelId }),
  }),
  clockOut: (shiftId: string, personnelId: string) => apiRequest(`/api/shifts/${shiftId}/clock-out`, shiftActionSchema, {
    method: 'POST', body: jsonBody({ employee_id: personnelId }),
  }),
  alerts: () => apiRequest('/api/alerts', z.array(alertSchema)),
  acknowledgeAlert: (id: string, note?: string) => apiRequest(`/api/alerts/${id}/acknowledge`, alertSchema, {
    method: 'POST', body: jsonBody({ acknowledged_by: 'Duty Officer', note }),
  }),
  resolveAlert: (id: string) => apiRequest(`/api/alerts/${id}/resolve`, alertSchema, { method: 'POST' }),
  incidents: () => apiRequest('/api/incidents?active_only=false', z.array(incidentSchema)),
  createIncident: (value: unknown) => apiRequest('/api/incidents', incidentSchema, { method: 'POST', body: jsonBody(value) }),
  updateIncident: (id: string, value: unknown) => apiRequest(`/api/incidents/${id}`, incidentSchema, { method: 'PUT', body: jsonBody(value) }),
  resolveIncident: (id: string) => apiRequest(`/api/incidents/${id}/resolve`, incidentSchema, { method: 'POST' }),
  certifications: () => apiRequest('/api/certifications', z.array(certificationSchema)),
  createCertification: (value: unknown) => apiRequest('/api/certifications', certificationSchema, { method: 'POST', body: jsonBody(value) }),
  updateCertification: (id: string, value: unknown) => apiRequest(`/api/certifications/${id}`, certificationSchema, { method: 'PUT', body: jsonBody(value) }),
  certificationImpact: (id: string) => apiRequest(`/api/certifications/${id}/impact`, certificationImpactSchema),
  deleteCertification: (id: string, force = false) => apiRequest(`/api/certifications/${id}?force=${force}`, z.object({ message: z.string() }), { method: 'DELETE' }),
  renewalTasks: () => apiRequest('/api/renewal-tasks', z.array(renewalTaskSchema)),
  createRenewalTask: (value: unknown) => apiRequest('/api/renewal-tasks', renewalTaskSchema, { method: 'POST', body: jsonBody(value) }),
  updateRenewalTask: (id: string, value: unknown) => apiRequest(`/api/renewal-tasks/${id}`, renewalTaskSchema, { method: 'PUT', body: jsonBody(value) }),
  auditEvents: (limit = 50, entityType?: string) => apiRequest(
    `/api/audit-events?limit=${limit}${entityType ? `&entity_type=${encodeURIComponent(entityType)}` : ''}`,
    z.array(auditEventSchema),
  ),
  simulateStaffing: (value: unknown) => apiRequest('/api/simulations/staffing-gap', simulationResultSchema, { method: 'POST', body: jsonBody(value) }),
  readinessTrends: (days: number, stationId?: string) => apiRequest(
    `/api/analytics/readiness-trends?${analyticsQuery(days, stationId)}`,
    z.array(readinessTrendSchema),
  ),
  certificationRisk: (days: number, stationId?: string) => {
    const query = new URLSearchParams({ days_ahead: String(days) })
    if (stationId) query.set('station_id', stationId)
    return apiRequest(`/api/analytics/certification-risk?${query}`, z.array(certificationRiskSchema))
  },
  staffingGaps: (stationId?: string) => apiRequest(
    `/api/analytics/staffing-gaps${stationId ? `?station_id=${encodeURIComponent(stationId)}` : ''}`,
    z.array(staffingGapSchema),
  ),
  resetDemo: () => apiRequest('/api/demo/reset', z.object({ status: z.string(), seeded: z.record(z.string(), z.number()) }), { method: 'POST' }),
  weatherFairfax: () => apiRequest('/api/weather/fairfax', fairfaxWeatherSchema, { timeoutMs: 10000, retries: 0 }),
}

export const queryKeys = {
  operations: (stationId?: string) => ['operations', stationId || 'all'] as const,
  shellOperations: (stationId?: string) => ['shell-operations', stationId || 'all'] as const,
  personnel: ['personnel'] as const,
  units: ['units'] as const,
  stations: ['stations'] as const,
  readiness: ['readiness'] as const,
  assignments: ['assignments'] as const,
  shifts: ['shifts'] as const,
  liveShifts: ['shifts', 'live'] as const,
  alerts: ['alerts'] as const,
  incidents: ['incidents'] as const,
  weather: ['weather', 'fairfax'] as const,
  certifications: ['certifications'] as const,
  renewals: ['renewals'] as const,
  audit: ['audit'] as const,
  history: (entityType: string) => ['audit', 'history', entityType] as const,
  analytics: {
    trends: (days: number, stationId?: string) => ['analytics', 'trends', days, stationId || 'all'] as const,
    credentialRisk: (days: number, stationId?: string) => ['analytics', 'credential-risk', days, stationId || 'all'] as const,
    staffing: (stationId?: string) => ['analytics', 'staffing', stationId || 'all'] as const,
  },
}
