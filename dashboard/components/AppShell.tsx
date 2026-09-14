'use client'

import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlarmClock,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Command,
  Gauge,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api, queryKeys } from '@/lib/api'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useOperationsStream } from '@/hooks/useOperationsStream'
import { useStationScope } from './ScopeContext'
import { IconButton, StatusBadge } from './ui'

const navigation = [
  { name: 'Command Center', shortName: 'Home', href: '/', icon: Gauge },
  { name: 'Operations', shortName: 'Ops', href: '/readiness', icon: Siren },
  { name: 'Workforce', shortName: 'People', href: '/personnel', icon: Users },
  { name: 'Scheduling', shortName: 'Shifts', href: '/shifts', icon: AlarmClock },
  { name: 'Credentials', shortName: 'Certs', href: '/certifications-management', icon: ShieldCheck },
  { name: 'Analytics', shortName: 'Data', href: '/analytics', icon: BarChart3 },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { stationId, setStationId } = useStationScope()
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')

  const streamState = useOperationsStream()

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

  const filteredNavigation = useMemo(() => navigation.filter((item) => (
    item.name.toLowerCase().includes(commandQuery.toLowerCase())
  )), [commandQuery])

  const currentPage = navigation.find((item) => item.href === pathname) || navigation[0]
  const openAlerts = snapshot.data?.alerts.filter((alert) => alert.state === 'OPEN') || []

  const navigate = (href: string) => {
    router.push(href)
    setCommandOpen(false)
    setMobileMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={cn('app-sidebar', mobileMenuOpen && 'app-sidebar-open')}>
        <div className="brand-block">
          <Link href="/" className="brand-mark" onClick={() => setMobileMenuOpen(false)} aria-label="Aegis command center">
            <span><ShieldCheck className="size-5" aria-hidden="true" /></span>
            <span><strong>AEGIS</strong><small>Command Platform</small></span>
          </Link>
          <button className="sidebar-close lg:hidden" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation"><X className="size-5" /></button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {navigation.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn('nav-item', active && 'nav-item-active')} aria-current={active ? 'page' : undefined}>
                <Icon className="size-[18px]" aria-hidden="true" />
                <span>{item.name}</span>
                {item.href === '/readiness' && openAlerts.length > 0 && <span className="nav-count">{Math.min(openAlerts.length, 99)}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-agency"><span>CONCEPT ENVIRONMENT</span><strong>Fairfax County<br />Fire and Rescue</strong><small>Public geography · synthetic operations</small></div>
        <div className="sidebar-footer">
          <div className="system-status">
            <span className={cn('system-pulse', snapshot.isError && 'system-pulse-error')} />
            <div><strong>{snapshot.isError ? 'API unavailable' : streamState === 'live' ? 'Operations connected' : 'Connecting to operations'}</strong><small>{snapshot.isError ? 'Connection requires attention' : streamState === 'live' ? 'Synthetic operational feed' : streamState}</small></div>
          </div>
          <button className="sidebar-reset" type="button" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}>
            <RefreshCw className={cn('size-4', resetDemo.isPending && 'animate-spin')} aria-hidden="true" />
            {resetDemo.isPending ? 'Restoring data' : 'Restore demo data'}
          </button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="sidebar-backdrop lg:hidden" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation" />}

      <header className="app-topbar">
        <div className="topbar-title">
          <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}><Menu className="size-5" /></IconButton>
          <div><span>FAIRFAX COUNTY / AEGIS</span><strong>{currentPage.name}</strong></div>
        </div>
        <div className="topbar-actions">
          <label className="station-scope">
            <Building2 className="size-4" aria-hidden="true" />
            <span className="sr-only">Station scope</span>
            <select value={stationId} onChange={(event) => setStationId(event.target.value)} aria-label="Station scope">
              <option value="all">All stations</option>
              {stations.data?.map((station) => <option key={station.station_id} value={station.station_id}>{station.name.replace(/^Station \d+ — /, '')}</option>)}
            </select>
          </label>
          <button type="button" className="command-trigger" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" aria-hidden="true" /><span>Find workspace or action</span><kbd>⌘ K</kbd>
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="icon-button notification-trigger" aria-label={`${openAlerts.length} open alerts`}>
                <Bell className="size-[18px]" />
                {openAlerts.length > 0 && <span>{Math.min(openAlerts.length, 9)}</span>}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="dropdown-panel notification-panel" align="end" sideOffset={8}>
                <div className="notification-heading"><div><strong>Active alerts</strong><span>{openAlerts.length} requiring review</span></div><StatusBadge tone={openAlerts.length ? 'danger' : 'success'}>{openAlerts.length ? 'Action needed' : 'Clear'}</StatusBadge></div>
                <div className="notification-list">
                  {openAlerts.slice(0, 5).map((alert) => (
                    <DropdownMenu.Item key={alert.alert_id} asChild>
                      <Link href="/readiness" className="notification-item">
                        <span className="notification-dot" /><div><strong>{alert.message}</strong><small>{formatRelativeTime(alert.created_at)}</small></div>
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  {!openAlerts.length && <div className="notification-empty"><CheckCircle2 className="size-5" /><span>No open operational alerts</span></div>}
                </div>
                <DropdownMenu.Item asChild><Link className="notification-footer" href="/readiness">Review operations</Link></DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return <Link key={item.href} href={item.href} className={cn(active && 'mobile-nav-active')} aria-current={active ? 'page' : undefined}><Icon className="size-[18px]" /><span>{item.shortName}</span></Link>
        })}
      </nav>

      <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-dialog" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">Command menu</Dialog.Title>
            <div className="command-input"><Search className="size-5" /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search workspaces and actions…" /><kbd>ESC</kbd></div>
            <div className="command-results">
              <span className="command-label">Navigate</span>
              {filteredNavigation.map((item) => {
                const Icon = item.icon
                return <button key={item.href} type="button" onClick={() => navigate(item.href)}><span><Icon className="size-[18px]" /></span><strong>{item.name}</strong><small>Open</small></button>
              })}
              <span className="command-label">System</span>
              <button type="button" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}><span><RefreshCw className={cn('size-[18px]', resetDemo.isPending && 'animate-spin')} /></span><strong>Restore demo data</strong><small>Reset</small></button>
            </div>
            <div className="command-footer"><span><Command className="size-3.5" />Aegis command menu</span><span>Tab navigate · Enter select</span></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
