'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ForecastInstrument } from '@/components/UtilityInstruments'
import {
  AlertTriangle,
  CloudSun,
  Compass,
  Database,
  Gauge,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react'
import { Button, ErrorState, LoadingState, PageHeader } from '@/components/ui'
import { api, queryKeys } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import styles from '../utility.module.css'

function formatClock(value?: string | null) {
  if (!value) return 'Not reported'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not reported'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
}

function severityLabel(value: string) {
  const severity = value.toLowerCase()
  if (severity === 'extreme' || severity === 'severe') return 'Critical'
  if (severity === 'moderate') return 'Attention'
  return 'Advisory'
}

export default function WeatherPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(0)
  const weather = useQuery({
    queryKey: queryKeys.weather,
    queryFn: api.weatherFairfax,
    refetchInterval: 10 * 60 * 1000,
  })

  const data = weather.data
  const current = data?.forecast_periods[0]
  const sourceTime = data?.source.source_updated_at || data?.source.retrieved_at
  const statusLabel = data?.status === 'unavailable' ? 'Unavailable' : data?.stale ? 'Stale report' : 'Current report'

  return (
    <div className="ops-page page-enter civic-workspace">
      <div className="ops-shell">
        <div className={styles.workspace}>
          <PageHeader
            eyebrow="Weather & hazards"
            title="Fairfax Weather Register"
            description="Official forecast and active hazard context for planning only. This register does not replace dispatch, public warning, or incident-command channels."
            actions={<Button type="button" onClick={() => weather.refetch()} busy={weather.isFetching}><RefreshCw className="size-4" aria-hidden="true" />Refresh report</Button>}
          />

          {weather.isError && <ErrorState message={weather.error.message} retry={() => weather.refetch()} />}

          {weather.isPending ? (
            <section className={styles.plate} aria-label="Loading Fairfax weather"><LoadingState rows={8} /></section>
          ) : data ? (
            <>
              <section className={`${styles.register} weather-register`} aria-label="Current weather readings">
                <div className={styles.registerCell}><span className={styles.registerLabel}><Thermometer className="size-4" aria-hidden="true" />Forecast temperature</span><strong className={styles.registerValue}>{current?.temperature == null ? '—' : `${Math.round(current.temperature)}°${current.temperature_unit || 'F'}`}</strong><span className={styles.registerDetail}>{current?.short_forecast || 'Current forecast not reported'}</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><Wind className="size-4" aria-hidden="true" />Wind</span><strong className={styles.registerValue}>{data.wind.speed || '—'}</strong><span className={styles.registerDetail}>{data.wind.direction ? `From ${data.wind.direction}` : 'Direction not reported'}</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><AlertTriangle className="size-4" aria-hidden="true" />Active alerts</span><strong className={styles.registerValue}>{data.active_alerts.length.toString().padStart(2, '0')}</strong><span className={styles.registerDetail}>{data.active_alerts.length ? 'Review hazard docket below' : 'No active NWS alerts returned'}</span></div>
                <div className={styles.registerCell}><span className={styles.registerLabel}><Gauge className="size-4" aria-hidden="true" />Report state</span><strong className={styles.registerValue}>{statusLabel}</strong><span className={styles.registerDetail}>As of {formatClock(sourceTime)}</span></div>
              </section>

              <ForecastInstrument data={data} selectedIndex={selectedPeriod < data.forecast_periods.length ? selectedPeriod : 0} onSelect={setSelectedPeriod} />

              <div className={styles.grid}>
                <section className={styles.plate} aria-labelledby="forecast-heading">
                  <header className={styles.plateHeader}><div><h2 id="forecast-heading">Forecast ledger</h2><p>National Weather Service periods for Fairfax County</p></div><span className={styles.plateLabel}>{data.forecast_periods.length} periods</span></header>
                  {data.forecast_periods.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Scrollable forecast register"><table className={styles.table}><thead><tr><th scope="col">Period</th><th scope="col">Condition</th><th scope="col">Temp.</th><th scope="col">Wind</th></tr></thead><tbody>{data.forecast_periods.map((period) => <tr key={`${period.start_time}-${period.number}`}><td><strong>{period.name || 'Forecast period'}</strong><small className={styles.time}>{period.start_time ? formatDate(period.start_time, 'EEE, MMM d · h:mm a') : 'Time not reported'}</small></td><td><span className={styles.condition}><CloudSun className="size-4" aria-hidden="true" /><strong>{period.short_forecast || 'Forecast unavailable'}</strong></span><small>{period.detailed_forecast || 'No detailed narrative returned.'}</small></td><td><span className={styles.temperature}>{period.temperature == null ? '—' : `${Math.round(period.temperature)}°${period.temperature_unit || 'F'}`}</span></td><td><strong>{period.wind_speed || 'Not reported'}</strong><small><Compass className="mr-1 inline size-3" aria-hidden="true" />{period.wind_direction || 'Direction unavailable'}</small></td></tr>)}</tbody></table></div> : <p className={styles.emptyRow}>No forecast periods were returned. Refresh the register or use the linked public weather source.</p>}
                </section>

                <div className={styles.stack}>
                  <section className={styles.plate} aria-labelledby="hazards-heading">
                    <header className={styles.plateHeader}><div><h2 id="hazards-heading">Hazard docket</h2><p>Active public weather alerts</p></div><span className={styles.plateLabel}>{data.active_alerts.length ? 'Review' : 'Clear'}</span></header>
                    {data.active_alerts.length ? <div className={styles.noticeList}>{data.active_alerts.map((alert, index) => <article className={styles.notice} key={alert.id || `${alert.event}-${index}`}><div className={styles.noticeMeta}><span className={styles.noticeLabel} data-severity={(alert.severity || 'unknown').toLowerCase()}>{severityLabel(alert.severity || 'unknown')}</span><time className={styles.time} dateTime={alert.onset || undefined}>{formatClock(alert.onset)}</time></div><div><h3>{alert.event || 'Weather alert'}</h3><p>{alert.headline || alert.description || 'No public alert narrative returned.'}</p>{alert.ends && <p>Expires {formatClock(alert.ends)}</p>}</div></article>)}</div> : <p className={styles.emptyRow}>No active alerts were returned for the Fairfax County forecast area.</p>}
                  </section>

                  <section className={styles.plate} aria-labelledby="source-heading">
                    <header className={styles.plateHeader}><div><h2 id="source-heading">Source & limitations</h2><p>Planning context and report provenance</p></div><Database className="size-4" aria-hidden="true" /></header>
                    <dl className={styles.ledger}><div className={styles.ledgerRow}><dt>Source</dt><dd><a href={data.source.url} target="_blank" rel="noreferrer">{data.source.name}</a></dd></div><div className={styles.ledgerRow}><dt>Source time</dt><dd>{formatClock(sourceTime)}</dd></div><div className={styles.ledgerRow}><dt>Freshness</dt><dd><span className={styles.sourceLine}>{data.stale ? <AlertTriangle className="size-4" aria-hidden="true" /> : <Gauge className="size-4" aria-hidden="true" />}{statusLabel}</span></dd></div><div className={styles.ledgerRow}><dt>Operational use</dt><dd>Situational planning only. Confirm severe weather through official warning and command channels.</dd></div></dl>
                  </section>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
