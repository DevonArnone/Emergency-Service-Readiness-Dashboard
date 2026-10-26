'use client'

import { useQuery } from '@tanstack/react-query'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { ChevronDown, Crosshair, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { ObjectChip } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import { incidentRef } from '@/lib/history'
import { INCIDENT_TYPE_LABEL, stationNumber } from '@/lib/map/stations'
import type { Incident, Station, Unit } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import styles from './graph.module.css'

type NodeKind = 'incident' | 'apparatus' | 'person' | 'station'
type GraphNode = SimulationNodeDatum & { id: string; kind: NodeKind; label: string; detail: string; ref: string; tone?: string; href?: string }
type GraphEdge = SimulationLinkDatum<GraphNode> & { id: string; relation: 'assigned to' | 'crew of' | 'housed at'; tone?: string }

const WIDTH = 1000, HEIGHT = 600
const RELATION_DISTANCE: Record<GraphEdge['relation'], number> = { 'assigned to': 90, 'crew of': 34, 'housed at': 70 }
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

/**
 * Relationships behind the active picture: incidents, the apparatus assigned to them, the crews riding those
 * apparatus, and the stations that house them. Built from recorded assignments only.
 */
export default function LinkGraph({ incidents, units, stations, selectedId, onSelect, compact = false, focusId }: { incidents: Incident[]; units: Unit[]; stations: Station[]; selectedId?: string; onSelect: (incidentId: string) => void; compact?: boolean; focusId?: string }) {
  const assignments = useQuery({ queryKey: queryKeys.assignments, queryFn: api.assignments })
  const personnel = useQuery({ queryKey: queryKeys.personnel, queryFn: api.personnel })
  const [showCrews, setShowCrews] = useState(!compact)
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [pinned, setPinned] = useState<Record<string, [number, number]>>({})
  const drag = useRef<{ kind: 'pan' | 'node'; id?: string; x: number; y: number; moved: boolean } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const graph = useMemo(() => {
    const unitById = new Map(units.map((unit) => [unit.unit_id, unit]))
    const stationById = new Map(stations.map((station) => [station.station_id, station]))
    const nameById = new Map((personnel.data || []).map((person) => [person.personnel_id, person.name]))
    const nodes = new Map<string, GraphNode>()
    const edges: GraphEdge[] = []
    const scoped = focusId ? incidents.filter((incident) => incident.incident_id === focusId) : incidents.filter((incident) => incident.is_active)
    for (const incident of scoped) {
      const incidentKey = `incident:${incident.incident_id}`
      nodes.set(incidentKey, { id: incidentKey, kind: 'incident', ref: incident.incident_id, label: incidentRef(incident), detail: `${INCIDENT_TYPE_LABEL[incident.incident_type]} · ${(incident.display_location || incident.title).split(',')[0]}`, tone: incident.incident_type.toLowerCase() })
      for (const unitId of incident.assigned_unit_ids) {
        const unit = unitById.get(unitId)
        const unitKey = `apparatus:${unitId}`
        if (!nodes.has(unitKey)) nodes.set(unitKey, { id: unitKey, kind: 'apparatus', ref: unitId, label: unit?.unit_name || unitId.replace(/^unit-/, '').toUpperCase(), detail: unit ? `${unit.type.toLowerCase()} · ${unit.operational_status.replace(/_/g, ' ').toLowerCase()}` : 'apparatus', href: `/readiness?view=units&unit=${encodeURIComponent(unitId)}` })
        edges.push({ id: `${incidentKey}>${unitKey}`, source: unitKey, target: incidentKey, relation: 'assigned to', tone: incident.incident_type.toLowerCase() })
        const station = unit?.station_id ? stationById.get(unit.station_id) : undefined
        if (station) {
          const stationKey = `station:${station.station_id}`
          if (!nodes.has(stationKey)) nodes.set(stationKey, { id: stationKey, kind: 'station', ref: station.station_id, label: `ST ${stationNumber(station).padStart(2, '0')}`, detail: station.name.split(' — ')[1] || station.name, href: `/?layer=stations&station=${encodeURIComponent(station.station_id)}` })
          if (!edges.some((edge) => edge.id === `${unitKey}>${stationKey}`)) edges.push({ id: `${unitKey}>${stationKey}`, source: unitKey, target: stationKey, relation: 'housed at' })
        }
        if (showCrews) {
          for (const assignment of assignments.data || []) {
            if (assignment.unit_id !== unitId || assignment.assignment_status !== 'ON_SHIFT') continue
            const personKey = `person:${assignment.personnel_id}`
            const name = nameById.get(assignment.personnel_id) || assignment.personnel_id
            if (!nodes.has(personKey)) nodes.set(personKey, { id: personKey, kind: 'person', ref: assignment.personnel_id, label: initials(name), detail: name, href: `/personnel?person=${encodeURIComponent(assignment.personnel_id)}` })
            edges.push({ id: `${personKey}>${unitKey}`, source: personKey, target: unitKey, relation: 'crew of' })
          }
        }
      }
    }
    const list = Array.from(nodes.values())
    // Lay out once per data change: deterministic seed positions, then a fixed number of ticks, so the picture never jitters.
    list.forEach((node, index) => { const angle = index * 2.399963; const radius = 30 + 9 * Math.sqrt(index) * 6; node.x = WIDTH / 2 + Math.cos(angle) * radius; node.y = HEIGHT / 2 + Math.sin(angle) * radius })
    const simulation = forceSimulation(list)
      .force('link', forceLink<GraphNode, GraphEdge>(edges).id((node) => node.id).distance((edge) => RELATION_DISTANCE[edge.relation]).strength(0.9))
      .force('charge', forceManyBody<GraphNode>().strength((node) => (node.kind === 'person' ? -40 : node.kind === 'incident' ? -420 : -220)))
      .force('collide', forceCollide<GraphNode>((node) => (node.kind === 'person' ? 9 : 26)))
      .force('x', forceX(WIDTH / 2).strength(0.06))
      .force('y', forceY(HEIGHT / 2).strength(0.09))
      .stop()
    for (let tick = 0; tick < 320; tick++) simulation.tick()
    // Fit the finished layout to the canvas, keeping its proportions.
    if (list.length) {
      const xs = list.map((node) => node.x ?? 0), ys = list.map((node) => node.y ?? 0)
      const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
      const pad = 70
      const scale = Math.min(2.2, (WIDTH - pad * 2) / Math.max(1, maxX - minX), (HEIGHT - pad * 2) / Math.max(1, maxY - minY))
      const offsetX = (WIDTH - (maxX - minX) * scale) / 2, offsetY = (HEIGHT - (maxY - minY) * scale) / 2
      list.forEach((node) => { node.x = offsetX + ((node.x ?? 0) - minX) * scale; node.y = offsetY + ((node.y ?? 0) - minY) * scale })
    }
    return { nodes: list, edges }
  }, [incidents, units, stations, assignments.data, personnel.data, showCrews, focusId])

  const position = (node: GraphNode): [number, number] => pinned[node.id] ?? [node.x ?? 0, node.y ?? 0]
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const endpoint = (value: string | number | GraphNode) => (typeof value === 'object' ? value : byId.get(String(value)))
  const active = hovered || focused
  const neighbors = useMemo(() => {
    if (!active) return null
    const set = new Set([active])
    graph.edges.forEach((edge) => { const a = endpoint(edge.source)?.id, b = endpoint(edge.target)?.id; if (a === active && b) set.add(b); if (b === active && a) set.add(a) })
    return set
    // endpoint reads the current graph only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, graph])

  const toGraph = (clientX: number, clientY: number) => {
    const box = svgRef.current!.getBoundingClientRect()
    const sx = ((clientX - box.left) / box.width) * WIDTH, sy = ((clientY - box.top) / box.height) * HEIGHT
    return [(sx - view.x) / view.k, (sy - view.y) / view.k] as const
  }
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const target = (event.target as Element).closest('[data-graph-node]')
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { kind: target ? 'node' : 'pan', id: target?.getAttribute('data-graph-node') || undefined, x: event.clientX, y: event.clientY, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = drag.current
    if (!current) return
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 3) current.moved = true
    if (!current.moved) return
    if (current.kind === 'pan') {
      const box = svgRef.current!.getBoundingClientRect()
      setView((value) => ({ ...value, x: value.x + ((event.clientX - current.x) / box.width) * WIDTH, y: value.y + ((event.clientY - current.y) / box.height) * HEIGHT }))
      current.x = event.clientX; current.y = event.clientY
    } else if (current.id) {
      const [x, y] = toGraph(event.clientX, event.clientY)
      setPinned((value) => ({ ...value, [current.id!]: [x, y] }))
    }
  }
  const activate = (node: GraphNode) => {
    if (node.kind === 'incident') onSelect(node.ref)
    setFocused(node.id)
  }
  const onPointerUp = () => {
    const current = drag.current
    drag.current = null
    if (!current || current.moved) return
    const node = current.id ? byId.get(current.id) : undefined
    if (node) activate(node); else setFocused(null)
  }
  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    const [gx, gy] = toGraph(event.clientX, event.clientY)
    setView((value) => {
      const k = Math.min(3, Math.max(0.5, value.k * (event.deltaY < 0 ? 1.12 : 0.89)))
      return { k, x: value.x - gx * (k - value.k), y: value.y - gy * (k - value.k) }
    })
  }
  const zoomBy = (factor: number) => setView((value) => { const k = Math.min(3, Math.max(0.5, value.k * factor)); return { k, x: WIDTH / 2 - ((WIDTH / 2 - value.x) / value.k) * k, y: HEIGHT / 2 - ((HEIGHT / 2 - value.y) / value.k) * k } })

  const focusedNode = focused ? byId.get(focused) : undefined
  const counts = graph.nodes.reduce<Record<NodeKind, number>>((total, node) => ({ ...total, [node.kind]: total[node.kind] + 1 }), { incident: 0, apparatus: 0, person: 0, station: 0 })

  return (
    <section className={cn('ui-stage', styles.graph, compact && styles.compact)} aria-labelledby={compact ? undefined : 'graph-heading'} aria-label={compact ? 'Linked objects graph' : undefined} data-ui="link-graph">
      {!compact && (
        <header className="ui-stage-header">
          <div><h2 id="graph-heading">Relationship graph</h2><p>{counts.incident} active incidents · {counts.apparatus} apparatus · {counts.station} stations{showCrews ? ` · ${counts.person} crew` : ''} · from recorded assignments</p></div>
          <div className={styles.headerTools}>
            <button type="button" className="ui-stage-button" aria-pressed={showCrews} onClick={() => setShowCrews((value) => !value)}>Crews</button>
          </div>
        </header>
      )}
      <div className={styles.canvas}>
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg} role="group" aria-label="Incident relationship graph" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setHovered(null)} onWheel={onWheel}>
          <defs>
            <pattern id="graph-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className={styles.dot} /></pattern>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#graph-dots)" />
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {graph.edges.map((edge) => {
              const a = endpoint(edge.source), b = endpoint(edge.target)
              if (!a || !b) return null
              const [x1, y1] = position(a), [x2, y2] = position(b)
              const dim = neighbors && !(neighbors.has(a.id) && neighbors.has(b.id))
              return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.edge} data-relation={edge.relation} data-tone={edge.tone} data-dim={dim || undefined} />
            })}
            {graph.nodes.map((node) => {
              const [x, y] = position(node)
              const dim = neighbors && !neighbors.has(node.id)
              const selected = node.kind === 'incident' && node.ref === selectedId
              const showLabel = node.kind !== 'person' || neighbors?.has(node.id)
              return (
                <g key={node.id} transform={`translate(${x} ${y})`} className={styles.node} data-graph-node={node.id} data-kind={node.kind} data-tone={node.tone} data-dim={dim || undefined} data-selected={selected || undefined}
                  role="button" tabIndex={0} aria-label={`${node.kind} ${node.label}, ${node.detail}`} aria-pressed={node.kind === 'incident' ? selected : undefined}
                  onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)} onFocus={() => setHovered(node.id)} onBlur={() => setHovered(null)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(node) } }}>
                  {node.kind === 'incident' && <><circle r="22" className={styles.halo} /><rect x="-11" y="-11" width="22" height="22" rx="3" transform="rotate(45)" className={styles.shape} /></>}
                  {node.kind === 'apparatus' && <rect x="-12" y="-9" width="24" height="18" rx="3" className={styles.shape} />}
                  {node.kind === 'station' && <polygon points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7" className={styles.shape} />}
                  {node.kind === 'person' && <circle r="5.5" className={styles.shape} />}
                  {showLabel && <text y={node.kind === 'person' ? 17 : node.kind === 'incident' ? 30 : 26} textAnchor="middle" className={styles.label}>{node.kind === 'person' ? node.detail : node.label}</text>}
                  {node.kind === 'incident' && <text y="42" textAnchor="middle" className={styles.sublabel}>{node.detail.split(' · ')[1]}</text>}
                </g>
              )
            })}
          </g>
        </svg>
        {!graph.nodes.length && <p className={styles.empty}>{assignments.isLoading ? 'Loading assignments…' : 'No active incidents with recorded assignments.'}</p>}
        <div className={styles.tools}>
          <button type="button" className="ui-stage-button" aria-label="Zoom graph in" onClick={() => zoomBy(1.25)}><Plus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Zoom graph out" onClick={() => zoomBy(0.8)}><Minus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Reset graph view" onClick={() => { setView({ k: 1, x: 0, y: 0 }); setPinned({}); setFocused(null) }}><Crosshair aria-hidden="true" /></button>
        </div>
        {focusedNode && !compact && (
          <div className={styles.card} aria-live="polite" data-ui="graph-card">
            <ObjectChip type={focusedNode.kind} id={focusedNode.kind === 'person' ? undefined : focusedNode.label} />
            <strong>{focusedNode.kind === 'person' ? focusedNode.detail : focusedNode.detail}</strong>
            <small>{(neighbors?.size ?? 1) - 1} linked {(neighbors?.size ?? 1) - 1 === 1 ? 'object' : 'objects'}</small>
            {focusedNode.href && <Link href={focusedNode.href}>Open record →</Link>}
          </div>
        )}
      </div>
      {!compact && (
        <>
          <ul className={styles.legend} aria-label="Graph legend">
            <li><i data-kind="incident" />Incident</li><li><i data-kind="apparatus" />Apparatus</li><li><i data-kind="station" />Station</li><li><i data-kind="person" />Crew</li>
            <li><i data-edge="assigned" />Assigned to</li><li><i data-edge="housed" />Housed at</li>
            <li className={styles.hint}>Drag to pan or pin · scroll to zoom · select an incident to open its record</li>
          </ul>
          <details className={styles.list}>
            <summary>Relationships as a list<ChevronDown aria-hidden="true" /></summary>
            <ul>
              {graph.edges.filter((edge) => edge.relation !== 'crew of').map((edge) => { const a = endpoint(edge.source), b = endpoint(edge.target); return a && b ? <li key={edge.id}>{a.label} <span>{edge.relation}</span> {b.label}{b.kind === 'incident' ? ` (${b.detail})` : ''}</li> : null })}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
