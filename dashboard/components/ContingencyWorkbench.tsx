'use client'

import { useState } from 'react'
import type { SimulationResult, Unit, UnitReadiness } from '@/lib/schemas'
import { Button, EmptyState, InlineError, Meter, PageHeader, Panel, StatusBadge, TextLink, WriteButton } from './ui'
import { formatDate } from '@/lib/utils'
import styles from './plans.module.css'

export default function ContingencyWorkbench({ units, definitions, selected, result, busy, error, onSelect, onRun, onReset }: {
  units: UnitReadiness[]; definitions: Unit[]; selected?: UnitReadiness; result?: SimulationResult; busy: boolean; error?: string
  onSelect: (id: string) => void; onRun: (unitId: string, personnelId?: string) => void; onReset: () => void
}) {
  const [scenario, setScenario] = useState('offline')
  const [personId, setPersonId] = useState('')
  const definition = definitions.find(unit => unit.unit_id === selected?.unit_id)
  const person = selected?.assigned_personnel.find(item => item.personnel_id === personId) || selected?.assigned_personnel[0]
  const after = result?.degraded_readiness.find(unit => unit.unit_id === selected?.unit_id)
  const before = result?.original_readiness.find(unit => unit.unit_id === selected?.unit_id)?.readiness_score ?? selected?.readiness_score
  const readings = [{ label: 'Recorded baseline', value: before }, { label: 'Hypothetical result', value: after?.readiness_score }]

  return (
    <div className="ui-page" data-view="simulation">
      <PageHeader title="Plans & Hazards" description="Test an apparatus outage or crew callout against recorded readiness. This workbench makes no live changes and does not predict travel time or response coverage." />
      <div className={styles.flow} data-ui="contingency">
        <Panel title="Scenario inputs" description="Choose the asset and the disruption">
          <div className={styles.inputs}>
            <label className="ui-field"><span>Apparatus</span><select className="ui-select" disabled={busy} aria-label="Scenario apparatus" value={selected?.unit_id || ''} onChange={event => { onSelect(event.target.value); setPersonId('') }}>{units.map(unit => <option key={unit.unit_id} value={unit.unit_id}>{unit.unit_name} · {unit.readiness_score}%</option>)}</select></label>
            <label className="ui-field"><span>Disruption</span><select className="ui-select" disabled={busy} aria-label="Scenario disruption" value={scenario} onChange={event => { setScenario(event.target.value); onReset() }}><option value="offline">Apparatus out of service</option><option value="callout">One crew member unavailable</option></select></label>
            {scenario === 'callout' && <label className="ui-field"><span>Crew member</span><select className="ui-select" disabled={busy} aria-label="Scenario crew member" value={person?.personnel_id || ''} onChange={event => { setPersonId(event.target.value); onReset() }}><option value="" disabled>Select recorded crew</option>{selected?.assigned_personnel.map(item => <option key={item.personnel_id} value={item.personnel_id}>{item.name}</option>)}</select></label>}
          </div>
          {selected ? <>
            <dl className="ui-facts ui-facts-rows" style={{ marginTop: 16 }}>
              <div><dt>Staffing</dt><dd className="ui-num">{selected.staff_present} / {selected.staff_required}</dd></div>
              <div><dt>Required qualifications</dt><dd>{definition?.required_certifications.join(' / ') || 'No specific qualifications recorded'}</dd></div>
              <div><dt>Baseline issues</dt><dd>{selected.issues.join('; ') || 'No issues returned'}</dd></div>
              <div><dt>Recorded snapshot</dt><dd className="ui-mono">{formatDate(selected.timestamp, 'MMM d · HH:mm')}</dd></div>
            </dl>
            <h3 className={styles.subhead}>Recorded crew</h3>
            <ul className={styles.crew} data-ui="scenario-crew">
              {selected.assigned_personnel.map(item => {
                const chosen = scenario === 'callout' && item.personnel_id === person?.personnel_id
                return <li key={item.personnel_id}><button type="button" disabled={busy} className="ui-list-row" aria-pressed={chosen} onClick={() => { setScenario('callout'); setPersonId(item.personnel_id); onReset() }}><span className="ui-list-main"><strong>{item.name}</strong><small>{item.role} · {item.certifications.join(' / ')}</small></span><StatusBadge tone={chosen ? 'warning' : 'neutral'}>{chosen ? 'Scenario callout' : 'Recorded crew'}</StatusBadge></button></li>
              })}
            </ul>
            {!selected.assigned_personnel.length && <p className="ui-empty-inline">No assigned crew. Use the apparatus outage scenario.</p>}
          </> : <EmptyState title="No apparatus in scope" description="Choose another station scope to run a scenario." />}
          <div className={styles.actions}>
            <WriteButton variant="primary" busy={busy} disabled={!selected || (scenario === 'callout' && !person)} onClick={() => selected && onRun(selected.unit_id, scenario === 'callout' ? person?.personnel_id : undefined)}>Calculate scenario</WriteButton>
            <Button disabled={busy} onClick={() => { onReset(); setScenario('offline'); setPersonId('') }}>Reset scenario</Button>
          </div>
          <InlineError message={error} />
        </Panel>

        <Panel title="Baseline and result" description={result ? `Hypothetical result · ${formatDate(result.timestamp, 'HH:mm')}` : 'Live operational records remain unchanged'}>
          {selected ? (
            <div className={styles.comparison} data-ui="comparison">
              {readings.map(reading => (
                <div key={reading.label}>
                  <span>{reading.label}</span>
                  <strong>{reading.value === undefined ? '—' : `${Math.round(reading.value)}%`}</strong>
                  <Meter value={reading.value ?? 0} tone={reading.value === undefined ? 'neutral' : reading.value >= 85 ? 'success' : reading.value >= 60 ? 'warning' : 'danger'} />
                </div>
              ))}
              <p>{after === undefined || before === undefined ? 'Run a scenario to calculate the projected result.' : `${Math.round(after.readiness_score - before)} percentage-point change · live records unchanged`}</p>
            </div>
          ) : <p className="ui-empty-inline">Select recorded apparatus to see its baseline.</p>}
          {result && (
            <dl className="ui-facts ui-facts-rows" style={{ marginTop: 16 }}>
              <div><dt>Impacted units</dt><dd>{result.impacted_units.map(id => units.find(unit => unit.unit_id === id)?.unit_name || id).join(', ') || 'None returned'}</dd></div>
              <div><dt>Projected issues</dt><dd>{after?.issues.join('; ') || 'No issues returned'}</dd></div>
            </dl>
          )}
        </Panel>

        <Panel title="Recovery actions" description="Returned by the scenario calculation">
          {result ? <>
            <ol className={styles.recovery} data-ui="recovery">{result.recovery_actions.map(action => <li key={action}>{action}</li>)}</ol>
            {!result.recovery_actions.length && <p className="ui-empty-inline">No recovery actions were returned for this scenario.</p>}
          </> : <EmptyState title="Awaiting calculation" description="Select a disruption and calculate to inspect its projected consequences and recovery actions." />}
          {selected && <div className="ui-link-row" style={{ marginTop: 16 }}><TextLink href={`/readiness?view=units&unit=${encodeURIComponent(selected.unit_id)}`}>Inspect live apparatus</TextLink><TextLink href="/weather">Public hazard register</TextLink></div>}
        </Panel>
      </div>
      <p className="ui-provenance">Hypothetical planning only. Staffing and qualification dependencies come from synthetic operational records; no emergency plan is issued.</p>
    </div>
  )
}
