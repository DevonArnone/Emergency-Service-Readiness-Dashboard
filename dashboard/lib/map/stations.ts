import type { Incident, Station, UnitReadiness } from '@/lib/schemas'

export type StationCondition = 'normal' | 'attention' | 'offline'
export type StationRow = Station & { assigned: UnitReadiness[]; score: number | null; condition: StationCondition }

/** Station readiness derived from its units in the current snapshot. */
export function stationRows(stations: Station[], units: UnitReadiness[]): StationRow[] {
  const readiness = new Map(units.map((unit) => [unit.unit_id, unit]))
  return stations.map((station) => {
    const assigned = station.unit_ids.map((id) => readiness.get(id)).filter((unit): unit is UnitReadiness => Boolean(unit))
    const score = assigned.length ? assigned.reduce((sum, unit) => sum + unit.readiness_score, 0) / assigned.length : null
    const attention = assigned.some((unit) => unit.is_understaffed || unit.readiness_score < 85)
    return { ...station, assigned, score, condition: assigned.length === 0 ? 'offline' : attention ? 'attention' : 'normal' }
  })
}

export const stationNumber = (station: Pick<Station, 'name' | 'station_id'>) => station.name.match(/Station (\d+)/)?.[1] || station.station_id.replace(/\D/g, '')
export const CONDITION_LABEL: Record<StationCondition, string> = { normal: 'Normal', attention: 'Staffing attention', offline: 'No active resources' }
export const INCIDENT_TYPE_LABEL: Record<Incident['incident_type'], string> = { FIRE: 'Fire', EMS: 'EMS', HAZMAT: 'HazMat', OTHER: 'Other' }

export type MapLayer = 'stations' | 'incidents' | 'risk' | 'links' | 'areas' | 'columns' | 'terrain' | 'buildings'

export const LAYER_LABEL: Record<MapLayer, string> = {
  stations: 'Stations',
  incidents: 'Incidents',
  risk: 'Risk layers',
  links: 'Response links',
  areas: 'Station areas',
  columns: 'Readiness columns',
  terrain: 'Terrain',
  buildings: 'Buildings',
}

export const LAYER_NOTE: Partial<Record<MapLayer, string>> = {
  risk: 'Stations with staffing or readiness attention',
  links: 'Assigned units from their home station',
  areas: 'Nearest station, straight-line',
  columns: 'Height is assigned units; shown in 3D',
  terrain: 'Hillshade relief',
  buildings: '3D footprints from zoom 14',
}

export function defaultLayers(mode: 'readiness' | 'incidents' | 'stations' = 'readiness'): Record<MapLayer, boolean> {
  return { stations: true, incidents: mode !== 'stations', risk: false, links: mode !== 'stations', areas: mode === 'stations', columns: true, terrain: true, buildings: true }
}
