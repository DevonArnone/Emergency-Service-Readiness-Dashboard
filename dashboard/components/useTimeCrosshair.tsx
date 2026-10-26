'use client'

import { useState, type PointerEvent } from 'react'
import styles from './crosshair.module.css'

const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * A hover crosshair with a time readout for a timeline canvas. The track geometry is measured from the first
 * element matching `trackSelector`, so label columns of any width are handled. Spread `handlers` on the canvas
 * (which must be position: relative) and render `crosshair` inside it.
 */
export function useTimeCrosshair(start: number, end: number, trackSelector: string) {
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const canvas = event.currentTarget.getBoundingClientRect()
    const track = event.currentTarget.querySelector(trackSelector)?.getBoundingClientRect()
    if (!track) return
    const ratio = (event.clientX - track.left) / track.width
    if (ratio < 0 || ratio > 1) { setHover(null); return }
    setHover({ x: event.clientX - canvas.left, time: start + ratio * (end - start) })
  }
  return {
    handlers: { onPointerMove, onPointerLeave: () => setHover(null) },
    crosshair: hover && <div className={styles.crosshair} style={{ left: hover.x }} aria-hidden="true"><b>{clock(hover.time)}</b></div>,
  }
}
