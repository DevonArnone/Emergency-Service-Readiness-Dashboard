'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Award,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudSun,
  FileBarChart,
  FlaskConical,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Siren,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, queryKeys } from '@/lib/api'
import { OIDC_ENABLED, signOut } from '@/lib/auth'
import { incidentRef } from '@/lib/history'
import { useAccess } from '@/hooks/useAccess'
import { useOperationsStream } from '@/hooks/useOperationsStream'
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod'
import { cn, formatRelativeTime } from '@/lib/utils'
import { ConfirmDialog } from './ConfirmAction'
import { useStationScope } from './ScopeContext'
import { StatusBadge } from './ui'
import styles from './shell.module.css'

type Destination = { id: string; name: string; href: string; icon: LucideIcon }

const groups: Array<{ label: string; items: Destination[] }> = [
  { label: 'Operations', items: [
    { id: 'overview', name: 'County overview', href: '/', icon: LayoutDashboard },
    { id: 'incidents', name: 'Incidents', href: '/readiness?view=incidents', icon: Siren },
    { id: 'units', name: 'Units', href: '/readiness?view=units', icon: Truck },
    { id: 'alerts', name: 'Alerts', href: '/readiness?view=alerts', icon: Bell },
    { id: 'stations', name: 'Stations', href: '/?layer=stations', icon: Building2 },
    { id: 'resources', name: 'Resource status', href: '/?panel=resources#resource-posture', icon: LifeBuoy },
  ] },
  { label: 'Workforce', items: [
    { id: 'personnel', name: 'Personnel', href: '/personnel', icon: Users },
    { id: 'scheduling', name: 'Scheduling', href: '/shifts', icon: CalendarClock },
    { id: 'credentials', name: 'Credentials', href: '/certifications-management', icon: Award },
  ] },
  { label: 'Intelligence', items: [
    { id: 'analytics', name: 'Analytics', href: '/analytics', icon: FileBarChart },
    { id: 'plans', name: 'Plans & Hazards', href: '/readiness?view=simulation', icon: FlaskConical },
    { id: 'weather', name: 'Weather', href: '/weather', icon: CloudSun },
  ] },
  { label: 'Administration', items: [
    { id: 'admin', name: 'Admin', href: '/admin', icon: Settings },
  ] },
]
const destinations = groups.flatMap((group) => group.items)

