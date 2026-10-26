'use client'

import { Crosshair, Expand, Minus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import mapData from '@/public/maps/fairfax-command-map.json'
import type { Incident, Station, UnitReadiness } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import styles from './map.module.css'

import { CONDITION_LABEL, INCIDENT_TYPE_LABEL as TYPE_LABEL, stationNumber, stationRows, type MapLayer } from '@/lib/map/stations'

export { CONDITION_LABEL, stationNumber, stationRows }
export type { MapLayer, StationCondition, StationRow } from '@/lib/map/stations'

const EARTH_RADIUS = 6378137

/** Web Mercator through the asset's single-scale transform, matching the committed geometry exactly. */
export function project(lon: number, lat: number): [number, number] {
  const { scale, translateX, translateY } = mapData.projection.transform
  const x = EARTH_RADIUS * lon * Math.PI / 180
  const y = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))
  return [translateX + x * scale, translateY - y * scale]
}

const place = (lon: number, lat: number) => { const [x, y] = project(lon, lat); return { x: Math.round(x), y: Math.round(y) } }
const DULLES = place(-77.4558, 38.9531)
const FALLS_CHURCH = place(-77.1711, 38.8823)

type Props = {
  title: string
  stations: Station[]
  units: UnitReadiness[]
  incidents: Incident[]
  scope: string
  mode?: 'readiness' | 'incidents'
  layers: Record<MapLayer, boolean>
  onToggleLayer: (layer: MapLayer) => void
  selectedStationId?: string | null
  onStationSelect?: (id: string) => void
  selectedIncidentId?: string
  onIncidentSelect?: (id: string) => void
  onReset?: () => void
  headingLevel?: 2 | 3
  className?: string
}

