'use client'

import { useEffect, useState } from 'react'
import CreateModal from '@/components/CreateModal'

interface Certification {
  certification_id: string
  name: string
  description?: string
  category?: string
  typical_validity_days?: number
}

export default function CertificationsManagementPage() {
  const [certifications, setCertifications] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateCert, setShowCreateCert] = useState(false)
  const [editingCert, setEditingCert] = useState<Certification | null>(null)
  const [creating, setCreating] = useState(false)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

  const fetchCertifications = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/certifications`)
      if (!response.ok) throw new Error('Failed to fetch certifications')
      const data = await response.json()
      setCertifications(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchCertifications()
      setLoading(false)
    }
    loadData()
  }, [apiBaseUrl])

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                Certification Management
              </h1>
              <p className="text-gray-600 text-lg">
                Manage certification definitions for personnel and units
              </p>
            </div>
            <button
              onClick={() => setShowCreateCert(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              + Add Certification
            </button>
          </div>
        </div>

        {/* Certifications Grid */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {certifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📜</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No Certifications</h3>
              <p className="text-gray-600 mb-4">Create certification definitions to use when assigning to personnel and units</p>
              <button
                onClick={() => setShowCreateCert(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Add Certification
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {certifications.map((cert) => (
                <div
                  key={cert.certification_id}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{cert.name}</h3>
                      {cert.category && (
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                          {cert.category}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingCert(cert)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  
                  {cert.description && (
                    <p className="text-sm text-gray-600 mb-3">{cert.description}</p>
                  )}
                  
                  {cert.typical_validity_days && (
                    <div>
                      <p className="text-sm text-gray-600">Typical Validity</p>
                      <p className="text-sm font-medium text-gray-900">{cert.typical_validity_days} days</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Certification Modal */}
        <CreateModal
          isOpen={showCreateCert || editingCert !== null}
          onClose={() => {
            setShowCreateCert(false)
            setEditingCert(null)
          }}
          title={editingCert ? "Edit Certification" : "Create Certification"}
          onSubmit={async (e) => {
            e.preventDefault()
            setCreating(true)
            const formData = new FormData(e.currentTarget)
            const certData = {
              name: formData.get('name') as string,
              description: formData.get('description') as string || undefined,
              category: formData.get('category') as string || undefined,
              typical_validity_days: formData.get('typical_validity_days') ? parseInt(formData.get('typical_validity_days') as string) : undefined,
            }
            try {
              const url = editingCert
                ? `${apiBaseUrl}/api/certifications/${editingCert.certification_id}`
                : `${apiBaseUrl}/api/certifications`
              const method = editingCert ? 'PUT' : 'POST'
              
              const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(certData),
              })
              if (!response.ok) throw new Error(`Failed to ${editingCert ? 'update' : 'create'} certification`)
              setShowCreateCert(false)
              setEditingCert(null)
              await fetchCertifications()
            } catch (err) {
              alert(err instanceof Error ? err.message : `Failed to ${editingCert ? 'update' : 'create'} certification`)
            } finally {
              setCreating(false)
            }
          }}
          submitLabel={creating ? (editingCert ? 'Updating...' : 'Creating...') : (editingCert ? 'Update Certification' : 'Create Certification')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" name="name" required defaultValue={editingCert?.name || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="e.g., Firefighter II, EMT-P, ACLS" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" rows={3} defaultValue={editingCert?.description || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Brief description of the certification" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select name="category" defaultValue={editingCert?.category || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                <option value="">Select category</option>
                <option value="Fire">Fire</option>
                <option value="EMS">EMS</option>
                <option value="Rescue">Rescue</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typical Validity (days)</label>
              <input type="number" name="typical_validity_days" min="1" defaultValue={editingCert?.typical_validity_days || ''} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="e.g., 365" />
            </div>
          </div>
        </CreateModal>
      </div>
    </div>
  )
}