function activeDestination(pathname: string, params: URLSearchParams) {
  if (pathname === '/') return params.get('panel') === 'resources' ? 'resources' : params.get('layer') === 'stations' ? 'stations' : 'overview'
  if (pathname === '/readiness') {
    const view = params.get('view')
    return view === 'simulation' ? 'plans' : view === 'incidents' ? 'incidents' : view === 'alerts' ? 'alerts' : 'units'
  }
  return destinations.find((item) => item.href.split(/[?#]/)[0] === pathname)?.id
}

function syncClock(value?: string | null) {
  if (!value) return '--:--:--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const stationShort = (name: string) => name.replace(/^Station (\d+) — /, '$1 · ')

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { stationId, setStationId } = useStationScope()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const streamState = useOperationsStream()
  const session = useAccess()
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const snapshot = useQuery({
    queryKey: queryKeys.shellOperations(stationId),
    queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId),
  })

  useEffect(() => {
    const openCommandMenu = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', openCommandMenu)
    return () => window.removeEventListener('keydown', openCommandMenu)
  }, [])

  const term = commandQuery.trim().toLowerCase()
  const results = useMemo(() => {
    const navigation = destinations.filter((item) => item.name.toLowerCase().includes(term))
    if (!term) return { navigation, stations: [], units: [], incidents: [] }
    return {
      navigation,
      stations: (stations.data || []).filter((station) => `${station.name} ${station.address || ''} ${station.district || ''}`.toLowerCase().includes(term)).slice(0, 6),
      units: (snapshot.data?.units || []).filter((unit) => `${unit.unit_name} ${unit.unit_type}`.toLowerCase().includes(term)).slice(0, 6),
      incidents: (snapshot.data?.incidents || []).filter((incident) => `${incidentRef(incident)} ${incident.title} ${incident.display_location || ''} ${incident.incident_type}`.toLowerCase().includes(term)).slice(0, 6),
    }
  }, [term, stations.data, snapshot.data])

  const openAlerts = snapshot.data?.alerts.filter((alert) => alert.state === 'OPEN') || []
  const serviceLive = !snapshot.isError && streamState === 'live'
  const connectionLabel = snapshot.isError ? 'Operations offline' : serviceLive ? 'Operations connected' : 'Operations syncing'
  const activeId = activeDestination(pathname, params)
  const currentPage = destinations.find((item) => item.id === activeId)
  const [now] = useState(() => Date.now())
  const period = useOperationalPeriod(snapshot.data ? new Date(snapshot.data.timestamp).getTime() : now)
  const identity = session.data?.display_name || (session.data?.can_write ? 'Duty officer' : 'Public observer')

  const navigate = (href: string) => {
    router.push(href)
    setCommandOpen(false)
    setCommandQuery('')
    setMobileMenuOpen(false)
  }

  const moveResultFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = Array.from(resultsRef.current?.querySelectorAll<HTMLElement>('[data-command-item]') || [])
    if (!items.length) return
    event.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : index <= 0 ? items.length - 1 : index - 1
    items[next].focus()
  }

  const navList = (onNavigate?: () => void) => groups.map((group) => (
    <div key={group.label} className={styles.navGroup}>
      <h2>{group.label}</h2>
      <ul>
        {group.items.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <Link href={item.href} onClick={onNavigate} className={cn(styles.navItem, active && styles.navItemActive)} aria-current={active ? 'page' : undefined}>
                <Icon aria-hidden="true" /><span>{item.name}</span>
                {item.id === 'alerts' && openAlerts.length > 0 && <b className={styles.navCount} aria-label={`${openAlerts.length} open`}>{openAlerts.length}</b>}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  ))

  const brand = (
    <div className={styles.brand}>
      <Image src="/brand/aegis-command-seal-v2.png" alt="Unofficial Aegis Fairfax County Fire and Rescue concept seal" width={30} height={44} priority />
      <div><Link href="/" aria-label="Aegis Command county overview">Aegis Command</Link><span>Fairfax County Fire and Rescue</span></div>
    </div>
  )
  const provenance = <p className={styles.provenance}>Unofficial concept · Synthetic operations<br />Not for dispatch</p>

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} data-shell="rail">
        {brand}
        <nav className={styles.nav} aria-label="Primary navigation">{navList()}</nav>
        {provenance}
      </aside>

      <header className={styles.topbar}>
        <button ref={mobileMenuTriggerRef} className={styles.menuTrigger} type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation" aria-haspopup="dialog"><Menu aria-hidden="true" /></button>
        <label className={styles.scope}>
          <Building2 aria-hidden="true" /><span>Scope</span>
          <select value={stationId} onChange={(event) => setStationId(event.target.value)} aria-label="Station scope">
            <option value="all">All stations</option>
            {stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{stationShort(station.name)}</option>)}
          </select>
        </label>
        <p className={styles.period} aria-label="Operational period"><span>{period.name === 'NO RECORDED WATCH' ? 'No recorded watch' : `${period.name[0]}${period.name.slice(1).toLowerCase()}`}</span><span className="ui-mono">{period.window === 'NO ACTIVE SHIFT' ? 'No active shift' : period.window}</span></p>
        <div className={styles.spacer} />
        <div className={styles.connection} data-state={snapshot.isError ? 'offline' : serviceLive ? 'live' : 'syncing'}>
          <i aria-hidden="true" />
          <div><strong>{connectionLabel}</strong><small>Last sync <span className="ui-mono">{syncClock(snapshot.data?.timestamp)}</span></small></div>
        </div>
        <button type="button" className={styles.searchTrigger} aria-label="Search unit, station, incident, location" onClick={() => setCommandOpen(true)}><Search aria-hidden="true" /><span>Search unit, station, incident</span><kbd>⌘K</kbd></button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className={styles.iconTrigger} aria-label={`${openAlerts.length} open alerts`}><Bell aria-hidden="true" />{openAlerts.length > 0 && <span>{openAlerts.length > 9 ? '9+' : openAlerts.length}</span>}</button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={cn('ui-menu', styles.alertMenu)} align="end" sideOffset={8}>
              <div className={styles.alertMenuHead}><div><strong>Open alerts</strong><span>{openAlerts.length} requiring review</span></div><StatusBadge tone={openAlerts.length ? 'danger' : 'success'}>{openAlerts.length ? 'Action needed' : 'Clear'}</StatusBadge></div>
              {openAlerts.slice(0, 5).map((alert) => <DropdownMenu.Item key={alert.alert_id} asChild><Link href={`/readiness?view=alerts&alert=${encodeURIComponent(alert.alert_id)}`} className={cn('ui-menu-item', styles.alertItem)}><div><strong>{alert.message}</strong><span>{formatRelativeTime(alert.created_at)}</span></div></Link></DropdownMenu.Item>)}
              {!openAlerts.length && <div className={styles.alertEmpty}><CheckCircle2 aria-hidden="true" /><span>No open operational alerts</span></div>}
              <DropdownMenu.Item asChild><Link className={cn('ui-menu-item', styles.alertFooter)} href="/readiness?view=alerts">Review alert queue</Link></DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className={styles.iconTrigger} aria-label={`Account: ${identity}`}><UserRound aria-hidden="true" /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="ui-menu" align="end" sideOffset={8}>
              <div className={styles.account}><strong>{identity}</strong><span>{session.isPending ? 'Checking access' : session.data?.can_write ? 'Operator access' : 'Read-only access'}</span></div>
              <DropdownMenu.Item asChild><Link className="ui-menu-item" href="/admin"><Settings size={16} aria-hidden="true" />Access and service details</Link></DropdownMenu.Item>
              {session.data?.can_reset_demo && <DropdownMenu.Item className="ui-menu-item" onSelect={() => setResetOpen(true)}><RefreshCw size={16} aria-hidden="true" />Restore demo data</DropdownMenu.Item>}
              {OIDC_ENABLED && <DropdownMenu.Item className="ui-menu-item" onSelect={() => void signOut().catch(() => window.location.assign('/'))}><LogOut size={16} aria-hidden="true" />Sign out</DropdownMenu.Item>}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="ui-overlay" />
          <Dialog.Content className={styles.mobileNav} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); mobileMenuTriggerRef.current?.focus() }}>
            <div className={styles.mobileNavHead}>
              {brand}
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Dialog.Close className={styles.mobileClose} aria-label="Close navigation"><X aria-hidden="true" /></Dialog.Close>
            </div>
            <nav className={styles.nav} aria-label="All workspaces">{navList(() => setMobileMenuOpen(false))}</nav>
            {provenance}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className={styles.main} id="main-content">
        {(snapshot.isError || streamState === 'offline' || streamState === 'reconnecting') && (
          <div className={styles.connectionNotice} role="status">
            <Activity aria-hidden="true" />
            <span>Live updates interrupted. Showing the last available data; reconnecting automatically.</span>
            <button type="button" onClick={() => void queryClient.invalidateQueries()}>Refresh data</button>
          </div>
        )}
        {children}
      </main>

      <Dialog.Root open={commandOpen} onOpenChange={(open) => { setCommandOpen(open); if (!open) setCommandQuery('') }}>
        <Dialog.Portal>
          <Dialog.Overlay className="ui-overlay" />
          <Dialog.Content className={styles.command} aria-describedby={undefined} onKeyDown={moveResultFocus}>
            <Dialog.Title className="sr-only">Search Aegis Command</Dialog.Title>
            <div className={styles.commandInput}>
              <Search aria-hidden="true" />
              <input autoFocus aria-label="Search workspaces and actions" value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search a workspace, station, unit, or incident" onKeyDown={(event) => { if (event.key === 'Enter') resultsRef.current?.querySelector<HTMLElement>('[data-command-item]')?.click() }} />
              <kbd>Esc</kbd>
            </div>
            <div className={styles.commandResults} ref={resultsRef}>
              {results.navigation.length > 0 && <section aria-label="Workspaces"><h3>Workspaces</h3>{results.navigation.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" data-command-item onClick={() => navigate(item.href)}><Icon aria-hidden="true" /><strong>{item.name}</strong><small>Open</small></button> })}</section>}
              {term && results.stations.length > 0 && <section aria-label="Stations"><h3>Stations</h3>{results.stations.map((station) => <button key={station.station_id} type="button" data-command-item onClick={() => navigate(`/?layer=stations&station=${encodeURIComponent(station.station_id)}`)}><Building2 aria-hidden="true" /><strong>{station.name}</strong><small>{station.district || 'Station'}</small></button>)}</section>}
              {term && results.units.length > 0 && <section aria-label="Units"><h3>Units</h3>{results.units.map((unit) => <button key={unit.unit_id} type="button" data-command-item onClick={() => navigate(`/readiness?view=units&unit=${encodeURIComponent(unit.unit_id)}`)}><Truck aria-hidden="true" /><strong>{unit.unit_name}</strong><small>{unit.readiness_score}% ready</small></button>)}</section>}
              {term && results.incidents.length > 0 && <section aria-label="Incidents"><h3>Active incidents</h3>{results.incidents.map((incident) => <button key={incident.incident_id} type="button" data-command-item onClick={() => navigate(`/readiness?view=incidents&incident=${encodeURIComponent(incident.incident_id)}`)}><Siren aria-hidden="true" /><strong>{incidentRef(incident)} · {incident.title}</strong><small>{incident.display_location?.split(',')[0] || incident.incident_type}</small></button>)}</section>}
              {term && !results.navigation.length && !results.stations.length && !results.units.length && !results.incidents.length && <p className={styles.commandEmpty}>No workspace, station, unit, or active incident matches “{commandQuery.trim()}”.</p>}
              {term && (stations.isError || !stations.data) && <p className={styles.commandNote}>Station records are unavailable right now, so they are not included in these results.</p>}
              {term && (snapshot.isError || !snapshot.data) && <p className={styles.commandNote}>Unit and incident records are unavailable until the operations snapshot loads.</p>}
              {!term && <p className={styles.commandNote}>Type to also search stations, units, and active incidents in the current scope. Personnel and closed incidents are searched in their own workspaces.</p>}
            </div>
            <div className={styles.commandFooter}>
              <span>{currentPage?.name || 'Aegis Command'}</span>
              <span>{identity} · {session.data?.can_write ? 'Operator' : 'Read-only'}{OIDC_ENABLED && <button type="button" onClick={() => void signOut().catch(() => window.location.assign('/'))}>Sign out</button>}</span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="Restore demo data?" description="All synthetic demonstration records are replaced with the baseline dataset." detail="Current demo edits will be permanently removed. This cannot be undone." confirmLabel="Restore demo data" guarded={false} onConfirm={async () => { await api.resetDemo(); await queryClient.invalidateQueries() }} />
    </div>
  )
}
