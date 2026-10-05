'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  CloudSun,
  Command,
  FileBarChart,
  Gauge,
  LifeBuoy,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Siren,
  Truck,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, queryKeys } from '@/lib/api'
import { OIDC_ENABLED, signOut } from '@/lib/auth'
import { useAccess } from '@/hooks/useAccess'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useOperationsStream } from '@/hooks/useOperationsStream'
import { useOperationalPeriod } from '@/hooks/useOperationalPeriod'
import { useStationScope } from './ScopeContext'
import { StatusBadge } from './ui'

const navigation = [
  { index: '01', name: 'County Status Wall', shortName: 'Status', href: '/', icon: Gauge },
  { index: '02', name: 'Incidents', shortName: 'Incidents', href: '/readiness?view=incidents', icon: Siren },
  { index: '03', name: 'Units', shortName: 'Units', href: '/readiness?view=units', icon: Truck },
  { index: '04', name: 'Stations', shortName: 'Stations', href: '/?layer=stations', icon: Building2 },
  { index: '05', name: 'Personnel', shortName: 'People', href: '/personnel', icon: Users },
  { index: '06', name: 'Resource Status', shortName: 'Resources', href: '/?panel=resources#resource-posture', icon: LifeBuoy },
  { index: '07', name: 'Plans & Hazards', shortName: 'Plans', href: '/readiness?view=simulation', icon: AlertTriangle },
  { index: '08', name: 'Weather', shortName: 'Weather', href: '/weather', icon: CloudSun },
  { index: '09', name: 'Reports', shortName: 'Reports', href: '/analytics', icon: FileBarChart },
  { index: '10', name: 'Admin', shortName: 'Admin', href: '/admin', icon: Settings },
] as const

const auxiliaryNavigation = [
  { index: 'A1', name: 'Scheduling', href: '/shifts', icon: Command },
  { index: 'A2', name: 'Credentials', href: '/certifications-management', icon: CheckCircle2 },
] as const
const switchboardNavigation = [...navigation, ...auxiliaryNavigation]

