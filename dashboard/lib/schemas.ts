import { z } from 'zod'

const nullableDate = z.string().nullable().optional()

export const personnelSchema = z.object({
  personnel_id: z.string(),
  name: z.string(),
  rank: z.string().nullable().optional(),
  role: z.string(),
  certifications: z.array(z.string()).default([]),
  cert_expirations: z.record(z.string(), z.string()).default({}),
  availability_status: z.enum(['AVAILABLE', 'OFF', 'IN_TRAINING', 'DEPLOYED', 'ON_CALL']),
  last_check_in: nullableDate,
  station_id: z.string().nullable().optional(),
  current_unit_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_archived: z.boolean().default(false),
}).passthrough()

export const unitSchema = z.object({
  unit_id: z.string(),
  unit_name: z.string(),
  type: z.enum(['ENGINE', 'LADDER', 'RESCUE', 'MEDIC', 'SAR_TEAM']),
  minimum_staff: z.number(),
  required_certifications: z.array(z.string()).default([]),
  station_id: z.string().nullable().optional(),
  operational_status: z.enum(['AVAILABLE', 'DEPLOYED', 'OUT_OF_SERVICE', 'MAINTENANCE']).default('AVAILABLE'),
  is_archived: z.boolean().default(false),
}).passthrough()

export const stationSchema = z.object({
  station_id: z.string(),
  name: z.string(),
  district: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  unit_ids: z.array(z.string()).default([]),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
}).passthrough()

export const assignmentSchema = z.object({
  assignment_id: z.string(),
  unit_id: z.string(),
  personnel_id: z.string(),
  shift_start: z.string(),
  shift_end: z.string(),
  assignment_status: z.enum(['ON_SHIFT', 'PENDING', 'ABSENT', 'EARLY_OFF', 'CANCELLED']),
  shift_id: z.string().nullable().optional(),
  clocked_in_at: nullableDate,
  clocked_out_at: nullableDate,
  notes: z.string().nullable().optional(),
}).passthrough()

export const certificationSchema = z.object({
  certification_id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  typical_validity_days: z.number().nullable().optional(),
  created_at: nullableDate,
}).passthrough()

export const renewalTaskSchema = z.object({
  renewal_id: z.string(),
  personnel_id: z.string(),
  certification: z.string(),
  due_date: z.string(),
  status: z.enum(['OPEN', 'SCHEDULED', 'COMPLETED', 'CANCELLED']),
  owner: z.string().nullable().optional(),
  scheduled_for: nullableDate,
  notes: z.string().nullable().optional(),
  created_at: nullableDate,
  completed_at: nullableDate,
}).passthrough()

export const shiftSchema = z.object({
  shift_id: z.string(),
  location: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  required_headcount: z.number(),
  station_id: z.string().nullable().optional(),
  unit_id: z.string().nullable().optional(),
  status: z.string(),
  notes: z.string().nullable().optional(),
  created_at: nullableDate,
}).passthrough()

export const liveShiftSchema = shiftSchema.pick({
  shift_id: true,
  location: true,
  start_time: true,
  end_time: true,
  required_headcount: true,
  station_id: true,
  unit_id: true,
}).extend({
  assigned_count: z.number(),
  clocked_in_count: z.number(),
  status: z.string(),
  alerts: z.array(z.string()).default([]),
  assigned_personnel: z.array(z.object({
    personnel_id: z.string(),
    name: z.string(),
    unit_id: z.string(),
    status: z.string(),
    clocked_in_at: nullableDate,
  }).passthrough()).default([]),
})

export const alertSchema = z.object({
  alert_id: z.string(),
  alert_type: z.string(),
  state: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']),
  unit_id: z.string().nullable().optional(),
  station_id: z.string().nullable().optional(),
  personnel_id: z.string().nullable().optional(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: nullableDate,
  acknowledged_at: nullableDate,
  acknowledged_by: z.string().nullable().optional(),
  acknowledged_note: z.string().nullable().optional(),
  resolved_at: nullableDate,
}).passthrough()

export const incidentSchema = z.object({
  incident_id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  station_id: z.string().nullable().optional(),
  unit_id: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: nullableDate,
  resolved_at: nullableDate,
  assigned_unit_ids: z.array(z.string()).default([]),
  commander: z.string().nullable().optional(),
}).passthrough()

export const recommendationSchema = z.object({
  recommendation_id: z.string(),
  unit_id: z.string(),
  action_type: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).nullable().optional(),
  priority: z.string(),
  created_at: nullableDate,
}).passthrough()

