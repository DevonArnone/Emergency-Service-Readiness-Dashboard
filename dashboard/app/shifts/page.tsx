'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import CreateModal from '@/components/CreateModal'

interface LiveShiftStatus {
  shift_id: string
  location: string
  start_time: string
  end_time: string
  required_headcount: number
  assigned_count: number
  clocked_in_count: number
  status: string
  alerts: string[]
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<LiveShiftStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [showCreateShift, setShowCreateShift] = useState(false)
  const [creating, setCreating] = useState(false)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    fetchShifts()

    // Connect to WebSocket for real-time updates
    const wsUrl = apiBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
    const ws = new WebSocket(`${wsUrl}/ws/shifts`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'shift_event') {
          // Refresh shifts when event is received
          fetchShifts()
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsConnected(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setWsConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [apiBaseUrl])

  const getStatusConfig = (status: string) => {
    const configs = {
      understaffed: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-800 border-red-300',
        icon: '⚠️',
        progress: 'bg-red-500',
      },
      fully_staffed: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        badge: 'bg-green-100 text-green-800 border-green-300',
        icon: '✅',
        progress: 'bg-green-500',
      },
      over_staffed: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: '📊',
        progress: 'bg-blue-500',
      },
    }
    return configs[status as keyof typeof configs] || {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      text: 'text-gray-800',
      badge: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: '⏸️',
      progress: 'bg-gray-500',
    }
  }

  const getCoveragePercentage = (clockedIn: number, required: number) => {
    if (required === 0) return 0
    return Math.min((clockedIn / required) * 100, 100)
  }

  const fetchShifts = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/shifts/live`)
      if (!response.ok) {
        throw new Error('Failed to fetch shifts')
      }
      const data = await response.json()
      setShifts(data)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const handleCreateShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    
    const formData = new FormData(e.currentTarget)
    const shiftData = {
      location: formData.get('location') as string,
      start_time: new Date(`${formData.get('date')}T${formData.get('start_time')}`).toISOString(),
      end_time: new Date(`${formData.get('date')}T${formData.get('end_time')}`).toISOString(),
      required_headcount: parseInt(formData.get('required_headcount') as string),
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData),
      })

      if (!response.ok) {
        throw new Error('Failed to create shift')
      }

      setShowCreateShift(false)
      await fetchShifts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create shift')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading shifts...</p>
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

  const totalShifts = shifts.length
  const fullyStaffed = shifts.filter(s => s.status === 'fully_staffed').length
  const understaffed = shifts.filter(s => s.status === 'understaffed').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                Live Shifts
              </h1>
              <p className="text-gray-600 text-lg">
                Real-time monitoring of today's shifts
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateShift(true)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center space-x-2"
              >
                <span>+</span>
                <span>Create Shift</span>
              </button>
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl shadow-lg">
                <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {wsConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-indigo-500 transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Shifts</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{totalShifts}</p>
                </div>
                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">📅</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Fully Staffed</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{fullyStaffed}</p>
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
                  <p className="text-3xl font-bold text-gray-900 mt-2">{understaffed}</p>
                </div>
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shifts Grid */}
        {shifts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-fade-in">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📋</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Shifts Scheduled</h3>
            <p className="text-gray-600 mb-4">Create your first shift to get started</p>
            <button
              onClick={() => setShowCreateShift(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Create Your First Shift
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {shifts.map((shift, index) => {
              const config = getStatusConfig(shift.status)
              const coverage = getCoveragePercentage(shift.clocked_in_count, shift.required_headcount)
              
              return (
                <div
                  key={shift.shift_id}
                  className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 ${config.border} transform hover:scale-105 transition-all animate-fade-in`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`${config.bg} p-6`}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{shift.location}</h3>
                        <p className="text-gray-600 flex items-center space-x-2">
                          <span>🕐</span>
                          <span>
                            {format(new Date(shift.start_time), 'h:mm a')} -{' '}
                            {format(new Date(shift.end_time), 'h:mm a')}
                          </span>
                        </p>
                      </div>
                      <div className={`px-4 py-2 rounded-xl border ${config.badge} flex items-center space-x-2`}>
                        <span>{config.icon}</span>
                        <span className="font-semibold text-sm">
                          {shift.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Coverage</span>
                        <span className="text-sm font-bold text-gray-900">
                          {shift.clocked_in_count} / {shift.required_headcount}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${config.progress} transition-all duration-500 rounded-full`}
                          style={{ width: `${coverage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-xl">
                        <p className="text-2xl font-bold text-gray-900">{shift.required_headcount}</p>
                        <p className="text-xs text-gray-600 mt-1">Required</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-xl">
                        <p className="text-2xl font-bold text-gray-900">{shift.assigned_count}</p>
                        <p className="text-xs text-gray-600 mt-1">Assigned</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-xl">
                        <p className="text-2xl font-bold text-indigo-600">{shift.clocked_in_count}</p>
                        <p className="text-xs text-gray-600 mt-1">Clocked In</p>
                      </div>
                    </div>

                    {/* Alerts */}
                    {shift.alerts.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-center space-x-2">
                          <span className="text-red-600">🚨</span>
                          <span className="text-sm font-medium text-red-800">
                            {shift.alerts.join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Create Shift Modal */}
        <CreateModal
          isOpen={showCreateShift}
          onClose={() => setShowCreateShift(false)}
          title="Create New Shift"
          onSubmit={handleCreateShift}
          submitLabel={creating ? 'Creating...' : 'Create Shift'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g., Station 1, Downtown Office"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  name="start_time"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  name="end_time"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Headcount
              </label>
              <input
                type="number"
                name="required_headcount"
                required
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Minimum number of staff needed"
              />
            </div>
          </div>
        </CreateModal>
      </div>
    </div>
  )
}
