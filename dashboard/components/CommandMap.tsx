'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Crosshair, Layers, Minus, Plus, X, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useStationScope } from './ScopeContext'
import type { Station, UnitReadiness } from '@/lib/schemas'

type Props = { stations: Station[]; units: UnitReadiness[]; scope: string; actions?: ReactNode }
const project = (lon: number, lat: number) => [(lon + 77.49) / .48 * 920, (39.035 - lat) / .4 * 600]

export default function CommandMap({ stations, units, scope, actions }: Props) {
  const { setStationId } = useStationScope()
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [onlyExceptions, setOnlyExceptions] = useState(false)
  const readiness = new Map(units.map(unit => [unit.unit_id, unit]))
  const stationRows = stations.map(station => {
    const assigned = station.unit_ids.map(id => readiness.get(id)).filter((unit): unit is UnitReadiness => Boolean(unit))
    const score = assigned.length ? assigned.reduce((sum, unit) => sum + unit.readiness_score, 0) / assigned.length : null
    return { ...station, assigned, score }
  })
  const detail = stationRows.find(station => station.station_id === selected)

  return <section className="command-map" aria-label="Fairfax station map">
    <div className="map-topline"><h1><span className="live-beacon" />Fairfax County readiness board</h1><div className="map-board-actions">{actions}</div></div>
    <svg className="tactical-map" viewBox="0 0 920 600" role="group" aria-label="Interactive schematic with public Fairfax station coordinates">
      <defs>
        <pattern id="map-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#335064" strokeWidth=".45" /></pattern>
        <radialGradient id="map-atmosphere"><stop stopColor="#153445" /><stop offset="1" stopColor="#0a1723" /></radialGradient>
        <filter id="station-glow"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="920" height="600" fill="url(#map-atmosphere)" />
      <rect width="920" height="600" fill="url(#map-grid)" opacity=".55" />
      <g transform={`translate(${460 * (1 - zoom)} ${300 * (1 - zoom)}) scale(${zoom})`}>
        <path d="M120 50L350 22 594 98 688 175 786 330 858 386 780 524 579 575 357 495 248 370 83 257Z" fill="#152631" stroke="#45606c" strokeWidth="1" strokeDasharray="4 6" opacity=".65" />
        <path d="M475 -20C505 80 669 110 694 190S826 251 798 324 889 380 904 490 832 573 802 630" stroke="#163c4d" strokeWidth="39" fill="none" />
        <path d="M475 -20C505 80 669 110 694 190S826 251 798 324 889 380 904 490 832 573 802 630" stroke="#2e586a" strokeWidth="1" fill="none" />
        <g fill="none" strokeLinecap="round">
          <path d="M55 420L314 279 530 259 747 232M532 128L541 261 604 383 645 546M176 102L395 177 532 128M88 254L339 331 604 383 836 375" stroke="#091622" strokeWidth="9" />
          <path d="M55 420L314 279 530 259 747 232M532 128L541 261 604 383 645 546M176 102L395 177 532 128M88 254L339 331 604 383 836 375" stroke="#536878" strokeWidth="2" opacity=".65" />
          <path d="M210 62L233 473M354 105L379 489M436 100L405 338 524 524M136 167L440 233 657 207M105 326L350 372 629 436M219 432L411 419 753 455" stroke="#38505e" strokeWidth="1" opacity=".55" />
          <path d="M83 257L197 320 299 410 357 495M350 22L411 115 460 190M630 265L704 296 752 349" stroke="#496573" strokeWidth=".8" opacity=".45" />
          <path d="M151 76L282 194 341 331 326 474M271 42L301 151 459 288 590 321 781 302M115 220L275 244 443 391 689 492M170 360L279 298 478 206 681 178M401 66L503 178 587 286 735 393M463 540L540 468 714 420 824 434" stroke="#3f5967" strokeWidth=".8" opacity=".5" />
          <path d="M98 292L246 356 425 365 568 416 760 507M249 122L322 238 475 309 690 351M331 493L447 448 637 457 811 397M578 92L607 196 721 271" stroke="#55717c" strokeWidth=".65" opacity=".42" />
        </g>
        <g className="map-place-labels">
          <text x="207" y="115">HERNDON</text><text x="330" y="181">RESTON</text>
          <text x="496" y="170">TYSONS</text><text x="619" y="131">McLEAN</text>
          <text x="188" y="280">CHANTILLY</text><text x="407" y="316">FAIRFAX</text>
          <text x="211" y="390">CENTREVILLE</text><text x="597" y="354">ANNANDALE</text>
          <text x="533" y="449">SPRINGFIELD</text><text x="522" y="556">LORTON</text>
          <text x="726" y="489">MOUNT VERNON</text>
          <text x="728" y="168" transform="rotate(43 728 168)" className="river-label">POTOMAC RIVER</text>
        </g>
        <g className="map-highway-labels"><text x="442" y="261">66</text><text x="548" y="342">495</text><text x="621" y="493">95</text><text x="315" y="157">267</text></g>
        {stationRows.filter(station => station.latitude && station.longitude).map(station => {
          const [x, y] = project(station.longitude!, station.latitude!)
          const alert = station.assigned.some(unit => unit.is_understaffed)
          const dimmed = (scope !== 'all' && scope !== station.station_id) || (onlyExceptions && !alert)
          const color = alert ? '#ffbd69' : '#63ddbd'
          const number = station.name.match(/Station (\d+)/)?.[1] || station.station_id
          return <g key={station.station_id} transform={`translate(${x} ${y})`} className="map-station" opacity={dimmed ? .18 : 1} role="button" tabIndex={dimmed ? -1 : 0} aria-label={`${station.name}, ${alert ? 'staffing attention' : 'ready'}`} onClick={() => setSelected(station.station_id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(station.station_id) } }}>
            <title>{station.name} · {station.assigned.length} units · {station.score === null ? 'out of scope' : `${Math.round(station.score)}% readiness`}</title>
            {(alert || selected === station.station_id) && <circle r="18" fill={color} opacity=".15" />}
            <circle r="10" fill={color} opacity=".25" filter="url(#station-glow)" />
            <rect x="-9" y="-9" width="18" height="18" rx="4" fill="#0b1b25" stroke={color} strokeWidth={selected === station.station_id ? 2.5 : 1.2} />
            <text textAnchor="middle" dy="3.5" fill={color} fontSize="9" fontFamily="monospace">{number}</text>
          </g>
        })}
      </g>
    </svg>
    <div className="map-tools"><button aria-label="Zoom in" onClick={() => setZoom(Math.min(zoom + .2, 1.6))}><Plus size={16} /></button><button aria-label="Zoom out" onClick={() => setZoom(Math.max(zoom - .2, .8))}><Minus size={16} /></button><button aria-label="Reset map view" onClick={() => { setZoom(1); setSelected(null) }}><Crosshair size={16} /></button></div>
    <button className={`map-layer-button ${onlyExceptions ? 'is-active' : ''}`} onClick={() => setOnlyExceptions(!onlyExceptions)} aria-pressed={onlyExceptions}><Layers size={14} />{onlyExceptions ? 'Exceptions only' : 'All stations'}</button>
    <div className="map-key" aria-label="Map legend"><strong>Map key</strong><span><i className="legend-ready" />Station ready</span><span><i className="legend-warning" />Staffing attention</span><span><b className="legend-route" />Major route</span><span><b className="legend-boundary" />County schematic</span></div>
    {detail && <div className="map-detail"><button className="map-detail-close" aria-label="Close station details" onClick={() => setSelected(null)}><X size={16} /></button><span className="command-kicker">STATION INTELLIGENCE</span><h3>{detail.name}</h3><p>{detail.address}</p><div className="map-detail-stats"><span><strong>{detail.assigned.length}</strong> units in scope</span><span><strong>{detail.score === null ? '—' : `${Math.round(detail.score)}%`}</strong> readiness</span></div><Link href="/readiness" onClick={() => setStationId(detail.station_id)}>Review operational resources <ArrowUpRight size={14} /></Link></div>}
    <div className="map-bottomline"><span><i className="legend-ready" />Ready <i className="legend-warning" />Staffing attention</span><span>Public station coordinates · schematic context</span></div>
  </section>
}
