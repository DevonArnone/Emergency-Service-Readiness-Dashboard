'use client'

import { useEffect, useState, useRef } from 'react'
import ToastContainer, { ToastMessage } from '@/components/ToastContainer'
import CreateModal from '@/components/CreateModal'

interface UnitReadiness {
  unit_id: string
  unit_name: string
  unit_type: string
  readiness_score: number
  staff_required: number
  staff_present: number
  certifications_missing: string[]
  expired_certifications: string[]
  is_understaffed: boolean
  issues: string[]
  assigned_personnel: Array<{
    personnel_id: string
    name: string
    role: string
    certifications: string[]
  }>
  timestamp: string
}

export default function ReadinessPage() {
  const [units, setUnits] = useState<UnitReadiness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [showCreatePersonnel, setShowCreatePersonnel] = useState(false)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [personnelList, setPersonnelList] = useState<any[]>([])
  const [unitsList, setUnitsList] = useState<any[]>([])
  const [certificationsList, setCertificationsList] = useState<any[]>([])
  const [selectedCertExpirations, setSelectedCertExpirations] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const wsConnectionsRef = useRef<Map<string, WebSocket>>(new Map())

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const addToast = (message: string, type: ToastMessage['type'] = 'warning') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const fetchReadiness = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/readiness/units`)
      if (!response.ok) {
        throw new Error('Failed to fetch readiness data')
      }
      const data = await response.json()
      setUnits(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const fetchPersonnel = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/personnel`)
      if (response.ok) {
        const data = await response.json()
        setPersonnelList(data)
      }
    } catch (err) {
      console.error('Failed to fetch personnel:', err)
    }
  }

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/units`)
      if (response.ok) {
        const data = await response.json()
        setUnitsList(data)
      }
    } catch (err) {
      console.error('Failed to fetch units:', err)
    }
  }

  const fetchCertifications = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/certifications`)
      if (response.ok) {
        const data = await response.json()
        setCertificationsList(data)
      }
    } catch (err) {
      console.error('Failed to fetch certifications:', err)
    }
  }

  // Fetch initial readiness data
  useEffect(() => {
    fetchReadiness()
    fetchPersonnel()
    fetchUnits()
    fetchCertifications()
  }, [apiBaseUrl])

  // Connect WebSockets after units are loaded (only create new connections, don't recreate existing ones)
  useEffect(() => {
    if (units.length === 0) return

    const currentUnitIds = new Set(units.map(u => u.unit_id))
    
    // Close connections for units that no longer exist
    wsConnectionsRef.current.forEach((ws, unitId) => {
      if (!currentUnitIds.has(unitId)) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
        wsConnectionsRef.current.delete(unitId)
        setWsConnected((prev) => {
          const next = new Set(prev)
          next.delete(unitId)
          return next
        })
      }
    })

    // Create connections for new units only
    units.forEach((unit) => {
      // Skip if connection already exists
      if (wsConnectionsRef.current.has(unit.unit_id)) {
        const existingWs = wsConnectionsRef.current.get(unit.unit_id)
        if (existingWs && existingWs.readyState === WebSocket.OPEN) {
          return // Already connected
        }
      }

      const wsUrl = apiBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws/unit-readiness/${unit.unit_id}`)

      ws.onopen = () => {
        setWsConnected((prev) => new Set([...prev, unit.unit_id]))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'unit_readiness') {
            const newData = message.data
            // Update the specific unit in the list
            setUnits((prev) => {
              const oldUnit = prev.find((u) => u.unit_id === newData.unit_id)
              const updated = prev.map((u) =>
                u.unit_id === newData.unit_id ? newData : u
              )

              // Show alerts for critical changes
              if (oldUnit) {
                if (newData.is_understaffed && !oldUnit.is_understaffed) {
                  addToast(`🚨 ${newData.unit_name} is now UNDERSTAFFED!`, 'error')
                }
                if (newData.expired_certifications.length > oldUnit.expired_certifications.length) {
                  addToast(`⏰ ${newData.unit_name} has expired certifications!`, 'warning')
                }
                if (newData.certifications_missing.length > oldUnit.certifications_missing.length) {
                  addToast(`📛 ${newData.unit_name} is missing required certifications!`, 'warning')
                }
              }

              return updated
            })
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        setWsConnected((prev) => {
          const next = new Set(prev)
          next.delete(unit.unit_id)
          return next
        })
      }

      ws.onclose = () => {
        setWsConnected((prev) => {
          const next = new Set(prev)
          next.delete(unit.unit_id)
          return next
        })
        wsConnectionsRef.current.delete(unit.unit_id)
      }

      wsConnectionsRef.current.set(unit.unit_id, ws)
    })

    // Cleanup on unmount
    return () => {
      wsConnectionsRef.current.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close()
        }
      })
      wsConnectionsRef.current.clear()
    }
  }, [apiBaseUrl, units.map(u => u.unit_id).sort().join(',')]) // Only depend on sorted unit IDs

  const getReadinessColor = (score: number) => {
    if (score >= 85) return 'green'
    if (score >= 60) return 'yellow'
    return 'red'
  }

  const getUnitTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ENGINE: 'from-red-500 to-red-700',
      LADDER: 'from-red-600 to-red-800',
      RESCUE: 'from-orange-500 to-orange-700',
      MEDIC: 'from-blue-500 to-blue-700',
      SAR_TEAM: 'from-orange-600 to-orange-800',
    }
    return colors[type] || 'from-gray-500 to-gray-700'
  }

  const getUnitTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      ENGINE: '🔥',
      LADDER: '🚒',
      RESCUE: '🚑',
      MEDIC: '💙',
      SAR_TEAM: '🧭',
    }
    return icons[type] || '🚨'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading unit readiness...</p>
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

  const totalUnits = units.length
  const readyUnits = units.filter((u) => u.readiness_score >= 85).length
  const understaffedUnits = units.filter((u) => u.is_understaffed).length

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                  Crew Readiness Dashboard
                </h1>
                <p className="text-gray-600 text-lg">
                  Real-time emergency services unit readiness monitoring
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowCreatePersonnel(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    + Personnel
                  </button>
                  <button
                    onClick={() => setShowCreateUnit(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    + Unit
                  </button>
                  <button
                    onClick={() => setShowCreateAssignment(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    + Assignment
                  </button>
                </div>
                <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl shadow-lg">
                  <div className={`w-3 h-3 rounded-full ${wsConnected.size > 0 ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {wsConnected.size} units live
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-indigo-500 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Units</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalUnits}</p>
                  </div>
                  <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">🚨</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Ready Units</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{readyUnits}</p>
                  </div>
                  <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">✅</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500 transform hover:scale-105 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Understaffed</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{understaffedUnits}</p>
                  </div>
                  <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                    <span className="text-3xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Crew Readiness Cards */}
          {units.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-fade-in">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🚨</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Units Configured</h3>
              <p className="text-gray-600">Create units to start monitoring readiness</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {units.map((unit, index) => {
                const readinessColor = getReadinessColor(unit.readiness_score)
                const typeGradient = getUnitTypeColor(unit.unit_type)
                const typeIcon = getUnitTypeIcon(unit.unit_type)
                const isConnected = wsConnected.has(unit.unit_id)

                return (
                  <div
                    key={unit.unit_id}
                    className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 ${
                      unit.is_understaffed
                        ? 'border-red-300 shadow-red-200 animate-pulse'
                        : readinessColor === 'green'
                        ? 'border-green-300'
                        : 'border-yellow-300'
                    } transform hover:scale-105 transition-all cursor-pointer animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => setSelectedUnit(unit.unit_id)}
                  >
                    {/* Header with gradient */}
                    <div className={`bg-gradient-to-r ${typeGradient} p-6 text-white`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-3xl">{typeIcon}</span>
                            <h3 className="text-2xl font-bold">{unit.unit_name}</h3>
                          </div>
                          <p className="text-sm opacity-90">{unit.unit_type}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}>
                          <span className="text-xs font-semibold">
                            {isConnected ? 'LIVE' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      {/* Readiness Score */}
                      <div className="text-center">
                        <div className="text-5xl font-extrabold mb-2">
                          {unit.readiness_score}%
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                          <div
                            className={`h-full rounded-full ${
                              readinessColor === 'green'
                                ? 'bg-green-300'
                                : readinessColor === 'yellow'
                                ? 'bg-yellow-300'
                                : 'bg-red-300'
                            } transition-all duration-500`}
                            style={{ width: `${unit.readiness_score}%` }}
                          ></div>
                        </div>
                        <p className="text-xs opacity-90">Readiness Score</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      {/* Staff Count */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">👥 Staff Onboard</span>
                          <span className="text-lg font-bold text-gray-900">
                            {unit.staff_present} / {unit.staff_required}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-full rounded-full ${
                              unit.staff_present >= unit.staff_required
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            } transition-all`}
                            style={{
                              width: `${Math.min(100, (unit.staff_present / unit.staff_required) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Missing Certifications */}
                      {unit.certifications_missing.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-red-600">📛</span>
                            <span className="text-sm font-semibold text-red-800">Missing:</span>
                          </div>
                          <p className="text-xs text-red-700">
                            {unit.certifications_missing.join(', ')}
                          </p>
                        </div>
                      )}

                      {/* Expired Certifications */}
                      {unit.expired_certifications.length > 0 && (
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-orange-600">⏰</span>
                            <span className="text-sm font-semibold text-orange-800">Expired:</span>
                          </div>
                          <p className="text-xs text-orange-700">
                            {unit.expired_certifications.slice(0, 2).join(', ')}
                            {unit.expired_certifications.length > 2 &&
                              ` +${unit.expired_certifications.length - 2} more`}
                          </p>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="mt-4">
                        {unit.is_understaffed ? (
                          <div className="px-4 py-2 bg-red-100 border-2 border-red-300 rounded-xl text-center">
                            <span className="text-sm font-bold text-red-800 flex items-center justify-center space-x-2">
                              <span>⚠️</span>
                              <span>UNDERSTAFFED</span>
                            </span>
                          </div>
                        ) : (
                          <div className="px-4 py-2 bg-green-100 border-2 border-green-300 rounded-xl text-center">
                            <span className="text-sm font-bold text-green-800 flex items-center justify-center space-x-2">
                              <span>✅</span>
                              <span>FULLY STAFFED</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Unit Breakdown Modal */}
          {selectedUnit && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedUnit(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const unit = units.find((u) => u.unit_id === selectedUnit)
                  if (!unit) return null

                  return (
                    <>
                      <div className={`bg-gradient-to-r ${getUnitTypeColor(unit.unit_type)} p-6 text-white sticky top-0`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-3xl font-bold mb-2">{unit.unit_name}</h2>
                            <p className="text-lg opacity-90">Unit Breakdown</p>
                          </div>
                          <button
                            onClick={() => setSelectedUnit(null)}
                            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                          >
                            <span className="text-2xl">✕</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-6">
                        {/* Readiness Summary */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Readiness Score</p>
                              <p className="text-3xl font-bold text-gray-900">{unit.readiness_score}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Staff Status</p>
                              <p className="text-3xl font-bold text-gray-900">
                                {unit.staff_present}/{unit.staff_required}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Assigned Personnel */}
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-gray-900 mb-4">Assigned Personnel</h3>
                          {unit.assigned_personnel.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No personnel assigned</p>
                          ) : (
                            <div className="space-y-3">
                              {unit.assigned_personnel.map((person) => (
                                <div
                                  key={person.personnel_id}
                                  className="p-4 bg-gray-50 rounded-xl border border-gray-200"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-semibold text-gray-900">{person.name}</p>
                                      <p className="text-sm text-gray-600">{person.role}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {person.certifications.map((cert) => (
                                          <span
                                            key={cert}
                                            className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                          >
                                            {cert}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Issues */}
                        {unit.issues.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Issues</h3>
                            <div className="space-y-2">
                              {unit.issues.map((issue, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 bg-red-50 border border-red-200 rounded-xl"
                                >
                                  <p className="text-sm text-red-800">⚠️ {issue}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Personnel Modal */}
      <CreateModal
        isOpen={showCreatePersonnel}
        onClose={() => {
          setShowCreatePersonnel(false)
          setSelectedCertExpirations({})
        }}
        title="Create Personnel"
        onSubmit={async (e) => {
          e.preventDefault()
          setCreating(true)
          const formData = new FormData(e.currentTarget)
          const selectedCerts = formData.getAll('certifications') as string[]
          
          // Build cert_expirations from selected certifications and their dates
          const cert_expirations: Record<string, string> = {}
          selectedCerts.forEach((certName) => {
            const expirationDate = formData.get(`cert_expiration_${certName}`) as string
            if (expirationDate) {
              cert_expirations[certName] = expirationDate
            }
          })
          
          const personnelData = {
            name: formData.get('name') as string,
            rank: formData.get('rank') as string || undefined,
            role: formData.get('role') as string,
            certifications: selectedCerts,
            cert_expirations: Object.keys(cert_expirations).length > 0 ? cert_expirations : undefined,
            availability_status: formData.get('availability_status') as string || 'AVAILABLE',
            station_id: formData.get('station_id') as string || undefined,
          }
          try {
            const response = await fetch(`${apiBaseUrl}/api/personnel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(personnelData),
            })
            if (!response.ok) throw new Error('Failed to create personnel')
            setShowCreatePersonnel(false)
            await fetchPersonnel()
            await fetchReadiness()
            addToast('Personnel created successfully!', 'success')
          } catch (err) {
            addToast(err instanceof Error ? err.message : 'Failed to create personnel', 'error')
          } finally {
            setCreating(false)
          }
        }}
        submitLabel={creating ? 'Creating...' : 'Create Personnel'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" name="name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rank</label>
            <input type="text" name="rank" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Captain, Lieutenant" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <input type="text" name="role" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Firefighter, EMT-P" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Certifications</label>
            <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-3">
              {certificationsList.length === 0 ? (
                <p className="text-sm text-gray-500">No certifications available. Create them in Certification Management.</p>
              ) : (
                certificationsList.map((cert) => {
                  const expirationKey = `cert_expiration_${cert.name}`
                  return (
                    <div key={cert.certification_id} className="border-b border-gray-200 pb-2 last:border-b-0">
                      <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          name="certifications"
                          value={cert.name}
                          onChange={(e) => {
                            setSelectedCertExpirations(prev => ({
                              ...prev,
                              [cert.name]: e.target.checked
                            }))
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 flex-1">{cert.name}</span>
                        {cert.category && (
                          <span className="text-xs text-gray-500">({cert.category})</span>
                        )}
                      </label>
                      {selectedCertExpirations[cert.name] && (
                        <div className="ml-6 mt-1">
                          <label className="block text-xs text-gray-600 mb-1">Expiration Date</label>
                          <input
                            type="date"
                            name={expirationKey}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Select certifications and set expiration dates</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability Status</label>
            <select name="availability_status" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="AVAILABLE">Available</option>
              <option value="OFF">Off</option>
              <option value="IN_TRAINING">In Training</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="ON_CALL">On Call</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Station ID</label>
            <input type="text" name="station_id" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., station-001" />
          </div>
        </div>
      </CreateModal>

      {/* Create Unit Modal */}
      <CreateModal
        isOpen={showCreateUnit}
        onClose={() => setShowCreateUnit(false)}
        title="Create Unit"
        onSubmit={async (e) => {
          e.preventDefault()
          setCreating(true)
          const formData = new FormData(e.currentTarget)
            const selectedCerts = formData.getAll('required_certifications') as string[]
            const unitData = {
              unit_name: formData.get('unit_name') as string,
              type: formData.get('type') as string,
              minimum_staff: parseInt(formData.get('minimum_staff') as string),
              required_certifications: selectedCerts,
              station_id: formData.get('station_id') as string || undefined,
            }
          try {
            const response = await fetch(`${apiBaseUrl}/api/units`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(unitData),
            })
            if (!response.ok) throw new Error('Failed to create unit')
            setShowCreateUnit(false)
            await fetchUnits()
            await fetchReadiness()
            addToast('Unit created successfully!', 'success')
          } catch (err) {
            addToast(err instanceof Error ? err.message : 'Failed to create unit', 'error')
          } finally {
            setCreating(false)
          }
        }}
        submitLabel={creating ? 'Creating...' : 'Create Unit'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name *</label>
            <input type="text" name="unit_name" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="e.g., Engine 1, Medic 5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type *</label>
            <select name="type" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
              <option value="ENGINE">Engine</option>
              <option value="LADDER">Ladder</option>
              <option value="RESCUE">Rescue</option>
              <option value="MEDIC">Medic</option>
              <option value="SAR_TEAM">SAR Team</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Staff *</label>
            <input type="number" name="minimum_staff" required min="1" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
          </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Certifications</label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {certificationsList.length === 0 ? (
                  <p className="text-sm text-gray-500">No certifications available. Create them in Certification Management.</p>
                ) : (
                  certificationsList.map((cert) => (
                    <label key={cert.certification_id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        name="required_certifications"
                        value={cert.name}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{cert.name}</span>
                      {cert.category && (
                        <span className="text-xs text-gray-500">({cert.category})</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select certifications required for this unit</p>
            </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Station ID</label>
            <input type="text" name="station_id" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="e.g., station-001" />
          </div>
        </div>
      </CreateModal>

      {/* Create Assignment Modal */}
      <CreateModal
        isOpen={showCreateAssignment}
        onClose={() => setShowCreateAssignment(false)}
        title="Create Unit Assignment"
        onSubmit={async (e) => {
          e.preventDefault()
          setCreating(true)
          const formData = new FormData(e.currentTarget)
          const assignmentData = {
            unit_id: formData.get('unit_id') as string,
            personnel_id: formData.get('personnel_id') as string,
            shift_start: new Date(`${formData.get('date')}T${formData.get('start_time')}`).toISOString(),
            shift_end: new Date(`${formData.get('date')}T${formData.get('end_time')}`).toISOString(),
            assignment_status: 'ON_SHIFT',
          }
          try {
            const response = await fetch(`${apiBaseUrl}/api/unit-assignments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assignmentData),
            })
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.detail || 'Failed to create assignment')
            }
            setShowCreateAssignment(false)
            await fetchReadiness()
            addToast('Assignment created successfully!', 'success')
          } catch (err) {
            addToast(err instanceof Error ? err.message : 'Failed to create assignment', 'error')
          } finally {
            setCreating(false)
          }
        }}
        submitLabel={creating ? 'Creating...' : 'Create Assignment'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
            <select name="unit_id" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
              <option value="">Select a unit</option>
              {unitsList.map(unit => (
                <option key={unit.unit_id} value={unit.unit_id}>{unit.unit_name} ({unit.type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personnel *</label>
            <select name="personnel_id" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
              <option value="">Select personnel</option>
              {personnelList.map(person => (
                <option key={person.personnel_id} value={person.personnel_id}>{person.name} ({person.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="time" name="start_time" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="time" name="end_time" required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      </CreateModal>
    </>
  )
}
