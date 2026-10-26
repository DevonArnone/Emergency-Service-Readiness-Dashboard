// Copies MapLibre's self-contained worker module into public/ so both bundlers (Turbopack in dev, webpack in build)
// serve it at a stable URL. The map passes this URL to setWorkerUrl. Runs from predev and prebuild.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const source = resolve(dirname(require.resolve('maplibre-gl/package.json')), 'dist/maplibre-gl-worker.mjs')
const target = resolve(import.meta.dirname, '../public/vendor/maplibre-gl-worker.mjs')
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
