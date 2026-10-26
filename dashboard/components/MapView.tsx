'use client'

import dynamic from 'next/dynamic'
import { Component, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { GeoMapProps } from './GeoMap'
import styles from './map.module.css'

function MapPlaceholder({ fill }: { fill?: boolean }) {
  return <section className={cn('ui-stage', styles.map, styles.geo, fill && styles.geoFill)} aria-hidden="true"><div className={styles.canvas}><div className={styles.geoLoading} /></div></section>
}

const GeoMap = dynamic(() => import('./GeoMap'), { ssr: false, loading: () => <MapPlaceholder /> })
// The SVG map carries a large geometry asset, so it loads only when WebGL cannot run.
const CountyMap = dynamic(() => import('./CountyMap'), { ssr: false, loading: () => <MapPlaceholder /> })

class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** The WebGL county map, falling back to the offline SVG map when WebGL or the map engine is unavailable. */
export default function MapView(props: Omit<GeoMapProps, 'onUnavailable'>) {
  const [unavailable, setUnavailable] = useState(false)
  const svg = <CountyMap {...props} />
  if (unavailable) return svg
  return <MapBoundary fallback={svg}><GeoMap {...props} onUnavailable={() => setUnavailable(true)} /></MapBoundary>
}
