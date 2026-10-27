'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ArcLayer, ColumnLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { Delaunay } from 'd3-delaunay'
import { Box, Compass, Crosshair, Expand, Layers as LayersIcon, Minus, Plus } from 'lucide-react'
import { AttributionControl, Map as MapLibreMap, Marker, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CONDITION_LABEL, INCIDENT_TYPE_LABEL, LAYER_LABEL, LAYER_NOTE, stationNumber, stationRows, type MapLayer, type StationRow } from '@/lib/map/stations'
import { BASEMAP_SOURCE, buildStyle, countyBounds, readPalette, type CountyCollection } from '@/lib/map/style'
import type { Incident, Station, UnitReadiness } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import styles from './map.module.css'

export type GeoMapProps = {
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
  className?: string
  /** Fill the parent's height instead of keeping the map's own aspect ratio. */
  fill?: boolean
  /** Docked panels rendered over the map canvas. */
  overlay?: ReactNode
  /** Called when WebGL is unavailable so the caller can fall back to the SVG map. */
  onUnavailable?: () => void
  /** Width in px covered by a panel docked over the map's right edge; controls and framing keep clear of it. */
  insetRight?: number
  /** Start with the layer panel open (map-first layouts). */
  layersOpenDefault?: boolean
}

type RGBA = [number, number, number, number]
const MILE = 1609.344
const RINGS = [1, 3, 5]
const LAYER_ORDER: MapLayer[] = ['stations', 'incidents', 'risk', 'links', 'areas', 'columns', 'terrain', 'buildings']

let workerConfigured = false
function configureWorker() {
  if (workerConfigured) return
  // Served from public/ (copied by scripts/copy-map-worker.mjs) so dev and production bundles agree on its URL.
  setWorkerUrl('/vendor/maplibre-gl-worker.mjs')
  workerConfigured = true
}

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Resolves a CSS color token (hex or rgba) to deck.gl's RGBA tuple. */
function tokenColor(name: string, alpha?: number): RGBA {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha ?? 255]
  }
  const rgba = value.match(/rgba?\(([^)]+)\)/)
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((part) => part.trim())
    return [Number(r), Number(g), Number(b), alpha ?? Math.round(Number(a) * 255)]
  }
  return [255, 255, 255, alpha ?? 255]
}

const coordsOf = (item: { latitude?: number | null; longitude?: number | null }): [number, number] | null => (item.latitude && item.longitude ? [item.longitude, item.latitude] : null)
const formatLat = (lat: number) => `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`
const formatLon = (lon: number) => `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`