export default function CountyMap({ title, stations, units, incidents, scope, mode = 'readiness', layers, onToggleLayer, selectedStationId, onStationSelect, selectedIncidentId, onIncidentSelect, onReset, className }: Props) {
  const stageRef = useRef<HTMLElement>(null)
  const [zoom, setZoom] = useState(1)
  const rows = stationRows(stations, units)
  const stationByUnit = new Map(stations.flatMap((station) => station.unit_ids.map((id) => [id, station] as const)))
  const stationPoints = stations.filter((station) => station.latitude && station.longitude).map((station) => project(station.longitude!, station.latitude!))
  const order: MapLayer[] = mode === 'readiness' ? ['stations', 'incidents', 'risk'] : ['incidents', 'stations', 'risk']
  const layerName: Partial<Record<MapLayer, string>> = { stations: 'Stations', incidents: 'Incidents', risk: 'Risk layers' }
  const activate = (action: () => void) => (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action() } }

  return (
    <section ref={stageRef} className={cn('ui-stage', styles.map, className)} aria-label={title} data-map={mode}>
      <header className="ui-stage-header">
        <div><h2>{title}</h2><p>{scope !== 'all' ? 'Filtered to the selected station scope' : layers.risk ? 'Risk layer marks stations with staffing or readiness attention' : 'Station readiness and active incidents'}</p></div>
        <div className={styles.layers} role="group" aria-label="Map layers">
          {order.map((layer) => <button key={layer} type="button" className="ui-stage-button" aria-pressed={layers[layer]} onClick={() => onToggleLayer(layer)}>{layerName[layer]}</button>)}
        </div>
      </header>
      <div className={styles.canvas}>
        <svg className={styles.svg} viewBox="0 0 920 600" preserveAspectRatio="xMidYMid slice" role="group" aria-label="Interactive Fairfax County map using locally committed public GIS geometry">
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path className={styles.gridLine} d="M40 0H0V40" /></pattern>
            <clipPath id="county-clip"><path d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} /></clipPath>
            <filter id="county-relief" x="-5%" y="-5%" width="110%" height="110%">
              <feMorphology in="SourceAlpha" operator="erode" radius="2" result="inner" />
              <feGaussianBlur in="inner" stdDeviation="9" result="soft" />
              <feComposite in="SourceAlpha" in2="soft" operator="out" result="rim" />
              <feFlood className={styles.reliefShade} result="shade" />
              <feComposite in="shade" in2="rim" operator="in" />
            </filter>
          </defs>
          {/* Oversized so the stage stays continuous when the canvas is taller than the geometry. */}
          <rect className={styles.backdrop} x="-600" y="-600" width="2120" height="1800" />
          <rect x="-600" y="-600" width="2120" height="1800" fill="url(#map-grid)" opacity=".55" />
          <g className={styles.context}>
            <text x="92" y="150">Loudoun County</text>
            <text x="716" y="270">Arlington County</text>
            <text x="716" y="226">Washington DC</text><text x="716" y="350">Alexandria</text>
            <text x="170" y="522">Prince William County</text>
            <text x={FALLS_CHURCH.x + 9} y={FALLS_CHURCH.y + 3}>Falls Church</text><text x={DULLES.x - 12} y={DULLES.y + 3} textAnchor="end">Dulles Intl</text>
          </g>
          <g transform={`translate(${460 * (1 - zoom)} ${300 * (1 - zoom)}) scale(${zoom})`} className={styles.zoom}>
            <g className={styles.outside}>
              <path className={styles.arterial} d={mapData.layers.streets.arterial} />
              <path className={styles.major} d={mapData.layers.majorRoads.path} />
              <path className={styles.freeway} d={mapData.layers.streets.freeway} />
              <path className={styles.stream} d={mapData.layers.streams.path} />
              <path className={styles.water} d={mapData.layers.waterBodies.path} fillRule={mapData.layers.waterBodies.fillRule as 'evenodd'} />
            </g>
            <path className={styles.land} d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} />
            <g clipPath="url(#county-clip)" className={styles.inside}>
              <path className={styles.local} d={mapData.layers.streets.local} />
              <path className={styles.collector} d={mapData.layers.streets.collector} />
              <path className={styles.arterial} d={mapData.layers.streets.arterial} />
              <path className={styles.major} d={mapData.layers.majorRoads.path} />
              <path className={styles.stream} d={mapData.layers.streams.path} />
              <path className={styles.water} d={mapData.layers.waterBodies.path} fillRule={mapData.layers.waterBodies.fillRule as 'evenodd'} />
              <path className={styles.freewayCasing} d={mapData.layers.streets.freeway} />
              <path className={styles.freeway} d={mapData.layers.streets.freeway} />
              {layers.risk && <g className={styles.risk}>{rows.filter((station) => station.condition === 'attention' && station.latitude && station.longitude).map((station) => { const [x, y] = project(station.longitude!, station.latitude!); return <circle key={`risk-${station.station_id}`} cx={x} cy={y} r="34" /> })}</g>}
            </g>
            <path d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} filter="url(#county-relief)" aria-hidden="true" />
            <path className={styles.boundary} d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} />
            <g className={styles.shields} aria-hidden="true">{mapData.layers.routeLabels.filter((route) => ['66', '495', '395', '95', '28'].includes(route.route)).map((route) => { const y = route.y - (stationPoints.some(([sx, sy]) => Math.hypot(sx - route.x, sy - route.y) < 22) ? 24 : 0); return <g key={`${route.route}-${route.x}-${route.y}`} transform={`translate(${route.x} ${y})`}><rect x="-12" y="-8" width="24" height="16" rx="4" /><text y="4" textAnchor="middle">{route.route}</text></g> })}</g>
            {layers.incidents && layers.stations && <g className={styles.links} aria-hidden="true">{incidents.filter((incident) => incident.is_active && incident.latitude && incident.longitude).flatMap((incident) => {
              const [ix, iy] = project(incident.longitude!, incident.latitude!)
              const homes = new Set(incident.assigned_unit_ids.map((id) => stationByUnit.get(id)).filter((station): station is Station => Boolean(station?.latitude && station.longitude)))
              return Array.from(homes).map((station) => { const [sx, sy] = project(station.longitude!, station.latitude!); return <line key={`${incident.incident_id}-${station.station_id}`} data-type={incident.incident_type.toLowerCase()} x1={sx} y1={sy} x2={ix} y2={iy} /> })
            })}</g>}
            <text className={styles.countyLabel} x="470" y="326" textAnchor="middle">Fairfax County</text>
            {layers.incidents && incidents.filter((incident) => incident.latitude && incident.longitude).map((incident) => {
              const [x, y] = project(incident.longitude!, incident.latitude!)
              const interactive = Boolean(onIncidentSelect)
              const selected = selectedIncidentId === incident.incident_id
              const select = () => onIncidentSelect?.(incident.incident_id)
              return <g key={incident.incident_id} className={cn(styles.incident, !incident.is_active && styles.incidentClosed)} data-map-incident={incident.incident_id} data-type={incident.incident_type.toLowerCase()} data-selected={selected || undefined} transform={`translate(${x} ${y})`} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-pressed={interactive ? selected : undefined} aria-label={interactive ? `Select ${incident.incident_type} incident at ${incident.display_location || incident.title}` : undefined} onClick={interactive ? select : undefined} onKeyDown={interactive ? activate(select) : undefined}>
                <title>{TYPE_LABEL[incident.incident_type]}: {incident.display_location || incident.title}{incident.is_active ? '' : ' (closed)'}</title>
                {selected && <circle className={styles.selection} r="19" />}
                {incident.is_active && <><circle className={styles.pulse} r="9" /><circle className={styles.pulse} r="9" style={{ animationDelay: '1.4s' }} /></>}
                <rect className={styles.incidentMark} x="-7.5" y="-7.5" width="15" height="15" rx="3" transform="rotate(45)" />
                <rect className={styles.incidentBang} x="-1.1" y="-5" width="2.2" height="6" rx=".7" /><circle className={styles.incidentBang} cy="3.8" r="1.25" />
              </g>
            })}
            {layers.stations && rows.filter((station) => station.latitude && station.longitude).map((station) => {
              const [x, y] = project(station.longitude!, station.latitude!)
              const dimmed = scope !== 'all' && scope !== station.station_id
              const selected = selectedStationId === station.station_id
              const select = () => onStationSelect?.(station.station_id)
              return <g key={station.station_id} transform={`translate(${x} ${y})`} className={styles.station} data-map-station={station.station_id} data-condition={station.condition} data-selected={selected || undefined} opacity={dimmed ? .28 : 1} role="button" tabIndex={dimmed ? -1 : 0} aria-pressed={selected} aria-label={`${station.name}, ${CONDITION_LABEL[station.condition].toLowerCase()}`} onClick={select} onKeyDown={activate(select)}>
                <title>{station.name} · {station.assigned.length} units · {station.score === null ? 'no active resources' : `${Math.round(station.score)}% readiness`}</title>
                {selected && <circle className={styles.selection} r="15" />}
                <circle className={styles.stationDisc} r="6.5" />
                <text x="10" y="4">{stationNumber(station)}</text>
              </g>
            })}
          </g>
        </svg>
        <div className={styles.tools}>
          <button type="button" className="ui-stage-button" aria-label="Zoom in" onClick={() => setZoom(Math.min(zoom + .18, 1.7))} disabled={zoom >= 1.7}><Plus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Zoom out" onClick={() => setZoom(Math.max(zoom - .18, .78))} disabled={zoom <= .78}><Minus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Reset map view" onClick={() => { setZoom(1); onReset?.() }}><Crosshair aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Focus map full screen" onClick={() => void stageRef.current?.requestFullscreen?.()}><Expand aria-hidden="true" /></button>
        </div>
      </div>
      <ul className={styles.legend} aria-label="Map legend">
        {mode === 'incidents'
          ? (['fire', 'ems', 'hazmat', 'other'] as const).map((type) => <li key={type}><i data-kind="incident" data-type={type} />{TYPE_LABEL[type.toUpperCase() as Incident['incident_type']]}</li>)
          : <><li><i data-kind="station" data-condition="normal" />Station normal</li><li><i data-kind="station" data-condition="attention" />Staffing attention</li><li><i data-kind="station" data-condition="offline" />No active resources</li><li><i data-kind="incident" data-type="fire" />Active incident</li></>}
        <li><i data-kind="boundary" />County boundary</li>
        <li><i data-kind="highway" />Major highway</li>
        <li className={styles.source}>County GIS geometry · not for navigation</li>
      </ul>
    </section>
  )
}
