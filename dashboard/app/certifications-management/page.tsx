'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import ConfirmAction from '@/components/ConfirmAction'
import { usePagination } from '@/hooks/usePagination'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { WriteButton as Button, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SectionHeader, StatCard, StatusBadge } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import type { Certification, RenewalTask } from '@/lib/schemas'
import { cn, formatDate } from '@/lib/utils'
import { CredentialHorizon, UnitQualificationMatrix, type ExpirationBand } from '@/components/OperatingSurfaces'

type Notice = { tone: 'success' | 'danger'; message: string } | null
type CredentialRisk = { personnelId: string; personnelName: string; stationId?: string | null; certification: string; expiresOn: string; daysLeft: number }

function riskTone(days: number) {
  if (days < 0) return 'danger' as const
  if (days <= 14) return 'danger' as const
  if (days <= 30) return 'warning' as const
  return 'info' as const
}

export default function CredentialsPage() {
  const queryClient = useQueryClient()
  const { stationId } = useStationScope()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('renewals')
  const [band, setBand] = useState<ExpirationBand>('all')
  const [renewalDialog, setRenewalDialog] = useState<CredentialRisk | null>(null)
  const [editingCert, setEditingCert] = useState<Certification | 'new' | null>(null)
  const [selectedCertId, setSelectedCertId] = useState('')
  const [renewalAction, setRenewalAction] = useState<{ task: RenewalTask; status: RenewalTask['status'] } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const people = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const certifications = useQuery({ queryKey: queryKeys.certifications, queryFn: api.certifications })
  const renewals = useQuery({ queryKey: queryKeys.renewals, queryFn: api.renewalTasks })
  const units = useQuery({ queryKey: queryKeys.units, queryFn: api.units })
  const activeCertId = selectedCertId || certifications.data?.[0]?.certification_id || ''
  const impact = useQuery({
    queryKey: ['certification-impact', activeCertId],
    queryFn: () => api.certificationImpact(activeCertId),
    enabled: Boolean(activeCertId),
  })

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.certifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.renewals }),
      queryClient.invalidateQueries({ queryKey: ['certification-impact'] }),
      queryClient.invalidateQueries({ queryKey: ['operations'] }),
    ])
  }

  const saveCertification = useMutation({
    mutationFn: ({ existing, payload }: { existing?: Certification; payload: unknown }) => existing ? api.updateCertification(existing.certification_id, payload) : api.createCertification(payload),
    onSuccess: async (saved) => { await invalidate(); setEditingCert(null); setSelectedCertId(saved.certification_id); setNotice({ tone: 'success', message: 'Credential definition saved.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const deleteCertification = useMutation({
    mutationFn: (id: string) => api.deleteCertification(id),
    onSuccess: async () => { await invalidate(); setSelectedCertId(''); setNotice({ tone: 'success', message: 'Unused credential definition deleted.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const createRenewal = useMutation({
    mutationFn: api.createRenewalTask,
    onSuccess: async () => { await invalidate(); setRenewalDialog(null); setNotice({ tone: 'success', message: 'Renewal task created.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })
  const updateRenewal = useMutation({
    mutationFn: ({ task, status, owner, scheduledFor }: { task: RenewalTask; status: RenewalTask['status']; owner: string; scheduledFor?: string }) => api.updateRenewalTask(task.renewal_id, {
      ...task, status,
      owner,
      scheduled_for: scheduledFor || task.scheduled_for,
    }),
    onSuccess: async () => { await invalidate(); setRenewalAction(null); setNotice({ tone: 'success', message: 'Renewal task updated. Credential dates change only when verified in the personnel profile.' }) },
    onError: (error: Error) => setNotice({ tone: 'danger', message: error.message }),
  })

  const scopedPeople = useMemo(() => (people.data || []).filter((person) => stationId === 'all' || person.station_id === stationId), [people.data, stationId])
  const risks = useMemo(() => scopedPeople.flatMap((person) => Object.entries(person.cert_expirations).map(([certification, expiresOn]) => ({
    personnelId: person.personnel_id, personnelName: person.name, stationId: person.station_id, certification, expiresOn,
    daysLeft: Math.floor((new Date(expiresOn).getTime() - Date.now()) / 86400000),
  }))).filter((risk) => risk.daysLeft <= 90).sort((a, b) => a.daysLeft - b.daysLeft), [scopedPeople])
  const filteredRisks = risks.filter((risk) => `${risk.personnelName} ${risk.certification}`.toLowerCase().includes(search.toLowerCase()) && (band === 'all' || (band === 'expired' && risk.daysLeft < 0) || (band === '14' && risk.daysLeft >= 0 && risk.daysLeft <= 14) || (band === '30' && risk.daysLeft > 14 && risk.daysLeft <= 30) || (band === '90' && risk.daysLeft > 30 && risk.daysLeft <= 90)))
  const riskPage = usePagination(filteredRisks, `${stationId}:${search}:${band}`)
  const openRenewals = (renewals.data || []).filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && scopedPeople.some((person) => person.personnel_id === task.personnel_id))
  const renewalPage = usePagination(openRenewals, stationId)
  const selectedCert = certifications.data?.find((cert) => cert.certification_id === selectedCertId) || certifications.data?.[0]
  const selectedImpact = impact.data

  const submitCertification = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const existing = editingCert === 'new' ? undefined : editingCert || undefined
    saveCertification.mutate({ existing, payload: {
      ...(existing || {}), name: data.get('name'), category: data.get('category') || null, description: data.get('description') || null,
      typical_validity_days: data.get('typical_validity_days') ? Number(data.get('typical_validity_days')) : null,
    } })
  }

  const submitRenewal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renewalDialog) return
    const data = new FormData(event.currentTarget)
    createRenewal.mutate({
      personnel_id: renewalDialog.personnelId, certification: renewalDialog.certification,
      due_date: new Date(String(data.get('due_date'))).toISOString(), owner: data.get('owner') || null,
      status: data.get('status'), notes: data.get('notes') || null,
    })
  }

  return (
    <div className="ops-page page-enter civic-workspace">
      <div className="ops-shell space-y-6">
        <PageHeader eyebrow="Qualification assurance" title="Credentials" description="Work a prioritized renewal queue, measure qualification risk, and safely maintain credential definitions and unit requirements." actions={<Button variant="primary" onClick={() => setEditingCert('new')}><Plus className="size-4" />Add credential</Button>} />
        {notice && <div className={cn('notice-banner', notice.tone === 'success' ? 'notice-success' : 'notice-danger')} role="status"><span>{notice.message}</span><button onClick={() => setNotice(null)}>Dismiss</button></div>}
        {(people.isError || certifications.isError || renewals.isError) && <ErrorState message={people.error?.message || certifications.error?.message || renewals.error?.message} retry={() => { people.refetch(); certifications.refetch(); renewals.refetch() }} />}

        <section className="instrument-register grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Compliance rate" value={risks.length ? `${Math.round(((scopedPeople.reduce((sum, person) => sum + person.certifications.length, 0) - risks.filter((risk) => risk.daysLeft < 0).length) / Math.max(1, scopedPeople.reduce((sum, person) => sum + person.certifications.length, 0))) * 100)}%` : '100%'} detail="Non-expired personnel credentials" icon={ShieldCheck} tone={risks.some((risk) => risk.daysLeft < 0) ? 'warning' : 'success'} />
          <StatCard label="Expired" value={risks.filter((risk) => risk.daysLeft < 0).length} detail="Immediate qualification impact" icon={AlertTriangle} tone={risks.some((risk) => risk.daysLeft < 0) ? 'danger' : 'success'} />
          <StatCard label="Due in 30 days" value={risks.filter((risk) => risk.daysLeft >= 0 && risk.daysLeft <= 30).length} detail="Renew before operational impact" icon={Clock3} tone={risks.some((risk) => risk.daysLeft >= 0 && risk.daysLeft <= 30) ? 'warning' : 'success'} />
          <StatCard label="Open renewals" value={openRenewals.length} detail="Tracked tasks in workflow" icon={CalendarCheck} tone={openRenewals.length ? 'info' : 'success'} />
        </section>

        <CredentialHorizon days={risks.map(risk => risk.daysLeft)} selected={band} onSelect={value => { setBand(value); setView('risk') }} />

        <Tabs.Root value={view} onValueChange={setView} className="workspace-tabs">
          <Tabs.List className="tab-list" aria-label="Credential views">
            <Tabs.Trigger value="renewals">Renewal queue <span>{openRenewals.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="risk">Workforce risk <span>{risks.length}</span></Tabs.Trigger>
            <Tabs.Trigger value="library">Credential library <span>{certifications.data?.length || 0}</span></Tabs.Trigger>
            <Tabs.Trigger value="requirements">Unit requirements</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="renewals" className="tab-content">
            <section className="ops-panel table-panel">
              <SectionHeader title="Renewal work queue" description="Owner, schedule, and complete qualification work before it affects deployability" />
              {renewals.isLoading ? <LoadingState rows={6} /> : <div className="responsive-table" tabIndex={0} role="region" aria-label="Scrollable record table"><table className="data-table"><thead><tr><th>Personnel</th><th>Credential</th><th>Due</th><th>Owner</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{renewalPage.rows.map((task) => { const person = people.data?.find((item) => item.personnel_id === task.personnel_id); return <tr key={task.renewal_id}><td><div className="primary-cell"><span className="person-avatar person-avatar-small">{person?.name.split(' ').map((part) => part[0]).slice(0, 2).join('') || '—'}</span><span><strong>{person?.name || 'Unknown personnel'}</strong><small>{person?.role || 'Record unavailable'}</small></span></div></td><td><strong>{task.certification}</strong></td><td>{formatDate(task.due_date)}{new Date(task.due_date) < new Date() && <small className="table-warning">Overdue</small>}</td><td>{task.owner || 'Unassigned'}</td><td><StatusBadge tone={task.status === 'OPEN' ? 'danger' : 'info'}>{task.status}</StatusBadge></td><td><div className="row-actions">{task.status === 'OPEN' && <Button variant="ghost" onClick={() => setRenewalAction({ task, status: 'SCHEDULED' })} busy={updateRenewal.isPending}><CalendarCheck className="size-4" />Schedule</Button>}<Button variant="ghost" onClick={() => setRenewalAction({ task, status: 'COMPLETED' })} busy={updateRenewal.isPending}><CheckCircle2 className="size-4" />Complete</Button></div></td></tr> })}</tbody></table></div>}
              <Pagination {...renewalPage} />
              {!openRenewals.length && !renewals.isLoading && <EmptyState title="Renewal queue is clear" description="Credential risks can be converted into tracked renewal tasks from Workforce risk." icon={CheckCircle2} />}
            </section>
          </Tabs.Content>

          <Tabs.Content value="risk" className="tab-content">
            <section className="ops-panel table-panel"><div className="section-toolbar"><SectionHeader title="Qualification risk forecast" description="Expired credentials and expirations within the next 90 days" /><label className="search-control"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search person or credential" /></label></div><div className="responsive-table" tabIndex={0} role="region" aria-label="Scrollable record table"><table className="data-table"><thead><tr><th>Personnel</th><th>Credential</th><th>Expiration</th><th>Risk</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{riskPage.rows.map((risk) => <tr key={`${risk.personnelId}-${risk.certification}`}><td><strong>{risk.personnelName}</strong></td><td>{risk.certification}</td><td>{formatDate(risk.expiresOn)}</td><td><StatusBadge tone={riskTone(risk.daysLeft)}>{risk.daysLeft < 0 ? `${Math.abs(risk.daysLeft)} days expired` : `${risk.daysLeft} days left`}</StatusBadge></td><td><Button variant="ghost" onClick={() => setRenewalDialog(risk)}><Plus className="size-4" />Create task</Button></td></tr>)}</tbody></table></div><Pagination {...riskPage} />{!filteredRisks.length && <EmptyState title="No credential risk" description="No expirations are forecast within the selected window." icon={ShieldCheck} />}</section>
          </Tabs.Content>

          <Tabs.Content value="library" className="tab-content">
            <div className="master-detail-grid credential-grid"><section className="ops-panel credential-list"><SectionHeader title="Credential definitions" description="Reusable qualification types across the district" action={<Button variant="primary" onClick={() => setEditingCert('new')}><Plus className="size-4" />Add</Button>} />{certifications.data?.map((cert) => <button key={cert.certification_id} onClick={() => setSelectedCertId(cert.certification_id)} className={cn('credential-list-row', selectedCert?.certification_id === cert.certification_id && 'credential-list-row-active')}><span><Award className="size-4" /></span><div><strong>{cert.name}</strong><small>{cert.category || 'Uncategorized'} · {cert.typical_validity_days ? `${cert.typical_validity_days} days` : 'No default term'}</small></div></button>)}</section><section className="ops-panel detail-panel">{selectedCert ? <div className="credential-detail"><div className="credential-detail-heading"><span><Award className="size-6" /></span><div><p className="eyebrow">{selectedCert.category || 'Credential'}</p><h2>{selectedCert.name}</h2></div></div><p>{selectedCert.description || 'No description has been added.'}</p><dl className="detail-metrics"><div><dt>Validity</dt><dd>{selectedCert.typical_validity_days ? `${selectedCert.typical_validity_days} days` : 'Variable'}</dd></div><div><dt>Personnel</dt><dd>{selectedImpact?.personnel_count ?? 'Select to load'}</dd></div><div><dt>Required by units</dt><dd>{selectedImpact?.unit_count ?? 'Select to load'}</dd></div></dl><div className="detail-toolbar"><Button onClick={() => setEditingCert(selectedCert)}><Edit3 className="size-4" />Edit</Button><ConfirmAction title="Delete credential definition?" description={`${selectedCert.name} will be permanently removed. Definitions in use are protected.`} disabled={!selectedImpact || selectedImpact.personnel_count > 0 || selectedImpact.unit_count > 0} onConfirm={() => deleteCertification.mutateAsync(selectedCert.certification_id)}><Trash2 className="size-4" />Delete unused</ConfirmAction></div>{selectedImpact && (selectedImpact.personnel_count > 0 || selectedImpact.unit_count > 0) && <div className="impact-warning"><AlertTriangle className="size-4" /><span>This definition is protected because {selectedImpact.personnel_count} personnel and {selectedImpact.unit_count} units depend on it.</span></div>}</div> : <EmptyState title="Select a credential" description="Review use and impact before changing a definition." />}</section></div>
          </Tabs.Content>

          <Tabs.Content value="requirements" className="tab-content">
            <section className="civic-plate"><SectionHeader title="Unit qualification matrix" description="REQ marks a required qualification, not proof of a qualified crew. Select apparatus to inspect readiness." /><UnitQualificationMatrix units={(units.data || []).filter(unit => stationId === 'all' || unit.station_id === stationId)} />{!units.data?.length && <EmptyState title="No unit requirements returned" description="Refresh the unit register to review requirements." />}</section>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <FormDialog open={renewalAction !== null} onOpenChange={(open) => !open && setRenewalAction(null)} title={renewalAction?.status === 'SCHEDULED' ? 'Schedule renewal' : 'Complete renewal task'} description="Track the work explicitly. Completing a task does not certify a qualification or extend its expiration date." submitLabel="Save task" submitting={updateRenewal.isPending} error={updateRenewal.error?.message} onSubmit={(event) => {
        event.preventDefault()
        if (!renewalAction) return
        const data = new FormData(event.currentTarget)
        updateRenewal.mutate({ ...renewalAction, owner: String(data.get('owner')), scheduledFor: data.get('scheduled_for') ? new Date(String(data.get('scheduled_for'))).toISOString() : undefined })
      }}><div className="form-grid"><Field label="Accountable owner"><input className="form-control" name="owner" required defaultValue={renewalAction?.task.owner || ''} /></Field>{renewalAction?.status === 'SCHEDULED' && <Field label="Scheduled time"><input className="form-control" name="scheduled_for" type="datetime-local" required /></Field>}</div></FormDialog>
      <FormDialog open={editingCert !== null} onOpenChange={(open) => !open && setEditingCert(null)} title={editingCert === 'new' ? 'Add credential' : 'Edit credential'} description="Define the qualification term and how this credential is used across the district." submitLabel="Save credential" submitting={saveCertification.isPending} error={saveCertification.error?.message} onSubmit={submitCertification}><div className="form-grid"><Field label="Credential name"><input className="form-control" name="name" defaultValue={editingCert === 'new' ? '' : editingCert?.name} required /></Field><Field label="Category"><input className="form-control" name="category" defaultValue={editingCert === 'new' ? '' : editingCert?.category || ''} placeholder="Medical, Fire, Rescue" /></Field><Field label="Default validity (days)"><input className="form-control" type="number" min="1" name="typical_validity_days" defaultValue={editingCert === 'new' ? '365' : editingCert?.typical_validity_days || ''} /></Field><Field label="Description"><textarea className="form-control min-h-24" name="description" defaultValue={editingCert === 'new' ? '' : editingCert?.description || ''} /></Field></div></FormDialog>
      <FormDialog open={renewalDialog !== null} onOpenChange={(open) => !open && setRenewalDialog(null)} title="Create renewal task" description={renewalDialog ? `${renewalDialog.personnelName} · ${renewalDialog.certification}` : undefined} submitLabel="Create task" submitting={createRenewal.isPending} error={createRenewal.error?.message} onSubmit={submitRenewal}><div className="form-grid"><Field label="Due date"><input className="form-control" type="date" name="due_date" defaultValue={renewalDialog?.expiresOn.slice(0, 10)} required /></Field><Field label="Owner"><input className="form-control" name="owner" defaultValue="Training Coordinator" /></Field><Field label="Initial status"><select className="form-control" name="status" defaultValue="OPEN"><option>OPEN</option><option>SCHEDULED</option></select></Field><Field label="Notes"><textarea className="form-control min-h-24" name="notes" /></Field></div></FormDialog>
    </div>
  )
}
