'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const navigation = [
  { name: 'Overview',    href: '/',                        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Operations',  href: '/readiness',               icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'Workforce',   href: '/personnel',               icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { name: 'Credentials', href: '/certifications-management', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { name: 'Shifts',      href: '/shifts',                  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Analytics',   href: '/analytics',               icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

export default function Sidebar() {
  const pathname = usePathname()
  const [resetting, setResetting] = useState(false)
  const [openAlerts, setOpenAlerts] = useState(0)
  const [certAlerts, setCertAlerts] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    fetch(`${apiBase}/api/dashboard/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOpenAlerts(data.open_alerts ?? 0) })
      .catch(() => {})
    fetch(`${apiBase}/api/alerts?state=OPEN`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Array<{ alert_type: string }> | null) => {
        if (data) setCertAlerts(data.filter(a => a.alert_type.includes('CERT')).length)
      })
      .catch(() => {})
  }, [])

  const resetDemo = async () => {
    setResetting(true)
    try {
      await fetch(`${apiBase}/api/demo/reset`, { method: 'POST' })
      window.location.reload()
    } catch {
      setResetting(false)
    }
  }

  const navItems = (
    <>
      <nav className="flex-1 px-3 py-5" aria-label="Primary navigation">
        <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Navigation</div>
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-300/10 text-sky-200 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18),0_14px_34px_rgba(14,165,233,0.12)]'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                <svg
                  className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.name}</span>
                {item.name === 'Operations' && openAlerts > 0 ? (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.45)]">
                    {openAlerts > 9 ? '9+' : openAlerts}
                  </span>
                ) : item.name === 'Credentials' && certAlerts > 0 ? (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.35)]">
                    {certAlerts > 9 ? '9+' : certAlerts}
                  </span>
                ) : isActive ? (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-300" />
                ) : null}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/[0.08] px-4 py-4 space-y-3">
        <button
          onClick={resetDemo}
          disabled={resetting}
          className="w-full rounded-2xl border border-sky-300/20 bg-sky-300/[0.07] px-3 py-2.5 text-left transition hover:bg-sky-300/10 disabled:opacity-50"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {resetting ? 'Resetting…' : 'Reset Demo Data'}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">Reload all demo workers & scenarios</p>
        </button>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-3 shadow-[0_0_28px_rgba(16,185,129,0.08)]">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            System online
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            WebSocket push · Snowflake analytics · Kafka pipeline
          </p>
        </div>
      </div>
    </>
  )

  return (
    <>
      <header className="fixed inset-x-3 top-3 z-40 rounded-[22px] border border-white/10 bg-slate-950/70 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0" onClick={() => setMobileOpen(false)}>
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-200/80">Ridgecrest ESD</div>
            <div className="truncate text-sm font-semibold tracking-tight text-white">Emergency Platform</div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-200 transition hover:bg-white/10"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="mt-3 max-h-[calc(100vh-96px)] overflow-y-auto border-t border-white/10 pt-2">
            {navItems}
          </div>
        )}
      </header>

      <aside className="hidden w-72 border-r border-white/[0.08] bg-slate-950/58 shadow-[20px_0_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-10 lg:flex lg:flex-col">
        <div className="relative overflow-hidden border-b border-white/[0.08] px-5 py-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/[0.08] text-sky-200 shadow-[0_0_34px_rgba(56,189,248,0.12)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="mt-4 text-[10px] uppercase tracking-[0.28em] text-sky-200/70">Ridgecrest ESD</div>
          <div className="mt-1.5 text-xl font-semibold tracking-tight text-white">Emergency Platform</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Staffing readiness, credential risk, and ops analytics.
          </p>
        </div>
        {navItems}
      </aside>
    </>
  )
}
