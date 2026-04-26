'use client'

import { useEffect, useState } from 'react'

interface ExpiringCert {
  personnel_id: string
  name: string
  certification: string
  expiration_date: string
  days_until_expiry: number
  is_expired: boolean
}

interface ExpiredCert {
  personnel_id: string
  name: string
  certification: string
  expiration_date: string
  days_expired: number
}

export default function CertificationsPage() {
  const [expiring, setExpiring] = useState<ExpiringCert[]>([])
  const [expired, setExpired] = useState<ExpiredCert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired' | 'qualified'>('all')
  const [daysAhead, setDaysAhead] = useState(30)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    const fetchCertifications = async () => {
      setLoading(true)
      try {
        const [expiringRes, expiredRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/certifications/expiring?days_ahead=${daysAhead}`),
          fetch(`${apiBaseUrl}/api/certifications/expired`),
        ])

        if (!expiringRes.ok || !expiredRes.ok) {
          throw new Error('Failed to fetch certifications')
        }

        const expiringData = await expiringRes.json()
        const expiredData = await expiredRes.json()

        setExpiring(expiringData)
        setExpired(expiredData)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }

    fetchCertifications()
    const interval = setInterval(fetchCertifications, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [apiBaseUrl, daysAhead])

  const getFilteredData = (): Array<ExpiringCert | (ExpiredCert & { days_until_expiry: number; is_expired: boolean })> => {
    switch (filter) {
      case 'expiring':
        return expiring.filter((c) => !c.is_expired)
      case 'expired':
        return expired.map((e) => ({ ...e, days_until_expiry: -e.days_expired, is_expired: true }))
      case 'qualified':
        return [] // Would need full personnel list to show qualified
      default:
        return [
          ...expiring,
          ...expired.map((e) => ({ ...e, days_until_expiry: -e.days_expired, is_expired: true }))
        ]
    }
  }

  if (loading) {
    return (
      <div className="ops-page">
        <div className="ops-shell">
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-300 border-t-transparent"></div>
              <p className="text-sm text-slate-400">Loading certifications...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ops-page">
        <div className="ops-shell">
          <div className="ops-panel border-red-400/25 bg-red-500/[0.08]">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.007M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">Error</h3>
                <p className="mt-1 text-sm text-red-200">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const filteredData = getFilteredData()
  const expiredCount = expired.length
  const expiringCount = expiring.filter((c) => !c.is_expired).length

  // Group certifications by personnel name and count expiring/expired
  const personnelCertCounts = new Map<string, { expiring: number; expired: number }>()
  expiring.forEach((cert) => {
    if (!personnelCertCounts.has(cert.name)) {
      personnelCertCounts.set(cert.name, { expiring: 0, expired: 0 })
    }
    const counts = personnelCertCounts.get(cert.name)!
    if (cert.is_expired) {
      counts.expired++
    } else {
      counts.expiring++
    }
  })
  expired.forEach((cert) => {
    if (!personnelCertCounts.has(cert.name)) {
      personnelCertCounts.set(cert.name, { expiring: 0, expired: 0 })
    }
    personnelCertCounts.get(cert.name)!.expired++
  })

  return (
    <div className="ops-page page-enter">
      <div className="ops-shell space-y-6">
        {/* Header */}
        <div className="surface-header">
          <div>
            <div className="panel-kicker">Ridgecrest ESD</div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Certifications Management
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Track certification expirations and compliance
            </p>
          </div>
          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/[0.08] px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-200/80">Refresh</div>
            <div className="mt-1 text-sm font-semibold text-white">Every 30 seconds</div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="stat-panel border-red-400/20 bg-red-500/[0.07]">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Expired</p>
                <p className="stat-value text-red-300">{expiredCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-panel border-amber-400/20 bg-amber-500/[0.07]">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Expiring Soon</p>
                <p className="stat-value text-amber-300">{expiringCount}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.007M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-panel border-sky-400/20 bg-sky-500/[0.07]">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Days Lookahead</p>
                <input
                  type="number"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
                  className="mt-2 w-24 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-3xl font-semibold text-sky-200 outline-none transition focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/20"
                  min="1"
                  max="365"
                />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-500/10 text-sky-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25m10.5-2.25v2.25M3.75 9h16.5m-15 12h13.5A1.5 1.5 0 0 0 20.25 19.5V6.75a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5V19.5A1.5 1.5 0 0 0 5.25 21Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'expiring', label: 'Expiring Soon' },
            { key: 'expired', label: 'Expired' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`filter-chip ${
                filter === f.key
                  ? 'filter-chip-active'
                  : ''
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Certifications Table */}
        <div className="ops-panel overflow-hidden p-0">
          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="flex items-center text-base font-semibold text-white">
              Certification Status
            </h2>
          </div>
          <div className="overflow-x-auto">
            {filteredData.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <p className="text-sm">No certifications match the selected filter</p>
              </div>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Certification</th>
                    <th>Expiration Date</th>
                    <th>Status</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredData.map((cert, index) => (
                    <tr
                      key={`${cert.personnel_id}-${cert.certification}-${index}`}
                      className="transition-colors hover:bg-white/[0.035]"
                    >
                      <td className="whitespace-nowrap font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{cert.name}</span>
                          {personnelCertCounts.has(cert.name) && (() => {
                            const counts = personnelCertCounts.get(cert.name)!
                            const total = counts.expiring + counts.expired
                            if (total > 0) {
                              return (
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  counts.expired > 0
                                    ? 'border-red-400/30 bg-red-500/10 text-red-300'
                                    : counts.expiring > 0
                                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                                    : 'border-slate-400/30 bg-slate-500/10 text-slate-300'
                                }`}>
                                  {counts.expired > 0 && `${counts.expired} expired`}
                                  {counts.expired > 0 && counts.expiring > 0 && ' • '}
                                  {counts.expiring > 0 && `${counts.expiring} expiring`}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-slate-300">
                        {cert.certification}
                      </td>
                      <td className="whitespace-nowrap text-slate-400">
                        {new Date(cert.expiration_date).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap">
                        {'is_expired' in cert && cert.is_expired ? (
                          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            EXPIRING
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {'is_expired' in cert && cert.is_expired ? (
                          <span className="font-semibold text-red-300">
                            -{Math.abs('days_until_expiry' in cert ? cert.days_until_expiry : 0)} days
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-300">
                            {'days_until_expiry' in cert ? cert.days_until_expiry : 0} days
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
