'use client'

import { useEffect, useRef, useState } from 'react'
import { Crosshair, Expand, Minus, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import mapData from '@/public/maps/fairfax-command-map.json'
import { useStationScope } from './ScopeContext'
import type { Incident, Station, UnitReadiness } from '@/lib/schemas'

type Props = { stations: Station[]; units: UnitReadiness[]; incidents: Incident[]; scope: string }
type LayerName = 'stations' | 'incidents' | 'risk'

function project(lon: number, lat: number) {
  const [minLon, minLat, maxLon, maxLat] = mapData.projection.geographicBounds
  const [left, top, right, bottom] = mapData.projection.drawBounds
  return [left + ((lon - minLon) / (maxLon - minLon)) * (right - left), bottom - ((lat - minLat) / (maxLat - minLat)) * (bottom - top)]
}

export default function CommandMap({ stations, units, incidents, scope }: Props) {
  const { setStationId } = useStationScope()
  const params = useSearchParams()
  const stationRegister = params.get('layer') === 'stations'
  const boardRef = useRef<HTMLElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [layers, setLayers] = useState<Record<LayerName, boolean>>({ stations: true, incidents: true, risk: false })
  useEffect(() => {
    setLayers({ stations: true, incidents: !stationRegister, risk: false })
  }, [stationRegister])
  const readiness = new Map(units.map((unit) => [unit.unit_id, unit]))
  const stationRows = stations.map((station) => {
    const assigned = station.unit_ids.map((id) => readiness.get(id)).filter((unit): unit is UnitReadiness => Boolean(unit))
    const score = assigned.length ? assigned.reduce((sum, unit) => sum + unit.readiness_score, 0) / assigned.length : null
    const alert = assigned.some((unit) => unit.is_understaffed || unit.readiness_score < 85)
    return { ...station, assigned, score, alert }
  })
  const detail = stationRows.find((station) => station.station_id === selected)
  const toggleLayer = (layer: LayerName) => setLayers((current) => ({ ...current, [layer]: !current[layer] }))

  return <section ref={boardRef} className="command-map" aria-label="Fairfax County readiness board">
    <div className="map-topline"><h1 aria-label="Fairfax County readiness board"><span className="map-title-full">FAIRFAX COUNTY READINESS BOARD</span><span className="map-title-short">FAIRFAX READINESS</span></h1><div className="map-layer-tabs" aria-label="Map layers"><button aria-pressed={layers.stations} onClick={() => toggleLayer('stations')}>STATIONS</button><i /><button aria-pressed={layers.incidents} onClick={() => toggleLayer('incidents')}>INCIDENTS</button><i /><button aria-pressed={layers.risk} onClick={() => toggleLayer('risk')}>RISK LAYERS</button><i /><span>{scope !== 'all' ? 'FILTERED' : layers.risk ? 'RISK ON' : 'NONE'}</span></div></div>
    <svg className="tactical-map" viewBox="0 0 920 600" role="group" aria-label="Interactive Fairfax County map using locally committed public GIS geometry">
      <defs>
        <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#335064" strokeWidth=".35" /></pattern>
        <pattern id="map-fine-grid" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M6 0H0V6" fill="none" stroke="#284353" strokeWidth=".15" /></pattern>
        <clipPath id="county-clip"><path d={mapData.layers.county.path} fillRule={mapData.layers.county.fillRule as 'evenodd'} /></clipPath>
        <filter id="marker-shadow"><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <rect width="920" height="600" fill="#0b1d28" />
      <rect width="920" height="600" fill="url(#map-fine-grid)" opacity=".7" />
      <rect width="920" height="600" fill="url(#map-grid)" opacity=".75" />
      <g className="map-regional-context">
        <text x="64" y="102">LOUDOUN</text><text x="64" y="118">COUNTY</text>
        <text x="706" y="120">ARLINGTON</text><text x="706" y="136">COUNTY</text>
        <text x="752" y="296">WASHINGTON DC</text><text x="764" y="430">ALEXANDRIA</text>
        <text x="40" y="514">PRINCE WILLIAM</text><text x="40" y="530">COUNTY</text>
        <text x="669" y="221">FALLS CHURCH</text><text x="54" y="196">✈ DULLES INTL</text>
      </g>
      <g transform={`translate(${460 * (1 - zoom)} ${300 * (1 - zoom)}) scale(${zoom})`} className="map-zoom-layer">
        <path d={mapData.layers.waterBodies.path} fill="#12384e" fillRule={mapData.layers.waterBodies.fillRule as 'evenodd'} opacity=".98" />
        <path d={mapData.layers.streams.path} fill="none" stroke="#1b4b62" strokeWidth="1.1" opacity=".75" />
        <path d={mapData.layers.county.path} fill="#203235" fillRule={mapData.layers.county.fillRule as 'evenodd'} stroke="#efe8d7" strokeWidth="3" strokeLinejoin="round" />
        <g clipPath="url(#county-clip)">
          <rect x="20" y="10" width="880" height="580" fill="url(#map-grid)" opacity=".48" />
          <path d={mapData.layers.streets.collector} fill="none" stroke="#4b5c61" strokeWidth=".42" opacity=".42" />
          <path d={mapData.layers.streets.arterial} fill="none" stroke="#596a6e" strokeWidth=".65" opacity=".54" />
          <path d={mapData.layers.majorRoads.path} fill="none" stroke="#748184" strokeWidth="1.1" opacity=".76" />
          <path d={mapData.layers.streets.freeway} fill="none" stroke="#8597a0" strokeWidth="2.1" opacity=".88" />
          {layers.risk && <g className="risk-field">{stationRows.filter((station) => station.alert && station.latitude && station.longitude).map((station) => { const [x, y] = project(station.longitude!, station.latitude!); return <circle key={`risk-${station.station_id}`} cx={x} cy={y} r="34" /> })}</g>}
        </g>
        <g className="route-shields">{mapData.layers.routeLabels.slice(0, 7).map((route) => <g key={`${route.route}-${route.x}-${route.y}`} transform={`translate(${route.x} ${route.y})`}><path d="M-12-10H12L10 8 0 14-10 8Z" /><text y="4" textAnchor="middle">{route.route}</text></g>)}</g>
        <g className="county-label"><text x="443" y="318" textAnchor="middle">FAIRFAX</text><text x="443" y="335" textAnchor="middle">COUNTY</text></g>
        {layers.incidents && incidents.filter((incident) => incident.latitude && incident.longitude).map((incident) => { const [x, y] = project(incident.longitude!, incident.latitude!); return <g key={incident.incident_id} className="map-incident-marker" transform={`translate(${x} ${y})`}><title>{incident.incident_type}: {incident.display_location || incident.title}</title><path d="M0-10L9 7H-9Z" /><text y="4" textAnchor="middle">!</text></g> })}
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
    <div className="map-key" aria-label="Map legend"><span><i className="legend-normal" />Station Normal</span><span><i className="legend-attention" />Staffing Attention</span><span><i className="legend-offline" />Station Out of Service</span><span><i className="legend-non" />Non-FC Station</span><hr /><span><b className="legend-boundary" />County Boundary</span><span><b className="legend-highway" />Major Highway</span><span><b className="legend-road" />Primary Road</span></div>
    <div className="map-scale"><strong>N</strong><i /><span>0</span><b /><span>2.5</span><b /><span>5</span><b className="long" /><span>10 Miles</span></div>
    <div className="map-source">FAIRFAX COUNTY, VIRGINIA<br />PUBLIC GIS GEOMETRY<br />SYNTHETIC OPERATIONS</div>
    {detail && <div className="map-detail"><button className="map-detail-close" aria-label="Close station details" onClick={() => setSelected(null)}><X /></button><span>STATION REGISTER</span><h3>{detail.name}</h3><p>{detail.address}</p><dl><div><dt>UNITS</dt><dd>{detail.assigned.length}</dd></div><div><dt>READINESS</dt><dd>{detail.score === null ? '—' : `${Math.round(detail.score)}%`}</dd></div></dl><Link href="/readiness?view=units" onClick={() => setStationId(detail.station_id)}>OPEN RESOURCE RECORD →</Link></div>}
  </section>
}