function localRegisterTime(value?: string | null) {
  if (!value) return '--:--:--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { stationId, setStationId } = useStationScope()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const [commandQuery, setCommandQuery] = useState('')
  const streamState = useOperationsStream()
  const session = useAccess()
  const stations = useQuery({ queryKey: queryKeys.stations, queryFn: api.stations })
  const snapshot = useQuery({
    queryKey: queryKeys.shellOperations(stationId),
    queryFn: () => api.operationsSnapshot(stationId === 'all' ? undefined : stationId),
  })
  const resetDemo = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setCommandOpen(false)
    },
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

  const filteredNavigation = useMemo(() => switchboardNavigation.filter((item) => (
    item.name.toLowerCase().includes(commandQuery.toLowerCase())
  )), [commandQuery])
  const openAlerts = snapshot.data?.alerts.filter((alert) => alert.state === 'OPEN') || []
  const serviceLive = !snapshot.isError && streamState === 'live'
  const activeIndex = pathname === '/'
    ? params.get('panel') === 'resources' ? '06' : params.get('layer') === 'stations' ? '04' : '01'
    : pathname === '/readiness'
      ? params.get('view') === 'simulation' ? '07' : ['incidents', 'alerts'].includes(params.get('view') || '') ? '02' : '03'
      : navigation.find((item) => pathname === item.href.split('?')[0])?.index
  const currentPage = navigation.find((item) => item.index === activeIndex) || navigation[0]
  const now = new Date()
  const period = useOperationalPeriod(now.getTime())
  const periodDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()

  const navigate = (href: string) => {
    router.push(href)
    setCommandOpen(false)
    setMobileMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-brand"><Link href="/" aria-label="Aegis Command county status wall">AEGIS COMMAND</Link></div>
        <div className="topbar-period" aria-label="Operational period">
          <strong>{pathname === '/readiness' && params.get('view') === 'incidents' ? 'FAIRFAX COUNTY / INCIDENTS' : 'FAIRFAX COUNTY / OPERATIONAL PERIOD'}</strong>
          <span>{periodDate}<b>{period.window}</b><b>({period.name})</b></span>
        </div>
        <nav className="topbar-micro-links" aria-label="Workspace groups">
          <Link href="/readiness">SERVICE</Link><i />
          <Link href="/personnel">PEOPLE</Link><i />
          <Link href="/analytics">SAFER COMMUNITIES</Link>
        </nav>
        <div className="topbar-connection">
          <span className={cn('system-pulse', !serviceLive && 'system-pulse-error')} />
          <div><strong>{snapshot.isError ? 'OPERATIONS OFFLINE' : serviceLive ? 'OPERATIONS CONNECTED' : 'OPERATIONS SYNCING'}</strong><small>LAST SYNC {localRegisterTime(snapshot.data?.timestamp)}</small></div>
        </div>
        <button type="button" className="command-trigger" aria-label="Search unit, station, incident, location" onClick={() => setCommandOpen(true)}><span>Search unit, station, incident, location</span><Search size={16} /><kbd>⌘K</kbd></button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className="topbar-alert" aria-label={`${openAlerts.length} open alerts`}><Bell size={18} />{openAlerts.length > 0 && <span>{Math.min(openAlerts.length, 9)}</span>}</button></DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-panel notification-panel" align="end" sideOffset={8}>
              <div className="notification-heading"><div><strong>Active alerts</strong><span>{openAlerts.length} requiring review</span></div><StatusBadge tone={openAlerts.length ? 'danger' : 'success'}>{openAlerts.length ? 'Action needed' : 'Clear'}</StatusBadge></div>
              <div className="notification-list">
                {openAlerts.slice(0, 5).map((alert) => <DropdownMenu.Item key={alert.alert_id} asChild><Link href="/readiness?view=alerts" className="notification-item"><span className="notification-dot" /><div><strong>{alert.message}</strong><small>{formatRelativeTime(alert.created_at)}</small></div></Link></DropdownMenu.Item>)}
                {!openAlerts.length && <div className="notification-empty"><CheckCircle2 size={18} /><span>No open operational alerts</span></div>}
              </div>
              <DropdownMenu.Item asChild><Link className="notification-footer" href="/readiness">Review operations</Link></DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button ref={mobileMenuTriggerRef} className="mobile-menu-trigger" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation directory" aria-haspopup="dialog"><Menu size={20} /></button>
      </header>

      <aside className="app-sidebar">
        <div className="sidebar-agency">
          <Image src="/brand/aegis-command-seal-v2.png" alt="Unofficial Aegis Fairfax County Fire and Rescue concept seal" width={46} height={68} priority />
          <div><strong>FAIRFAX COUNTY<br />FIRE AND RESCUE<br />DEPARTMENT</strong><span>PROTECTING<br />OUR COMMUNITY<br />TOGETHER</span></div>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon
            const active = item.index === activeIndex
            return <Link key={`${item.index}-${item.name}`} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn('nav-item', active && 'nav-item-active')} aria-current={active ? 'page' : undefined}><span className="nav-index">{item.index}</span><Icon aria-hidden="true" /><span>{item.name}</span>{item.index === '02' && openAlerts.length > 0 && <b className="nav-count">{openAlerts.length}</b>}</Link>
          })}
        </nav>
        <div className="sidebar-provenance"><span>UNOFFICIAL CONCEPT</span><span>SYNTHETIC OPERATIONS</span><hr /><strong>A STRONGER<br />SAFER FAIRFAX</strong></div>
      </aside>

      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="mobile-directory-overlay" />
          <Dialog.Content className="mobile-directory" aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); mobileMenuTriggerRef.current?.focus() }}>
            <div className="mobile-directory-heading">
              <div><span>AEGIS COMMAND</span><Dialog.Title>SWITCHBOARD DIRECTORY</Dialog.Title></div>
              <Dialog.Close className="mobile-directory-close" aria-label="Close navigation directory"><X size={21} /></Dialog.Close>
            </div>
            <div className="mobile-directory-period"><span>FAIRFAX COUNTY / OPERATIONAL PERIOD</span><strong>{periodDate} · {period.name}</strong></div>
            <nav className="mobile-directory-nav" aria-label="All workspaces">
              {switchboardNavigation.map((item) => {
                const Icon = item.icon
                const active = item.index === activeIndex
                return <Link key={`${item.index}-${item.name}`} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn('mobile-directory-link', active && 'mobile-directory-link-active')} aria-current={active ? 'page' : undefined}><span>{item.index}</span><Icon aria-hidden="true" /><strong>{item.name}</strong><span>OPEN</span></Link>
              })}
            </nav>
            <p className="mobile-directory-provenance">UNOFFICIAL CONCEPT · SYNTHETIC OPERATIONS</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main className="app-main" id="main-content">
        {(snapshot.isError || streamState === 'offline' || streamState === 'reconnecting') && <div className="connection-notice" role="status"><RefreshCw size={15} /><span>Live updates interrupted. Showing the last available data; reconnecting automatically.</span><button onClick={() => void queryClient.invalidateQueries()}>Refresh data</button></div>}
        {children}
      </main>

      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-dialog switchboard-directory" aria-describedby={undefined}>
            <Dialog.Title>SWITCHBOARD DIRECTORY</Dialog.Title>
            <div className="command-input"><Search size={18} /><input autoFocus aria-label="Search workspaces and actions" value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search station, unit, incident, or function…" /><kbd>ESC</kbd></div>
            <label className="switchboard-scope"><Building2 size={15} /><span>STATION SCOPE</span><select value={stationId} onChange={(event) => setStationId(event.target.value)} aria-label="Station scope"><option value="all">ALL STATIONS</option>{stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name.replace(/^Station \d+ — /, '')}</option>)}</select></label>
            <div className="command-results">
              {filteredNavigation.map((item) => { const Icon = item.icon; return <button key={`${item.index}-${item.name}`} type="button" onClick={() => navigate(item.href)}><span>{item.index}</span><Icon /><strong>{item.name}</strong><small>OPEN</small></button> })}
              {!filteredNavigation.length && <p className="command-empty">No matching switchboard function.</p>}
              {session.data?.can_reset_demo && <button type="button" onClick={() => { if (window.confirm('Replace all synthetic demo records? This cannot be undone.')) resetDemo.mutate() }} disabled={resetDemo.isPending}><span>SYS</span><RefreshCw className={cn(resetDemo.isPending && 'animate-spin')} /><strong>Restore demo data</strong><small>RESET</small></button>}
            </div>
            <div className="command-footer"><span><Command size={14} />{currentPage.name}</span><span>{session.data?.can_write ? session.data.display_name || 'DUTY OFFICER' : 'READ-ONLY'}{OIDC_ENABLED && <button onClick={() => void signOut().catch(() => window.location.assign('/'))}>SIGN OUT</button>}</span></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
