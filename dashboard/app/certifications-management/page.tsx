'use client'

import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarCheck, CheckCircle2, Edit3, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import ConfirmAction from '@/components/ConfirmAction'
import FormDialog, { Field } from '@/components/FormDialog'
import { useStationScope } from '@/components/ScopeContext'
import { EmptyState, ErrorState, Inspector, InspectorBody, InspectorFooter, InspectorHeader, LoadingState, Notice, PageHeader, Pagination, Panel, SearchInput, StatusBadge, SummaryStrip, WriteButton, type NoticeValue, type StatusTone } from '@/components/ui'
import { usePagination } from '@/hooks/usePagination'
import { api, queryKeys } from '@/lib/api'
import type { Certification, RenewalTask } from '@/lib/schemas'
import { cn, formatDate, titleCase } from '@/lib/utils'
import styles from '../workforce.module.css'

type CredentialRisk = { personnelId: string; personnelName: string; stationId?: string | null; certification: string; expiresOn: string; daysLeft: number }
type ExpirationBand = 'all' | 'expired' | '14' | '30' | '90'

const BANDS: Array<{ id: ExpirationBand; label: string; test: (day: number) => boolean; tone: StatusTone }> = [
  { id: 'all', label: 'All exposure', test: () => true, tone: 'info' },
  { id: 'expired', label: 'Expired', test: day => day < 0, tone: 'danger' },
  { id: '14', label: '0–14 days', test: day => day >= 0 && day <= 14, tone: 'danger' },
  { id: '30', label: '15–30 days', test: day => day > 14 && day <= 30, tone: 'warning' },
  { id: '90', label: '31–90 days', test: day => day > 30 && day <= 90, tone: 'info' },
]