export const unitReadinessSchema = z.object({
  unit_id: z.string(),
  unit_name: z.string(),
  unit_type: z.string(),
  readiness_score: z.number(),
  staff_required: z.number(),
  staff_present: z.number(),
  certifications_missing: z.array(z.string()).default([]),
  expired_certifications: z.array(z.string()).default([]),
  is_understaffed: z.boolean(),
  issues: z.array(z.string()).default([]),
  assigned_personnel: z.array(z.object({
    personnel_id: z.string(),
    name: z.string(),
    role: z.string(),
    certifications: z.array(z.string()).default([]),
  }).passthrough()).default([]),
  timestamp: z.string(),
}).passthrough()

export const dashboardSummarySchema = z.object({
  total_units: z.number(),
  ready_units: z.number(),
  degraded_units: z.number(),
  critical_units: z.number(),
  open_alerts: z.number(),
  active_incidents: z.number(),
  overall_readiness_pct: z.number(),
  station_summaries: z.array(z.object({
    station_id: z.string(),
    station_name: z.string(),
    unit_count: z.number(),
    avg_readiness: z.number(),
    critical_units: z.number(),
  }).passthrough()),
  timestamp: z.string(),
})

export const auditEventSchema = z.object({
  audit_id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  actor: z.string(),
  summary: z.string(),
  details: z.record(z.string(), z.unknown()).default({}),
  created_at: nullableDate,
}).passthrough()

export const shiftActionSchema = z.object({
  status: z.string(),
  shift_id: z.string(),
  employee_id: z.string(),
})

export const shiftAssignmentSchema = z.object({
  assignment_id: z.string(),
  shift_id: z.string(),
  employee_id: z.string(),
  assigned_at: nullableDate,
})

export const certificationImpactSchema = z.object({
  certification_id: z.string(),
  personnel_count: z.number(),
  unit_count: z.number(),
  personnel: z.array(z.object({ personnel_id: z.string(), name: z.string() })),
  units: z.array(z.object({ unit_id: z.string(), unit_name: z.string() })),
})

export const simulationResultSchema = z.object({
  scenario: z.string(),
  original_readiness: z.array(unitReadinessSchema),
  degraded_readiness: z.array(unitReadinessSchema),
  impacted_units: z.array(z.string()),
  recovery_actions: z.array(z.string()),
  timestamp: z.string(),
})

export const readinessTrendSchema = z.object({
  date: z.string(),
  overall: z.number(),
}).catchall(z.number())

export const certificationRiskSchema = z.object({
  personnel_id: z.string(),
  personnel_name: z.string(),
  station_id: z.string().nullable().optional(),
  cert: z.string(),
  expires_on: z.string(),
  days_left: z.number(),
  status: z.enum(['EXPIRED', 'CRITICAL', 'WARNING']),
})

export const staffingGapSchema = z.object({
  unit_id: z.string(),
  unit_name: z.string(),
  unit_type: z.string(),
  station_id: z.string().nullable().optional(),
  staff_present: z.number(),
  staff_required: z.number(),
  gap: z.number(),
  readiness_score: z.number(),
})

export const operationsSnapshotSchema = z.object({
  summary: dashboardSummarySchema,
  units: z.array(unitReadinessSchema),
  alerts: z.array(alertSchema),
  incidents: z.array(incidentSchema),
  recommendations: z.array(recommendationSchema),
  renewals: z.array(renewalTaskSchema),
  activity: z.array(auditEventSchema),
  timestamp: z.string(),
})

export type Personnel = z.infer<typeof personnelSchema>
export type Unit = z.infer<typeof unitSchema>
export type Station = z.infer<typeof stationSchema>
export type UnitAssignment = z.infer<typeof assignmentSchema>
export type Certification = z.infer<typeof certificationSchema>
export type RenewalTask = z.infer<typeof renewalTaskSchema>
export type Shift = z.infer<typeof shiftSchema>
export type LiveShift = z.infer<typeof liveShiftSchema>
export type ReadinessAlert = z.infer<typeof alertSchema>
export type Incident = z.infer<typeof incidentSchema>
export type Recommendation = z.infer<typeof recommendationSchema>
export type UnitReadiness = z.infer<typeof unitReadinessSchema>
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type AuditEvent = z.infer<typeof auditEventSchema>
export type OperationsSnapshot = z.infer<typeof operationsSnapshotSchema>
export type CertificationImpact = z.infer<typeof certificationImpactSchema>
export type SimulationResult = z.infer<typeof simulationResultSchema>
export type ReadinessTrend = z.infer<typeof readinessTrendSchema>
export type CertificationRisk = z.infer<typeof certificationRiskSchema>
export type StaffingGap = z.infer<typeof staffingGapSchema>
