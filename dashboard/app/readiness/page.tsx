'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Plus,
  Search,
  ShieldAlert,
  Siren,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { WriteButton as Button, EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader, StatCard, StatusBadge } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import type { UnitReadiness } from '@/lib/schemas'
import { cn, formatRelativeTime, titleCase } from '@/lib/utils'

type Notice = { tone: 'success' | 'danger'; message: string } | null

function readinessTone(score: number) {
  if (score >= 85) return 'success' as const
  if (score >= 60) return 'warning' as const
  return 'danger' as const
}

export default function OperationsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const params = useSearchParams()
  const view = ['units', 'alerts', 'incidents', 'simulation'].includes(params.get('view') || '') ? params.get('view')! : 'units'
  const { stationId } = useStationScope()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUnitId, setSelectedUnitId] = useState(params.get('unit') || '')
  const [unitDialog, setUnitDialog] = useState(false)
  const [assignmentDialog, setAssignmentDialog] = useState(false)
  const [incidentDialog, setIncidentDialog] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const operations = useQuery({
    queryKey: queryKeys.operations(stationId),
    queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId),
  })
  const personnel = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })

  const invalidateOperations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['operations'] }),
      queryClient.invalidateQueries({ queryKey: ['shell-operations'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.units }),
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments }),
      queryClient.invalidateQueries({ queryKey: queryKeys.personnel }),
    ])
  }

  const acknowledge = useMutation({
    mutationFn: (id: string) => api.acknowledgeAlert(id, 'Reviewed in operations workspace'),
    onSuccess: async () => { await invalidateOperations(); setNotice({ tone: 'success', message: 'Alert acknowledged and added to the audit trail.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const resolveAlert = useMutation({
    mutationFn: api.resolveAlert,
    onSuccess: async () => { await invalidateOperations(); setNotice({ tone: 'success', message: 'Alert resolved.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const resolveIncident = useMutation({
    mutationFn: api.resolveIncident,
    onSuccess: async () => { await invalidateOperations(); setNotice({ tone: 'success', message: 'Incident closed.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const updateIncident = useMutation({
    mutationFn: ({ id, value }: { id: string; value: unknown }) => api.updateIncident(id, value),
    onSuccess: async () => { await invalidateOperations(); setNotice({ tone: 'success', message: 'Dispatch lifecycle updated.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const createUnit = useMutation({
    mutationFn: api.createUnit,
    onSuccess: async (unit) => { await invalidateOperations(); setSelectedUnitId(unit.unit_id); setSearch(unit.unit_name); setStatusFilter('all'); setUnitDialog(false); setNotice({ tone: 'success', message: 'Response unit added.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const createAssignment = useMutation({
    mutationFn: api.createAssignment,
    onSuccess: async () => { await invalidateOperations(); setAssignmentDialog(false); setNotice({ tone: 'success', message: 'Personnel assigned to unit.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const createIncident = useMutation({
    mutationFn: api.createIncident,
    onSuccess: () => {
      setIncidentDialog(false)
      router.replace('/readiness?view=incidents', { scroll: false })
      setNotice({ tone: 'success', message: 'Incident opened and recorded.' })
      void invalidateOperations()
    },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const simulation = useMutation({
    mutationFn: ({ unitId, personnelId }: { unitId: string; personnelId?: string }) => api.simulateStaffing({
      unit_id: unitId,
      scenario: personnelId ? 'callout' : 'unit_offline',
      personnel_to_remove: personnelId ? [personnelId] : [],
    }),
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })

  const units = useMemo(() => operations.data?.units || [], [operations.data?.units])
  const filteredUnits = useMemo(() => units.filter((unit) => {
    const matchesSearch = unit.unit_name.toLowerCase().includes(search.toLowerCase()) || unit.unit_type.toLowerCase().includes(search.toLowerCase())
    const tone = readinessTone(unit.readiness_score)
    return matchesSearch && (statusFilter === 'all' || tone === statusFilter)
  }), [units, search, statusFilter])
  const selectedUnit = filteredUnits.find((unit) => unit.unit_id === selectedUnitId) || filteredUnits[0]
  const alerts = operations.data?.alerts || []
  const incidents = operations.data?.incidents || []

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
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-6">
        <PageHeader eyebrow="Operational control" title="Operations" description="Monitor unit readiness, clear exceptions, coordinate incidents, and test staffing contingencies from one workspace." actions={<><Button onClick={() => setIncidentDialog(true)}><Siren className="size-4" />Open incident</Button><Button variant="primary" onClick={() => setUnitDialog(true)}><Plus className="size-4" />Add unit</Button></>} />

        {notice && <div className={cn('notice-banner', notice.tone === 'success' ? 'notice-success' : 'notice-danger')} role="status"><span>{notice.message}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
        {operations.isError && <ErrorState message={operations.error.message} retry={() => operations.refetch()} />}

        <section className="instrument-register grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="District readiness" value={operations.data ? `${Math.round(operations.data.summary.overall_readiness_pct)}%` : '—'} detail={`${operations.data?.summary.ready_units || 0} fully ready units`} icon={CircleDot} tone={readinessTone(operations.data?.summary.overall_readiness_pct || 0)} />
          <StatCard label="Critical units" value={operations.data?.summary.critical_units ?? '—'} detail="Below 60% readiness" icon={ShieldAlert} tone={(operations.data?.summary.critical_units || 0) ? 'danger' : 'success'} />
          <StatCard label="Open exceptions" value={operations.data?.summary.open_alerts ?? '—'} detail="Awaiting duty officer action" icon={AlertTriangle} tone={(operations.data?.summary.open_alerts || 0) ? 'warning' : 'success'} />
          <StatCard label="Active incidents" value={operations.data?.summary.active_incidents ?? '—'} detail="Currently under command" icon={Siren} tone={(operations.data?.summary.active_incidents || 0) ? 'danger' : 'success'} />
        </section>

        <Tabs.Root value={view} onValueChange={(next) => { const query = new URLSearchParams(params.toString()); query.set('view', next); router.replace(`/readiness?${query}`, { scroll: false }) }} className="workspace-tabs">
          <Tabs.List className="tab-list" aria-label="Operations views">
            <Tabs.Trigger value="units">Units <span>{units.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="alerts">Alerts <span>{alerts.filter((alert) => alert.state !== 'RESOLVED').length}</span></Tabs.Trigger>
            <Tabs.Trigger value="incidents">Incidents <span>{incidents.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="simulation">Contingency lab</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="units" className="tab-content">
            <div className="toolbar">
              <label className="search-control"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search units" /></label>
              <div className="segmented-control" aria-label="Readiness filter">{['all', 'success', 'warning', 'danger'].map((value) => <button key={value} className={cn(statusFilter === value && 'active')} onClick={() => setStatusFilter(value)}>{value === 'all' ? 'All' : value === 'success' ? 'Ready' : value === 'warning' ? 'Degraded' : 'Critical'}</button>)}</div>
            </div>
            {operations.isLoading ? <div className="ops-panel"><LoadingState rows={7} /></div> : (
              <div className="master-detail-grid">
                <section className="ops-panel unit-list-panel">
                  {filteredUnits.map((unit) => <UnitRow key={unit.unit_id} unit={unit} active={selectedUnit?.unit_id === unit.unit_id} onSelect={() => { setSelectedUnitId(unit.unit_id); simulation.reset() }} />)}
                  {!filteredUnits.length && <EmptyState title="No units match" description="Adjust the search or readiness filter." />}
                </section>
                <section className="ops-panel detail-panel">
                  {selectedUnit ? <UnitDetail unit={selectedUnit} onAssign={() => setAssignmentDialog(true)} /> : <EmptyState title="Select a unit" description="Choose a response unit to review staffing and credential risk." />}
                </section>
              </div>
            )}
          </Tabs.Content>

          <Tabs.Content value="alerts" className="tab-content">
            <section className="ops-panel table-panel">
              <SectionHeader title="Exception queue" description="Every action is preserved in the durable audit history" />
              <div className="responsive-table"><table className="data-table"><thead><tr><th>Alert</th><th>Scope</th><th>Created</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{alerts.map((alert) => <tr key={alert.alert_id}><td><div className="primary-cell"><AlertTriangle className="size-4 text-red-300" /><span><strong>{alert.message}</strong><small>{titleCase(alert.alert_type)}</small></span></div></td><td>{alert.unit_id || alert.station_id || 'District'}</td><td>{formatRelativeTime(alert.created_at)}</td><td><StatusBadge tone={alert.state === 'OPEN' ? 'danger' : alert.state === 'ACKNOWLEDGED' ? 'warning' : 'success'}>{alert.state}</StatusBadge></td><td><div className="row-actions">{alert.state === 'OPEN' && <Button variant="ghost" onClick={() => acknowledge.mutate(alert.alert_id)} busy={acknowledge.isPending}><Check className="size-4" />Acknowledge</Button>}{alert.state !== 'RESOLVED' && <Button variant="ghost" onClick={() => resolveAlert.mutate(alert.alert_id)} busy={resolveAlert.isPending}><CheckCircle2 className="size-4" />Resolve</Button>}</div></td></tr>)}</tbody></table></div>
              {!alerts.length && <EmptyState title="No alerts" description="This station scope has no operational exceptions." icon={CheckCircle2} />}
            </section>
          </Tabs.Content>

          <Tabs.Content value="incidents" className="tab-content">
            <section className="ops-panel">
              <SectionHeader title="Incident command" description="Active events and their assigned response resources" action={<Button variant="primary" onClick={() => setIncidentDialog(true)}><Plus className="size-4" />Open incident</Button>} />
              <div className="incident-grid">{incidents.map((incident) => <article key={incident.incident_id} className="incident-card"><div><StatusBadge tone={incident.priority === 'CRITICAL' ? 'danger' : incident.priority === 'HIGH' ? 'warning' : 'info'}>{incident.priority}</StatusBadge><StatusBadge tone={incident.status === 'ON_SCENE' ? 'danger' : 'warning'}>{incident.status.replaceAll('_', ' ')}</StatusBadge></div><h3>{incident.title}</h3><p>{incident.display_location || 'Location pending'} · {incident.incident_type}</p><p>{incident.description || 'No incident detail entered.'}</p><dl><div><dt>Commander</dt><dd>{incident.commander || 'Unassigned'}</dd></div><div><dt>Unit</dt><dd>{incident.unit_id || 'District-wide'}</dd></div></dl><Field label="Dispatch lifecycle"><select className="form-control" value={incident.status} disabled={updateIncident.isPending} onChange={(event) => updateIncident.mutate({ id: incident.incident_id, value: { ...incident, status: event.target.value } })}><option>ACTIVE</option><option>ENROUTE</option><option>ON_SCENE</option><option>TRANSPORT</option><option>INVESTIGATING</option></select></Field><Button onClick={() => resolveIncident.mutate(incident.incident_id)} busy={resolveIncident.isPending}><CheckCircle2 className="size-4" />Close incident</Button></article>)}</div>
              {!incidents.length && <EmptyState title="No active incidents" description="Open a new incident when an event requires coordinated command." icon={Siren} />}
            </section>
          </Tabs.Content>

          <Tabs.Content value="simulation" className="tab-content">
            <div className="master-detail-grid">
              <section className="ops-panel"><SectionHeader title="Contingency scenario" description="Select a unit, then remove one member or place the unit offline" />{selectedUnit ? <><div className="simulation-unit"><span className={`score-ring score-${readinessTone(selectedUnit.readiness_score)}`}>{selectedUnit.readiness_score}</span><div><strong>{selectedUnit.unit_name}</strong><small>{selectedUnit.staff_present} personnel currently assigned</small></div></div><div className="simulation-actions"><Button onClick={() => simulation.mutate({ unitId: selectedUnit.unit_id })} busy={simulation.isPending}><Wrench className="size-4" />Simulate unit offline</Button>{selectedUnit.assigned_personnel.map((person) => <Button key={person.personnel_id} onClick={() => simulation.mutate({ unitId: selectedUnit.unit_id, personnelId: person.personnel_id })} busy={simulation.isPending}><UserPlus className="size-4" />Call out {person.name}</Button>)}</div></> : <EmptyState title="Select a unit first" description="Return to Units and choose the operational asset to test." />}</section>
              <section className="ops-panel"><SectionHeader title="Projected impact" description="Readiness change and recommended recovery sequence" />{simulation.data ? <div className="simulation-result"><div className="simulation-score"><span>Before<strong>{simulation.data.original_readiness[0]?.readiness_score ?? '—'}%</strong></span><ArrowRight className="size-5" /><span>After<strong>{simulation.data.degraded_readiness[0]?.readiness_score ?? '—'}%</strong></span></div><div className="recovery-list">{simulation.data.recovery_actions.map((action) => <div key={action}><FlaskConical className="size-4" /><span>{action}</span></div>)}</div></div> : <EmptyState title="Run a scenario" description="Simulation does not alter live assignments or operational state." icon={FlaskConical} />}</section>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <FormDialog open={unitDialog} onOpenChange={setUnitDialog} title="Add response unit" description="Define staffing and credential requirements for a new operational asset." submitLabel="Add unit" submitting={createUnit.isPending} error={createUnit.error?.message} onSubmit={submitUnit}><div className="form-grid"><Field label="Unit name"><input className="form-control" name="unit_name" required /></Field><Field label="Unit type"><select className="form-control" name="type" defaultValue="ENGINE"><option>ENGINE</option><option>LADDER</option><option>RESCUE</option><option>MEDIC</option><option>SAR_TEAM</option></select></Field><Field label="Minimum staff"><input className="form-control" name="minimum_staff" type="number" min="1" defaultValue="3" required /></Field><Field label="Station"><select className="form-control" name="station_id" defaultValue={stationId === 'all' ? '' : stationId}><option value="">Unassigned</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field><Field label="Required certifications" hint="Comma-separated credential names"><input className="form-control" name="required_certifications" placeholder="FF1, EMT-B" /></Field></div></FormDialog>

      <FormDialog open={assignmentDialog} onOpenChange={setAssignmentDialog} title={`Assign to ${selectedUnit?.unit_name || 'unit'}`} description="Conflicts and required credentials are validated before assignment." submitLabel="Assign personnel" submitting={createAssignment.isPending} error={createAssignment.error?.message} onSubmit={submitAssignment}><div className="form-grid"><Field label="Personnel"><select className="form-control" name="personnel_id" required><option value="">Select personnel</option>{personnel.data?.filter((person) => person.availability_status !== 'OFF').map((person) => <option key={person.personnel_id} value={person.personnel_id}>{person.name} · {person.role}</option>)}</select></Field><Field label="Shift start"><input className="form-control" name="shift_start" type="datetime-local" required /></Field><Field label="Shift end"><input className="form-control" name="shift_end" type="datetime-local" required /></Field><Field label="Notes"><input className="form-control" name="notes" /></Field></div></FormDialog>

      <FormDialog open={incidentDialog} onOpenChange={setIncidentDialog} title="Open incident" description="Create a complete dispatch record and assign an initial station or unit." submitLabel="Open incident" submitting={createIncident.isPending} error={createIncident.error?.message} onSubmit={submitIncident}><div className="form-grid"><Field label="Incident title"><input className="form-control" name="title" required /></Field><Field label="Display location"><input className="form-control" name="display_location" placeholder="12000 Fair Oaks Mall, Fairfax, VA" required /></Field><Field label="Incident type"><select className="form-control" name="incident_type" defaultValue="EMS"><option>FIRE</option><option>EMS</option><option>HAZMAT</option><option>OTHER</option></select></Field><Field label="Dispatch lifecycle"><select className="form-control" name="status" defaultValue="ACTIVE"><option>ACTIVE</option><option>ENROUTE</option><option>ON_SCENE</option><option>TRANSPORT</option><option>INVESTIGATING</option></select></Field><Field label="Priority"><select className="form-control" name="priority" defaultValue="HIGH"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></Field><Field label="Station"><select className="form-control" name="station_id" defaultValue={stationId === 'all' ? '' : stationId}><option value="">District-wide</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name}</option>)}</select></Field><Field label="Initial unit"><select className="form-control" name="unit_id"><option value="">Not assigned</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.unit_name}</option>)}</select></Field><Field label="Incident commander"><input className="form-control" name="commander" placeholder="Duty officer" /></Field><Field label="Description"><textarea className="form-control min-h-24" name="description" /></Field></div></FormDialog>
    </div>
  )
}

function UnitRow({ unit, active, onSelect }: { unit: UnitReadiness; active: boolean; onSelect: () => void }) {
  const tone = readinessTone(unit.readiness_score)
  return <button type="button" className={cn('unit-list-row', active && 'unit-list-row-active')} onClick={onSelect}><span className={`score-ring score-${tone}`}>{unit.readiness_score}</span><span className="min-w-0 flex-1"><strong>{unit.unit_name}</strong><small>{titleCase(unit.unit_type)} · {unit.staff_present}/{unit.staff_required} staffed</small></span><ChevronRight className="size-4" /></button>
}

function UnitDetail({ unit, onAssign }: { unit: UnitReadiness; onAssign: () => void }) {
  const tone = readinessTone(unit.readiness_score)
  return <div className="unit-detail"><div className="unit-detail-heading"><div><span className="eyebrow">{titleCase(unit.unit_type)}</span><h2>{unit.unit_name}</h2></div><StatusBadge tone={tone}>{tone === 'success' ? 'Ready' : tone === 'warning' ? 'Degraded' : 'Critical'}</StatusBadge></div><div className="readiness-meter"><div><span>Readiness score</span><strong>{unit.readiness_score}%</strong></div><span><i className={`meter-${tone}`} style={{ width: `${unit.readiness_score}%` }} /></span></div><dl className="detail-metrics"><div><dt>Staffed</dt><dd>{unit.staff_present}/{unit.staff_required}</dd></div><div><dt>Open issues</dt><dd>{unit.issues.length}</dd></div><div><dt>Missing credentials</dt><dd>{unit.certifications_missing.length}</dd></div></dl><div className="detail-section"><h3>Assigned personnel</h3>{unit.assigned_personnel.map((person) => <div key={person.personnel_id} className="person-compact"><span>{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{person.name}</strong><small>{person.role} · {person.certifications.length} credentials</small></div></div>)}{!unit.assigned_personnel.length && <div className="compact-empty">No active personnel assigned.</div>}</div>{unit.issues.length > 0 && <div className="detail-section"><h3>Readiness blockers</h3><div className="issue-list">{unit.issues.map((issue) => <div key={issue}><AlertTriangle className="size-4" />{issue}</div>)}</div></div>}<Button variant="primary" className="w-full" onClick={onAssign}><Users className="size-4" />Assign personnel</Button></div>
}