function riskTone(days: number) {
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
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [renewalAction, setRenewalAction] = useState<{ task: RenewalTask; status: RenewalTask['status'] } | null>(null)
  const [notice, setNotice] = useState<NoticeValue>(null)

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
  })
  const deleteCertification = useMutation({
    mutationFn: (id: string) => api.deleteCertification(id),
    onSuccess: async () => { await invalidate(); setSelectedCertId(''); setInspectorOpen(false); setNotice({ tone: 'success', message: 'Unused credential definition deleted.' }) },
  })
  const createRenewal = useMutation({
    mutationFn: api.createRenewalTask,
    onSuccess: async () => { await invalidate(); setRenewalDialog(null); setNotice({ tone: 'success', message: 'Renewal task created.' }) },
  })
  const updateRenewal = useMutation({
    mutationFn: ({ task, status, owner, scheduledFor }: { task: RenewalTask; status: RenewalTask['status']; owner: string; scheduledFor?: string }) => api.updateRenewalTask(task.renewal_id, {
      ...task, status,
      owner,
      scheduled_for: scheduledFor || task.scheduled_for,
    }),
    onSuccess: async () => { await invalidate(); setRenewalAction(null); setNotice({ tone: 'success', message: 'Renewal task updated. Credential dates change only when verified in the personnel profile.' }) },
  })

  const scopedPeople = useMemo(() => (people.data || []).filter((person) => stationId === 'all' || person.station_id === stationId), [people.data, stationId])
  const risks = useMemo(() => scopedPeople.flatMap((person) => Object.entries(person.cert_expirations).map(([certification, expiresOn]) => ({
    personnelId: person.personnel_id, personnelName: person.name, stationId: person.station_id, certification, expiresOn,
    daysLeft: Math.floor((new Date(expiresOn).getTime() - Date.now()) / 86400000),
  }))).filter((risk) => risk.daysLeft <= 90).sort((a, b) => a.daysLeft - b.daysLeft), [scopedPeople])
  const activeBand = BANDS.find((item) => item.id === band)!
  const filteredRisks = risks.filter((risk) => `${risk.personnelName} ${risk.certification}`.toLowerCase().includes(search.toLowerCase()) && activeBand.test(risk.daysLeft))
  const riskPage = usePagination(filteredRisks, `${stationId}:${search}:${band}`)
  const openRenewals = (renewals.data || []).filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && scopedPeople.some((person) => person.personnel_id === task.personnel_id))
  const renewalPage = usePagination(openRenewals, stationId)
  const selectedCert = certifications.data?.find((cert) => cert.certification_id === selectedCertId) || certifications.data?.[0]
  const selectedImpact = impact.data
  const totalCredentials = scopedPeople.reduce((sum, person) => sum + person.certifications.length, 0)
  const expired = risks.filter((risk) => risk.daysLeft < 0).length
  const dueSoon = risks.filter((risk) => risk.daysLeft >= 0 && risk.daysLeft <= 30).length
  const scopedUnits = (units.data || []).filter(unit => stationId === 'all' || unit.station_id === stationId)
  const codes = Array.from(new Set(scopedUnits.flatMap(unit => unit.required_certifications))).sort()

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
    <div className="ui-page" data-view="credentials">
      <PageHeader title="Credentials" description="Work the renewal queue in order of exposure, and maintain credential definitions and unit requirements." actions={<WriteButton variant="primary" onClick={() => { saveCertification.reset(); setEditingCert('new') }}><Plus aria-hidden="true" />Add credential</WriteButton>} />
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      {(people.isError || certifications.isError || renewals.isError) && <ErrorState message={people.error?.message || certifications.error?.message || renewals.error?.message} retry={() => { people.refetch(); certifications.refetch(); renewals.refetch() }} />}

      <SummaryStrip label="Credential summary" items={[
        { label: 'Compliance rate', value: people.data ? `${Math.round(((totalCredentials - expired) / Math.max(1, totalCredentials)) * 100)}%` : '—', detail: 'non-expired personnel credentials', tone: expired ? 'warn' : undefined },
        { label: 'In the 90-day horizon', value: people.data ? risks.length : '—', detail: `${expired} expired · ${dueSoon} due within 30 days`, tone: expired ? 'bad' : dueSoon ? 'warn' : undefined },
        { label: 'Open renewals', value: renewals.data ? openRenewals.length : '—', detail: 'tracked tasks in workflow' },
      ]} />

      <Panel title="Expiration horizon" description="Credential records by time to expiration, nearest first. Select a band to open the matching personnel in Workforce risk.">
        <div className={styles.horizon} data-ui="horizon">
          {BANDS.map(item => {
            const count = risks.filter(risk => item.test(risk.daysLeft)).length
            return (
              <button type="button" key={item.id} aria-pressed={band === item.id} style={item.id === 'all' ? undefined : { flexGrow: 1 + (risks.length ? count / risks.length * 3 : 0) }} onClick={() => { setBand(item.id); setView('risk') }}>
                <i data-tone={item.tone} aria-hidden="true" />
                <span>{item.label}</span>
                <strong className="ui-num">{count}</strong>
              </button>
            )
          })}
        </div>
      </Panel>

      <Tabs.Root value={view} onValueChange={setView}>
        <Tabs.List className="ui-tabs" aria-label="Credential views">
          <Tabs.Trigger value="renewals">Renewal queue <span>{openRenewals.length}</span></Tabs.Trigger>
          <Tabs.Trigger value="risk">Workforce risk <span>{risks.length}</span></Tabs.Trigger>
          <Tabs.Trigger value="library">Credential library <span>{certifications.data?.length || 0}</span></Tabs.Trigger>
          <Tabs.Trigger value="requirements">Unit requirements</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="renewals" className="ui-tab-content">
          <Panel title="Renewal queue" description="Assign an owner, schedule, and complete qualification work before it affects deployability" flush>
            {renewals.isLoading ? <LoadingState rows={6} /> : (
              <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Renewal queue">
                <table className="ui-table">
                  <thead><tr><th scope="col">Personnel</th><th scope="col">Credential</th><th scope="col">Due</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{renewalPage.rows.map((task) => {
                    const person = people.data?.find((item) => item.personnel_id === task.personnel_id)
                    const overdue = new Date(task.due_date) < new Date()
                    return (
                      <tr key={task.renewal_id}>
                        <th scope="row">{person ? <Link href={`/personnel?person=${encodeURIComponent(person.personnel_id)}`}>{person.name}</Link> : 'Unknown personnel'}<small>{person?.role || 'Record unavailable'}</small></th>
                        <td className="ui-mono">{task.certification}</td>
                        <td>{formatDate(task.due_date)}{overdue && <small style={{ color: 'var(--bad)' }}>Overdue</small>}</td>
                        <td>{task.owner || 'Unassigned'}</td>
                        <td><StatusBadge tone={task.status === 'OPEN' ? 'danger' : 'info'}>{titleCase(task.status)}</StatusBadge></td>
                        <td><div className="ui-row-actions">{task.status === 'OPEN' && <WriteButton variant="ghost" onClick={() => { updateRenewal.reset(); setRenewalAction({ task, status: 'SCHEDULED' }) }}><CalendarCheck aria-hidden="true" />Schedule</WriteButton>}<WriteButton variant="ghost" onClick={() => { updateRenewal.reset(); setRenewalAction({ task, status: 'COMPLETED' }) }}><CheckCircle2 aria-hidden="true" />Complete</WriteButton></div></td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </div>
            )}
            {!openRenewals.length && !renewals.isLoading && <EmptyState title="Renewal queue is clear" description="Turn a credential risk into a tracked renewal task from Workforce risk." icon={CheckCircle2} />}
            <Pagination {...renewalPage} />
          </Panel>
        </Tabs.Content>

        <Tabs.Content value="risk" className="ui-tab-content">
          <Panel title="Workforce risk" description={`${activeBand.label} · expired credentials and expirations within 90 days`} action={<SearchInput label="Search person or credential" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search person or credential" />} flush>
            <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Workforce credential risk">
              <table className="ui-table">
                <thead><tr><th scope="col">Personnel</th><th scope="col">Credential</th><th scope="col">Expiration</th><th scope="col">Risk</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                <tbody>{riskPage.rows.map((risk) => (
                  <tr key={`${risk.personnelId}-${risk.certification}`}>
                    <th scope="row"><Link href={`/personnel?person=${encodeURIComponent(risk.personnelId)}`}>{risk.personnelName}</Link></th>
                    <td className="ui-mono">{risk.certification}</td>
                    <td>{formatDate(risk.expiresOn)}</td>
                    <td><StatusBadge tone={riskTone(risk.daysLeft)}>{risk.daysLeft < 0 ? `${Math.abs(risk.daysLeft)} days expired` : `${risk.daysLeft} days left`}</StatusBadge></td>
                    <td><div className="ui-row-actions"><WriteButton variant="ghost" onClick={() => { createRenewal.reset(); setRenewalDialog(risk) }}><Plus aria-hidden="true" />Create task</WriteButton></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!filteredRisks.length && <EmptyState title="No credential risk" description="No expirations fall in the selected band and search." icon={ShieldCheck} />}
            <Pagination {...riskPage} />
          </Panel>
        </Tabs.Content>

        <Tabs.Content value="library" className="ui-tab-content">
          <div className="ui-workspace" data-inspector="true">
            <Panel title="Credential definitions" description="Reusable qualification types across the department" flush>
              {certifications.isLoading ? <LoadingState rows={6} /> : (
                <ul className="ui-list">
                  {certifications.data?.map((cert) => <li key={cert.certification_id}><button type="button" className="ui-list-row" data-ui="credential-row" aria-pressed={selectedCert?.certification_id === cert.certification_id} onClick={() => { setSelectedCertId(cert.certification_id); setInspectorOpen(true); deleteCertification.reset() }}><span className="ui-list-main"><strong>{cert.name}</strong><small>{cert.category || 'Uncategorized'} · {cert.typical_validity_days ? `${cert.typical_validity_days} days` : 'no default term'}</small></span></button></li>)}
                </ul>
              )}
            </Panel>
            <Inspector label="Credential definition" open={inspectorOpen && Boolean(selectedCert)} onClose={() => setInspectorOpen(false)} recordKey={selectedCert?.certification_id}>
              {selectedCert ? <>
                <InspectorHeader kind={selectedCert.category || 'Credential'} title={selectedCert.name} headingId="credential-heading" />
                <InspectorBody>
                  <p style={{ color: 'var(--ink-2)', fontSize: '0.9375rem' }}>{selectedCert.description || 'No description has been added.'}</p>
                  <dl className="ui-facts">
                    <div><dt>Validity</dt><dd>{selectedCert.typical_validity_days ? `${selectedCert.typical_validity_days} days` : 'Variable'}</dd></div>
                    <div><dt>Personnel</dt><dd className="ui-num">{selectedImpact?.personnel_count ?? (impact.isError ? 'Unavailable' : 'Loading')}</dd></div>
                    <div><dt>Required by units</dt><dd className="ui-num">{selectedImpact?.unit_count ?? (impact.isError ? 'Unavailable' : 'Loading')}</dd></div>
                  </dl>
                  {selectedImpact && (selectedImpact.personnel_count > 0 || selectedImpact.unit_count > 0) && <div className="ui-notice" data-tone="info"><AlertTriangle aria-hidden="true" /><span>This definition is protected because {selectedImpact.personnel_count} personnel and {selectedImpact.unit_count} units depend on it.</span></div>}
                </InspectorBody>
                <InspectorFooter>
                  <div className="ui-inspector-actions">
                    <WriteButton onClick={() => { saveCertification.reset(); setEditingCert(selectedCert) }}><Edit3 aria-hidden="true" />Edit</WriteButton>
                    <ConfirmAction title="Delete credential definition?" description={`${selectedCert.name} will be permanently removed. Definitions in use are protected.`} disabled={!selectedImpact || selectedImpact.personnel_count > 0 || selectedImpact.unit_count > 0} onConfirm={() => deleteCertification.mutateAsync(selectedCert.certification_id)}><Trash2 aria-hidden="true" />Delete unused</ConfirmAction>
                  </div>
                </InspectorFooter>
              </> : <EmptyState title="Select a credential" description="Review use and impact before changing a definition." />}
            </Inspector>
          </div>
        </Tabs.Content>

        <Tabs.Content value="requirements" className="ui-tab-content">
          <Panel title="Unit requirements" description="Required marks a qualification a unit needs. It is not proof that the current crew holds it." flush>
            <div className={cn('ui-table-wrap', styles.matrix)} tabIndex={0} role="region" aria-label="Unit qualification matrix">
              <table className="ui-table" data-ui="qualification-matrix">
                <thead><tr><th scope="col">Apparatus</th><th scope="col" className="ui-num">Min crew</th>{codes.map(code => <th scope="col" key={code} className="ui-mono">{code}</th>)}</tr></thead>
                <tbody>{scopedUnits.map(unit => (
                  <tr key={unit.unit_id}>
                    <th scope="row"><Link href={`/readiness?view=units&unit=${encodeURIComponent(unit.unit_id)}`}>{unit.unit_name}</Link><small>{titleCase(unit.type)}</small></th>
                    <td className="ui-num">{unit.minimum_staff}</td>
                    {codes.map(code => <td key={code}>{unit.required_certifications.includes(code) ? <span className={styles.required}>Required</span> : <span className="ui-muted" aria-label="Not required">—</span>}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!units.isLoading && !scopedUnits.length && <EmptyState title="No unit requirements returned" description="Refresh the unit register to review requirements." />}
          </Panel>
        </Tabs.Content>
      </Tabs.Root>

      <FormDialog open={renewalAction !== null} onOpenChange={(open) => !open && setRenewalAction(null)} title={renewalAction?.status === 'SCHEDULED' ? 'Schedule renewal' : 'Complete renewal task'} description="Track the work explicitly. Completing a task does not certify a qualification or extend its expiration date." submitLabel="Save task" submitting={updateRenewal.isPending} error={updateRenewal.error?.message} onSubmit={(event) => {
        event.preventDefault()
        if (!renewalAction) return
        const data = new FormData(event.currentTarget)
        updateRenewal.mutate({ ...renewalAction, owner: String(data.get('owner')), scheduledFor: data.get('scheduled_for') ? new Date(String(data.get('scheduled_for'))).toISOString() : undefined })
      }}>
        <div className="ui-form-grid">
          <Field label="Accountable owner"><input className="ui-input" name="owner" required defaultValue={renewalAction?.task.owner || ''} /></Field>
          {renewalAction?.status === 'SCHEDULED' && <Field label="Scheduled time"><input className="ui-input" name="scheduled_for" type="datetime-local" required /></Field>}
        </div>
      </FormDialog>
      <FormDialog open={editingCert !== null} onOpenChange={(open) => !open && setEditingCert(null)} title={editingCert === 'new' ? 'Add credential' : 'Edit credential'} description="Define the qualification term and how this credential is used across the department." submitLabel="Save credential" submitting={saveCertification.isPending} error={saveCertification.error?.message} onSubmit={submitCertification}>
        <div className="ui-form-grid">
          <Field label="Credential name"><input className="ui-input" name="name" defaultValue={editingCert === 'new' ? '' : editingCert?.name} required /></Field>
          <Field label="Category"><input className="ui-input" name="category" defaultValue={editingCert === 'new' ? '' : editingCert?.category || ''} placeholder="Medical, Fire, Rescue" /></Field>
          <Field label="Default validity (days)"><input className="ui-input" type="number" min="1" name="typical_validity_days" defaultValue={editingCert === 'new' ? '365' : editingCert?.typical_validity_days || ''} /></Field>
        </div>
        <Field label="Description"><textarea className="ui-input" name="description" defaultValue={editingCert === 'new' ? '' : editingCert?.description || ''} /></Field>
      </FormDialog>
      <FormDialog open={renewalDialog !== null} onOpenChange={(open) => !open && setRenewalDialog(null)} title="Create renewal task" description={renewalDialog ? `${renewalDialog.personnelName} · ${renewalDialog.certification}` : undefined} submitLabel="Create task" submitting={createRenewal.isPending} error={createRenewal.error?.message} onSubmit={submitRenewal}>
        <div className="ui-form-grid">
          <Field label="Due date"><input className="ui-input" type="date" name="due_date" defaultValue={renewalDialog?.expiresOn.slice(0, 10)} required /></Field>
          <Field label="Owner"><input className="ui-input" name="owner" defaultValue="Training Coordinator" /></Field>
          <Field label="Initial status"><select className="ui-select" name="status" defaultValue="OPEN"><option>OPEN</option><option>SCHEDULED</option></select></Field>
        </div>
        <Field label="Notes"><textarea className="ui-input" name="notes" /></Field>
      </FormDialog>
    </div>
  )
}