export default function GeoMap({ title, stations, units, incidents, scope, mode = 'readiness', layers, onToggleLayer, selectedStationId, onStationSelect, selectedIncidentId, onIncidentSelect, onReset, className, fill = false, overlay, onUnavailable, insetRight = 0, layersOpenDefault = false }: GeoMapProps) {
  const stageRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const deckRef = useRef<MapboxOverlay | null>(null)
  const countyRef = useRef<CountyCollection | null>(null)
  const stationMarkers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>())
  const incidentMarkers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>())
  const handlers = useRef({ onStationSelect, onIncidentSelect })
  const [ready, setReady] = useState(false)
  const [styleReady, setStyleReady] = useState(false)
  const [basemapOffline, setBasemapOffline] = useState(false)
  const [threeD, setThreeD] = useState(false)
  const [bearing, setBearing] = useState(0)
  const [zoom, setZoom] = useState(9.5)
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const [center, setCenter] = useState<[number, number] | null>(null)
  const [county, setCounty] = useState<CountyCollection | null>(null)
  const [layersOpen, setLayersOpen] = useState(layersOpenDefault)
  // Follow the docked layout as the viewport changes: open beside docked panels, closed on narrow screens.
  useEffect(() => { setLayersOpen(layersOpenDefault) }, [layersOpenDefault])
  const framing = useRef({ insetRight, layersOpen })
  useEffect(() => { framing.current = { insetRight, layersOpen } }, [insetRight, layersOpen])
  const padding = () => ({ top: 28, bottom: 28, left: framing.current.layersOpen ? 236 : 28, right: 64 + framing.current.insetRight })

  useEffect(() => { handlers.current = { onStationSelect, onIncidentSelect } }, [onStationSelect, onIncidentSelect])

  const rows = useMemo(() => stationRows(stations, units), [stations, units])
  const stationByUnit = useMemo(() => new Map(stations.flatMap((station) => station.unit_ids.map((id) => [id, station] as const))), [stations])
  const activeIncidents = useMemo(() => incidents.filter((incident) => incident.is_active), [incidents])

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (!webglAvailable()) { onUnavailable?.(); return }
    configureWorker()
    let disposed = false
    let map: MapLibreMap | null = null
    fetch('/maps/fairfax-county.geojson').then((response) => response.json()).then((county: CountyCollection) => {
      if (disposed) return
      countyRef.current = county
      setCounty(county)
      try {
        map = new MapLibreMap({
          container,
          style: buildStyle(readPalette(), county, { buildings: true, terrain: true }),
          bounds: countyBounds(county),
          fitBoundsOptions: { padding: padding() },
          minZoom: 8.5,
          maxZoom: 17.5,
          maxPitch: 70,
          attributionControl: false,
          cooperativeGestures: false,
          fadeDuration: 150,
        })
      } catch {
        onUnavailable?.()
        return
      }
      mapRef.current = map
      setReady(true)
      // Sources carry their own attribution (OpenFreeMap, OpenMapTiles, OpenStreetMap, terrain, county GIS).
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new ScaleControl({ unit: 'imperial', maxWidth: 110 }), 'bottom-left')
      // Overlaid rather than interleaved: deck draws its own canvas synced to the map camera, independent of MapLibre's renderer internals.
      const deck = new MapboxOverlay({ interleaved: false, layers: [] })
      deckRef.current = deck
      map.addControl(deck)
      map.on('load', () => {
        if (disposed) return
        setStyleReady(true)
        const point = map!.getCenter(); setCenter([point.lng, point.lat])
        // Start collapsed; the info button expands it.
        container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      })
      // Marks when the camera is still and tiles are drawn, so recordings and screenshots wait for a settled map.
      map.on('idle', () => { if (stageRef.current) stageRef.current.dataset.mapIdle = 'true' })
      map.on('movestart', () => { delete stageRef.current?.dataset.mapIdle })
      map.on('rotate', () => setBearing(map!.getBearing()))
      map.on('zoom', () => setZoom(map!.getZoom()))
      map.on('moveend', () => { const point = map!.getCenter(); setCenter([point.lng, point.lat]) })
      map.on('pitchend', () => setThreeD(map!.getPitch() > 10))
      map.on('mousemove', (event) => setCursor([event.lngLat.lng, event.lngLat.lat]))
      map.on('mouseout', () => setCursor(null))
      map.on('error', (event) => {
        const source = (event as { sourceId?: string }).sourceId
        if (source === BASEMAP_SOURCE) setBasemapOffline(true)
      })
      map.on('webglcontextlost', () => onUnavailable?.())
    }).catch(() => onUnavailable?.())
    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(container)
    const markersForStations = stationMarkers.current
    const markersForIncidents = incidentMarkers.current
    return () => {
      disposed = true
      observer.disconnect()
      markersForStations.forEach(({ marker }) => marker.remove()); markersForStations.clear()
      markersForIncidents.forEach(({ marker }) => marker.remove()); markersForIncidents.clear()
      mapRef.current?.remove()
      mapRef.current = null
      deckRef.current = null
    }
    // The map is created once; props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Basemap layer visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    map.setLayoutProperty('hillshade', 'visibility', layers.terrain ? 'visible' : 'none')
    map.setLayoutProperty('buildings', 'visibility', layers.buildings ? 'visible' : 'none')
  }, [styleReady, layers.terrain, layers.buildings])

  // Station markers: real buttons, so they are focusable and carry the record's state.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const existing = stationMarkers.current
    const visible = layers.stations ? rows.filter((row) => coordsOf(row)) : []
    const keep = new Set(visible.map((row) => row.station_id))
    existing.forEach(({ marker }, id) => { if (!keep.has(id)) { marker.remove(); existing.delete(id) } })
    for (const row of visible) {
      let entry = existing.get(row.station_id)
      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = styles.geoStation
        el.innerHTML = `<span class="${styles.geoDisc}"></span><span class="${styles.geoLabel}"></span>`
        el.addEventListener('click', (event) => { event.stopPropagation(); handlers.current.onStationSelect?.(row.station_id) })
        entry = { el, marker: new Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(coordsOf(row)!).addTo(map) }
        existing.set(row.station_id, entry)
      }
      const selected = selectedStationId === row.station_id
      const dimmed = scope !== 'all' && scope !== row.station_id
      const el = entry.el
      el.dataset.mapStation = row.station_id
      el.dataset.condition = row.condition
      if (selected) el.dataset.selected = 'true'; else delete el.dataset.selected
      el.setAttribute('aria-pressed', String(selected))
      el.setAttribute('aria-label', `${row.name}, ${CONDITION_LABEL[row.condition].toLowerCase()}`)
      el.title = `${row.name} · ${row.assigned.length} units · ${row.score === null ? 'no active resources' : `${Math.round(row.score)}% readiness`}`
      el.tabIndex = dimmed ? -1 : 0
      el.style.opacity = dimmed ? '0.3' : ''
      el.style.zIndex = selected ? '3' : row.condition === 'normal' ? '1' : '2'
      el.querySelector(`.${styles.geoLabel}`)!.textContent = stationNumber(row)
    }
  }, [ready, rows, layers.stations, selectedStationId, scope])

  // Incident markers: buttons when the view can select incidents, labelled images otherwise.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const existing = incidentMarkers.current
    const interactive = Boolean(onIncidentSelect)
    const visible = layers.incidents ? incidents.filter((incident) => coordsOf(incident)) : []
    const keep = new Set(visible.map((incident) => incident.incident_id))
    existing.forEach(({ marker }, id) => { if (!keep.has(id)) { marker.remove(); existing.delete(id) } })
    for (const incident of visible) {
      let entry = existing.get(incident.incident_id)
      if (entry && (entry.el.tagName === 'BUTTON') !== interactive) { entry.marker.remove(); existing.delete(incident.incident_id); entry = undefined }
      if (!entry) {
        const el = document.createElement(interactive ? 'button' : 'div')
        if (el instanceof HTMLButtonElement) {
          el.type = 'button'
          el.addEventListener('click', (event) => { event.stopPropagation(); handlers.current.onIncidentSelect?.(incident.incident_id) })
        } else {
          el.setAttribute('role', 'img')
        }
        el.className = styles.geoIncident
        el.innerHTML = `<span class="${styles.geoPulse}"></span><span class="${styles.geoPulse}" style="animation-delay:1.4s"></span><span class="${styles.geoDiamond}"><b>!</b></span>`
        entry = { el, marker: new Marker({ element: el, anchor: 'center', subpixelPositioning: true }).setLngLat(coordsOf(incident)!).addTo(map) }
        existing.set(incident.incident_id, entry)
      }
      const selected = selectedIncidentId === incident.incident_id
      const el = entry.el
      el.dataset.mapIncident = incident.incident_id
      el.dataset.type = incident.incident_type.toLowerCase()
      el.dataset.active = String(incident.is_active)
      if (selected) el.dataset.selected = 'true'; else delete el.dataset.selected
      if (interactive) el.setAttribute('aria-pressed', String(selected))
      el.setAttribute('aria-label', `${interactive ? 'Select ' : ''}${INCIDENT_TYPE_LABEL[incident.incident_type]} incident at ${incident.display_location || incident.title}${incident.is_active ? '' : ' (closed)'}`)
      el.title = `${INCIDENT_TYPE_LABEL[incident.incident_type]}: ${incident.display_location || incident.title}`
      el.style.zIndex = selected ? '5' : '4'
    }
  }, [ready, incidents, layers.incidents, selectedIncidentId, onIncidentSelect])

  // deck.gl depth layers.
  const deckLayers = useMemo(() => {
    if (typeof window === 'undefined') return []
    const ok = tokenColor('--stage-ok'), warn = tokenColor('--stage-warn'), bad = tokenColor('--stage-bad'), cobalt = tokenColor('--stage-cobalt')
    const typeColor: Record<Incident['incident_type'], RGBA> = { FIRE: bad, EMS: cobalt, HAZMAT: warn, OTHER: tokenColor('--stage-incident-other') }
    const conditionColor = (row: StationRow, alpha: number): RGBA => { const base = row.condition === 'normal' ? ok : row.condition === 'attention' ? warn : bad; return [base[0], base[1], base[2], alpha] }
    const placed = rows.filter((row) => coordsOf(row))
    const result = []

    if (layers.areas && placed.length > 2 && county) {
      const [[west, south], [east, north]] = countyBounds(county)
      const voronoi = Delaunay.from(placed.map((row) => coordsOf(row)!)).voronoi([west - 0.05, south - 0.05, east + 0.05, north + 0.05])
      const cells = placed.map((row, index) => ({ row, polygon: voronoi.cellPolygon(index) })).filter((cell) => cell.polygon)
      result.push(new PolygonLayer({
        id: 'station-areas', data: cells, getPolygon: (cell) => cell.polygon as unknown as number[][],
        getFillColor: (cell) => cell.row.station_id === selectedStationId ? [cobalt[0], cobalt[1], cobalt[2], 70] : conditionColor(cell.row, cell.row.condition === 'normal' ? 16 : 46),
        getLineColor: [255, 255, 255, 40], lineWidthUnits: 'pixels', getLineWidth: 1, stroked: true, filled: true,
        updateTriggers: { getFillColor: [selectedStationId, rows] },
      }))
    }

    if (layers.risk) {
      result.push(new ScatterplotLayer({
        id: 'risk', data: placed.filter((row) => row.condition !== 'normal'), getPosition: (row) => coordsOf(row)!, getRadius: 1400,
        getFillColor: (row) => conditionColor(row, 36), getLineColor: (row) => conditionColor(row, 150), stroked: true, lineWidthUnits: 'pixels', getLineWidth: 1.2,
      }))
    }

    if (layers.links && layers.incidents) {
      const links = activeIncidents.flatMap((incident) => {
        const target = coordsOf(incident)
        if (!target) return []
        const homes = new Map<string, Station>()
        incident.assigned_unit_ids.forEach((id) => { const station = stationByUnit.get(id); if (station && coordsOf(station)) homes.set(station.station_id, station) })
        return Array.from(homes.values()).map((station) => ({ source: coordsOf(station)!, target, color: typeColor[incident.incident_type], selected: incident.incident_id === selectedIncidentId }))
      })
      result.push(new ArcLayer({
        id: 'response-links', data: links, getSourcePosition: (link) => link.source, getTargetPosition: (link) => link.target,
        getSourceColor: [cobalt[0], cobalt[1], cobalt[2], 150], getTargetColor: (link) => link.color, getWidth: (link) => (link.selected ? 3.5 : 2), widthUnits: 'pixels', getHeight: 0.45, numSegments: 64,
        updateTriggers: { getWidth: [selectedIncidentId] },
      }))
    }

    if (layers.columns && threeD) {
      // Sized for the county view; shrink as the camera closes in so a column never fills the screen.
      const scale = Math.min(1, 2 ** (11 - zoom))
      result.push(new ColumnLayer({
        id: 'readiness-columns', data: placed.filter((row) => row.assigned.length), getPosition: (row) => coordsOf(row)!, diskResolution: 6, radius: 620 * scale, elevationScale: scale, extruded: true, pickable: true,
        getElevation: (row) => row.assigned.length * 650, getFillColor: (row) => row.station_id === selectedStationId ? [cobalt[0], cobalt[1], cobalt[2], 235] : conditionColor(row, 205),
        material: { ambient: 0.55, diffuse: 0.6, shininess: 24 }, transitions: { getElevation: 600 },
        updateTriggers: { getFillColor: [selectedStationId] },
      }))
    }

    const selectedStation = placed.find((row) => row.station_id === selectedStationId)
    if (selectedStation) {
      const [lon, lat] = coordsOf(selectedStation)!
      result.push(new ScatterplotLayer({
        id: 'distance-rings', data: RINGS, getPosition: () => [lon, lat], getRadius: (miles: number) => miles * MILE,
        filled: false, stroked: true, getLineColor: [cobalt[0], cobalt[1], cobalt[2], 170], lineWidthUnits: 'pixels', getLineWidth: 1.2,
      }))
      result.push(new TextLayer({
        id: 'distance-ring-labels', data: RINGS, getPosition: (miles: number) => [lon, lat + (miles * MILE) / 111_320], getText: (miles: number) => `${miles} MI`,
        getSize: 11, getColor: [cobalt[0], cobalt[1], cobalt[2], 230], fontFamily: 'IBM Plex Mono, monospace', getPixelOffset: [0, -8], background: true, getBackgroundColor: [11, 13, 16, 200], backgroundPadding: [4, 2],
      }))
    }
    return result
  }, [rows, layers, threeD, zoom, activeIncidents, stationByUnit, selectedStationId, selectedIncidentId, county])

  useEffect(() => {
    if (!styleReady) return
    deckRef.current?.setProps({
      layers: deckLayers,
      getTooltip: ({ object, layer }) => {
        if (!object || layer?.id !== 'readiness-columns') return null
        const row = object as StationRow
        return { text: `${row.name}\n${row.assigned.length} units · ${row.score === null ? '—' : `${Math.round(row.score)}% ready`}`, style: { background: 'var(--navy-800)', color: 'var(--navy-ink)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '6px 8px', borderRadius: '3px', border: '1px solid var(--navy-line)' } }
      },
    })
  }, [styleReady, deckLayers])

  // Fly to the selection, keeping the county in context unless the view is tilted.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const target = selectedIncidentId ? incidents.find((incident) => incident.incident_id === selectedIncidentId) : selectedStationId ? stations.find((station) => station.station_id === selectedStationId) : undefined
    const center = target && coordsOf(target)
    if (!center) return
    const tilted = map.getPitch() > 10
    map.flyTo({ center, zoom: Math.max(map.getZoom(), tilted ? 14.2 : 11.4), duration: 1400, essential: false, padding: padding() })
  }, [ready, selectedStationId, selectedIncidentId, stations, incidents])

  const resetView = () => {
    const map = mapRef.current
    if (map && countyRef.current) map.fitBounds(countyBounds(countyRef.current), { padding: padding(), pitch: threeD ? 50 : 0, bearing: threeD ? -18 : 0, duration: 900 })
    onReset?.()
  }
  const toggle3D = () => {
    const map = mapRef.current
    if (!map) return
    const next = !threeD
    setThreeD(next)
    map.easeTo({ pitch: next ? 55 : 0, bearing: next ? -18 : 0, duration: 1100 })
  }

  const counts: Partial<Record<MapLayer, number>> = { stations: rows.length, incidents: incidents.length, risk: rows.filter((row) => row.condition !== 'normal').length, links: activeIncidents.reduce((sum, incident) => sum + incident.assigned_unit_ids.length, 0) }
  const order: MapLayer[] = mode === 'readiness' ? LAYER_ORDER : ['incidents', 'stations', ...LAYER_ORDER.filter((layer) => layer !== 'incidents' && layer !== 'stations')]
  const readout = cursor ?? center

  return (
    <section ref={stageRef} className={cn('ui-stage', styles.map, styles.geo, fill && styles.geoFill, className)} aria-label={title} data-map={mode} data-engine="webgl" style={{ ['--map-inset-right' as string]: `${insetRight}px` }}>
      <header className="ui-stage-header">
        <div><h2>{title}</h2><p>{scope !== 'all' ? 'Filtered to the selected station scope' : threeD ? '3D view · columns show assigned units per station' : 'County basemap with live station and incident layers'}</p></div>
        <div className={styles.layers} role="group" aria-label="Map layers">
          {order.slice(0, 3).map((layer) => <button key={layer} type="button" className="ui-stage-button" aria-pressed={layers[layer]} onClick={() => onToggleLayer(layer)}>{LAYER_LABEL[layer]}</button>)}
          <button type="button" className="ui-stage-button" aria-expanded={layersOpen} aria-controls="map-layer-panel" onClick={() => setLayersOpen((open) => !open)}><LayersIcon aria-hidden="true" />All layers</button>
        </div>
      </header>
      <div className={styles.canvas}>
        <div ref={containerRef} className={styles.geoCanvas} />
        {!styleReady && <div className={styles.geoLoading} aria-hidden="true" />}
        {layersOpen && (
          <div id="map-layer-panel" className={styles.layerPanel} role="group" aria-label="All map layers">
            <p className="ui-label">More layers</p>
            {/* The first three layers are toggled in the stage header; the panel lists the rest so every control has one name. */}
            {order.slice(3).map((layer) => (
              <button key={layer} type="button" aria-pressed={layers[layer]} onClick={() => onToggleLayer(layer)} title={LAYER_NOTE[layer]} aria-describedby={LAYER_NOTE[layer] ? `layer-note-${layer}` : undefined}>
                <i aria-hidden="true" data-layer={layer} />
                <span>{LAYER_LABEL[layer]}{LAYER_NOTE[layer] && <small id={`layer-note-${layer}`} className="sr-only">{LAYER_NOTE[layer]}</small>}</span>
                {counts[layer] !== undefined && <b aria-hidden="true">{counts[layer]}</b>}
              </button>
            ))}
          </div>
        )}
        {overlay}
        <div className={styles.tools}>
          <button type="button" className="ui-stage-button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()} disabled={zoom >= 17.4}><Plus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()} disabled={zoom <= 8.6}><Minus aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Reset map view" onClick={resetView}><Crosshair aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="3D view" aria-pressed={threeD} onClick={toggle3D}><Box aria-hidden="true" /></button>
          <button type="button" className="ui-stage-button" aria-label="Reset bearing to north" onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 600 })}><Compass aria-hidden="true" style={{ transform: `rotate(${-bearing - 45}deg)` }} /></button>
          <button type="button" className="ui-stage-button" aria-label="Focus map full screen" onClick={() => void stageRef.current?.requestFullscreen?.()}><Expand aria-hidden="true" /></button>
        </div>
        {readout && <p className={styles.readout} aria-hidden="true"><span>{formatLat(readout[1])}</span><span>{formatLon(readout[0])}</span><span>Z {zoom.toFixed(1)}</span></p>}
        {basemapOffline && <p className={styles.offline} role="status">Basemap unavailable · county outline only</p>}
      </div>
      <ul className={styles.legend} aria-label="Map legend">
        {mode === 'incidents'
          ? (['fire', 'ems', 'hazmat', 'other'] as const).map((type) => <li key={type}><i data-kind="incident" data-type={type} />{INCIDENT_TYPE_LABEL[type.toUpperCase() as Incident['incident_type']]}</li>)
          : <><li><i data-kind="station" data-condition="normal" />Station normal</li><li><i data-kind="station" data-condition="attention" />Staffing attention</li><li><i data-kind="station" data-condition="offline" />No active resources</li><li><i data-kind="incident" data-type="fire" />Active incident</li></>}
        {layers.links && <li><i data-kind="arc" />Response link</li>}
        {selectedStationId && <li><i data-kind="ring" />1 / 3 / 5 mi straight-line</li>}
        <li><i data-kind="boundary" />County boundary</li>
      </ul>
    </section>
  )
}
