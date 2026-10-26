'use client'

import { X } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import styles from './scrubber.module.css'

export type ActivityEvent = { at: number; kind: 'incident' | 'alert' }
export type TimeWindow = [number, number]

const HOUR = 3_600_000
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * A 24-hour activity histogram (30-minute bins) with a "now" playhead. Drag across it to choose a window;
 * the caller filters the map and queue to that window. Arrow keys move a window, Shift+arrows resize it, Escape clears.
 */
export default function TimeScrubber({ events, now, value, onChange, hours = 24, className }: { events: ActivityEvent[]; now: number; value: TimeWindow | null; onChange: (value: TimeWindow | null) => void; hours?: number; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const binMs = HOUR / 2
  const end = Math.ceil(now / binMs) * binMs
  const start = end - hours * HOUR
  const binCount = (hours * HOUR) / binMs

  const bins = useMemo(() => {
    const result = Array.from({ length: binCount }, () => ({ incident: 0, alert: 0 }))
    for (const event of events) {
      const index = Math.floor((event.at - start) / binMs)
      if (index >= 0 && index < binCount) result[index][event.kind] += 1
    }
    return result
  }, [events, start, binMs, binCount])
  const peak = Math.max(1, ...bins.map((bin) => bin.incident + bin.alert))
  const pct = (ms: number) => ((ms - start) / (end - start)) * 100
  const snap = (ms: number) => Math.round(ms / binMs) * binMs
  const at = (clientX: number) => {
    const box = trackRef.current!.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    return start + ratio * (end - start)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const t = at(event.clientX)
    setDrag({ from: t, to: t })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => { if (drag) setDrag({ ...drag, to: at(event.clientX) }) }
  const onPointerUp = () => {
    if (!drag) return
    const lo = snap(Math.min(drag.from, drag.to)), hi = snap(Math.max(drag.from, drag.to))
    setDrag(null)
    // A click without a drag clears; anything shorter than one bin snaps to one bin around the click.
    if (Math.abs(drag.to - drag.from) < (end - start) / 200) { onChange(null); return }
    onChange([lo, Math.max(hi, lo + binMs)])
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { onChange(null); return }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.key === 'ArrowLeft' ? -binMs : binMs
    const current = value ?? [end - 2 * HOUR, end]
    const next: TimeWindow = event.shiftKey ? [current[0], Math.max(current[0] + binMs, current[1] + step)] : [current[0] + step, current[1] + step]
    if (next[0] < start || next[1] > end) return
    onChange(next)
  }

  const shown = drag ? [Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)] : value
  const inWindow = value ? events.filter((event) => event.at >= value[0] && event.at < value[1]) : events
  const ticks = Array.from({ length: hours / 3 + 1 }, (_, index) => start + index * 3 * HOUR)

  return (
    <section className={cn('ui-stage', styles.scrubber, className)} aria-labelledby="activity-heading" data-ui="time-scrubber">
      <header className={styles.head}>
        <h2 id="activity-heading" className="ui-label">Activity · last {hours} h</h2>
        <ul className={styles.key} aria-label="Histogram key"><li><i data-kind="incident" />Incidents opened</li><li><i data-kind="alert" />Alerts raised</li></ul>
        <span className={styles.spacer} />
        {value
          ? <span className={styles.chip} data-ui="time-window"><span className="ui-mono">{clock(value[0])}–{clock(value[1])}</span> · {inWindow.length} events<button type="button" aria-label="Clear time window" onClick={() => onChange(null)}><X aria-hidden="true" /></button></span>
          : <span className={styles.hint}>Drag across the histogram to filter the map and queue</span>}
      </header>
      <div
        ref={trackRef} className={styles.track} tabIndex={0} role="group" data-ui="time-track"
        aria-label={`Activity histogram, ${events.length} events in the last ${hours} hours. ${value ? `Window ${clock(value[0])} to ${clock(value[1])}.` : 'No window selected.'} Arrow keys move a window, Shift and arrows resize it, Escape clears.`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)} onKeyDown={onKeyDown}
      >
        <div className={styles.bars} aria-hidden="true">
          {bins.map((bin, index) => {
            const t = start + index * binMs
            const dim = shown && (t + binMs <= shown[0] || t >= shown[1])
            return (
              <span key={index} data-dim={dim || undefined}>
                <i data-kind="alert" style={{ height: `${(bin.alert / peak) * 100}%` }} />
                <i data-kind="incident" style={{ height: `${(bin.incident / peak) * 100}%` }} />
              </span>
            )
          })}
        </div>
        {shown && <div className={styles.window} style={{ left: `${pct(shown[0])}%`, width: `${pct(shown[1]) - pct(shown[0])}%` }} aria-hidden="true" />}
        <div className={styles.playhead} style={{ left: `${pct(now)}%` }} aria-hidden="true"><b>Now</b></div>
        <div className={styles.axis} aria-hidden="true">{ticks.map((tick, index) => <span key={tick} style={{ left: `${pct(tick)}%` }} data-edge={index === 0 ? 'start' : index === ticks.length - 1 ? 'end' : undefined}>{clock(tick).replace(':', '')}</span>)}</div>
      </div>
    </section>
  )
}
