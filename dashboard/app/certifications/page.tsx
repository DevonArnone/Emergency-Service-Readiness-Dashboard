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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading certifications...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">❌</span>
              <div>
                <h3 className="text-lg font-bold text-red-900">Error</h3>
                <p className="text-red-700">{error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            Certifications Management
          </h1>
          <p className="text-gray-600 text-lg">
            Track certification expirations and compliance
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Expired</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{expiredCount}</p>
              </div>
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                <span className="text-3xl">⏰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Expiring Soon</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{expiringCount}</p>
              </div>
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Days Lookahead</p>
                <input
                  type="number"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
                  className="text-3xl font-bold text-blue-600 mt-2 w-20 border-0 border-b-2 border-blue-300 focus:border-blue-500 outline-none"
                  min="1"
                  max="365"
                />
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-3xl">📅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          {[
            { key: 'all', label: 'All', icon: '📋' },
            { key: 'expiring', label: 'Expiring Soon', icon: '⚠️' },
            { key: 'expired', label: 'Expired', icon: '⏰' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                filter === f.key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 shadow hover:shadow-lg'
              }`}
            >
              <span className="mr-2">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* Certifications Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
          <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📛</span>
              Certification Status
            </h2>
          </div>
          <div className="overflow-x-auto">
            {filteredData.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <span className="text-4xl mb-4 block">✅</span>
                <p className="text-lg">No certifications match the selected filter</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Certification
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Expiration Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((cert, index) => (
                    <tr
                      key={`${cert.personnel_id}-${cert.certification}-${index}`}
                      className="hover:bg-indigo-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{cert.name}</span>
                          {personnelCertCounts.has(cert.name) && (() => {
                            const counts = personnelCertCounts.get(cert.name)!
                            const total = counts.expiring + counts.expired
                            if (total > 0) {
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  counts.expired > 0
                                    ? 'bg-red-100 text-red-800'
                                    : counts.expiring > 0
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {cert.certification}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(cert.expiration_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {'is_expired' in cert && cert.is_expired ? (
                          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                            EXPIRED
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                            EXPIRING
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {'is_expired' in cert && cert.is_expired ? (
                          <span className="font-semibold text-red-600">
                            -{Math.abs('days_until_expiry' in cert ? cert.days_until_expiry : 0)} days
                          </span>
                        ) : (
                          <span className="font-semibold text-orange-600">
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

