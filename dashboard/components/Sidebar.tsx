'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Overview',    href: '/',                        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Operations',  href: '/readiness',               icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'Workforce',   href: '/personnel',               icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { name: 'Credentials', href: '/certifications-management', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { name: 'Shifts',      href: '/shifts',                  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Analytics',   href: '/analytics',               icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] bg-[#09121f] lg:flex lg:flex-col">
      <div className="border-b border-white/[0.08] px-5 py-5">
        <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Ridgecrest ESD</div>
        <div className="mt-1.5 text-lg font-semibold tracking-tight text-white">Emergency Platform</div>
        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          Staffing readiness, credential risk, and ops analytics.
        </p>
      </div>

      <nav className="flex-1 px-3 py-5">
        <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Navigation</div>
        <div className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  isActive
                    ? 'bg-cyan-400/10 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.15)]'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                }`}
              >
                <svg
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span>{item.name}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/[0.08] px-4 py-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            System online
          </div>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            WebSocket push · Snowflake analytics · Kafka pipeline
          </p>
        </div>
      </div>
    </aside>
  )
}
