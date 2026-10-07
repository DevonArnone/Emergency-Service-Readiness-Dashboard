'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'
import AlertsQueue from '@/components/AlertsQueue'
import { ConfirmDialog } from '@/components/ConfirmAction'
import ContingencyWorkbench from '@/components/ContingencyWorkbench'
import FormDialog, { Field } from '@/components/FormDialog'
import IncidentsWorkspace from '@/components/IncidentsWorkspace'
import { useStationScope } from '@/components/ScopeContext'
import UnitsWorkspace from '@/components/UnitsWorkspace'
import { ErrorState, Notice, type NoticeValue } from '@/components/ui'
import { useOperationalHistory } from '@/hooks/useOperationalHistory'
import { api, queryKeys } from '@/lib/api'
import type { Unit } from '@/lib/schemas'

type ActionError = { key: string; message: string } | null
type View = 'units' | 'alerts' | 'incidents' | 'simulation'

export default function OperationsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const params = useSearchParams()
  const view: View = ['units', 'alerts', 'incidents', 'simulation'].includes(params.get('view') || '') ? params.get('view') as View : 'units'
  const { stationId } = useStationScope()
  const [selectedUnitId, setSelectedUnitId] = useState(params.get('unit') || '')
  const [unitDialog, setUnitDialog] = useState(false)
  const [assignmentDialog, setAssignmentDialog] = useState(false)
  const [incidentDialog, setIncidentDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<{ unit: Unit; status: Unit['operational_status'] } | null>(null)
  const [notice, setNotice] = useState<NoticeValue>(null)
  const [actionError, setActionError] = useState<ActionError>(null)

  const operations = useQuery({
    queryKey: queryKeys.operations(stationId),
    queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId),
  })
  const personnel = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel, enabled: view === 'units' })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const unitDefinitions = useQuery({ queryKey: queryKeys.units, queryFn: api.units, enabled: view !== 'alerts' })
  const assignments = useQuery({ queryKey: queryKeys.assignments, queryFn: api.assignments, enabled: view === 'units' })
  const alertRecords = useQuery({ queryKey: queryKeys.alerts, queryFn: api.alerts, enabled: view === 'alerts' })
  const history = useOperationalHistory(view === 'units' || view === 'incidents')

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['operations'] }),
      queryClient.invalidateQueries({ queryKey: ['shell-operations'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.units }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments }),
      queryClient.invalidateQueries({ queryKey: queryKeys.personnel }),
      queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents }),
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
    ])
  }
  const succeed = async (message: string) => { setActionError(null); await invalidateOperations(); setNotice({ tone: 'success', message }) }
  const fail = (key: string) => (error: Error) => setActionError({ key, message: error.message })

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id, 'Reviewed in operations workspace'),
    onSuccess: () => succeed('Alert acknowledged and added to the audit trail.'),
    onError: (error: Error, id) => fail(id)(error),
  })
  const resolveAlert = useMutation({
    mutationFn: api.resolveAlert,
    onSuccess: () => succeed('Alert resolved.'),
    onError: (error: Error, id) => fail(id)(error),
  })
  const resolveIncident = useMutation({
    mutationFn: api.resolveIncident,
    onSuccess: () => succeed('Incident closed.'),
  })
  const updateIncident = useMutation({
    mutationFn: ({ id, value }: { id: string; value: unknown }) => api.updateIncident(id, value),
    onSuccess: () => succeed('Dispatch lifecycle updated.'),
    onError: (error: Error, variables) => fail(variables.id)(error),
  })
  const createUnit = useMutation({
    mutationFn: api.createUnit,
    onSuccess: async (unit) => { await succeed('Response unit added.'); setSelectedUnitId(unit.unit_id); setUnitDialog(false) },
  })
  const updateUnitStatus = useMutation({
    mutationFn: ({ id, value }: { id: string; value: Unit }) => api.updateUnit(id, value),
    onSuccess: () => succeed('Unit service status updated and recorded.'),
  })
  const createAssignment = useMutation({
    mutationFn: api.createAssignment,
    onSuccess: async () => { await succeed('Personnel assigned to unit.'); setAssignmentDialog(false) },
  })
  const createIncident = useMutation({
    mutationFn: api.createIncident,
    onSuccess: () => {
      setIncidentDialog(false)
      router.replace('/readiness?view=incidents', { scroll: false })
      void succeed('Incident opened and recorded.')
    },
  })
  const simulation = useMutation({
    mutationFn: ({ unitId, personnelId }: { unitId: string; personnelId?: string }) => api.simulateStaffing({
      unit_id: unitId,
      scenario: personnelId ? 'callout' : 'unit_offline',
      personnel_to_remove: personnelId ? [personnelId] : [],
    }),
    onSuccess: () => setActionError(null),
    onError: (error: Error, variables) => fail(variables.unitId)(error),
  })

  const units = useMemo(() => operations.data?.units || [], [operations.data?.units])
  const scopedUnits = view === 'units' && stationId !== 'all'
    ? units.filter((unit) => unitDefinitions.data?.some((definition) => definition.unit_id === unit.unit_id && definition.station_id === stationId))
    : units
  const incidents = operations.data?.incidents || []
  const latestIncident = [...incidents].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .find((incident) => scopedUnits.some((unit) => unit.unit_id === (incident.unit_id || incident.assigned_unit_ids[0])))
  const selectedUnit = scopedUnits.find((unit) => unit.unit_id === selectedUnitId)
    || scopedUnits.find((unit) => unit.unit_id === (latestIncident?.unit_id || latestIncident?.assigned_unit_ids[0]))
    || scopedUnits[0]
  const scopedAlerts = (alertRecords.data || operations.data?.alerts || []).filter((alert) => stationId === 'all' || alert.station_id === stationId)

  const selectUnit = (id: string, nextView: 'units' | 'simulation' = 'units') => {
    setSelectedUnitId(id)
    simulation.reset()
    setActionError(null)
    const query = new URLSearchParams(params.toString())
    query.set('view', nextView)
    query.set('unit', id)
    router.replace(`/readiness?${query}`, { scroll: false })
  }

  const statusAction = pendingStatus?.status === 'OUT_OF_SERVICE' ? 'Mark out of service' : pendingStatus?.status === 'MAINTENANCE' ? 'Place in maintenance' : 'Return to service'
  const committedIncident = pendingStatus && pendingStatus.status !== 'AVAILABLE' ? incidents.find((incident) => incident.unit_id === pendingStatus.unit.unit_id || incident.assigned_unit_ids.includes(pendingStatus.unit.unit_id)) : undefined

  const submitUnit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    createUnit.mutate({
      unit_name: data.get('unit_name'), type: data.get('type'), minimum_staff: Number(data.get('minimum_staff')),
      station_id: data.get('station_id') || null,
      required_certifications: String(data.get('required_certifications') || '').split(',').map((value) => value.trim()).filter(Boolean),
      operational_status: 'AVAILABLE', is_archived: false,
    })
  }

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedUnit) return
    const data = new FormData(event.currentTarget)
    createAssignment.mutate({
      unit_id: selectedUnit.unit_id,
      personnel_id: data.get('personnel_id'),
      shift_start: new Date(String(data.get('shift_start'))).toISOString(),
      shift_end: new Date(String(data.get('shift_end'))).toISOString(),
      assignment_status: 'ON_SHIFT', notes: data.get('notes') || null,
    })
  }

  const submitIncident = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    createIncident.mutate({
      title: data.get('title'), description: data.get('description') || null, priority: data.get('priority'),
      incident_type: data.get('incident_type'), display_location: data.get('display_location') || null, status: data.get('status'),
      station_id: data.get('station_id') || null, unit_id: data.get('unit_id') || null,
      commander: data.get('commander') || null, assigned_unit_ids: data.get('unit_id') ? [data.get('unit_id')] : [], is_active: true,
    })
  }

  return (
    <>
      {(notice || operations.isError || (view === 'units' && (unitDefinitions.isError || assignments.isError))) && (
        <div className="ui-notice-region">
          <Notice notice={notice} onDismiss={() => setNotice(null)} />
          {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}
          {view === 'units' && unitDefinitions.isError && <ErrorState message={unitDefinitions.error.message} retry={() => unitDefinitions.refetch()} />}
          {view === 'units' && assignments.isError && <ErrorState message={assignments.error.message} retry={() => assignments.refetch()} />}
        </div>
      )}

      {view === 'incidents' && (
        <IncidentsWorkspace snapshot={operations.data} stations={stations.data || []} definitions={unitDefinitions.data || []} history={history} scope={stationId}
          loading={operations.isLoading || history.loading} updating={updateIncident.isPending} resolving={resolveIncident.isPending} actionError={actionError}
          onOpen={() => { createIncident.reset(); setIncidentDialog(true) }}
          onUpdate={async (incident) => { await updateIncident.mutateAsync({ id: incident.incident_id, value: incident }) }}
          onResolve={(id) => resolveIncident.mutateAsync(id)} />
      )}
      {view === 'units' && (
        <UnitsWorkspace snapshot={operations.data} stations={stations.data || []} definitions={unitDefinitions.data || []} assignments={assignments.data || []} personnel={personnel.data || []} history={history} scope={stationId}
          selectedUnit={selectedUnit} onSelectUnit={(id) => selectUnit(id)} onAddUnit={() => { createUnit.reset(); setUnitDialog(true) }} onAssign={() => { createAssignment.reset(); setAssignmentDialog(true) }}
          onSimulate={(unitId) => simulation.mutate({ unitId })} simulation={simulation.data} simulating={simulation.isPending}
          onSetStatus={(unit, status) => setPendingStatus({ unit, status })} updatingStatus={updateUnitStatus.isPending} actionError={actionError}
          loading={operations.isLoading || stations.isLoading || unitDefinitions.isLoading || assignments.isLoading} />
      )}
      {view === 'alerts' && (
        <AlertsQueue alerts={scopedAlerts} loading={alertRecords.isLoading && operations.isLoading} error={alertRecords.error?.message} retry={() => alertRecords.refetch()} stations={stations.data || []} units={units}
          acknowledging={acknowledge.isPending} resolving={resolveAlert.isPending} actionError={actionError}
          onAcknowledge={(id) => acknowledge.mutate(id)} onResolve={(id) => resolveAlert.mutate(id)} />
      )}
      {view === 'simulation' && (
        <ContingencyWorkbench units={units} definitions={unitDefinitions.data || []} selected={selectedUnit} result={simulation.data} busy={simulation.isPending} error={actionError?.message}
          onSelect={(id) => selectUnit(id, 'simulation')} onRun={(unitId, personnelId) => simulation.mutate({ unitId, personnelId })} onReset={() => { simulation.reset(); setActionError(null) }} />
      )}

      <FormDialog open={unitDialog} onOpenChange={setUnitDialog} title="Add response unit" description="Define staffing and credential requirements for a new operational asset." submitLabel="Add unit" submitting={createUnit.isPending} error={createUnit.error?.message} onSubmit={submitUnit}>
        <div className="ui-form-grid">
          <Field label="Unit name"><input className="ui-input" name="unit_name" required /></Field>
          <Field label="Unit type"><select className="ui-select" name="type" defaultValue="ENGINE"><option>ENGINE</option><option>LADDER</option><option>RESCUE</option><option>MEDIC</option><option>SAR_TEAM</option></select></Field>
          <Field label="Minimum staff"><input className="ui-input" name="minimum_staff" type="number" min="1" defaultValue="3" required /></Field>
          <Field label="Station"><select className="ui-select" name="station_id" defaultValue={stationId === 'all' ? '' : stationId}><option value="">Unassigned</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field>
          <Field label="Required certifications" hint="Comma-separated credential names"><input className="ui-input" name="required_certifications" placeholder="FF1, EMT-B" /></Field>
        </div>
      </FormDialog>

      <FormDialog open={assignmentDialog} onOpenChange={setAssignmentDialog} title={`Assign to ${selectedUnit?.unit_name || 'unit'}`} description="Conflicts and required credentials are validated before assignment." submitLabel="Assign personnel" submitting={createAssignment.isPending} error={createAssignment.error?.message} onSubmit={submitAssignment}>
        <div className="ui-form-grid">
          <Field label="Personnel"><select className="ui-select" name="personnel_id" required><option value="">Select personnel</option>{personnel.data?.filter((person) => person.availability_status !== 'OFF').map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.name} · {person.role}</option>)}</select></Field>
          <Field label="Shift start"><input className="ui-input" name="shift_start" type="datetime-local" required /></Field>
          <Field label="Shift end"><input className="ui-input" name="shift_end" type="datetime-local" required /></Field>
          <Field label="Notes"><input className="ui-input" name="notes" /></Field>
        </div>
      </FormDialog>

      <FormDialog open={incidentDialog} onOpenChange={setIncidentDialog} title="Open incident" description="Create a complete dispatch record and assign an initial station or unit." submitLabel="Open incident" submitting={createIncident.isPending} error={createIncident.error?.message} onSubmit={submitIncident}>
        <div className="ui-form-grid">
          <Field label="Incident title"><input className="ui-input" name="title" required /></Field>
          <Field label="Display location"><input className="ui-input" name="display_location" placeholder="12000 Fair Oaks Mall, Fairfax, VA" required /></Field>
          <Field label="Incident type"><select className="ui-select" name="incident_type" defaultValue="EMS"><option>FIRE</option><option>EMS</option><option>HAZMAT</option><option>OTHER</option></select></Field>
          <Field label="Dispatch lifecycle"><select className="ui-select" name="status" defaultValue="ACTIVE"><option>ACTIVE</option><option>ENROUTE</option><option>ON_SCENE</option><option>TRANSPORT</option><option>INVESTIGATING</option></select></Field>
          <Field label="Priority"><select className="ui-select" name="priority" defaultValue="HIGH"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field>
          <Field label="Station"><select className="ui-select" name="station_id" defaultValue={stationId === 'all' ? '' : stationId}><option value="">District-wide</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field>
          <Field label="Initial unit"><select className="ui-select" name="unit_id"><option value="">Not assigned</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.unit_name}</option>)}</select></Field>
          <Field label="Incident commander"><input className="ui-input" name="commander" placeholder="Duty officer" /></Field>
        </div>
        <Field label="Description"><textarea className="ui-input" name="description" /></Field>
      </FormDialog>

      <ConfirmDialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null) }} title={`${statusAction}: ${pendingStatus?.unit.unit_name || 'unit'}?`} description="This changes the recorded unit status and readiness posture."
        detail={committedIncident ? `${pendingStatus?.unit.unit_name} is still assigned to an active incident (${committedIncident.title}); its incident assignment is not changed. The change is added to the audit history.` : 'The change is added to the audit history and appears on the deployment history.'}
        confirmLabel={statusAction} tone={pendingStatus?.status === 'AVAILABLE' ? 'primary' : 'danger'}
        onConfirm={async () => { if (pendingStatus) await updateUnitStatus.mutateAsync({ id: pendingStatus.unit.unit_id, value: { ...pendingStatus.unit, operational_status: pendingStatus.status } }) }} />
    </>
  )
}
