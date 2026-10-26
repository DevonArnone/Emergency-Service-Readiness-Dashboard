import type { StyleSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'

/** OpenFreeMap vector tiles (OpenMapTiles schema, OpenStreetMap data). Free, no key. */
export const TILE_SOURCE = 'https://tiles.openfreemap.org/planet'
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
/** AWS Terrain Tiles (Terrarium encoding), used for hillshade relief. */
export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
export const BASEMAP_SOURCE = 'openmaptiles'

const TOKENS = ['bg', 'land', 'landuse', 'park', 'water', 'stream', 'road-local', 'road-collector', 'road-arterial', 'road-major', 'road-freeway', 'building', 'boundary', 'mask', 'label', 'label-halo', 'context'] as const
export type MapPalette = Record<(typeof TOKENS)[number], string>

/** The map is drawn on the stage, so it reads the same --map-* tokens the SVG fallback uses. */
export function readPalette(): MapPalette {
  const css = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKENS.map((token) => [token, css.getPropertyValue(`--map-${token}`).trim() || '#000'])) as MapPalette
}

export type CountyCollection = FeatureCollection<Polygon | MultiPolygon>

/** The county's outer ring: the largest exterior ring across its polygons. */
export function countyOuterRing(county: CountyCollection): Position[] {
  const geometry = county.features[0].geometry
  const exteriors = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0])
  return exteriors.reduce((largest, ring) => (ring.length > largest.length ? ring : largest))
}

export function countyBounds(county: CountyCollection): [[number, number], [number, number]] {
  const ring = countyOuterRing(county)
  const lons = ring.map(([lon]) => lon), lats = ring.map(([, lat]) => lat)
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]]
}

/** Everything outside the county, so the area of interest stays bright and the surroundings recede. */
function outsideMask(county: CountyCollection): Feature<Polygon> {
  const world: Position[] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, [...countyOuterRing(county)].reverse()] } }
}

const lineWidth = (stops: [number, number][]) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()] as unknown as number

export function buildStyle(palette: MapPalette, county: CountyCollection, options: { buildings: boolean; terrain: boolean }): StyleSpecification {
  const road = (id: string, classes: string[], color: string, stops: [number, number][], minzoom = 0) => ({
    id, type: 'line' as const, source: BASEMAP_SOURCE, 'source-layer': 'transportation', minzoom,
    filter: ['in', ['get', 'class'], ['literal', classes]] as unknown as boolean,
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
    paint: { 'line-color': color, 'line-width': lineWidth(stops), 'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1] as unknown as number },
  })

  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      [BASEMAP_SOURCE]: { type: 'vector', url: TILE_SOURCE },
      terrain: { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>' },
      county: { type: 'geojson', data: county, attribution: 'Boundary: Fairfax County GIS' },
      mask: { type: 'geojson', data: outsideMask(county) },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': palette.bg } },
      // The county reads even when basemap tiles are unavailable.
      { id: 'county-land', type: 'fill', source: 'county', paint: { 'fill-color': palette.land } },
      { id: 'landuse', type: 'fill', source: BASEMAP_SOURCE, 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]], paint: { 'fill-color': palette.landuse, 'fill-opacity': 0.7 } },
      { id: 'landcover', type: 'fill', source: BASEMAP_SOURCE, 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland', 'wetland']]], paint: { 'fill-color': palette.park, 'fill-opacity': 0.55 } },
      { id: 'park', type: 'fill', source: BASEMAP_SOURCE, 'source-layer': 'park', paint: { 'fill-color': palette.park, 'fill-opacity': 0.8 } },
      { id: 'hillshade', type: 'hillshade', source: 'terrain', layout: { visibility: options.terrain ? 'visible' : 'none' }, paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': 'rgba(0, 0, 0, 0.55)', 'hillshade-highlight-color': 'rgba(255, 255, 255, 0.05)', 'hillshade-accent-color': 'rgba(0, 0, 0, 0.3)' } },
      { id: 'water', type: 'fill', source: BASEMAP_SOURCE, 'source-layer': 'water', paint: { 'fill-color': palette.water } },
      { id: 'waterway', type: 'line', source: BASEMAP_SOURCE, 'source-layer': 'waterway', paint: { 'line-color': palette.stream, 'line-opacity': 0.45, 'line-width': lineWidth([[10, 0.4], [16, 2]]) } },
      road('road-minor', ['minor', 'service'], palette['road-local'], [[11, 0.3], [16, 3]], 11),
      road('road-tertiary', ['tertiary'], palette['road-collector'], [[9, 0.4], [16, 4]], 9),
      road('road-secondary', ['primary', 'secondary'], palette['road-arterial'], [[8, 0.6], [16, 6]]),
      road('road-highway', ['motorway', 'trunk'], palette['road-freeway'], [[7, 0.8], [16, 8]]),
      {
        id: 'buildings', type: 'fill-extrusion', source: BASEMAP_SOURCE, 'source-layer': 'building', minzoom: 13,
        layout: { visibility: options.buildings ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': palette.building,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.88,
        },
      },
      { id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': palette.mask } },
      { id: 'county-glow', type: 'line', source: 'county', paint: { 'line-color': palette.boundary, 'line-width': 9, 'line-blur': 9, 'line-opacity': 0.28 } },
      { id: 'county-line', type: 'line', source: 'county', paint: { 'line-color': palette.boundary, 'line-width': 1.4, 'line-opacity': 0.9 } },
      {
        id: 'place-labels', type: 'symbol', source: BASEMAP_SOURCE, 'source-layer': 'place', minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] as unknown as string,
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 13] as unknown as number,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.12,
          'text-max-width': 8,
        },
        paint: { 'text-color': palette.label, 'text-opacity': 0.62, 'text-halo-color': palette['label-halo'], 'text-halo-width': 1.4 },
      },
    ],
  }
}
