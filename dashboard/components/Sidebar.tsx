'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Overview', href: '/' },
  { name: 'Readiness', href: '/readiness' },
  { name: 'Personnel', href: '/personnel' },
  { name: 'Certificates', href: '/certifications-management' },
  { name: 'Shifts', href: '/shifts' },
  { name: 'Analytics', href: '/analytics' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/8 bg-[#0b1220] lg:flex lg:flex-col">
      <div className="border-b border-white/8 px-6 py-6">
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Shift Dashboard</div>
        <div className="mt-2 text-xl font-semibold tracking-tight text-white">
          Emergency readiness
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Live unit posture, staffing gaps, credential exposure, and warehouse-backed operations analytics.
        </p>
      </div>

      <nav className="flex-1 px-4 py-6">
        <div className="mb-3 px-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Navigation
        </div>
        <div className="space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                  isActive
                    ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{item.name}</span>
                {isActive ? <span className="h-2 w-2 rounded-full bg-cyan-400" /> : null}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-white/8 px-6 py-6">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            System online
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Designed for low-latency push updates and warehouse-backed command reporting.
          </p>
        </div>
      </div>
    </aside>
  )
}
