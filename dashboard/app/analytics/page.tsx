'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CoverageSummary {
  location: string
  hour: number
  scheduled_headcount: number
  actual_headcount: number
  understaffed_flag: boolean
  overtime_risk_flag: boolean
  date: string
}

export default function AnalyticsPage() {
  const [coverage, setCoverage] = useState<CoverageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/analytics/coverage?target_date=${selectedDate}`
        )
        if (!response.ok) {
          throw new Error('Failed to fetch analytics')
        }
        const data = await response.json()
        setCoverage(data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [selectedDate, apiBaseUrl])

  // Prepare data for chart
  const chartData = coverage.reduce((acc, item) => {
    const key = `${item.location}-${item.hour}`
    if (!acc[key]) {
      acc[key] = {
        hour: item.hour,
        location: item.location,
        scheduled: 0,
        actual: 0,
      }
    }
    acc[key].scheduled += item.scheduled_headcount
    acc[key].actual += item.actual_headcount
    return acc
  }, {} as Record<string, any>)

  const chartDataArray = Object.values(chartData).sort((a: any, b: any) => a.hour - b.hour)

  // Calculate summary statistics
  const totalScheduled = coverage.reduce((sum, item) => sum + item.scheduled_headcount, 0)
  const totalActual = coverage.reduce((sum, item) => sum + item.actual_headcount, 0)
  const understaffedHours = coverage.filter((item) => item.understaffed_flag).length
  const overtimeRiskHours = coverage.filter((item) => item.overtime_risk_flag).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading analytics...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Shift coverage analytics powered by Snowflake
          </p>
        </div>

        {/* Date Selector */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              📅 Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto px-6 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none font-medium"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-indigo-500 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Scheduled</span>
              <span className="text-2xl">📋</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalScheduled}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Total Actual</span>
              <span className="text-2xl">✅</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalActual}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Understaffed Hours</span>
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="text-3xl font-bold text-red-600">{understaffedHours}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm font-medium">Overtime Risk Hours</span>
              <span className="text-2xl">⏰</span>
            </div>
            <div className="text-3xl font-bold text-orange-600">{overtimeRiskHours}</div>
          </div>
        </div>

        {/* Chart */}
        {chartDataArray.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="mr-3">📊</span>
                Headcount by Hour
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartDataArray}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="hour" 
                  label={{ value: 'Hour', position: 'insideBottom', offset: -5 }}
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  label={{ value: 'Headcount', angle: -90, position: 'insideLeft' }}
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar dataKey="scheduled" fill="#6366f1" name="Scheduled" radius={[8, 8, 0, 0]} />
                <Bar dataKey="actual" fill="#10b981" name="Actual" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-fade-in">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📊</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Analytics Data</h3>
            <p className="text-gray-600 mb-2">
              No analytics data available for the selected date.
            </p>
            <p className="text-sm text-gray-500">
              Data will appear once shifts are created and events are processed by Snowflake.
            </p>
          </div>
        )}

        {/* Data Table */}
        {coverage.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
            <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="mr-3">📋</span>
                Detailed Coverage Data
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Hour
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Scheduled
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actual
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Understaffed
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Overtime Risk
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coverage.map((item, index) => (
                    <tr key={index} className="hover:bg-indigo-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.hour}:00
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.scheduled_headcount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {item.actual_headcount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.understaffed_flag ? (
                          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                            Yes
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.overtime_risk_flag ? (
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                            Yes
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
