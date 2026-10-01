'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Expand, Minus, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import mapData from '@/public/maps/fairfax-command-map.json'
import { useStationScope } from './ScopeContext'
import type { Incident, Station, UnitReadiness } from '@/lib/schemas'

type Props = { stations: Station[]; units: UnitReadiness[]; incidents: Incident[]; scope: string; mode?: 'readiness' | 'incidents'; selectedIncidentId?: string; onIncidentSelect?: (id: string) => void }
type LayerName = 'stations' | 'incidents' | 'risk'

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

export default function CommandMap({ stations, units, incidents, scope, mode = 'readiness', selectedIncidentId, onIncidentSelect }: Props) {
  const { setStationId } = useStationScope()
  const params = useSearchParams()
  const stationRegister = params.get('layer') === 'stations'
  const boardRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [layers, setLayers] = useState<Record<LayerName, boolean>>({ stations: mode === 'readiness', incidents: true, risk: false })
  useEffect(() => {
    setLayers({ stations: mode === 'readiness', incidents: mode === 'incidents' || !stationRegister, risk: false })
  }, [stationRegister, mode])
  const readiness = new Map(units.map((unit) => [unit.unit_id, unit]))
  const stationRows = stations.map((station) => {
    const assigned = station.unit_ids.map((id) => readiness.get(id)).filter((unit): unit is UnitReadiness => Boolean(unit))
    const score = assigned.length ? assigned.reduce((sum, unit) => sum + unit.readiness_score, 0) / assigned.length : null
    const alert = assigned.some((unit) => unit.is_understaffed || unit.readiness_score < 85)
    return { ...station, assigned, score, alert }
  })
  const detail = stationRows.find((station) => station.station_id === selected)
  const stationPoints = stations.filter((station) => station.latitude && station.longitude).map((station) => project(station.longitude!, station.latitude!))
  const toggleLayer = (layer: LayerName) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))

  return <section ref={boardRef} className={`command-map ${mode === 'incidents' ? 'incident-command-map' : ''}`} aria-label={mode === 'incidents' ? 'County incident plot' : 'Fairfax County readiness board'}>
    <div className="map-topline"><h1 aria-label={mode === 'incidents' ? 'County incident plot' : 'Fairfax County readiness board'}><span className="map-title-full">{mode === 'incidents' ? 'COUNTY INCIDENT PLOT' : <>FAIRFAX COUNTY <span className="map-title-accent">READINESS BOARD</span></>}</span><span className="map-title-short">{mode === 'incidents' ? 'INCIDENT PLOT' : 'FAIRFAX READINESS'}</span></h1><div className="map-layer-tabs" aria-label="Map layers">{mode === 'readiness' ? <><button aria-pressed={layers.stations} onClick={() => toggleLayer('stations')}>STATIONS</button><i /><button aria-pressed={layers.incidents} onClick={() => toggleLayer('incidents')}>INCIDENTS</button></> : <><button aria-pressed={layers.incidents} onClick={() => toggleLayer('incidents')}>INCIDENTS</button><i /><button aria-pressed={layers.stations} onClick={() => toggleLayer('stations')}>STATIONS</button></>}<i /><button aria-pressed={layers.risk} onClick={() => toggleLayer('risk')}>RISK LAYERS</button><i /><span>{scope !== 'all' ? 'FILTERED' : layers.risk ? 'RISK ON' : 'NONE'}</span></div></div>
    <svg className="tactical-map" viewBox="0 0 920 600" role="group" aria-label="Interactive Fairfax County map using locally committed public GIS geometry">
      <defs>
        <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#335064" strokeWidth=".35" /></pattern>
        <pattern id="map-fine-grid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0H0V6" fill="none" stroke="#284353" strokeWidth=".15" /></pattern>
        <clipPath id="county-clip"><path d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} /></clipPath>
        <filter id="marker-shadow"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <rect width="920" height="600" fill="#0b1d28" />
      <rect width="920" height="600" fill="url(#map-fine-grid)" opacity=".4" />
      <rect width="920" height="600" fill="url(#map-grid)" opacity=".5" />
      <g className="map-regional-context">
        <text x="92" y="142">LOUDOUN</text><text x="92" y="158">COUNTY</text>
        <text x="716" y="262">ARLINGTON</text><text x="716" y="278">COUNTY</text>
        <text x="716" y="226">WASHINGTON DC</text><text x="716" y="350">ALEXANDRIA</text>
        <text x="170" y="514">PRINCE WILLIAM</text><text x="170" y="530">COUNTY</text>
        <text x="440" y="14" className="map-state-label">MARYLAND</text>
        <text x={FALLS_CHURCH.x + 9} y={FALLS_CHURCH.y + 3}>FALLS CHURCH</text><text x={DULLES.x - 26} y={DULLES.y - 6} textAnchor="end">DULLES</text><text x={DULLES.x - 26} y={DULLES.y + 8} textAnchor="end">INTL</text>
        <path className="map-airfield-mark" transform={`translate(${DULLES.x - 74} ${DULLES.y - 196})`} d="M65 181l2 9 8 3v2l-8-1-2 5-2-5-8 1v-2l8-3 2-9Z" />
      </g>
      <g transform={`translate(${460 * (1 - zoom)} ${300 * (1 - zoom)}) scale(${zoom})`} className="map-zoom-layer">
        <g className="map-surrounding-network">
          <path d={mapData.layers.streets.local} fill="none" stroke="#3a5260" strokeWidth=".35" opacity=".2" />
          <path d={mapData.layers.streets.arterial} fill="none" stroke="#526e7a" strokeWidth=".7" opacity=".42" />
          <path d={mapData.layers.majorRoads.path} fill="none" stroke="#718896" strokeWidth="1.1" opacity=".6" />
          <path d={mapData.layers.streets.freeway} fill="none" stroke="#8aa1ad" strokeWidth="2" opacity=".72" />
          <path d={mapData.layers.streams.path} fill="none" stroke="#2a6d8c" strokeWidth="1.3" opacity=".85" />
          <path d={mapData.layers.waterBodies.path} fill="#1a4d6a" fillRule={mapData.layers.waterBodies.fillRule as 'evenodd'} />
        </g>
        <path d={mapData.layers.county.path} fill="#203235" fillRule={mapData.layers.county.fillRule as 'evenodd'} />
        <g clipPath="url(#county-clip)">
          <rect x="20" y="10" width="880" height="580" fill="url(#map-grid)" opacity=".3" />
          <path d={mapData.layers.streets.local} fill="none" stroke="#6b7c83" strokeWidth=".32" opacity=".34" />
          <path d={mapData.layers.streets.collector} fill="none" stroke="#7a8a90" strokeWidth=".55" opacity=".55" />
          <path d={mapData.layers.streets.arterial} fill="none" stroke="#8798a0" strokeWidth=".75" opacity=".62" />
          <path d={mapData.layers.majorRoads.path} fill="none" stroke="#9aaab0" strokeWidth="1.2" opacity=".72" />
          <path d={mapData.layers.streams.path} fill="none" stroke="#2f7596" strokeWidth="1.15" opacity=".92" />
          <path d={mapData.layers.waterBodies.path} fill="#1f5878" fillRule={mapData.layers.waterBodies.fillRule as 'evenodd'} />
          <path d={mapData.layers.streets.freeway} fill="none" stroke="#0b1d28" strokeWidth="3.4" opacity=".55" />
          <path d={mapData.layers.streets.freeway} fill="none" stroke="#c3cdcf" strokeWidth="2.1" opacity=".9" />
          {layers.risk && <g className="risk-field">{stationRows.filter((station) => station.alert && station.latitude && station.longitude).map((station) => { const [x, y] = project(station.longitude!, station.latitude!); return <circle key={`risk-${station.station_id}`} cx={x} cy={y} r="34" /> })}</g>}
        </g>
        <path d={mapData.layers.county.path} fill="none" fillRule={mapData.layers.county.fillRule as 'evenodd'} stroke="#efe8d7" strokeWidth="2.6" strokeLinejoin="round" />
        <g className="route-shields">{mapData.layers.routeLabels.filter((route) => ['66', '495', '395', '95', '28'].includes(route.route)).map((route) => { const y = route.y - (stationPoints.some(([sx, sy]) => Math.hypot(sx - route.x, sy - route.y) < 22) ? 24 : 0); const interstate = route.route !== '28'; return <g key={`${route.route}-${route.x}-${route.y}`} transform={`translate(${route.x} ${y})`} className={interstate ? 'shield-interstate' : 'shield-state'} aria-hidden="true">{interstate ? <><path className="shield-body" d="M-11-9C-6-11 6-11 11-9 12-1 9 8 0 13-9 8-12-1-11-9Z" /><path className="shield-cap" d="M-11-9C-6-11 6-11 11-9L11.3-5H-11.3Z" /></> : <path d="M-9-9H9V6L0 11-9 6Z" />}<text y="4" textAnchor="middle">{route.route}</text></g> })}</g>
        <g className="county-label"><text x="470" y="318" textAnchor="middle">FAIRFAX</text><text x="470" y="335" textAnchor="middle">COUNTY</text></g>
        {layers.incidents && incidents.filter((incident) => incident.latitude && incident.longitude).map((incident) => { const [x, y] = project(incident.longitude!, incident.latitude!); return <g key={incident.incident_id} className={`map-incident-marker map-incident-${incident.incident_type.toLowerCase()} ${selectedIncidentId === incident.incident_id ? 'map-incident-selected' : ''} ${incident.is_active ? '' : 'map-incident-closed'}`} transform={`translate(${x} ${y})`} role={mode === 'incidents' ? 'button' : undefined} tabIndex={mode === 'incidents' ? 0 : undefined} aria-label={mode === 'incidents' ? `Select ${incident.incident_type} incident at ${incident.display_location || incident.title}` : undefined} onClick={mode === 'incidents' ? () => onIncidentSelect?.(incident.incident_id) : undefined} onKeyDown={mode === 'incidents' ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onIncidentSelect?.(incident.incident_id) } } : undefined}><title>{incident.incident_type}: {incident.display_location || incident.title}{incident.is_active ? '' : ' (closed)'}</title>{mode === 'incidents' && <circle r={selectedIncidentId === incident.incident_id ? 21 : 13} className="incident-map-halo" />}<path className="incident-glyph" d="M0-10.5c.6 0 1.1.3 1.4.8l8.6 15c.6 1.1-.2 2.4-1.4 2.4H-8.6c-1.2 0-2-1.3-1.4-2.4l8.6-15c.3-.5.8-.8 1.4-.8Z" /><rect className="incident-mark" x="-1.15" y="-5.2" width="2.3" height="6.6" rx=".7" /><circle className="incident-mark" cy="4.3" r="1.3" /></g> })}
        {layers.stations && stationRows.filter((station) => station.latitude && station.longitude).map((station) => {
          const [x, y] = project(station.longitude!, station.latitude!)
          const dimmed = scope !== 'all' && scope !== station.station_id
          const state = station.assigned.length === 0 ? 'offline' : station.alert ? 'attention' : 'normal'
          const number = station.name.match(/Station (\d+)/)?.[1] || station.station_id.replace(/\D/g, '')
          return <g key={station.station_id} transform={`translate(${x} ${y})`} className={`map-station station-${state}`} opacity={dimmed ? .24 : 1} role="button" tabIndex={dimmed ? -1 : 0} aria-label={`${station.name}, ${state}`} onClick={() => setSelected(station.station_id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(station.station_id) } }}>
            <title>{station.name} · {station.assigned.length} units · {station.score === null ? 'no active resources' : `${Math.round(station.score)}% readiness`}</title>
            <circle className="marker-halo" r="10" filter="url(#marker-shadow)" />
            <circle className="marker-disc" r="7" />
            <text x="10" y="4">{number}</text>
          </g>
        })}
      </g>
    </svg>

    <div className="map-tools"><button aria-label="Zoom in" onClick={() => setZoom(Math.min(zoom + .18, 1.7))}><Plus /></button><button aria-label="Zoom out" onClick={() => setZoom(Math.max(zoom - .18, .78))}><Minus /></button><button aria-label="Reset map view" onClick={() => { setZoom(1); setSelected(null) }}><Crosshair /></button><button aria-label="Focus map full screen" onClick={() => void boardRef.current?.requestFullscreen?.()}><Expand /></button></div>
    <div className="map-key" aria-label="Map legend">{mode === 'incidents' ? <><span><i className="legend-fire" />Fire</span><span><i className="legend-ems" />EMS</span><span><i className="legend-hazmat" />HazMat</span><span><i className="legend-other" />Other</span></> : <><span><i className="legend-normal" />Station Normal</span><span><i className="legend-attention" />Staffing Attention</span><span><i className="legend-offline" />Station Out of Service</span><span><i className="legend-incident" />Active Incident</span></>}<hr /><span><b className="legend-boundary" />County Boundary</span><span><b className="legend-highway" />Major Highway</span><span><b className="legend-road" />Primary Road</span></div>
    <div className="map-scale"><strong>N</strong><i /><span>0</span><b /><span>2.5</span><b /><span>5</span><b className="long" /><span>10 Miles</span></div>
    <div className="map-source">FAIRFAX COUNTY, VIRGINIA<br />PUBLIC GIS GEOMETRY<br />SYNTHETIC OPERATIONS</div>
    {detail && <div className="map-detail"><button className="map-detail-close" aria-label="Close station details" onClick={() => setSelected(null)}><X /></button><span>STATION REGISTER</span><h3>{detail.name}</h3><p>{detail.address}</p><dl><div><dt>UNITS</dt><dd>{detail.assigned.length}</dd></div><div><dt>READINESS</dt><dd>{detail.score === null ? '—' : `${Math.round(detail.score)}%`}</dd></div></dl><Link href="/readiness?view=units" onClick={() => setStationId(detail.station_id)}>OPEN RESOURCE RECORD →</Link></div>}
  </section>
}
