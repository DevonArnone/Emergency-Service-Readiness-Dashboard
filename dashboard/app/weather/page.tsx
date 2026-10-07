'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorState, LoadingState, PageHeader, Panel, StatusBadge, SummaryStrip, type StatusTone } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import styles from '../utility.module.css'

function formatClock(value?: string | null) {
  if (!value) return 'Not reported'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not reported'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
}

function severity(value: string): { label: string; tone: StatusTone } {
  const level = value.toLowerCase()
  if (level === 'extreme' || level === 'severe') return { label: 'Critical', tone: 'danger' }
  if (level === 'moderate') return { label: 'Attention', tone: 'warning' }
  return { label: 'Advisory', tone: 'info' }
}

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export default function WeatherPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const weather = useQuery({ queryKey: queryKeys.weather, queryFn: api.weatherFairfax, refetchInterval: 10 * 60 * 1000 })

  const data = weather.data
  const periods = data?.forecast_periods || []
  const selectedIndex = selectedPeriod < periods.length ? selectedPeriod : 0
  const selected = periods[selectedIndex]
  const current = periods[0]
  const sourceTime = data?.source.source_updated_at || data?.source.retrieved_at
  const statusLabel = data?.status === 'unavailable' ? 'Unavailable' : data?.stale ? 'Stale report' : 'Current report'
  const values = periods.map(period => period.temperature).filter((value): value is number => typeof value === 'number')
  const minimum = Math.min(...values) - 5, maximum = Math.max(...values) + 5
  const x = (index: number) => 48 + index / Math.max(1, periods.length - 1) * 804
  const y = (temperature: number) => 170 - (temperature - minimum) / Math.max(1, maximum - minimum) * 136
  const direction = DIRECTIONS.indexOf((selected?.wind_direction || '').toUpperCase())

  return (
    <div className="ui-page" data-view="weather">
      <PageHeader title="Weather" description="Official National Weather Service forecast and active hazards for Fairfax County. Planning context only; it does not replace dispatch, public warning, or incident-command channels." actions={<Button onClick={() => weather.refetch()} busy={weather.isFetching}><RefreshCw aria-hidden="true" />Refresh report</Button>} />
      {weather.isError && <ErrorState message={weather.error.message} retry={() => weather.refetch()} />}

      {weather.isPending ? <Panel flush><LoadingState rows={8} label="Loading Fairfax weather" /></Panel> : data ? <>
        {(data.stale || data.status === 'unavailable') && (
          <div className="ui-notice" data-tone={data.status === 'unavailable' ? 'danger' : 'info'} role="status"><AlertTriangle aria-hidden="true" /><span>{data.status === 'unavailable' ? 'The weather source is unavailable. No forecast readings are shown; use the official source below.' : `Showing a stale cached report from ${formatClock(sourceTime)}. Refresh, or confirm conditions with the official source.`}{data.message ? ` ${data.message}` : ''}</span></div>
        )}
        <SummaryStrip label="Current weather readings" items={[
          { label: 'Forecast temperature', value: current?.temperature == null ? '—' : `${Math.round(current.temperature)}°${current.temperature_unit || 'F'}`, detail: current?.short_forecast || 'not reported' },
          { label: 'Wind', value: data.wind.speed || '—', detail: data.wind.direction ? `from ${data.wind.direction}` : 'direction not reported' },
          { label: 'Active alerts', value: data.active_alerts.length, detail: data.active_alerts.length ? 'review below' : 'none returned', tone: data.active_alerts.length ? 'bad' : undefined },
          { label: 'Report state', value: statusLabel, detail: `as of ${formatClock(sourceTime)}`, tone: data.status === 'unavailable' ? 'bad' : data.stale ? 'warn' : undefined },
        ]} />

        <div className={styles.lead}>
          <Panel title="Selected forecast" description="Forecast for the chosen period, not observed weather">
            <div className={styles.selection} data-ui="forecast-selection" aria-live="polite">
              <div className={styles.selectionHead}>
                <div><h3>{selected?.name || 'No forecast periods'}</h3><p>{selected?.short_forecast || 'Forecast not reported'}</p></div>
                <strong className="ui-num">{selected?.temperature == null ? '—' : `${Math.round(selected.temperature)}°${selected.temperature_unit || 'F'}`}</strong>
              </div>
              <p className={styles.narrative}>{selected?.detailed_forecast || 'A detailed forecast was not returned.'}</p>
              <div className={styles.wind} data-ui="wind">
                <svg viewBox="0 0 100 100" role="img" aria-label={direction < 0 ? 'Wind direction not reported' : `Wind from ${selected?.wind_direction}`}>
                  <circle cx="50" cy="50" r="36" fill="none" stroke="var(--rule-strong)" strokeWidth="1.5" />
                  {[0, 90, 180, 270].map(angle => <line key={angle} x1="50" y1="14" x2="50" y2="20" stroke="var(--ink-3)" strokeWidth="1.5" transform={`rotate(${angle} 50 50)`} />)}
                  <text x="50" y="10" textAnchor="middle" fontSize="9" fill="var(--ink-2)">N</text>
                  {direction >= 0 && <path d="M50 22 L43 42 L50 38 L57 42 Z M50 38 L50 76" transform={`rotate(${direction * 22.5} 50 50)`} fill="var(--cobalt)" stroke="var(--cobalt)" strokeWidth="2.4" strokeLinejoin="round" />}
                </svg>
                <dl className="ui-facts">
                  <div><dt>Wind</dt><dd>{selected?.wind_speed || '—'}</dd></div>
                  <div><dt>Direction</dt><dd>Wind from {selected?.wind_direction || 'unreported'}</dd></div>
                  <div><dt>Precipitation</dt><dd>{selected?.probability_of_precipitation == null ? 'Not reported' : `${selected.probability_of_precipitation}% probability`}</dd></div>
                  <div><dt>Period starts</dt><dd>{formatDate(selected?.start_time, 'MMM d · HH:mm')}</dd></div>
                </dl>
              </div>
            </div>
          </Panel>

          <Panel title="Active alerts" description="Public weather alerts for the forecast area" action={<StatusBadge tone={data.active_alerts.length ? 'danger' : 'success'}>{data.active_alerts.length ? 'Review' : 'Clear'}</StatusBadge>} flush>
            {data.active_alerts.length ? (
              <ul className={styles.hazards}>
                {data.active_alerts.map((alert, index) => { const level = severity(alert.severity || 'unknown'); return (
                  <li key={alert.id || `${alert.event}-${index}`}>
                    <div><StatusBadge tone={level.tone}>{level.label}</StatusBadge><time className="ui-mono" dateTime={alert.onset || undefined}>{formatClock(alert.onset)}</time></div>
                    <h3>{alert.event || 'Weather alert'}</h3>
                    <p>{alert.headline || alert.description || 'No public alert narrative returned.'}</p>
                    {alert.ends && <p>Expires {formatClock(alert.ends)}</p>}
                  </li>
                ) })}
              </ul>
            ) : <p className="ui-empty-inline">No active alerts were returned for the Fairfax County forecast area.</p>}
          </Panel>
        </div>

        <section className={cn('ui-stage', styles.forecast)} aria-labelledby="temperature-heading" data-ui="forecast">
          <header className="ui-stage-header"><div><h2 id="temperature-heading">Temperature by forecast period</h2><p>NWS period forecast · {data.stale ? 'stale cached report' : data.status === 'unavailable' ? 'unavailable' : 'current report'} · no interpolation between missing readings</p></div></header>
          {values.length ? (
            <div className={styles.plot} tabIndex={0} role="region" aria-label="Temperature plot">
              <svg viewBox="0 0 900 204" role="img" aria-label={`Forecast temperatures by NWS period, from ${Math.min(...values)} to ${Math.max(...values)} degrees`}>
                {[0, 1, 2, 3, 4].map(tick => { const value = minimum + (maximum - minimum) * tick / 4; return <g key={tick}><line x1="48" x2="852" y1={y(value)} y2={y(value)} stroke="#223a63" strokeWidth="1" /><text x="8" y={y(value) + 4} className={styles.axis}>{Math.round(value)}°</text></g> })}
                {periods.slice(1).map((period, index) => period.temperature != null && periods[index].temperature != null && <line key={index} x1={x(index)} y1={y(periods[index].temperature!)} x2={x(index + 1)} y2={y(period.temperature)} stroke="#78a2ff" strokeWidth="2.4" strokeLinecap="round" />)}
                {periods.map((period, index) => period.temperature != null && <g key={index}>{index === selectedIndex && <line x1={x(index)} x2={x(index)} y1="26" y2="172" stroke="#fff" strokeDasharray="3 4" />}<circle cx={x(index)} cy={y(period.temperature)} r={index === selectedIndex ? 6.5 : 3.5} fill={index === selectedIndex ? '#fff' : '#78a2ff'} stroke="#081426" strokeWidth="2" /><text x={x(index)} y="194" textAnchor="middle" className={styles.axis}>{index + 1}</text></g>)}
              </svg>
            </div>
          ) : <p className="ui-empty-inline">Temperature readings unavailable. Use the official source or refresh the report.</p>}
          <div className={styles.periods} data-ui="forecast-periods" role="group" aria-label="Forecast periods" tabIndex={-1}>
            {periods.map((period, index) => <button type="button" key={index} aria-pressed={index === selectedIndex} onClick={() => setSelectedPeriod(index)}><span>{index + 1}. {period.name || 'Period'}</span><strong className="ui-num">{period.temperature == null ? '—' : `${period.temperature}°${period.temperature_unit || 'F'}`}</strong><small>{period.short_forecast || 'Not reported'}</small></button>)}
          </div>
        </section>

        <details className="ui-disclosure">
          <summary>Forecast ledger · {periods.length} periods<ChevronDown className="ui-chevron" aria-hidden="true" /></summary>
          <Panel flush className={styles.ledgerPanel}>
            {periods.length ? (
              <div className="ui-table-wrap" tabIndex={0} role="region" aria-label="Forecast ledger">
                <table className="ui-table">
                  <thead><tr><th scope="col">Period</th><th scope="col">Condition</th><th scope="col" className="ui-num">Temp.</th><th scope="col">Wind</th></tr></thead>
                  <tbody>{periods.map((period) => <tr key={`${period.start_time}-${period.number}`}><th scope="row">{period.name || 'Forecast period'}<small>{period.start_time ? formatDate(period.start_time, 'EEE, MMM d · h:mm a') : 'Time not reported'}</small></th><td>{period.short_forecast || 'Forecast unavailable'}<small>{period.detailed_forecast || 'No detailed narrative returned.'}</small></td><td className="ui-num">{period.temperature == null ? '—' : `${Math.round(period.temperature)}°${period.temperature_unit || 'F'}`}</td><td>{period.wind_speed || 'Not reported'}<small>{period.wind_direction || 'Direction unavailable'}</small></td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="ui-empty-inline">No forecast periods were returned. Refresh the report or use the linked public weather source.</p>}
          </Panel>
        </details>

        <Panel title="Source and limitations" description="Where this report comes from and how it may be used">
          <dl className="ui-facts ui-facts-rows">
            <div><dt>Source</dt><dd><a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a></dd></div>
            <div><dt>Source time</dt><dd>{formatClock(sourceTime)}</dd></div>
            <div><dt>Freshness</dt><dd>{statusLabel}</dd></div>
            <div><dt>Operational use</dt><dd>Situational planning only. Confirm severe weather through official warning and command channels.</dd></div>
          </dl>
        </Panel>
      </> : null}
    </div>
  )
}
