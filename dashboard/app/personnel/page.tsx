'use client'

import { useEffect, useState } from 'react'
import CreateModal from '@/components/CreateModal'

interface Personnel {
  personnel_id: string
  name: string
  rank?: string
  role: string
  certifications: string[]
  cert_expirations?: Record<string, string>
  availability_status: string
  station_id?: string
  current_unit_id?: string
}

interface Unit {
  unit_id: string
  unit_name: string
  type: string
  minimum_staff: number
  required_certifications: string[]
  station_id?: string
}

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreatePersonnel, setShowCreatePersonnel] = useState(false)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [certificationsList, setCertificationsList] = useState<any[]>([])
  const [selectedCertExpirations, setSelectedCertExpirations] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'personnel' | 'units'>('personnel')

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const fetchPersonnel = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/personnel`)
      if (!response.ok) throw new Error('Failed to fetch personnel')
      const data = await response.json()
      setPersonnel(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const fetchUnits = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/units`)
      if (!response.ok) throw new Error('Failed to fetch units')
      const data = await response.json()
      setUnits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchPersonnel(), fetchUnits(), fetchCertifications()])
      setLoading(false)
    }
    loadData()
  }, [apiBaseUrl])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: 'bg-green-100 text-green-800 border-green-300',
      OFF: 'bg-gray-100 text-gray-800 border-gray-300',
      IN_TRAINING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      DEPLOYED: 'bg-blue-100 text-blue-800 border-blue-300',
      ON_CALL: 'bg-purple-100 text-purple-800 border-purple-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getUnitTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ENGINE: 'bg-red-100 text-red-800 border-red-300',
      LADDER: 'bg-red-100 text-red-800 border-red-300',
      RESCUE: 'bg-orange-100 text-orange-800 border-orange-300',
      MEDIC: 'bg-blue-100 text-blue-800 border-blue-300',
      SAR_TEAM: 'bg-orange-100 text-orange-800 border-orange-300',
    }
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Loading...</p>
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                Personnel & Units
              </h1>
              <p className="text-gray-600 text-lg">
                Manage personnel and emergency response units
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {activeTab === 'personnel' ? (
                <button
                  onClick={() => setShowCreatePersonnel(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  + Add Personnel
                </button>
              ) : (
                <button
                  onClick={() => setShowCreateUnit(true)}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  + Add Unit
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 border-b border-gray-300">
            <button
              onClick={() => setActiveTab('personnel')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'personnel'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Personnel ({personnel.length})
            </button>
            <button
              onClick={() => setActiveTab('units')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'units'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Units ({units.length})
            </button>
          </div>
        </div>

        {/* Personnel Tab */}
        {activeTab === 'personnel' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {personnel.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">👤</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Personnel</h3>
                <p className="text-gray-600 mb-4">Add your first personnel member to get started</p>
                <button
                  onClick={() => setShowCreatePersonnel(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Personnel
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Certifications</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {personnel.map((person) => (
                      <tr key={person.personnel_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{person.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{person.rank || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{person.role}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {person.certifications.length > 0 ? (
                              person.certifications.map((cert, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full"
                                >
                                  {cert}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(person.availability_status)}`}>
                            {person.availability_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{person.station_id || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setEditingPersonnel(person)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Units Tab */}
        {activeTab === 'units' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {units.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🚨</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">No Units</h3>
                <p className="text-gray-600 mb-4">Add your first unit to get started</p>
                <button
                  onClick={() => setShowCreateUnit(true)}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Add Unit
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {units.map((unit) => (
                  <div
                    key={unit.unit_id}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{unit.unit_name}</h3>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getUnitTypeColor(unit.type)}`}>
                          {unit.type}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditingUnit(unit)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Minimum Staff</p>
                        <p className="text-lg font-semibold text-gray-900">{unit.minimum_staff}</p>
                      </div>
                      
                      {unit.required_certifications.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Required Certifications</p>
                          <div className="flex flex-wrap gap-1">
                            {unit.required_certifications.map((cert, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {unit.station_id && (
                        <div>
                          <p className="text-sm text-gray-600">Station</p>
                          <p className="text-sm font-medium text-gray-900">{unit.station_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Personnel Modal */}
        <CreateModal
          isOpen={showCreatePersonnel || editingPersonnel !== null}
          onClose={() => {
            setShowCreatePersonnel(false)
            setEditingPersonnel(null)
            setSelectedCertExpirations({})
          }}
          title={editingPersonnel ? "Edit Personnel" : "Create Personnel"}
          onSubmit={async (e) => {
            e.preventDefault()
            setCreating(true)
            const formData = new FormData(e.currentTarget)
            const selectedCerts = formData.getAll('certifications') as string[]
            
            // Build cert_expirations from selected certifications and their dates
            const cert_expirations: Record<string, string> = {}
            selectedCerts.forEach((certName) => {
              const expirationDate = formData.get(`cert_expiration_${certName}`) as string
              if (expirationDate && expirationDate.trim() !== '') {
                try {
                  // Convert date string (YYYY-MM-DD) to ISO datetime string for backend
                  const date = new Date(expirationDate + 'T23:59:59.000Z')
                  if (!isNaN(date.getTime())) {
                    cert_expirations[certName] = date.toISOString()
                  }
                } catch (e) {
                  console.error(`Failed to parse expiration date for ${certName}:`, e)
                }
              }
            })
            
            const personnelData: any = {
              name: formData.get('name') as string,
              rank: formData.get('rank') as string || undefined,
              role: formData.get('role') as string,
              certifications: selectedCerts,
              availability_status: formData.get('availability_status') as string || 'AVAILABLE',
              station_id: formData.get('station_id') as string || undefined,
            }
            
            // Only include cert_expirations if there are valid dates
            if (Object.keys(cert_expirations).length > 0) {
              personnelData.cert_expirations = cert_expirations
            }
            try {
              const url = editingPersonnel
                ? `${apiBaseUrl}/api/personnel/${editingPersonnel.personnel_id}`
                : `${apiBaseUrl}/api/personnel`
              const method = editingPersonnel ? 'PUT' : 'POST'
              
              const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(personnelData),
              })
              if (!response.ok) throw new Error(`Failed to ${editingPersonnel ? 'update' : 'create'} personnel`)
              setShowCreatePersonnel(false)
              setEditingPersonnel(null)
              await fetchPersonnel()
            } catch (err) {
              alert(err instanceof Error ? err.message : `Failed to ${editingPersonnel ? 'update' : 'create'} personnel`)
            } finally {
              setCreating(false)
            }
          }}
          submitLabel={creating ? (editingPersonnel ? 'Updating...' : 'Creating...') : (editingPersonnel ? 'Update Personnel' : 'Create Personnel')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" name="name" required defaultValue={editingPersonnel?.name || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rank</label>
              <input type="text" name="rank" defaultValue={editingPersonnel?.rank || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Captain, Lieutenant" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <input type="text" name="role" required defaultValue={editingPersonnel?.role || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., Firefighter, EMT-P" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Certifications</label>
              <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-3">
                {certificationsList.length === 0 ? (
                  <p className="text-sm text-gray-500">No certifications available. Create them in Certification Management.</p>
                ) : (
                  certificationsList.map((cert) => {
                    const isChecked = editingPersonnel?.certifications.includes(cert.name) || false
                    const existingExpiration = editingPersonnel?.cert_expirations?.[cert.name]
                    const expirationKey = `cert_expiration_${cert.name}`
                    return (
                      <div key={cert.certification_id} className="border-b border-gray-200 pb-2 last:border-b-0">
                        <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            name="certifications"
                            value={cert.name}
                            defaultChecked={isChecked}
                            onChange={(e) => {
                              if (!e.target.checked) {
                                setSelectedCertExpirations(prev => {
                                  const next = { ...prev }
                                  delete next[cert.name]
                                  return next
                                })
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700 flex-1">{cert.name}</span>
                          {cert.category && (
                            <span className="text-xs text-gray-500">({cert.category})</span>
                          )}
                        </label>
                        {isChecked && (
                          <div className="ml-6 mt-1">
                            <label className="block text-xs text-gray-600 mb-1">Expiration Date</label>
                            <input
                              type="date"
                              name={expirationKey}
                              defaultValue={existingExpiration ? existingExpiration.split('T')[0] : ''}
                              onChange={(e) => {
                                setSelectedCertExpirations(prev => ({
                                  ...prev,
                                  [cert.name]: e.target.value
                                }))
                              }}
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
              <select name="availability_status" defaultValue={editingPersonnel?.availability_status || 'AVAILABLE'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="AVAILABLE">Available</option>
                <option value="OFF">Off</option>
                <option value="IN_TRAINING">In Training</option>
                <option value="DEPLOYED">Deployed</option>
                <option value="ON_CALL">On Call</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Station ID</label>
              <input type="text" name="station_id" defaultValue={editingPersonnel?.station_id || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g., station-001" />
            </div>
          </div>
        </CreateModal>

        {/* Create/Edit Unit Modal */}
        <CreateModal
          isOpen={showCreateUnit || editingUnit !== null}
          onClose={() => {
            setShowCreateUnit(false)
            setEditingUnit(null)
          }}
          title={editingUnit ? "Edit Unit" : "Create Unit"}
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
              const url = editingUnit
                ? `${apiBaseUrl}/api/units/${editingUnit.unit_id}`
                : `${apiBaseUrl}/api/units`
              const method = editingUnit ? 'PUT' : 'POST'
              
              const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unitData),
              })
              if (!response.ok) throw new Error(`Failed to ${editingUnit ? 'update' : 'create'} unit`)
              setShowCreateUnit(false)
              setEditingUnit(null)
              await fetchUnits()
            } catch (err) {
              alert(err instanceof Error ? err.message : `Failed to ${editingUnit ? 'update' : 'create'} unit`)
            } finally {
              setCreating(false)
            }
          }}
          submitLabel={creating ? (editingUnit ? 'Updating...' : 'Creating...') : (editingUnit ? 'Update Unit' : 'Create Unit')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name *</label>
              <input type="text" name="unit_name" required defaultValue={editingUnit?.unit_name || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="e.g., Engine 1, Medic 5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type *</label>
              <select name="type" required defaultValue={editingUnit?.type || 'ENGINE'} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500">
                <option value="ENGINE">Engine</option>
                <option value="LADDER">Ladder</option>
                <option value="RESCUE">Rescue</option>
                <option value="MEDIC">Medic</option>
                <option value="SAR_TEAM">SAR Team</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Staff *</label>
              <input type="number" name="minimum_staff" required min="1" defaultValue={editingUnit?.minimum_staff || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Required Certifications</label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {certificationsList.length === 0 ? (
                  <p className="text-sm text-gray-500">No certifications available. Create them in Certification Management.</p>
                ) : (
                  certificationsList.map((cert) => {
                    const isChecked = editingUnit?.required_certifications.includes(cert.name) || false
                    return (
                      <label key={cert.certification_id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          name="required_certifications"
                          value={cert.name}
                          defaultChecked={isChecked}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{cert.name}</span>
                        {cert.category && (
                          <span className="text-xs text-gray-500">({cert.category})</span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select certifications required for this unit</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Station ID</label>
              <input type="text" name="station_id" defaultValue={editingUnit?.station_id || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="e.g., station-001" />
            </div>
          </div>
        </CreateModal>
      </div>
    </div>
  )
}

