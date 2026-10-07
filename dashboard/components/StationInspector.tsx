'use client'

import { Truck, Users } from 'lucide-react'
import Link from 'next/link'
import { CONDITION_LABEL, stationNumber, type StationRow } from './CountyMap'
import { useStationScope } from './ScopeContext'
import { EmptyState, Inspector, InspectorBody, InspectorFooter, InspectorHeader, Meter, Section, StatusBadge, type StatusTone } from './ui'

const CONDITION_TONE: Record<StationRow['condition'], StatusTone> = { normal: 'success', attention: 'warning', offline: 'danger' }
export const readinessTone = (score: number): StatusTone => score >= 85 ? 'success' : score >= 60 ? 'warning' : 'danger'

export default function StationInspector({ station, open, onClose, dismissible = false }: { station?: StationRow; open: boolean; onClose: () => void; dismissible?: boolean }) {
  const { setStationId } = useStationScope()
  const present = station?.assigned.reduce((sum, unit) => sum + unit.staff_present, 0) ?? 0
  const required = station?.assigned.reduce((sum, unit) => sum + unit.staff_required, 0) ?? 0
  return (
    <Inspector label="Station details" open={open && Boolean(station)} onClose={onClose} recordKey={station?.station_id} dismissible={dismissible} closeLabel="Close station details">
      {station ? <>
        <InspectorHeader kind={`Station ${stationNumber(station)} · ${station.district?.split(' · ')[0] || 'No battalion recorded'}`} title={station.name.split(' — ')[1] || station.name} subtitle={station.address || 'Address not recorded'} badge={<StatusBadge tone={CONDITION_TONE[station.condition]}>{CONDITION_LABEL[station.condition]}</StatusBadge>} />
        <InspectorBody>
          <dl className="ui-facts">
            <div><dt>Readiness</dt><dd>{station.score === null ? 'No active resources' : `${Math.round(station.score)}%`}</dd></div>
            <div><dt>Staffing</dt><dd className="ui-num">{present} / {required} present</dd></div>
            <div><dt>Units</dt><dd className="ui-num">{station.assigned.length}</dd></div>
          </dl>
          <Section title="Units at this station" meta={`${station.assigned.filter((unit) => unit.readiness_score < 85).length} need attention`}>
            <ul className="ui-list" style={{ border: '1px solid var(--rule)', borderRadius: 'var(--radius-control)' }}>
              {station.assigned.map((unit) => (
                <li key={unit.unit_id}>
                  <Link className="ui-list-row" href={`/readiness?view=units&unit=${encodeURIComponent(unit.unit_id)}`} style={{ minHeight: 48 }}>
                    <span className="ui-list-main"><strong>{unit.unit_name}</strong><small>{unit.staff_present}/{unit.staff_required} staffed{unit.issues.length ? ` · ${unit.issues.length} ${unit.issues.length === 1 ? 'issue' : 'issues'}` : ''}</small></span>
                    <span style={{ width: 64 }}><Meter value={unit.readiness_score} tone={readinessTone(unit.readiness_score)} /></span>
                    <span className="ui-num" style={{ width: 40, textAlign: 'right', fontSize: '0.875rem' }}>{unit.readiness_score}%</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!station.assigned.length && <p className="ui-empty-inline">No units are recorded at this station in the current snapshot.</p>}
          </Section>
        </InspectorBody>
        <InspectorFooter>
          <div className="ui-inspector-actions">
            <Link className="ui-button ui-button-primary" href="/readiness?view=units" onClick={() => setStationId(station.station_id)}><Truck aria-hidden="true" />Open station units</Link>
            <Link className="ui-button" href="/personnel" onClick={() => setStationId(station.station_id)}><Users aria-hidden="true" />Open station personnel</Link>
          </div>
          <p className="ui-provenance">Opening a station record sets the station scope for every workspace.</p>
        </InspectorFooter>
      </> : <EmptyState title="Select a station" description="Choose a station on the map or in the directory to review its units, staffing, and readiness." />}
    </Inspector>
  )
}
